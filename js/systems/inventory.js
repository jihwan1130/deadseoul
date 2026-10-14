/* =============================================================================
   DEAD:SEOUL — systems/inventory.js
   소지품(20슬롯, 앞 5칸이 핫바) · 장착 · 내구도 · 제작
   슬롯 = { id, n, dur? }   무기는 n=1 + dur 보유
   ============================================================================= */
'use strict';

DS.Inventory = (function () {

  const U = DS.U;
  const It = DS.Items;
  const SIZE = 20;
  const HOTBAR = 5;

  function create() {
    return {
      slots: new Array(SIZE).fill(null),
      weapon: -1,          // 장착 무기 슬롯 인덱스 (-1 = 맨손)
      armorHead: null,     // {id}
      armorArm: null,
      sel: 0,              // 선택 중인 슬롯 (패널)
      hot: 0              // 선택 중인 핫바 슬롯
    };
  }

  const def = (id) => It.get(id);

  /** 빈 슬롯 찾기 */
  function firstEmpty(inv) {
    for (let i = 0; i < SIZE; i++) if (!inv.slots[i]) return i;
    return -1;
  }

  function count(inv, id) {
    let n = 0;
    for (const s of inv.slots) if (s && s.id === id) n += s.n;
    return n;
  }

  /**
   * 아이템 추가. 남은 수량 반환(0이면 전부 수납)
   */
  function add(inv, id, n) {
    const d = def(id);
    if (!d) return n;
    let left = n == null ? 1 : n;

    // 스택 채우기
    if (d.stack > 1) {
      for (let i = 0; i < SIZE && left > 0; i++) {
        const s = inv.slots[i];
        if (s && s.id === id && s.n < d.stack) {
          const put = Math.min(d.stack - s.n, left);
          s.n += put; left -= put;
        }
      }
    }
    // 새 슬롯
    while (left > 0) {
      const i = firstEmpty(inv);
      if (i < 0) break;
      const put = Math.min(d.stack, left);
      const slot = { id, n: put };
      if (d.weapon && isFinite(d.weapon.dur)) slot.dur = d.weapon.dur;
      inv.slots[i] = slot;
      left -= put;
    }
    return left;
  }

  function remove(inv, id, n) {
    let left = n == null ? 1 : n;
    for (let i = SIZE - 1; i >= 0 && left > 0; i--) {
      const s = inv.slots[i];
      if (!s || s.id !== id) continue;
      const take = Math.min(s.n, left);
      s.n -= take; left -= take;
      if (s.n <= 0) {
        inv.slots[i] = null;
        if (inv.weapon === i) inv.weapon = -1;
      }
    }
    return left === 0;
  }

  function removeSlot(inv, i, n) {
    const s = inv.slots[i];
    if (!s) return;
    s.n -= (n == null ? 1 : n);
    if (s.n <= 0) {
      inv.slots[i] = null;
      if (inv.weapon === i) inv.weapon = -1;
    }
  }

  /* -------------------------------------------------------------------------
     장착
     ------------------------------------------------------------------------- */
  function equip(inv, i) {
    const s = inv.slots[i];
    if (!s) return false;
    const d = def(s.id);
    if (!d) return false;
    if (d.weapon) { inv.weapon = (inv.weapon === i) ? -1 : i; return true; }
    if (d.armor) {
      const slotKey = d.armor.slot === 'head' ? 'armorHead' : 'armorArm';
      if (inv[slotKey] && inv[slotKey].id === s.id) { inv[slotKey] = null; return true; }
      inv[slotKey] = { id: s.id, from: i };
      return true;
    }
    return false;
  }

  function isEquipped(inv, i) {
    if (inv.weapon === i) return true;
    const s = inv.slots[i];
    if (!s) return false;
    if (inv.armorHead && inv.armorHead.id === s.id) return true;
    if (inv.armorArm && inv.armorArm.id === s.id) return true;
    return false;
  }

  /** 현재 무기 정보 ({def, slot, dur}) — 없으면 맨손 */
  function weapon(inv) {
    const i = inv.weapon;
    if (i >= 0 && inv.slots[i]) {
      const s = inv.slots[i];
      const d = def(s.id);
      if (d && d.weapon) return { id: s.id, d, w: d.weapon, slot: i, dur: s.dur == null ? Infinity : s.dur };
    }
    const f = def('fists');
    return { id: 'fists', d: f, w: f.weapon, slot: -1, dur: Infinity };
  }

  /** 내구도 소모 → 파괴되면 true */
  function wear(inv, amount) {
    const i = inv.weapon;
    if (i < 0 || !inv.slots[i]) return false;
    const s = inv.slots[i];
    if (s.dur == null || !isFinite(s.dur)) return false;
    s.dur -= (amount == null ? 1 : amount);
    if (s.dur <= 0) {
      inv.slots[i] = null;
      inv.weapon = -1;
      return true;
    }
    return false;
  }

  /* -------------------------------------------------------------------------
     제작
     ------------------------------------------------------------------------- */
  function canCraft(inv, rcp) {
    if (rcp.locked) return false;
    for (const m of rcp.mats) if (count(inv, m.id) < m.n) return false;
    // 결과물 넣을 자리
    if (firstEmpty(inv) < 0) {
      // 재료 소모로 자리가 생기는 경우는 허용
      let frees = 0;
      for (const m of rcp.mats) if (count(inv, m.id) === m.n) frees++;
      if (frees === 0) return false;
    }
    return true;
  }

  function craft(inv, rcp) {
    if (!canCraft(inv, rcp)) return false;
    for (const m of rcp.mats) remove(inv, m.id, m.n);
    const left = add(inv, rcp.out.id, rcp.out.n);
    return left === 0;
  }

  /** 자리 여유 */
  function freeSlots(inv) {
    let n = 0;
    for (const s of inv.slots) if (!s) n++;
    return n;
  }

  /** 총 무게 느낌 (과부하 상태 판정용) — 슬롯 점유율로 간략화 */
  function load(inv) {
    let n = 0;
    for (const s of inv.slots) if (s) n++;
    return n / SIZE;
  }

  function serialize(inv) {
    return {
      slots: inv.slots.map(s => s ? { id: s.id, n: s.n, dur: s.dur } : null),
      weapon: inv.weapon,
      armorHead: inv.armorHead ? inv.armorHead.id : null,
      armorArm: inv.armorArm ? inv.armorArm.id : null
    };
  }

  function deserialize(data) {
    const inv = create();
    if (!data) return inv;
    (data.slots || []).forEach((s, i) => { if (s && def(s.id)) inv.slots[i] = { id: s.id, n: s.n, dur: s.dur }; });
    inv.weapon = data.weapon == null ? -1 : data.weapon;
    if (data.armorHead) inv.armorHead = { id: data.armorHead };
    if (data.armorArm) inv.armorArm = { id: data.armorArm };
    return inv;
  }

  return {
    SIZE, HOTBAR, create, add, remove, removeSlot, count, equip, isEquipped,
    weapon, wear, canCraft, craft, freeSlots, load, firstEmpty, serialize, deserialize
  };
})();
