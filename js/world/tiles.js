/* =============================================================================
   DEAD:SEOUL — world/tiles.js
   타일 정의 · 맵 베이킹(배경 1장으로 합성) · 충돌/시야 그리드 · 머리 위 레이어
   맵은 가독성을 위해 문자 그리드로 작성한다.
   ============================================================================= */
'use strict';

DS.Tiles = (function () {

  const T = DS.TILE;
  const U = DS.U;

  /* =========================================================================
     타일 정의
       solid    통과 불가
       opaque   시야 차단 (좀비 LOS / 라이팅)
       surface  발소리
       slow     이동 속도 배율
       low      낮은 장애물 (시야는 통과, 이동은 막음) — 좌석/봉
     ========================================================================= */
  const DEF = {
    '#': { name: 'wall', solid: 1, opaque: 1 },
    'W': { name: 'window', solid: 1, opaque: 1 },
    'A': { name: 'ad', solid: 1, opaque: 1 },
    'D': { name: 'door', solid: 1, opaque: 0, door: 1 },     // 측면 출입문 (prop이 상태 관리)
    'T': { name: 'gangway', solid: 1, opaque: 0, door: 1 },   // 관통문
    'c': { name: 'cab', solid: 1, opaque: 1 },                // 승무원실 격벽
    '.': { name: 'floor', surface: 'vinyl' },
    ',': { name: 'vestibule', surface: 'vinyl' },
    'S': { name: 'seat_back', solid: 1, low: 1 },
    's': { name: 'seat', solid: 1, low: 1 },
    'p': { name: 'seat_priority', solid: 1, low: 1 },
    'P': { name: 'pole', solid: 1, low: 1 },
    'g': { name: 'gravel', surface: 'gravel' },
    'o': { name: 'puddle', surface: 'water' },
    'x': { name: 'debris', surface: 'metal', slow: 0.62 },
    '=': { name: 'void', solid: 1, opaque: 1 },
    ' ': { name: 'empty', solid: 1, opaque: 1 }
  };

  /* =========================================================================
     색 팔레트 — 서울 전동차 내장 기준(저조도 보정)
     ========================================================================= */
  const C = {
    floor:      '#6e7570',
    floorDark:  '#5c635f',
    floorSeam:  '#4e5450',
    safety:     '#b79326',
    wall:       '#b9b5a8',
    wallShade:  '#8e8b80',
    wallTrim:   '#6a685f',
    glass:      '#1a1f26',
    glassLit:   '#2c3540',
    seat:       '#3c5a6b',
    seatTop:    '#4d7285',
    seatDark:   '#2b414e',
    seatPri:    '#6b4a63',
    seatPriTop: '#86607c',
    steel:      '#9aa4aa',
    steelDark:  '#6a7278',
    gravel:     '#2e3135',
    gravelHi:   '#43474c',
    rail:       '#7d848a',
    adA:        '#6e4a4f',
    adB:        '#45586b',
    cab:        '#8d9aa2'
  };

  /* =========================================================================
     타일 렌더러
     ========================================================================= */
  function floorBase(c, x, y, r) {
    c.fillStyle = C.floor; c.fillRect(x, y, T, T);
    // 비닐 바닥 스페클
    for (let i = 0; i < 9; i++) {
      const a = r();
      c.fillStyle = a > 0.6 ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.07)';
      c.fillRect(x + ((r() * T) | 0), y + ((r() * T) | 0), 1, 1);
    }
  }

  const DRAW = {
    floor(c, x, y, r, m, tx, ty) {
      floorBase(c, x, y, r);
      // 2타일 간격 패널 심
      if (tx % 2 === 0) { c.fillStyle = C.floorSeam; c.fillRect(x, y, 1, T); }
      if (ty % 3 === 0) { c.fillStyle = 'rgba(0,0,0,0.08)'; c.fillRect(x, y, T, 1); }
    },

    vestibule(c, x, y, r, m, tx, ty) {
      floorBase(c, x, y, r);
      c.fillStyle = C.floorDark; c.fillRect(x, y, T, T);
      for (let i = 0; i < 7; i++) { c.fillStyle = 'rgba(0,0,0,0.08)'; c.fillRect(x + ((r() * T) | 0), y + ((r() * T) | 0), 1, 1); }
      // 출입문 쪽 황색 안전선 + 점자블록
      const up = m.at(tx, ty - 1), dn = m.at(tx, ty + 1);
      if (up === 'D' || up === '#' || up === 'W') {
        c.fillStyle = C.safety; c.fillRect(x, y + 1, T, 2);
        c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x, y + 3, T, 1);
        for (let i = 0; i < 4; i++) { c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(x + 1 + i * 4, y + 1, 1, 2); }
      }
      if (dn === 'D' || dn === '#' || dn === 'W') {
        c.fillStyle = C.safety; c.fillRect(x, y + T - 3, T, 2);
        c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x, y + T - 4, T, 1);
        for (let i = 0; i < 4; i++) { c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(x + 1 + i * 4, y + T - 3, 1, 2); }
      }
    },

    wall(c, x, y, r, m, tx, ty) {
      c.fillStyle = C.wall; c.fillRect(x, y, T, T);
      c.fillStyle = C.wallShade; c.fillRect(x, y + T - 4, T, 4);
      c.fillStyle = C.wallTrim; c.fillRect(x, y + T - 2, T, 2);
      // 패널 분할선
      if (tx % 3 === 0) { c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(x, y, 1, T); }
      for (let i = 0; i < 5; i++) { c.fillStyle = 'rgba(0,0,0,0.05)'; c.fillRect(x + ((r() * T) | 0), y + ((r() * T) | 0), 1, 1); }
    },

    window(c, x, y, r, m, tx, ty) {
      DRAW.wall(c, x, y, r, m, tx, ty);
      // 창틀 + 유리
      const top = m.at(tx, ty + 1) !== '#' && m.at(tx, ty + 1) !== 'W';
      c.fillStyle = C.steelDark; c.fillRect(x, y + 2, T, 9);
      c.fillStyle = C.glass; c.fillRect(x, y + 3, T, 7);
      // 유리 반사 (터널 암흑 + 실내 반사광)
      c.fillStyle = C.glassLit; c.fillRect(x, y + 3, T, 2);
      c.fillStyle = 'rgba(255,255,255,0.07)'; c.fillRect(x + 2, y + 4, T - 5, 1);
      if (r() > 0.75) { c.fillStyle = 'rgba(255,255,255,0.1)'; c.fillRect(x + ((r() * (T - 3)) | 0), y + 5, 2, 1); }
      c.fillStyle = C.steel; c.fillRect(x, y + 10, T, 1);
      if (tx % 4 === 0) { c.fillStyle = C.steelDark; c.fillRect(x, y + 2, 1, 9); }
      if (top) { c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(x, y + T - 2, T, 2); }
    },

    ad(c, x, y, r, m, tx, ty) {
      DRAW.wall(c, x, y, r, m, tx, ty);
      const kind = (tx * 7) % 3;
      c.fillStyle = kind === 0 ? C.adA : (kind === 1 ? C.adB : '#4a5b4d');
      c.fillRect(x, y + 2, T, 8);
      c.fillStyle = 'rgba(255,255,255,0.14)'; c.fillRect(x, y + 2, T, 1);
      // 글자처럼 보이는 라인
      c.fillStyle = 'rgba(255,255,255,0.3)'; c.fillRect(x + 2, y + 4, T - 6, 1);
      c.fillStyle = 'rgba(255,255,255,0.16)'; c.fillRect(x + 2, y + 6, T - 9, 1);
      c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(x, y + 9, T, 1);
    },

    door(c, x, y, r, m, tx, ty) {
      // 닫힌 측면 출입문 (상하 벽에 위치)
      c.fillStyle = C.wallShade; c.fillRect(x, y, T, T);
      c.fillStyle = C.steelDark; c.fillRect(x, y + 1, T, T - 3);
      c.fillStyle = C.glass; c.fillRect(x + 1, y + 3, T - 2, 7);
      c.fillStyle = C.glassLit; c.fillRect(x + 1, y + 3, T - 2, 2);
      c.fillStyle = 'rgba(255,255,255,0.06)'; c.fillRect(x + 2, y + 4, T - 5, 1);
      // 문 중앙 합선부
      const left = m.at(tx - 1, ty), right = m.at(tx + 1, ty);
      if (left === 'D' && right !== 'D') { c.fillStyle = '#1a1d21'; c.fillRect(x + T - 1, y + 1, 1, T - 3); }
      c.fillStyle = C.steel; c.fillRect(x, y + T - 3, T, 1);
      c.fillStyle = C.wallTrim; c.fillRect(x, y + T - 2, T, 2);
      // 노란 경고 스티커
      if (r() > 0.6) { c.fillStyle = C.safety; c.fillRect(x + 4, y + 5, 3, 2); }
    },

    gangway(c, x, y, r, m, tx, ty) {
      c.fillStyle = C.steelDark; c.fillRect(x, y, T, T);
      c.fillStyle = '#5c636a'; c.fillRect(x + 1, y, T - 2, T);
      c.fillStyle = C.glass; c.fillRect(x + 3, y + 2, T - 6, T - 4);
      c.fillStyle = C.glassLit; c.fillRect(x + 3, y + 2, T - 6, 2);
      c.fillStyle = C.steel; c.fillRect(x + 2, y + T - 6, 2, 3);  // 손잡이
      for (let i = 0; i < 5; i++) { c.fillStyle = 'rgba(0,0,0,0.1)'; c.fillRect(x + ((r() * T) | 0), y + ((r() * T) | 0), 1, 1); }
    },

    cab(c, x, y, r, m, tx, ty) {
      c.fillStyle = C.cab; c.fillRect(x, y, T, T);
      c.fillStyle = U.shade(C.cab, -22); c.fillRect(x, y + T - 5, T, 5);
      c.fillStyle = C.wallTrim; c.fillRect(x, y + T - 2, T, 2);
      if (tx % 2 === 0) { c.fillStyle = 'rgba(0,0,0,0.1)'; c.fillRect(x, y, 1, T); }
    },

    seat_back(c, x, y, r, m, tx, ty) {
      const up = m.at(tx, ty - 1), dn = m.at(tx, ty + 1);
      const facingDown = (up === '#' || up === 'W' || up === 'A' || up === 'c'); // 위쪽 벽에 붙은 좌석
      c.fillStyle = C.seatDark; c.fillRect(x, y, T, T);
      c.fillStyle = C.seat; c.fillRect(x, facingDown ? y + 2 : y, T, T - 2);
      c.fillStyle = C.seatTop; c.fillRect(x, facingDown ? y + 2 : y + T - 4, T, 2);
      // 패브릭 패턴
      for (let i = 0; i < 10; i++) {
        c.fillStyle = r() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.09)';
        c.fillRect(x + ((r() * T) | 0), y + ((r() * T) | 0), 1, 1);
      }
      // 좌석 구획 분리 (3타일마다 스테인리스 구분봉)
      if (tx % 3 === 0) { c.fillStyle = C.steelDark; c.fillRect(x, y, 1, T); c.fillStyle = C.steel; c.fillRect(x + 1, y, 1, T); }
      if (dn === 's' || dn === 'p' || up === 's' || up === 'p') { /* 쿠션과 연결 */ }
    },

    seat(c, x, y, r, m, tx, ty) {
      const up = m.at(tx, ty - 1);
      const facingDown = (up === 'S');
      c.fillStyle = C.seat; c.fillRect(x, y, T, T);
      c.fillStyle = C.seatTop; c.fillRect(x, facingDown ? y : y + T - 5, T, 5);
      c.fillStyle = C.seatDark; c.fillRect(x, facingDown ? y + T - 3 : y, T, 3);
      for (let i = 0; i < 12; i++) {
        c.fillStyle = r() > 0.5 ? 'rgba(255,255,255,0.055)' : 'rgba(0,0,0,0.1)';
        c.fillRect(x + ((r() * T) | 0), y + ((r() * T) | 0), 1, 1);
      }
      // 1인 좌석 경계선
      if (tx % 2 === 0) { c.fillStyle = 'rgba(0,0,0,0.16)'; c.fillRect(x, y + 2, 1, T - 4); }
      if (tx % 3 === 0) { c.fillStyle = C.steel; c.fillRect(x, y, 1, T); }
    },

    seat_priority(c, x, y, r, m, tx, ty) {
      const up = m.at(tx, ty - 1);
      const facingDown = (up === 'S' || up === '#' || up === 'W');
      c.fillStyle = C.seatPri; c.fillRect(x, y, T, T);
      c.fillStyle = C.seatPriTop; c.fillRect(x, facingDown ? y : y + T - 5, T, 5);
      c.fillStyle = U.shade(C.seatPri, -22); c.fillRect(x, facingDown ? y + T - 3 : y, T, 3);
      for (let i = 0; i < 10; i++) {
        c.fillStyle = r() > 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.1)';
        c.fillRect(x + ((r() * T) | 0), y + ((r() * T) | 0), 1, 1);
      }
      if (tx % 3 === 0) { c.fillStyle = C.steel; c.fillRect(x, y, 1, T); }
    },

    pole(c, x, y, r, m, tx, ty) {
      // 바닥 먼저
      DRAW.floor(c, x, y, r, m, tx, ty);
      // 스테인리스 스탠션 폴 (수직봉)
      c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(x + 6, y + T - 3, 6, 3);
      c.fillStyle = C.steelDark; c.fillRect(x + 6, y, 4, T);
      c.fillStyle = C.steel; c.fillRect(x + 7, y, 2, T);
      c.fillStyle = '#d2dade'; c.fillRect(x + 7, y, 1, T);
      c.fillStyle = C.steelDark; c.fillRect(x + 5, y + T - 4, 6, 2);
    },

    gravel(c, x, y, r, m, tx, ty) {
      c.fillStyle = C.gravel; c.fillRect(x, y, T, T);
      for (let i = 0; i < 26; i++) {
        const v = r();
        c.fillStyle = v > 0.82 ? C.gravelHi : (v > 0.5 ? U.shade(C.gravel, 9) : U.shade(C.gravel, -7));
        c.fillRect(x + ((r() * T) | 0), y + ((r() * T) | 0), 1 + ((r() * 1.6) | 0), 1);
      }
      // 침목 + 레일 (3타일 주기)
      if (ty % 3 === 1) { c.fillStyle = '#3a2f24'; c.fillRect(x, y + 4, T, 5); c.fillStyle = '#2b2219'; c.fillRect(x, y + 8, T, 1); }
    },

    puddle(c, x, y, r, m, tx, ty) {
      DRAW.floor(c, x, y, r, m, tx, ty);
      c.fillStyle = 'rgba(20,30,38,0.55)';
      c.beginPath(); c.ellipse(x + T / 2, y + T / 2, 7, 5, 0, 0, 7); c.fill();
      c.fillStyle = 'rgba(150,180,195,0.14)';
      c.beginPath(); c.ellipse(x + T / 2 - 2, y + T / 2 - 1, 3, 1.4, 0, 0, 7); c.fill();
    },

    debris(c, x, y, r, m, tx, ty) {
      DRAW.floor(c, x, y, r, m, tx, ty);
      for (let i = 0; i < 6; i++) {
        const v = r();
        c.fillStyle = v > 0.7 ? '#8e8b80' : (v > 0.4 ? '#5c636a' : '#3a4046');
        c.fillRect(x + ((r() * (T - 3)) | 0), y + ((r() * (T - 3)) | 0), 2 + ((r() * 2) | 0), 1 + ((r() * 2) | 0));
      }
      c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(x + 2, y + T - 3, T - 5, 2);
    },

    void(c, x, y) {
      c.fillStyle = '#0a0b0d'; c.fillRect(x, y, T, T);
    },
    empty(c, x, y) {
      c.fillStyle = '#07080a'; c.fillRect(x, y, T, T);
    }
  };

  /* =========================================================================
     맵 빌드
     ========================================================================= */
  function build(rows, seed) {
    const h = rows.length;
    let w = 0;
    for (const r of rows) w = Math.max(w, r.length);
    // 패딩
    const grid = rows.map(r => r.padEnd(w, ' ').split(''));

    const map = {
      w, h,
      pxW: w * T, pxH: h * T,
      grid,
      at(x, y) {
        if (x < 0 || y < 0 || x >= w || y >= h) return ' ';
        return grid[y][x];
      },
      def(x, y) { return DEF[this.at(x, y)] || DEF[' ']; }
    };

    // 충돌/시야/표면 그리드
    const solid = new Uint8Array(w * h);
    const opaque = new Uint8Array(w * h);
    const low = new Uint8Array(w * h);
    const slow = new Float32Array(w * h);
    const surf = new Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const d = map.def(x, y), i = y * w + x;
      solid[i] = d.solid ? 1 : 0;
      opaque[i] = d.opaque ? 1 : 0;
      low[i] = d.low ? 1 : 0;
      slow[i] = d.slow || 1;
      surf[i] = d.surface || 'vinyl';
    }
    map.solid = solid; map.opaque = opaque; map.low = low; map.slowGrid = slow; map.surf = surf;
    map.idx = (x, y) => y * w + x;

    map.isSolid = function (tx, ty) {
      if (tx < 0 || ty < 0 || tx >= w || ty >= h) return true;
      return solid[ty * w + tx] === 1;
    };
    map.isOpaque = function (tx, ty) {
      if (tx < 0 || ty < 0 || tx >= w || ty >= h) return true;
      return opaque[ty * w + tx] === 1;
    };
    map.surfaceAt = function (px, py) {
      const tx = (px / T) | 0, ty = (py / T) | 0;
      if (tx < 0 || ty < 0 || tx >= w || ty >= h) return 'vinyl';
      return surf[ty * w + tx];
    };
    map.speedAt = function (px, py) {
      const tx = (px / T) | 0, ty = (py / T) | 0;
      if (tx < 0 || ty < 0 || tx >= w || ty >= h) return 1;
      return slow[ty * w + tx];
    };
    /** 월드 좌표 기준 통과 가능 여부 (프롭 오버라이드 포함) */
    map.blocked = function (px, py) {
      const tx = Math.floor(px / T), ty = Math.floor(py / T);
      if (map.isSolid(tx, ty)) {
        // 열린 문이면 통과
        if (map.openTiles && map.openTiles.has(ty * w + tx)) return false;
        return true;
      }
      return false;
    };
    map.openTiles = new Set();
    map.openTile = function (tx, ty) {
      map.openTiles.add(ty * w + tx);
      opaque[ty * w + tx] = 0;
    };
    map.closeTile = function (tx, ty) { map.openTiles.delete(ty * w + tx); };

    /** 시야 레이캐스트 (저해상도 DDA) */
    map.hasLOS = function (x0, y0, x1, y1) {
      let tx = Math.floor(x0 / T), ty = Math.floor(y0 / T);
      const ex = Math.floor(x1 / T), ey = Math.floor(y1 / T);
      const dx = Math.abs(ex - tx), dy = Math.abs(ey - ty);
      const sx = tx < ex ? 1 : -1, sy = ty < ey ? 1 : -1;
      let err = dx - dy, guard = 0;
      while (guard++ < 200) {
        if (tx === ex && ty === ey) return true;
        if (!(tx === Math.floor(x0 / T) && ty === Math.floor(y0 / T))) {
          if (map.isOpaque(tx, ty) && !map.openTiles.has(ty * w + tx)) return false;
        }
        const e2 = err * 2;
        if (e2 > -dy) { err -= dy; tx += sx; }
        if (e2 < dx) { err += dx; ty += sy; }
      }
      return false;
    };

    bake(map, seed || 1337);
    return map;
  }

  /* =========================================================================
     배경 베이킹
     ========================================================================= */
  function bake(map, seed) {
    const bg = U.makeCanvas(map.pxW, map.pxH);
    const c = bg.ctx;

    for (let y = 0; y < map.h; y++) {
      for (let x = 0; x < map.w; x++) {
        const ch = map.at(x, y);
        const d = DEF[ch] || DEF[' '];
        const fn = DRAW[d.name] || DRAW.empty;
        const r = U.rng(seed + x * 73856093 + y * 19349663);
        fn(c, x * T, y * T, r, map, x, y);
      }
    }

    // --- 앰비언트 오클루전: 솔리드 타일 주변 바닥을 어둡게 ---
    for (let y = 0; y < map.h; y++) {
      for (let x = 0; x < map.w; x++) {
        if (map.isSolid(x, y)) continue;
        const px = x * T, py = y * T;
        const addShade = (gx, gy, gw, gh, dir) => {
          const g = dir === 'v'
            ? c.createLinearGradient(gx, gy, gx, gy + gh)
            : c.createLinearGradient(gx, gy, gx + gw, gy);
          g.addColorStop(0, 'rgba(0,0,0,0.3)');
          g.addColorStop(1, 'rgba(0,0,0,0)');
          c.fillStyle = g; c.fillRect(gx, gy, gw, gh);
        };
        if (map.isSolid(x, y - 1)) addShade(px, py, T, 5, 'v');
        if (map.isSolid(x, y + 1)) {
          const g = c.createLinearGradient(px, py + T, px, py + T - 5);
          g.addColorStop(0, 'rgba(0,0,0,0.3)'); g.addColorStop(1, 'rgba(0,0,0,0)');
          c.fillStyle = g; c.fillRect(px, py + T - 5, T, 5);
        }
        if (map.isSolid(x - 1, y)) addShade(px, py, 4, T, 'h');
        if (map.isSolid(x + 1, y)) {
          const g = c.createLinearGradient(px + T, py, px + T - 4, py);
          g.addColorStop(0, 'rgba(0,0,0,0.28)'); g.addColorStop(1, 'rgba(0,0,0,0)');
          c.fillStyle = g; c.fillRect(px + T - 4, py, 4, T);
        }
      }
    }

    map.bg = bg.canvas;
    // 혈흔/흔적용 데칼 레이어 (런타임 누적)
    const dec = U.makeCanvas(map.pxW, map.pxH);
    map.decal = dec.canvas;
    map.decalCtx = dec.ctx;
  }

  /* =========================================================================
     머리 위 레이어 (손잡이 / 천장 조명 하우징) — 엔티티보다 위에 그림
     ========================================================================= */
  function buildOverhead(map, seed) {
    const straps = [];
    const r = U.rng(seed || 909);
    for (let y = 0; y < map.h; y++) {
      for (let x = 0; x < map.w; x++) {
        const ch = map.at(x, y);
        if (ch !== '.' && ch !== ',') continue;
        // 좌석 바로 앞 통로 라인에 손잡이
        const up = map.at(x, y - 1), dn = map.at(x, y + 1);
        const nearTopSeat = (up === 's' || up === 'p');
        const nearBotSeat = (dn === 's' || dn === 'p');
        if ((nearTopSeat || nearBotSeat) && x % 2 === 0) {
          straps.push({
            x: x * T + 8,
            y: y * T + (nearTopSeat ? 3 : T - 3),
            ph: r() * 6.28,
            sp: 0.5 + r() * 0.5
          });
        }
      }
    }
    map.straps = straps;
  }

  function drawOverhead(c, map, camX, camY, t, shake) {
    if (!map.straps) return;
    c.save();
    for (const s of map.straps) {
      const sx = s.x - camX, sy = s.y - camY;
      if (sx < -8 || sx > DS.VIEW_W + 8 || sy < -8 || sy > DS.VIEW_H + 8) continue;
      const sway = Math.sin(t * s.sp + s.ph) * (0.6 + shake * 3);
      const x = Math.round(sx + sway), y = Math.round(sy);
      // 가죽 스트랩
      c.fillStyle = 'rgba(18,20,24,0.78)';
      c.fillRect(x, y - 1, 1, 5);
      // 삼각 손잡이
      c.fillStyle = 'rgba(190,196,202,0.5)';
      c.fillRect(x - 2, y + 4, 5, 1);
      c.fillRect(x - 2, y + 4, 1, 3);
      c.fillRect(x + 2, y + 4, 1, 3);
      c.fillStyle = 'rgba(230,236,240,0.32)';
      c.fillRect(x - 2, y + 6, 5, 1);
    }
    c.restore();
  }

  return { DEF, DRAW, C, build, buildOverhead, drawOverhead };
})();
