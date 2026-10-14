/* =============================================================================
   DEAD:SEOUL — data/items.js
   아이템 / 무기 / 제작 레시피 / 루트 테이블
   한국에서 실제로 구할 수 있는 물건만. (기획: 편의점·경찰서·소방함 파밍)
   ============================================================================= */
'use strict';

DS.Items = (function () {

  /* -------------------------------------------------------------------------
     무기 스탯
       dmg   피해량            range 유효 사거리(px, 1타일=16)
       arc   타격 각도(rad)     cd    쿨다운(초)
       knock 넉백(px/s)         stam  스태미나 소모
       dur   내구도(타격 횟수)  crit  배후/치명타 배율
       noise 소음 반경(px)      heavy 묵직한 무기(스윙 느림·경직 큼)
     ------------------------------------------------------------------------- */
  const DB = {
    /* ===== 무기 ===== */
    fists: {
      name: '맨손', icon: 'fists', kind: 'weapon', tag: 'WEAPON · 최후의 수단', stack: 1, noDrop: true,
      desc: '사무직 11년. 주먹은 키보드를 치는 데 최적화되어 있다. 좀비 두개골에는 전혀.',
      weapon: { dmg: 5, range: 14, arc: 1.5, cd: 0.42, knock: 14, stam: 5, dur: Infinity, crit: 1.6, noise: 26 }
    },
    umbrella: {
      name: '3단 우산', icon: 'umbrella', kind: 'weapon', tag: 'WEAPON · 타격', stack: 1,
      desc: '비 소식이 있어 챙겼다. 접힌 상태로 머리를 노리면 생각보다 아프다. 생각보다 빨리 휘어진다.',
      weapon: { dmg: 11, range: 21, arc: 1.25, cd: 0.44, knock: 26, stam: 6, dur: 34, crit: 1.8, noise: 34 }
    },
    pole: {
      name: '손잡이 봉', icon: 'pole', kind: 'weapon', tag: 'WEAPON · 둔기', stack: 1,
      desc: '좌석 사이 스테인리스 스탠션 폴. 용접부가 느슨해진 걸 발로 몇 번 걷어차 뜯어냈다. 무겁고, 길고, 잘 부러지지 않는다.',
      weapon: { dmg: 17, range: 27, arc: 1.15, cd: 0.6, knock: 42, stam: 9, dur: 72, crit: 2.0, noise: 44 }
    },
    cutter: {
      name: '커터칼', icon: 'cutter', kind: 'weapon', kindAlt: 'mat', tag: 'WEAPON · 자르기', stack: 1,
      desc: '서류 뜯을 때 쓰던 사무용 커터. 리치가 끔찍하게 짧지만, 급소를 긁으면 효율이 좋다. 제작 재료로도 쓴다.',
      weapon: { dmg: 8, range: 13, arc: 0.9, cd: 0.3, knock: 8, stam: 4, dur: 26, crit: 3.2, noise: 16 }
    },
    spear: {
      name: '급조 창', icon: 'spear', kind: 'weapon', tag: 'WEAPON · 찌르기 · 제작품', stack: 1,
      desc: '손잡이 봉 끝에 커터 날을 청테이프로 돌려 감았다. 물리지 않을 거리에서 찌를 수 있다는 게 전부지만, 그게 전부다.',
      weapon: { dmg: 21, range: 34, arc: 0.72, cd: 0.68, knock: 30, stam: 10, dur: 48, crit: 2.4, noise: 30 }
    },
    extinguisher: {
      name: '소화기', icon: 'extinguisher', kind: 'weapon', tag: 'WEAPON · 중량 · 분사', stack: 1,
      desc: '차량 비치 ABC 분말 소화기, 3.3kg. 두 손으로 내리찍으면 확실하다. 손잡이를 쥐면 분말을 뿌려 밀어낼 수도 있다.',
      weapon: { dmg: 27, range: 19, arc: 1.5, cd: 0.95, knock: 68, stam: 15, dur: 22, crit: 1.5, noise: 70, heavy: true },
      alt: { kind: 'spray', charges: 3, label: '분말 분사' }
    },
    baton: {
      name: '삼단봉', icon: 'baton', kind: 'weapon', tag: 'WEAPON · 경찰 장구', stack: 1,
      desc: '경찰 지급 삼단봉. 손목만으로 휘둘러도 제값을 한다. (지상 · 경찰서 구역)',
      weapon: { dmg: 19, range: 24, arc: 1.2, cd: 0.45, knock: 38, stam: 7, dur: 120, crit: 2.2, noise: 36 }
    },

    /* ===== 식량 / 음료 ===== */
    water: {
      name: '생수 500ml', icon: 'water', kind: 'drink', tag: 'DRINK', stack: 5,
      desc: '편의점 PB 생수. 지금 이 열차에서 가장 값비싼 물건.',
      use: { thirst: 42, time: 1.6, sfx: 'drink' }
    },
    banana_milk: {
      name: '바나나맛우유', icon: 'banana_milk', kind: 'drink', tag: 'DRINK · FOOD', stack: 3,
      desc: '뚱바. 유통기한은 어제까지. 상관없다.',
      use: { thirst: 24, hunger: 12, time: 2.0, sfx: 'drink' }
    },
    bacchus: {
      name: '박카스', icon: 'bacchus', kind: 'drink', tag: 'DRINK · 각성', stack: 4,
      desc: '야근의 동반자. 타우린 2000mg. 다리가 한동안 덜 무겁다.',
      use: { thirst: 14, stamina: 55, buff: { id: 'wired', time: 40 }, time: 1.2, sfx: 'drink' }
    },
    gimbap: {
      name: '삼각김밥', icon: 'gimbap', kind: 'food', tag: 'FOOD', stack: 4,
      desc: '전주비빔. 포장을 1번 2번 3번 순서로 뜯어야 김이 안 찢어진다. 이런 걸 아직도 기억한다.',
      use: { hunger: 34, thirst: -5, time: 2.4, sfx: 'eat' }
    },
    chocopie: {
      name: '초코파이', icon: 'chocopie', kind: 'food', tag: 'FOOD', stack: 6,
      desc: '누군가의 가방에서 나온 낱개 포장. 열량은 정직하다.',
      use: { hunger: 19, thirst: -4, time: 1.4, sfx: 'eat' }
    },
    soju: {
      name: '소주', icon: 'soju', kind: 'drink', kindAlt: 'mat', tag: 'DRINK · 소독 · 재료', stack: 2,
      desc: '회식 후 누가 들고 탄 미개봉 참이슬. 도수 16.5%. 마시면 잠깐 아픈 게 잊히고, 붓는 데 쓰면 소독이 된다.',
      use: { thirst: 10, hp: 4, hunger: 3, buff: { id: 'drunk', time: 30 }, time: 1.8, sfx: 'drink' }
    },

    /* ===== 치료 ===== */
    bandage: {
      name: '붕대', icon: 'bandage', kind: 'med', tag: 'MED · 지혈', stack: 4,
      desc: '차량 비상용품함의 구급 붕대. 출혈을 멈춘다. 멈추는 것까지만.',
      use: { hp: 16, cureBleed: true, time: 2.6, sfx: 'heal' }
    },
    bandage_clean: {
      name: '소독 붕대', icon: 'bandage_clean', kind: 'med', tag: 'MED · 지혈 · 제작품', stack: 4,
      desc: '손수건을 소주에 적셔 감은 것. 덧나는 걸 늦춘다. 의학적 근거는 각자 믿는 대로.',
      use: { hp: 34, cureBleed: true, time: 3.0, sfx: 'heal' }
    },

    /* ===== 보호구 ===== */
    gasmask: {
      name: '방독면', icon: 'gasmask', kind: 'armor', tag: 'ARMOR · 머리 · 호흡', stack: 1,
      desc: '전동차 비상용품함의 화재용 방연 마스크. 연기 속에서 숨을 쉴 수 있다. 시야는 좁아지고, 숨소리가 자기 귀에만 크게 들린다.',
      armor: { slot: 'head', gas: true, bite: 0.0, label: '연기 면역' }
    },
    armguard: {
      name: '임시 팔 보호대', icon: 'armguard', kind: 'armor', tag: 'ARMOR · 팔 · 제작품', stack: 1,
      desc: '무가지를 팔뚝에 대고 청테이프로 돌려 감았다. 영화에서 본 그대로. 영화에서처럼 되기를 바랄 뿐이다.',
      armor: { slot: 'arm', bite: 0.45, label: '물림 피해 -45%' }
    },

    /* ===== 재료 ===== */
    tape: {
      name: '청테이프', icon: 'tape', kind: 'mat', tag: 'MATERIAL', stack: 3,
      desc: '승무원실 공구함에서 굴러나온 면테이프. 이 사태에서 가장 쓸모 있는 공업 제품.'
    },
    magazine: {
      name: '지하철 무가지', icon: 'magazine', kind: 'mat', tag: 'MATERIAL', stack: 8,
      desc: '좌석 틈에 끼어 있던 무료 신문. 어제 날짜 1면: "원인 불명 집단 발열, 당국 조사 착수".'
    },
    cloth: {
      name: '손수건', icon: 'cloth', kind: 'mat', tag: 'MATERIAL', stack: 4,
      desc: '누군가 떨어뜨린 깨끗한 손수건.'
    },
    empty_bottle: {
      name: '빈 페트병', icon: 'empty_bottle', kind: 'mat', tag: 'MATERIAL', stack: 5,
      desc: '바닥을 구르던 빈 병. 아직 쓸 데가 있다.'
    },

    molotov: {
      name: '화염병', icon: 'soju', kind: 'weapon', tag: 'WEAPON · 투척 · 지상 전용', stack: 2,
      desc: '병에 술을 담고 천으로 막은 것. 지하 터널에서는 절대 쓰지 않는다 — 산소를 같이 태운다.',
      weapon: { dmg: 30, range: 90, arc: 0.4, cd: 1.6, knock: 10, stam: 8, dur: 1, crit: 1, noise: 140, thrown: true }
    },

    /* ===== 도구 / 퀘스트 ===== */
    phone: {
      name: '스마트폰', icon: 'phone', kind: 'tool', tag: 'TOOL · 조명', stack: 1, noDrop: true,
      desc: '배터리 38%. 지하라 신호는 없다. 손전등으로는 쓸 수 있다. (F)',
      use: { toggleLight: true, time: 0 }
    },
    minseo_bag: {
      name: '민서의 백팩', icon: 'bag', kind: 'quest', tag: 'QUEST ITEM', stack: 1, noDrop: true,
      desc: '회색 백팩. 한쪽 끈이 끊어져 있다. 안에서 약통이 덜그럭거린다.'
    },
    note_notice: {
      name: '승무원 메모', icon: 'note', kind: 'quest', tag: 'DOCUMENT', stack: 1,
      desc: '운전실 문틈에 끼워져 있던 쪽지.\n\n"02:0X 관제 연락 끊김. 터널 진입 금지 지시. 승객 하차 유도 불가 — 6호차부터 번졌다. 비상코크 수동 개방 후 선로 좌측 대피로. 미안합니다."'
    }
  };

  /* 보조: 기본 필드 채우기 */
  for (const id in DB) {
    const it = DB[id];
    it.id = id;
    if (it.stack == null) it.stack = 1;
    if (!it.icon) it.icon = id;
  }

  const get = (id) => DB[id] || null;
  const name = (id) => (DB[id] ? DB[id].name : id);
  const isWeapon = (id) => !!(DB[id] && DB[id].weapon);

  /* -------------------------------------------------------------------------
     제작 레시피
     ------------------------------------------------------------------------- */
  const RECIPES = [
    {
      id: 'r_armguard', out: { id: 'armguard', n: 1 }, time: 3.2,
      mats: [{ id: 'tape', n: 1 }, { id: 'magazine', n: 2 }],
      hint: '부산행에서 본 그 방법. 신문지를 겹쳐 팔뚝에 대고 테이프로 감는다.'
    },
    {
      id: 'r_spear', out: { id: 'spear', n: 1 }, time: 4.0,
      mats: [{ id: 'pole', n: 1 }, { id: 'cutter', n: 1 }, { id: 'tape', n: 1 }],
      hint: '봉 끝에 날을 고정한다. 리치가 곧 생존이다.'
    },
    {
      id: 'r_bandage_clean', out: { id: 'bandage_clean', n: 1 }, time: 2.4,
      mats: [{ id: 'cloth', n: 1 }, { id: 'soju', n: 1 }],
      hint: '손수건을 소주에 적신다. 쓰라리지만 덧나는 건 늦출 수 있다.'
    },
    {
      id: 'r_molotov', out: { id: 'molotov', n: 1 }, time: 3.0,
      mats: [{ id: 'empty_bottle', n: 1 }, { id: 'cloth', n: 1 }, { id: 'soju', n: 1 }],
      locked: '지하에서 불을 지르면 우리도 같이 구워진다. — 지상으로 나가기 전엔 만들지 않는다.',
      hint: '병에 술을 담고 천으로 막는다. 지상에서라면.'
    }
  ];

  /* -------------------------------------------------------------------------
     수색 루트 테이블
       pool: [[아이템, 가중치, 최소, 최대], ...]  / rolls: 굴림 횟수 / empty: 꽝 가중치
     ------------------------------------------------------------------------- */
  const LOOT = {
    seat: {          // 좌석 아래 / 틈
      label: '좌석 아래', rolls: 1, empty: 34,
      pool: [['magazine', 26, 1, 2], ['chocopie', 10, 1, 1], ['empty_bottle', 14, 1, 1],
             ['cloth', 9, 1, 1], ['banana_milk', 6, 1, 1], ['cutter', 4, 1, 1]]
    },
    bag: {           // 승객 가방
      label: '가방', rolls: 2, empty: 12,
      pool: [['water', 20, 1, 1], ['gimbap', 14, 1, 1], ['chocopie', 13, 1, 2],
             ['bacchus', 10, 1, 1], ['cloth', 11, 1, 1], ['tape', 7, 1, 1],
             ['soju', 6, 1, 1], ['bandage', 6, 1, 1], ['cutter', 5, 1, 1], ['magazine', 8, 1, 1]]
    },
    body: {          // 쓰러진 승객
      label: '시신', rolls: 2, empty: 18,
      pool: [['water', 16, 1, 1], ['bandage', 10, 1, 1],
             ['banana_milk', 12, 1, 1], ['magazine', 10, 1, 1], ['tape', 8, 1, 1],
             ['soju', 7, 1, 1], ['gimbap', 10, 1, 1], ['empty_bottle', 9, 1, 1]]
    },
    emergency: {     // 비상용품함
      label: '비상용품함', rolls: 3, empty: 0,
      pool: [['gasmask', 100, 1, 1], ['bandage', 100, 2, 2], ['tape', 60, 1, 1]]
    },
    crew: {          // 승무원실 공구함
      label: '승무원실 공구함', rolls: 2, empty: 8,
      pool: [['tape', 40, 1, 2], ['cutter', 22, 1, 1], ['cloth', 18, 1, 1], ['water', 14, 1, 1]]
    },
    trash: {
      label: '쓰레기', rolls: 1, empty: 55,
      pool: [['empty_bottle', 40, 1, 1], ['magazine', 30, 1, 1], ['cloth', 10, 1, 1]]
    }
  };

  /** 루트 테이블 굴림 → [{id, n}, ...] */
  function roll(tableId) {
    const t = LOOT[tableId];
    if (!t) return [];
    const out = [];
    for (let r = 0; r < t.rolls; r++) {
      let total = t.empty || 0;
      for (const p of t.pool) total += p[1];
      let v = Math.random() * total;
      if ((t.empty || 0) > 0) { v -= t.empty; if (v <= 0) continue; }
      for (const p of t.pool) {
        v -= p[1];
        if (v <= 0) {
          if (!DB[p[0]]) break;
          const n = DS.U.randInt(p[2], p[3]);
          if (n > 0) out.push({ id: p[0], n });
          break;
        }
      }
    }
    // 같은 아이템 합치기
    const merged = [];
    for (const o of out) {
      const e = merged.find(m => m.id === o.id);
      if (e) e.n += o.n; else merged.push(o);
    }
    return merged;
  }

  return { DB, get, name, isWeapon, RECIPES, LOOT, roll };
})();
