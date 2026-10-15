/* =============================================================================
   DEAD:SEOUL — core/utils.js
   전역 네임스페이스와 수학/보조 유틸
   ============================================================================= */
'use strict';

window.DS = window.DS || {};

DS.TILE = 16;          // 타일 한 변 (px, 월드 단위 == 픽셀)
DS.VIEW_W = 320;       // 렌더 버퍼 해상도 (16:9)
DS.VIEW_H = 180;

DS.U = (function () {

  const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const sign = (v) => v < 0 ? -1 : (v > 0 ? 1 : 0);

  /** 프레임 독립적으로 a를 b에 접근시킴 (지수 감쇠) */
  function damp(a, b, rate, dt) {
    return b + (a - b) * Math.exp(-rate * dt);
  }

  /** a를 b쪽으로 step만큼 (오버슈트 없이) */
  function approach(a, b, step) {
    if (a < b) return Math.min(a + step, b);
    return Math.max(a - step, b);
  }

  const dist2 = (ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; };
  const dist = (ax, ay, bx, by) => Math.sqrt(dist2(ax, ay, bx, by));

  /** -PI..PI 로 정규화 */
  function wrapAngle(a) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  }
  const angleDiff = (a, b) => Math.abs(wrapAngle(a - b));

  function aabb(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  /** mulberry32 — 결정적 난수 (맵 텍스처 베이킹에 사용) */
  function rng(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const rand = (a, b) => a + Math.random() * (b - a);
  const randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  const chance = (p) => Math.random() < p;
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  /** 8방향 → 4방향 스프라이트 키 */
  function dirFromVec(dx, dy) {
    if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 'left' : 'right';
    return dy < 0 ? 'up' : 'down';
  }

  /** 임의 각도를 8방향 격자에 스냅 — 키보드 조준을 또렷하게 유지한다 */
  function snapAngle8(a) {
    const step = Math.PI / 4;
    return wrapAngle(Math.round(wrapAngle(a) / step) * step);
  }

  /** a를 b쪽으로 최단호 회전 (프레임 독립) */
  function rotToward(a, b, rate, dt) {
    const d = wrapAngle(b - a);
    return wrapAngle(a + d * (1 - Math.exp(-rate * dt)));
  }

  function dirFromAngle(a) {
    const d = wrapAngle(a);
    if (d >= -Math.PI / 4 && d < Math.PI / 4) return 'right';
    if (d >= Math.PI / 4 && d < 3 * Math.PI / 4) return 'down';
    if (d < -Math.PI / 4 && d >= -3 * Math.PI / 4) return 'up';
    return 'left';
  }

  /** 색상 유틸: '#rrggbb' → 밝기 조절 */
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = clamp(Math.round(r + amt), 0, 255);
    g = clamp(Math.round(g + amt), 0, 255);
    b = clamp(Math.round(b + amt), 0, 255);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }

  function mix(hexA, hexB, t) {
    const a = parseInt(hexA.slice(1), 16), b = parseInt(hexB.slice(1), 16);
    const r = Math.round(lerp((a >> 16) & 255, (b >> 16) & 255, t));
    const g = Math.round(lerp((a >> 8) & 255, (b >> 8) & 255, t));
    const bl = Math.round(lerp(a & 255, b & 255, t));
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
  }

  /** 오프스크린 캔버스 */
  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    return { canvas: c, ctx: x, w, h };
  }

  /** 아주 단순한 이벤트 버스 */
  function bus() {
    const map = new Map();
    return {
      on(k, fn) { (map.get(k) || map.set(k, []).get(k)).push(fn); return fn; },
      off(k, fn) { const a = map.get(k); if (a) { const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); } },
      emit(k, p) { const a = map.get(k); if (a) for (let i = 0; i < a.length; i++) a[i](p); }
    };
  }

  /** 숫자 → 1,234 */
  const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  /** 초 → m:ss */
  function mmss(s) {
    s = Math.max(0, Math.ceil(s));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  return {
    clamp, lerp, sign, damp, approach, dist, dist2, wrapAngle, angleDiff, aabb,
    rng, rand, randInt, chance, pick, shuffle,
    dirFromVec, dirFromAngle, snapAngle8, rotToward, shade, mix, makeCanvas, bus, fmt, mmss
  };
})();
