/* =============================================================================
   DEAD:SEOUL — systems/dialogue.js
   대화창 러너(타이프라이터 · 선택지) · 퀘스트 트래커
   스크립트 본문은 story/stage1.js 에서 DS.Script 에 등록한다.

   노드 형식
     { who:'도윤', pal:'doyun', text:'...' }
     { who, pal, text, choices:[{ text, next:'키' | null, act(g){} }] }
     { act(g){}, auto:true }                 // 대사 없이 동작만
     { jump:'키' }                           // 다른 스크립트로 이어가기
   ============================================================================= */
'use strict';

DS.Script = {};

DS.Dialogue = (function () {

  const root = () => document.getElementById('dialogue');
  const elWho = () => root().querySelector('.who');
  const elLine = () => root().querySelector('.line');
  const elNext = () => root().querySelector('.next');
  const elChoices = () => root().querySelector('.choices');
  const elPortrait = () => root().querySelector('.portrait canvas');

  let queue = [];
  let node = null;
  let typed = 0, typeT = 0, full = '';
  let onDone = null;
  let active = false;
  let choiceIdx = 0;
  let game = null;
  const CPS = 52;

  function isActive() { return active; }

  function bind(g) { game = g; }

  /** key(문자열) 또는 노드 배열 재생 */
  function play(src, done) {
    const arr = typeof src === 'string' ? DS.Script[src] : src;
    if (!arr || !arr.length) { if (done) done(); return; }
    queue = arr.slice();
    onDone = done || null;
    active = true;
    root().classList.remove('hidden');
    DS.Input.enabled = false;
    advance();
  }

  function stop() {
    active = false;
    queue = []; node = null;
    root().classList.add('hidden');
    elChoices().classList.add('hidden');
    DS.Input.enabled = true;
    const f = onDone; onDone = null;
    if (f) f();
  }

  function advance() {
    elChoices().classList.add('hidden');
    elChoices().innerHTML = '';
    if (!queue.length) { stop(); return; }
    node = queue.shift();

    if (node.jump) {
      const nxt = DS.Script[node.jump];
      queue = (nxt ? nxt.slice() : []).concat(queue);
      advance(); return;
    }
    if (node.cond && game && !node.cond(game)) { advance(); return; }
    // 스크립트 act 오류가 대화를 영구 정지시키지 않도록 격리
    if (node.act && !node.text) { safe(node.act); advance(); return; }

    full = typeof node.text === 'function' ? node.text(game) : (node.text || '');
    typed = 0; typeT = 0;
    elWho().textContent = node.who || '';
    elWho().style.display = node.who ? '' : 'none';
    elLine().innerHTML = '';
    elNext().classList.add('hidden');
    DS.Gfx.paintPortrait(elPortrait(), node.pal || 'narrator');
    if (node.act) safe(node.act);
    if (node.sfx) DS.Audio.sfx(node.sfx);
  }

  /** 진행 입력 */
  function proceed() {
    if (!active) return;
    if (node && typed < full.length) { typed = full.length; render(); showNext(); return; }
    if (node && node.choices) return;      // 선택지는 클릭/숫자키로만
    advance();
  }

  function render() {
    const shown = full.slice(0, typed);
    elLine().innerHTML = shown.replace(/\n/g, '<br>');
  }

  function showNext() {
    if (node && node.choices) {
      buildChoices();
    } else {
      elNext().classList.remove('hidden');
    }
  }

  function buildChoices() {
    const box = elChoices();
    box.innerHTML = '';
    choiceIdx = 0;
    node.choices.forEach((ch, i) => {
      if (ch.cond && game && !ch.cond(game)) return;
      const b = document.createElement('button');
      b.innerHTML = `<span style="color:#5d646b;font-family:var(--mono)">${i + 1}.</span> ` +
                    (typeof ch.text === 'function' ? ch.text(game) : ch.text);
      b.addEventListener('click', () => chooseEl(ch));
      b.addEventListener('mouseenter', () => { DS.Audio.sfx('ui_move', { vol: 0.4 }); });
      box.appendChild(b);
    });
    box.classList.remove('hidden');
    const first = box.querySelector('button');
    if (first) first.classList.add('on');
  }

  /** 스크립트 콜백 실행 — 오류가 나도 대화 흐름은 계속 */
  function safe(fn) {
    try { fn(game); } catch (e) { console.error('[DS.Script] act 실행 오류:', e); }
  }

  function chooseEl(ch) {
    DS.Audio.sfx('ui_click');
    if (ch.act) safe(ch.act);
    if (ch.next) {
      const nxt = DS.Script[ch.next];
      queue = (nxt ? nxt.slice() : []).concat(queue);
    }
    advance();
  }

  function chooseIndex(i) {
    const btns = elChoices().querySelectorAll('button');
    if (!btns.length || i < 0 || i >= btns.length) return;
    btns[i].click();
  }

  function moveChoice(d) {
    const btns = elChoices().querySelectorAll('button');
    if (!btns.length) return;
    btns[choiceIdx].classList.remove('on');
    choiceIdx = (choiceIdx + d + btns.length) % btns.length;
    btns[choiceIdx].classList.add('on');
    DS.Audio.sfx('ui_move', { vol: 0.4 });
  }

  function update(dt) {
    if (!active || !node) return;
    if (typed < full.length) {
      typeT += dt;
      const want = Math.min(full.length, Math.floor(typeT * CPS));
      if (want !== typed) {
        // 타이핑 사운드 (과하지 않게)
        if ((want - typed) > 0 && Math.random() < 0.35) DS.Audio.sfx('ui_move', { vol: 0.12 });
        typed = want; render();
        if (typed >= full.length) showNext();
      }
    }
  }

  /** 키 입력 처리 (게임 루프에서 호출) */
  function handleKeys() {
    if (!active) return;
    if (node && node.choices && typed >= full.length) {
      if (DS.Input.consume('up')) moveChoice(-1);
      if (DS.Input.consume('down')) moveChoice(1);
      if (DS.Input.consume('attack') || DS.Input.consume('interact')) chooseIndex(choiceIdx);
      for (let i = 1; i <= 5; i++) if (DS.Input.consume('slot' + i)) chooseIndex(i - 1);
      return;
    }
    if (DS.Input.consume('attack') || DS.Input.consume('interact')) proceed();
  }

  // 대화창 클릭으로 진행
  document.addEventListener('DOMContentLoaded', () => {
    root().addEventListener('click', (e) => {
      if (e.target.closest('.choices')) return;
      proceed();
    });
  });

  return { play, stop, update, proceed, handleKeys, isActive, bind };
})();


/* =============================================================================
   퀘스트
   ============================================================================= */
DS.Quest = (function () {

  const DB = {
    q_bag: {
      name: '회색 백팩',
      desc: '민서의 백팩을 찾아 돌려준다. 하부 좌석 아래 어딘가로 밀려 들어갔다.',
      hint: '하부 좌석 라인 · 앞쪽(4호차 방향)',
      reward: [{ id: 'bandage', n: 2 }, { id: 'water', n: 1 }, { id: 'tape', n: 1 }]
    }
  };

  let state = {};   // id -> 'active' | 'done'

  function reset() { state = {}; }
  const status = (id) => state[id] || null;
  const isActive = (id) => state[id] === 'active';
  const isDone = (id) => state[id] === 'done';

  function start(id, game) {
    if (state[id]) return false;
    state[id] = 'active';
    const q = DB[id];
    if (game && q) {
      game.toast(`새 의뢰 — <b>${q.name}</b>`, 'warn');
      DS.Audio.sfx('chime', { vol: 0.5 });
    }
    return true;
  }

  function complete(id, game) {
    if (state[id] !== 'active') return false;
    state[id] = 'done';
    const q = DB[id];
    if (game && q) {
      game.toast(`의뢰 완료 — <b>${q.name}</b>`, 'get');
      DS.Audio.sfx('chime');
      if (q.reward) for (const r of q.reward) {
        DS.Inventory.add(game.player.inv, r.id, r.n);
        game.toast(`보상 · ${DS.Items.name(r.id)} x${r.n}`, 'get');
      }
    }
    return true;
  }

  function activeList() {
    return Object.keys(state).filter(k => state[k] === 'active').map(k => DB[k]);
  }

  return { DB, reset, start, complete, status, isActive, isDone, activeList,
           serialize: () => Object.assign({}, state),
           deserialize: (d) => { state = Object.assign({}, d || {}); } };
})();
