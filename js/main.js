// ===========================================================================
//  셸 컨트롤러: 로그인 → 갤러리 흐름
//  (ES 모듈 미사용 — file:// 에서도 동작하도록 전역 MG 네임스페이스 사용)
// ===========================================================================
(function () {
  const { PASSWORD_HASH, GAMES, verifyPassword, sha256Hex } = window.MG;
  const { isAuthed, setAuthed, loadGame } = window.MG.store;

const $ = (sel) => document.querySelector(sel);

const loginScreen = $("#login-screen");
const galleryScreen = $("#gallery-screen");
const sethashScreen = $("#sethash-screen");

function show(screen) {
  for (const s of [loginScreen, galleryScreen, sethashScreen]) {
    s.hidden = s !== screen;
  }
}

// ---------- 갤러리 렌더링 ----------
function renderGallery() {
  const grid = $("#game-grid");
  grid.innerHTML = "";

  for (const game of GAMES) {
    const card = document.createElement("div");
    card.className = "game-card" + (game.available ? "" : " locked");

    const save = game.available ? loadGame(game.id) : null;
    const badge = game.badge ? game.badge(save) : null;

    card.innerHTML = `
      <div class="card-banner" style="background:${game.banner}">${game.icon}</div>
      <div class="card-body">
        <div class="card-title">${game.title}</div>
        <div class="card-desc">${game.desc}</div>
        ${badge ? `<div class="card-progress">${badge}</div>` : ""}
        <div class="card-tags">
          ${game.tags.map((t) => `<span class="tag">${t}</span>`).join("")}
          ${game.available ? "" : '<span class="tag">잠김</span>'}
        </div>
      </div>`;

    if (game.available) {
      card.addEventListener("click", () => {
        window.location.href = game.path;
      });
    }
    grid.appendChild(card);
  }
}

// ---------- 로그인 ----------
function setupLogin() {
  const form = $("#login-form");
  const input = $("#password-input");
  const errorEl = $("#login-error");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.hidden = true;
    try {
      const ok = await verifyPassword(input.value, PASSWORD_HASH);
      if (ok) {
        setAuthed(true);
        enterGallery();
      } else {
        errorEl.textContent = "비밀번호가 틀렸습니다";
        errorEl.hidden = false;
        input.value = "";
        input.focus();
      }
    } catch (err) {
      // 어떤 경우에도 조용히 멈추지 않도록 오류를 표시
      console.error("login error:", err);
      errorEl.textContent = "로그인 처리 오류: " + (err?.message || err);
      errorEl.hidden = false;
    }
  });
}

function enterGallery() {
  renderGallery();
  show(galleryScreen);
}

// ---------- 로그아웃 ----------
function setupLogout() {
  $("#logout-btn").addEventListener("click", () => {
    setAuthed(false);
    show(loginScreen);
    $("#password-input").value = "";
    $("#password-input").focus();
  });
}

// ---------- 해시 생성기 (#sethash) ----------
function setupSethash() {
  const input = $("#sethash-input");
  const output = $("#sethash-output");
  input.addEventListener("input", async () => {
    output.textContent = input.value
      ? await sha256Hex(input.value)
      : "여기에 해시가 표시됩니다";
  });
}

// ---------- 초기화 ----------
function init() {
  setupLogin();
  setupLogout();
  setupSethash();

  if (location.hash === "#sethash") {
    show(sethashScreen);
    $("#sethash-input").focus();
    return;
  }

  if (isAuthed()) {
    enterGallery();
  } else {
    show(loginScreen);
    $("#password-input").focus();
  }
}

init();
})();
