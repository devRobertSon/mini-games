// ===========================================================================
//  게임 목록 (갤러리에 표시되는 메타데이터)
//  새 게임을 추가하려면 이 배열에 항목을 추가하고 games/<id>/ 폴더를 만드세요.
//  ES 모듈 미사용: 전역 MG.GAMES 에 등록.
// ===========================================================================

window.MG = window.MG || {};
window.MG.GAMES = [
  {
    id: "gate-rush",
    title: "GATE RUSH",
    desc: "갈림길 게이트에서 더 좋은 연산을 골라 유닛을 불려라. 위로 달리며 ×2, +10, ÷2 중 선택해 최종 보스를 돌파!",
    path: "games/gate-rush/index.html",
    icon: "🏃",
    banner: "linear-gradient(135deg,#3a2f6b 0%,#4dd0e1 100%)",
    tags: ["액션", "캐주얼", "픽셀"],
    available: true,
    // 갤러리 카드에 표시할 진행도 배지 (세이브 데이터 기반)
    badge(save) {
      if (!save) return null;
      const parts = [];
      if (save.progress?.unlocked > 1) {
        parts.push("최고 STAGE " + (save.progress.unlocked - 1));
      }
      if (save.slot) parts.push("이어하기 ●");
      return parts.length ? parts.join(" · ") : null;
    },
  },

  {
    id: "topwar",
    title: "TOP WAR",
    desc: "게이트로 병력 수와 화력 등급(★)을 키워 전투력으로 적과 보스를 돌파! 수를 늘릴까 등급을 올릴까 선택하는 머지형 게이트 러너.",
    path: "games/topwar/index.html",
    icon: "🪖",
    banner: "linear-gradient(135deg,#3a3a1a 0%,#ffd54d 100%)",
    tags: ["액션", "머지", "픽셀"],
    available: true,
    badge(save) {
      if (!save) return null;
      const parts = [];
      if (save.progress?.unlocked > 1) {
        parts.push("최고 STAGE " + (save.progress.unlocked - 1));
      }
      if (save.slot) parts.push("이어하기 ●");
      return parts.length ? parts.join(" · ") : null;
    },
  },

  // ---- 앞으로 추가할 게임 자리 (available:false 면 잠금 카드로 표시) ----
  {
    id: "coming-sudoku",
    title: "SUDOKU",
    desc: "준비 중",
    path: "#",
    icon: "🧩",
    banner: "linear-gradient(135deg,#2a2150 0%,#5cff8f 100%)",
    tags: ["퍼즐"],
    available: false,
    badge() {
      return null;
    },
  },
];
