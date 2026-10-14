/* =============================================================================
   DEAD:SEOUL — systems/fx.js
   파티클 · 혈흔 데칼 · 동적 라이팅(멀티플라이) · 연기 · 화면 흔들림 · 포스트 처리
   ============================================================================= */
'use strict';

DS.FX = (function () {

  const U = DS.U;
  const VW = DS.VIEW_W, VH = DS.VIEW_H;

  let parts = [];
  let nums = [];          // 데미지 숫자
  let shake = 0, shakeT = 0;
  let lightBuf = null, smokeBuf = null, grainTex = null;

  /* =========================================================================
     초기화
     ========================================================================= */
  function init() {
    lightBuf = U.makeCanvas(VW, VH);
    smokeBuf = U.makeCanvas(VW, VH);
    grainTex = makeGrain(96);
  }

  function makeGrain(size) {
    const g = U.makeCanvas(size, size);
    const img = g.ctx.createImageData(size, size);
    for (let i = 0; i < size * size; i++) {
      const v = (Math.random() * 255) | 0;
      img.data[i * 4] = v; img.data[i * 4 + 1] = v; img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 16;
    }
    g.ctx.putImageData(img, 0, 0);
    return g.canvas;
  }

  function reset() { parts.length = 0; nums.length = 0; shake = 0; }

  /* =========================================================================
     파티클
     ========================================================================= */
  function add(p) { if (parts.length < 520) parts.push(p); }

  /** 혈액 분출 — 월드 좌표, dir 라디안 */
  function blood(x, y, dir, power, big) {
    const n = big ? U.randInt(10, 16) : U.randInt(5, 9);
    for (let i = 0; i < n; i++) {
      const a = dir + U.rand(-0.7, 0.7);
      const sp = U.rand(28, 92) * (power || 1);
      add({
        t: 'blood', x, y, z: U.rand(3, 11),
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: U.rand(12, 46),
        life: U.rand(0.5, 1.1), age: 0,
        size: U.rand(0.8, 2.2), col: U.pick(['#8e1219', '#6e1319', '#a4121b', '#5e0f14'])
      });
    }
  }

  /** 금속/벽 타격 스파크 */
  function spark(x, y, dir) {
    for (let i = 0; i < U.randInt(4, 7); i++) {
      const a = dir + U.rand(-1.1, 1.1);
      add({
        t: 'spark', x, y, z: U.rand(4, 9),
        vx: Math.cos(a) * U.rand(40, 120), vy: Math.sin(a) * U.rand(40, 120), vz: U.rand(10, 40),
        life: U.rand(0.14, 0.3), age: 0, size: 1, col: U.pick(['#ffe9a8', '#ffd060', '#fff6d8'])
      });
    }
  }

  /** 발밑 먼지 */
  function dust(x, y, n) {
    for (let i = 0; i < (n || 2); i++) {
      add({
        t: 'dust', x: x + U.rand(-2, 2), y: y + U.rand(-1, 1), z: 1,
        vx: U.rand(-7, 7), vy: U.rand(-5, 5), vz: U.rand(2, 9),
        life: U.rand(0.3, 0.6), age: 0, size: U.rand(1, 2.2), col: 'rgba(170,176,180,0.35)'
      });
    }
  }

  /** 유리/파편 */
  function debris(x, y, col, n) {
    for (let i = 0; i < (n || 6); i++) {
      const a = U.rand(0, 6.28);
      add({
        t: 'chip', x, y, z: U.rand(2, 8),
        vx: Math.cos(a) * U.rand(20, 70), vy: Math.sin(a) * U.rand(20, 70), vz: U.rand(20, 55),
        life: U.rand(0.5, 1.0), age: 0, size: U.rand(1, 2), col: col || '#9aa4aa'
      });
    }
  }

  /** 소화기 분말 */
  function powder(x, y, dir, strength) {
    for (let i = 0; i < 14; i++) {
      const a = dir + U.rand(-0.42, 0.42);
      const sp = U.rand(60, 150) * (strength || 1);
      add({
        t: 'powder', x, y, z: U.rand(4, 10),
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: U.rand(-4, 10),
        life: U.rand(0.5, 1.2), age: 0, size: U.rand(2, 5), col: 'rgba(226,230,234,0.5)'
      });
    }
  }

  /** 연기 덩어리 (화재 이벤트) */
  function smokePuff(x, y, scale) {
    add({
      t: 'smoke', x, y, z: U.rand(2, 12),
      vx: U.rand(-26, -4), vy: U.rand(-8, 8), vz: U.rand(1, 5),
      life: U.rand(2.0, 3.6), age: 0,
      size: U.rand(3, 7) * (scale || 1), col: 'rgba(132,126,118,0.4)'
    });
  }

  /** 불씨 */
  function ember(x, y) {
    add({
      t: 'ember', x, y, z: U.rand(2, 12),
      vx: U.rand(-34, -6), vy: U.rand(-10, 10), vz: U.rand(6, 20),
      life: U.rand(0.8, 1.8), age: 0, size: 1, col: U.pick(['#ffb347', '#ff7a2f', '#ffd98a'])
    });
  }

  /** 떠오르는 숫자 */
  function dmgNum(x, y, text, col) {
    nums.push({ x, y, z: 14, text: String(text), col: col || '#fff', age: 0, life: 0.85, vz: 26 });
  }

  /* =========================================================================
     혈흔 데칼 (맵에 누적)
     ========================================================================= */
  function decalBlood(map, x, y, r, alpha) {
    const c = map.decalCtx;
    c.globalAlpha = alpha == null ? 0.5 : alpha;
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(96,12,17,0.95)');
    g.addColorStop(0.55, 'rgba(70,9,13,0.6)');
    g.addColorStop(1, 'rgba(50,6,9,0)');
    c.fillStyle = g;
    c.beginPath(); c.ellipse(x, y, r, r * 0.68, U.rand(0, 3.14), 0, 7); c.fill();
    // 튄 방울
    for (let i = 0; i < 5; i++) {
      c.fillStyle = 'rgba(86,10,15,0.55)';
      c.fillRect(Math.round(x + U.rand(-r, r)), Math.round(y + U.rand(-r * 0.8, r * 0.8)), 1, 1);
    }
    c.globalAlpha = 1;
  }

  function decalScuff(map, x, y, col) {
    const c = map.decalCtx;
    c.globalAlpha = 0.3;
    c.fillStyle = col || 'rgba(0,0,0,0.5)';
    c.fillRect(Math.round(x - 2), Math.round(y - 1), 4, 2);
    c.globalAlpha = 1;
  }

  /* =========================================================================
     업데이트
     ========================================================================= */
  function update(dt, map) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.age += dt;
      if (p.age >= p.life) { parts.splice(i, 1); continue; }

      if (p.t === 'smoke') {
        p.vx *= 0.995; p.vy *= 0.995;
        p.size += dt * 2.2;
      } else if (p.t === 'powder') {
        p.vx *= 0.9; p.vy *= 0.9; p.size += dt * 7;
      } else if (p.t === 'ember') {
        p.vz -= 6 * dt; p.vx *= 0.99;
      } else {
        p.vz -= 118 * dt;             // 중력
      }

      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;

      if (p.z <= 0 && (p.t === 'blood' || p.t === 'chip')) {
        p.z = 0; p.vz = 0; p.vx *= 0.3; p.vy *= 0.3;
        if (p.t === 'blood' && map && !p.landed) {
          p.landed = true;
          const c = map.decalCtx;
          c.globalAlpha = 0.6;
          c.fillStyle = p.col;
          c.fillRect(Math.round(p.x), Math.round(p.y), Math.max(1, p.size | 0), Math.max(1, (p.size * 0.7) | 0));
          c.globalAlpha = 1;
        }
      }
      // 벽 충돌 (간단 처리)
      if (map && (p.t === 'blood' || p.t === 'chip' || p.t === 'spark')) {
        if (map.blocked(p.x, p.y)) { p.vx *= -0.3; p.vy *= -0.3; p.x -= p.vx * dt; p.y -= p.vy * dt; }
      }
    }

    for (let i = nums.length - 1; i >= 0; i--) {
      const n = nums[i];
      n.age += dt; n.z += n.vz * dt; n.vz *= 0.9;
      if (n.age >= n.life) nums.splice(i, 1);
    }

    if (shake > 0) {
      shakeT += dt;
      shake = Math.max(0, shake - dt * 26);
    }
  }

  /* =========================================================================
     그리기
     ========================================================================= */
  /** 엔티티 아래 레이어 (바닥에 붙은 것들) */
  function drawBelow(c, camX, camY) {
    for (const p of parts) {
      if (p.z > 0.5) continue;
      const a = 1 - p.age / p.life;
      c.globalAlpha = U.clamp(a, 0, 1) * 0.8;
      c.fillStyle = p.col;
      c.fillRect(Math.round(p.x - camX), Math.round(p.y - camY), Math.max(1, p.size | 0), 1);
    }
    c.globalAlpha = 1;
  }

  /** 엔티티 위 레이어 */
  function drawAbove(c, camX, camY) {
    for (const p of parts) {
      const a = 1 - p.age / p.life;
      const sx = Math.round(p.x - camX), sy = Math.round(p.y - p.z - camY);

      // 연기/분말은 조명 뒤(위)에서 따로 그린다 — drawVolumetric()
      if (p.t === 'smoke' || p.t === 'powder') continue;
      if (p.z <= 0.5 && (p.t === 'blood' || p.t === 'chip')) continue;

      c.globalAlpha = U.clamp(a, 0, 1);
      c.fillStyle = p.col;
      const s = Math.max(1, Math.round(p.size));
      c.fillRect(sx, sy, s, s);
      if (p.t === 'spark' || p.t === 'ember') {
        c.globalAlpha = U.clamp(a * 0.4, 0, 1);
        c.fillRect(sx - 1, sy, s + 2, 1);
      }
    }
    c.globalAlpha = 1;

    for (const n of nums) {
      const a = 1 - Math.pow(n.age / n.life, 2.2);
      c.globalAlpha = U.clamp(a, 0, 1);
      DS.Gfx.num(c, n.text, n.x - camX, n.y - n.z - camY, n.col);
    }
    c.globalAlpha = 1;
  }

  /** 연기 / 분말 — 라이팅 이후에 그려야 빛에 먹히지 않는다 */
  function drawVolumetric(c, camX, camY) {
    for (const p of parts) {
      if (p.t !== 'smoke' && p.t !== 'powder') continue;
      const a = 1 - p.age / p.life;
      const sx = Math.round(p.x - camX), sy = Math.round(p.y - p.z - camY);
      // 연기는 생성/소멸 모두 서서히 — 가장자리가 자연스럽게 풀리도록
      const fade = p.t === 'smoke' ? Math.min(1, p.age / 0.6) * a * 0.2 : a * 0.75;
      c.globalAlpha = U.clamp(fade, 0, 1);
      c.fillStyle = p.col;
      c.beginPath(); c.arc(sx, sy, p.size, 0, 7); c.fill();
    }
    c.globalAlpha = 1;
  }

  /* =========================================================================
     라이팅
       ambient : 0(완전 암흑) ~ 1(전등 정상)
       lights  : [{x,y,r,col,int,flick}]
       cone    : {x,y,angle,range,spread,int} 플래시라이트
     ========================================================================= */
  function renderLights(c, camX, camY, ambient, lights, cone, t) {
    const lc = lightBuf.ctx;
    const base = Math.round(U.clamp(ambient, 0, 1) * 255);
    lc.globalCompositeOperation = 'source-over';
    // 암부는 완전 중성 회색이 아니라 약간 청록 — 형광등 꺼진 지하 느낌
    lc.fillStyle = `rgb(${Math.round(base * 0.92)},${Math.round(base * 1.0)},${Math.round(base * 1.1)})`;
    lc.fillRect(0, 0, VW, VH);
    lc.globalCompositeOperation = 'lighter';

    for (let i = 0; i < lights.length; i++) {
      const L = lights[i];
      if (L.int <= 0.001) continue;
      const sx = L.x - camX, sy = L.y - camY;
      if (sx < -L.r || sx > VW + L.r || sy < -L.r || sy > VH + L.r) continue;
      let k = L.int;
      if (L.flick) {
        // 형광등 깜빡임: 결정적 노이즈
        const n = Math.sin(t * 13.3 + i * 2.7) * Math.sin(t * 4.1 + i) ;
        k *= 0.72 + 0.28 * n + (Math.random() < 0.012 ? -0.7 : 0);
        k = Math.max(0, k);
      }
      const g = lc.createRadialGradient(sx, sy, 0, sx, sy, L.r);
      const col = L.col || '#ffffff';
      g.addColorStop(0, hexA(col, 0.95 * k));
      g.addColorStop(0.45, hexA(col, 0.42 * k));
      g.addColorStop(1, hexA(col, 0));
      lc.fillStyle = g;
      lc.beginPath(); lc.arc(sx, sy, L.r, 0, 7); lc.fill();
    }

    // 플래시라이트 (부채꼴)
    if (cone && cone.int > 0.01) {
      const sx = cone.x - camX, sy = cone.y - camY;
      const g = lc.createRadialGradient(sx, sy, 2, sx, sy, cone.range);
      g.addColorStop(0, hexA('#e6f0f5', 0.9 * cone.int));
      g.addColorStop(0.35, hexA('#dfe9f0', 0.5 * cone.int));
      g.addColorStop(1, hexA('#dfe9f0', 0));
      lc.fillStyle = g;
      lc.beginPath();
      lc.moveTo(sx, sy);
      lc.arc(sx, sy, cone.range, cone.angle - cone.spread / 2, cone.angle + cone.spread / 2);
      lc.closePath(); lc.fill();
      // 손 주변 근접광
      const g2 = lc.createRadialGradient(sx, sy, 0, sx, sy, 22);
      g2.addColorStop(0, hexA('#dfe9f0', 0.42 * cone.int));
      g2.addColorStop(1, hexA('#dfe9f0', 0));
      lc.fillStyle = g2;
      lc.beginPath(); lc.arc(sx, sy, 22, 0, 7); lc.fill();
    }

    lc.globalCompositeOperation = 'source-over';

    c.globalCompositeOperation = 'multiply';
    c.drawImage(lightBuf.canvas, 0, 0);
    c.globalCompositeOperation = 'source-over';
  }

  function hexA(hex, a) {
    if (hex[0] !== '#') return hex;
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${U.clamp(a, 0, 1)})`;
  }

  /* =========================================================================
     포스트 처리 — 연기 틴트 / 비네트 / 그레인 / 피격 / 심박
     ========================================================================= */
  function post(c, t, s) {
    // 연기 틴트 — 연기는 빛을 산란시키므로 "어둡게"가 아니라 "뿌옇게"
    if (s.smoke > 0.01) {
      c.globalAlpha = U.clamp(s.smoke * 0.3, 0, 0.36);
      c.fillStyle = '#6b6560';
      c.fillRect(0, 0, VW, VH);
      c.globalAlpha = U.clamp(s.smoke * 0.14, 0, 0.18);
      c.fillStyle = '#1b1a19';
      c.fillRect(0, 0, VW, VH);
      c.globalAlpha = 1;
    }

    // 비네트
    const g = c.createRadialGradient(VW / 2, VH / 2, VH * 0.26, VW / 2, VH / 2, VH * 0.92);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(0,0,0,${0.42 + (s.lowHp || 0) * 0.3})`);
    c.fillStyle = g; c.fillRect(0, 0, VW, VH);

    // 저체력 적색 펄스
    if (s.lowHp > 0.01) {
      const pulse = 0.5 + 0.5 * Math.sin(t * 5.4);
      c.globalAlpha = s.lowHp * 0.26 * pulse;
      c.fillStyle = '#7a0d12';
      c.fillRect(0, 0, VW, VH);
      c.globalAlpha = 1;
    }

    // 방독면 착용 시 시야 제한
    if (s.mask) {
      const m = c.createRadialGradient(VW / 2, VH / 2, VH * 0.2, VW / 2, VH / 2, VH * 0.6);
      m.addColorStop(0, 'rgba(0,0,0,0)');
      m.addColorStop(0.8, 'rgba(0,0,0,0.3)');
      m.addColorStop(1, 'rgba(0,0,0,0.78)');
      c.fillStyle = m; c.fillRect(0, 0, VW, VH);
    }

    // 필름 그레인
    c.globalAlpha = 0.16;
    const ox = (Math.random() * 64) | 0, oy = (Math.random() * 64) | 0;
    for (let y = -oy; y < VH; y += 96) for (let x = -ox; x < VW; x += 96) c.drawImage(grainTex, x, y);
    c.globalAlpha = 1;

    // 주사선
    c.globalAlpha = 0.05;
    c.fillStyle = '#000';
    for (let y = 0; y < VH; y += 3) c.fillRect(0, y, VW, 1);
    c.globalAlpha = 1;
  }

  /* =========================================================================
     화면 흔들림
     ========================================================================= */
  function doShake(amt) { shake = Math.max(shake, amt); }
  function shakeOffset() {
    if (shake <= 0) return { x: 0, y: 0 };
    return {
      x: (Math.random() * 2 - 1) * shake,
      y: (Math.random() * 2 - 1) * shake
    };
  }

  return {
    init, reset, update, drawBelow, drawAbove, drawVolumetric, renderLights, post,
    blood, spark, dust, debris, powder, smokePuff, ember, dmgNum,
    decalBlood, decalScuff, doShake, shakeOffset,
    get count() { return parts.length; },
    get shakeAmt() { return shake; }
  };
})();
