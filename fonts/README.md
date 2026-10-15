# 폰트 — Galmuri (갈무리)

DEAD:SEOUL의 UI는 전부 비트맵 한글 픽셀폰트로 조판합니다.
안티에일리어싱을 끈 상태(`-webkit-font-smoothing: none`)로, 폰트의 픽셀 그리드 배수
(9 / 11 / 22 / 33 / 44 px)에서만 사용해야 도트가 또렷하게 유지됩니다.

## 수록 파일

| 파일 | 용도 |
|---|---|
| `Galmuri11.woff2` | 본문·메뉴·대사 (11px 기준) |
| `Galmuri11-Bold.woff2` | 강조·버튼·제목 |
| `Galmuri9.woff2` | 작은 라벨·수치·모노 느낌 표기 (9px) |

CDN을 참조하지 않고 저장소에 포함합니다. 오프라인·`file://`·사내망에서도
UI가 동일하게 보여야 하고, 폰트가 늦게 로드되면 도트가 아닌 기본 고딕으로
한 번 깜빡이기 때문입니다 (`font-display: block`).

## 라이선스

Copyright (c) 2019–2025 Lee Minseo (quiple@quiple.dev),
with Reserved Font Name "Galmuri".

This font software is licensed under the **SIL Open Font License, Version 1.1**.
전문과 FAQ: <https://scripts.sil.org/OFL>

- 원 저장소: <https://github.com/quiple/galmuri>
- 배포 버전: npm `galmuri@2.40.3` (`dist/` 에서 woff2만 추출)

OFL에 따라 폰트 파일 자체를 판매할 수 없으며, 파생 폰트를 만들 경우
"Galmuri"라는 이름을 쓸 수 없습니다. 게임에 임베드해 배포하는 것은 허용됩니다.
