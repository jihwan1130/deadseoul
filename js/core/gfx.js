/* =============================================================================
   DEAD:SEOUL — core/gfx.js
   픽셀 아트를 코드로 생성. 외부 이미지 에셋 0개.
     · PAL          : 캐릭터 팔레트 (도윤/민서/승객/좀비 변종)
     · person()     : 캐릭터 스프라이트 (팔레트×방향×프레임×변종 캐시)
     · corpse()     : 시체 스프라이트
     · weapon()     : 손에 든/휘두르는 무기
     · icon()       : 아이템 아이콘 16x16
     · portrait()   : 대화창 흉상 64x64
     · num()        : 3x5 픽셀 숫자 (데미지 표시)
   ============================================================================= */
'use strict';

DS.Gfx = (function () {

  const U = DS.U;
  const OUTLINE = 'rgba(5,6,9,0.92)';

  /* =========================================================================
     팔레트
     ========================================================================= */
  const PAL = {
    // 주인공: 야근 중인 직장인. 흰 와이셔츠 + 사원증 + 넥타이 풀림
    doyun: {
      hair: '#17130f', hair2: '#241d16', skin: '#c89d78', skin2: '#a87d5c',
      shirt: '#cfd4da', shirt2: '#a9b0b8', pants: '#2b303a', pants2: '#1d2128',
      shoes: '#15171b', accent: '#7a2b2b', tag: '#d8c54a'
    },
    // 민서: 대학생. 후드 + 백팩
    minseo: {
      hair: '#2a1d16', hair2: '#3a281d', skin: '#d2a984', skin2: '#b2886a',
      shirt: '#5c6f74', shirt2: '#45545a', pants: '#3b3f49', pants2: '#2b2e36',
      shoes: '#d8d4cc', accent: '#c75b4a', tag: null
    },
    pass_m: {
      hair: '#1b1611', hair2: '#272019', skin: '#c49a76', skin2: '#a47a58',
      shirt: '#6a7480', shirt2: '#505a66', pants: '#23262d', pants2: '#191b20',
      shoes: '#14161a', accent: '#394452', tag: null
    },
    pass_f: {
      hair: '#241a14', hair2: '#33251b', skin: '#d0a582', skin2: '#ae8363',
      shirt: '#9a6b72', shirt2: '#7a5057', pants: '#2e2a33', pants2: '#201d25',
      shoes: '#2a2228', accent: '#5a3a42', tag: null
    },
    // 좀비 변종 — 창백한 피부 + 혈흔
    z_office: {
      hair: '#1a1713', hair2: '#262119', skin: '#93a089', skin2: '#6f7c69',
      shirt: '#b3b7b2', shirt2: '#8b9091', pants: '#2a2d35', pants2: '#1c1f25',
      shoes: '#14161a', accent: '#6e1319', tag: '#9a8e3a', zombie: true
    },
    z_student: {
      hair: '#120f0d', hair2: '#1d1915', skin: '#9aa692', skin2: '#74806d',
      shirt: '#2b3450', shirt2: '#1f2740', pants: '#20263a', pants2: '#171c2c',
      shoes: '#1a1c20', accent: '#7a1318', tag: null, zombie: true
    },
    z_elder: {
      hair: '#b9b4ac', hair2: '#8f8a82', skin: '#8f9c88', skin2: '#6b7765',
      shirt: '#7e5a3e', shirt2: '#5f432d', pants: '#4a4335', pants2: '#352f26',
      shoes: '#23201a', accent: '#6b1116', tag: null, zombie: true
    },
    z_staff: { // 역무원/기관사
      hair: '#161310', hair2: '#211d18', skin: '#8e9c88', skin2: '#6a7764',
      shirt: '#2f4a63', shirt2: '#22374a', pants: '#232a33', pants2: '#191e25',
      shoes: '#15171b', accent: '#7d1419', tag: '#cfd4da', zombie: true
    }
  };

  /* =========================================================================
     캐릭터 스프라이트
     ========================================================================= */
  const SW = 24, SH = 26, FX = 12, FY = 22;   // 캔버스 규격 / 발 기준점
  const cache = new Map();
  const tmpA = U.makeCanvas(SW, SH);
  const tmpB = U.makeCanvas(SW, SH);

  function R(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(x | 0, y | 0, w | 0, h | 0); }

  /**
   * 몸통 페인팅 (아웃라인 없는 원본)
   * dir은 'down' | 'up' | 'side' (side는 오른쪽 기준, left는 플립)
   */
  function paintBody(c, p, dir, frame, variant) {
    const z = !!p.zombie;
    const f1 = frame === 1, f3 = frame === 3;
    const bob = (f1 || f3) ? -1 : 0;
    const side = dir === 'side';
    const up = dir === 'up';

    // --- 다리 ---
    const lx = side ? FX - 2 : FX - 3, rx = side ? FX : FX + 1;
    const lDy = f1 ? -1 : 0, rDy = f3 ? -1 : 0;
    const legH = 5;
    // 좀비는 한쪽을 끌어 — 오른다리 1px 낮고 바깥으로
    const zLimp = z ? 1 : 0;
    R(c, lx + (f1 ? -1 : 0), FY - legH + lDy, 2, legH - lDy, p.pants);
    R(c, rx + (f3 ? 1 : 0) + zLimp, FY - legH + rDy, 2, legH - rDy + zLimp, p.pants2);
    // 신발
    R(c, lx + (f1 ? -1 : 0), FY - 1 + lDy, 2, 1, p.shoes);
    R(c, rx + (f3 ? 1 : 0) + zLimp, FY - 1 + rDy + zLimp, 2, 1, p.shoes);

    // --- 몸통 ---
    const tw = side ? 6 : 8;
    const tx = FX - (side ? 3 : 4);
    const ty = FY - 12 + bob;
    R(c, tx, ty, tw, 7, p.shirt);
    // 어깨 하이라이트 / 아래 음영
    R(c, tx, ty, tw, 1, U.shade(p.shirt, 14));
    R(c, tx, ty + 6, tw, 1, p.shirt2);
    if (side) R(c, tx, ty, 1, 7, p.shirt2);

    // 옷 디테일
    if (!up) {
      if (p === PAL.doyun || p === PAL.z_office || p === PAL.z_staff) {
        // 와이셔츠 깃 + 풀린 넥타이
        R(c, FX - 1, ty, 2, 1, U.shade(p.shirt, 26));
        if (!side) {
          R(c, FX - 1, ty + 1, 1, 3, p.accent);
          R(c, FX - 1, ty + 4, 2, 2, U.shade(p.accent, -18));
        } else {
          R(c, FX, ty + 1, 1, 4, p.accent);
        }
        if (p.tag) { // 사원증 목걸이
          R(c, FX + (side ? 1 : 2), ty + 4, 2, 2, p.tag);
          R(c, FX + (side ? 1 : 2), ty + 3, 2, 1, '#2a2e33');
        }
      } else if (p === PAL.minseo) {
        R(c, FX - 2, ty + 1, 4, 1, U.shade(p.shirt, -16)); // 후드 끈
        R(c, FX - 1, ty + 2, 1, 3, '#d9d2c4');
        R(c, FX + 1, ty + 2, 1, 2, '#d9d2c4');
      } else if (p === PAL.z_student) {
        R(c, FX - 1, ty + 1, 2, 4, '#c9ccd4'); // 교복 셔츠
      }
    } else {
      if (p.tag === '#cfd4da') R(c, tx + 1, ty + 2, tw - 2, 2, U.shade(p.shirt, 18)); // 등 반사띠
      if (p === PAL.minseo) { R(c, tx, ty, tw, 5, '#4a3b32'); R(c, tx + 1, ty + 1, tw - 2, 3, '#5c4a3e'); } // 백팩
    }

    // 좀비: 찢어진 옷 + 혈흔
    if (z) {
      R(c, tx + (side ? 3 : 5), ty + 3, 2, 3, p.skin2);
      R(c, tx + 1, ty + 4, 2, 2, '#5e0f14');
      R(c, tx + (side ? 2 : 3), ty + 2, 1, 1, '#7a1318');
      R(c, tx, ty + 6, 2, 1, '#4a0c10');
    }

    // --- 팔 ---
    const reach = variant === 'reach';
    const armY = ty + 1;
    if (reach && !up) {
      // 앞으로 뻗은 두 팔 (좀비 공격 자세)
      if (side) {
        R(c, tx + 5, armY + 1, 5, 2, p.shirt2);
        R(c, tx + 9, armY + 1, 2, 2, p.skin);
        R(c, tx + 5, armY + 3, 4, 2, p.shirt);
        R(c, tx + 8, armY + 3, 2, 2, p.skin2);
      } else {
        R(c, tx - 1, armY + 3, 3, 4, p.shirt2);
        R(c, tx + tw - 2, armY + 3, 3, 4, p.shirt2);
        R(c, tx - 1, armY + 6, 3, 2, p.skin);
        R(c, tx + tw - 2, armY + 6, 3, 2, p.skin);
      }
    } else {
      const laDy = f3 ? -1 : 0, raDy = f1 ? -1 : 0;
      if (side) {
        R(c, tx + tw - 1, armY + laDy, 2, 6, p.shirt);          // 앞팔
        R(c, tx + tw - 1, armY + 5 + laDy, 2, 2, p.skin);       // 손
        R(c, tx - 1, armY + raDy, 2, 5, p.shirt2);              // 뒷팔
      } else {
        R(c, tx - 2, armY + laDy, 2, 6, p.shirt);
        R(c, tx + tw, armY + raDy, 2, 6, p.shirt);
        R(c, tx - 2, armY + 5 + laDy, 2, 2, p.skin);
        R(c, tx + tw, armY + 5 + raDy, 2, 2, p.skin);
      }
    }

    // --- 머리 ---
    const hx = FX - 3 + (side ? 1 : 0) + (z ? (side ? 0 : 1) : 0);
    const hy = FY - 18 + bob + (z ? 1 : 0);
    R(c, FX - 1, hy + 5, 2, 2, p.skin2);                  // 목
    R(c, hx, hy, 6, 6, p.skin);                            // 얼굴
    R(c, hx, hy, 6, 1, p.skin2);
    if (up) {
      R(c, hx, hy, 6, 5, p.hair);
      R(c, hx + 1, hy, 4, 1, p.hair2);
      R(c, hx, hy + 5, 6, 1, p.skin2);
    } else if (side) {
      R(c, hx, hy, 6, 2, p.hair);                          // 윗머리
      R(c, hx, hy, 2, 5, p.hair);                          // 뒤통수
      R(c, hx + 1, hy, 3, 1, p.hair2);
      R(c, hx + 4, hy + 2, 1, 1, z ? '#2a0d0f' : '#1a1512'); // 눈
      R(c, hx + 5, hy + 4, 1, 1, p.skin2);                 // 입/턱 음영
    } else {
      R(c, hx, hy, 6, 2, p.hair);
      R(c, hx, hy, 1, 4, p.hair);
      R(c, hx + 5, hy, 1, 4, p.hair);
      R(c, hx + 1, hy, 4, 1, p.hair2);
      R(c, hx + 1, hy + 3, 1, 1, z ? '#2a0d0f' : '#1a1512'); // 눈
      R(c, hx + 4, hy + 3, 1, 1, z ? '#2a0d0f' : '#1a1512');
      if (z) {
        R(c, hx + 2, hy + 5, 2, 1, '#5e0f14');             // 피 묻은 입
        R(c, hx + 1, hy + 2, 1, 1, '#6e1319');
      } else {
        R(c, hx + 2, hy + 5, 2, 1, p.skin2);
      }
    }
    if (p === PAL.minseo && !up) {                         // 긴 머리
      R(c, hx - 1, hy + 1, 1, 5, p.hair);
      R(c, hx + 6, hy + 1, 1, 5, p.hair);
    }
    if (z) R(c, hx + (side ? 0 : 4), hy + 1, 1, 2, '#4a0c10'); // 머리 혈흔
  }

  /** 아웃라인 적용 + 캐시 */
  function person(palKey, dir, frame, variant) {
    const key = palKey + '|' + dir + '|' + frame + '|' + (variant || 'n');
    let hit = cache.get(key);
    if (hit) return hit;

    const p = PAL[palKey] || PAL.pass_m;
    const flip = dir === 'left';
    const d = (dir === 'left' || dir === 'right') ? 'side' : dir;

    tmpA.ctx.clearRect(0, 0, SW, SH);
    paintBody(tmpA.ctx, p, d, frame, variant);

    // 실루엣
    tmpB.ctx.clearRect(0, 0, SW, SH);
    tmpB.ctx.globalCompositeOperation = 'source-over';
    tmpB.ctx.drawImage(tmpA.canvas, 0, 0);
    tmpB.ctx.globalCompositeOperation = 'source-in';
    tmpB.ctx.fillStyle = OUTLINE;
    tmpB.ctx.fillRect(0, 0, SW, SH);
    tmpB.ctx.globalCompositeOperation = 'source-over';

    const out = U.makeCanvas(SW, SH);
    const o = out.ctx;
    const off = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]];
    for (const [dx, dy] of off) o.drawImage(tmpB.canvas, dx, dy);
    o.drawImage(tmpA.canvas, 0, 0);

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

  /** 시체 (누운 자세) */
  function corpse(palKey, seed) {
    const key = 'corpse|' + palKey + '|' + (seed % 3);
    let hit = cache.get(key);
    if (hit) return hit;
    const p = PAL[palKey] || PAL.pass_m;
    const v = seed % 3;

    tmpA.ctx.clearRect(0, 0, SW, SH);
    const c = tmpA.ctx, cy = FY - 3;
    // 몸통 (가로로 누움)
    R(c, FX - 7, cy - 2, 9, 5, p.shirt);
    R(c, FX - 7, cy + 2, 9, 1, p.shirt2);
    R(c, FX - 7, cy - 2, 9, 1, U.shade(p.shirt, 12));
    // 다리
    R(c, FX + 2, cy - 1, 6, 2, p.pants);
    R(c, FX + 2, cy + 1, 5, 2, p.pants2);
    R(c, FX + 7, cy - 1, 2, 2, p.shoes);
    R(c, FX + 6, cy + 1, 2, 2, p.shoes);
    // 팔
    R(c, FX - 5, cy + 3, 4, 2, p.shirt2);
    R(c, FX - 2, cy + 4, 2, 2, p.skin);
    if (v !== 1) { R(c, FX - 4, cy - 5, 2, 4, p.shirt); R(c, FX - 4, cy - 6, 2, 2, p.skin); }
    // 머리
    R(c, FX - 11, cy - 2, 5, 5, p.skin);
    R(c, FX - 11, cy - 2, 5, 2, p.hair);
    R(c, FX - 11, cy, 1, 3, p.hair);
    R(c, FX - 8, cy + 1, 1, 1, '#2a0d0f');
    // 혈흔
    R(c, FX - 9, cy + 3, 3, 1, '#5e0f14');
    if (v === 2) R(c, FX - 6, cy - 3, 2, 1, '#6e1319');

    tmpB.ctx.clearRect(0, 0, SW, SH);
    tmpB.ctx.drawImage(tmpA.canvas, 0, 0);
    tmpB.ctx.globalCompositeOperation = 'source-in';
    tmpB.ctx.fillStyle = OUTLINE; tmpB.ctx.fillRect(0, 0, SW, SH);
    tmpB.ctx.globalCompositeOperation = 'source-over';

    const out = U.makeCanvas(SW, SH);
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) out.ctx.drawImage(tmpB.canvas, dx, dy);
    out.ctx.drawImage(tmpA.canvas, 0, 0);

    const rec = { canvas: out.canvas, fx: FX, fy: FY, w: SW, h: SH };
    cache.set(key, rec);
    return rec;
  }

  /* =========================================================================
     무기 — 손에 든 모습 / 휘두르는 모습
     ctx는 호출자가 translate+rotate 해둔 상태. (0,0)=손, +x=앞쪽
     ========================================================================= */
  const WEAPON_DRAW = {
    fists(c) {
      c.fillStyle = '#c89d78'; c.fillRect(0, -1, 3, 3);
      c.fillStyle = '#a87d5c'; c.fillRect(0, 1, 3, 1);
    },
    umbrella(c) {
      c.fillStyle = '#14161a'; c.fillRect(-2, -1, 16, 2);      // 샤프트
      c.fillStyle = '#23262c'; c.fillRect(-2, 0, 16, 1);
      c.fillStyle = '#2b3038'; c.fillRect(10, -3, 5, 5);        // 접힌 우산천
      c.fillStyle = '#3a4150'; c.fillRect(11, -2, 4, 1);
      c.fillStyle = '#6a5a3a'; c.fillRect(-4, -2, 3, 2);        // 손잡이
      c.fillStyle = '#8a7648'; c.fillRect(-5, -2, 2, 1);
    },
    pole(c) {
      c.fillStyle = '#8a9298'; c.fillRect(-3, -1, 20, 3);       // 스테인리스
      c.fillStyle = '#c4ccd2'; c.fillRect(-3, -1, 20, 1);
      c.fillStyle = '#5a6268'; c.fillRect(-3, 1, 20, 1);
      c.fillStyle = '#3a4046'; c.fillRect(15, -2, 2, 4);
    },
    spear(c) {
      c.fillStyle = '#8a9298'; c.fillRect(-3, -1, 19, 3);
      c.fillStyle = '#c4ccd2'; c.fillRect(-3, -1, 19, 1);
      c.fillStyle = '#2e3238'; c.fillRect(10, -1, 4, 3);        // 청테이프 감은 부분
      c.fillStyle = '#4a5054'; c.fillRect(10, -1, 4, 1);
      c.fillStyle = '#dfe6ea'; c.fillRect(16, -1, 6, 2);        // 커터 날
      c.fillStyle = '#9aa4aa'; c.fillRect(16, 0, 6, 1);
      c.fillStyle = '#7a1318'; c.fillRect(20, -1, 2, 1);
    },
    extinguisher(c) {
      c.fillStyle = '#8e1219'; c.fillRect(0, -4, 8, 10);        // 몸통
      c.fillStyle = '#b5181f'; c.fillRect(0, -4, 8, 3);
      c.fillStyle = '#5c0c11'; c.fillRect(0, 4, 8, 2);
      c.fillStyle = '#d9dde2'; c.fillRect(2, -4, 4, 1);         // 라벨
      c.fillStyle = '#2a2e33'; c.fillRect(7, -6, 4, 3);         // 핸들
      c.fillStyle = '#1a1d21'; c.fillRect(10, -5, 5, 2);        // 노즐
    },
    cutter(c) {
      c.fillStyle = '#c9a227'; c.fillRect(-1, -1, 6, 3);        // 손잡이
      c.fillStyle = '#e0b93a'; c.fillRect(-1, -1, 6, 1);
      c.fillStyle = '#e8edf0'; c.fillRect(5, -1, 5, 2);         // 날
      c.fillStyle = '#9aa2a8'; c.fillRect(5, 0, 5, 1);
    },
    baton(c) {
      c.fillStyle = '#1a1d22'; c.fillRect(-3, -1, 17, 3);
      c.fillStyle = '#2d3238'; c.fillRect(-3, -1, 17, 1);
      c.fillStyle = '#44494f'; c.fillRect(-4, -2, 3, 4);
    },
    bat(c) {
      c.fillStyle = '#6b4f30'; c.fillRect(-3, -1, 8, 3);
      c.fillStyle = '#8a6840'; c.fillRect(5, -2, 10, 5);
      c.fillStyle = '#a07e52'; c.fillRect(5, -2, 10, 1);
      c.fillStyle = '#2e2a22'; c.fillRect(13, -2, 2, 5);
    }
  };

  function weapon(ctx, id, x, y, angle, flip) {
    const f = WEAPON_DRAW[id];
    if (!f) return;
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(angle || 0);
    if (flip) ctx.scale(1, -1);
    // 어두운 테두리 (8방향 오프셋은 과하므로 4방향)
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.restore();
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
      c.fillStyle = '#c89d78'; c.fillRect(4, 6, 8, 6);
      c.fillStyle = '#d8ad88'; c.fillRect(4, 6, 8, 2);
      c.fillStyle = '#a87d5c'; c.fillRect(4, 11, 8, 1);
      c.fillStyle = '#8a6347'; c.fillRect(6, 8, 1, 3); c.fillRect(9, 8, 1, 3);
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
     대화창 흉상
     ========================================================================= */
  function paintPortrait(domCanvas, palKey) {
    const c = domCanvas.getContext('2d');
    const W = domCanvas.width, H = domCanvas.height;
    c.imageSmoothingEnabled = false;
    c.clearRect(0, 0, W, H);
    // 배경
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#15181d'); g.addColorStop(1, '#0a0c0f');
    c.fillStyle = g; c.fillRect(0, 0, W, H);

    if (palKey === 'narrator' || !PAL[palKey]) {
      c.fillStyle = '#5d646b';
      c.fillRect(W / 2 - 1, H * 0.3, 2, H * 0.28);
      c.fillRect(W / 2 - 1, H * 0.64, 2, 2);
      return;
    }
    // 머리~어깨를 확대해 흉상처럼
    const s = person(palKey, 'down', 0, 'n');
    c.save();
    c.imageSmoothingEnabled = false;
    // 원본 영역 (x 5..19, y 2..18) → 캔버스 전체에 꽉 채움
    c.drawImage(s.canvas, 5, 2, 14, 16, Math.round(W / 2 - 28), 4, 56, 64);
    c.restore();
    // 비네트
    const v = c.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.72);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)');
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
