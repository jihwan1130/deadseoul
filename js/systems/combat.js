/* =============================================================================
   DEAD:SEOUL — systems/combat.js
   근접 공격 판정 · 치명타(배후/무방비) · 넉백 · 소음 전파 · 소화기 분사
   ============================================================================= */
'use strict';

DS.Combat = (function () {

  const U = DS.U;

  /* =========================================================================
     소음 — 좀비 청각 유발
       radius: px. 달리기 ~70, 일반 타격 ~34, 문 개방 ~160
     ========================================================================= */
  function noise(game, x, y, radius, kind) {
    if (!game.zombies) return;
    for (const z of game.zombies) {
      if (z.dead) continue;
      const d = U.dist(x, y, z.x, z.y);
      if (d > radius) continue;
      // 벽은 소리를 절반만 통과
      const through = game.map.hasLOS(x, y, z.x, z.y) ? 1 : 0.5;
      if (d > radius * through) continue;
      z.hear(x, y, 1 - d / radius);
    }
    if (game.onNoise) game.onNoise(x, y, radius, kind);
  }

  /* =========================================================================
     플레이어 근접 공격
     ========================================================================= */
  function playerAttack(game) {
    const p = game.player;
    const st = p.stats;
    if (p.swing || st.busy > 0 || st.dead) return false;

    const wp = DS.Inventory.weapon(p.inv);
    const w = wp.w;

    if (st.stamina < w.stam * 0.5) {
      DS.Audio.sfx('ui_deny', { vol: 0.5 });
      game.toast('숨이 차서 휘두를 수 없다.', 'warn');
      return false;
    }

    st.stamina = Math.max(0, st.stamina - w.stam);
    st.staminaIdle = 0;

    const angle = p.aim;
    p.swing = {
      t: 0,
      dur: w.cd * (w.heavy ? 0.85 : 0.62),
      hitAt: w.heavy ? 0.42 : 0.3,
      hit: false,
      angle,
      arc: w.arc,
      id: wp.id,
      heavy: !!w.heavy
    };
    p.face = U.dirFromAngle(angle);
    p.attackCd = w.cd;
    DS.Audio.sfx('swing', { vol: w.heavy ? 0.9 : 0.6 });
    return true;
  }

  /** 스윙 타격 순간 처리 */
  function resolveSwing(game) {
    const p = game.player;
    const s = p.swing;
    const wp = DS.Inventory.weapon(p.inv);
    const w = wp.w;
    const ox = p.x, oy = p.y - 6;

    let hits = 0;
    const maxHits = w.heavy ? 3 : 2;

    for (const z of game.zombies) {
      if (z.dead || hits >= maxHits) continue;
      const d = U.dist(ox, oy, z.x, z.y - 6);
      if (d > w.range + 6) continue;
      const a = Math.atan2(z.y - 6 - oy, z.x - ox);
      if (U.angleDiff(a, s.angle) > w.arc / 2 + 0.12) continue;
      if (!game.map.hasLOS(ox, oy, z.x, z.y)) continue;

      // --- 치명타 판정 ---
      const unaware = z.state === 'idle' || z.state === 'wander';
      const back = U.angleDiff(s.angle, z.facingAngle) < 1.0;  // 같은 방향 = 등 뒤에서
      let mult = 1;
      let critKind = null;
      if (unaware) { mult = w.crit; critKind = 'ambush'; }
      else if (back) { mult = Math.max(1.35, w.crit * 0.7); critKind = 'back'; }
      else if (z.state === 'stagger') { mult = 1.25; critKind = null; }

      let dmg = w.dmg * mult * U.rand(0.92, 1.08);
      if (DS.Survival.has(p.stats, 'drunk')) dmg *= 1.1;
      dmg = Math.round(dmg);

      hitZombie(game, z, dmg, a, w.knock, critKind);
      hits++;
    }

    // 벽/좌석을 쳤을 때
    if (hits === 0) {
      const tx = ox + Math.cos(s.angle) * (w.range * 0.8);
      const ty = oy + Math.sin(s.angle) * (w.range * 0.8);
      if (game.map.blocked(tx, ty + 6)) {
        DS.Audio.sfx('hit_block', { vol: 0.5 });
        DS.FX.spark(tx, ty, s.angle + Math.PI);
        DS.FX.doShake(0.8);
        if (wp.slot >= 0) DS.Inventory.wear(p.inv, 0.5);
      }
    } else {
      // 내구도 소모
      if (wp.slot >= 0) {
        const broke = DS.Inventory.wear(p.inv, w.heavy ? 1.5 : 1);
        if (broke) {
          game.toast(`<b>${wp.d.name}</b>이(가) 부러졌다.`, 'bad');
          DS.Audio.sfx('hit_metal', { vol: 0.8 });
          DS.FX.debris(p.x, p.y - 8, '#9aa4aa', 8);
        }
      }
    }

    noise(game, p.x, p.y, w.noise, 'attack');
  }

  /** 좀비 피격 */
  function hitZombie(game, z, dmg, angle, knock, critKind) {
    z.hp -= dmg;
    z.flash = 0.14;
    z.lastHitAngle = angle;
    z.alertTo(game.player.x, game.player.y);

    // 넉백 + 경직
    const k = knock * (z.heavyBody ? 0.55 : 1);
    z.vx += Math.cos(angle) * k;
    z.vy += Math.sin(angle) * k;
    z.stagger(critKind ? 0.5 : 0.26);

    DS.FX.blood(z.x, z.y - 7, angle, critKind ? 1.5 : 1, !!critKind);
    DS.FX.decalBlood(game.map, z.x + U.rand(-3, 3), z.y + U.rand(-2, 2), U.rand(3, 6), 0.35);
    DS.FX.dmgNum(z.x, z.y - 16, dmg, critKind ? '#ffd27a' : '#ffffff');
    DS.FX.doShake(critKind ? 2.4 : 1.3);

    if (critKind) {
      DS.Audio.sfxAt('hit_crit', z.x, z.y);
      game.hitStop = Math.max(game.hitStop, 0.07);
    } else {
      DS.Audio.sfxAt('hit_flesh', z.x, z.y);
      game.hitStop = Math.max(game.hitStop, 0.035);
    }

    if (z.hp <= 0) killZombie(game, z, angle);
  }

  function killZombie(game, z, angle) {
    z.dead = true;
    z.deadT = 0;
    DS.Audio.sfxAt('z_die', z.x, z.y);
    DS.FX.blood(z.x, z.y - 7, angle, 2.2, true);
    DS.FX.decalBlood(game.map, z.x, z.y + 2, U.rand(8, 13), 0.7);
    DS.FX.doShake(2.0);
    game.stats.kills++;
    if (game.onKill) game.onKill(z);
  }

  /* =========================================================================
     좀비 → 플레이어
     ========================================================================= */
  function zombieHit(game, z) {
    const p = game.player;
    if (p.stats.dead || p.invuln > 0) return;

    const base = z.dmg * U.rand(0.9, 1.15);
    const kind = z.attackKind || 'bite';
    const dealt = DS.Survival.damage(p.stats, base, kind, game.survCtx);

    p.invuln = 0.65;
    const a = Math.atan2(p.y - z.y, p.x - z.x);
    p.vx += Math.cos(a) * 70;
    p.vy += Math.sin(a) * 70;

    DS.Audio.sfx(kind === 'bite' ? 'bite' : 'player_hurt', { vol: 0.9 });
    DS.FX.blood(p.x, p.y - 8, a, 1.2, kind === 'bite');
    DS.FX.decalBlood(game.map, p.x, p.y + 2, U.rand(3, 6), 0.4);
    DS.FX.doShake(3.4);
    game.hitStop = Math.max(game.hitStop, 0.08);
    game.hurtFlash = 1;

    // 물리면 출혈 확률
    if (kind === 'bite' && Math.random() < (DS.Survival.has(p.stats, 'armored') ? 0.18 : 0.42)) {
      DS.Survival.addStatus(p.stats, 'bleed', Infinity);
      game.toast('<b>출혈</b> — 붕대를 감아야 한다.', 'bad');
    }
    if (game.onPlayerHurt) game.onPlayerHurt(dealt, kind, z);
  }

  /* =========================================================================
     소화기 분말 분사 — 넉백 + 일시 실명
     ========================================================================= */
  function spray(game) {
    const p = game.player;
    const wp = DS.Inventory.weapon(p.inv);
    if (wp.id !== 'extinguisher') return false;
    const slot = p.inv.slots[wp.slot];
    if (!slot) return false;
    if (slot.charges == null) slot.charges = DS.Items.get('extinguisher').alt.charges;
    if (slot.charges <= 0) { game.toast('소화기 압력이 다 빠졌다.', 'warn'); DS.Audio.sfx('ui_deny'); return false; }
    if (p.stats.stamina < 10) { DS.Audio.sfx('ui_deny'); return false; }

    slot.charges--;
    p.stats.stamina -= 10;
    p.sprayT = 0.75;
    DS.Audio.sfx('extinguish', { vol: 0.9 });

    const a = p.aim;
    for (let i = 0; i < 6; i++) {
      DS.FX.powder(p.x + Math.cos(a) * (6 + i * 5), p.y - 7 + Math.sin(a) * (6 + i * 5), a, 1);
    }
    for (const z of game.zombies) {
      if (z.dead) continue;
      const d = U.dist(p.x, p.y, z.x, z.y);
      if (d > 56) continue;
      const za = Math.atan2(z.y - p.y, z.x - p.x);
      if (U.angleDiff(za, a) > 0.75) continue;
      z.vx += Math.cos(za) * 120;
      z.vy += Math.sin(za) * 120;
      z.blind(2.6);
      z.stagger(0.5);
      DS.FX.dmgNum(z.x, z.y - 16, '-', '#dfe9f0');
    }
    noise(game, p.x, p.y, 60, 'spray');
    game.toast(`분말 분사 (${slot.charges}회 남음)`, '');
    return true;
  }

  return { noise, playerAttack, resolveSwing, hitZombie, killZombie, zombieHit, spray };
})();
