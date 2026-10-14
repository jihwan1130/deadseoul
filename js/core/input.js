/* =============================================================================
   DEAD:SEOUL — core/input.js
   키보드(e.code 기반 → 한글 IME 영향 없음) / 마우스 / 터치
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
    inv:      ['Tab'],
    craft:    ['KeyC'],
    light:    ['KeyF'],
    pause:    ['Escape'],
    slot1:    ['Digit1'], slot2: ['Digit2'], slot3: ['Digit3'],
    slot4:    ['Digit4'], slot5: ['Digit5']
  };

  const mouse = { x: 0, y: 0, wx: 0, wy: 0, down: false, clicked: false, inside: false };
  const touch = { active: false, mx: 0, my: 0, attack: false, interact: false, run: false };

  let enabled = true;      // 패널/대화 중에는 게임플레이 입력 차단
  let swallowNext = false;

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

  /** 이동 입력 벡터 (정규화) */
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
  const wantAttack = () => enabled && (isDown('attack') || mouse.down || touch.attack);
  const wantInteractHold = () => enabled && (isDown('interact') || touch.interact);

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
    window.addEventListener('blur', () => { down.clear(); mouse.down = false; });

    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = (e.clientX - r.left) / r.width * DS.VIEW_W;
      mouse.y = (e.clientY - r.top) / r.height * DS.VIEW_H;
      mouse.inside = true;
    });
    canvas.addEventListener('mouseleave', () => { mouse.inside = false; mouse.down = false; });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) { mouse.down = true; mouse.clicked = true; }
      if (e.button === 2) { pressed.add('KeyR'); }       // 우클릭 = 보조 동작
    });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) mouse.down = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    initTouch();
  }

  /* ---------------- 터치 (앱인토스 가로형 대비) ---------------- */
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
      b.addEventListener('mousedown', on);
      b.addEventListener('mouseup', off);
    });

    // 터치 기기면 컨트롤 노출
    if (('ontouchstart' in window) || navigator.maxTouchPoints > 0) root.classList.remove('hidden');
  }

  /** 프레임 끝에서 호출 — 소비형 상태 초기화 */
  function endFrame() {
    pressed.clear(); released.clear();
    mouse.clicked = false;
    if (swallowNext) { swallowNext = false; }
  }

  return {
    init, endFrame, isDown, wasPressed, consume, moveVec,
    wantRun, wantAttack, wantInteractHold,
    mouse, touch,
    get enabled() { return enabled; },
    set enabled(v) { enabled = v; if (!v) mouse.down = false; },
    clear() { down.clear(); pressed.clear(); mouse.down = false; }
  };
})();
