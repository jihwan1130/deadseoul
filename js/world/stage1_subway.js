/* =============================================================================
   DEAD:SEOUL — world/stage1_subway.js
   STAGE 1 : 서울교통공사 2호선 OOO역 진입 직전 터널 / 5호차 내부

   맵 구조 (56 x 15 타일 = 896 x 240 px = 실제 약 28m x 7.5m)
     y0      터널 벽 (차량 위쪽)
     y1      차체 상부 벽 — 창(W) / 출입문(D) / 광고판(A)
     y2~y3   상부 좌석 (등받이 S / 쿠션 s · 차량 양단은 노약자석 p)
     y4~y8   통로 (5타일) · 출입문 앞 스탠션 폴 P
     y9~y10  하부 좌석
     y11     차체 하부 벽
     y12~y14 선로 자갈 (하부 2번 출입문으로만 진출) ← 스테이지 탈출 경로

     x0 / x55  관통문(T) — 좌: 4호차(감염 유입) / 우: 6호차(화재 발원)
     출입문 승강구 : x 6-9, 19-22, 32-35, 45-48 (상·하 각 4개소)
   ============================================================================= */
'use strict';

DS.Stage1 = (function () {

  const T = DS.TILE;
  const U = DS.U;

  const W = 56, H = 15;
  const DOORS = [[6, 9], [19, 22], [32, 35], [45, 48]];
  const GANGWAY_ROWS = [5, 6, 7];
  const ESCAPE_X = [15, 27];           // 선로 진출 가능 구간
  const AD_COLS = [11, 12, 26, 27, 39, 40, 52, 53];
  const PRIORITY = (x) => (x >= 1 && x <= 5) || (x >= 49 && x <= 54);

  const inDoor = (x) => DOORS.some(d => x >= d[0] && x <= d[1]);
  /** 벽 행에서 실제로 뚫린 문짝 구간 (승강구 양 끝 1타일은 기둥) */
  const inDoorLeaf = (x) => DOORS.some(d => x > d[0] && x < d[1]);
  const inEscape = (x) => x >= ESCAPE_X[0] && x <= ESCAPE_X[1];

  /* 통로에 흩어진 디테일: 부서진 조각 / 물(음료) 자국 */
  const DEBRIS = [[13, 7], [14, 7], [28, 5], [29, 5], [36, 8], [43, 6], [44, 6], [17, 4]];
  const PUDDLE = [[24, 6], [31, 7], [42, 5], [11, 5], [50, 7]];

  /* -------------------------------------------------------------------------
     문자 그리드 생성
     ------------------------------------------------------------------------- */
  function rows() {
    const out = [];

    for (let y = 0; y < H; y++) {
      let s = '';
      for (let x = 0; x < W; x++) {
        s += cellAt(x, y);
      }
      out.push(s);
    }
    return out;
  }

  function cellAt(x, y) {
    // ---- 터널 상단 ----
    if (y === 0) return '=';

    // ---- 차체 상/하부 벽 ----
    if (y === 1 || y === 11) {
      if (x === 0 || x === W - 1) return '#';
      if (inDoorLeaf(x)) return 'D';
      if (inDoor(x)) return '#';            // 승강구 양 끝 기둥 (설비 부착면)
      if (AD_COLS.indexOf(x) >= 0) return 'A';
      return 'W';
    }

    // ---- 선로 (차량 하부 외부) ----
    if (y >= 12) {
      if (!inEscape(x)) return '=';
      if (y === 13 && (x === 17 || x === 25)) return 'o';   // 선로 고인 물
      return 'g';
    }

    // ---- 차량 양단 격벽 / 관통문 ----
    if (x === 0 || x === W - 1) {
      return GANGWAY_ROWS.indexOf(y) >= 0 ? 'T' : '#';
    }

    // ---- 좌석대 ----
    if (y === 2) return inDoor(x) ? ',' : 'S';                       // 상부 등받이
    if (y === 3) return inDoor(x) ? ',' : (PRIORITY(x) ? 'p' : 's'); // 상부 쿠션
    if (y === 9) return inDoor(x) ? ',' : (PRIORITY(x) ? 'p' : 's'); // 하부 쿠션
    if (y === 10) return inDoor(x) ? ',' : 'S';                      // 하부 등받이

    // ---- 통로 (y 4..8) ----
    // 출입문 양 끝단에 스탠션 폴
    if (y === 4 || y === 8) {
      for (const d of DOORS) if (x === d[0] || x === d[1]) return 'P';
    }
    for (const p of DEBRIS) if (p[0] === x && p[1] === y) return 'x';
    for (const p of PUDDLE) if (p[0] === x && p[1] === y) return 'o';
    return '.';
  }

  /* =========================================================================
     조명
     ========================================================================= */
  function lights() {
    const main = [], emer = [];
    for (let x = 3; x < W - 2; x += 5) {
      main.push({ x: x * T + 8, y: 6 * T + 8, r: 74, col: '#d6e4ec', int: 1.0, kind: 'main' });
    }
    for (let x = 4; x < W - 2; x += 8) {
      emer.push({ x: x * T + 8, y: 6 * T + 8, r: 68, col: '#ff6a4e', int: 0.0, kind: 'emer' });
    }
    // 선로 대피로 유도등
    const track = [];
    for (let x = ESCAPE_X[0] + 2; x <= ESCAPE_X[1]; x += 5) {
      track.push({ x: x * T + 8, y: 14 * T + 4, r: 34, col: '#5fa86b', int: 0.0, kind: 'track' });
    }
    return { main, emer, track };
  }

  /* =========================================================================
     프롭 (상호작용 오브젝트)
       mount : 'top'(상부 벽에 부착, y+1에서 조작) | 'bottom'(하부 벽, y-1에서 조작) | 'floor'
       kind  : search / pickup / locker / cock / door / npc / read / exit / decor
     ========================================================================= */
  function props() {
    const P = [];
    const add = (o) => { P.push(o); return o; };

    /* --- 벽 부착 설비 --- */
    add({ id: 'toolbox', kind: 'search', art: 'toolbox', tx: 9, ty: 1, mount: 'top',
          name: '차량 점검함', loot: 'crew', once: true,
          flavor: '차장이 쓰는 점검함. 잠금장치가 이미 부서져 있다.' });

    // 비상용품함은 확률이 아니라 확정 지급 — 공략 가능한 생존선을 보장한다
    add({ id: 'locker_emer', kind: 'locker', art: 'locker', tx: 35, ty: 1, mount: 'top',
          name: '비상용품함', once: true, hold: 1.1,
          gives: [{ id: 'gasmask', n: 1 }, { id: 'bandage', n: 2 }, { id: 'tape', n: 1 }],
          flavor: '「비상용품함 — 방연마스크 / 구급함」 봉인 띠가 아직 붙어 있다.' });

    add({ id: 'ext_box', kind: 'pickup', art: 'ext_box', tx: 6, ty: 11, mount: 'bottom',
          name: '소화기', give: { id: 'extinguisher', n: 1 }, once: true,
          flavor: 'ABC 분말 소화기. 거치대 고정 벨트를 풀어야 한다.', hold: 0.7 });

    add({ id: 'intercom', kind: 'read', art: 'intercom', tx: 48, ty: 1, mount: 'top',
          name: '비상통화장치', dialogue: 'intercom' });

    add({ id: 'cock_d2', kind: 'cock', art: 'cock', tx: 19, ty: 11, mount: 'bottom',
          name: '비상 코크', hold: 2.4, door: 'exit_d2',
          flavor: '「출입문 비상 수동 개방 장치」 커버를 열고 손잡이를 아래로 당긴다.' });

    /* --- 탈출용 하부 2번 출입문 (문짝 2타일) --- */
    add({ id: 'exit_d2', kind: 'door', art: 'none',
          tiles: [[20, 11], [21, 11]],
          tx: 20, ty: 11, mount: 'bottom',
          ixOverride: 21 * T, iyOverride: 10 * T + T / 2,
          name: '하부 2번 출입문', locked: true, hold: 3.4, noise: 160,
          lockedMsg: '전원이 끊겨 꼼짝도 하지 않는다. 비상 코크를 먼저 당겨야 한다.',
          flavor: '코크는 풀렸다. 이제 두 손으로 밀어서 열어야 한다.' });

    /* --- 관통문 --- */
    add({ id: 'gangway_l', kind: 'gangway', art: 'none', side: 'left',
          tiles: [[0, 5], [0, 6], [0, 7]], tx: 0, ty: 6, open: false,
          name: '4호차 관통문' });
    add({ id: 'gangway_r', kind: 'gangway', art: 'none', side: 'right',
          tiles: [[W - 1, 5], [W - 1, 6], [W - 1, 7]], tx: W - 1, ty: 6, open: false,
          name: '6호차 관통문' });

    /* --- 좌석 수색 지점 (좌석 아래 / 틈) --- */
    const seatSpots = [[12, 3], [16, 9], [27, 3], [38, 3], [41, 9], [52, 3], [24, 9], [31, 3], [49, 9], [4, 9]];
    seatSpots.forEach((s, i) => add({
      id: 'seat' + i, kind: 'search', art: 'seatgap', tx: s[0], ty: s[1],
      mount: s[1] === 3 ? 'seatTop' : 'seatBottom',
      name: '좌석 아래', loot: 'seat', once: true, hold: 0.9
    }));

    /* --- 바닥 오브젝트 --- */
    add({ id: 'bag_a', kind: 'search', art: 'bag', tx: 23, ty: 7, mount: 'floor',
          name: '승객 가방', loot: 'bag', once: true, hold: 1.1,
          flavor: '지퍼가 열린 채 굴러다니는 서류 가방.' });
    add({ id: 'bag_b', kind: 'search', art: 'bag2', tx: 43, ty: 5, mount: 'floor',
          name: '쇼핑백', loot: 'bag', once: true, hold: 1.1 });
    add({ id: 'trash_a', kind: 'search', art: 'trash', tx: 30, ty: 7, mount: 'floor',
          name: '바닥에 흩어진 것들', loot: 'trash', once: true, hold: 0.6 });

    // 첫 전투 직후 확실히 붕대 하나를 쥐여 준다 (출혈 대응 학습)
    add({ id: 'body_a', kind: 'search', art: 'corpse', pal: 'pass_m', seed: 1,
          tx: 14, ty: 6, mount: 'floor', name: '쓰러진 승객', loot: 'body',
          give: { id: 'bandage', n: 1 }, once: true, hold: 1.4,
          flavor: '넥타이가 풀린 중년 남자. 목에서 피가 흘러 바닥에 고였다. 숨은 없다.' });
    add({ id: 'body_b', kind: 'search', art: 'corpse', pal: 'pass_f', seed: 2,
          tx: 37, ty: 5, mount: 'floor', name: '쓰러진 승객', loot: 'body', once: true, hold: 1.4,
          flavor: '좌석 사이에 끼어 있다. 한쪽 신발이 저 멀리 떨어져 있다.' });

    /* --- 승무원 메모 --- */
    add({ id: 'note', kind: 'pickup', art: 'note', tx: 53, ty: 6, mount: 'floor',
          name: '승무원 메모', give: { id: 'note_notice', n: 1 }, once: true,
          flavor: '우측 관통문 손잡이에 끼워져 있던 쪽지.', readAfter: 'note_read' });

    /* --- 민서 퀘스트: 백팩 --- */
    add({ id: 'minseo_bag', kind: 'search', art: 'bag_minseo', tx: 10, ty: 9, mount: 'seatBottom',
          name: '회색 백팩', loot: null, give: { id: 'minseo_bag', n: 1 }, once: true, hold: 1.3,
          requireQuest: 'q_bag',
          flavor: '하부 좌석 아래로 깊이 밀려 들어가 있다. 한쪽 끈이 끊어졌다.' });

    /* --- NPC --- */
    add({ id: 'npc_minseo', kind: 'npc', art: 'npc', pal: 'minseo', tx: 50, ty: 6, mount: 'floor',
          name: '민서', dialogue: 'minseo' });

    /* --- 선로 탈출 트리거 --- */
    add({ id: 'escape_zone', kind: 'exit', art: 'none', tx: 21, ty: 14, mount: 'floor',
          zone: { x: 16 * T, y: 13 * T, w: 11 * T, h: 2 * T }, name: '선로 좌측 대피로' });

    // 월드 좌표 계산
    for (const p of P) {
      p.px = p.tx * T + T / 2;
      p.py = p.ty * T + T / 2;
      if (p.mount === 'top') { p.ix = p.px; p.iy = (p.ty + 1) * T + T / 2; }
      else if (p.mount === 'bottom') { p.ix = p.px; p.iy = (p.ty - 1) * T + T / 2; }
      else if (p.mount === 'seatTop') { p.ix = p.px; p.iy = (p.ty + 1) * T + T / 2; }
      else if (p.mount === 'seatBottom') { p.ix = p.px; p.iy = (p.ty - 1) * T + T / 2; }
      else { p.ix = p.px; p.iy = p.py; }
      if (p.ixOverride != null) p.ix = p.ixOverride;
      if (p.iyOverride != null) p.iy = p.iyOverride;
      p.used = false;
      p.radius = p.mount === 'floor' ? 14 : 15;
    }
    return P;
  }

  /* =========================================================================
     프롭 아트
     ========================================================================= */
  const ART = {
    toolbox(c, x, y) {
      c.fillStyle = '#4a5055'; c.fillRect(x - 7, y - 1, 14, 9);
      c.fillStyle = '#5e666c'; c.fillRect(x - 7, y - 1, 14, 3);
      c.fillStyle = '#2f3438'; c.fillRect(x - 7, y + 6, 14, 2);
      c.fillStyle = '#c9a227'; c.fillRect(x - 1, y + 2, 3, 2);
      c.fillStyle = '#20242a'; c.fillRect(x - 7, y + 2, 14, 1);
    },
    locker(c, x, y) {
      c.fillStyle = '#b9342c'; c.fillRect(x - 8, y - 3, 16, 12);
      c.fillStyle = '#d4443a'; c.fillRect(x - 8, y - 3, 16, 3);
      c.fillStyle = '#7d1c17'; c.fillRect(x - 8, y + 7, 16, 2);
      c.fillStyle = '#e8e4da'; c.fillRect(x - 6, y + 1, 12, 4);
      c.fillStyle = '#8e1219'; c.fillRect(x - 5, y + 2, 10, 1);
      c.fillStyle = '#b5181f'; c.fillRect(x - 5, y + 4, 7, 1);
      c.fillStyle = '#3a3f44'; c.fillRect(x + 4, y + 2, 2, 3);
      c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(x - 8, y + 9, 16, 2);
    },
    ext_box(c, x, y) {
      c.fillStyle = '#2b3038'; c.fillRect(x - 6, y - 2, 12, 11);
      c.fillStyle = '#3a4150'; c.fillRect(x - 6, y - 2, 12, 2);
      c.fillStyle = '#8e1219'; c.fillRect(x - 3, y + 1, 6, 7);
      c.fillStyle = '#b5181f'; c.fillRect(x - 3, y + 1, 6, 2);
      c.fillStyle = '#d9dde2'; c.fillRect(x - 2, y + 4, 4, 1);
      c.fillStyle = 'rgba(190,220,235,0.2)'; c.fillRect(x - 5, y, 10, 8);
      c.fillStyle = '#c9a227'; c.fillRect(x - 6, y + 9, 12, 1);
    },
    intercom(c, x, y) {
      c.fillStyle = '#3f464c'; c.fillRect(x - 5, y - 1, 10, 9);
      c.fillStyle = '#52595f'; c.fillRect(x - 5, y - 1, 10, 2);
      c.fillStyle = '#20242a'; c.fillRect(x - 3, y + 1, 6, 3);
      c.fillStyle = '#b5181f'; c.fillRect(x - 2, y + 5, 4, 2);
      c.fillStyle = '#e8e4da'; c.fillRect(x - 5, y + 8, 10, 1);
    },
    cock(c, x, y) {
      c.fillStyle = '#c9a227'; c.fillRect(x - 6, y - 1, 12, 9);
      c.fillStyle = '#e0b93a'; c.fillRect(x - 6, y - 1, 12, 2);
      c.fillStyle = '#7d6414'; c.fillRect(x - 6, y + 6, 12, 2);
      c.fillStyle = '#1a1d21'; c.fillRect(x - 4, y + 2, 8, 3);
      c.fillStyle = '#8e1219'; c.fillRect(x - 1, y + 2, 2, 5);
      c.fillStyle = '#20242a'; c.fillRect(x - 6, y - 1, 1, 9);
    },
    seatgap(c, x, y, p) {
      // 좌석 아래 틈 — 미세한 음영과 반짝임으로 "뭔가 있다"만 암시
      const dy = p.mount === 'seatTop' ? 6 : -6;
      c.fillStyle = 'rgba(0,0,0,0.42)';
      c.fillRect(x - 6, y + dy - 1, 12, 3);
      c.fillStyle = 'rgba(190,200,210,0.12)';
      c.fillRect(x - 4, y + dy, 2, 1);
    },
    bag(c, x, y) {
      c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.ellipse(x, y + 4, 8, 3, 0, 0, 7); c.fill();
      c.fillStyle = '#2e2620'; c.fillRect(x - 7, y - 3, 14, 7);
      c.fillStyle = '#423730'; c.fillRect(x - 7, y - 3, 14, 2);
      c.fillStyle = '#1c1714'; c.fillRect(x - 7, y + 2, 14, 2);
      c.fillStyle = '#6a5a4a'; c.fillRect(x - 2, y - 5, 5, 2);
      c.fillStyle = '#c9a227'; c.fillRect(x + 2, y, 2, 2);
      c.fillStyle = '#d8d4c8'; c.fillRect(x - 6, y + 1, 3, 1);
    },
    bag2(c, x, y) {
      c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(x, y + 4, 7, 3, 0, 0, 7); c.fill();
      c.fillStyle = '#c8bda8'; c.fillRect(x - 6, y - 4, 12, 8);
      c.fillStyle = '#ddd3c0'; c.fillRect(x - 6, y - 4, 12, 2);
      c.fillStyle = '#a2937c'; c.fillRect(x - 6, y + 2, 12, 2);
      c.fillStyle = '#8e1219'; c.fillRect(x - 4, y - 2, 5, 2);
      c.fillStyle = '#5c636a'; c.fillRect(x - 3, y - 6, 2, 2); c.fillRect(x + 1, y - 6, 2, 2);
    },
    bag_minseo(c, x, y, p) {
      const dy = p.mount === 'seatTop' ? 7 : -5;
      c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(x - 7, y + dy - 2, 14, 5);
      c.fillStyle = '#4e565c'; c.fillRect(x - 6, y + dy - 1, 12, 4);
      c.fillStyle = '#5f686f'; c.fillRect(x - 6, y + dy - 1, 12, 1);
      c.fillStyle = '#c75b4a'; c.fillRect(x - 2, y + dy, 3, 1);
      c.fillStyle = '#2b3038'; c.fillRect(x + 4, y + dy - 2, 2, 3);
    },
    trash(c, x, y) {
      c.fillStyle = 'rgba(0,0,0,0.26)'; c.beginPath(); c.ellipse(x, y + 3, 8, 3, 0, 0, 7); c.fill();
      c.fillStyle = '#d8d4c8'; c.fillRect(x - 6, y, 5, 3);
      c.fillStyle = '#9fd2e0'; c.fillRect(x + 1, y - 1, 4, 2);
      c.fillStyle = '#e8d87a'; c.fillRect(x - 2, y + 2, 3, 2);
      c.fillStyle = '#5d646b'; c.fillRect(x + 3, y + 2, 3, 1);
    },
    corpse(c, x, y, p) {
      const s = DS.Gfx.corpse(p.pal || 'pass_m', p.seed || 1);
      c.drawImage(s.canvas, Math.round(x - s.fx), Math.round(y - s.fy));
    },
    note(c, x, y) {
      c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(x - 4, y + 1, 9, 2);
      c.fillStyle = '#e4ddcc'; c.fillRect(x - 4, y - 3, 8, 6);
      c.fillStyle = '#f2ece0'; c.fillRect(x - 4, y - 3, 8, 2);
      c.fillStyle = '#5d646b'; c.fillRect(x - 3, y - 1, 5, 1); c.fillRect(x - 3, y + 1, 4, 1);
    },
    none() {}
  };

  /** 프롭 그리기 (게임 루프에서 y소트 후 호출) */
  function drawProp(c, p, sx, sy, t) {
    const f = ART[p.art] || ART.none;
    f(c, Math.round(sx), Math.round(sy), p, t);
  }

  /* =========================================================================
     배경 데코레이션 — 노선도 / 차량번호 / 비상벨 등을 bg에 직접 베이킹
     ========================================================================= */
  function decorate(map) {
    const c = map.bg.getContext('2d');
    c.imageSmoothingEnabled = false;

    // 출입문 위 노선도 (각 승강구 중앙)
    for (const d of DOORS) {
      const cx = ((d[0] + d[1] + 1) / 2) * T;
      for (const wy of [1, 11]) {
        const y = wy * T + (wy === 1 ? 11 : 1);
        c.fillStyle = '#20242a'; c.fillRect(cx - 14, y, 28, 4);
        c.fillStyle = '#2e3a45'; c.fillRect(cx - 13, y + 1, 26, 2);
        // 2호선 초록 라인 + 역 점
        c.fillStyle = '#3f9a6c'; c.fillRect(cx - 12, y + 2, 24, 1);
        for (let i = 0; i < 7; i++) {
          c.fillStyle = i === 3 ? '#e8e4da' : '#9fb4a8';
          c.fillRect(cx - 11 + i * 4, y + 1, 1, 2);
        }
      }
    }

    // 차량번호 표기 "5-4" (좌측 격벽)
    c.fillStyle = '#20242a'; c.fillRect(1 * T + 2, 2 * T + 2, 13, 6);
    c.fillStyle = '#d8d4c8';
    DS.Gfx.num(c, '5', 1 * T + 6, 2 * T + 5, '#d8d4c8', false);
    c.fillStyle = '#9aa0a6'; c.fillRect(1 * T + 9, 2 * T + 5, 2, 1);
    DS.Gfx.num(c, '4', 1 * T + 13, 2 * T + 5, '#d8d4c8', false);

    // 비상벨 (각 승강구 옆 벽)
    for (const d of DOORS) {
      for (const wy of [1, 11]) {
        const x = d[0] * T - 4, y = wy * T + (wy === 1 ? 4 : 7);
        if (x < T) continue;
        c.fillStyle = '#e8e4da'; c.fillRect(x, y, 4, 4);
        c.fillStyle = '#b5181f'; c.fillRect(x + 1, y + 1, 2, 2);
      }
    }

    // 좌석 위 수하물 선반 그림자 (상부)
    const g = c.createLinearGradient(0, 2 * T, 0, 2 * T + 6);
    g.addColorStop(0, 'rgba(0,0,0,0.3)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(0, 2 * T, map.pxW, 6);

    // 선로 구역: 대피로 난간 + 케이블 트레이
    const ex0 = ESCAPE_X[0] * T, ex1 = (ESCAPE_X[1] + 1) * T;
    c.fillStyle = '#4a5055'; c.fillRect(ex0, 14 * T + 9, ex1 - ex0, 2);
    c.fillStyle = '#6a7278'; c.fillRect(ex0, 14 * T + 9, ex1 - ex0, 1);
    for (let x = ex0 + 4; x < ex1; x += 12) {
      c.fillStyle = '#3a4046'; c.fillRect(x, 14 * T + 10, 2, 5);
    }
    // 선로 레일 2줄
    c.fillStyle = '#7d848a';
    c.fillRect(ex0, 13 * T + 2, ex1 - ex0, 2);
    c.fillRect(ex0, 13 * T + 11, ex1 - ex0, 2);
    c.fillStyle = 'rgba(255,255,255,0.14)';
    c.fillRect(ex0, 13 * T + 2, ex1 - ex0, 1);
    c.fillRect(ex0, 13 * T + 11, ex1 - ex0, 1);

    // 터널 벽 (y0) 케이블
    c.fillStyle = '#16191d'; c.fillRect(0, 0 * T + 10, map.pxW, 2);
    c.fillStyle = '#1e2226'; c.fillRect(0, 0 * T + 13, map.pxW, 1);
  }

  /* =========================================================================
     조립
     ========================================================================= */
  function create() {
    const map = DS.Tiles.build(rows(), 20251014);
    decorate(map);
    DS.Tiles.buildOverhead(map, 4242);

    const L = lights();
    return {
      id: 'stage1_subway',
      title: '2호선 · 5호차',
      subtitle: '터널 내 비상 정차',
      map,
      props: props(),
      lights: L,
      // 좀비 등장 위치 (관통문 안쪽)
      spawns: {
        left:  { x: 1.5 * T, y: 6.5 * T },
        right: { x: (W - 1.6) * T, y: 6.5 * T }
      },
      playerStart: { x: 29.5 * T, y: 6.5 * T },
      ambientDark: 0.12,     // 전원 정상 시 암부 강도
      bounds: { x: 0, y: 0, w: map.pxW, h: map.pxH },
      meta: { W, H, DOORS, ESCAPE_X, GANGWAY_ROWS }
    };
  }

  return { create, ART, drawProp, W, H, DOORS, ESCAPE_X };
})();
