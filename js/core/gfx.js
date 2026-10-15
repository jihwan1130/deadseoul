/* =============================================================================
   DEAD:SEOUL — core/gfx.js   [ART PASS v0.2 — "ZELTER-LIKE" 리디자인]
   픽셀 아트를 코드로 생성. 외부 이미지 에셋 0개.

   ── 리디자인 방향 ────────────────────────────────────────────────────────
   · 치비 비율   머리 10px / 전체 27px (37%). 이전 6/22(27%)에서 대폭 확대해
                 표정·헤어·소품이 들어갈 픽셀 공간을 확보한다.
   · 굵은 외곽선 8방향 다크 아웃라인 + 상단 림라이트로 배경에서 분리.
   · 실루엣 차별 체형(build) / 구부정함(hunch) / 헤어 / 복장(outfit) /
                 소품(가방·모자·완장)을 팔레트 데이터로 분리해 변종마다
                 멀리서도 구분되는 실루엣을 만든다.
   · 고채도 의상 환경은 저채도 회청색, 캐릭터 의상만 채도를 올려 눈에 띄게.
   · 좀비 연출   창백한 피부 + 퀭한 안와 + 발광 눈 + 벌어진 턱 + 유혈/상처.

     · PAL          : 캐릭터 팔레트 + 실루엣 스펙
     · person()     : 캐릭터 스프라이트 (팔레트×방향×프레임×변종 캐시)
     · corpse()     : 시체 + 혈흔 웅덩이
     · weapon()     : 손에 든/휘두르는 무기
     · icon()       : 아이템 아이콘 16x16
     · portrait()   : 대화창 흉상
     · num()        : 3x5 픽셀 숫자 (데미지 표시)
   ============================================================================= */
'use strict';

DS.Gfx = (function () {

  const U = DS.U;
  const OUTLINE = 'rgba(6,7,10,0.95)';

  /* =========================================================================
     팔레트 + 실루엣 스펙

       build    'slim' | 'normal' | 'heavy'   — 어깨/몸통 폭
       hunch    0~3                            — 머리를 앞/아래로 (좀비 구부정함)
       hair     'messy'|'short'|'long'|'bun'|'thin'|'cap'|'bald'
       outfit   'shirt'|'hoodie'|'uniform'|'cardigan'|'vest'|'blouse'
       pack     true  — 백팩 (어깨끈 + 뒤에서 실루엣)
       lanyard  true  — 사원증 목걸이
     ========================================================================= */
  const PAL = {
    /* ── 주인공: 야근하던 직장인. 흰 와이셔츠 + 풀린 붉은 넥타이 + 사원증 ── */
    doyun: {
      hair: '#16120e', hair2: '#2c241b', hairLit: '#42352a',
      skin: '#dcab7e', skin2: '#b8835a', skin3: '#8e6142',
      shirt: '#e6eaee', shirt2: '#b4bcc6', shirt3: '#848d98',
      pants: '#404a58', pants2: '#2b323d', pants3: '#1d222a',
      shoes: '#23262c', eye: '#1c1510',
      accent: '#b0232e', accent2: '#7a141d',        // 넥타이
      tag: '#f0cb3e',
      build: 'normal', hunch: 0, hairStyle: 'messy', outfit: 'shirt', lanyard: true
    },

    /* ── 민서: 대학생. 머스타드 후드 + 백팩 + 묶은 머리 ── */
    minseo: {
      hair: '#2b1d14', hair2: '#3e2b1d', hairLit: '#553926',
      skin: '#e3b792', skin2: '#bd8f6b', skin3: '#95684b',
      shirt: '#c98a2e', shirt2: '#9d6820', shirt3: '#744c16',
      pants: '#4b5362', pants2: '#333a46', pants3: '#23282f',
      shoes: '#e0dcd2', eye: '#20170f',
      accent: '#e8e2d4',                              // 후드 끈
      tag: null,
      build: 'slim', hunch: 0, hairStyle: 'bun', outfit: 'hoodie', pack: true
    },

    /* ── 일반 승객 ── */
    pass_m: {
      hair: '#1a1510', hair2: '#272019', hairLit: '#372d23',
      skin: '#d3a177', skin2: '#ac7c56', skin3: '#855c3f',
      shirt: '#4f6273', shirt2: '#3a4a58', shirt3: '#2a3641',
      pants: '#343a45', pants2: '#23282f', pants3: '#181b21',
      shoes: '#22262c', eye: '#1a1410',
      accent: '#36424f', tag: null,
      build: 'normal', hunch: 0, hairStyle: 'short', outfit: 'shirt'
    },
    pass_f: {
      hair: '#241a13', hair2: '#33251b', hairLit: '#473325',
      skin: '#deae88', skin2: '#b68564', skin3: '#8f6246',
      shirt: '#9c5f69', shirt2: '#7a444e', shirt3: '#5c3138',
      pants: '#403c48', pants2: '#2c2934', pants3: '#1f1d25',
      shoes: '#393039', eye: '#1e1510',
      accent: '#5f3a44', tag: null,
      build: 'slim', hunch: 0, hairStyle: 'long', outfit: 'blouse'
    },

    /* =====================================================================
       좀비 변종 — 실루엣으로 구분한다
         office  : 정장 재킷 반쯤 벗겨짐, 넥타이 늘어짐, 한쪽 어깨 노출
         student : 마른 체형 + 백팩, 앞으로 기울어진 자세
         elder   : 깊게 구부정, 작고 두꺼움, 희끗한 성긴 머리, 카디건
         staff   : 제복 모자 + 형광 조끼, 가장 크고 어깨 넓음
       ===================================================================== */
    z_office: {
      hair: '#1a1612', hair2: '#272019', hairLit: '#352c22',
      skin: '#93a68c', skin2: '#6e8069', skin3: '#4e5d4b',
      shirt: '#b9bdb6', shirt2: '#8d9292', shirt3: '#676c6d',
      jacket: '#33333c', jacket2: '#23232b',
      pants: '#373d49', pants2: '#262b34', pants3: '#1a1d23',
      shoes: '#212529', eye: '#d8e6b8',
      accent: '#6e1319', accent2: '#4a0c10',
      tag: '#9a8e3a',
      build: 'normal', hunch: 1, hairStyle: 'messy', outfit: 'shirt',
      lanyard: true, jacketOn: true, zombie: true, gore: 2
    },
    z_student: {
      hair: '#120f0d', hair2: '#1e1915', hairLit: '#2b241d',
      skin: '#9bad92', skin2: '#74876d', skin3: '#53634e',
      shirt: '#33406a', shirt2: '#242e4f', shirt3: '#1a2139',
      pants: '#2e3755', pants2: '#1f263c', pants3: '#161b2b',
      shoes: '#262a30', eye: '#dcecb6',
      accent: '#7a1318', accent2: '#520c10',
      tag: null,
      build: 'slim', hunch: 2, hairStyle: 'short', outfit: 'uniform',
      pack: true, zombie: true, gore: 3
    },
    z_elder: {
      hair: '#c3beb4', hair2: '#9a948a', hairLit: '#d9d5cc',
      skin: '#8f9f88', skin2: '#6a7a65', skin3: '#4b5848',
      shirt: '#8a6240', shirt2: '#67462c', shirt3: '#4a321e',
      pants: '#5c5443', pants2: '#433c2f', pants3: '#2e2921',
      shoes: '#302c24', eye: '#cfe0ac',
      accent: '#6b1116', accent2: '#470a0e',
      tag: null,
      build: 'heavy', hunch: 3, hairStyle: 'thin', outfit: 'cardigan',
      zombie: true, gore: 1
    },
    z_staff: {
      hair: '#161310', hair2: '#211d18', hairLit: '#2e271f',
      skin: '#8d9f87', skin2: '#687a63', skin3: '#495845',
      shirt: '#2d4a66', shirt2: '#203751', shirt3: '#16263a',
      vest: '#c6821f', vest2: '#9a6111', vestBand: '#e4ecef',
      pants: '#303846', pants2: '#212832', pants3: '#171b22',
      shoes: '#22262c', eye: '#d6e8b0',
      accent: '#7d1419', accent2: '#550d11',
      tag: '#cfd4da',
      build: 'heavy', hunch: 1, hairStyle: 'cap', outfit: 'vest',
      zombie: true, gore: 2
    }
  };

  /* =========================================================================
     스프라이트 규격

       FY는 "발바닥 바로 아래" 기준선. FY-1이 최하단 픽셀 행.
       머리 4..13(10px) / 목 14 / 몸통 15..23(9px) / 다리 24..28 / 신발 29..30
       → 전체 27px, 머리 비중 37%
     ========================================================================= */
  const SW = 32, SH = 34, FX = 16, FY = 31;

  const HEAD_T = FY - 27;   // 4   머리 윗선
  const HEAD_H = 10;
  const NECK_Y = FY - 17;   // 14
  const TOR_T  = FY - 16;   // 15  몸통 윗선
  const TOR_H  = 9;
  const LEG_T  = FY - 7;    // 24
  const LEG_H  = 5;
  const SHOE_T = FY - 2;    // 29

  const cache = new Map();
  const tmpA = U.makeCanvas(SW, SH);
  const tmpB = U.makeCanvas(SW, SH);

  function R(c, x, y, w, h, col) {
    if (w <= 0 || h <= 0 || !col) return;
    c.fillStyle = col; c.fillRect(x | 0, y | 0, w | 0, h | 0);
  }

  /** 체형에 따른 몸통 폭 */
  function torsoW(p, side) {
    const b = p.build || 'normal';
    const base = side ? 9 : 12;
    return base + (b === 'heavy' ? 1 : (b === 'slim' ? -1 : 0));
  }

  /* =========================================================================
     파트별 페인터
     ========================================================================= */

  /** 다리 + 신발 */
  function paintLegs(c, p, side, frame, lean) {
    const f1 = frame === 1, f3 = frame === 3;
    const z = !!p.zombie;

    if (side) {
      // 측면: 앞다리/뒷다리가 크게 교차. 좀비는 뒷다리를 끌어 비대칭.
      const swing = f1 ? 2 : (f3 ? -2 : 0);
      const drag = z ? 1 : 0;
      const bx = FX - 4 + lean;
      // 뒷다리 (어두움)
      R(c, bx + 1 - swing, LEG_T, 4, LEG_H + drag, p.pants2);
      R(c, bx + 1 - swing, LEG_T, 4, 1, p.pants3);
      R(c, bx + 1 - swing, SHOE_T + drag, 5, 2, U.shade(p.shoes, -16));
      // 앞다리
      R(c, bx + 4 + swing, LEG_T, 4, LEG_H, p.pants);
      R(c, bx + 4 + swing, LEG_T, 1, LEG_H, U.shade(p.pants, 18));   // 바깥 림
      R(c, bx + 4 + swing, SHOE_T, 5, 2, p.shoes);
      R(c, bx + 4 + swing, SHOE_T, 5, 1, U.shade(p.shoes, 24));
    } else {
      const tw = torsoW(p, false), tx = FX - (tw >> 1) + lean;
      const lDy = f1 ? -1 : 0, rDy = f3 ? -1 : 0;
      const lDx = f1 ? -1 : 0, rDx = f3 ? 1 : 0;   // 보폭 — 좌우로도 벌어진다
      const drag = z ? 1 : 0;                       // 좀비는 오른다리를 끈다
      // 가랑이 음영 (다리 사이)
      R(c, tx + 1, LEG_T, tw - 2, 2, p.pants3);
      // 왼다리
      R(c, tx + 1 + lDx, LEG_T + lDy, 5, LEG_H - lDy, p.pants);
      R(c, tx + 1 + lDx, LEG_T + lDy, 1, LEG_H - lDy, U.shade(p.pants, 18));
      R(c, tx + 1 + lDx, SHOE_T + lDy, 5, 2, p.shoes);
      R(c, tx + 1 + lDx, SHOE_T + lDy, 5, 1, U.shade(p.shoes, 24));
      // 오른다리 (그늘진 쪽)
      R(c, tx + tw - 6 + rDx, LEG_T + rDy, 5, LEG_H - rDy + drag, p.pants2);
      R(c, tx + tw - 2 + rDx, LEG_T + rDy, 1, LEG_H - rDy, p.pants3);
      R(c, tx + tw - 6 + rDx, SHOE_T + rDy + drag, 5, 2, U.shade(p.shoes, -14));
      R(c, tx + tw - 6 + rDx, SHOE_T + rDy + drag, 5, 1, U.shade(p.shoes, 4));
    }
  }

  /** 몸통 + 복장 */
  function paintTorso(c, p, side, up, bob, lean) {
    const tw = torsoW(p, side);
    const tx = FX - (tw >> 1) + (side ? 1 : 0) + lean;
    const ty = TOR_T + bob;
    const z = !!p.zombie;

    // 기본 상의
    R(c, tx, ty, tw, TOR_H, p.shirt);
    R(c, tx, ty, tw, 1, U.shade(p.shirt, 18));          // 어깨 림라이트
    R(c, tx, ty + TOR_H - 2, tw, 2, p.shirt2);          // 밑단 음영
    R(c, tx, ty + 1, 1, TOR_H - 1, p.shirt2);           // 좌측 면 음영
    R(c, tx + tw - 1, ty + 1, 1, TOR_H - 1, p.shirt2);
    if (side) R(c, tx, ty + 1, 2, TOR_H - 1, p.shirt3); // 측면은 뒤쪽을 더 어둡게

    if (up) {
      // 뒷모습: 등솔기 + 어깨선
      R(c, FX - 1 + lean, ty + 1, 1, TOR_H - 2, p.shirt2);
      R(c, tx + 1, ty + 1, tw - 2, 1, U.shade(p.shirt, 8));
    } else {
      /* ── 복장별 앞면 디테일 ─────────────────────────────── */
      const of = p.outfit;

      if (of === 'shirt') {
        // 와이셔츠 깃 (V자) + 풀린 넥타이
        if (side) {
          R(c, tx + tw - 3, ty, 3, 2, U.shade(p.shirt, 26));
          R(c, tx + tw - 3, ty + 2, 2, 5, p.accent);
          R(c, tx + tw - 3, ty + 2, 2, 1, U.shade(p.accent, 20));
        } else {
          R(c, FX - 3 + lean, ty, 2, 2, U.shade(p.shirt, 26));
          R(c, FX + 1 + lean, ty, 2, 2, U.shade(p.shirt, 26));
          R(c, FX - 1 + lean, ty, 2, 1, p.shirt3);              // 깃 사이 그늘
          R(c, FX - 1 + lean, ty + 1, 2, 4, p.accent);          // 넥타이 목
          R(c, FX - 2 + lean, ty + 5, 4, 3, p.accent2);         // 넥타이 폭
          R(c, FX - 1 + lean, ty + 1, 1, 4, U.shade(p.accent, 18));
        }
      } else if (of === 'hoodie') {
        // 후드: 목 뒤 후드 덩어리 + 끈 + 캥거루 주머니
        R(c, tx + 1, ty - 1, tw - 2, 2, U.shade(p.shirt, -14));
        R(c, tx + 2, ty - 1, tw - 4, 1, U.shade(p.shirt, -4));
        if (!side) {
          R(c, FX - 2 + lean, ty + 1, 1, 4, p.accent);
          R(c, FX + 1 + lean, ty + 1, 1, 3, p.accent);
          R(c, tx + 2, ty + 5, tw - 4, 1, p.shirt3);            // 주머니 입구
          R(c, tx + 2, ty + 6, tw - 4, 1, U.shade(p.shirt, 6));
        } else {
          R(c, tx + tw - 4, ty + 1, 1, 4, p.accent);
          R(c, tx + 2, ty + 5, tw - 3, 1, p.shirt3);
        }
      } else if (of === 'uniform') {
        // 교복: 흰 셔츠 + 넥타이
        if (!side) {
          R(c, FX - 2 + lean, ty, 4, 6, '#ccd2dc');
          R(c, FX - 2 + lean, ty, 4, 1, '#e4e9f0');
          R(c, FX - 1 + lean, ty + 1, 2, 4, p.accent);
          R(c, tx + 2, ty + 1, 1, 5, U.shade(p.shirt, 14));     // 재킷 라펠
          R(c, tx + tw - 3, ty + 1, 1, 5, U.shade(p.shirt, 14));
        } else {
          R(c, tx + tw - 3, ty, 3, 5, '#ccd2dc');
          R(c, tx + tw - 2, ty + 1, 1, 4, p.accent);
        }
      } else if (of === 'cardigan') {
        // 카디건: 가운데 트임 + 안쪽 셔츠
        R(c, FX - 2 + lean, ty, 4, TOR_H - 1, U.shade(p.shirt, -26));
        R(c, FX - 1 + lean, ty + 1, 2, TOR_H - 3, '#b9b2a2');
        R(c, tx + 2, ty + 1, 1, TOR_H - 2, U.shade(p.shirt, 14));
        R(c, tx + tw - 3, ty + 1, 1, TOR_H - 2, U.shade(p.shirt, 14));
      } else if (of === 'vest') {
        // 형광 조끼 + 반사 밴드
        R(c, tx + 1, ty + 1, tw - 2, TOR_H - 2, p.vest);
        R(c, tx + 1, ty + 1, tw - 2, 1, U.shade(p.vest, 20));
        R(c, tx + 1, ty + 3, tw - 2, 1, p.vestBand);
        R(c, tx + 1, ty + 6, tw - 2, 1, p.vestBand);
        R(c, tx + 1, ty + TOR_H - 2, tw - 2, 1, p.vest2);
        if (!side) R(c, FX - 1 + lean, ty + 1, 2, TOR_H - 2, p.shirt);  // 앞 지퍼 트임
      } else if (of === 'blouse') {
        R(c, tx + 2, ty, tw - 4, 2, U.shade(p.shirt, 24));
        R(c, FX - 1 + lean, ty, 2, 3, p.shirt3);
        R(c, tx + 2, ty + 4, tw - 4, 1, U.shade(p.shirt, -16));
      }

      // 정장 재킷 (좀비 직장인) — 몸통 양 끝을 덮어 어깨를 넓힌다
      if (p.jacketOn) {
        R(c, tx, ty, 3, TOR_H - 1, p.jacket);                // 왼쪽 앞섶
        R(c, tx, ty, 3, 1, U.shade(p.jacket, 20));
        R(c, tx + 2, ty + 1, 1, TOR_H - 3, U.shade(p.jacket, 26));  // 라펠 접힘선
        R(c, tx + tw - 3, ty, 3, TOR_H - 1, p.jacket2);      // 오른쪽 앞섶
        R(c, tx + tw - 3, ty, 3, 1, U.shade(p.jacket, 10));
        R(c, tx, ty + TOR_H - 2, 3, 2, p.jacket2);
        // 오른쪽 어깨가 찢겨 피부 노출
        R(c, tx + tw - 3, ty + 2, 3, 3, p.skin2);
        R(c, tx + tw - 3, ty + 2, 3, 1, p.skin);
        R(c, tx + tw - 3, ty + 5, 3, 1, p.accent2);
      }

      // 사원증 목걸이 — 넥타이를 피해 가슴 오른쪽에 매단다
      if (p.lanyard && p.tag) {
        const cx = side ? tx + tw - 4 : FX + 2 + lean;
        R(c, cx - 2, ty, 1, 2, '#242830');                   // 목끈
        R(c, cx, ty + 2, 1, 2, '#242830');
        R(c, cx - 1, ty + 4, 3, 3, p.tag);                   // 카드
        R(c, cx - 1, ty + 4, 3, 1, U.shade(p.tag, 24));
        R(c, cx - 1, ty + 6, 3, 1, U.shade(p.tag, -32));
        R(c, cx, ty + 5, 1, 1, U.shade(p.tag, -44));         // 증명사진
      }
    }

    // 백팩 어깨끈 (앞/옆) 또는 가방 본체 (뒤)
    if (p.pack) {
      if (up) {
        R(c, tx + 1, ty - 1, tw - 2, TOR_H, '#4a3b32');
        R(c, tx + 2, ty, tw - 4, TOR_H - 3, '#5e4b3e');
        R(c, tx + 2, ty, tw - 4, 1, '#6f5a4a');
        R(c, tx + 3, ty + 3, tw - 6, 1, '#352a23');
        R(c, tx + 4, ty + TOR_H - 4, tw - 8, 2, '#2e241e');
      } else if (side) {
        R(c, tx - 2, ty, 3, TOR_H - 1, '#4a3b32');
        R(c, tx - 2, ty, 3, 1, '#5e4b3e');
        R(c, tx + tw - 3, ty, 1, 6, '#3c2f28');
      } else {
        R(c, tx + 2, ty, 1, 6, '#3c2f28');
        R(c, tx + tw - 3, ty, 1, 6, '#3c2f28');
      }
    }

    /* ── 좀비: 찢긴 옷 / 혈흔 / 노출된 상처 ── */
    if (z) {
      const g = p.gore || 1;
      R(c, tx + (side ? 4 : 2), ty + 4, 2, 3, p.skin3);           // 찢긴 구멍
      R(c, tx + (side ? 4 : 2), ty + 4, 2, 1, p.skin2);
      R(c, tx + (side ? 3 : 2), ty + 6, 3, 1, p.accent2);         // 흘러내린 피
      if (g >= 2) {
        R(c, tx + tw - (side ? 5 : 6), ty + 3, 2, 1, p.accent);
        R(c, tx + 1, ty + TOR_H - 2, 2, 2, p.accent2);
      }
      if (g >= 3) {
        R(c, tx + (side ? 5 : 6), ty + 2, 2, 2, p.accent);        // 가슴 상흔
        R(c, tx + (side ? 6 : 7), ty + 4, 1, 2, p.accent2);
      }
    }

    return { tx, ty, tw };
  }

  /** 팔 */
  function paintArms(c, p, side, up, t, frame, reach) {
    const { tx, ty, tw } = t;
    const f1 = frame === 1, f3 = frame === 3;
    const z = !!p.zombie;
    const sleeve = p.jacketOn ? p.jacket : (p.outfit === 'vest' ? p.shirt : p.shirt);
    const sleeve2 = p.jacketOn ? p.jacket2 : p.shirt2;

    if (reach && !up) {
      /* 좀비 공격 자세 — 두 팔을 앞으로 뻗음 */
      if (side) {
        R(c, tx + tw - 2, ty + 1, 8, 3, sleeve);
        R(c, tx + tw - 2, ty + 1, 8, 1, U.shade(sleeve, 16));
        R(c, tx + tw + 5, ty + 1, 3, 3, p.skin);                 // 손
        R(c, tx + tw + 7, ty + 1, 1, 1, p.skin2);
        R(c, tx + tw - 2, ty + 4, 7, 3, sleeve2);                // 반대 팔 (살짝 아래)
        R(c, tx + tw + 4, ty + 4, 3, 3, p.skin2);
        if (z) R(c, tx + tw + 7, ty + 2, 1, 2, p.accent2);       // 손끝 핏자국
      } else {
        R(c, tx - 2, ty + 2, 3, 7, sleeve);
        R(c, tx - 2, ty + 2, 3, 1, U.shade(sleeve, 16));
        R(c, tx + tw - 1, ty + 2, 3, 7, sleeve2);
        R(c, tx - 3, ty + 8, 4, 3, p.skin);                      // 앞으로 뻗은 손
        R(c, tx + tw - 1, ty + 8, 4, 3, p.skin);
        R(c, tx - 3, ty + 8, 4, 1, U.shade(p.skin, 14));
        R(c, tx + tw - 1, ty + 8, 4, 1, U.shade(p.skin, 14));
        if (z) { R(c, tx - 3, ty + 10, 4, 1, p.accent2); R(c, tx + tw - 1, ty + 10, 4, 1, p.accent2); }
      }
      return;
    }

    const aDy = f3 ? -1 : 0, bDy = f1 ? -1 : 0;
    // 좀비는 한쪽 팔이 축 늘어진다
    const limp = z ? 2 : 0;

    if (side) {
      // 뒷팔 (먼저)
      R(c, tx - 1, ty + 1 + bDy, 3, 5, sleeve2);
      R(c, tx - 1, ty + 6 + bDy, 3, 2, p.skin2);
      // 앞팔
      R(c, tx + tw - 3, ty + 1 + aDy, 3, 5 + limp, sleeve);
      R(c, tx + tw - 3, ty + 1 + aDy, 3, 1, U.shade(sleeve, 14));
      R(c, tx + tw - 3, ty + 6 + aDy + limp, 3, 3, p.skin);
      R(c, tx + tw - 3, ty + 6 + aDy + limp, 3, 1, U.shade(p.skin, 12));
    } else {
      // 왼팔
      R(c, tx - 2, ty + 1 + aDy, 3, 5, sleeve);
      R(c, tx - 2, ty + 1 + aDy, 3, 1, U.shade(sleeve, 14));
      R(c, tx - 2, ty + 6 + aDy, 3, 3, p.skin);
      R(c, tx - 2, ty + 6 + aDy, 3, 1, U.shade(p.skin, 12));
      // 오른팔 (좀비는 늘어짐)
      R(c, tx + tw - 1, ty + 1 + bDy, 3, 5 + limp, sleeve2);
      R(c, tx + tw - 1, ty + 6 + bDy + limp, 3, 3, p.skin2);
      if (z) R(c, tx + tw - 1, ty + 8 + bDy + limp, 3, 1, p.accent2);
      // 겨드랑이 이음선 — 팔과 몸통이 한 덩어리로 보이지 않게 분리
      R(c, tx, ty + 1 + aDy, 1, 7, U.shade(sleeve, -30));
      R(c, tx + tw - 1, ty + 1 + bDy, 1, 7, U.shade(sleeve, -34));
    }
  }

  /** 머리 — 두개골 / 헤어 / 표정
      세로 10행 레이아웃: 0~3 헤어 · 4 이마 · 5~6 눈 · 7 코 · 8 입 · 9 턱 */
  function paintHead(c, p, side, up, bob, lean) {
    const z = !!p.zombie;
    const hunch = p.hunch || 0;
    const hw = 9;                                   // 어깨(12)보다 좁게 — 봅헤드 방지
    const hx = FX - 4 + (side ? 1 : 0) + lean;
    const hy = HEAD_T + bob + hunch;
    const hs = p.hairStyle;
    const H = p.hair, H2 = p.hair2, HL = p.hairLit;

    // 목 — 머리 바로 아래 1행. 머리를 마지막에 그리므로 턱 그림자가 된다.
    R(c, FX - 2 + lean, hy + HEAD_H, 4, 1, p.skin3);

    /* ── 두상 (모서리를 깎아 둥글게) ── */
    R(c, hx + 1, hy, hw - 2, 1, p.skin);
    R(c, hx, hy + 1, hw, HEAD_H - 2, p.skin);
    R(c, hx + 1, hy + HEAD_H - 1, hw - 2, 1, p.skin2);
    R(c, hx, hy + 1, 1, HEAD_H - 2, p.skin2);              // 좌우 면 음영
    R(c, hx + hw - 1, hy + 1, 1, HEAD_H - 2, p.skin2);
    R(c, hx + 2, hy + HEAD_H - 2, hw - 4, 1, p.skin2);     // 턱선

    /* ── 윗머리: hy..hy+3 (둥근 실루엣) ── */
    function cap(spiky) {
      R(c, hx + 1, hy, hw - 2, 1, H);                      // 두상 최상단까지 덮는다
      R(c, hx, hy + 1, hw, 3, H);
      R(c, hx + 2, hy, hw - 4, 1, HL);                     // 정수리 광
      R(c, hx + 1, hy + 3, hw - 2, 1, H2);                 // 헤어라인 그늘
      R(c, hx, hy + 1, 1, 3, H2);
      if (spiky) {                                          // 부스스한 머리
        R(c, hx + 1, hy - 1, 2, 1, H);
        R(c, hx + 5, hy - 1, 2, 1, H);
        R(c, hx + 7, hy + 1, 1, 1, H);
      }
    }
    const sideburn = () => {
      R(c, hx, hy + 4, 1, 2, H);
      R(c, hx + hw - 1, hy + 4, 1, 2, H);
    };

    if (up) {
      /* ===== 뒷모습: 얼굴 없음 ===== */
      if (hs === 'bald') {
        R(c, hx, hy + 1, hw, HEAD_H - 2, p.skin);
        R(c, hx + 1, hy + 1, hw - 2, 1, U.shade(p.skin, 14));
        R(c, hx, hy + 5, hw, 3, H2);                        // 뒤통수 성긴 머리
      } else if (hs === 'thin') {
        R(c, hx, hy + 1, hw, HEAD_H - 2, p.skin);
        R(c, hx + 1, hy + 2, hw - 2, 5, H);
        R(c, hx + 2, hy + 2, hw - 4, 1, HL);
        R(c, hx + 3, hy + 3, hw - 6, 2, p.skin2);           // 정수리 탈모
      } else {
        R(c, hx + 1, hy, hw - 2, 1, H);
        R(c, hx, hy + 1, hw, HEAD_H - 1, H);
        R(c, hx + 2, hy, hw - 4, 1, HL);
        R(c, hx + 2, hy + 2, hw - 4, 1, H2);                // 가마
        R(c, hx, hy + HEAD_H - 1, hw, 1, H2);
      }
      if (hs === 'long') {
        R(c, hx - 1, hy + 2, 1, HEAD_H + 2, H);
        R(c, hx + hw, hy + 2, 1, HEAD_H + 2, H);
        R(c, hx, hy + HEAD_H, hw, 2, H2);
      }
      if (hs === 'bun') { R(c, hx + 3, hy - 2, 4, 3, H); R(c, hx + 4, hy - 2, 2, 1, HL); }
      if (hs === 'cap') {
        R(c, hx, hy, hw, 5, p.shirt3);
        R(c, hx + 1, hy, hw - 2, 1, U.shade(p.shirt3, 28));
        R(c, hx, hy + 4, hw, 1, U.shade(p.shirt3, -30));
        R(c, hx + 3, hy + 2, 3, 1, U.shade(p.shirt3, -16));  // 뒤 조절밴드
      }
      if (z) { R(c, hx + 5, hy + 3, 2, 2, p.accent2); R(c, hx + 6, hy + 5, 1, 2, p.accent2); }
      return;
    }

    if (side) {
      /* ===== 측면: 뒤통수 크게 + 눈 하나 ===== */
      if (hs === 'bald') {
        R(c, hx, hy + 2, 3, 5, H2);
      } else if (hs === 'thin') {
        R(c, hx, hy + 1, 5, 5, H);
        R(c, hx, hy + 1, 2, 1, HL);
        R(c, hx + 3, hy + 1, 3, 2, p.skin);                  // 이마 벗겨짐
      } else {
        cap(hs === 'messy');
        R(c, hx, hy + 1, 3, 6, H);                           // 뒤통수
        R(c, hx, hy + 2, 1, 5, H2);
        if (hs === 'long') { R(c, hx - 1, hy + 2, 2, 9, H); R(c, hx - 1, hy + 3, 1, 7, H2); }
        if (hs === 'bun') { R(c, hx - 2, hy + 1, 3, 3, H); R(c, hx - 2, hy + 1, 2, 1, HL); }
      }
      if (hs === 'cap') {
        R(c, hx, hy, hw - 1, 4, p.shirt3);
        R(c, hx + 1, hy, hw - 3, 1, U.shade(p.shirt3, 28));
        R(c, hx + hw - 2, hy + 3, 4, 1, U.shade(p.shirt3, -20));   // 챙
        R(c, hx + hw - 2, hy + 4, 3, 1, U.shade(p.shirt3, -38));
      }

      const ey = hy + 5;
      if (z) {
        R(c, hx + 4, ey - 1, 4, 4, p.skin3);                 // 퀭한 안와
        R(c, hx + 5, ey, 2, 2, p.eye);
        R(c, hx + 5, ey, 1, 1, '#f2fadc');
        R(c, hx + 5, ey + 2, 2, 1, p.accent2);
      } else {
        R(c, hx + 5, ey, 2, 2, p.eye);
        R(c, hx + 5, ey, 1, 1, '#efeadd');                   // 눈빛
        R(c, hx + 4, ey - 1, 3, 1, U.shade(p.skin, -30));    // 눈썹
      }
      R(c, hx + hw - 1, hy + 7, 1, 1, p.skin2);              // 코끝
      if (z) {
        R(c, hx + 5, hy + 8, 4, 2, '#1d0b0d');               // 벌어진 턱
        R(c, hx + 6, hy + 8, 1, 1, '#d8d2c0');
        R(c, hx + 5, hy + 10, 3, 1, p.accent2);
      } else {
        R(c, hx + 5, hy + 8, 3, 1, p.skin3);
      }
    } else {
      /* ===== 정면 ===== */
      if (hs === 'bald') {
        R(c, hx, hy + 3, 2, 3, H2); R(c, hx + hw - 2, hy + 3, 2, 3, H2);
        R(c, hx + 2, hy + 1, hw - 4, 1, U.shade(p.skin, 20));
      } else if (hs === 'thin') {
        R(c, hx + 1, hy + 1, hw - 2, 1, H);
        R(c, hx, hy + 2, hw, 2, H);
        R(c, hx + 3, hy + 1, hw - 6, 2, p.skin);             // 정수리 성김
        R(c, hx, hy + 3, hw, 1, H2);
        R(c, hx, hy + 4, 1, 2, H2); R(c, hx + hw - 1, hy + 4, 1, 2, H2);
      } else {
        cap(hs === 'messy');
        sideburn();
        if (hs === 'long') {
          R(c, hx - 1, hy + 2, 2, 9, H); R(c, hx + hw - 1, hy + 2, 2, 9, H);
          R(c, hx - 1, hy + 4, 1, 7, H2); R(c, hx + hw, hy + 4, 1, 7, H2);
        }
        if (hs === 'bun') {
          R(c, hx + 3, hy - 2, 4, 3, H); R(c, hx + 4, hy - 2, 2, 1, HL);
          R(c, hx - 1, hy + 2, 1, 4, H); R(c, hx + hw, hy + 2, 1, 4, H);
        }
      }
      if (hs === 'cap') {
        R(c, hx, hy, hw, 4, p.shirt3);
        R(c, hx + 1, hy, hw - 2, 1, U.shade(p.shirt3, 28));
        R(c, hx - 1, hy + 4, hw + 2, 1, U.shade(p.shirt3, -20));   // 챙
        R(c, hx - 1, hy + 5, hw + 2, 1, U.shade(p.shirt3, -40));
      }

      /* ── 눈 ── */
      const ey = hy + (hs === 'cap' ? 6 : 5);
      if (z) {
        R(c, hx, ey - 1, 4, 4, p.skin3);                     // 좌 안와
        R(c, hx + 5, ey - 1, 4, 4, p.skin3);                 // 우 안와
        R(c, hx + 1, ey, 2, 2, p.eye);                       // 발광 홍채
        R(c, hx + 6, ey, 2, 2, p.eye);
        R(c, hx + 1, ey, 1, 1, '#f4fbe0');
        R(c, hx + 6, ey, 1, 1, '#f4fbe0');
        R(c, hx + 1, ey + 2, 2, 1, p.accent2);               // 눈 밑 핏물
      } else {
        R(c, hx + 1, ey, 2, 2, p.eye);
        R(c, hx + 6, ey, 2, 2, p.eye);
        R(c, hx + 1, ey, 1, 1, '#efeadd');                   // 1px 눈빛
        R(c, hx + 6, ey, 1, 1, '#efeadd');
        R(c, hx + 1, ey - 1, 2, 1, U.shade(p.skin, -34));    // 눈썹
        R(c, hx + 6, ey - 1, 2, 1, U.shade(p.skin, -34));
      }
      /* ── 코 / 입 ── */
      R(c, hx + 4, hy + 7, 1, 1, p.skin2);
      if (z) {
        R(c, hx + 2, hy + 8, 5, 2, '#1d0b0d');               // 벌어진 턱
        R(c, hx + 3, hy + 8, 1, 1, '#d8d2c0');               // 이빨
        R(c, hx + 5, hy + 8, 1, 1, '#c9c2b0');
        R(c, hx + 3, hy + 10, 3, 1, p.accent2);              // 턱에 흐른 피
        R(c, hx + 4, hy + 11, 1, 1, p.accent2);
      } else {
        R(c, hx + 3, hy + 8, 3, 1, p.skin3);
      }
    }

    // 좀비 머리 상처
    if (z) {
      R(c, hx + (side ? 1 : 6), hy + 2, 2, 1, p.accent2);
      if ((p.gore || 1) >= 2) R(c, hx + (side ? 2 : 7), hy + 3, 1, 2, p.accent);
    }
  }


  /* =========================================================================
     몸통 조립
     ========================================================================= */
  function paintBody(c, p, dir, frame, variant) {
    const side = dir === 'side', up = dir === 'up';
    const f1 = frame === 1, f3 = frame === 3;
    const bob = (f1 || f3) ? -1 : 0;
    // 좀비는 진행 방향으로 상체가 기운다
    const lean = p.zombie ? (side ? 1 : 0) : 0;

    paintLegs(c, p, side, frame, lean);
    const t = paintTorso(c, p, side, up, bob, lean);
    // 뒤쪽 팔 → 머리 → 앞쪽 팔 순이 이상적이지만, 이 해상도에서는
    // 머리가 팔보다 항상 위에 오는 편이 실루엣이 깔끔하다.
    paintArms(c, p, side, up, t, frame, variant === 'reach');
    paintHead(c, p, side, up, bob, lean);
  }

  /* =========================================================================
     아웃라인 + 캐시
     ========================================================================= */
  function outline(src, dirs) {
    tmpB.ctx.clearRect(0, 0, SW, SH);
    tmpB.ctx.globalCompositeOperation = 'source-over';
    tmpB.ctx.drawImage(src, 0, 0);
    tmpB.ctx.globalCompositeOperation = 'source-in';
    tmpB.ctx.fillStyle = OUTLINE;
    tmpB.ctx.fillRect(0, 0, SW, SH);
    tmpB.ctx.globalCompositeOperation = 'source-over';

    const out = U.makeCanvas(SW, SH);
    for (const [dx, dy] of dirs) out.ctx.drawImage(tmpB.canvas, dx, dy);
    out.ctx.drawImage(src, 0, 0);
    return out;
  }

  const OFF8 = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]];
  const OFF4 = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  function person(palKey, dir, frame, variant) {
    const key = palKey + '|' + dir + '|' + frame + '|' + (variant || 'n');
    let hit = cache.get(key);
    if (hit) return hit;

    const p = PAL[palKey] || PAL.pass_m;
    const flip = dir === 'left';
    const d = (dir === 'left' || dir === 'right') ? 'side' : dir;

    tmpA.ctx.clearRect(0, 0, SW, SH);
    paintBody(tmpA.ctx, p, d, frame, variant);

    const out = outline(tmpA.canvas, OFF8);

    let fin = out.canvas;
    if (flip) {
      const fc = U.makeCanvas(SW, SH);
      fc.ctx.translate(SW, 0); fc.ctx.scale(-1, 1);
      fc.ctx.drawImage(out.canvas, 0, 0);
      fin = fc.canvas;
    }
    const rec = { canvas: fin, fx: FX, fy: FY, w: SW, h: SH };
    cache.set(key, rec);
    return rec;
  }

  /* =========================================================================
     시체 — 누운 몸 + 혈흔 웅덩이
     ========================================================================= */
  function corpse(palKey, seed) {
    const key = 'corpse|' + palKey + '|' + (seed % 3);
    let hit = cache.get(key);
    if (hit) return hit;
    const p = PAL[palKey] || PAL.pass_m;
    const v = seed % 3;

    tmpA.ctx.clearRect(0, 0, SW, SH);
    const c = tmpA.ctx, cy = FY - 5;

    // 혈흔 웅덩이 (몸보다 먼저 — 아래에 깔림)
    c.fillStyle = 'rgba(78,10,14,0.78)';
    c.beginPath(); c.ellipse(FX - 5, cy + 3, 11, 4.5, 0, 0, 7); c.fill();
    c.fillStyle = 'rgba(112,16,20,0.6)';
    c.beginPath(); c.ellipse(FX - 7, cy + 2, 6, 2.6, 0, 0, 7); c.fill();

    // 다리
    R(c, FX + 2, cy - 2, 8, 3, p.pants);
    R(c, FX + 2, cy + 1, 7, 3, p.pants2);
    R(c, FX + 9, cy - 2, 3, 3, p.shoes);
    R(c, FX + 8, cy + 1, 3, 3, U.shade(p.shoes, -10));

    // 몸통
    R(c, FX - 8, cy - 4, 11, 8, p.shirt);
    R(c, FX - 8, cy - 4, 11, 1, U.shade(p.shirt, 16));
    R(c, FX - 8, cy + 3, 11, 1, p.shirt2);
    if (p.jacketOn) { R(c, FX - 8, cy - 4, 11, 2, p.jacket); R(c, FX - 8, cy + 2, 11, 2, p.jacket2); }
    if (p.outfit === 'vest') { R(c, FX - 7, cy - 3, 9, 6, p.vest); R(c, FX - 7, cy - 1, 9, 1, p.vestBand); }

    // 팔 (바깥으로 벌어짐)
    R(c, FX - 6, cy + 4, 5, 3, p.shirt2);
    R(c, FX - 2, cy + 5, 3, 2, p.skin2);
    if (v !== 1) { R(c, FX - 5, cy - 8, 3, 5, p.shirt); R(c, FX - 5, cy - 10, 3, 3, p.skin); }

    // 머리 (옆으로 돌아감)
    R(c, FX - 15, cy - 4, 7, 7, p.skin);
    R(c, FX - 15, cy - 4, 7, 1, p.skin2);
    R(c, FX - 15, cy - 4, 7, 3, p.hair);
    R(c, FX - 15, cy - 1, 2, 4, p.hair);
    R(c, FX - 14, cy - 4, 4, 1, p.hairLit);
    R(c, FX - 11, cy, 1, 1, '#2a0d0f');                 // 감긴 눈
    R(c, FX - 12, cy + 2, 3, 1, p.skin2);

    // 피
    R(c, FX - 13, cy + 3, 4, 1, '#6e1319');
    R(c, FX - 10, cy + 4, 3, 1, '#4a0c10');
    if (v === 2) { R(c, FX - 7, cy - 5, 3, 1, '#7a1318'); R(c, FX - 4, cy - 2, 2, 2, '#5e0f14'); }

    const out = outline(tmpA.canvas, OFF4);
    const rec = { canvas: out.canvas, fx: FX, fy: FY, w: SW, h: SH };
    cache.set(key, rec);
    return rec;
  }

  /* =========================================================================
     무기 — 손에 든 모습 / 휘두르는 모습
     ctx는 호출자가 translate+rotate 해둔 상태. (0,0)=손, +x=앞쪽
     캐릭터가 커진 만큼 길이·두께를 약 25% 키웠다.
     ========================================================================= */
  const WEAPON_DRAW = {
    fists(c) {
      c.fillStyle = '#dcab7e'; c.fillRect(0, -2, 4, 4);
      c.fillStyle = '#b8835a'; c.fillRect(0, 1, 4, 1);
      c.fillStyle = '#8e6142'; c.fillRect(2, -1, 1, 3);
    },
    umbrella(c) {
      c.fillStyle = '#14161a'; c.fillRect(-3, -1, 20, 3);        // 샤프트
      c.fillStyle = '#272b33'; c.fillRect(-3, 0, 20, 1);
      c.fillStyle = '#2f3644'; c.fillRect(13, -4, 6, 7);         // 접힌 우산천
      c.fillStyle = '#434d60'; c.fillRect(14, -3, 5, 2);
      c.fillStyle = '#1b1f27'; c.fillRect(13, 2, 6, 1);
      c.fillStyle = '#6a5a3a'; c.fillRect(-6, -3, 4, 3);         // 손잡이
      c.fillStyle = '#8f7b4c'; c.fillRect(-7, -3, 2, 2);
    },
    pole(c) {
      c.fillStyle = '#8a9298'; c.fillRect(-4, -2, 25, 4);        // 스테인리스
      c.fillStyle = '#d2dade'; c.fillRect(-4, -2, 25, 1);
      c.fillStyle = '#545c62'; c.fillRect(-4, 1, 25, 1);
      c.fillStyle = '#3a4046'; c.fillRect(19, -3, 2, 6);
      c.fillStyle = '#2b2f34'; c.fillRect(-4, -2, 2, 4);
    },
    spear(c) {
      c.fillStyle = '#8a9298'; c.fillRect(-4, -2, 23, 4);
      c.fillStyle = '#d2dade'; c.fillRect(-4, -2, 23, 1);
      c.fillStyle = '#545c62'; c.fillRect(-4, 1, 23, 1);
      c.fillStyle = '#23402f'; c.fillRect(12, -2, 6, 4);         // 청테이프
      c.fillStyle = '#3f9a6c'; c.fillRect(12, -2, 6, 1);
      c.fillStyle = '#eef3f6'; c.fillRect(19, -2, 8, 3);         // 커터 날
      c.fillStyle = '#9aa4aa'; c.fillRect(19, 0, 8, 1);
      c.fillStyle = '#8e1219'; c.fillRect(24, -2, 3, 1);
    },
    extinguisher(c) {
      c.fillStyle = '#a3141c'; c.fillRect(0, -5, 10, 13);        // 몸통
      c.fillStyle = '#cf1e26'; c.fillRect(0, -5, 10, 4);
      c.fillStyle = '#5c0c11'; c.fillRect(0, 5, 10, 3);
      c.fillStyle = '#e4e8ec'; c.fillRect(2, -4, 6, 2);          // 라벨
      c.fillStyle = '#8e1219'; c.fillRect(3, -3, 4, 1);
      c.fillStyle = '#2a2e33'; c.fillRect(9, -8, 5, 4);          // 핸들
      c.fillStyle = '#161a1e'; c.fillRect(13, -7, 6, 3);         // 노즐
    },
    cutter(c) {
      c.fillStyle = '#d4ab2b'; c.fillRect(-2, -2, 8, 4);         // 손잡이
      c.fillStyle = '#f0cb4a'; c.fillRect(-2, -2, 8, 1);
      c.fillStyle = '#8a6c12'; c.fillRect(-2, 1, 8, 1);
      c.fillStyle = '#eef3f6'; c.fillRect(6, -1, 7, 3);          // 날
      c.fillStyle = '#9aa2a8'; c.fillRect(6, 1, 7, 1);
    },
    baton(c) {
      c.fillStyle = '#1a1d22'; c.fillRect(-4, -2, 21, 4);
      c.fillStyle = '#343a41'; c.fillRect(-4, -2, 21, 1);
      c.fillStyle = '#50565d'; c.fillRect(-6, -3, 4, 6);
      c.fillStyle = '#0e1114'; c.fillRect(15, -2, 2, 4);
    },
    bat(c) {
      c.fillStyle = '#6b4f30'; c.fillRect(-4, -2, 10, 4);
      c.fillStyle = '#8a6840'; c.fillRect(6, -3, 13, 6);
      c.fillStyle = '#ab8757'; c.fillRect(6, -3, 13, 1);
      c.fillStyle = '#4e3a22'; c.fillRect(6, 2, 13, 1);
      c.fillStyle = '#2e2a22'; c.fillRect(17, -3, 2, 6);
    }
  };

  function weapon(ctx, id, x, y, angle, flip) {
    const f = WEAPON_DRAW[id];
    if (!f) return;
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(angle || 0);
    if (flip) ctx.scale(1, -1);
    f(ctx);
    ctx.restore();
  }

  /* =========================================================================
     아이템 아이콘 (16x16)
     ========================================================================= */
  const iconCache = new Map();

  const ICON = {
    water(c) {
      c.fillStyle = '#9fd2e0'; c.fillRect(5, 4, 6, 10);
      c.fillStyle = '#c7e8f2'; c.fillRect(5, 4, 2, 10);
      c.fillStyle = '#6fa8b8'; c.fillRect(5, 12, 6, 2);
      c.fillStyle = '#2f6a7c'; c.fillRect(6, 1, 4, 3);
      c.fillStyle = '#e8edf0'; c.fillRect(4, 7, 8, 3);
      c.fillStyle = '#3f7f9c'; c.fillRect(5, 8, 6, 1);
    },
    banana_milk(c) {
      c.fillStyle = '#e8d87a'; c.fillRect(4, 3, 8, 11);
      c.fillStyle = '#f5ea9e'; c.fillRect(4, 3, 3, 11);
      c.fillStyle = '#b8a850'; c.fillRect(4, 12, 8, 2);
      c.fillStyle = '#d8c030'; c.fillRect(6, 1, 4, 2);
      c.fillStyle = '#8a7020'; c.fillRect(5, 6, 6, 1);
      c.fillStyle = '#fff'; c.fillRect(6, 8, 4, 2);
    },
    gimbap(c) {
      c.fillStyle = '#20242a'; c.beginPath(); c.moveTo(8, 2); c.lineTo(14, 13); c.lineTo(2, 13); c.closePath(); c.fill();
      c.fillStyle = '#2c3138'; c.beginPath(); c.moveTo(8, 3); c.lineTo(12, 11); c.lineTo(4, 11); c.closePath(); c.fill();
      c.fillStyle = '#f0ece0'; c.fillRect(6, 8, 4, 3);
      c.fillStyle = '#c9a227'; c.fillRect(7, 5, 2, 2);
      c.fillStyle = '#8e1219'; c.fillRect(2, 13, 12, 1);
    },
    chocopie(c) {
      c.fillStyle = '#3a2418'; c.fillRect(3, 5, 10, 7);
      c.fillStyle = '#4e3020'; c.fillRect(3, 5, 10, 2);
      c.fillStyle = '#f2ead8'; c.fillRect(4, 8, 8, 2);
      c.fillStyle = '#241408'; c.fillRect(3, 11, 10, 1);
      c.fillStyle = '#b5181f'; c.fillRect(2, 4, 12, 1);
    },
    bacchus(c) {
      c.fillStyle = '#8a6b22'; c.fillRect(6, 3, 5, 10);
      c.fillStyle = '#c9a227'; c.fillRect(6, 3, 2, 10);
      c.fillStyle = '#e8d87a'; c.fillRect(5, 6, 7, 4);
      c.fillStyle = '#5c3a0c'; c.fillRect(6, 6, 5, 1);
      c.fillStyle = '#9aa2a8'; c.fillRect(7, 1, 3, 2);
    },
    soju(c) {
      c.fillStyle = '#3f7f5c'; c.fillRect(6, 2, 4, 4);
      c.fillStyle = '#4f9f72'; c.fillRect(5, 5, 6, 9);
      c.fillStyle = '#7fc49a'; c.fillRect(5, 5, 2, 9);
      c.fillStyle = '#e8edf0'; c.fillRect(5, 8, 6, 3);
      c.fillStyle = '#2a5f44'; c.fillRect(6, 9, 4, 1);
      c.fillStyle = '#1f4a34'; c.fillRect(5, 13, 6, 1);
    },
    empty_bottle(c) {
      c.fillStyle = 'rgba(190,210,215,0.5)'; c.fillRect(5, 4, 6, 10);
      c.fillStyle = 'rgba(230,245,250,0.7)'; c.fillRect(5, 4, 2, 10);
      c.fillStyle = '#5a6268'; c.fillRect(6, 1, 4, 3);
      c.fillStyle = 'rgba(140,160,166,0.6)'; c.fillRect(5, 13, 6, 1);
    },
    bandage(c) {
      c.fillStyle = '#e4ddcc'; c.fillRect(2, 5, 12, 6);
      c.fillStyle = '#f2ece0'; c.fillRect(2, 5, 12, 2);
      c.fillStyle = '#c4bba6'; c.fillRect(2, 10, 12, 1);
      c.fillStyle = '#b5181f'; c.fillRect(6, 6, 4, 1); c.fillRect(7, 4, 2, 5);
      c.fillStyle = '#9a9280'; c.fillRect(2, 7, 1, 2); c.fillRect(13, 7, 1, 2);
    },
    bandage_clean(c) {
      ICON.bandage(c);
      c.fillStyle = '#5fa86b'; c.fillRect(2, 11, 12, 1);
      c.fillStyle = '#9bd6a5'; c.fillRect(11, 3, 3, 3);
    },
    tape(c) {
      c.fillStyle = '#2b6f4f'; c.beginPath(); c.arc(8, 8, 6, 0, 7); c.fill();
      c.fillStyle = '#3f9a6c'; c.beginPath(); c.arc(8, 8, 6, 3.4, 5.6); c.fill();
      c.fillStyle = '#0d0f12'; c.beginPath(); c.arc(8, 8, 2.4, 0, 7); c.fill();
      c.fillStyle = '#1f5c3f'; c.fillRect(11, 7, 4, 2);
    },
    magazine(c) {
      c.fillStyle = '#d8d4c8'; c.fillRect(3, 3, 10, 11);
      c.fillStyle = '#eae6da'; c.fillRect(3, 3, 10, 3);
      c.fillStyle = '#8e1219'; c.fillRect(4, 4, 6, 1);
      c.fillStyle = '#5d646b'; c.fillRect(4, 7, 8, 1); c.fillRect(4, 9, 8, 1); c.fillRect(4, 11, 6, 1);
      c.fillStyle = '#a8a496'; c.fillRect(3, 3, 1, 11);
    },
    cloth(c) {
      c.fillStyle = '#9fb4c0'; c.beginPath(); c.moveTo(8, 3); c.lineTo(13, 8); c.lineTo(8, 13); c.lineTo(3, 8); c.closePath(); c.fill();
      c.fillStyle = '#bdd0da'; c.beginPath(); c.moveTo(8, 3); c.lineTo(13, 8); c.lineTo(8, 8); c.closePath(); c.fill();
      c.fillStyle = '#6f8894'; c.fillRect(7, 7, 2, 2);
    },
    gasmask(c) {
      c.fillStyle = '#2b3038'; c.beginPath(); c.arc(8, 8, 6, 0, 7); c.fill();
      c.fillStyle = '#3a414b'; c.beginPath(); c.arc(8, 7, 5, 3.3, 6.1); c.fill();
      c.fillStyle = '#9fd2e0'; c.beginPath(); c.arc(6, 6, 1.8, 0, 7); c.fill();
      c.beginPath(); c.arc(11, 6, 1.8, 0, 7); c.fill();
      c.fillStyle = '#14161a'; c.beginPath(); c.arc(8, 11, 3, 0, 7); c.fill();
      c.fillStyle = '#5a6268'; c.beginPath(); c.arc(8, 11, 1.4, 0, 7); c.fill();
      c.fillStyle = '#c9a227'; c.fillRect(1, 5, 2, 2);
    },
    armguard(c) {
      c.fillStyle = '#c4bba6'; c.fillRect(4, 3, 8, 11);
      c.fillStyle = '#2b6f4f'; c.fillRect(4, 5, 8, 2); c.fillRect(4, 9, 8, 2);
      c.fillStyle = '#d8d4c8'; c.fillRect(4, 3, 8, 2);
      c.fillStyle = '#8e8574'; c.fillRect(4, 13, 8, 1);
      c.fillStyle = '#3f9a6c'; c.fillRect(4, 5, 8, 1);
    },
    umbrella(c) {
      c.fillStyle = '#2b3038'; c.beginPath(); c.moveTo(2, 7); c.quadraticCurveTo(8, 0, 14, 7); c.closePath(); c.fill();
      c.fillStyle = '#3a4150'; c.beginPath(); c.moveTo(5, 7); c.quadraticCurveTo(8, 1, 11, 7); c.closePath(); c.fill();
      c.fillStyle = '#14161a'; c.fillRect(7, 7, 2, 6);
      c.fillStyle = '#8a7648'; c.fillRect(7, 12, 4, 2);
    },
    pole(c) {
      c.fillStyle = '#8a9298'; c.fillRect(3, 11, 11, 3);
      c.fillStyle = '#c4ccd2'; c.fillRect(3, 11, 11, 1);
      c.save(); c.translate(8, 8); c.rotate(-0.7);
      c.fillStyle = '#9aa4aa'; c.fillRect(-7, -1, 14, 3);
      c.fillStyle = '#d2dade'; c.fillRect(-7, -1, 14, 1);
      c.restore();
    },
    spear(c) {
      c.save(); c.translate(8, 8); c.rotate(-0.72);
      c.fillStyle = '#8a9298'; c.fillRect(-8, -1, 13, 3);
      c.fillStyle = '#c4ccd2'; c.fillRect(-8, -1, 13, 1);
      c.fillStyle = '#2e3238'; c.fillRect(1, -1, 3, 3);
      c.fillStyle = '#e8edf0'; c.fillRect(5, -1, 5, 2);
      c.restore();
    },
    extinguisher(c) {
      c.fillStyle = '#8e1219'; c.fillRect(5, 4, 7, 10);
      c.fillStyle = '#b5181f'; c.fillRect(5, 4, 7, 3);
      c.fillStyle = '#5c0c11'; c.fillRect(5, 12, 7, 2);
      c.fillStyle = '#d9dde2'; c.fillRect(6, 7, 5, 2);
      c.fillStyle = '#2a2e33'; c.fillRect(6, 1, 3, 3);
      c.fillStyle = '#1a1d21'; c.fillRect(2, 2, 5, 2);
    },
    cutter(c) {
      c.save(); c.translate(8, 8); c.rotate(-0.7);
      c.fillStyle = '#c9a227'; c.fillRect(-7, -2, 9, 4);
      c.fillStyle = '#e0b93a'; c.fillRect(-7, -2, 9, 1);
      c.fillStyle = '#e8edf0'; c.fillRect(2, -2, 6, 3);
      c.fillStyle = '#9aa2a8'; c.fillRect(2, 0, 6, 1);
      c.restore();
    },
    phone(c) {
      c.fillStyle = '#14161a'; c.fillRect(5, 2, 7, 12);
      c.fillStyle = '#2c3138'; c.fillRect(5, 2, 7, 1);
      c.fillStyle = '#6fa8b8'; c.fillRect(6, 4, 5, 8);
      c.fillStyle = '#c7e8f2'; c.fillRect(6, 4, 5, 2);
      c.fillStyle = '#5d646b'; c.fillRect(7, 13, 3, 1);
    },
    fists(c) {
      c.fillStyle = '#dcab7e'; c.fillRect(4, 6, 8, 6);
      c.fillStyle = '#eebf90'; c.fillRect(4, 6, 8, 2);
      c.fillStyle = '#b8835a'; c.fillRect(4, 11, 8, 1);
      c.fillStyle = '#8e6142'; c.fillRect(6, 8, 1, 3); c.fillRect(9, 8, 1, 3);
    },
    baton(c) {
      c.save(); c.translate(8, 8); c.rotate(-0.7);
      c.fillStyle = '#1a1d22'; c.fillRect(-7, -1, 14, 3);
      c.fillStyle = '#2d3238'; c.fillRect(-7, -1, 14, 1);
      c.fillStyle = '#44494f'; c.fillRect(-8, -2, 3, 5);
      c.restore();
    },
    key(c) {
      c.fillStyle = '#c9a227'; c.beginPath(); c.arc(5, 6, 3, 0, 7); c.fill();
      c.fillStyle = '#0d0f12'; c.beginPath(); c.arc(5, 6, 1.2, 0, 7); c.fill();
      c.fillStyle = '#c9a227'; c.fillRect(5, 8, 2, 6); c.fillRect(7, 11, 3, 1); c.fillRect(7, 13, 2, 1);
    },
    note(c) {
      c.fillStyle = '#ded8c6'; c.fillRect(3, 2, 10, 12);
      c.fillStyle = '#efe9d8'; c.fillRect(3, 2, 10, 2);
      c.fillStyle = '#5d646b'; c.fillRect(5, 5, 6, 1); c.fillRect(5, 7, 6, 1); c.fillRect(5, 9, 4, 1);
      c.fillStyle = '#8e1219'; c.fillRect(5, 11, 3, 1);
    },
    bag(c) {
      c.fillStyle = '#4a3b32'; c.fillRect(3, 5, 10, 9);
      c.fillStyle = '#5c4a3e'; c.fillRect(3, 5, 10, 2);
      c.fillStyle = '#2e241e'; c.fillRect(3, 12, 10, 2);
      c.fillStyle = '#6f5a4a'; c.fillRect(6, 2, 4, 3);
      c.fillStyle = '#c9a227'; c.fillRect(7, 8, 2, 2);
    }
  };

  function icon(id) {
    let c = iconCache.get(id);
    if (c) return c;
    const o = U.makeCanvas(16, 16);
    const f = ICON[id];
    if (f) { f(o.ctx); } else {
      o.ctx.fillStyle = '#3a4046'; o.ctx.fillRect(3, 3, 10, 10);
      o.ctx.fillStyle = '#5d646b'; o.ctx.fillRect(4, 4, 8, 2);
      o.ctx.fillStyle = '#9aa0a6'; o.ctx.fillRect(7, 6, 2, 5);
    }
    iconCache.set(id, o.canvas);
    return o.canvas;
  }

  /** DOM 캔버스에 아이콘 렌더 (HUD/인벤토리용) */
  function paintIcon(domCanvas, id) {
    const c = domCanvas.getContext('2d');
    c.imageSmoothingEnabled = false;
    c.clearRect(0, 0, domCanvas.width, domCanvas.height);
    if (!id) return;
    c.drawImage(icon(id), 0, 0, 16, 16, 0, 0, domCanvas.width, domCanvas.height);
  }

  /* =========================================================================
     대화창 흉상 — 머리~어깨를 크게 확대
     ========================================================================= */
  function paintPortrait(domCanvas, palKey) {
    const c = domCanvas.getContext('2d');
    const W = domCanvas.width, H = domCanvas.height;
    c.imageSmoothingEnabled = false;
    c.clearRect(0, 0, W, H);

    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#171b21'); g.addColorStop(1, '#090b0e');
    c.fillStyle = g; c.fillRect(0, 0, W, H);

    if (palKey === 'narrator' || !PAL[palKey]) {
      c.fillStyle = '#5d646b';
      c.fillRect(W / 2 - 1, H * 0.3, 2, H * 0.28);
      c.fillRect(W / 2 - 1, H * 0.64, 2, 2);
      return;
    }

    const s = person(palKey, 'down', 0, 'n');
    // 원본 머리~가슴 영역 (x 7..25, y 1..21) → 캔버스에 꽉 채움
    const SX = 7, SY = 1, SWp = 18, SHp = 20;
    const scale = Math.floor(H / SHp) || 1;
    const dw = SWp * scale, dh = SHp * scale;
    c.imageSmoothingEnabled = false;
    c.drawImage(s.canvas, SX, SY, SWp, SHp, Math.round(W / 2 - dw / 2), Math.round(H - dh), dw, dh);

    const v = c.createRadialGradient(W / 2, H / 2, H * 0.22, W / 2, H / 2, H * 0.74);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.58)');
    c.fillStyle = v; c.fillRect(0, 0, W, H);
  }

  /* =========================================================================
     3x5 픽셀 숫자/기호
     ========================================================================= */
  const GLYPH = {
    '0': ['111', '101', '101', '101', '111'],
    '1': ['010', '110', '010', '010', '111'],
    '2': ['111', '001', '111', '100', '111'],
    '3': ['111', '001', '111', '001', '111'],
    '4': ['101', '101', '111', '001', '001'],
    '5': ['111', '100', '111', '001', '111'],
    '6': ['111', '100', '111', '101', '111'],
    '7': ['111', '001', '001', '001', '001'],
    '8': ['111', '101', '111', '101', '111'],
    '9': ['111', '101', '111', '001', '001'],
    '!': ['010', '010', '010', '000', '010'],
    '-': ['000', '000', '111', '000', '000'],
    '+': ['000', '010', '111', '010', '000'],
    '*': ['101', '010', '111', '010', '101'],
    'x': ['000', '101', '010', '101', '000']
  };

  /** 작은 숫자 텍스트를 (x,y) 중심에 그림 */
  function num(c, text, x, y, col, outline) {
    const s = String(text);
    const w = s.length * 4 - 1;
    let px = Math.round(x - w / 2), py = Math.round(y - 2.5);
    if (outline !== false) {
      c.fillStyle = 'rgba(0,0,0,0.85)';
      for (let i = 0; i < s.length; i++) {
        const g = GLYPH[s[i]]; if (!g) continue;
        for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) {
          if (g[r][q] === '1') c.fillRect(px + i * 4 + q - 1, py + r - 1, 3, 3);
        }
      }
    }
    c.fillStyle = col || '#fff';
    for (let i = 0; i < s.length; i++) {
      const g = GLYPH[s[i]]; if (!g) continue;
      for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) {
        if (g[r][q] === '1') c.fillRect(px + i * 4 + q, py + r, 1, 1);
      }
    }
  }

  return { PAL, person, corpse, weapon, WEAPON_DRAW, icon, paintIcon, paintPortrait, num,
           SW, SH, FX, FY };
})();
