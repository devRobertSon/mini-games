// ===========================================================================
//  GATE RUSH - 게이트 러너
//  순수 Canvas / 픽셀 아트 렌더링
//  (ES 모듈 미사용 — file:// 에서도 동작하도록 전역 MG 네임스페이스 사용)
// ===========================================================================
(function () {
  const { loadGame, saveGame, isAuthed } = window.MG.store;
  const { STAGES, endlessSlot, endlessMainDist, nextEndlessBossCount } =
    window.MG;

const GAME_ID = "gate-rush";

// 로그인 가드: 로그인 안 했으면 라이브러리로
if (!isAuthed()) {
  location.href = "../../index.html";
}

// ---------- 영구 저장 데이터 ----------
function loadData() {
  const d = loadGame(GAME_ID) || {};
  return {
    progress: {
      unlocked: d.progress?.unlocked ?? 1,
      best: d.progress?.best ?? {},
      bestEndless: d.progress?.bestEndless ?? 0,
    },
    slot: d.slot ?? null,
  };
}
let data = loadData();
function persist() {
  saveGame(GAME_ID, data);
}

// ---------- 캔버스 ----------
const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
const W = canvas.width;
const H = canvas.height;
ctx.imageSmoothingEnabled = false;

const SQUAD_Y = 540;
const PLAY_L = 40;
const PLAY_R = 360;
const CENTER = 200;

// ---------- DOM ----------
const hud = document.querySelector("#hud");
const hudArmy = document.querySelector("#hud-army");
const hudStage = document.querySelector("#hud-stage");
const $ = (s) => document.querySelector(s);
const overlays = ["#screen-select", "#screen-pause", "#screen-result"];

function hideOverlays() {
  overlays.forEach((s) => ($(s).hidden = true));
}
function show(sel) {
  hideOverlays();
  $(sel).hidden = false;
}

// ---------- 상태 ----------
let run = null;
let raf = null;
let lastT = 0;
let state = "menu"; // menu | playing | paused | result

// ===========================================================================
//  런(run) 생성
// ===========================================================================
function startStage(stage, restore) {
  run = {
    endless: false,
    stageId: stage.id,
    stageName: stage.name,
    speed: stage.speed,
    events: stage.events.map((e) => ({ ...e, resolved: false })),
    progress: restore ? restore.progress : 0,
    army: restore ? restore.army : stage.startArmy,
    px: CENTER,
    particles: [],
    flash: 0,
    borderFlash: 0,
    damageTexts: [],
    ended: false,
  };
  if (restore) markResolved();
}

function startEndless(restore) {
  run = {
    endless: true,
    stageId: "endless",
    stageName: "ENDLESS",
    seed: restore ? restore.seed : (Math.random() * 1e9) | 0,
    events: [],
    genIndex: 0,
    lastMainD: 0,
    progress: restore ? restore.progress : 0,
    army: restore ? restore.army : 40,
    px: CENTER,
    particles: [],
    flash: 0,
    borderFlash: 0,
    damageTexts: [],
    ended: false,
  };
  ensureEvents();
  if (restore) markResolved();
}

function ensureEvents() {
  const need = run.progress + 1400;
  while (run.lastMainD < need) {
    const i = run.genIndex++;
    for (const ev of endlessSlot(run.seed, i)) {
      run.events.push({ ...ev, resolved: false });
    }
    run.lastMainD = endlessMainDist(i);
  }
}

function markResolved() {
  for (const e of run.events) if (e.d <= run.progress) e.resolved = true;
}

// ===========================================================================
//  게임 로직
// ===========================================================================
function applyOp(n, op, val) {
  switch (op) {
    case "+": return n + val;
    case "-": return Math.max(0, n - val);
    case "*": return n * val;
    case "/": return Math.floor(n / val);
  }
  return n;
}

// 스쿼드(병사 무리)의 가로 반폭. drawSquad 의 배치(7열, 간격 14)와 동일하게 계산.
function squadHalfWidth() {
  const shown = Math.min(40, Math.max(1, Math.floor(run.army)));
  const cols = Math.min(7, shown);
  return ((cols - 1) / 2) * 14 + 4;
}

// 다음(아직 안 지난) 보스의 병력 수
function nextBossCount() {
  if (run.endless) return nextEndlessBossCount(run.progress);
  for (const e of run.events) if (e.type === "boss" && !e.resolved) return e.count;
  return Infinity; // 보스 없음 → 항상 중앙 점
}

// 게이트 판정용 스쿼드 반폭:
//  - 병사 < 다음 보스 → 중앙 점(0, 한 게이트만)
//  - 병사 ≥ 다음 보스 → "많음" 넓이(두 게이트에 걸칠 수 있음)
const SQUAD_WIDE_HALF = 46; // 7열 기준 스쿼드 반폭
function gateHalfWidth() {
  return run.army >= nextBossCount() ? SQUAD_WIDE_HALF : 0;
}

function resolveEvent(e) {
  e.resolved = true;
  const prev = run.army;
  if (e.type === "gate") {
    // 스쿼드 가로폭이 두 게이트(좌/우)에 얼마나 걸치는지로 판정.
    //  - 병사가 다음 보스보다 적으면 폭 0 → 사실상 중앙 점(한 게이트만)
    //  - 병사가 다음 보스보다 많으면 폭이 넓어 중앙을 가로지르면 두 게이트에 모두 걸침
    const half = gateHalfWidth();
    const lo = run.px - half;
    const hi = run.px + half;
    const leftOverlap = Math.max(0, Math.min(hi, CENTER) - Math.max(lo, PLAY_L));
    const rightOverlap = Math.max(0, Math.min(hi, PLAY_R) - Math.max(lo, CENTER));

    let order;
    if (leftOverlap > 0 && rightOverlap > 0) {
      // 두 게이트 모두 걸침 → 많이 닿은 쪽부터 둘 다 적용
      order =
        leftOverlap >= rightOverlap ? [e.left, e.right] : [e.right, e.left];
    } else if (rightOverlap > 0) {
      order = [e.right];
    } else if (leftOverlap > 0) {
      order = [e.left];
    } else {
      order = [run.px < CENTER ? e.left : e.right];
    }
    for (const g of order) run.army = applyOp(run.army, g.op, g.val);

    const good = run.army >= prev;
    spawnFlash(run.px, SQUAD_Y, good ? "#5cff8f" : "#ff4d6d", 10);
    // 게이트(− 또는 ÷)로 병사가 줄어도 동일하게 감소 표시
    if (run.army < prev) triggerDamage(prev - run.army);
  } else if (e.type === "enemy") {
    run.army = Math.max(0, run.army - e.count);
    spawnFlash(CENTER, SQUAD_Y - 30, "#ffd54d", 16);
    run.flash = 0.14;
    triggerDamage(prev - run.army);
  } else if (e.type === "obstacle") {
    // 스쿼드(가로 폭)가 장애물과 겹치면 충돌 → 보이는 접촉과 판정이 일치
    if (Math.abs(run.px - e.x) < e.w / 2 + squadHalfWidth()) {
      run.army = Math.floor(run.army * 0.9);
      spawnFlash(run.px, SQUAD_Y - 10, "#cfc4a0", 14);
      run.flash = 0.1;
      triggerDamage(prev - run.army);
    }
  } else if (e.type === "boss") {
    if (run.army >= e.count) {
      run.army -= e.count;
      run.flash = 0.2;
      spawnFlash(CENTER, SQUAD_Y - 20, "#ffd54d", 22);
      triggerDamage(e.count);
      if (!run.endless) {
        finish("win");
        return;
      }
      // 무한모드: 보스 격파 후 계속 진행
    } else {
      triggerDamage(run.army);
      run.army = 0;
    }
  }
  if (run.army <= 0 && !run.ended) {
    run.army = 0;
    finish("lose");
  }
}

function finish(result) {
  if (run.ended) return;
  run.ended = true;
  cancelAnimationFrame(raf);
  state = "result";

  // 영구 데이터 갱신
  if (!run.endless && result === "win") {
    data.progress.unlocked = Math.max(data.progress.unlocked, run.stageId + 1);
    data.progress.best[run.stageId] = Math.max(
      data.progress.best[run.stageId] || 0,
      Math.floor(run.army)
    );
  }
  if (run.endless) {
    data.progress.bestEndless = Math.max(
      data.progress.bestEndless,
      Math.floor(run.progress)
    );
  }
  data.slot = null; // 끝난 런의 세이브는 제거
  persist();

  // 결과 화면
  const title = $("#result-title");
  const sub = $("#result-sub");
  const nextBtn = $("#btn-next");
  if (result === "win") {
    title.textContent = "CLEAR!";
    title.style.color = "var(--good)";
    sub.textContent = "남은 유닛 " + formatNum(run.army);
    nextBtn.hidden = run.endless || !STAGES.find((s) => s.id === run.stageId + 1);
  } else {
    title.textContent = run.endless ? "GAME OVER" : "FAILED";
    title.style.color = "var(--accent)";
    sub.textContent = run.endless
      ? "도달 거리 " + Math.floor(run.progress) + "m"
      : "유닛이 전멸했습니다";
    nextBtn.hidden = true;
  }
  hud.hidden = true;
  show("#screen-result");
}

// ===========================================================================
//  업데이트
// ===========================================================================
function update(dt) {
  const speed = run.endless
    ? Math.min(600, 185 + run.progress * 0.009)
    : run.speed;
  run.progress += speed * dt;

  // 이동: 키보드
  const dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  if (dir !== 0) {
    run.px += dir * 300 * dt;
    pointerTarget = null;
  }
  // 이동: 포인터(드래그/터치)
  if (pointerTarget != null) {
    run.px += (pointerTarget - run.px) * Math.min(1, 18 * dt);
  }
  run.px = Math.max(PLAY_L + 14, Math.min(PLAY_R - 14, run.px));

  if (run.endless) ensureEvents();

  // 이벤트 처리
  for (const e of run.events) {
    if (!e.resolved && run.progress >= e.d) resolveEvent(e);
    if (run.ended) return;
  }

  if (run.endless) {
    run.events = run.events.filter(
      (e) => !e.resolved || e.d > run.progress - 200
    );
  }

  // 파티클
  for (const p of run.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
  }
  run.particles = run.particles.filter((p) => p.life > 0);
  if (run.flash > 0) run.flash -= dt;

  // 데미지 표시 효과 갱신
  if (run.borderFlash > 0) run.borderFlash -= dt;
  for (const t of run.damageTexts) t.life -= dt;
  run.damageTexts = run.damageTexts.filter((t) => t.life > 0);

  hudArmy.textContent = "🏃 " + formatNum(run.army);
}

// ===========================================================================
//  렌더링 (픽셀 아트)
// ===========================================================================
const FIG = ["·H·", "BBB", "·B·", "·B·", "L·L"];
const ALLY_PAL = { head: "#ffd9a0", body: "#4dd0e1", leg: "#2a2150" };
const ENEMY_PAL = { head: "#ffd9a0", body: "#ff4d6d", leg: "#2a0a16" };

// 보스 = 큰 장교 스프라이트 (모자 + 견장)
const OFFICER = [
  "·CCC·",
  "·HHH·",
  "GBBBG",
  "·BBB·",
  "·BBB·",
  "·B·B·",
  "·L·L·",
];
const OFFICER_COL = {
  C: "#1a1438", // 모자
  H: "#ffd9a0", // 얼굴
  B: "#b71c3a", // 몸(적군색)
  G: "#ffd54d", // 견장(금색)
  L: "#2a0a16", // 다리
};

function drawSprite(rows, cx, cy, s, colorOf) {
  const h = rows.length;
  const w = rows[0].length;
  const ox = Math.round(cx - (w * s) / 2);
  const oy = Math.round(cy - (h * s) / 2);
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const ch = rows[r][c];
      if (ch === "·") continue;
      ctx.fillStyle = colorOf(ch);
      ctx.fillRect(ox + c * s, oy + r * s, s, s);
    }
  }
}

function drawPixelFigure(cx, cy, pal, s) {
  const ox = Math.round(cx - (3 * s) / 2);
  const oy = Math.round(cy - (5 * s) / 2);
  for (let r = 0; r < 5; r++) {
    const row = FIG[r];
    for (let c = 0; c < 3; c++) {
      const ch = row[c];
      if (ch === "·") continue;
      ctx.fillStyle = ch === "H" ? pal.head : ch === "L" ? pal.leg : pal.body;
      ctx.fillRect(ox + c * s, oy + r * s, s, s);
    }
  }
}

function opLabel(g) {
  const sym = g.op === "*" ? "×" : g.op === "/" ? "÷" : g.op === "-" ? "−" : "+";
  return sym + g.val;
}

function drawRoad() {
  ctx.fillStyle = "#15122a";
  ctx.fillRect(PLAY_L - 6, 0, PLAY_R - PLAY_L + 12, H);
  ctx.fillStyle = "#3a2f6b";
  ctx.fillRect(PLAY_L - 6, 0, 4, H);
  ctx.fillRect(PLAY_R + 2, 0, 4, H);
  ctx.fillStyle = "rgba(154,146,196,0.22)";
  const off = run.progress % 40;
  for (let y = -40 + off; y < H; y += 40) ctx.fillRect(CENTER - 2, y, 4, 20);
}

function drawGateHalf(x1, x2, y, h, g) {
  const good = g.op === "+" || g.op === "*";
  ctx.fillStyle = good ? "#1d6b3a" : "#7a1030";
  ctx.fillRect(x1, y - h / 2, x2 - x1, h);
  ctx.fillStyle = good ? "#5cff8f" : "#ff4d6d";
  ctx.fillRect(x1, y - h / 2, x2 - x1, 3);
  ctx.fillRect(x1, y + h / 2 - 3, x2 - x1, 3);
  ctx.fillStyle = "#fff";
  ctx.font = '14px "Press Start 2P", monospace';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(opLabel(g), (x1 + x2) / 2, y);
}

function drawGate(e, y) {
  const h = 44;
  ctx.globalAlpha = e.resolved ? 0.22 : 1;
  drawGateHalf(PLAY_L, CENTER, y, h, e.left);
  drawGateHalf(CENTER, PLAY_R, y, h, e.right);
  ctx.fillStyle = "#0d0b1a";
  ctx.fillRect(CENTER - 2, y - h / 2, 4, h);
  ctx.globalAlpha = 1;
}

function drawEnemyGroup(e, y) {
  ctx.globalAlpha = e.resolved ? 0.2 : 1;
  // 적 병사를 가로로 일렬 배치 (플레이 영역 전체 폭에 균등 분포)
  const shown = Math.min(12, Math.max(4, Math.round(e.count / 12)));
  const left = PLAY_L + 16;
  const right = PLAY_R - 16;
  for (let i = 0; i < shown; i++) {
    const x = shown === 1 ? CENTER : left + (i * (right - left)) / (shown - 1);
    drawPixelFigure(x, y, ENEMY_PAL, 2);
  }
  ctx.fillStyle = "#ff6b81";
  ctx.font = '15px "Press Start 2P", monospace';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(formatNum(e.count), CENTER, y - 22);
  ctx.globalAlpha = 1;
}

function drawObstacle(e, y) {
  ctx.globalAlpha = e.resolved ? 0.25 : 1;
  const x = e.x - e.w / 2;
  const h = 26;
  // 본체
  ctx.fillStyle = "#5a5470";
  ctx.fillRect(x, y - h / 2, e.w, h);
  ctx.fillStyle = "#2a2540";
  ctx.fillRect(x, y + h / 2 - 4, e.w, 4);
  // 경고 줄무늬
  ctx.fillStyle = "#ffd54d";
  ctx.fillRect(x, y - h / 2, e.w, 3);
  // 윗면 가시
  ctx.fillStyle = "#ff6b3d";
  for (let sx = x + 3; sx < x + e.w - 3; sx += 9) {
    ctx.fillRect(sx, y - h / 2 - 5, 4, 5);
  }
  ctx.globalAlpha = 1;
}

function drawBoss(e, y) {
  ctx.globalAlpha = e.resolved ? 0.2 : 1;
  const w = PLAY_R - PLAY_L;
  ctx.fillStyle = "#2a0a16";
  ctx.fillRect(PLAY_L, y - 44, w, 88);
  ctx.fillStyle = "#ff4d6d";
  ctx.fillRect(PLAY_L, y - 44, w, 4);
  ctx.fillRect(PLAY_L, y + 40, w, 4);
  // 큰 장교 스프라이트
  drawSprite(OFFICER, CENTER, y + 6, 6, (ch) => OFFICER_COL[ch]);
  ctx.fillStyle = "#ffd54d";
  ctx.font = '17px "Press Start 2P", monospace';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("BOSS " + formatNum(e.count), CENTER, y - 58);
  ctx.globalAlpha = 1;
}

function drawSquad() {
  const n = Math.floor(run.army);
  const shown = Math.min(40, Math.max(1, n));
  const cols = 7;
  for (let i = 0; i < shown; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const rowCount = Math.min(cols, shown - r * cols);
    const x = run.px + (c - (rowCount - 1) / 2) * 14;
    const y = SQUAD_Y + r * 12;
    drawPixelFigure(x, y, ALLY_PAL, 2);
  }
  ctx.fillStyle = "#fff";
  ctx.font = '18px "Press Start 2P", monospace';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(formatNum(n), run.px, SQUAD_Y - 28);
}

function drawParticles() {
  for (const p of run.particles) {
    ctx.globalAlpha = Math.max(0, p.life * 2);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
  }
  ctx.globalAlpha = 1;
}

function render() {
  ctx.clearRect(0, 0, W, H);
  drawRoad();
  const sorted = [...run.events].sort((a, b) => a.d - b.d);
  for (const e of sorted) {
    const y = SQUAD_Y - (e.d - run.progress);
    if (y < -90 || y > H + 90) continue;
    if (e.type === "gate") drawGate(e, y);
    else if (e.type === "enemy") drawEnemyGroup(e, y);
    else if (e.type === "obstacle") drawObstacle(e, y);
    else if (e.type === "boss") drawBoss(e, y);
  }
  drawSquad();
  drawParticles();
  if (run.flash > 0) {
    ctx.fillStyle = "rgba(255,255,255," + run.flash * 1.4 + ")";
    ctx.fillRect(0, 0, W, H);
  }

  // 유닛 감소 표시 ① 빨간 테두리 깜빡임
  if (run.borderFlash > 0) {
    const t = run.borderFlash;
    const blink = Math.floor(t * 12) % 2 === 0 ? 0.95 : 0.25;
    const a = Math.min(1, t / 0.55) * blink;
    ctx.fillStyle = "rgba(255,40,70," + a + ")";
    const b = 14;
    ctx.fillRect(0, 0, W, b);
    ctx.fillRect(0, H - b, W, b);
    ctx.fillRect(0, 0, b, H);
    ctx.fillRect(W - b, 0, b, H);
  }
  // 유닛 감소 표시 ② 큰 -N 텍스트가 위로 떠오르며 사라짐
  for (const t of run.damageTexts) {
    const p = 1 - t.life; // 0 → 1
    const ty = SQUAD_Y - 80 - p * 55;
    ctx.globalAlpha = t.life > 0.35 ? 1 : t.life / 0.35;
    ctx.font = '24px "Press Start 2P", monospace';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#3a0010";
    ctx.fillText("-" + formatNum(t.amount), CENTER + 3, ty + 3);
    ctx.fillStyle = "#ff3b5c";
    ctx.fillText("-" + formatNum(t.amount), CENTER, ty);
    ctx.globalAlpha = 1;
  }
}

// 유닛이 줄었을 때 화면 표시(테두리 깜빡임 + 큰 -N 텍스트) 트리거
function triggerDamage(amount) {
  amount = Math.floor(amount);
  if (amount <= 0) return;
  run.borderFlash = 0.55;
  run.damageTexts.push({ amount, life: 1.0 });
}

function spawnFlash(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    run.particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 140,
      vy: (Math.random() - 0.5) * 140,
      life: 0.4,
      color,
    });
  }
}

function formatNum(n) {
  n = Math.floor(n);
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e4) return (n / 1e3).toFixed(1) + "K";
  return "" + n;
}

// ===========================================================================
//  루프
// ===========================================================================
function tick(t) {
  if (state !== "playing") return;
  const dt = Math.min(0.033, (t - lastT) / 1000 || 0);
  lastT = t;
  update(dt);
  if (state !== "playing") return; // finish() 가 상태를 바꿨을 수 있음
  render();
  raf = requestAnimationFrame(tick);
}

function beginLoop() {
  hideOverlays();
  hud.hidden = false;
  hudStage.textContent = run.stageName;
  state = "playing";
  lastT = performance.now();
  flashHint();
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(tick);
}

// ===========================================================================
//  메뉴 / 진입점
// ===========================================================================
function openSelect() {
  cancelAnimationFrame(raf);
  state = "menu";
  run = null;
  hud.hidden = true;
  data = loadData();
  renderSelect();
  show("#screen-select");
}

function renderSelect() {
  const cont = $("#continue-row");
  cont.innerHTML = "";
  if (data.slot) {
    const c = document.createElement("div");
    c.className = "continue-card";
    c.innerHTML = `<div class="ct-title">▶ 이어하기</div><div class="ct-sub">${data.slot.label} · 유닛 ${formatNum(
      data.slot.army
    )}</div>`;
    c.onclick = continueFromSlot;
    cont.appendChild(c);
  }

  const list = $("#stage-list");
  list.innerHTML = "";
  for (const st of STAGES) {
    const locked = st.id > data.progress.unlocked;
    const cell = document.createElement("div");
    cell.className = "stage-cell" + (locked ? " locked" : "");
    const best = data.progress.best[st.id];
    cell.innerHTML = `<div>${locked ? "🔒" : st.id}</div>${
      best ? `<div class="best">BEST ${formatNum(best)}</div>` : ""
    }`;
    if (!locked) cell.onclick = () => startStageById(st.id);
    list.appendChild(cell);
  }

  const endlessUnlocked = data.progress.unlocked > STAGES.length;
  const ec = document.createElement("div");
  ec.className = "stage-cell endless" + (endlessUnlocked ? "" : " locked");
  ec.innerHTML = endlessUnlocked
    ? `♾ ENDLESS${
        data.progress.bestEndless ? ` · BEST ${data.progress.bestEndless}m` : ""
      }`
    : "🔒 ENDLESS (모든 스테이지 클리어 시 해금)";
  if (endlessUnlocked) ec.onclick = startEndlessNew;
  list.appendChild(ec);
}

function startStageById(id) {
  const st = STAGES.find((s) => s.id === id);
  if (!st) return;
  pointerTarget = null;
  startStage(st);
  beginLoop();
}

function startEndlessNew() {
  pointerTarget = null;
  startEndless();
  beginLoop();
}

function continueFromSlot() {
  const s = data.slot;
  if (!s) return;
  pointerTarget = null;
  if (s.endless) startEndless(s);
  else startStage(STAGES.find((x) => x.id === s.stageId), s);
  beginLoop();
}

function saveRun() {
  if (!run || run.ended) {
    toast("저장할 게임이 없습니다");
    return;
  }
  data.slot = run.endless
    ? {
        endless: true,
        seed: run.seed,
        progress: Math.round(run.progress),
        army: Math.floor(run.army),
        savedAt: Date.now(),
        label: "ENDLESS",
      }
    : {
        endless: false,
        stageId: run.stageId,
        progress: Math.round(run.progress),
        army: Math.floor(run.army),
        savedAt: Date.now(),
        label: run.stageName,
      };
  persist();
  toast("저장 완료 💾");
}

function pause() {
  if (state !== "playing") return;
  state = "paused";
  cancelAnimationFrame(raf);
  show("#screen-pause");
}

function resume() {
  if (state !== "paused") return;
  hideOverlays();
  state = "playing";
  lastT = performance.now();
  raf = requestAnimationFrame(tick);
}

// ---------- 토스트 / 힌트 ----------
let toastTimer;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 1500);
}
function flashHint() {
  const h = $("#hint-controls");
  h.hidden = false;
  setTimeout(() => (h.hidden = true), 2500);
}

// ===========================================================================
//  입력
// ===========================================================================
const keys = { left: false, right: false };
window.addEventListener("keydown", (e) => {
  if (["ArrowLeft", "a", "A"].includes(e.key)) {
    keys.left = true;
    e.preventDefault();
  }
  if (["ArrowRight", "d", "D"].includes(e.key)) {
    keys.right = true;
    e.preventDefault();
  }
  if (
    (e.key === "Escape" || e.key === " " || e.key === "Spacebar") &&
    state === "playing"
  ) {
    e.preventDefault();
    pause();
  }
});
window.addEventListener("keyup", (e) => {
  if (["ArrowLeft", "a", "A"].includes(e.key)) keys.left = false;
  if (["ArrowRight", "d", "D"].includes(e.key)) keys.right = false;
});

let pointerTarget = null;
let dragging = false;
let lastDragX = 0;
function canvasX(clientX) {
  const r = canvas.getBoundingClientRect();
  return ((clientX - r.left) / r.width) * W;
}
canvas.addEventListener("pointerdown", (e) => {
  if (state !== "playing") return;
  dragging = true;
  lastDragX = canvasX(e.clientX);
  // 탭(누르기)만으로는 움직이지 않음: 현재 위치를 목표로 고정
  pointerTarget = run.px;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointermove", (e) => {
  if (!dragging || state !== "playing") return;
  // 드래그한 거리(손가락 이동량)만큼 상대 이동
  const x = canvasX(e.clientX);
  const base = pointerTarget == null ? run.px : pointerTarget;
  pointerTarget = Math.max(PLAY_L + 14, Math.min(PLAY_R - 14, base + (x - lastDragX)));
  lastDragX = x;
});
canvas.addEventListener("pointerup", () => (dragging = false));
canvas.addEventListener("pointercancel", () => (dragging = false));

// ===========================================================================
//  버튼 바인딩
// ===========================================================================
$("#btn-menu").onclick = openSelect;
$("#btn-quit").onclick = openSelect;
$("#btn-tomenu").onclick = openSelect;
$("#btn-save").onclick = saveRun;
$("#btn-save2").onclick = saveRun;
$("#btn-pause").onclick = pause;
$("#btn-resume").onclick = resume;
$("#btn-retry").onclick = () => {
  if (run.endless) startEndlessNew();
  else startStageById(run.stageId);
};
$("#btn-next").onclick = () => startStageById(run.stageId + 1);

// ---------- 시작 ----------
openSelect();
})();
