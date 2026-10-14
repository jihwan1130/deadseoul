/* =============================================================================
   DEAD:SEOUL — systems/survival.js
   생존 스탯(체력/스태미나/허기/갈증) · 상태이상 · 피해/회복 처리
   밸런스 기준: 1막(지하철)을 10~15분 안에 끝낼 수 있는 속도로 소모.
   ============================================================================= */
'use strict';

DS.Survival = (function () {

  const U = DS.U;

  const RATE = {
    hunger:        0.10,   // 초당 감소
    thirst:        0.15,
    hungerRun:     0.10,   // 달릴 때 추가분 (배율이 아니라 가산)
    thirstRun:     0.22,
    staminaDrain:  19,     // 달리기
    staminaRegen:  15,
    staminaDelay:  0.55,   // 소모 후 회복 지연
    starveHp:      0.55,   // 허기 0일 때 초당 체력 감소
    dehydrateHp:   0.85,
    bleedHp:       1.25,
    smokeHp:       2.6,
    smokeStamina:  9
  };

  /* -------------------------------------------------------------------------
     상태이상 정의
     ------------------------------------------------------------------------- */
  const STATUS = {
    bleed:  { label: '출혈', cls: 'bad',  desc: '시간당 체력 감소. 붕대로 지혈.' },
    smoke:  { label: '연기 흡입', cls: 'bad', desc: '호흡 곤란. 방독면 필요.' },
    wired:  { label: '각성', cls: 'good', desc: '스태미나 회복 +60%' },
    drunk:  { label: '취기', cls: 'warn', desc: '피해 +10% / 받는 피해 +10%' },
    masked: { label: '방독면', cls: 'good', desc: '연기 면역 · 시야 좁음' },
    armored:{ label: '팔 보호대', cls: 'good', desc: '물림 피해 -45%' },
    exhaust:{ label: '탈진', cls: 'bad',  desc: '달릴 수 없다' },
    heavy:  { label: '과부하', cls: 'warn', desc: '이동 속도 감소' }
  };

  function create() {
    return {
      hp: 100, hpMax: 100,
      stamina: 100, staminaMax: 100,
      hunger: 86, hungerMax: 100,
      thirst: 78, thirstMax: 100,
      status: {},          // id -> {time(초, Infinity 가능), stacks}
      staminaIdle: 0,
      dead: false,
      deathCause: '',
      inSmoke: 0,          // 0~1 (연기 농도)
      busy: 0,             // 아이템 사용/작업 중 남은 시간
      busyLabel: ''
    };
  }

  const has = (st, id) => !!st.status[id];

  function addStatus(st, id, time) {
    const cur = st.status[id];
    if (cur && (cur.time === Infinity || (time != null && cur.time >= time))) {
      if (time != null && time > cur.time) cur.time = time;
      return;
    }
    st.status[id] = { time: time == null ? Infinity : time };
  }

  function removeStatus(st, id) { delete st.status[id]; }

  /* -------------------------------------------------------------------------
     업데이트
       ctx = { running, moving, dt, onDeath(cause), onHurt(amount, kind) }
     ------------------------------------------------------------------------- */
  function update(st, dt, ctx) {
    if (st.dead) return;

    // 상태이상 타이머
    for (const k in st.status) {
      const s = st.status[k];
      if (s.time !== Infinity) {
        s.time -= dt;
        if (s.time <= 0) delete st.status[k];
      }
    }

    // --- 허기 / 갈증 ---
    const run = ctx.running ? 1 : 0;
    st.hunger = U.clamp(st.hunger - (RATE.hunger + RATE.hungerRun * run) * dt, 0, st.hungerMax);
    st.thirst = U.clamp(st.thirst - (RATE.thirst + RATE.thirstRun * run) * dt, 0, st.thirstMax);

    // --- 스태미나 ---
    if (ctx.running && ctx.moving) {
      st.stamina -= RATE.staminaDrain * dt;
      st.staminaIdle = 0;
      if (st.stamina <= 0) { st.stamina = 0; addStatus(st, 'exhaust', 4.5); }
    } else {
      st.staminaIdle += dt;
      if (st.staminaIdle > RATE.staminaDelay) {
        let regen = RATE.staminaRegen;
        if (has(st, 'wired')) regen *= 1.6;
        if (st.thirst <= 0) regen *= 0.5;
        if (st.hunger <= 0) regen *= 0.6;
        if (has(st, 'smoke')) regen *= 0.35;
        st.stamina = Math.min(st.staminaMax, st.stamina + regen * dt);
      }
    }
    // 허기/갈증이 바닥이면 최대 스태미나 축소
    const cap = st.staminaMax * (st.hunger <= 0 || st.thirst <= 0 ? 0.55 : 1);
    if (st.stamina > cap) st.stamina = cap;
    st.staminaCap = cap;

    // --- 연기 ---
    if (st.inSmoke > 0.05 && !has(st, 'masked')) {
      addStatus(st, 'smoke', 2.0);
      st.stamina = Math.max(0, st.stamina - RATE.smokeStamina * st.inSmoke * dt);
    }

    // --- 지속 피해 ---
    let dot = 0, cause = '';
    if (st.hunger <= 0) { dot += RATE.starveHp; cause = '아사'; }
    if (st.thirst <= 0) { dot += RATE.dehydrateHp; cause = '탈수'; }
    if (has(st, 'bleed')) { dot += RATE.bleedHp; cause = '과다 출혈'; }
    if (has(st, 'smoke')) { dot += RATE.smokeHp * Math.max(0.4, st.inSmoke); cause = '질식'; }
    if (dot > 0) {
      st.hp -= dot * dt;
      if (st.hp <= 0) die(st, cause, ctx);
    }

    // --- 작업(사용) 타이머 ---
    if (st.busy > 0) {
      st.busy -= dt;
      if (st.busy <= 0) { st.busy = 0; st.busyLabel = ''; if (st.onBusyDone) { const f = st.onBusyDone; st.onBusyDone = null; f(); } }
    }
  }

  function die(st, cause, ctx) {
    if (st.dead) return;
    st.hp = 0; st.dead = true; st.deathCause = cause || '사망';
    if (ctx && ctx.onDeath) ctx.onDeath(st.deathCause);
  }

  /* -------------------------------------------------------------------------
     피해 / 회복
     ------------------------------------------------------------------------- */
  function damage(st, amount, kind, ctx) {
    if (st.dead) return 0;
    let amt = amount;
    if (kind === 'bite' && has(st, 'armored')) amt *= 0.55;
    if (has(st, 'drunk')) amt *= 1.1;
    st.hp -= amt;
    if (ctx && ctx.onHurt) ctx.onHurt(amt, kind);
    if (st.hp <= 0) {
      die(st, kind === 'bite' ? '감염체에게 물림' : (kind === 'smoke' ? '질식' : '사망'), ctx);
    }
    return amt;
  }

  function heal(st, amount) {
    st.hp = Math.min(st.hpMax, st.hp + amount);
  }

  /** 아이템 use 정의 적용 */
  function applyUse(st, use) {
    if (!use) return;
    if (use.hp) heal(st, use.hp);
    if (use.hunger) st.hunger = U.clamp(st.hunger + use.hunger, 0, st.hungerMax);
    if (use.thirst) st.thirst = U.clamp(st.thirst + use.thirst, 0, st.thirstMax);
    if (use.stamina) st.stamina = U.clamp(st.stamina + use.stamina, 0, st.staminaMax);
    if (use.cureBleed) removeStatus(st, 'bleed');
    if (use.buff) addStatus(st, use.buff.id, use.buff.time);
  }

  /** 작업 시작 (아이템 사용 / 수색 / 제작) */
  function beginBusy(st, time, label, done) {
    st.busy = time; st.busyLabel = label || ''; st.onBusyDone = done || null;
  }
  function cancelBusy(st) { st.busy = 0; st.busyLabel = ''; st.onBusyDone = null; }

  /** 이동 속도 배율 */
  function speedMul(st) {
    let m = 1;
    if (st.hunger <= 0) m *= 0.86;
    if (st.thirst <= 0) m *= 0.9;
    if (has(st, 'smoke')) m *= 0.84;
    if (has(st, 'drunk')) m *= 0.95;
    if (has(st, 'heavy')) m *= 0.84;
    if (st.hp < 25) m *= 0.9;
    return m;
  }

  const canRun = (st) => st.stamina > 6 && !has(st, 'exhaust');

  return {
    RATE, STATUS, create, update, damage, heal, applyUse,
    addStatus, removeStatus, has, die,
    beginBusy, cancelBusy, speedMul, canRun
  };
})();
