/* =============================================================================
   DEAD:SEOUL — ui/hud.js
   DOM 기반 UI 전체: 스탯 · 목표 · 핫바 · 장착 · 프롬프트 · 토스트 · 배너
                     소지품/제작 패널 · 타이틀 · 일시정지 · 사망 · 시네마틱
   ============================================================================= */
'use strict';

DS.HUD = (function () {

  const U = DS.U;
  const It = DS.Items;
  const Inv = DS.Inventory;

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.prototype.slice.call(document.querySelectorAll(s));

  let game = null;
  let panelOpen = false, panelTab = 'inv';
  let toastTimers = [];
  let lastObjective = '';
  let hotCells = [];

  /* =========================================================================
     초기화
     ========================================================================= */
  function init(g) {
    game = g;
    buildHotbar();
    buildPanelEvents();
    buildMenus();
  }

  function show() { $('#hud').classList.remove('hidden'); }
  function hide() { $('#hud').classList.add('hidden'); }

  /* =========================================================================
     스탯 바
     ========================================================================= */
  const statEls = {};
  function statEl(k) {
    if (!statEls[k]) {
      const row = $(`#stats .stat[data-k="${k}"]`);
      statEls[k] = { row, fill: row.querySelector('.bar i'), ghost: row.querySelector('.bar b'), num: row.querySelector('.num') };
    }
    return statEls[k];
  }

  function updateStats(st) {
    const set = (k, v, max) => {
      const e = statEl(k);
      const pct = U.clamp(v / max * 100, 0, 100);
      e.fill.style.width = pct + '%';
      e.ghost.style.width = pct + '%';
      e.num.textContent = Math.round(v);
      e.row.classList.toggle('low', pct < 25);
    };
    set('hp', st.hp, st.hpMax);
    set('stamina', st.stamina, st.staminaMax);
    set('hunger', st.hunger, st.hungerMax);
    set('thirst', st.thirst, st.thirstMax);

    // 상태이상
    const box = $('#statuses');
    const keys = Object.keys(st.status);
    const sig = keys.map(k => k + (st.status[k].time === Infinity ? '' : '|' + Math.ceil(st.status[k].time))).join(',');
    if (box._sig !== sig) {
      box._sig = sig;
      box.innerHTML = '';
      for (const k of keys) {
        const d = DS.Survival.STATUS[k];
        if (!d) continue;
        const el = document.createElement('div');
        el.className = 'status ' + (d.cls || '');
        const t = st.status[k].time;
        el.textContent = d.label + (t === Infinity ? '' : ' ' + Math.ceil(t) + 's');
        el.title = d.desc || '';
        box.appendChild(el);
      }
    }
  }

  /* =========================================================================
     목표
     ========================================================================= */
  function setObjective(text, sub) {
    const o = $('#objective');
    if (text !== lastObjective) {
      lastObjective = text;
      o.classList.remove('flash');
      void o.offsetWidth;
      o.classList.add('flash');
      DS.Audio.sfx('ui_click', { vol: 0.4 });
    }
    o.querySelector('.text').innerHTML = text || '—';
    o.querySelector('.sub').innerHTML = sub || '';
  }

  /* =========================================================================
     배너
     ========================================================================= */
  function banner(kick, main) {
    const b = $('#banner');
    b.innerHTML = `<div class="b-kick">${kick || ''}</div><div class="b-main">${main || ''}</div>`;
    b.classList.remove('show');
    void b.offsetWidth;
    b.classList.add('show');
  }

  /* =========================================================================
     토스트
     ========================================================================= */
  function toast(html, cls) {
    const box = $('#toasts');
    const el = document.createElement('div');
    el.className = 'toast ' + (cls || '');
    el.innerHTML = html;
    box.appendChild(el);
    while (box.children.length > 6) box.removeChild(box.firstChild);
    const t1 = setTimeout(() => el.classList.add('fade'), 3200);
    const t2 = setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 3800);
    toastTimers.push(t1, t2);
  }

  function clearToasts() {
    toastTimers.forEach(clearTimeout);
    toastTimers = [];
    $('#toasts').innerHTML = '';
  }

  /* =========================================================================
     상호작용 프롬프트 / 홀드바
     ========================================================================= */
  function prompt(text) {
    const p = $('#prompt');
    if (!text) { p.classList.add('hidden'); return; }
    p.classList.remove('hidden');
    p.querySelector('.t').innerHTML = text;
  }

  function hold(label, progress) {
    const h = $('#holdbar');
    if (progress == null) { h.classList.add('hidden'); return; }
    h.classList.remove('hidden');
    h.querySelector('.lbl').textContent = label || '';
    h.querySelector('.track i').style.width = U.clamp(progress * 100, 0, 100) + '%';
  }

  /* =========================================================================
     핫바 / 장착
     ========================================================================= */
  function buildHotbar() {
    const box = $('#hotbar');
    box.innerHTML = '';
    hotCells = [];
    for (let i = 0; i < Inv.HOTBAR; i++) {
      const el = document.createElement('div');
      el.className = 'hs empty';
      el.innerHTML = `<span class="n">${i + 1}</span><canvas width="32" height="32"></canvas><span class="c"></span>`;
      el.addEventListener('click', () => { if (game) game.useHotbar(i); });
      box.appendChild(el);
      hotCells.push(el);
    }
  }

  function refreshHotbar(inv) {
    for (let i = 0; i < Inv.HOTBAR; i++) {
      const el = hotCells[i];
      const s = inv.slots[i];
      el.classList.toggle('empty', !s);
      el.classList.toggle('sel', inv.hot === i);
      el.classList.toggle('eq', Inv.isEquipped(inv, i));
      const cv = el.querySelector('canvas');
      DS.Gfx.paintIcon(cv, s ? It.get(s.id).icon : null);
      el.querySelector('.c').textContent = (s && s.n > 1) ? s.n : '';
      el.title = s ? It.get(s.id).name : '';
    }
  }

  function refreshEquip(inv) {
    const wp = Inv.weapon(inv);
    const w = $('#eq-weapon');
    w.querySelector('.v').textContent = wp.d.name;
    const durBox = w.querySelector('.dur');
    if (isFinite(wp.dur) && wp.w.dur && isFinite(wp.w.dur)) {
      durBox.style.display = '';
      const f = U.clamp(wp.dur / wp.w.dur, 0, 1);
      durBox.querySelector('i').style.width = (f * 100) + '%';
      durBox.classList.toggle('low', f < 0.3);
    } else {
      durBox.style.display = 'none';
    }
    const parts = [];
    if (inv.armorHead) parts.push(It.name(inv.armorHead.id));
    if (inv.armorArm) parts.push(It.name(inv.armorArm.id));
    $('#eq-armor').querySelector('.v').textContent = parts.length ? parts.join(' · ') : '없음';
  }

  /* =========================================================================
     패널 (소지품 / 제작)
     ========================================================================= */
  function buildPanelEvents() {
    $$('#panel .tabs button').forEach(b => {
      b.addEventListener('click', () => { openPanel(b.dataset.tab); DS.Audio.sfx('ui_click'); });
    });
    $('#panel .close').addEventListener('click', () => closePanel());
  }

  function isPanelOpen() { return panelOpen; }

  function openPanel(tab) {
    panelOpen = true;
    panelTab = tab || panelTab || 'inv';
    $('#panel').classList.remove('hidden');
    $$('#panel .tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === panelTab));
    $$('#panel section').forEach(s => s.classList.toggle('hidden', s.dataset.pane !== panelTab));
    DS.Input.enabled = false;
    DS.Input.clear();
    refreshPanel();
  }

  function closePanel() {
    panelOpen = false;
    $('#panel').classList.add('hidden');
    if (!DS.Dialogue.isActive() && !game.paused) DS.Input.enabled = true;
    DS.Audio.sfx('ui_click', { vol: 0.5 });
  }

  function refreshPanel() {
    if (!panelOpen) return;
    if (panelTab === 'inv') renderInv();
    else renderCraft();
  }

  function renderInv() {
    const inv = game.player.inv;
    const grid = $('#inv-grid');
    grid.innerHTML = '';
    for (let i = 0; i < Inv.SIZE; i++) {
      const s = inv.slots[i];
      const cell = document.createElement('div');
      cell.className = 'cell' + (s ? '' : ' void') + (inv.sel === i ? ' sel' : '') + (Inv.isEquipped(inv, i) ? ' eq' : '');
      cell.innerHTML = `<canvas width="36" height="36"></canvas><span class="c">${s && s.n > 1 ? s.n : ''}</span>`;
      DS.Gfx.paintIcon(cell.querySelector('canvas'), s ? It.get(s.id).icon : null);
      if (s) {
        cell.addEventListener('click', () => { inv.sel = i; DS.Audio.sfx('ui_move', { vol: 0.5 }); renderInv(); });
        cell.addEventListener('dblclick', () => game.useSlot(i));
      }
      grid.appendChild(cell);
    }

    // 상세
    const d = $('#inv-detail');
    const s = inv.slots[inv.sel];
    const nameEl = d.querySelector('.d-name'), tagEl = d.querySelector('.d-tag'),
          descEl = d.querySelector('.d-desc'), statsEl = d.querySelector('.d-stats'),
          actsEl = d.querySelector('.d-acts');
    DS.Gfx.paintIcon(d.querySelector('canvas'), s ? It.get(s.id).icon : null);
    statsEl.innerHTML = ''; actsEl.innerHTML = '';

    if (!s) {
      nameEl.textContent = '—'; tagEl.textContent = '';
      descEl.textContent = `빈 슬롯 (여유 ${Inv.freeSlots(inv)}/${Inv.SIZE})`;
      return;
    }
    const def = It.get(s.id);
    nameEl.textContent = def.name + (s.n > 1 ? ` x${s.n}` : '');
    tagEl.textContent = def.tag || '';
    descEl.textContent = def.desc || '';

    const kv = (k, v, cls) => {
      const e = document.createElement('div');
      e.className = 'kv ' + (cls || '');
      e.innerHTML = `<span>${k}</span><span>${v}</span>`;
      statsEl.appendChild(e);
    };
    if (def.weapon) {
      const w = def.weapon;
      kv('피해', w.dmg);
      kv('사거리', (w.range / 16).toFixed(1) + ' 타일');
      kv('속도', (1 / w.cd).toFixed(1) + ' 회/초');
      kv('치명타', 'x' + w.crit);
      kv('스태미나', w.stam);
      kv('소음', w.noise >= 60 ? '큼' : (w.noise >= 30 ? '보통' : '작음'));
      if (isFinite(w.dur)) kv('내구도', `${Math.max(0, Math.ceil(s.dur == null ? w.dur : s.dur))} / ${w.dur}`,
                              (s.dur != null && s.dur / w.dur < 0.3) ? 'no' : '');
      if (def.alt) kv(def.alt.label, (s.charges == null ? def.alt.charges : s.charges) + '회');
    }
    if (def.use) {
      const u = def.use;
      if (u.hp) kv('체력', '+' + u.hp, 'yes');
      if (u.hunger) kv('허기', (u.hunger > 0 ? '+' : '') + u.hunger, u.hunger > 0 ? 'yes' : 'no');
      if (u.thirst) kv('갈증', (u.thirst > 0 ? '+' : '') + u.thirst, u.thirst > 0 ? 'yes' : 'no');
      if (u.stamina) kv('스태미나', '+' + u.stamina, 'yes');
      if (u.cureBleed) kv('출혈', '치료', 'yes');
      if (u.time) kv('사용 시간', u.time + '초');
    }
    if (def.armor) kv('효과', def.armor.label, 'yes');

    const mkBtn = (label, fn, primary, disabled) => {
      const b = document.createElement('button');
      b.textContent = label;
      if (primary) b.className = 'primary';
      if (disabled) b.disabled = true;
      else b.addEventListener('click', fn);
      actsEl.appendChild(b);
    };
    if (def.weapon) mkBtn(inv.weapon === inv.sel ? '해제' : '장착', () => { game.equipSlot(inv.sel); }, true);
    else if (def.armor) mkBtn(Inv.isEquipped(inv, inv.sel) ? '해제' : '착용', () => { game.equipSlot(inv.sel); }, true);
    else if (def.use) mkBtn('사용', () => { game.useSlot(inv.sel); }, true);
    if (def.id === 'note_notice') mkBtn('읽기', () => { closePanel(); DS.Dialogue.play('note_read'); });
    if (!def.noDrop) mkBtn('버리기', () => { game.dropSlot(inv.sel); });
  }

  function renderCraft() {
    const inv = game.player.inv;
    const list = $('#craft-list');
    list.innerHTML = '';
    if (game.craftSel == null) game.craftSel = 0;

    It.RECIPES.forEach((r, i) => {
      const out = It.get(r.out.id);
      const ok = Inv.canCraft(inv, r);
      const el = document.createElement('div');
      el.className = 'rcp ' + (r.locked ? 'locked' : (ok ? 'ok' : 'no')) + (game.craftSel === i ? ' sel' : '');
      const mats = r.mats.map(m => `${It.name(m.id)} ${Inv.count(inv, m.id)}/${m.n}`).join(' · ');
      el.innerHTML = `<canvas width="30" height="30"></canvas>
        <div><div class="r-n">${out ? out.name : r.out.id}</div><div class="r-m">${mats}</div></div>`;
      DS.Gfx.paintIcon(el.querySelector('canvas'), out ? out.icon : null);
      el.addEventListener('click', () => { game.craftSel = i; DS.Audio.sfx('ui_move', { vol: 0.5 }); renderCraft(); });
      list.appendChild(el);
    });

    const r = It.RECIPES[game.craftSel];
    const d = $('#craft-detail');
    const out = r ? It.get(r.out.id) : null;
    DS.Gfx.paintIcon(d.querySelector('canvas'), out ? out.icon : null);
    d.querySelector('.d-name').textContent = out ? out.name : '—';
    d.querySelector('.d-tag').textContent = out ? (out.tag || '') : '';
    d.querySelector('.d-desc').textContent = r ? (r.locked ? r.locked : (r.hint || (out ? out.desc : ''))) : '';
    const mats = d.querySelector('.d-mats');
    const acts = d.querySelector('.d-acts');
    mats.innerHTML = ''; acts.innerHTML = '';
    if (!r) return;
    for (const m of r.mats) {
      const have = Inv.count(inv, m.id);
      const e = document.createElement('div');
      e.className = 'kv ' + (have >= m.n ? 'yes' : 'no');
      e.innerHTML = `<span>${It.name(m.id)}</span><span>${have} / ${m.n}</span>`;
      mats.appendChild(e);
    }
    const e2 = document.createElement('div');
    e2.className = 'kv';
    e2.innerHTML = `<span>작업 시간</span><span>${r.time}초</span>`;
    mats.appendChild(e2);

    const b = document.createElement('button');
    b.textContent = r.locked ? '제작 불가' : '제작';
    b.className = 'primary';
    if (r.locked || !Inv.canCraft(inv, r)) b.disabled = true;
    else b.addEventListener('click', () => game.doCraft(r));
    acts.appendChild(b);
  }

  /** 패널 열려 있을 때 키 입력 */
  function panelKeys() {
    if (!panelOpen) return;
    const inv = game.player.inv;
    if (panelTab === 'inv') {
      let moved = false;
      if (DS.Input.consume('left')) { inv.sel = (inv.sel + Inv.SIZE - 1) % Inv.SIZE; moved = true; }
      if (DS.Input.consume('right')) { inv.sel = (inv.sel + 1) % Inv.SIZE; moved = true; }
      if (DS.Input.consume('up')) { inv.sel = (inv.sel + Inv.SIZE - 5) % Inv.SIZE; moved = true; }
      if (DS.Input.consume('down')) { inv.sel = (inv.sel + 5) % Inv.SIZE; moved = true; }
      if (moved) { DS.Audio.sfx('ui_move', { vol: 0.4 }); renderInv(); }
      if (DS.Input.consume('attack')) game.useSlot(inv.sel);
    } else {
      let moved = false;
      if (DS.Input.consume('up')) { game.craftSel = (game.craftSel + It.RECIPES.length - 1) % It.RECIPES.length; moved = true; }
      if (DS.Input.consume('down')) { game.craftSel = (game.craftSel + 1) % It.RECIPES.length; moved = true; }
      if (moved) { DS.Audio.sfx('ui_move', { vol: 0.4 }); renderCraft(); }
      if (DS.Input.consume('attack')) { const r = It.RECIPES[game.craftSel]; if (r) game.doCraft(r); }
    }
    if (DS.Input.consume('inv')) { if (panelTab === 'inv') closePanel(); else openPanel('inv'); }
    if (DS.Input.consume('craft')) { if (panelTab === 'craft') closePanel(); else openPanel('craft'); }
    if (DS.Input.consume('pause')) closePanel();
  }

  /* =========================================================================
     메뉴 (타이틀 / 일시정지 / 사망 / 조작법 / 시네마틱)
     ========================================================================= */
  function buildMenus() {
    $$('#title .menu button').forEach(b => {
      b.addEventListener('click', () => {
        DS.Audio.init(); DS.Audio.resume(); DS.Audio.sfx('ui_click');
        const a = b.dataset.act;
        if (a === 'new') game.startNew();
        else if (a === 'continue') game.loadSave();
        else if (a === 'howto') showHowto(() => {});
      });
    });
    $$('#pause .menu button').forEach(b => {
      b.addEventListener('click', () => {
        DS.Audio.sfx('ui_click');
        const a = b.dataset.act;
        if (a === 'resume') game.setPaused(false);
        else if (a === 'save') { game.save(); toast('저장했다.', 'get'); }
        else if (a === 'howto') { $('#pause').classList.add('hidden'); showHowto(() => $('#pause').classList.remove('hidden')); }
        else if (a === 'title') game.toTitle();
      });
    });
    $$('#gameover .menu button').forEach(b => {
      b.addEventListener('click', () => {
        DS.Audio.sfx('ui_click');
        const a = b.dataset.act;
        if (a === 'retry') game.retry();
        else if (a === 'title') game.toTitle();
      });
    });
    $('#howto .back').addEventListener('click', () => {
      $('#howto').classList.add('hidden');
      if (howtoBack) { const f = howtoBack; howtoBack = null; f(); }
    });
    $('#cinema .cin-next').addEventListener('click', () => {
      if (cinNext) { const f = cinNext; cinNext = null; f(); }
    });
  }

  let howtoBack = null;
  function showHowto(back) { howtoBack = back || null; $('#howto').classList.remove('hidden'); }

  function showTitle(hasSave) {
    $('#title').classList.remove('hidden');
    $('#hud').classList.add('hidden');
    $('#pause').classList.add('hidden');
    $('#gameover').classList.add('hidden');
    $('#cinema').classList.add('hidden');
    $('#panel').classList.add('hidden');
    $('#dialogue').classList.add('hidden');
    const c = $('#title .menu button[data-act=continue]');
    c.disabled = !hasSave;
  }
  function hideTitle() { $('#title').classList.add('hidden'); }

  function showPause(v) { $('#pause').classList.toggle('hidden', !v); }

  function showGameOver(cause) {
    $('#gameover').classList.remove('hidden');
    $('#gameover .cause').textContent = cause || '';
  }
  function hideGameOver() { $('#gameover').classList.add('hidden'); }

  let cinNext = null;
  /** 시네마틱 텍스트. opt = {kicker, title, text, button, onNext} */
  function cinema(opt) {
    const el = $('#cinema');
    el.classList.remove('hidden');
    $('#hud').classList.add('hidden');          // 연출 중엔 HUD를 비운다
    prompt(null); hold(null, null);
    requestAnimationFrame(() => el.classList.add('on'));
    el.querySelector('.cin-kicker').textContent = opt.kicker || '';
    el.querySelector('.cin-title').textContent = opt.title || '';
    const t = el.querySelector('.cin-text');
    t.textContent = opt.text || '';
    t.classList.remove('fade-up'); void t.offsetWidth; t.classList.add('fade-up');
    const btn = el.querySelector('.cin-next');
    if (opt.onNext) {
      btn.classList.remove('hidden');
      btn.textContent = opt.button || '계속';
      cinNext = opt.onNext;
    } else {
      btn.classList.add('hidden');
      cinNext = null;
    }
  }
  function cinemaHide() {
    const el = $('#cinema');
    el.classList.remove('on');
    setTimeout(() => el.classList.add('hidden'), 500);
    cinNext = null;
  }

  function hurtFlash(on) { $('#hud').classList.toggle('hurt', !!on); }

  function crosshair(x, y, show) {
    const c = $('#crosshair');
    c.classList.toggle('hidden', !show);
    if (!show) return;
    const cv = $('#screen');
    const r = cv.getBoundingClientRect();
    const st = $('#stage').getBoundingClientRect();
    c.style.left = (r.left - st.left + x / DS.VIEW_W * r.width) + 'px';
    c.style.top = (r.top - st.top + y / DS.VIEW_H * r.height) + 'px';
  }

  function loadingDone() { const l = $('#loading'); if (l) l.classList.add('hidden'); }

  return {
    init, show, hide, updateStats, setObjective, banner, toast, clearToasts,
    prompt, hold, refreshHotbar, refreshEquip,
    openPanel, closePanel, isPanelOpen, refreshPanel, panelKeys,
    showTitle, hideTitle, showPause, showGameOver, hideGameOver, showHowto,
    cinema, cinemaHide, hurtFlash, crosshair, loadingDone,
    get tab() { return panelTab; }
  };
})();
