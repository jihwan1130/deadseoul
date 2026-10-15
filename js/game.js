/* =============================================================================
   DEAD:SEOUL — game.js
   메인 루프 · 카메라 · 렌더 파이프라인 · 상호작용 · 세이브 · 상태 전이
   ============================================================================= */
'use strict';

DS.Game = (function () {

  const U = DS.U;
  const T = DS.TILE;
  const VW = DS.VIEW_W, VH = DS.VIEW_H;
  const SAVE_KEY = 'deadseoul.save.v1';

  /* ---------------------------------------------------------------------- */
  const G = {
    screen: null, sctx: null,
    buf: null, bctx: null,
    scale: 3,
    mode: 'title',           // title | play | dead
    paused: false,
    map: null,
    stage: null,
    props: [],
    zombies: [],
    npcs: [],
    player: null,
    lights: [],
    camera: { x: 0, y: 0, kick: 0, kickA: 0 },
    time: 0,
    hitStop: 0,
    hurtFlash: 0,
    lightLevel: 1,
    ambient: 0.9,
    ambientTarget: 0.9,
    flicker: 0,
    fire: { active: false, front: 0, glow: 0 },
    stats: { kills: 0, searched: 0, time: 0 },
    story: null,
    craftSel: 0,
    interact: null,          // 현재 조준 중 프롭
    holdT: 0,
    lastAutosave: 0
  };

  /* =========================================================================
     부트
     ========================================================================= */
  function boot() {
    G.screen = document.getElementById('screen');
    G.sctx = G.screen.getContext('2d');
    G.sctx.imageSmoothingEnabled = false;

    const b = U.makeCanvas(VW, VH);
    G.buf = b.canvas; G.bctx = b.ctx;

    DS.FX.init();
    DS.Input.init(G.screen);
    DS.Dialogue.bind(api);     // 스크립트의 act(g)에 넘어가는 것은 공개 API 여야 한다
    DS.HUD.init(api);

    window.addEventListener('resize', resize);
    resize();

    DS.HUD.loadingDone();
    DS.HUD.showTitle(!!localStorage.getItem(SAVE_KEY));

    // 첫 입력에서 오디오 컨텍스트 해제
    const unlock = () => { DS.Audio.init(); DS.Audio.resume(); };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });

    requestAnimationFrame(frame);
  }

  function resize() {
    const pad = 0;
    const w = window.innerWidth - pad, h = window.innerHeight - pad;
    let s = Math.min(w / VW, h / VH);
    s = Math.max(1, Math.floor(s * 2) / 2);     // 0.5 단위 (작은 화면 대응)
    if (s >= 2) s = Math.floor(s);
    G.scale = s;
    G.screen.width = Math.round(VW * s);
    G.screen.height = Math.round(VH * s);
    G.screen.style.width = Math.round(VW * s) + 'px';
    G.screen.style.height = Math.round(VH * s) + 'px';
    G.sctx = G.screen.getContext('2d');
    G.sctx.imageSmoothingEnabled = false;
  }

  /* =========================================================================
     월드 생성
     ========================================================================= */
  function buildWorld() {
    const stage = DS.Stage1.create();
    G.stage = stage;
    G.map = stage.map;
    G.props = stage.props;
    G.zombies = [];
    G.npcs = [];
    DS.FX.reset();
    DS.Quest.reset();
    G.stats = { kills: 0, searched: 0, time: 0 };
    G.fire = { active: false, front: stage.map.pxW, glow: 0 };
    G.hitStop = 0; G.hurtFlash = 0;

    // 조명 목록 구성 (int = 현재, target = 목표)
    G.lights = [];
    stage.lights.main.forEach(l => G.lights.push(Object.assign({}, l, { int: 1, target: 1, flick: false })));
    stage.lights.emer.forEach(l => G.lights.push(Object.assign({}, l, { int: 0, target: 0, flick: true })));
    stage.lights.track.forEach(l => G.lights.push(Object.assign({}, l, { int: 0, target: 0 })));

    // 플레이어
    G.player = new DS.Player(stage.playerStart.x, stage.playerStart.y);

    // NPC
    const np = propById('npc_minseo');
    if (np) {
      const npc = new DS.Npc(np.px, np.py, { pal: 'minseo', name: '민서', mode: 'hide' });
      G.npcs.push(npc);
      np.npcRef = npc;
    }

    G.camera.x = U.clamp(G.player.x - VW / 2, 0, G.map.pxW - VW);
    G.camera.y = U.clamp(G.player.y - VH / 2, 0, G.map.pxH - VH);

    G.survCtx = {
      onDeath: (cause) => onPlayerDeath(cause),
      onHurt: () => { G.hurtFlash = 1; }
    };
  }

  function startNew() {
    DS.Audio.init(); DS.Audio.resume();
    buildWorld();
    G.mode = 'play';
    G.paused = false;
    DS.HUD.hideTitle();
    DS.HUD.hideGameOver();
    DS.HUD.clearToasts();
    DS.HUD.show();
    DS.Input.enabled = true;
    DS.Story1.init(api);
    refreshUI();
  }

  function toTitle() {
    G.mode = 'title';
    G.paused = false;
    DS.Dialogue.stop();
    DS.HUD.closePanel();
    DS.HUD.cinemaHide();
    DS.HUD.showTitle(!!localStorage.getItem(SAVE_KEY));
    DS.Audio.music('calm');
    DS.Audio.ambience('subway_dark');
    DS.Input.enabled = false;
  }

  /* =========================================================================
     메인 루프
     ========================================================================= */
  let last = 0;
  function frame(ts) {
    requestAnimationFrame(frame);
    const now = ts / 1000;
    // 탭 전환/스파이크에 대비해 dt를 항상 유효 범위로 고정
    let dt = last ? U.clamp(now - last, 0, 1 / 20) : 1 / 60;
    last = now;
    G.time += dt;

    if (G.mode === 'title') {
      renderTitleBackdrop();
      DS.Input.endFrame();
      return;
    }

    // 전역 키
    if (DS.Input.consume('pause') && !DS.Dialogue.isActive() && !DS.HUD.isPanelOpen() && G.mode === 'play') {
      setPaused(!G.paused);
    }

    if (DS.Dialogue.isActive()) {
      DS.Dialogue.update(dt);
      DS.Dialogue.handleKeys();
    } else if (DS.HUD.isPanelOpen()) {
      DS.HUD.panelKeys();
    } else if (!G.paused && G.mode === 'play') {
      if (DS.Input.consume('inv')) DS.HUD.openPanel('inv');
      else if (DS.Input.consume('craft')) DS.HUD.openPanel('craft');
    }

    const frozen = G.paused || DS.HUD.isPanelOpen() || G.mode === 'dead';

    if (!frozen) {
      // 히트스톱
      let step = dt;
      if (G.hitStop > 0) {
        G.hitStop -= dt;
        step = dt * 0.12;
      }
      if (!DS.Dialogue.isActive()) {
        update(step);
      } else {
        // 대화 중엔 연출만 (파티클/조명)
        updateAmbient(step);
        DS.FX.update(step, G.map);
        G.stats.time += step;
      }
    }

    render();
    DS.Input.endFrame();
  }

  /* =========================================================================
     업데이트
     ========================================================================= */
  function update(dt) {
    const p = G.player;
    G.stats.time += dt;

    // 핫바 키
    for (let i = 1; i <= 5; i++) if (DS.Input.consume('slot' + i)) useHotbar(i - 1);
    if (DS.Input.consume('light')) toggleLight();
    if (DS.Input.consume('alt')) DS.Combat.spray(api);

    // 공격
    if (DS.Input.wantAttack() && !p.swing && p.attackCd <= 0 && p.stats.busy <= 0 && !G.holdActive) {
      DS.Combat.playerAttack(api);
    }

    p.update(dt, api);
    for (const z of G.zombies) z.update(dt, api);
    for (const n of G.npcs) n.update(dt, api);

    // 시체 정리 (오래된 것)
    for (let i = G.zombies.length - 1; i >= 0; i--) {
      const z = G.zombies[i];
      if (z.dead && z.deadT > 34) G.zombies.splice(i, 1);
    }

    updateInteract(dt);
    updateAmbient(dt);
    DS.FX.update(dt, G.map);
    updateCamera(dt);

    // 탈출 트리거
    const ez = propById('escape_zone');
    if (ez && G.story && G.story.doorOpen) {
      const z = ez.zone;
      if (p.x > z.x && p.x < z.x + z.w && p.y > z.y && p.y < z.y + z.h) {
        G.story.onEscape();
      }
    }

    if (G.story) G.story.update(dt, api);

    // 긴장도 → 음악
    let near = 0;
    for (const z of G.zombies) {
      if (z.dead) continue;
      const d = U.dist(z.x, z.y, p.x, p.y);
      if (d < 140) near += (1 - d / 140) * (z.state === 'chase' || z.state === 'attack' ? 1.4 : 0.5);
    }
    DS.Audio.setTension(U.clamp(near / 2.4, 0, 1));

    // 심박 (저체력)
    if (p.stats.hp < 30 && !p.stats.dead) {
      G.hbT = (G.hbT || 0) + dt;
      const period = 0.52 + (p.stats.hp / 30) * 0.4;
      if (G.hbT > period) { G.hbT = 0; DS.Audio.sfx('heartbeat', { vol: 0.5 }); }
    }

    G.hurtFlash = Math.max(0, G.hurtFlash - dt * 4);
    DS.HUD.hurtFlash(G.hurtFlash > 0.5);

    refreshUI();
    autosave();
  }

  function updateAmbient(dt) {
    // 조명 보간
    for (const l of G.lights) l.int = U.damp(l.int, l.target, 3.2, dt);

    if (G.flicker > 0) {
      G.flicker -= dt;
      for (const l of G.lights) {
        if (l.kind === 'main') l.int *= (Math.random() < 0.35 ? 0.2 : 1);
      }
    }

    G.ambient = U.damp(G.ambient, G.ambientTarget, 2.4, dt);
    // 좀비 시야 계산용 밝기 (플레이어 주변)
    let lv = G.ambient;
    for (const l of G.lights) {
      if (l.int < 0.05) continue;
      const d = U.dist(l.x, l.y, G.player.x, G.player.y);
      if (d < l.r) lv += l.int * (1 - d / l.r) * 0.8;
    }
    G.lightLevel = U.clamp(lv, 0, 1);

    // 화재 광원 펄스
    if (G.fire.active) G.fire.glow = 0.7 + Math.random() * 0.3;
  }

  function updateCamera(dt) {
    const p = G.player;
    // 조준 방향 약간 앞을 봄
    const lx = Math.cos(p.aim) * 16, ly = Math.sin(p.aim) * 10;
    let tx = p.x + lx - VW / 2;
    let ty = p.y + ly - VH / 2 - 4;
    tx = U.clamp(tx, 0, Math.max(0, G.map.pxW - VW));
    ty = U.clamp(ty, 0, Math.max(0, G.map.pxH - VH));
    G.camera.x = U.damp(G.camera.x, tx, 7, dt);
    G.camera.y = U.damp(G.camera.y, ty, 7, dt);

    if (G.camera.kick > 0) G.camera.kick = Math.max(0, G.camera.kick - dt * 30);
  }

  /* =========================================================================
     상호작용
     ========================================================================= */
  function candidates() {
    const p = G.player;
    const out = [];
    for (const pr of G.props) {
      if (pr.hidden) continue;
      if (pr.kind === 'exit' || pr.kind === 'gangway') continue;
      if (pr.once && pr.used) continue;
      if (pr.requireQuest && !DS.Quest.isActive(pr.requireQuest)) continue;
      if (pr.id === 'exit_d2' && pr.opened) continue;
      const d = U.dist(p.x, p.y, pr.ix, pr.iy);
      if (d <= (pr.radius || 15)) out.push({ pr, d });
    }
    // 죽은 좀비 수색
    for (const z of G.zombies) {
      if (!z.dead || z.searched) continue;
      const d = U.dist(p.x, p.y, z.x, z.y);
      if (d <= 14) out.push({ pr: zombieProp(z), d });
    }
    out.sort((a, b) => a.d - b.d);
    return out;
  }

  function zombieProp(z) {
    if (!z._prop) {
      z._prop = {
        id: 'z_' + (z.seed), kind: 'search', name: z.name.replace('감염자 · ', '') + '의 주머니',
        loot: 'body', hold: 1.2, once: true, used: false,
        ix: z.x, iy: z.y, px: z.x, py: z.y, radius: 14, zRef: z
      };
    }
    z._prop.ix = z.x; z._prop.iy = z.y; z._prop.px = z.x; z._prop.py = z.y;
    return z._prop;
  }

  function actionLabel(pr) {
    switch (pr.kind) {
      case 'search': return '수색';
      case 'locker': return '열기';
      case 'pickup': return '줍기';
      case 'cock': return '당기기';
      case 'door': return pr.locked ? '잠김' : '밀어서 열기';
      case 'npc': return '말 걸기';
      case 'read': return '확인';
      default: return '사용';
    }
  }

  function updateInteract(dt) {
    const p = G.player;
    const list = candidates();
    const cur = list.length ? list[0].pr : null;

    if (cur !== G.interact) { G.interact = cur; G.holdT = 0; }
    G.holdActive = false;

    if (p.stats.busy > 0) {
      DS.HUD.prompt(null);
      DS.HUD.hold(p.stats.busyLabel, 1 - p.stats.busy / (p.stats.busyMax || 1));
      return;
    }

    if (!cur) { DS.HUD.prompt(null); DS.HUD.hold(null, null); return; }

    const label = actionLabel(cur);
    DS.HUD.prompt(`<b>${cur.name}</b> — ${label}`);

    if (cur.kind === 'door' && cur.locked) {
      DS.HUD.hold(null, null);
      if (DS.Input.consume('interact')) {
        toast(cur.lockedMsg || '열리지 않는다.', 'warn');
        DS.Audio.sfx('door_rattle');
        DS.Combat.noise(api, p.x, p.y, 60, 'rattle');
      }
      return;
    }

    const hold = cur.hold || 0;
    if (hold > 0) {
      if (DS.Input.wantInteractHold()) {
        G.holdActive = true;
        G.holdT += dt;
        DS.HUD.hold(label + '…', G.holdT / hold);
        // 작업 중 소음
        if (cur.noise && Math.random() < dt * 3) DS.Combat.noise(api, p.x, p.y, cur.noise * 0.5, 'work');
        if (G.holdT >= hold) { G.holdT = 0; doInteract(cur); }
      } else {
        if (G.holdT > 0) G.holdT = Math.max(0, G.holdT - dt * 2);
        DS.HUD.hold(G.holdT > 0.02 ? label + '…' : null, G.holdT > 0.02 ? G.holdT / hold : null);
      }
    } else {
      DS.HUD.hold(null, null);
      if (DS.Input.consume('interact')) doInteract(cur);
    }
  }

  function doInteract(pr) {
    const p = G.player;

    switch (pr.kind) {
      case 'search':
      case 'locker': {
        DS.Audio.sfx('search');
        let got = [];
        if (pr.loot) got = DS.Items.roll(pr.loot);
        if (pr.give) got.push({ id: pr.give.id, n: pr.give.n });
        if (pr.gives) for (const gv of pr.gives) got.push({ id: gv.id, n: gv.n });
        if (!got.length) {
          toast(`${pr.name} — 쓸 만한 건 없다.`, '');
        } else {
          for (const g of got) {
            const left = DS.Inventory.add(p.inv, g.id, g.n);
            const took = g.n - left;
            if (took > 0) toast(`<b>${DS.Items.name(g.id)}</b> x${took}`, 'get');
            if (left > 0) toast(`소지품이 가득 차 ${DS.Items.name(g.id)} ${left}개를 두고 왔다.`, 'warn');
          }
          DS.Audio.sfx('pickup');
        }
        if (pr.flavor && !pr.flavorShown) { pr.flavorShown = true; toast(pr.flavor, ''); }
        pr.used = true;
        if (pr.zRef) pr.zRef.searched = true;
        G.stats.searched++;
        break;
      }

      case 'pickup': {
        const left = DS.Inventory.add(p.inv, pr.give.id, pr.give.n);
        if (left >= pr.give.n) { toast('소지품이 가득 찼다.', 'warn'); DS.Audio.sfx('ui_deny'); return; }
        toast(`<b>${DS.Items.name(pr.give.id)}</b> 획득`, 'get');
        DS.Audio.sfx('pickup');
        if (pr.flavor) toast(pr.flavor, '');
        pr.used = true;
        break;
      }

      case 'cock': {
        pr.used = true;
        break;
      }

      case 'door': {
        pr.opened = true;
        pr.used = true;
        openDoorTiles(pr);
        break;
      }

      case 'npc':
      case 'read':
        break;
    }

    if (G.story) G.story.onProp(pr);
    refreshUI();
    DS.HUD.hold(null, null);
  }

  /* =========================================================================
     문 / 관통문 열기 (bg 재페인팅 + 충돌 해제)
     ========================================================================= */
  function openDoorTiles(pr) {
    const c = G.map.bg.getContext('2d');
    c.imageSmoothingEnabled = false;
    for (const [tx, ty] of pr.tiles) {
      G.map.openTile(tx, ty);
      paintOpenDoor(c, tx, ty, ty >= G.map.h / 2 ? 'bottom' : 'top');
    }
    DS.FX.doShake(3);
  }

  function paintOpenDoor(c, tx, ty, side) {
    const x = tx * T, y = ty * T;
    // 열린 문: 어두운 개구부 + 좌우로 밀린 문짝
    c.fillStyle = '#0c0e11'; c.fillRect(x, y, T, T);
    const g = side === 'bottom'
      ? c.createLinearGradient(x, y, x, y + T)
      : c.createLinearGradient(x, y + T, x, y);
    g.addColorStop(0, 'rgba(0,0,0,0.75)');
    g.addColorStop(1, 'rgba(20,24,28,0.25)');
    c.fillStyle = g; c.fillRect(x, y, T, T);
    // 문짝 잔상 (양 끝)
    c.fillStyle = '#4a5055'; c.fillRect(x, y, 2, T);
    c.fillStyle = '#6a7278'; c.fillRect(x + T - 2, y, 2, T);
    // 발판 경계 황색
    c.fillStyle = '#b79326';
    if (side === 'bottom') c.fillRect(x, y, T, 1); else c.fillRect(x, y + T - 1, T, 1);
  }

  function openGangway(side) {
    const pr = propById(side === 'left' ? 'gangway_l' : 'gangway_r');
    if (!pr || pr.open) return;
    pr.open = true;
    const c = G.map.bg.getContext('2d');
    c.imageSmoothingEnabled = false;
    for (const [tx, ty] of pr.tiles) {
      G.map.openTile(tx, ty);
      const x = tx * T, y = ty * T;
      c.fillStyle = '#0a0b0d'; c.fillRect(x, y, T, T);
      const g = c.createLinearGradient(x, y, x + T, y);
      if (side === 'left') { g.addColorStop(0, 'rgba(0,0,0,0.9)'); g.addColorStop(1, 'rgba(30,34,38,0.2)'); }
      else { g.addColorStop(0, 'rgba(30,34,38,0.2)'); g.addColorStop(1, 'rgba(0,0,0,0.9)'); }
      c.fillStyle = g; c.fillRect(x, y, T, T);
      c.fillStyle = '#3a4046'; c.fillRect(x, y, T, 1); c.fillRect(x, y + T - 1, T, 1);
    }
    DS.Audio.sfx('door_slide', { vol: 0.7 });
    DS.FX.doShake(2);
  }

  /* =========================================================================
     조명 제어
     ========================================================================= */
  function lightsOn(on) {
    G.ambientTarget = on ? 0.5 : 0.155;
    for (const l of G.lights) {
      if (l.kind === 'main') { l.target = on ? 1 : 0; l.flick = !on; }
      if (l.kind === 'emer') l.target = on ? 0 : 1.0;
    }
    if (!on) DS.Audio.sfx('flick');
  }

  function flickerLights(t) { G.flicker = t; }
  function showTrackLights() {
    for (const l of G.lights) if (l.kind === 'track') l.target = 0.8;
  }
  function cameraKick(a) { G.camera.kick = a; DS.FX.doShake(a * 0.6); }

  function toggleLight() {
    const p = G.player;
    if (DS.Inventory.count(p.inv, 'phone') === 0) { toast('손전등으로 쓸 게 없다.', 'warn'); return; }
    p.light = !p.light;
    DS.Audio.sfx('flick');
    toast(p.light ? '휴대폰 손전등 <b>ON</b> — 멀리서도 눈에 띈다.' : '손전등 OFF', p.light ? 'warn' : '');
  }

  /* =========================================================================
     화재 / 연기
     ========================================================================= */
  function startFire() {
    G.fire.active = true;
    G.fire.front = G.map.pxW - 8;
    // 화재 광원
    G.lights.push({ x: (DS.Stage1.W - 1) * T, y: 6 * T + 8, r: 90, col: '#ff7a2f', int: 0, target: 1, kind: 'fire', flick: true });
  }

  function updateFire(dt) {
    if (!G.fire.active) return;
    const minX = 25 * T;
    const speed = G.fire.front > 36 * T ? 15 : 5.2;
    G.fire.front = Math.max(minX, G.fire.front - speed * dt);

    // 연기 입자 — 전선 근처에 집중, 안쪽은 희박하게
    G.smokeAcc = (G.smokeAcc || 0) + dt * 13;
    while (G.smokeAcc >= 1) {
      G.smokeAcc -= 1;
      const bias = Math.pow(Math.random(), 1.8);     // 0 근처가 많음 = 전선 가까이
      const x = G.fire.front + bias * (G.map.pxW - G.fire.front);
      const y = U.rand(3.2 * T, 9.8 * T);
      DS.FX.smokePuff(x, y, 1);
    }
    if (Math.random() < dt * 6) DS.FX.ember((DS.Stage1.W - 2) * T, U.rand(5 * T, 8 * T));

    // 플레이어 연기 농도
    const p = G.player;
    p.stats.inSmoke = U.clamp((p.x - G.fire.front) / 52, 0, 1);
    if (p.stats.inSmoke > 0.1 && !DS.Survival.has(p.stats, 'masked')) {
      if (!G.smokeWarned) { G.smokeWarned = true; toast('연기를 마셨다 — <b>방독면</b>이 필요하다.', 'bad'); }
    }
  }

  /* =========================================================================
     좀비 스폰
     ========================================================================= */
  function spawnZombie(type, where) {
    const s = G.stage.spawns[where] || G.stage.spawns.left;
    const z = new DS.Zombie(s.x + U.rand(-4, 4), s.y + U.rand(-10, 10), type);
    z.state = 'chase';
    z.target = { x: G.player.x, y: G.player.y };
    G.zombies.push(z);
    DS.Audio.sfxAt('z_alert', z.x, z.y, { vol: 0.6 });
    return z;
  }

  function aliveZombies() {
    let n = 0;
    for (const z of G.zombies) if (!z.dead) n++;
    return n;
  }

  /* =========================================================================
     아이템 조작
     ========================================================================= */
  function useHotbar(i) {
    const inv = G.player.inv;
    inv.hot = i;
    const s = inv.slots[i];
    if (!s) { DS.Audio.sfx('ui_deny', { vol: 0.4 }); refreshUI(); return; }
    const d = DS.Items.get(s.id);
    if (d.weapon || d.armor) equipSlot(i);
    else useSlot(i);
  }

  function equipSlot(i) {
    const inv = G.player.inv;
    const s = inv.slots[i];
    if (!s) return;
    if (DS.Inventory.equip(inv, i)) {
      DS.Audio.sfx('latch');
      const d = DS.Items.get(s.id);
      if (d.armor) {
        const on = DS.Inventory.isEquipped(inv, i);
        toast(`${d.name} ${on ? '착용' : '해제'}`, on ? 'get' : '');
        if (on && s.id === 'gasmask' && G.story) G.story.onMaskEquipped();
      } else {
        toast(`${d.name} ${inv.weapon === i ? '장착' : '해제'}`, '');
      }
      refreshUI();
    }
  }

  function useSlot(i) {
    const p = G.player;
    const inv = p.inv;
    const s = inv.slots[i];
    if (!s) return;
    const d = DS.Items.get(s.id);

    if (d.weapon || d.armor) { equipSlot(i); return; }
    if (s.id === 'note_notice') { DS.HUD.closePanel(); DS.Dialogue.play('note_read'); return; }
    if (!d.use) { DS.Audio.sfx('ui_deny', { vol: 0.5 }); return; }
    if (d.use.toggleLight) { toggleLight(); return; }
    if (p.stats.busy > 0) return;

    const time = d.use.time || 1;
    p.stats.busyMax = time;
    DS.Survival.beginBusy(p.stats, time, `${d.name} 사용 중…`, () => {
      DS.Survival.applyUse(p.stats, d.use);
      DS.Inventory.removeSlot(inv, i, 1);
      toast(`${d.name} 사용`, 'get');
      refreshUI();
    });
    if (d.use.sfx) DS.Audio.sfx(d.use.sfx);
    if (DS.HUD.isPanelOpen()) DS.HUD.closePanel();
  }

  function dropSlot(i) {
    const inv = G.player.inv;
    const s = inv.slots[i];
    if (!s) return;
    const d = DS.Items.get(s.id);
    if (d.noDrop) { toast('버릴 수 없다.', 'warn'); DS.Audio.sfx('ui_deny'); return; }
    toast(`${d.name} x${s.n} 버림`, '');
    inv.slots[i] = null;
    if (inv.weapon === i) inv.weapon = -1;
    DS.Audio.sfx('thud', { vol: 0.4 });
    refreshUI();
  }

  function doCraft(rcp) {
    const p = G.player;
    if (rcp.locked) { toast(rcp.locked, 'warn'); DS.Audio.sfx('ui_deny'); return; }
    if (!DS.Inventory.canCraft(p.inv, rcp)) { DS.Audio.sfx('ui_deny'); toast('재료가 부족하다.', 'warn'); return; }
    if (p.stats.busy > 0) return;
    p.stats.busyMax = rcp.time;
    DS.Survival.beginBusy(p.stats, rcp.time, `${DS.Items.name(rcp.out.id)} 제작 중…`, () => {
      if (DS.Inventory.craft(p.inv, rcp)) {
        DS.Audio.sfx('craft');
        toast(`<b>${DS.Items.name(rcp.out.id)}</b> 제작 완료`, 'get');
      }
      refreshUI();
    });
    DS.HUD.closePanel();
    DS.Audio.sfx('search', { vol: 0.6 });
  }

  /* =========================================================================
     UI 갱신
     ========================================================================= */
  function refreshUI() {
    if (!G.player) return;
    DS.HUD.updateStats(G.player.stats);
    DS.HUD.refreshHotbar(G.player.inv);
    DS.HUD.refreshEquip(G.player.inv);
    DS.HUD.refreshPanel();
  }

  function setObjective(t, s) {
    DS.HUD.setObjective(t, s);
    G.lastAutosave = 0;     // 다음 프레임에 오토세이브
  }

  function toast(h, c) { DS.HUD.toast(h, c); }

  /* =========================================================================
     렌더
     ========================================================================= */
  function render() {
    const c = G.bctx;
    const sh = DS.FX.shakeOffset();
    const kick = G.camera.kick;
    const camX = Math.round(G.camera.x + sh.x + (kick ? U.rand(-kick, kick) : 0));
    const camY = Math.round(G.camera.y + sh.y * 0.6 + (kick ? U.rand(-kick, kick) * 0.5 : 0));

    c.clearRect(0, 0, VW, VH);
    c.fillStyle = '#07080a'; c.fillRect(0, 0, VW, VH);

    // 배경 + 데칼
    c.drawImage(G.map.bg, -camX, -camY);
    c.drawImage(G.map.decal, -camX, -camY);

    // 바닥 파티클
    DS.FX.drawBelow(c, camX, camY);

    // y 소트 렌더 리스트
    const list = [];
    for (const pr of G.props) {
      if (pr.art === 'none' || pr.hidden) continue;
      if (pr.used && (pr.kind === 'pickup' || pr.art === 'seatgap' || pr.art === 'bag_minseo')) continue;
      if (pr.requireQuest && !DS.Quest.isActive(pr.requireQuest) && !pr.used) continue;
      if (pr.px - camX < -24 || pr.px - camX > VW + 24) continue;
      list.push({ y: pr.py, kind: 'prop', o: pr });
    }
    for (const z of G.zombies) {
      if (z.x - camX < -24 || z.x - camX > VW + 24) continue;
      list.push({ y: z.dead ? z.y - 100 : z.y, kind: 'z', o: z });
    }
    for (const n of G.npcs) list.push({ y: n.y, kind: 'npc', o: n });
    list.push({ y: G.player.y, kind: 'p', o: G.player });
    list.sort((a, b) => a.y - b.y);

    for (const it of list) {
      if (it.kind === 'prop') DS.Stage1.drawProp(c, it.o, it.o.px - camX, it.o.py - camY, G.time);
      else if (it.kind === 'z') it.o.draw(c, camX, camY, api);
      else if (it.kind === 'npc') it.o.draw(c, camX, camY);
      else it.o.draw(c, camX, camY, api);
    }

    // 상호작용 하이라이트
    if (G.interact && !G.interact.hidden) {
      const sx = Math.round(G.interact.ix - camX), sy = Math.round(G.interact.iy - camY);
      const a = 0.35 + 0.25 * Math.sin(G.time * 5);
      c.globalAlpha = a;
      c.fillStyle = '#e8edf0';
      c.fillRect(sx - 1, sy - 13, 2, 2);
      c.fillRect(sx - 3, sy - 11, 6, 1);
      c.globalAlpha = 1;
    }

    // 상단 파티클
    DS.FX.drawAbove(c, camX, camY);

    // 머리 위 손잡이
    DS.Tiles.drawOverhead(c, G.map, camX, camY, G.time, DS.FX.shakeAmt / 10);

    // 라이팅 — 플레이어 주변 최소 가독광을 더해 암부에서도 실루엣이 보이게
    const p = G.player;
    if (!G.selfLight) G.selfLight = { r: 34, col: '#aebcc6', int: 0.4, kind: 'self' };
    G.selfLight.x = p.x; G.selfLight.y = p.y - 11;
    G.selfLight.int = 0.26 + (1 - U.clamp(G.ambient / 0.5, 0, 1)) * 0.3;
    if (!G.lightList) G.lightList = [];
    G.lightList.length = 0;
    for (let i = 0; i < G.lights.length; i++) G.lightList.push(G.lights[i]);
    G.lightList.push(G.selfLight);

    const cone = p.lightFade > 0.02
      ? { x: p.x, y: p.y - 11, angle: p.aim, range: 100, spread: 1.05, int: p.lightFade }
      : null;
    DS.FX.renderLights(c, camX, camY, G.ambient, G.lightList, cone, G.time);

    // 연기/분말은 조명 위에
    DS.FX.drawVolumetric(c, camX, camY);

    // 포스트
    DS.FX.post(c, G.time, {
      smoke: p.stats.inSmoke * (DS.Survival.has(p.stats, 'masked') ? 0.5 : 1),
      lowHp: U.clamp(1 - p.stats.hp / 32, 0, 1),
      mask: DS.Survival.has(p.stats, 'masked')
    });

    // 화면 전사
    G.sctx.clearRect(0, 0, G.screen.width, G.screen.height);
    G.sctx.drawImage(G.buf, 0, 0, VW, VH, 0, 0, G.screen.width, G.screen.height);

    // 조준점
    const showCross = DS.Input.mouse.inside && !G.paused && !DS.HUD.isPanelOpen() && !DS.Dialogue.isActive() && G.mode === 'play';
    DS.HUD.crosshair(DS.Input.mouse.x, DS.Input.mouse.y, showCross);
  }

  /** 타이틀 화면 배경: 어두운 차량 내부를 천천히 패닝 */
  function renderTitleBackdrop() {
    const c = G.bctx;
    if (!G.map) {
      c.fillStyle = '#07080a'; c.fillRect(0, 0, VW, VH);
    } else {
      const camX = (Math.sin(G.time * 0.08) * 0.5 + 0.5) * Math.max(0, G.map.pxW - VW);
      const camY = Math.max(0, (G.map.pxH - VH) / 2);
      c.fillStyle = '#07080a'; c.fillRect(0, 0, VW, VH);
      c.drawImage(G.map.bg, -Math.round(camX), -Math.round(camY));
      DS.FX.renderLights(c, camX, camY, 0.09, G.lights, null, G.time);
      DS.FX.post(c, G.time, { smoke: 0, lowHp: 0, mask: false });
    }
    G.sctx.drawImage(G.buf, 0, 0, VW, VH, 0, 0, G.screen.width, G.screen.height);
  }

  /* =========================================================================
     상태 전이
     ========================================================================= */
  function setPaused(v) {
    G.paused = v;
    DS.HUD.showPause(v);
    DS.Input.enabled = !v;
    if (v) DS.Input.clear();
  }

  function onPlayerDeath(cause) {
    G.mode = 'dead';
    DS.Input.enabled = false;
    DS.Audio.music(null);
    DS.Audio.sfx('power_down', { vol: 0.6 });
    DS.FX.doShake(6);
    setTimeout(() => DS.HUD.showGameOver(describeDeath(cause)), 900);
  }

  function describeDeath(cause) {
    const map = {
      '감염체에게 물림': '감염체에게 물렸다. 서울 지하 2호선, 5호차.',
      '과다 출혈': '지혈하지 못했다. 붕대 한 장이 모자랐다.',
      '질식': '연기를 너무 많이 마셨다. 방독면은 손이 닿는 곳에 있었다.',
      '아사': '허기를 버티지 못했다.',
      '탈수': '물 한 병이 없었다.'
    };
    return map[cause] || cause || '사망';
  }

  function retry() {
    DS.HUD.hideGameOver();
    if (localStorage.getItem(SAVE_KEY)) loadSave();
    else startNew();
  }

  /* =========================================================================
     세이브 / 로드
     ========================================================================= */
  function snapshot() {
    const p = G.player;
    return {
      v: 1,
      t: Date.now(),
      player: { x: p.x, y: p.y, light: p.light },
      stats: {
        hp: p.stats.hp, stamina: p.stats.stamina, hunger: p.stats.hunger,
        thirst: p.stats.thirst, status: Object.keys(p.stats.status).reduce((a, k) => {
          a[k] = p.stats.status[k].time === Infinity ? -1 : p.stats.status[k].time; return a;
        }, {})
      },
      inv: DS.Inventory.serialize(p.inv),
      quest: DS.Quest.serialize(),
      story: G.story ? G.story.serialize() : null,
      props: G.props.map(pr => ({ id: pr.id, used: !!pr.used, hidden: !!pr.hidden, opened: !!pr.opened, locked: !!pr.locked, open: !!pr.open })),
      run: { kills: G.stats.kills, searched: G.stats.searched, time: G.stats.time },
      fire: { active: G.fire.active, front: G.fire.front },
      lights: G.lights.map(l => ({ kind: l.kind, target: l.target })),
      ambient: G.ambientTarget,
      npc: G.npcs.map(n => ({ x: n.x, y: n.y, mode: n.mode }))
    };
  }

  function save() {
    if (G.mode !== 'play') return;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(snapshot())); } catch (e) {}
  }

  /** 체크포인트는 "되살아날 수 있는 지점"이어야 한다 — 위급한 순간엔 저장하지 않는다 */
  function safeToSave() {
    const p = G.player;
    if (!p || p.stats.dead) return false;
    if (p.stats.hp < p.stats.hpMax * 0.3) return false;
    if (DS.Survival.has(p.stats, 'bleed')) return false;
    if (p.stats.inSmoke > 0.15 && !DS.Survival.has(p.stats, 'masked')) return false;
    for (const z of G.zombies) {
      if (z.dead) continue;
      if (z.state === 'chase' || z.state === 'attack') return false;
      if (U.dist(z.x, z.y, p.x, p.y) < 70) return false;
    }
    return true;
  }

  function autosave() {
    if (G.time - G.lastAutosave < 15) return;
    if (!safeToSave()) return;
    G.lastAutosave = G.time;
    save();
  }

  function loadSave() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) {}
    if (!d) { startNew(); return; }

    DS.Audio.init(); DS.Audio.resume();
    buildWorld();
    G.mode = 'play'; G.paused = false;
    DS.HUD.hideTitle(); DS.HUD.hideGameOver(); DS.HUD.clearToasts(); DS.HUD.show();
    DS.Input.enabled = true;
    DS.Story1.init(api, { restore: true });   // 지급/조명 세팅만, 오프닝 생략

    const p = G.player;
    p.x = d.player.x; p.y = d.player.y; p.light = !!d.player.light;
    Object.assign(p.stats, {
      hp: d.stats.hp, stamina: d.stats.stamina, hunger: d.stats.hunger, thirst: d.stats.thirst
    });
    p.stats.status = {};
    for (const k in (d.stats.status || {})) {
      p.stats.status[k] = { time: d.stats.status[k] < 0 ? Infinity : d.stats.status[k] };
    }
    // 체크포인트 복귀 보정 — 즉사 루프 방지 ("숨을 고른다")
    if (p.stats.hp < 32) p.stats.hp = 32;
    if (p.stats.stamina < 30) p.stats.stamina = 30;
    DS.Survival.removeStatus(p.stats, 'bleed');
    DS.Survival.removeStatus(p.stats, 'smoke');
    p.stats.dead = false;
    p.invuln = 2.5;
    p.inv = DS.Inventory.deserialize(d.inv);
    DS.Quest.deserialize(d.quest);
    if (G.story) G.story.deserialize(d.story);

    (d.props || []).forEach(sp => {
      const pr = propById(sp.id);
      if (!pr) return;
      pr.used = sp.used; pr.hidden = sp.hidden; pr.opened = sp.opened;
      if (pr.kind === 'door') pr.locked = sp.locked;
      if (pr.kind === 'gangway' && sp.open) { pr.open = false; openGangway(pr.side); }
      if (pr.kind === 'door' && sp.opened) { pr.tiles.forEach(([tx, ty]) => G.map.openTile(tx, ty)); openDoorTiles(pr); }
    });

    G.stats = Object.assign({ kills: 0, searched: 0, time: 0 }, d.run || {});
    G.ambientTarget = d.ambient == null ? 0.62 : d.ambient;
    G.ambient = G.ambientTarget;
    (d.lights || []).forEach((l, i) => { if (G.lights[i]) { G.lights[i].target = l.target; G.lights[i].int = l.target; } });
    if (d.fire && d.fire.active) { startFire(); G.fire.front = d.fire.front; }
    (d.npc || []).forEach((n, i) => { if (G.npcs[i]) { G.npcs[i].x = n.x; G.npcs[i].y = n.y; G.npcs[i].mode = n.mode; } });

    // 복원된 페이즈에 맞는 목표 재표시 (연출 재생 없이)
    DS.Dialogue.stop();
    G.story.restorePhase((d.story && d.story.phase) || 'survey');

    refreshUI();
    toast('저장된 지점에서 이어간다.', '');
  }

  /* ---------------------------------------------------------------------- */
  function propById(id) {
    for (const p of G.props) if (p.id === id) return p;
    return null;
  }

  /* =========================================================================
     공개 API
     ========================================================================= */
  const api = {
    boot,
    get map() { return G.map; },
    get props() { return G.props; },
    get zombies() { return G.zombies; },
    get npcs() { return G.npcs; },
    get player() { return G.player; },
    get camera() { return G.camera; },
    get lightLevel() { return G.lightLevel; },
    get ambient() { return G.ambient; },
    get lights() { return G.lights; },
    get stats() { return G.stats; },
    get paused() { return G.paused; },
    get mode() { return G.mode; },
    get time() { return G.time; },
    get fire() { return G.fire; },
    get survCtx() { return G.survCtx; },
    get story() { return G.story; },
    set story(v) { G.story = v; },
    get hitStop() { return G.hitStop; },
    set hitStop(v) { G.hitStop = v; },
    get hurtFlash() { return G.hurtFlash; },
    set hurtFlash(v) { G.hurtFlash = v; },
    get craftSel() { return G.craftSel; },
    set craftSel(v) { G.craftSel = v; },

    propById, spawnZombie, aliveZombies, openGangway, lightsOn, flickerLights,
    showTrackLights, cameraKick, startFire, updateFire, toggleLight,
    setObjective, toast, refreshUI,
    useHotbar, useSlot, equipSlot, dropSlot, doCraft,
    startNew, toTitle, setPaused, retry, save, loadSave,
    onKill: (z) => { if (G.story) G.story.onKill(z); },
    onPlayerHurt: () => {},
    onNoise: () => {}
  };

  return api;
})();

window.addEventListener('DOMContentLoaded', () => DS.Game.boot());
