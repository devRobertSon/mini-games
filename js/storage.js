// ===========================================================================
//  공통 저장소 (localStorage 래퍼)
//  - 게임별 네임스페이스로 세이브 데이터를 보관
//  - 로그인 세션 플래그(sessionStorage) 관리
//  - ES 모듈 미사용: 전역 MG.store 에 등록.
// ===========================================================================
(function () {
  window.MG = window.MG || {};

  const PREFIX = "mg:";
  const AUTH_KEY = PREFIX + "authed";

  /** 로그인 여부 */
  function isAuthed() {
    try {
      return sessionStorage.getItem(AUTH_KEY) === "1";
    } catch {
      return false;
    }
  }

  /** 로그인 상태 설정 */
  function setAuthed(value) {
    try {
      if (value) sessionStorage.setItem(AUTH_KEY, "1");
      else sessionStorage.removeItem(AUTH_KEY);
    } catch {
      /* 무시 */
    }
  }

  /** 게임 세이브 데이터 불러오기 (없으면 null) */
  function loadGame(gameId) {
    try {
      const raw = localStorage.getItem(PREFIX + "save:" + gameId);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  /** 게임 세이브 데이터 저장 */
  function saveGame(gameId, data) {
    try {
      localStorage.setItem(PREFIX + "save:" + gameId, JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  }

  /** 게임 세이브 데이터 삭제 */
  function clearGame(gameId) {
    try {
      localStorage.removeItem(PREFIX + "save:" + gameId);
    } catch {
      /* 무시 */
    }
  }

  window.MG.store = { isAuthed, setAuthed, loadGame, saveGame, clearGame };
})();
