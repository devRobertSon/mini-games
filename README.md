# 🎮 Mini Games Arcade

GitHub Pages에서 바로 동작하는 미니게임 모음. 비밀번호 로그인 → 갤러리에서 게임 선택 → 플레이.

순수 **HTML · CSS · JavaScript** (빌드 도구 없음). 정적 호스팅만으로 동작합니다.

> 각 게임의 **플레이 방법(조작·규칙)은 게임을 선택하면 그 게임의 시작 화면**에 표시됩니다.
> 이 README에는 개별 게임 설명을 두지 않습니다.

## 바로 보기

GitHub Pages를 켜면 `https://<사용자>.github.io/<레포>/` 에서 동작합니다.

- 저장소 **Settings → Pages → Branch** 를 배포 브랜치로 지정
- 기본 비밀번호: **`minigame`**

## 구조

```
index.html            로그인 게이트 + 갤러리
css/style.css         공통 스타일 (픽셀/레트로 테마)
js/
  config.js           비밀번호 SHA-256 해시
  auth.js             해시 검증 (Web Crypto)
  storage.js          공통 세이브/로드 (localStorage)
  main.js             셸 컨트롤러 (로그인 → 갤러리)
games/
  registry.js         갤러리에 표시할 게임 메타데이터
  <게임>/             게임별 폴더 (index.html / style.css / game.js …)
```

## 로그인 / 보안에 대한 솔직한 안내

정적 사이트에는 서버가 없어 **완벽한 비밀번호 보안은 불가능**합니다. 이 로그인은
*가벼운 출입문* 수준입니다. 다만 비밀번호의 **SHA-256 해시만** 코드에 두어 평문
노출은 막았습니다.

### 비밀번호 변경

1. 사이트 주소 끝에 `#sethash` 를 붙여 접속 (예: `.../index.html#sethash`)
2. 새 비밀번호 입력 → 표시되는 해시 복사
3. `js/config.js` 의 `PASSWORD_HASH` 에 붙여넣고 커밋·푸시

## 저장 / 불러오기

- 진행 상황은 브라우저 **localStorage** 에 저장됩니다 (같은 브라우저에서만 유지).
- 게임 중 **💾 저장** → 시작/선택 화면의 **▶ 이어하기** 로 복원.

## 게임 추가하기

1. `games/<id>/` 폴더 생성 (`index.html` + 게임 로직)
2. `games/registry.js` 배열에 항목 추가 (`available: true`)
3. 게임 시작 화면에 **플레이 방법** 안내를 포함

## 제작 안내

각 게임의 이름·코드·그래픽은 모두 독자적으로 제작되었습니다. 게임 메커니즘(게이트
러너, 레인 슈터 등)은 여러 캐주얼 게임이 공유하는 일반적인 방식입니다.
