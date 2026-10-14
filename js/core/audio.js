/* =============================================================================
   DEAD:SEOUL — core/audio.js
   외부 음원 파일 없이 WebAudio로 합성. (에셋 확보 전 임시, 교체 지점 명시)
   - sfx(name, opt)   : 1회성 효과음
   - ambience(preset) : 환경음 레이어(지하철 공조음/터널 바람/화재)
   - music(preset)    : 저음 드론 + 금속 크릭
   ============================================================================= */
'use strict';

DS.Audio = (function () {

  let ac = null, master = null, busSfx = null, busAmb = null, busMus = null;
  let ready = false, muted = false;
  let noiseBuf = null;

  const VOL = { master: 0.8, sfx: 0.9, amb: 0.5, mus: 0.42 };

  function init() {
    if (ac) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain(); master.gain.value = VOL.master; master.connect(ac.destination);
    busSfx = ac.createGain(); busSfx.gain.value = VOL.sfx; busSfx.connect(master);
    busAmb = ac.createGain(); busAmb.gain.value = 0;        // 페이드인
    busAmb.connect(master);
    busMus = ac.createGain(); busMus.gain.value = VOL.mus; busMus.connect(master);

    // 1초 화이트노이즈 버퍼 (재사용)
    const n = ac.sampleRate;
    noiseBuf = ac.createBuffer(1, n, n);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    ready = true;
  }

  function resume() { if (ac && ac.state === 'suspended') ac.resume(); }
  const t0 = () => ac.currentTime;

  /* ------------------------- 기본 빌딩 블록 ------------------------- */

  function env(node, t, a, d, peak) {
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    node.connect(g);
    return g;
  }

  function tone(freq, t, a, d, peak, type, out, detune) {
    const o = ac.createOscillator();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (detune) o.frequency.exponentialRampToValueAtTime(Math.max(detune, 1), t + a + d);
    const g = env(o, t, a, d, peak);
    g.connect(out || busSfx);
    o.start(t); o.stop(t + a + d + 0.03);
    return o;
  }

  function noise(t, dur, peak, filterType, f0, f1, Q, out) {
    const s = ac.createBufferSource();
    s.buffer = noiseBuf;
    s.loop = true;
    const bp = ac.createBiquadFilter();
    bp.type = filterType || 'bandpass';
    bp.frequency.setValueAtTime(f0, t);
    if (f1) bp.frequency.exponentialRampToValueAtTime(Math.max(f1, 20), t + dur);
    bp.Q.value = Q == null ? 1 : Q;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + Math.min(0.012, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(bp); bp.connect(g); g.connect(out || busSfx);
    s.start(t); s.stop(t + dur + 0.02);
    return s;
  }

  /* ------------------------- 효과음 정의 ------------------------- */
  // pan: -1(좌)~1(우) / vol: 0~1 배율
  const SFX = {
    step_metal:  (t, v) => { noise(t, 0.07, 0.17 * v, 'bandpass', 1500, 700, 1.4); tone(170, t, 0.004, 0.05, 0.05 * v, 'triangle'); },
    step_vinyl:  (t, v) => { noise(t, 0.06, 0.11 * v, 'lowpass', 900, 420, 0.8); },
    step_gravel: (t, v) => { noise(t, 0.12, 0.2 * v, 'highpass', 2200, 1200, 0.7); },
    step_water:  (t, v) => { noise(t, 0.16, 0.19 * v, 'bandpass', 900, 2600, 0.9); },

    swing:       (t, v) => { noise(t, 0.16, 0.2 * v, 'bandpass', 420, 1900, 0.8); },
    hit_flesh:   (t, v) => { noise(t, 0.12, 0.42 * v, 'lowpass', 700, 180, 0.9); tone(92, t, 0.004, 0.11, 0.3 * v, 'square', null, 48); },
    hit_crit:    (t, v) => { noise(t, 0.2, 0.5 * v, 'lowpass', 900, 150, 1.1); tone(70, t, 0.004, 0.2, 0.42 * v, 'sawtooth', null, 36); },
    hit_metal:   (t, v) => { tone(1180, t, 0.002, 0.26, 0.2 * v, 'square', null, 420); noise(t, 0.1, 0.18 * v, 'bandpass', 3200, 1400, 3); },
    hit_block:   (t, v) => { noise(t, 0.09, 0.26 * v, 'bandpass', 1100, 480, 2); },
    player_hurt: (t, v) => { tone(300, t, 0.006, 0.26, 0.26 * v, 'sawtooth', null, 120); noise(t, 0.2, 0.2 * v, 'lowpass', 1200, 300, 0.8); },
    bite:        (t, v) => { noise(t, 0.26, 0.4 * v, 'lowpass', 1400, 220, 1.1); tone(140, t, 0.01, 0.3, 0.26 * v, 'square', null, 60); },

    z_groan:     (t, v) => { tone(104, t, 0.14, 0.95, 0.19 * v, 'sawtooth', null, 62); noise(t, 1.0, 0.07 * v, 'bandpass', 380, 200, 1.6); },
    z_alert:     (t, v) => { tone(188, t, 0.05, 0.6, 0.26 * v, 'sawtooth', null, 320); noise(t, 0.5, 0.13 * v, 'bandpass', 700, 1500, 1.2); },
    z_die:       (t, v) => { tone(126, t, 0.02, 1.1, 0.26 * v, 'sawtooth', null, 34); noise(t, 0.7, 0.24 * v, 'lowpass', 900, 120, 0.8); },

    pickup:      (t, v) => { tone(780, t, 0.004, 0.09, 0.17 * v, 'triangle'); tone(1180, t + 0.05, 0.004, 0.1, 0.13 * v, 'triangle'); },
    craft:       (t, v) => { noise(t, 0.3, 0.17 * v, 'bandpass', 1700, 700, 1.4); tone(420, t + 0.16, 0.01, 0.2, 0.14 * v, 'triangle', null, 700); },
    eat:         (t, v) => { noise(t, 0.3, 0.16 * v, 'lowpass', 800, 300, 0.7); },
    drink:       (t, v) => { for (let i = 0; i < 3; i++) tone(300 + i * 60, t + i * 0.1, 0.01, 0.07, 0.11 * v, 'sine', null, 180 + i * 40); },
    heal:        (t, v) => { noise(t, 0.4, 0.1 * v, 'bandpass', 2400, 1200, 1.2); tone(520, t + 0.1, 0.05, 0.3, 0.1 * v, 'sine'); },

    ui_click:    (t, v) => { tone(900, t, 0.002, 0.04, 0.1 * v, 'square'); },
    ui_move:     (t, v) => { tone(560, t, 0.002, 0.03, 0.06 * v, 'square'); },
    ui_deny:     (t, v) => { tone(180, t, 0.004, 0.14, 0.15 * v, 'square', null, 110); },

    door_rattle: (t, v) => { for (let i = 0; i < 5; i++) noise(t + i * 0.055, 0.05, 0.22 * v, 'bandpass', 900 + i * 180, 600, 2.4); },
    door_slide:  (t, v) => { noise(t, 0.9, 0.26 * v, 'bandpass', 500, 1500, 0.6); tone(70, t, 0.1, 0.8, 0.12 * v, 'triangle'); },
    cock_pull:   (t, v) => { noise(t, 0.16, 0.3 * v, 'bandpass', 2000, 800, 3); tone(240, t + 0.1, 0.004, 0.14, 0.17 * v, 'square', null, 130); },
    latch:       (t, v) => { tone(1500, t, 0.002, 0.07, 0.17 * v, 'square', null, 700); },
    glass:       (t, v) => { for (let i = 0; i < 7; i++) tone(2000 + Math.random() * 3000, t + Math.random() * 0.14, 0.002, 0.14, 0.07 * v, 'triangle', null, 1200); },
    search:      (t, v) => { noise(t, 0.44, 0.13 * v, 'bandpass', 1300, 600, 1.1); },
    extinguish:  (t, v) => { noise(t, 0.7, 0.3 * v, 'highpass', 2600, 1800, 0.4); },

    alarm:       (t, v) => { for (let i = 0; i < 3; i++) { tone(880, t + i * 0.42, 0.02, 0.2, 0.15 * v, 'square'); tone(660, t + i * 0.42 + 0.21, 0.02, 0.2, 0.15 * v, 'square'); } },
    chime:       (t, v) => { [784, 988, 1175].forEach((f, i) => tone(f, t + i * 0.13, 0.01, 0.5, 0.1 * v, 'sine')); },
    phone:       (t, v) => { tone(1480, t, 0.004, 0.06, 0.1 * v, 'sine'); tone(1180, t + 0.08, 0.004, 0.1, 0.09 * v, 'sine'); },
    heartbeat:   (t, v) => { tone(54, t, 0.01, 0.17, 0.4 * v, 'sine'); tone(48, t + 0.22, 0.01, 0.2, 0.28 * v, 'sine'); },
    thud:        (t, v) => { tone(60, t, 0.006, 0.4, 0.4 * v, 'sine', null, 32); noise(t, 0.2, 0.17 * v, 'lowpass', 400, 120, 0.8); },
    scream:      (t, v) => {
      const o = ac.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(620, t);
      o.frequency.linearRampToValueAtTime(980, t + 0.2);
      o.frequency.linearRampToValueAtTime(430, t + 1.0);
      const g = env(o, t, 0.06, 1.0, 0.2 * v);
      const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1300; f.Q.value = 2.2;
      g.connect(f); f.connect(busSfx); o.start(t); o.stop(t + 1.2);
      noise(t, 1.0, 0.08 * v, 'bandpass', 1800, 1000, 1.4);
    },
    brake:       (t, v) => {
      noise(t, 2.2, 0.22 * v, 'bandpass', 2600, 900, 6);
      tone(1400, t, 0.3, 1.9, 0.09 * v, 'sawtooth', null, 500);
      tone(48, t, 0.2, 2.0, 0.22 * v, 'sine');
    },
    power_down:  (t, v) => { tone(220, t, 0.02, 1.4, 0.2 * v, 'sawtooth', null, 24); noise(t, 1.0, 0.1 * v, 'lowpass', 1400, 200, 0.7); },
    power_up:    (t, v) => { tone(40, t, 0.4, 0.9, 0.17 * v, 'sawtooth', null, 300); },
    flick:       (t, v) => { noise(t, 0.04, 0.13 * v, 'bandpass', 4000, 2000, 4); }
  };

  function sfx(name, opt) {
    if (!ready || muted) return;
    const f = SFX[name];
    if (!f) return;
    resume();
    const o = opt || {};
    const t = t0() + (o.delay || 0);
    try { f(t, o.vol == null ? 1 : o.vol); } catch (e) { /* 오디오 실패는 게임을 막지 않음 */ }
  }

  /** 거리 감쇠 헬퍼 — 월드 좌표 기준 */
  function sfxAt(name, x, y, opt) {
    if (!ready || muted) return;
    const cam = DS.Game && DS.Game.camera;
    let v = 1;
    if (cam) {
      const d = DS.U.dist(x, y, cam.x, cam.y);
      v = DS.U.clamp(1 - d / 320, 0, 1);
      v *= v;
    }
    if (v < 0.03) return;
    const o = Object.assign({}, opt);
    o.vol = (o.vol == null ? 1 : o.vol) * v;
    sfx(name, o);
  }

  /* ------------------------- 환경음 ------------------------- */
  let ambNodes = [];
  let ambName = null;

  function stopAmbience(fade) {
    if (!ready) return;
    const t = t0();
    busAmb.gain.cancelScheduledValues(t);
    busAmb.gain.setValueAtTime(busAmb.gain.value, t);
    busAmb.gain.linearRampToValueAtTime(0.0001, t + (fade == null ? 0.8 : fade));
    const kill = ambNodes.slice();
    ambNodes = []; ambName = null;
    setTimeout(() => kill.forEach(n => { try { n.stop ? n.stop() : n.disconnect(); } catch (e) {} }), ((fade == null ? 0.8 : fade) * 1000) + 120);
  }

  /** preset: 'subway_idle' | 'subway_dark' | 'tunnel' | 'fire' */
  function ambience(preset, fade) {
    if (!ready) return;
    if (ambName === preset) return;
    stopAmbience(0.4);
    ambName = preset;
    resume();
    const t = t0() + 0.05;

    const layer = (type, f, q, gain) => {
      const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
      const bq = ac.createBiquadFilter(); bq.type = type; bq.frequency.value = f; bq.Q.value = q;
      const g = ac.createGain(); g.gain.value = gain;
      s.connect(bq); bq.connect(g); g.connect(busAmb);
      s.start(t); ambNodes.push(s);
      return { src: s, gain: g, filt: bq };
    };
    const drone = (f, gain, type) => {
      const o = ac.createOscillator(); o.type = type || 'sine'; o.frequency.value = f;
      const g = ac.createGain(); g.gain.value = gain;
      o.connect(g); g.connect(busAmb); o.start(t); ambNodes.push(o);
      // 아주 느린 LFO로 생동감
      const lfo = ac.createOscillator(); lfo.frequency.value = 0.07 + Math.random() * 0.09;
      const lg = ac.createGain(); lg.gain.value = gain * 0.45;
      lfo.connect(lg); lg.connect(g.gain); lfo.start(t); ambNodes.push(lfo);
      return g;
    };

    if (preset === 'subway_idle') {
      layer('lowpass', 420, 0.6, 0.1);     // 공조기
      drone(52, 0.055);                    // 차체 전원 험
      drone(104, 0.018, 'triangle');
    } else if (preset === 'subway_dark') {
      layer('lowpass', 240, 0.7, 0.07);
      drone(38, 0.07);
      layer('bandpass', 1700, 2.0, 0.012); // 먼 비명/금속 울림
    } else if (preset === 'tunnel') {
      layer('lowpass', 300, 0.5, 0.11);
      layer('bandpass', 700, 0.8, 0.03);
      drone(31, 0.085);
    } else if (preset === 'fire') {
      layer('lowpass', 900, 0.4, 0.14);
      layer('highpass', 2600, 0.5, 0.045);
      drone(44, 0.05);
    }

    busAmb.gain.cancelScheduledValues(t);
    busAmb.gain.setValueAtTime(0.0001, t);
    busAmb.gain.linearRampToValueAtTime(VOL.amb, t + (fade == null ? 1.6 : fade));
  }

  /* ------------------------- 음악(저음 드론) ------------------------- */
  let musNodes = [], musTimer = null, musName = null;

  function music(preset) {
    if (!ready || musName === preset) return;
    stopMusic(1.2);
    musName = preset;
    if (!preset) return;
    resume();
    const t = t0() + 0.1;
    const add = (f, g, type) => {
      const o = ac.createOscillator(); o.type = type || 'sine'; o.frequency.value = f;
      const gg = ac.createGain(); gg.gain.value = 0.0001;
      gg.gain.linearRampToValueAtTime(g, t + 3);
      o.connect(gg); gg.connect(busMus); o.start(t);
      musNodes.push(o); musNodes.push(gg);
    };

    if (preset === 'tension') {           // D 마이너 느낌의 낮은 드론
      add(36.7, 0.1); add(55, 0.05, 'triangle'); add(73.4, 0.028);
    } else if (preset === 'calm') {
      add(49, 0.075); add(98, 0.022, 'triangle');
    } else if (preset === 'panic') {
      add(41, 0.11); add(61.7, 0.06, 'sawtooth'); add(82, 0.035);
    }

    // 간헐적 금속 크릭 (차체 뒤틀림)
    const tick = () => {
      if (musName !== preset) return;
      if (Math.random() < 0.55) {
        noise(t0(), 0.5 + Math.random(), 0.035, 'bandpass', 600 + Math.random() * 2200, 300, 7, busMus);
      }
      musTimer = setTimeout(tick, 4200 + Math.random() * 7000);
    };
    musTimer = setTimeout(tick, 3000);
  }

  function stopMusic(fade) {
    if (!ready) return;
    if (musTimer) { clearTimeout(musTimer); musTimer = null; }
    musName = null;
    const t = t0(), f = fade == null ? 1 : fade;
    musNodes.forEach(n => {
      if (n.gain) { n.gain.cancelScheduledValues(t); n.gain.setValueAtTime(n.gain.value, t); n.gain.linearRampToValueAtTime(0.0001, t + f); }
    });
    const kill = musNodes.slice(); musNodes = [];
    setTimeout(() => kill.forEach(n => { try { n.stop && n.stop(); } catch (e) {} }), f * 1000 + 150);
  }

  function setMuted(v) {
    muted = v;
    if (master) master.gain.value = v ? 0 : VOL.master;
  }

  /** 긴장도(0~1)에 따라 음악 버스 볼륨 미세 조정 */
  function setTension(x) {
    if (!ready) return;
    busMus.gain.value = VOL.mus * (0.55 + 0.75 * DS.U.clamp(x, 0, 1));
  }

  return { init, resume, sfx, sfxAt, ambience, stopAmbience, music, stopMusic, setMuted, setTension,
           get ready() { return ready; }, get muted() { return muted; } };
})();
