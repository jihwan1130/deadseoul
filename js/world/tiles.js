/* =============================================================================
   DEAD:SEOUL — world/tiles.js   [DOT PASS v0.2]
   타일 정의 · 맵 베이킹(배경 1장으로 합성) · 충돌/시야 그리드 · 머리 위 레이어
   맵은 가독성을 위해 문자 그리드로 작성한다.

   ── 아트 방향 ───────────────────────────────────────────────────────────────
   · 디더링     부드러운 그라데이션을 전부 4x4 Bayer 디더로 바꿨다. 조명이
                곱연산으로 깔리는 저조도 화면에서 띠(banding)가 아니라
                "도트"로 보이게 하는 것이 목적이다.
   · 1px 베벨   모든 면은 윗변 하이라이트 + 밑변 섀도 1px 로만 입체를 만든다.
   · 리벳/볼트  벽·문·관통문에 2px 리벳을 규칙적으로 박아 금속 질감을 준다.
   · 저채도     환경은 회청색으로 눌러 두고, 채도는 캐릭터와 경고색(황/적)에만
                쓴다. (gfx.js 캐릭터 아트 패스와 같은 원칙)
   · 결정적     모든 디테일은 시드 기반 난수 — 리로드해도 같은 맵이 나온다.
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
     색 팔레트 — 서울 전동차 내장 기준 / 저채도 회청색으로 눌러 둠
     ========================================================================= */
  const C = {
    floor:      '#6a716c',
    floorHi:    '#767d78',
    floorDark:  '#5a615d',
    floorSeam:  '#474d49',
    grime:      '#3f4441',
    safety:     '#b79326',
    safetyDark: '#7e6417',
    wall:       '#b4b1a5',
    wallHi:     '#c6c3b7',
    wallShade:  '#8b887e',
    wallTrim:   '#64625a',
    rivet:      '#6e6c64',
    glass:      '#141820',
    glassLit:   '#283140',
    glassEdge:  '#394657',
    seat:       '#3b5868',
    seatTop:    '#4c7082',
    seatDark:   '#294050',
    seatSeam:   '#1f3341',
    seatPri:    '#684760',
    seatPriTop: '#845e79',
    steel:      '#99a3a9',
    steelHi:    '#c8d2d7',
    steelDark:  '#656d73',
    steelDeep:  '#454c51',
    gravel:     '#2d3034',
    gravelHi:   '#474b50',
    gravelLo:   '#1f2225',
    sleeper:    '#372c21',
    sleeperLo:  '#261e16',
    rail:       '#7d848a',
    adA:        '#6b4a4f',
    adB:        '#41536b',
    adC:        '#45583f',
    cab:        '#8a9299',
    tunnel:     '#0a0b0e',
    tunnelHi:   '#13161a'
  };

  /* =========================================================================
     도트 유틸 — 4x4 Bayer 디더
       절대 좌표를 기준으로 패턴을 찍으므로 타일 경계에서 무늬가 끊기지 않는다.
     ========================================================================= */
  const BAYER = [
     0,  8,  2, 10,
    12,  4, 14,  6,
     3, 11,  1,  9,
    15,  7, 13,  5
  ];

  /** 사각 영역을 일정 농도(level 0~1)로 디더 채움 */
  function dither(c, x, y, w, h, col, level) {
    const n = level * 16;
    if (n <= 0) return;
    c.fillStyle = col;
    for (let j = 0; j < h; j++) {
      const py = y + j;
      for (let i = 0; i < w; i++) {
        const px = x + i;
        if (BAYER[(py & 3) * 4 + (px & 3)] < n) c.fillRect(px, py, 1, 1);
      }
    }
  }

  /** 한쪽 변에서 멀어질수록 옅어지는 디더 그라데이션 (AO용)
      변에 붙은 줄은 거의 꽉 차고 2~3px 안에서 끊어진다. 넓게 퍼뜨리면
      50% 디더가 넓은 면적을 덮어 "체커무늬"로 읽히기 때문이다. */
  function ditherFade(c, x, y, w, h, col, level, dir) {
    c.fillStyle = col;
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        let t;                                   // 0 = 변에 붙음
        if (dir === 'down') t = j / h;
        else if (dir === 'up') t = 1 - (j + 1) / h;
        else if (dir === 'right') t = i / w;
        else t = 1 - (i + 1) / w;
        const k = 1 - t;
        const lv = level * k * k * k;            // 세제곱 감쇠
        const px = x + i, py = y + j;
        if (BAYER[(py & 3) * 4 + (px & 3)] < lv * 16) c.fillRect(px, py, 1, 1);
      }
    }
  }

  /** 좌표 해시 난수 0~1 — 얼룩/자갈처럼 "불규칙해야 하는" 것에 쓴다.
      Bayer는 규칙적이라 낮은 농도에서 ✕자 무늬가 눈에 띈다. */
  function hash2(x, y) {
    // 부호 있는 시프트(>>)를 섞으면 분포가 한쪽으로 쏠린다 — 전부 >>> 로.
    let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1);
    h ^= h >>> 15; h = Math.imul(h, 0x2545f491);
    h ^= h >>> 13; h = Math.imul(h, 0x27d4eb2d);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  /** 난수 디더 채움 — 유기적인 얼룩용 */
  function noiseFill(c, x, y, w, h, col, level) {
    c.fillStyle = col;
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        if (hash2(x + i, y + j) < level) c.fillRect(x + i, y + j, 1, 1);
      }
    }
  }

  /** 타원형으로 번지는 덩어리 (웅덩이/얼룩) — 곡선을 도트로 표현.
      가운데는 꽉 차고 가장자리만 난수로 풀린다. */
  function ditherBlob(c, cx, cy, rx, ry, col, level) {
    c.fillStyle = col;
    for (let j = -ry; j <= ry; j++) {
      for (let i = -rx; i <= rx; i++) {
        const d = (i / rx) * (i / rx) + (j / ry) * (j / ry);
        if (d > 1) continue;
        const lv = level * (1 - d * d);          // 가장자리만 성글게
        const px = cx + i, py = cy + j;
        if (hash2(px, py) < lv) c.fillRect(px, py, 1, 1);
      }
    }
  }

  /** 1px 베벨 박스 — 도트 UI/프롭 공통 */
  function bevel(c, x, y, w, h, face, hi, lo) {
    c.fillStyle = face; c.fillRect(x, y, w, h);
    c.fillStyle = hi; c.fillRect(x, y, w, 1); c.fillRect(x, y, 1, h);
    c.fillStyle = lo; c.fillRect(x, y + h - 1, w, 1); c.fillRect(x + w - 1, y, 1, h);
  }

  /* =========================================================================
     타일 렌더러
     ========================================================================= */
  function floorBase(c, x, y, r, tx, ty) {
    c.fillStyle = C.floor; c.fillRect(x, y, T, T);

    // 비닐 바닥 — 밝은 반점과 그을음을 디더로 흩뿌린다
    for (let i = 0; i < 7; i++) {
      const px = x + ((r() * T) | 0), py = y + ((r() * T) | 0);
      c.fillStyle = r() > 0.55 ? C.floorHi : C.floorDark;
      c.fillRect(px, py, 1, 1);
    }
    // 묵은 때 — 타일마다 한 군데씩 뭉친 자리
    if (r() > 0.55) {
      const cx = x + 4 + ((r() * (T - 8)) | 0), cy = y + 4 + ((r() * (T - 8)) | 0);
      ditherBlob(c, cx, cy, 3 + ((r() * 2) | 0), 2 + ((r() * 2) | 0), C.grime, 0.45);
    }
  }

  const DRAW = {
    floor(c, x, y, r, m, tx, ty) {
      floorBase(c, x, y, r, tx, ty);
      // 2타일 주기 패널 심 — 음영 1px + 하이라이트 1px
      if (tx % 2 === 0) {
        c.fillStyle = C.floorSeam; c.fillRect(x, y, 1, T);
        c.fillStyle = C.floorHi; c.fillRect(x + 1, y, 1, T);
      }
      if (ty % 3 === 0) { c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(x, y, T, 1); }
      // 통로 한가운데(승객 동선)는 닳아 밝다 — 아주 옅게
      if (ty === 6) noiseFill(c, x, y + 3, T, T - 6, C.floorHi, 0.1);
    },

    vestibule(c, x, y, r, m, tx, ty) {
      // 승강구 바닥은 한 톤 어두운 단색 — 디더로 흩지 않는다
      c.fillStyle = C.floorDark; c.fillRect(x, y, T, T);
      for (let i = 0; i < 6; i++) {
        c.fillStyle = r() > 0.5 ? C.floor : C.floorSeam;
        c.fillRect(x + ((r() * T) | 0), y + ((r() * T) | 0), 1, 1);
      }

      // 출입문 쪽 황색 안전선 + 점자블록 (2px 돌기 격자)
      const up = m.at(tx, ty - 1), dn = m.at(tx, ty + 1);
      const strip = (yy, flip) => {
        c.fillStyle = C.safetyDark; c.fillRect(x, yy, T, 3);
        c.fillStyle = C.safety; c.fillRect(x, yy + (flip ? 1 : 0), T, 2);
        // 점자 돌기
        for (let i = 0; i < 4; i++) {
          c.fillStyle = C.safetyDark;
          c.fillRect(x + 1 + i * 4, yy + 1, 2, 1);
        }
        noiseFill(c, x, yy, T, 3, '#000000', 0.12);
      };
      if (up === 'D' || up === '#' || up === 'W') strip(y + 1, true);
      if (dn === 'D' || dn === '#' || dn === 'W') strip(y + T - 4, false);
    },

    wall(c, x, y, r, m, tx, ty) {
      // 상부 밝은 패널 → 하부 걸레받이. 전부 하드 스텝.
      c.fillStyle = C.wall; c.fillRect(x, y, T, T);
      c.fillStyle = C.wallHi; c.fillRect(x, y, T, 1);
      ditherFade(c, x, y + 1, T, 3, C.wallHi, 0.8, 'down');
      c.fillStyle = C.wallShade; c.fillRect(x, y + T - 5, T, 5);
      ditherFade(c, x, y + T - 7, T, 2, C.wallShade, 0.8, 'up');
      c.fillStyle = C.wallTrim; c.fillRect(x, y + T - 2, T, 2);
      c.fillStyle = '#4e4c46'; c.fillRect(x, y + T - 1, T, 1);

      // 3타일 주기 패널 분할 — 음영 + 하이라이트 쌍
      if (tx % 3 === 0) {
        c.fillStyle = '#8f8c82'; c.fillRect(x, y, 1, T - 2);
        c.fillStyle = C.wallHi; c.fillRect(x + 1, y, 1, T - 2);
        // 리벳 2개
        c.fillStyle = C.rivet; c.fillRect(x, y + 3, 2, 2); c.fillRect(x, y + 9, 2, 2);
        c.fillStyle = C.wallHi; c.fillRect(x, y + 3, 1, 1); c.fillRect(x, y + 9, 1, 1);
      }
      // 미세한 얼룩
      for (let i = 0; i < 4; i++) {
        c.fillStyle = r() > 0.5 ? '#a6a398' : '#bdbab0';
        c.fillRect(x + ((r() * T) | 0), y + 2 + ((r() * (T - 6)) | 0), 1, 1);
      }
    },

    window(c, x, y, r, m, tx, ty) {
      DRAW.wall(c, x, y, r, m, tx, ty);

      // 창틀 — 바깥 2px 금속, 안쪽 유리
      c.fillStyle = C.steelDeep; c.fillRect(x, y + 1, T, 11);
      c.fillStyle = C.steelDark; c.fillRect(x, y + 1, T, 1);
      c.fillStyle = C.glass; c.fillRect(x, y + 3, T, 7);

      // 유리 안쪽: 터널 암흑 + 실내 반사. 위는 밝고 아래로 디더 감쇠.
      c.fillStyle = C.glassLit; c.fillRect(x, y + 3, T, 1);
      ditherFade(c, x, y + 4, T, 3, C.glassLit, 0.85, 'down');
      ditherFade(c, x, y + 6, T, 2, C.glassEdge, 0.5, 'down');
      // 사선 하이라이트 (반사광) — 2타일 주기로 끊기게
      if ((tx & 1) === 0) {
        c.fillStyle = 'rgba(214,228,236,0.16)';
        c.fillRect(x + 3, y + 4, 6, 1);
        c.fillRect(x + 2, y + 5, 3, 1);
      }
      if (r() > 0.8) { c.fillStyle = 'rgba(214,228,236,0.22)'; c.fillRect(x + ((r() * (T - 3)) | 0), y + 6, 2, 1); }

      // 아래 고무 가스켓 + 금속 레일
      c.fillStyle = '#20242a'; c.fillRect(x, y + 10, T, 1);
      c.fillStyle = C.steel; c.fillRect(x, y + 11, T, 1);
      c.fillStyle = C.steelHi; c.fillRect(x, y + 11, T, 1);
      dither(c, x, y + 11, T, 1, C.steelDark, 0.5);

      // 4타일 주기 세로 멀리언 + 리벳
      if (tx % 4 === 0) {
        c.fillStyle = C.steelDeep; c.fillRect(x, y + 1, 2, 11);
        c.fillStyle = C.steel; c.fillRect(x, y + 1, 1, 11);
        c.fillStyle = C.steelHi; c.fillRect(x, y + 5, 1, 1);
      }
    },

    ad(c, x, y, r, m, tx, ty) {
      DRAW.wall(c, x, y, r, m, tx, ty);
      const kind = ((tx * 7) | 0) % 3;
      const base = kind === 0 ? C.adA : (kind === 1 ? C.adB : C.adC);

      // 액자 — 2px 금속 프레임 + 1px 베벨
      bevel(c, x, y + 1, T, 11, C.steelDeep, C.steel, '#2b3036');
      c.fillStyle = base; c.fillRect(x, y + 3, T, 7);
      dither(c, x, y + 3, T, 2, U.shade(base, 22), 0.6);
      dither(c, x, y + 8, T, 2, U.shade(base, -20), 0.6);

      // 글자처럼 보이는 픽셀 라인 (길이를 들쭉날쭉하게)
      const w1 = 4 + ((r() * (T - 7)) | 0), w2 = 3 + ((r() * (T - 9)) | 0);
      c.fillStyle = 'rgba(240,244,248,0.42)'; c.fillRect(x + 2, y + 4, w1, 1);
      c.fillStyle = 'rgba(240,244,248,0.22)'; c.fillRect(x + 2, y + 6, w2, 1);
      c.fillStyle = 'rgba(240,244,248,0.14)'; c.fillRect(x + 2, y + 8, w2 - 1, 1);
      // 유리 사면 반사
      c.fillStyle = 'rgba(255,255,255,0.08)';
      c.fillRect(x + ((tx * 3) % T), y + 3, 1, 7);
    },

    door(c, x, y, r, m, tx, ty) {
      // 닫힌 측면 출입문 (상하 벽에 위치)
      c.fillStyle = C.wallShade; c.fillRect(x, y, T, T);
      bevel(c, x, y, T, T - 2, C.steelDark, C.steel, '#30363b');
      // 유리창
      c.fillStyle = '#1a1e24'; c.fillRect(x + 1, y + 2, T - 2, 9);
      c.fillStyle = C.glass; c.fillRect(x + 1, y + 3, T - 2, 7);
      dither(c, x + 1, y + 3, T - 2, 3, C.glassLit, 0.7);
      c.fillStyle = 'rgba(214,228,236,0.14)'; c.fillRect(x + 3, y + 4, 5, 1);

      // 문짝 합선부 — 승강구 중앙에 1px 틈 + 양쪽 고무
      const left = m.at(tx - 1, ty), right = m.at(tx + 1, ty);
      if (left === 'D' && right !== 'D') {
        c.fillStyle = '#121519'; c.fillRect(x + T - 1, y, 1, T - 2);
      }
      if (right === 'D' && left !== 'D') {
        c.fillStyle = '#121519'; c.fillRect(x, y, 1, T - 2);
      }
      // 하부 금속 패널 + 걸레받이
      c.fillStyle = C.steelDeep; c.fillRect(x, y + T - 5, T, 3);
      c.fillStyle = C.steel; c.fillRect(x, y + T - 5, T, 1);
      c.fillStyle = C.wallTrim; c.fillRect(x, y + T - 2, T, 2);

      // 노란 경고 스티커 / 손잡이
      if (r() > 0.6) {
        c.fillStyle = C.safetyDark; c.fillRect(x + 3, y + 5, 4, 3);
        c.fillStyle = C.safety; c.fillRect(x + 3, y + 5, 4, 2);
      }
      if (r() > 0.75) { c.fillStyle = C.steelHi; c.fillRect(x + T - 5, y + 6, 3, 1); }
    },

    gangway(c, x, y, r, m, tx, ty) {
      // 관통문 — 두꺼운 금속. 리벳과 킥플레이트로 "밀어야 하는 문"임을 보인다.
      bevel(c, x, y, T, T, C.steelDeep, C.steelDark, '#2a2f34');
      c.fillStyle = '#565e65'; c.fillRect(x + 2, y + 1, T - 4, T - 2);

      // 작은 창
      c.fillStyle = '#1a1e24'; c.fillRect(x + 3, y + 2, T - 6, T - 7);
      c.fillStyle = C.glass; c.fillRect(x + 4, y + 3, T - 8, T - 9);
      dither(c, x + 4, y + 3, T - 8, 2, C.glassLit, 0.6);

      // 리벳 4개 + 손잡이 + 킥플레이트
      c.fillStyle = C.steelHi;
      c.fillRect(x + 1, y + 1, 1, 1); c.fillRect(x + T - 2, y + 1, 1, 1);
      c.fillRect(x + 1, y + T - 2, 1, 1); c.fillRect(x + T - 2, y + T - 2, 1, 1);
      c.fillStyle = C.steel; c.fillRect(x + 2, y + T - 6, 2, 4);
      c.fillStyle = C.steelHi; c.fillRect(x + 2, y + T - 6, 1, 4);
      dither(c, x + 2, y + T - 3, T - 4, 2, '#000000', 0.4);
    },

    cab(c, x, y, r, m, tx, ty) {
      c.fillStyle = C.cab; c.fillRect(x, y, T, T);
      c.fillStyle = U.shade(C.cab, 16); c.fillRect(x, y, T, 1);
      dither(c, x, y + T - 6, T, 6, U.shade(C.cab, -26), 0.7);
      c.fillStyle = C.wallTrim; c.fillRect(x, y + T - 2, T, 2);
      // 루버 환기구
      for (let i = 2; i < T - 4; i += 3) {
        c.fillStyle = 'rgba(0,0,0,0.28)'; c.fillRect(x + 2, y + i, T - 4, 1);
        c.fillStyle = 'rgba(255,255,255,0.1)'; c.fillRect(x + 2, y + i + 1, T - 4, 1);
      }
      if (tx % 2 === 0) { c.fillStyle = 'rgba(0,0,0,0.14)'; c.fillRect(x, y, 1, T); }
    },

    /* ---- 좌석: 등받이 / 쿠션 / 노약자석 ---- */
    seatFabric(c, x, y, r, top, lo, hi) {
      c.fillStyle = top; c.fillRect(x, y, T, T);
      // 패브릭 짜임 — 성글게 뿌린 1px 점. 규칙적인 줄무늬가 보이면 안 된다.
      noiseFill(c, x, y, T, T, hi, 0.09);
      noiseFill(c, x + 1, y + 1, T - 1, T - 1, lo, 0.1);
      // 얼룩
      for (let i = 0; i < 3; i++) {
        c.fillStyle = r() > 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.13)';
        c.fillRect(x + ((r() * T) | 0), y + ((r() * T) | 0), 1 + ((r() * 2) | 0), 1);
      }
    },

    seat_back(c, x, y, r, m, tx, ty) {
      const up = m.at(tx, ty - 1);
      const facingDown = (up === '#' || up === 'W' || up === 'A' || up === 'c' || up === '=');
      DRAW.seatFabric(c, x, y, r, C.seat, C.seatDark, C.seatTop);
      // 등받이 상단 캡 (머리 닿는 곳) — 밝은 2px
      if (facingDown) {
        c.fillStyle = C.seatTop; c.fillRect(x, y + 1, T, 2);
        c.fillStyle = C.seatSeam; c.fillRect(x, y, T, 1);
        ditherFade(c, x, y + T - 5, T, 5, C.seatDark, 0.9, 'up');
      } else {
        c.fillStyle = C.seatTop; c.fillRect(x, y + T - 3, T, 2);
        c.fillStyle = C.seatSeam; c.fillRect(x, y + T - 1, T, 1);
        ditherFade(c, x, y, T, 5, C.seatDark, 0.9, 'down');
      }
      // 3타일 주기 스테인리스 구분봉 (좌석 구획)
      if (tx % 3 === 0) {
        c.fillStyle = C.steelDeep; c.fillRect(x, y, 1, T);
        c.fillStyle = C.steel; c.fillRect(x + 1, y, 1, T);
        c.fillStyle = C.steelHi; c.fillRect(x + 1, y + 2, 1, 4);
      }
    },

    seat(c, x, y, r, m, tx, ty) {
      const up = m.at(tx, ty - 1);
      const facingDown = (up === 'S');
      DRAW.seatFabric(c, x, y, r, C.seat, C.seatDark, C.seatTop);
      // 쿠션 앞코 (앉는 면 끝) — 밝게 말려 올라간 2px
      if (facingDown) {
        c.fillStyle = C.seatTop; c.fillRect(x, y, T, 4);
        c.fillStyle = C.seatSeam; c.fillRect(x, y + 4, T, 1);
        ditherFade(c, x, y + T - 6, T, 6, C.seatDark, 0.95, 'up');
        c.fillStyle = C.seatSeam; c.fillRect(x, y + T - 1, T, 1);
      } else {
        ditherFade(c, x, y, T, 5, C.seatDark, 0.95, 'down');
        c.fillStyle = C.seatSeam; c.fillRect(x, y + T - 5, T, 1);
        c.fillStyle = C.seatTop; c.fillRect(x, y + T - 4, T, 3);
        c.fillStyle = C.seatSeam; c.fillRect(x, y + T - 1, T, 1);
      }
      // 1인석 경계 + 구분봉
      if (tx % 2 === 0) { c.fillStyle = C.seatSeam; c.fillRect(x, y + 3, 1, T - 6); }
      if (tx % 3 === 0) {
        c.fillStyle = C.steelDeep; c.fillRect(x, y, 1, T);
        c.fillStyle = C.steel; c.fillRect(x + 1, y, 1, T);
      }
    },

    seat_priority(c, x, y, r, m, tx, ty) {
      const up = m.at(tx, ty - 1);
      const facingDown = (up === 'S' || up === '#' || up === 'W' || up === '=');
      DRAW.seatFabric(c, x, y, r, C.seatPri, U.shade(C.seatPri, -22), C.seatPriTop);
      if (facingDown) {
        c.fillStyle = C.seatPriTop; c.fillRect(x, y, T, 3);
        ditherFade(c, x, y + T - 6, T, 6, U.shade(C.seatPri, -26), 0.95, 'up');
      } else {
        ditherFade(c, x, y, T, 5, U.shade(C.seatPri, -26), 0.95, 'down');
        c.fillStyle = C.seatPriTop; c.fillRect(x, y + T - 4, T, 3);
      }
      // 노약자석 표식 — 1px 픽토그램 흔적
      if (tx % 2 === 0) {
        c.fillStyle = 'rgba(240,244,248,0.22)';
        c.fillRect(x + 7, y + 6, 2, 2); c.fillRect(x + 6, y + 9, 4, 1);
      }
      if (tx % 3 === 0) {
        c.fillStyle = C.steelDeep; c.fillRect(x, y, 1, T);
        c.fillStyle = C.steel; c.fillRect(x + 1, y, 1, T);
      }
    },

    pole(c, x, y, r, m, tx, ty) {
      DRAW.floor(c, x, y, r, m, tx, ty);
      // 바닥 그림자
      ditherBlob(c, x + 8, y + T - 3, 5, 2, '#000000', 0.7);
      // 스테인리스 스탠션 폴 — 3px 폭 + 1px 반사 하이라이트
      c.fillStyle = C.steelDeep; c.fillRect(x + 6, y, 4, T);
      c.fillStyle = C.steel; c.fillRect(x + 7, y, 2, T);
      c.fillStyle = C.steelHi; c.fillRect(x + 7, y, 1, T);
      // 상/하 고정 플랜지
      c.fillStyle = C.steelDark; c.fillRect(x + 5, y + T - 4, 6, 2);
      c.fillStyle = C.steelHi; c.fillRect(x + 5, y + T - 4, 6, 1);
      c.fillStyle = C.steelDark; c.fillRect(x + 5, y, 6, 1);
    },

    gravel(c, x, y, r, m, tx, ty) {
      c.fillStyle = C.gravel; c.fillRect(x, y, T, T);
      // 자갈 — 3톤 덩어리를 디더로 뭉쳐 찍는다
      for (let i = 0; i < 18; i++) {
        const v = r();
        const px = x + ((r() * T) | 0), py = y + ((r() * T) | 0);
        const w = 1 + ((r() * 2) | 0);
        c.fillStyle = v > 0.84 ? C.gravelHi : (v > 0.52 ? U.shade(C.gravel, 10) : C.gravelLo);
        c.fillRect(px, py, w, 1);
        if (v > 0.9) { c.fillStyle = C.steelDark; c.fillRect(px, py, 1, 1); }
      }
      noiseFill(c, x, y, T, T, C.gravelLo, 0.22);
      // 침목 (3타일 주기)
      if (ty % 3 === 1) {
        c.fillStyle = C.sleeper; c.fillRect(x, y + 4, T, 5);
        c.fillStyle = U.shade(C.sleeper, 14); c.fillRect(x, y + 4, T, 1);
        c.fillStyle = C.sleeperLo; c.fillRect(x, y + 8, T, 1);
        noiseFill(c, x, y + 5, T, 3, C.sleeperLo, 0.3);
      }
    },

    puddle(c, x, y, r, m, tx, ty) {
      DRAW.floor(c, x, y, r, m, tx, ty);
      // 고인 물 — 가운데는 꽉 차고 가장자리만 도트로 풀린다
      const cx = x + 8, cy = y + 8;
      ditherBlob(c, cx, cy, 7, 5, '#1b242c', 1);
      ditherBlob(c, cx, cy, 5, 3, '#121a21', 1);
      // 반사 1px
      c.fillStyle = 'rgba(168,196,210,0.26)'; c.fillRect(cx - 3, cy - 2, 4, 1);
      c.fillStyle = 'rgba(168,196,210,0.12)'; c.fillRect(cx - 1, cy + 1, 3, 1);
    },

    debris(c, x, y, r, m, tx, ty) {
      DRAW.floor(c, x, y, r, m, tx, ty);
      for (let i = 0; i < 5; i++) {
        const v = r();
        const px = x + 1 + ((r() * (T - 4)) | 0), py = y + 2 + ((r() * (T - 6)) | 0);
        const w = 2 + ((r() * 2) | 0), h = 1 + ((r() * 2) | 0);
        // 조각마다 1px 다크 아웃라인 — 바닥에서 분리되어 보이게
        c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(px, py + h, w, 1);
        c.fillStyle = v > 0.7 ? C.wallShade : (v > 0.4 ? C.steelDark : '#383e44');
        c.fillRect(px, py, w, h);
        c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(px, py, w, 1);
      }
    },

    void(c, x, y, r) {
      // 터널 콘크리트 암부 — 완전 검정이 아니라 미세 노이즈를 남긴다
      c.fillStyle = C.tunnel; c.fillRect(x, y, T, T);
      noiseFill(c, x, y, T, T, C.tunnelHi, 0.14);
      for (let i = 0; i < 3; i++) {
        c.fillStyle = 'rgba(40,46,52,0.5)';
        c.fillRect(x + ((r() * T) | 0), y + ((r() * T) | 0), 1, 1);
      }
    },
    empty(c, x, y) {
      c.fillStyle = '#06070a'; c.fillRect(x, y, T, T);
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

    // --- 앰비언트 오클루전: 솔리드 타일 주변 바닥을 디더로 어둡게 ---
    //     (그라데이션을 쓰면 저조도에서 띠가 보인다 → 전부 Bayer 디더)
    // 그림자 세기는 "무엇이 가리는가"에 따라 다르다.
    // 벽은 짙게, 좌석은 옅게, 1타일짜리 기둥은 아예 안 드리운다
    // (기둥은 자기 타일 안에 발밑 그림자를 따로 갖고 있다).
    //   벽에 닿은 첫 줄은 거의 꽉 찬 "컨택트 섀도"가 되어야 한다. 중간 농도로
    //   깔면 50% 체커가 점선 테두리처럼 읽힌다. 대신 색을 반투명으로 써서
    //   새카만 윤곽선이 되지 않게 한다.
    const AO_WALL = 'rgba(0,0,0,0.5)', AO_LOW = 'rgba(0,0,0,0.38)';
    const cast = (tx, ty) => {
      if (!map.isSolid(tx, ty)) return 0;
      const d = DEF[map.at(tx, ty)] || DEF[' '];
      if (d.name === 'pole') return 0;
      return d.low ? 1 : 2;              // 1 = 좌석(옅게), 2 = 벽(짙게)
    };
    const aoCol = (k) => (k === 2 ? AO_WALL : AO_LOW);
    const aoLv = (k) => (k === 2 ? 0.98 : 0.8);

    for (let y = 0; y < map.h; y++) {
      for (let x = 0; x < map.w; x++) {
        if (map.isSolid(x, y)) continue;
        const px = x * T, py = y * T;
        const up = cast(x, y - 1), dn = cast(x, y + 1);
        const lf = cast(x - 1, y), rt = cast(x + 1, y);
        if (up) ditherFade(c, px, py, T, 4, aoCol(up), aoLv(up), 'down');
        if (dn) ditherFade(c, px, py + T - 4, T, 4, aoCol(dn), aoLv(dn), 'up');
        if (lf) ditherFade(c, px, py, 3, T, aoCol(lf), aoLv(lf), 'right');
        if (rt) ditherFade(c, px + T - 3, py, 3, T, aoCol(rt), aoLv(rt), 'left');
        // 모서리는 한 번 더 — 구석이 깊어 보인다
        if (lf && up) dither(c, px, py, 2, 2, 'rgba(0,0,0,0.45)', 0.9);
        if (rt && up) dither(c, px + T - 2, py, 2, 2, 'rgba(0,0,0,0.45)', 0.9);
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
    for (const s of map.straps) {
      const sx = s.x - camX, sy = s.y - camY;
      if (sx < -8 || sx > DS.VIEW_W + 8 || sy < -8 || sy > DS.VIEW_H + 8) continue;
      const sway = Math.sin(t * s.sp + s.ph) * (0.6 + shake * 3);
      const x = Math.round(sx + sway), y = Math.round(sy);
      // 가죽 스트랩 (천장에서 내려온 끈)
      c.fillStyle = 'rgba(14,16,19,0.85)';
      c.fillRect(x, y - 1, 1, 5);
      // 손잡이 — 가운데가 뚫린 고리. 면으로 채우면 떠다니는 블록처럼 보인다.
      c.fillStyle = 'rgba(203,211,217,0.5)';
      c.fillRect(x - 2, y + 4, 5, 1);      // 윗변
      c.fillRect(x - 2, y + 5, 1, 2);      // 좌변
      c.fillRect(x + 2, y + 5, 1, 2);      // 우변
      c.fillRect(x - 1, y + 7, 3, 1);      // 아랫변
      c.fillStyle = 'rgba(236,242,246,0.34)';
      c.fillRect(x - 2, y + 4, 1, 1);      // 반사
      c.fillStyle = 'rgba(0,0,0,0.3)';
      c.fillRect(x - 1, y + 8, 3, 1);      // 접지 그림자
    }
  }

  return { DEF, DRAW, C, build, buildOverhead, drawOverhead,
           dither, ditherFade, ditherBlob, noiseFill, bevel };
})();
