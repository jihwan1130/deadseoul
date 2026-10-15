/* =============================================================================
   DEAD:SEOUL — core/input.js
   키보드(e.code 기반 → 한글 IME 영향 없음) / 터치

   조작 원칙 — 게임플레이는 키보드만 사용한다.
     · 방향 전환은 이동키로 한다 (8방향 스냅, actors.js에서 보간).
     · 제자리에서 방향만 돌리려면 조준키(Q)를 누른 채 이동키를 누른다.
     · 마우스는 게임플레이에 일절 관여하지 않는다. (메뉴 클릭만 보조로 허용)
   ============================================================================= */
'use strict';

DS.Input = (function () {

  const down = new Set();      // 현재 눌림
  const pressed = new Set();   // 이 프레임에 눌림(소비형)
  const released = new Set();

  const BIND = {
    up:       ['KeyW', 'ArrowUp'],
    down:     ['KeyS', 'ArrowDown'],
    left:     ['KeyA', 'ArrowLeft'],
    right:    ['KeyD', 'ArrowRight'],
    run:      ['ShiftLeft', 'ShiftRight'],
    attack:   ['Space'],
    interact: ['KeyE'],
    alt:      ['KeyR'],      // 보조 동작 (소화기 분사 등)
    aim:      ['KeyQ'],      // 제자리 조준 — 이동을 멈추고 방향만 돌린다
    inv:      ['Tab'],
    craft:    ['KeyC'],
    light:    ['KeyF'],
    pause:    ['Escape'],
    confirm:  ['Enter', 'NumpadEnter', 'Space'],   // 메뉴 결정
    slot1:    ['Digit1'], slot2: ['Digit2'], slot3: ['Digit3'],
    slot4:    ['Digit4'], slot5: ['Digit5']
  };

  const touch = { active: false, mx: 0, my: 0, attack: false, interact: false, run: false };

  let enabled = true;      // 패널/대화 중에는 게임플레이 입력 차단

  function isDown(act) {
    const keys = BIND[act]; if (!keys) return false;
    for (const k of keys) if (down.has(k)) return true;
    return false;
  }
  function wasPressed(act) {
    const keys = BIND[act]; if (!keys) return false;
    for (const k of keys) if (pressed.has(k)) return true;
    return false;
  }
  function consume(act) {
    const keys = BIND[act]; if (!keys) return false;
    let hit = false;
    for (const k of keys) if (pressed.delete(k)) hit = true;
    return hit;
  }

  /** 이동/조준 입력 벡터 (정규화) */
  function moveVec() {
    let x = 0, y = 0;
    if (enabled) {
      if (isDown('left')) x -= 1;
      if (isDown('right')) x += 1;
      if (isDown('up')) y -= 1;
      if (isDown('down')) y += 1;
      if (touch.active) { x += touch.mx; y += touch.my; }
    }
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    return { x, y, len: Math.min(l, 1) };
  }

  const wantRun = () => enabled && (isDown('run') || touch.run);
  const wantAttack = () => enabled && (isDown('attack') || touch.attack);
  const wantInteractHold = () => enabled && (isDown('interact') || touch.interact);
  /** 제자리 조준: 이동은 멈추고 이동키를 방향 전환으로만 쓴다 */
  const wantAimHold = () => enabled && isDown('aim') && !touch.active;

  function init(canvas) {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      if (e.repeat) return;
      down.add(e.code);
      pressed.add(e.code);
    });
    window.addEventListener('keyup', (e) => {
      down.delete(e.code);
      released.add(e.code);
    });
    window.addEventListener('blur', () => { down.clear(); });

    // 캔버스에서 마우스는 메뉴 밖에서는 아무 역할도 하지 않는다.
    // 우클릭 메뉴만 막아 둔다 (드래그/선택으로 포커스가 빠지는 것 방지).
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('mousedown', (e) => e.preventDefault());

    initTouch();
  }

  /* ---------------- 터치 (모바일 가로형) ---------------- */
  function initTouch() {
    const root = document.getElementById('touch');
    const stick = document.getElementById('tstick');
    if (!root || !stick) return;

    const knob = stick.querySelector('i');
    let id = null, cx = 0, cy = 0, R = 48;

    const start = (e) => {
      const t = e.changedTouches[0];
      id = t.identifier;
      const r = stick.getBoundingClientRect();
      cx = r.left + r.width / 2; cy = r.top + r.height / 2; R = r.width * 0.42;
      touch.active = true;
      move(e);
    };
    const move = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== id) continue;
        let dx = t.clientX - cx, dy = t.clientY - cy;
        const l = Math.hypot(dx, dy) || 1;
        const cl = Math.min(l, R);
        dx = dx / l * cl; dy = dy / l * cl;
        knob.style.transform = `translate(${dx}px,${dy}px)`;
        touch.mx = dx / R; touch.my = dy / R;
      }
    };
    const end = () => {
      id = null; touch.active = false; touch.mx = 0; touch.my = 0;
      knob.style.transform = '';
    };

    stick.addEventListener('touchstart', (e) => { e.preventDefault(); start(e); }, { passive: false });
    stick.addEventListener('touchmove', (e) => { e.preventDefault(); move(e); }, { passive: false });
    stick.addEventListener('touchend', (e) => { e.preventDefault(); end(); }, { passive: false });
    stick.addEventListener('touchcancel', end);

    root.querySelectorAll('#tbtns button').forEach((b) => {
      const k = b.dataset.t;
      const on = (e) => {
        e.preventDefault();
        touch[k] = true;
        if (k === 'interact') pressed.add('KeyE');
        if (k === 'attack') pressed.add('Space');
      };
      const off = (e) => { e.preventDefault(); touch[k] = false; };
      b.addEventListener('touchstart', on, { passive: false });
      b.addEventListener('touchend', off, { passive: false });
      b.addEventListener('touchcancel', off);
    });

    // 터치 기기면 컨트롤 노출
    if (('ontouchstart' in window) || navigator.maxTouchPoints > 0) root.classList.remove('hidden');
  }

  /** 프레임 끝에서 호출 — 소비형 상태 초기화 */
  function endFrame() {
    pressed.clear(); released.clear();
  }

  return {
    init, endFrame, isDown, wasPressed, consume, moveVec,
    wantRun, wantAttack, wantInteractHold, wantAimHold,
    touch,
    get enabled() { return enabled; },
    set enabled(v) { enabled = v; },
    clear() { down.clear(); pressed.clear(); }
  };
})();
