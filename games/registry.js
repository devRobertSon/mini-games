// ===========================================================================
//  게임 목록 (갤러리에 표시되는 메타데이터)
//  새 게임을 추가하려면 이 배열에 항목을 추가하고 games/<id>/ 폴더를 만드세요.
// ===========================================================================

export const GAMES = [
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

  // ---- 앞으로 추가할 게임 자리 (available:false 면 잠금 카드로 표시) ----
  {
    id: "coming-2048",
    title: "2048",
    desc: "준비 중",
    path: "#",
    icon: "🔢",
    banner: "linear-gradient(135deg,#2a2150 0%,#4dd0e1 100%)",
    tags: ["퍼즐"],
    available: false,
    badge() {
      return null;
    },
  },
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
