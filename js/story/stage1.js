/* =============================================================================
   DEAD:SEOUL — story/stage1.js
   EPISODE 1 「막차」 — 2호선 5호차
   연출 디렉터(페이즈 머신) + 대사 스크립트

   페이즈
     intro    승객 도윤, 막차. 급정차.
     survey   상황 확인 (앞쪽으로 이동)
     outbreak 정전 → 4호차 관통문 → 첫 감염자
     armup    무기 확보 · 차량 내 감염자 3기 정리
     minseo   뒤쪽 생존자 접촉 → 의뢰 / 탈출 정보
     cock     비상 코크 수동 개방 (큰 소음 → 추가 유입)
     fire     6호차 화재 · 연기 유입 → 방독면
     escape   출입문 수동 개방 → 선로 대피
   ============================================================================= */
'use strict';

/* =============================================================================
   대사 스크립트
   ============================================================================= */
Object.assign(DS.Script, {

  intro: [
    { who: '', pal: 'narrator', text: '2026년 10월 14일 화요일, 02시 11분.\n2호선 하행 막차. 이 칸에 남은 승객은 일곱 명.' },
    { who: '도윤', pal: 'doyun', text: '…결산 자료 수정 열네 번. 신기록이다.' },
    { who: '도윤', pal: 'doyun', text: '다음 역에서 내려서 택시 타자. 할증 붙어도 상관없어. 더 못 버틴다.' },
    { who: '', pal: 'narrator', text: '창밖은 터널. 유리에 비친 자기 얼굴이 낯설다.\n열차가 속도를 줄인다. 아직 역이 아니다.' }
  ],

  intro_brake: [
    { who: '안내방송', pal: 'narrator', text: '「…열차가 비상 정차하였습니다. 승객 여러분께서는 자리에서 잠시—」\n(지직)' },
    { who: '도윤', pal: 'doyun', text: '또 신호 대기야? 이 시간에?' },
    { who: '', pal: 'narrator', text: '앞 칸 쪽에서 무언가 둔탁하게 부딪히는 소리가 두 번 났다.\n그리고 조용해졌다.' }
  ],

  outbreak: [
    { who: '', pal: 'narrator', text: '객실 등이 한꺼번에 꺼졌다.\n비상등의 붉은 빛만 남는다.' },
    { who: '도윤', pal: 'doyun', text: '…뭐야.' },
    { who: '', pal: 'narrator', text: '4호차 관통문이 바깥쪽에서 열린다.\n넘어오는 사람의 걸음이, 사람의 걸음이 아니다.' },
    { who: '도윤', pal: 'doyun', text: '저기요. 괜찮으세—' }
  ],

  first_kill: [
    { who: '도윤', pal: 'doyun', text: '……' },
    { who: '도윤', pal: 'doyun', text: '움직였어. 쓰러지고 나서도, 분명히.' },
    { who: '도윤', pal: 'doyun', text: '머리. 머리를 노려야 멈춘다. 영화에서 본 대로다.\n…영화 얘기를 할 상황이 아니지.' },
    { who: '', pal: 'narrator', text: '앞 칸에서 더 많은 발소리가 들린다.\n맨손으로는 안 된다. 쓸 만한 걸 찾아야 한다.' }
  ],

  armup_done: [
    { who: '도윤', pal: 'doyun', text: '하아… 하아….' },
    { who: '도윤', pal: 'doyun', text: '이 칸은 일단, 정리됐다.' }
  ],

  minseo_call: [
    { who: '???', pal: 'narrator', text: '「…저기요.」' },
    { who: '???', pal: 'narrator', text: '「거기 사람이에요? 사람이면 대답해 주세요. 제발.」' },
    { who: '도윤', pal: 'doyun', text: '사람입니다. 아직은.' }
  ],

  minseo: [
    { who: '민서', pal: 'minseo', text: '아… 진짜 사람이다. 진짜 사람.' },
    { who: '민서', pal: 'minseo', text: '저 6호차에서부터 뛰어왔어요. 거기는… 거기는 안 돼요. 보지 마세요.' },
    { who: '도윤', pal: 'doyun', text: '문은요. 이 문들 왜 안 열립니까.' },
    { who: '민서', pal: 'minseo', text: '전원이 끊겼어요. 그래서 자동 개방이 안 돼요.\n근데 저 수동으로 여는 법 알아요. 아빠가 기관사였어요.' },
    { who: '민서', pal: 'minseo', text: '출입문 옆에 노란 커버 보이죠? 그게 비상 코크예요.\n그거 당기면 공기압이 빠져서, 그 다음엔 손으로 밀어서 열 수 있어요.' },
    {
      who: '민서', pal: 'minseo',
      text: '…근데 하나만 부탁드려도 돼요?',
      choices: [
        {
          text: '말해 보세요.',
          act: (g) => { DS.Quest.start('q_bag', g); g.story.onQuestStarted(); },
          next: 'minseo_quest'
        },
        {
          text: '지금은 문부터 엽니다.',
          act: (g) => { g.story.minseoRefused = true; },
          next: 'minseo_cold'
        }
      ]
    }
  ],

  minseo_quest: [
    { who: '민서', pal: 'minseo', text: '제 가방이요. 도망치다가 떨어뜨렸어요.\n회색 백팩인데, 좌석 아래로 들어간 것 같아요. 앞쪽에서.' },
    { who: '민서', pal: 'minseo', text: '안에 약 있어요. 제 거예요. 하루라도 안 먹으면… 그냥, 필요해요.' },
    { who: '도윤', pal: 'doyun', text: '찾아보죠. 그쪽은 여기 가만히 있어요.' },
    { who: '민서', pal: 'minseo', text: '감사합니다. 진짜… 감사합니다.' }
  ],

  minseo_cold: [
    { who: '민서', pal: 'minseo', text: '…네. 맞아요. 문이 먼저죠.' },
    { who: '민서', pal: 'minseo', text: '코크 당기면 소리 커요. 많이 커요. 그것만 알아두세요.' }
  ],

  minseo_bag_done: [
    { who: '민서', pal: 'minseo', text: '이거… 이거 맞아요. 맞아요!' },
    { who: '민서', pal: 'minseo', text: '감사합니다. 이거 받으세요. 붕대랑, 물이요.\n저 혼자 다 들고 있어도 쓸모없어요.' },
    { who: '민서', pal: 'minseo', text: '아저씨, 저 데려가 주실 수 있어요?\n…아저씨라고 해서 죄송해요. 성함을 못 들었어요.' },
    { who: '도윤', pal: 'doyun', text: '김도윤입니다. 아저씨 맞아요.' },
    { who: '민서', pal: 'minseo', text: '서민서. 스물하나요.' },
    { who: '도윤', pal: 'doyun', text: '민서 씨. 문 열면 바로 따라와요. 뒤돌아보지 말고.' },
    { act: (g) => { g.story.companion = true; g.story.setFollow(); } }
  ],

  intercom: [
    { who: '', pal: 'narrator', text: '비상통화장치의 버튼을 누른다.\n수화 스피커에서 백색 잡음만 흐른다.' },
    { who: '도윤', pal: 'doyun', text: '…여보세요. 5호차입니다. 누구 들립니까.' },
    { who: '', pal: 'narrator', text: '지직—\n「…차장입니다… 관제… 응답… 터널에 진입하지 마… 6호차… 」\n통화가 끊긴다.' },
    { who: '도윤', pal: 'doyun', text: '터널에 진입하지 말라고? 그럼 어디로 가라는 건데.' }
  ],

  note_read: [
    { who: '', pal: 'narrator', text: '종이 쪽지. 급하게 쓴 글씨.' },
    { who: '승무원 메모', pal: 'narrator', text: '「02:0X 관제 연락 끊김. 터널 진입 금지 지시.\n승객 하차 유도 불가 — 6호차부터 번졌다.\n비상코크 수동 개방 후 선로 좌측 대피로.\n미안합니다.」' },
    { who: '도윤', pal: 'doyun', text: '선로 좌측 대피로. …여기 사람들을 두고 혼자 갔나.' },
    { who: '도윤', pal: 'doyun', text: '욕할 자격이 나한테 있나. 나도 지금 나갈 생각만 하고 있는데.' }
  ],

  cock_pulled: [
    { who: '', pal: 'narrator', text: '치익— 공기압이 빠지는 소리가 차량 전체에 울린다.\n생각보다 훨씬 크다.' },
    { who: '도윤', pal: 'doyun', text: '…이 소리를 저쪽에서 못 들었을 리가 없지.' }
  ],

  fire_start: [
    { who: '', pal: 'narrator', text: '6호차 관통문 유리가 안쪽에서 깨진다.\n불빛. 그리고 검은 연기가 바닥을 타고 밀려 들어온다.' },
    { who: '도윤', pal: 'doyun', text: '불이야? 지하에서?' },
    { who: '도윤', pal: 'doyun', text: '연기를 마시면 끝이다. 비상용품함. 방독면이 있을 거다.' },
    { who: '', pal: 'narrator', text: '객실 중앙, 세 번째 승강구 기둥에 붉은 함이 보인다.' }
  ],

  mask_on: [
    { who: '도윤', pal: 'doyun', text: '하… 숨소리가 내 귀에만 크게 들린다.' },
    { who: '도윤', pal: 'doyun', text: '문. 문을 밀어서 열어야 한다. 두 손으로.' }
  ],

  door_open: [
    { who: '', pal: 'narrator', text: '쿵— 하고 문짝이 레일에서 밀려난다.\n차가운 터널 공기가 들어온다. 쇠 냄새와 먼지 냄새.' },
    { who: '도윤', pal: 'doyun', text: '열렸다.' }
  ],

  escape_prompt: [
    { who: '도윤', pal: 'doyun', text: '선로로 내려가면 다시는 이 칸으로 못 돌아온다.\n챙길 게 있으면 지금 챙겨야 해.' }
  ]
});

/* =============================================================================
   디렉터
   ============================================================================= */
DS.Story1 = (function () {

  const U = DS.U;
  const T = DS.TILE;

  const S = {
    phase: 'intro',
    t: 0,
    game: null,
    killsInPhase: 0,
    companion: false,
    minseoRefused: false,
    cockPulled: false,
    doorOpen: false,
    maskOn: false,
    fireStarted: false,
    bagFound: false,
    talkedToMinseo: false,
    flags: {}
  };

  function init(game, opts) {
    S.game = game;
    S.phase = 'intro';
    S.t = 0;
    S.killsInPhase = 0;
    S.companion = false;
    S.minseoRefused = false;
    S.cockPulled = false;
    S.doorOpen = false;
    S.maskOn = false;
    S.fireStarted = false;
    S.bagFound = false;
    S.talkedToMinseo = false;
    S.flags = {};
    game.story = api;

    // 시작 소지품 — 비 예보가 있어 챙긴 우산, 야근용 박카스
    DS.Inventory.add(game.player.inv, 'phone', 1);
    DS.Inventory.add(game.player.inv, 'umbrella', 1);
    DS.Inventory.add(game.player.inv, 'bacchus', 1);
    DS.Inventory.add(game.player.inv, 'chocopie', 1);

    // 민서는 아직 숨어 있음 (대화 차단)
    const npc = game.propById('npc_minseo');
    if (npc) { npc.hidden = true; }
    const bag = game.propById('minseo_bag');
    if (bag) bag.hidden = true;

    game.lightsOn(true);
    DS.Audio.ambience('subway_idle');
    DS.Audio.music('calm');

    // 세이브 복원 시에는 오프닝 연출을 건너뛴다
    if (!(opts && opts.restore)) enter('intro');
  }

  /* -------------------------------------------------------------------------
     페이즈 전환
     ------------------------------------------------------------------------- */
  function enter(p) {
    S.phase = p;
    S.t = 0;
    S.killsInPhase = 0;
    const g = S.game;

    switch (p) {
      case 'intro':
        g.setObjective('—', '');
        DS.Dialogue.play('intro', () => {
          // 급정차 연출
          DS.Audio.sfx('brake');
          DS.FX.doShake(7);
          g.cameraKick(9);
          g.flickerLights(2.4);
          setTimeout(() => {
            DS.Dialogue.play('intro_brake', () => enter('survey'));
          }, 2300);
        });
        break;

      case 'survey':
        g.setObjective('상황을 확인한다', '열차 앞쪽(4호차 방향)으로 가 본다');
        DS.Audio.music('tension');
        g.toast('<b>WASD</b> 이동 · <b>Shift</b> 달리기 · <b>E</b> 상호작용', '');
        break;

      case 'outbreak':
        g.lightsOn(false);
        DS.Audio.sfx('power_down');
        DS.Audio.ambience('subway_dark');
        DS.Audio.music('panic');
        DS.FX.doShake(3);
        g.setObjective('살아남는다', '');
        DS.HUD.banner('EPISODE 1', '막차');
        DS.Dialogue.play('outbreak', () => {
          DS.Audio.sfx('scream', { vol: 0.8 });
          g.openGangway('left');
          g.spawnZombie('office', 'left');
          g.toast('<b>좌클릭 / Space</b> 공격 — 맨손은 거의 통하지 않는다.', 'warn');
          g.setObjective('감염자를 떨쳐낸다', '맨손으로는 무리다 — 무기를 찾아라');
        });
        break;

      case 'armup':
        g.setObjective('차량 안의 감염자를 정리한다', '0 / 3');
        g.toast('좌석 아래와 가방을 <b>E</b>로 수색할 수 있다.', '');
        g.toast('승강구 벽에 <b>소화기</b>가 보인다.', 'warn');
        // 3기가 시차를 두고 유입 — 한 번에 몰리지 않도록
        setTimeout(() => { if (S.phase === 'armup') S.game.spawnZombie('student', 'left'); }, 4200);
        setTimeout(() => { if (S.phase === 'armup') S.game.spawnZombie('office', 'left'); }, 12000);
        setTimeout(() => { if (S.phase === 'armup') S.game.spawnZombie('elder', 'left'); }, 21000);
        break;

      case 'minseo':
        DS.Dialogue.play('minseo_call', () => {
          const npc = S.game.propById('npc_minseo');
          if (npc) npc.hidden = false;
          const bag = S.game.propById('minseo_bag');
          if (bag) bag.hidden = false;
          S.game.setObjective('뒤쪽에서 들린 목소리를 확인한다', '6호차 방향 · 차량 끝');
        });
        break;

      case 'exitwork':
        S.game.setObjective('출구를 확보한다', '하부 2번 출입문 · 비상 코크를 당긴다');
        break;

      case 'fire':
        fireEvent();
        break;

      case 'escape':
        g.setObjective('선로로 내려간다', '선로 좌측 대피로');
        break;

      case 'done':
        break;
    }
  }

  /** 화재 이벤트 — 페이즈와 독립적으로 발생(이미 탈출 중이어도 연출은 진행) */
  function fireEvent() {
    if (S.fireStarted) return;
    const g = S.game;
    S.fireStarted = true;
    if (S.phase !== 'escape' && S.phase !== 'done') { S.phase = 'fire'; S.t = 0; }

    g.openGangway('right');
    g.startFire();
    DS.Audio.ambience('fire');
    DS.Audio.sfx('glass');
    DS.FX.doShake(4);
    DS.HUD.banner('WARNING', '6호차 화재');
    DS.Dialogue.play('fire_start', () => {
      if (S.doorOpen) g.setObjective('선로로 내려간다', '연기가 밀려온다 — 서둘러라');
      else g.setObjective('연기를 피해 탈출한다', '비상용품함에서 방독면을 확보한다');
    });
  }

  /** 세이브 복원용 — 연출 없이 페이즈/목표만 맞춤 */
  function restorePhase(p) {
    const g = S.game;
    S.phase = p || 'survey';
    const OBJ = {
      intro:      ['상황을 확인한다', '열차 앞쪽(4호차 방향)으로 가 본다'],
      survey:     ['상황을 확인한다', '열차 앞쪽(4호차 방향)으로 가 본다'],
      outbreak:   ['감염자를 떨쳐낸다', '맨손으로는 무리다 — 무기를 찾아라'],
      armup:      ['차량 안의 감염자를 정리한다', ''],
      armup_wait: ['차량 안의 감염자를 정리한다', ''],
      minseo:     ['뒤쪽에서 들린 목소리를 확인한다', '6호차 방향 · 차량 끝'],
      exitwork:   ['출구를 확보한다', '하부 2번 출입문 · 비상 코크를 당긴다'],
      fire:       ['연기를 피해 탈출한다', '비상용품함에서 방독면을 확보한다'],
      escape:     ['선로로 내려간다', '선로 좌측 대피로'],
      done:       ['선로로 내려간다', '선로 좌측 대피로']
    };
    const o = OBJ[S.phase] || OBJ.survey;
    if (S.phase === 'intro') S.phase = 'survey';
    g.setObjective(o[0], o[1]);
    if (S.phase === 'exitwork' && S.cockPulled) g.setObjective('출입문을 밀어서 연다', '하부 2번 출입문 · 길게 누르기');
  }

  /* -------------------------------------------------------------------------
     매 프레임
     ------------------------------------------------------------------------- */
  function update(dt, game) {
    S.t += dt;
    const p = game.player;

    switch (S.phase) {
      case 'survey':
        // 앞쪽(좌측)으로 충분히 이동하거나 일정 시간 경과
        if (!DS.Dialogue.isActive() && (p.x < 16 * T || S.t > 26)) enter('outbreak');
        break;

      case 'armup': {
        const need = 3;
        game.setObjective('차량 안의 감염자를 정리한다', `${Math.min(S.killsInPhase, need)} / ${need}`);
        // 안전장치: 스폰이 끝났는데 전멸 상태면 남은 수를 채운 것으로 간주
        if (S.t > 30 && game.aliveZombies() === 0 && S.killsInPhase > 0) S.killsInPhase = need;
        if (S.killsInPhase >= need && game.aliveZombies() === 0) {
          DS.Dialogue.play('armup_done', () => enter('minseo'));
          S.phase = 'armup_wait';
        }
        break;
      }

      case 'exitwork':
        // 코크 → 문 순서. 문이 열리면 탈출 페이즈
        if (S.doorOpen) enter('escape');
        break;

      case 'fire':
        if (S.doorOpen) enter('escape');
        break;
    }

    // 화재 이후 연기 전선 전진
    if (S.fireStarted) game.updateFire(dt);
  }

  /* -------------------------------------------------------------------------
     이벤트 훅
     ------------------------------------------------------------------------- */
  function onKill(z) {
    S.killsInPhase++;
    const g = S.game;
    if (S.phase === 'outbreak' && !S.flags.firstKill) {
      S.flags.firstKill = true;
      setTimeout(() => {
        if (S.phase === 'outbreak') DS.Dialogue.play('first_kill', () => enter('armup'));
      }, 700);
    }
  }

  /** 프롭 상호작용 완료 시 */
  function onProp(prop) {
    const g = S.game;

    if (prop.id === 'npc_minseo') {
      if (!S.talkedToMinseo) {
        S.talkedToMinseo = true;
        DS.Dialogue.play('minseo', () => {
          if (S.phase === 'minseo') enter('exitwork');
        });
      } else if (DS.Quest.isActive('q_bag') && DS.Inventory.count(g.player.inv, 'minseo_bag') > 0) {
        DS.Inventory.remove(g.player.inv, 'minseo_bag', 1);
        DS.Quest.complete('q_bag', g);
        DS.Dialogue.play('minseo_bag_done');
      } else if (DS.Quest.isActive('q_bag')) {
        DS.Dialogue.play([
          { who: '민서', pal: 'minseo', text: '회색 백팩이에요. 앞쪽 좌석 아래요. 꼭… 부탁드려요.' }
        ]);
      } else if (S.doorOpen) {
        DS.Dialogue.play([
          { who: '민서', pal: 'minseo', text: '문 열렸어요? 그럼 가요. 지금 가요.' },
          { act: () => { S.companion = true; api.setFollow(); } }
        ]);
      } else {
        DS.Dialogue.play([
          { who: '민서', pal: 'minseo', text: '코크부터요. 노란 커버. 아래로 당기면 돼요.' }
        ]);
      }
      return;
    }

    if (prop.id === 'minseo_bag') {
      S.bagFound = true;
      S.game.toast('<b>민서의 백팩</b>을 찾았다. 돌려주자.', 'get');
      return;
    }

    if (prop.id === 'cock_d2') {
      S.cockPulled = true;
      const door = g.propById('exit_d2');
      if (door) door.locked = false;
      DS.Audio.sfx('cock_pull');
      DS.Combat.noise(g, prop.px, prop.py, 170, 'cock');
      DS.Dialogue.play('cock_pulled', () => {
        g.setObjective('출입문을 밀어서 연다', '하부 2번 출입문 · 길게 누르기');
        // 소음에 반응해 추가 유입
        g.spawnZombie('office', 'left');
        setTimeout(() => { if (S.phase !== 'done') g.spawnZombie('student', 'left'); }, 2600);
        // 화재 이벤트 시작 (어떤 페이즈든 반드시 발생)
        setTimeout(() => { if (S.phase !== 'done') fireEvent(); }, 4500);
      });
      return;
    }

    if (prop.id === 'exit_d2') {
      S.doorOpen = true;
      DS.Audio.sfx('door_slide');
      DS.Combat.noise(g, prop.px, prop.py, 180, 'door');
      g.showTrackLights();
      DS.Dialogue.play('door_open', () => {
        if (S.companion) api.setFollow();
        enter('escape');
      });
      return;
    }

    if (prop.id === 'locker_emer') {
      // 방독면 획득 직후 착용 유도
      setTimeout(() => {
        if (DS.Inventory.count(g.player.inv, 'gasmask') > 0 && !S.maskOn) {
          g.toast('소지품(<b>Tab</b>)에서 <b>방독면</b>을 착용할 수 있다.', 'warn');
        }
      }, 400);
      return;
    }

    if (prop.id === 'note') {
      DS.Dialogue.play('note_read');
      return;
    }
  }

  function onMaskEquipped() {
    if (S.maskOn) return;
    S.maskOn = true;
    if (S.fireStarted) DS.Dialogue.play('mask_on');
  }

  function setFollow() {
    const g = S.game;
    const npc = g.npcs && g.npcs[0];
    if (npc) { npc.mode = 'follow'; }
    S.companion = true;
  }

  function onQuestStarted() {
    const g = S.game;
    g.setObjective('민서의 백팩을 찾는다', '앞쪽 하부 좌석 아래');
  }

  /* -------------------------------------------------------------------------
     탈출 → 엔딩
     ------------------------------------------------------------------------- */
  function onEscape() {
    if (S.phase === 'done') return;
    S.phase = 'done';
    const g = S.game;
    DS.Input.enabled = false;
    DS.Audio.music(null);
    DS.Audio.ambience('tunnel');

    const alone = !S.companion;
    const time = DS.U.mmss(g.stats.time);
    const body =
      (alone
        ? '선로 자갈 위로 내려선다. 발목이 꺾일 것 같다.\n뒤를 돌아본다. 열린 문 안쪽은 붉고, 조용하다.\n누군가 거기 남아 있었던 것 같은데, 생각하지 않기로 한다.'
        : '선로 자갈 위로 내려선다. 민서가 뒤따라 내려와 소매를 붙잡는다.\n「아저씨. 저 손전등 있어요.」\n둘의 그림자가 터널 벽에 길게 눕는다.')
      + '\n\n선로 좌측 대피로를 따라 걷는다.\n다음 역까지 1.2 km. 지상까지는, 아직 모른다.'
      + `\n\n─────────────\n생존 시간 ${time}   ·   처치 ${g.stats.kills}   ·   수색 ${g.stats.searched}`
      + (alone ? '\n동행 없음' : '\n동행 : 서민서(21)');

    setTimeout(() => {
      DS.HUD.cinema({
        kicker: 'EPISODE 1 — 막차 · 클리어',
        title: alone ? '혼자서, 지상까지 1.2 km' : '둘이서, 지상까지 1.2 km',
        text: body,
        button: '다음 화 예고',
        onNext: () => {
          DS.HUD.cinema({
            kicker: 'NEXT EPISODE',
            title: 'EPISODE 2 — 대합실',
            text: '셔터가 반쯤 내려진 개찰구.\n역무실 캐비닛, 편의점 진열대, 그리고 계단 위에서 들려오는 사이렌.\n\n지상은 이미 다르게 망가져 있다.\n\n— 프로토타입은 여기까지입니다 —',
            button: '타이틀로',
            onNext: () => { DS.HUD.cinemaHide(); S.game.toTitle(); }
          });
        }
      });
    }, 900);
  }

  /** 세이브용 */
  function serialize() {
    return {
      phase: S.phase, companion: S.companion, cockPulled: S.cockPulled,
      doorOpen: S.doorOpen, maskOn: S.maskOn, fireStarted: S.fireStarted,
      talkedToMinseo: S.talkedToMinseo, bagFound: S.bagFound, flags: S.flags
    };
  }

  function deserialize(d) {
    if (!d) return;
    Object.assign(S, d);
  }

  const api = {
    init, update, enter, onKill, onProp, onEscape, onMaskEquipped, setFollow, onQuestStarted,
    fireEvent, restorePhase, serialize, deserialize,
    get phase() { return S.phase; },
    get companion() { return S.companion; },
    set companion(v) { S.companion = v; },
    get cockPulled() { return S.cockPulled; },
    get doorOpen() { return S.doorOpen; },
    get fireStarted() { return S.fireStarted; },
    get maskOn() { return S.maskOn; },
    set maskOn(v) { S.maskOn = v; },
    get minseoRefused() { return S.minseoRefused; },
    set minseoRefused(v) { S.minseoRefused = v; },
    get state() { return S; }
  };
  return api;
})();
