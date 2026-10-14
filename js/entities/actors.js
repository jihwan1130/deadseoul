/* =============================================================================
   DEAD:SEOUL — entities/actors.js
   Player / Zombie / Npc
   ============================================================================= */
'use strict';

(function () {

  const U = DS.U;
  const T = DS.TILE;

  /* =========================================================================
     공통: 타일 충돌 (축 분리 + 모서리 슬라이딩)
     ========================================================================= */
  function moveCollide(e, dx, dy, map) {
    const r = e.r;
    // X
    if (dx !== 0) {
      const nx = e.x + dx;
      if (!solidAt(map, nx - r, e.y - r * 0.7) && !solidAt(map, nx + r, e.y - r * 0.7) &&
          !solidAt(map, nx - r, e.y + r * 0.7) && !solidAt(map, nx + r, e.y + r * 0.7)) {
        e.x = nx;
      } else { e.bumpX = true; }
    }
    // Y
    if (dy !== 0) {
      const ny = e.y + dy;
      if (!solidAt(map, e.x - r * 0.8, ny - r) && !solidAt(map, e.x + r * 0.8, ny - r) &&
          !solidAt(map, e.x - r * 0.8, ny + r) && !solidAt(map, e.x + r * 0.8, ny + r)) {
        e.y = ny;
      } else { e.bumpY = true; }
    }
  }

  function solidAt(map, px, py) { return map.blocked(px, py); }

  /* =========================================================================
     PLAYER — 도윤
     ========================================================================= */
  class Player {
    constructor(x, y) {
      this.x = x; this.y = y;
      this.vx = 0; this.vy = 0;
      this.r = 4.2;
      this.face = 'down';
      this.aim = Math.PI / 2;
      this.facingAngle = Math.PI / 2;
      this.animT = 0;
      this.frame = 0;
      this.moving = false;
      this.running = false;

      this.stats = DS.Survival.create();
      this.inv = DS.Inventory.create();

      this.swing = null;
      this.attackCd = 0;
      this.invuln = 0;
      this.sprayT = 0;
      this.stepT = 0;
      this.light = false;
      this.lightFade = 0;

      this.speedWalk = 48;
      this.speedRun = 88;
      this.holdT = 0;          // 상호작용 홀드 진행
      this.holdTarget = null;
    }

    get z() { return this.y; }

    update(dt, game) {
      const st = this.stats;
      this.invuln = Math.max(0, this.invuln - dt);
      this.attackCd = Math.max(0, this.attackCd - dt);
      this.sprayT = Math.max(0, this.sprayT - dt);
      this.lightFade = U.damp(this.lightFade, this.light ? 1 : 0, 9, dt);

      // --- 스윙 진행 ---
      if (this.swing) {
        this.swing.t += dt / this.swing.dur;
        if (!this.swing.hit && this.swing.t >= this.swing.hitAt) {
          this.swing.hit = true;
          DS.Combat.resolveSwing(game);
        }
        if (this.swing.t >= 1) this.swing = null;
      }

      // --- 입력 ---
      const mv = DS.Input.moveVec();
      const busy = st.busy > 0 || this.holdTarget;
      let ax = busy ? 0 : mv.x, ay = busy ? 0 : mv.y;

      this.running = !!(DS.Input.wantRun() && (ax || ay) && DS.Survival.canRun(st) && !busy);
      let spd = (this.running ? this.speedRun : this.speedWalk) * DS.Survival.speedMul(st);
      if (this.swing) spd *= this.swing.heavy ? 0.3 : 0.55;
      spd *= game.map.speedAt(this.x, this.y);
      if (DS.Inventory.load(this.inv) > 0.8) spd *= 0.92;

      const tvx = ax * spd, tvy = ay * spd;
      this.vx = U.damp(this.vx, tvx, 15, dt);
      this.vy = U.damp(this.vy, tvy, 15, dt);
      if (Math.abs(this.vx) < 0.4 && !ax) this.vx = 0;
      if (Math.abs(this.vy) < 0.4 && !ay) this.vy = 0;

      this.bumpX = this.bumpY = false;
      moveCollide(this, this.vx * dt, this.vy * dt, game.map);
      if (this.bumpX) this.vx *= 0.1;
      if (this.bumpY) this.vy *= 0.1;

      // 맵 경계
      this.x = U.clamp(this.x, 2, game.map.pxW - 2);
      this.y = U.clamp(this.y, 2, game.map.pxH - 2);

      const sp = Math.hypot(this.vx, this.vy);
      this.moving = sp > 6;

      // --- 조준 / 방향 ---
      if (DS.Input.mouse.inside && !DS.Input.touch.active) {
        const wx = DS.Input.mouse.x + game.camera.x;
        const wy = DS.Input.mouse.y + game.camera.y;
        this.aim = Math.atan2(wy - (this.y - 7), wx - this.x);
      } else if (this.moving) {
        this.aim = Math.atan2(this.vy, this.vx);
      }
      this.facingAngle = this.aim;
      if (!this.swing) {
        this.face = this.moving && !DS.Input.mouse.inside
          ? U.dirFromVec(this.vx, this.vy)
          : U.dirFromAngle(this.aim);
      }

      // --- 애니메이션 / 발소리 ---
      if (this.moving) {
        const fps = this.running ? 9.5 : 6.4;
        this.animT += dt * fps;
        this.frame = ((this.animT | 0) % 4);
        this.stepT += dt * (this.running ? 1.5 : 1);
        if (this.stepT > 0.36) {
          this.stepT = 0;
          const surf = game.map.surfaceAt(this.x, this.y + 2);
          DS.Audio.sfx('step_' + (surf === 'vinyl' ? 'vinyl' : surf), { vol: this.running ? 0.75 : 0.45 });
          DS.FX.dust(this.x, this.y + 1, surf === 'gravel' ? 3 : 1);
          if (this.running) DS.Combat.noise(game, this.x, this.y, 76, 'run');
          else DS.Combat.noise(game, this.x, this.y, 26, 'walk');
        }
      } else {
        this.frame = 0; this.animT = 0;
      }

      // --- 생존 스탯 ---
      DS.Survival.update(st, dt, game.survCtx);

      // 보호구 상태 동기화
      if (this.inv.armorHead && this.inv.armorHead.id === 'gasmask') DS.Survival.addStatus(st, 'masked', Infinity);
      else DS.Survival.removeStatus(st, 'masked');
      if (this.inv.armorArm && this.inv.armorArm.id === 'armguard') DS.Survival.addStatus(st, 'armored', Infinity);
      else DS.Survival.removeStatus(st, 'armored');
    }

    /** 손 위치 (무기 렌더용) */
    handPos() {
      const f = this.face;
      const bob = (this.frame === 1 || this.frame === 3) ? -1 : 0;
      if (f === 'right') return { x: this.x + 5, y: this.y - 7 + bob };
      if (f === 'left') return { x: this.x - 5, y: this.y - 7 + bob };
      if (f === 'up') return { x: this.x + 4, y: this.y - 8 + bob };
      return { x: this.x + 5, y: this.y - 6 + bob };
    }

    draw(c, camX, camY, game) {
      const sx = Math.round(this.x - camX), sy = Math.round(this.y - camY);
      const s = DS.Gfx.person('doyun', this.face, this.frame, 'n');

      // 그림자
      c.fillStyle = 'rgba(0,0,0,0.35)';
      c.beginPath(); c.ellipse(sx, sy + 1, 5.2, 2.2, 0, 0, 7); c.fill();

      // 피격 점멸
      const blink = this.invuln > 0 && (Math.floor(this.invuln * 22) % 2 === 0);
      if (!blink) c.drawImage(s.canvas, sx - s.fx, sy - s.fy);

      // 무기
      const wp = DS.Inventory.weapon(this.inv);
      if (wp.id !== 'fists') {
        const h = this.handPos();
        let ang, hx = h.x - camX, hy = h.y - camY;
        if (this.swing) {
          const t = U.clamp(this.swing.t, 0, 1);
          const e = t < 0.34 ? (t / 0.34) * 0.82 : 0.82 + ((t - 0.34) / 0.66) * 0.18;
          ang = this.swing.angle - this.swing.arc / 2 + this.swing.arc * e;
          const rad = 7 + Math.sin(e * Math.PI) * 4;
          hx = sx + Math.cos(ang) * rad;
          hy = sy - 7 + Math.sin(ang) * rad * 0.8;
        } else {
          ang = this.face === 'left' ? Math.PI : (this.face === 'up' ? -1.25 : (this.face === 'right' ? 0 : 0.5));
          if (this.face === 'left') { hx = sx - 5; }
        }
        DS.Gfx.weapon(c, wp.id, hx, hy, ang, this.face === 'left' && !this.swing);
      }

      // 스윙 궤적
      if (this.swing) {
        const t = U.clamp(this.swing.t, 0, 1);
        const a = 1 - t;
        const w = DS.Inventory.weapon(this.inv).w;
        c.save();
        c.globalAlpha = a * 0.3;
        c.strokeStyle = '#e8edf0';
        c.lineWidth = 1.5;
        c.beginPath();
        const e = t < 0.34 ? (t / 0.34) * 0.82 : 0.82 + ((t - 0.34) / 0.66) * 0.18;
        const a0 = this.swing.angle - this.swing.arc / 2;
        c.arc(sx, sy - 7, w.range * 0.8, a0, a0 + this.swing.arc * e);
        c.stroke();
        c.restore();
      }
    }
  }

  /* =========================================================================
     ZOMBIE
     ========================================================================= */
  const Z_TYPE = {
    office: {
      pal: 'z_office', name: '감염자 · 직장인',
      hp: 36, speed: 27, chaseSpeed: 44, dmg: 11, r: 4.6,
      sight: 82, fov: 1.9, hearing: 1.0, windup: 0.44, cooldown: 1.15, reach: 13
    },
    student: {
      pal: 'z_student', name: '감염자 · 학생',
      hp: 27, speed: 34, chaseSpeed: 60, dmg: 10, r: 4.2,
      sight: 92, fov: 2.1, hearing: 1.2, windup: 0.32, cooldown: 0.9, reach: 12
    },
    elder: {
      pal: 'z_elder', name: '감염자 · 노인',
      hp: 52, speed: 18, chaseSpeed: 30, dmg: 15, r: 5.0, heavyBody: true,
      sight: 62, fov: 1.6, hearing: 0.8, windup: 0.6, cooldown: 1.5, reach: 14
    },
    staff: {
      pal: 'z_staff', name: '감염자 · 역무원',
      hp: 44, speed: 29, chaseSpeed: 50, dmg: 15, r: 4.8,
      sight: 88, fov: 2.0, hearing: 1.1, windup: 0.4, cooldown: 1.05, reach: 13
    }
  };

  class Zombie {
    constructor(x, y, type) {
      const d = Z_TYPE[type] || Z_TYPE.office;
      this.type = type || 'office';
      this.d = d;
      this.pal = d.pal;
      this.name = d.name;
      this.x = x; this.y = y;
      this.vx = 0; this.vy = 0;
      this.r = d.r;
      this.hp = d.hp; this.hpMax = d.hp;
      this.dmg = d.dmg;
      this.heavyBody = !!d.heavyBody;
      this.attackKind = 'bite';

      this.state = 'idle';
      this.stateT = 0;
      this.face = 'down';
      this.facingAngle = U.rand(-3.14, 3.14);
      this.animT = U.rand(0, 4);
      this.frame = 0;
      this.target = null;        // {x,y} 추적 지점
      this.alertLevel = 0;       // 0~1
      this.staggerT = 0;
      this.blindT = 0;
      this.windupT = 0;
      this.cdT = 0;
      this.flash = 0;
      this.groanT = U.rand(1, 6);
      this.dead = false;
      this.deadT = 0;
      this.searched = false;
      this.seed = (Math.random() * 1000) | 0;
      this.stepT = 0;
      this.avoidT = 0;
      this.avoidDir = 1;
      this.spawnT = 0;
    }

    stagger(t) { this.staggerT = Math.max(this.staggerT, t); this.state = 'stagger'; this.stateT = 0; }
    blind(t) { this.blindT = Math.max(this.blindT, t); }

    alertTo(x, y) {
      this.target = { x, y };
      this.alertLevel = 1;
      if (this.state === 'idle' || this.state === 'wander' || this.state === 'alert') {
        if (this.state !== 'chase') DS.Audio.sfxAt('z_alert', this.x, this.y, { vol: 0.7 });
        this.state = 'chase'; this.stateT = 0;
      }
    }

    hear(x, y, strength) {
      if (this.dead) return;
      const s = strength * this.d.hearing;
      if (s < 0.12) return;
      this.alertLevel = Math.min(1, this.alertLevel + s * 0.8);
      if (this.state === 'idle' || this.state === 'wander') {
        this.state = 'alert'; this.stateT = 0;
        this.target = { x: x + U.rand(-8, 8), y: y + U.rand(-8, 8) };
      } else if (this.state === 'alert' || this.state === 'chase') {
        this.target = { x, y };
      }
    }

    canSee(game) {
      if (this.blindT > 0) return false;
      const p = game.player;
      if (p.stats.dead) return false;
      const d = U.dist(this.x, this.y, p.x, p.y);
      let range = this.d.sight;
      // 어두우면 시야 감소, 플래시라이트를 켜면 증가
      range *= 0.55 + 0.45 * game.lightLevel;
      if (p.light) range *= 1.25;
      if (d > range) return false;
      const a = Math.atan2(p.y - this.y, p.x - this.x);
      if (d > 16 && U.angleDiff(a, this.facingAngle) > this.d.fov / 2) return false;
      return game.map.hasLOS(this.x, this.y - 6, p.x, p.y - 6);
    }

    update(dt, game) {
      if (this.dead) { this.deadT += dt; return; }
      this.stateT += dt;
      this.spawnT += dt;
      this.flash = Math.max(0, this.flash - dt);
      this.blindT = Math.max(0, this.blindT - dt);
      this.cdT = Math.max(0, this.cdT - dt);
      this.alertLevel = Math.max(0, this.alertLevel - dt * 0.08);

      // 신음
      this.groanT -= dt;
      if (this.groanT <= 0) {
        this.groanT = U.rand(3.5, 9) / (this.state === 'chase' ? 2.2 : 1);
        DS.Audio.sfxAt('z_groan', this.x, this.y, { vol: this.state === 'chase' ? 0.9 : 0.5 });
      }

      const p = game.player;
      let desired = null;
      let speed = this.d.speed;

      /* ---------------- 상태 머신 ---------------- */
      if (this.staggerT > 0) {
        this.staggerT -= dt;
        this.state = 'stagger';
        if (this.staggerT <= 0) { this.state = this.target ? 'chase' : 'idle'; this.stateT = 0; }
      } else {
        const sees = this.canSee(game);
        if (sees) {
          this.target = { x: p.x, y: p.y };
          if (this.state !== 'chase' && this.state !== 'attack') {
            DS.Audio.sfxAt('z_alert', this.x, this.y, { vol: 0.8 });
            this.state = 'chase'; this.stateT = 0;
          }
          this.alertLevel = 1;
        }

        switch (this.state) {
          case 'idle':
            if (this.stateT > U.rand(1.5, 4)) { this.state = 'wander'; this.stateT = 0; this.wanderA = U.rand(-3.14, 3.14); }
            break;

          case 'wander':
            speed = this.d.speed * 0.42;
            desired = { x: this.x + Math.cos(this.wanderA) * 40, y: this.y + Math.sin(this.wanderA) * 40 };
            if (this.stateT > U.rand(1.6, 3.4) || this.bumpX || this.bumpY) { this.state = 'idle'; this.stateT = 0; }
            break;

          case 'alert':
            speed = this.d.speed * 0.78;
            desired = this.target;
            if (this.target && U.dist(this.x, this.y, this.target.x, this.target.y) < 10) {
              this.target = null; this.state = 'idle'; this.stateT = 0;
            }
            if (this.stateT > 9) { this.state = 'idle'; this.stateT = 0; this.target = null; }
            break;

          case 'chase': {
            speed = this.d.chaseSpeed;
            desired = this.target;
            const dp = U.dist(this.x, this.y, p.x, p.y);
            if (dp < this.d.reach && this.cdT <= 0 && !p.stats.dead) {
              this.state = 'attack'; this.stateT = 0; this.windupT = this.d.windup;
              this.attackAngle = Math.atan2(p.y - this.y, p.x - this.x);
            } else if (!sees && this.stateT > 6.5) {
              this.state = 'alert'; this.stateT = 0;
            }
            break;
          }

          case 'attack': {
            speed = 4;
            this.windupT -= dt;
            if (this.windupT <= 0) {
              // 타격 판정
              const dp = U.dist(this.x, this.y, p.x, p.y);
              const a = Math.atan2(p.y - this.y, p.x - this.x);
              if (dp < this.d.reach + 5 && U.angleDiff(a, this.attackAngle) < 1.1) {
                DS.Combat.zombieHit(game, this);
              } else {
                DS.Audio.sfxAt('swing', this.x, this.y, { vol: 0.4 });
              }
              // 달려들며 약간 전진
              this.vx += Math.cos(this.attackAngle) * 46;
              this.vy += Math.sin(this.attackAngle) * 46;
              this.cdT = this.d.cooldown;
              this.state = 'chase'; this.stateT = 0;
            }
            break;
          }
        }
      }

      /* ---------------- 이동 ---------------- */
      let ax = 0, ay = 0;
      if (desired) {
        let dx = desired.x - this.x, dy = desired.y - this.y;
        const l = Math.hypot(dx, dy) || 1;
        dx /= l; dy /= l;

        // 장애물 회피: 전방이 막혔으면 측면으로 우회
        const probe = 11;
        if (game.map.blocked(this.x + dx * probe, this.y + dy * probe)) {
          if (this.avoidT <= 0) { this.avoidDir = Math.random() < 0.5 ? 1 : -1; this.avoidT = 0.9; }
          const rot = this.avoidDir * 1.15;
          const nx = dx * Math.cos(rot) - dy * Math.sin(rot);
          const ny = dx * Math.sin(rot) + dy * Math.cos(rot);
          dx = nx; dy = ny;
        }
        this.avoidT = Math.max(0, this.avoidT - dt);
        ax = dx; ay = dy;
      }

      // 좀비끼리 분리
      for (const o of game.zombies) {
        if (o === this || o.dead) continue;
        const dx = this.x - o.x, dy = this.y - o.y;
        const d2 = dx * dx + dy * dy;
        const min = (this.r + o.r) * 1.25;
        if (d2 > 0.01 && d2 < min * min) {
          const d = Math.sqrt(d2);
          ax += (dx / d) * 0.8; ay += (dy / d) * 0.8;
        }
      }

      const al = Math.hypot(ax, ay);
      if (al > 0.001) {
        const tvx = (ax / al) * speed, tvy = (ay / al) * speed;
        this.vx = U.damp(this.vx, tvx, 7, dt);
        this.vy = U.damp(this.vy, tvy, 7, dt);
      } else {
        this.vx = U.damp(this.vx, 0, 9, dt);
        this.vy = U.damp(this.vy, 0, 9, dt);
      }

      this.bumpX = this.bumpY = false;
      moveCollide(this, this.vx * dt, this.vy * dt, game.map);
      if (this.bumpX) this.vx *= 0.2;
      if (this.bumpY) this.vy *= 0.2;
      this.x = U.clamp(this.x, 2, game.map.pxW - 2);
      this.y = U.clamp(this.y, 2, game.map.pxH - 2);

      const sp = Math.hypot(this.vx, this.vy);
      this.moving = sp > 5;
      if (this.moving) {
        this.facingAngle = U.damp(this.facingAngle, Math.atan2(this.vy, this.vx), 8, dt);
        this.face = U.dirFromVec(this.vx, this.vy);
        this.animT += dt * (this.state === 'chase' ? 6.2 : 3.4);
        this.frame = ((this.animT | 0) % 4);
        this.stepT += dt;
        if (this.stepT > (this.state === 'chase' ? 0.3 : 0.52)) {
          this.stepT = 0;
          const surf = game.map.surfaceAt(this.x, this.y + 2);
          DS.Audio.sfxAt('step_' + (surf === 'vinyl' ? 'vinyl' : surf), this.x, this.y, { vol: 0.3 });
        }
      } else {
        this.frame = 0;
      }
    }

    draw(c, camX, camY, game) {
      const sx = Math.round(this.x - camX), sy = Math.round(this.y - camY);

      if (this.dead) {
        const s = DS.Gfx.corpse(this.pal, this.seed);
        c.globalAlpha = U.clamp(1 - (this.deadT - 24) / 6, 0, 1);
        c.drawImage(s.canvas, sx - s.fx, sy - s.fy);
        c.globalAlpha = 1;
        return;
      }

      // 그림자
      c.fillStyle = 'rgba(0,0,0,0.33)';
      c.beginPath(); c.ellipse(sx, sy + 1, 5.4, 2.2, 0, 0, 7); c.fill();

      const reaching = (this.state === 'attack') || (this.state === 'chase' && U.dist(this.x, this.y, game.player.x, game.player.y) < 26);
      const s = DS.Gfx.person(this.pal, this.face, this.frame, reaching ? 'reach' : 'n');

      // 공격 예비동작: 몸을 살짝 뒤로 당겼다 내밀기
      let dy = 0, dx = 0;
      if (this.state === 'attack') {
        const k = 1 - (this.windupT / this.d.windup);
        dx = Math.cos(this.attackAngle) * (k < 0.75 ? -1.5 : 2.5);
        dy = Math.sin(this.attackAngle) * (k < 0.75 ? -1 : 1.5);
      }

      c.drawImage(s.canvas, Math.round(sx - s.fx + dx), Math.round(sy - s.fy + dy));

      // 피격 플래시
      if (this.flash > 0) {
        c.save();
        c.globalCompositeOperation = 'lighter';
        c.globalAlpha = U.clamp(this.flash / 0.14, 0, 1) * 0.6;
        c.drawImage(s.canvas, Math.round(sx - s.fx + dx), Math.round(sy - s.fy + dy));
        c.restore();
      }

      // 공격 경고 표시 (예비동작 중 붉은 눈빛)
      if (this.state === 'attack' && this.windupT > 0) {
        const k = 1 - (this.windupT / this.d.windup);
        c.globalAlpha = 0.35 + 0.5 * k;
        c.fillStyle = '#ff4433';
        c.fillRect(sx - 2, sy - 17, 1, 1);
        c.fillRect(sx + 1, sy - 17, 1, 1);
        c.globalAlpha = 1;
      }

      // 체력 바 (피해를 입은 개체만)
      if (this.hp < this.hpMax) {
        const w = 11;
        const f = U.clamp(this.hp / this.hpMax, 0, 1);
        c.fillStyle = 'rgba(0,0,0,0.65)'; c.fillRect(sx - w / 2 - 1, sy - 24, w + 2, 3);
        c.fillStyle = '#8e1219'; c.fillRect(sx - w / 2, sy - 23, w * f, 1);
        c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(sx - w / 2, sy - 23, w * f, 1);
      }

      // 경계 상태 표시
      if (this.blindT > 0) {
        c.fillStyle = 'rgba(230,236,240,0.7)';
        c.fillRect(sx - 3, sy - 19, 7, 1);
      }
    }
  }

  /* =========================================================================
     NPC — 생존자
     ========================================================================= */
  class Npc {
    constructor(x, y, opt) {
      Object.assign(this, {
        x, y, vx: 0, vy: 0, r: 4.2, pal: 'minseo', name: 'NPC',
        face: 'down', frame: 0, animT: 0, moving: false,
        mode: 'idle', followDist: 22, dialogue: null, dead: false
      }, opt || {});
      this.facingAngle = Math.PI / 2;
      this.idleT = U.rand(0, 3);
    }

    update(dt, game) {
      this.idleT += dt;
      if (this.mode === 'follow') {
        const p = game.player;
        const d = U.dist(this.x, this.y, p.x, p.y);
        if (d > this.followDist) {
          let dx = p.x - this.x, dy = p.y - this.y;
          const l = Math.hypot(dx, dy) || 1;
          dx /= l; dy /= l;
          const probe = 10;
          if (game.map.blocked(this.x + dx * probe, this.y + dy * probe)) {
            const rot = 1.1;
            const nx = dx * Math.cos(rot) - dy * Math.sin(rot);
            const ny = dx * Math.sin(rot) + dy * Math.cos(rot);
            dx = nx; dy = ny;
          }
          const spd = d > 60 ? 74 : 50;
          this.vx = U.damp(this.vx, dx * spd, 11, dt);
          this.vy = U.damp(this.vy, dy * spd, 11, dt);
        } else {
          this.vx = U.damp(this.vx, 0, 12, dt);
          this.vy = U.damp(this.vy, 0, 12, dt);
        }
        moveCollide(this, this.vx * dt, this.vy * dt, game.map);
        const sp = Math.hypot(this.vx, this.vy);
        this.moving = sp > 6;
        if (this.moving) {
          this.face = U.dirFromVec(this.vx, this.vy);
          this.animT += dt * 7;
          this.frame = ((this.animT | 0) % 4);
        } else this.frame = 0;
      } else {
        // 웅크려 숨어 있는 상태 — 가끔 고개를 돌림
        this.moving = false;
        this.frame = 0;
        if (this.mode === 'hide') {
          const p = game.player;
          this.face = U.dirFromVec(p.x - this.x, p.y - this.y);
        }
      }
    }

    draw(c, camX, camY) {
      const sx = Math.round(this.x - camX), sy = Math.round(this.y - camY);
      c.fillStyle = 'rgba(0,0,0,0.33)';
      c.beginPath(); c.ellipse(sx, sy + 1, 5, 2.1, 0, 0, 7); c.fill();
      const s = DS.Gfx.person(this.pal, this.face, this.frame, 'n');
      if (this.mode === 'hide') {
        // 웅크림: 아래쪽만 잘라 그려 몸을 낮춘 느낌
        c.drawImage(s.canvas, 0, 4, s.w, s.h - 4, sx - s.fx, sy - s.fy + 4, s.w, s.h - 4);
      } else {
        c.drawImage(s.canvas, sx - s.fx, sy - s.fy);
      }
    }
  }

  DS.Player = Player;
  DS.Zombie = Zombie;
  DS.Npc = Npc;
  DS.Z_TYPE = Z_TYPE;
})();
