// ===========================================================================
//  LANE FORCE - 3레인 실시간 사격 생존
//   성장 레인(왼): +1 게이트 통과 → 병사 +1
//   적 레인(중): 졸병/보스가 내려옴 → 못 막으면 병력 감소
//   무기 레인(오): 정지한 무기를 부수면 발사속도/데미지 업그레이드
//   DPS = 병사수 × 발사속도 × 발당 데미지. 부대는 "선 레인"만 사격.
//  ES 모듈 미사용 — 전역 MG 네임스페이스.
// ===========================================================================
(function () {
  const { loadGame, saveGame, isAuthed } = window.MG.store;
  const GAME_ID = "lane-force";

  if (!isAuthed()) location.href = "../../index.html";

  // ---------- 저장 데이터 ----------
  function loadData() {
    const d = loadGame(GAME_ID) || {};
    return { bestScore: d.bestScore || 0, slot: d.slot || null };
  }
  let data = loadData();
  function persist() {
    saveGame(GAME_ID, data);
  }

  // ---------- 캔버스 / 레인 ----------
  const canvas = document.getElementById("game-canvas");
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;
  ctx.imageSmoothingEnabled = false;

  const PLAY_L = 40;
  const PLAY_R = 360;
  const LANE_W = (PLAY_R - PLAY_L) / 3;
  const SQUAD_Y = 610;
  const LANE_NAMES = ["성장", "적", "무기"];
  const laneOf = (px) =>
    Math.min(2, Math.max(0, Math.floor((px - PLAY_L) / LANE_W)));
  const laneCenter = (l) => PLAY_L + LANE_W * (l + 0.5);

  // ---------- DOM ----------
  const $ = (s) => document.querySelector(s);
  const hud = $("#hud");
  const hudArmy = $("#hud-army");
  const hudStage = $("#hud-stage");
  const hudPower = $("#hud-power");
  const overlays = ["#screen-select", "#screen-pause", "#screen-result"];
  function hideOverlays() {
    overlays.forEach((s) => ($(s).hidden = true));
  }
  function show(sel) {
    hideOverlays();
    $(sel).hidden = false;
  }

  let run = null;
  let raf = null;
  let lastT = 0;
  let state = "menu";

  // ---------- 무기 생성 ----------
  // 무기 5개 스택 (아래=가까움 → 위, 정지)
  const WEAPON_SLOTS_Y = [440, 360, 280, 200, 120];
  function makeWeapon(level, y) {
    const rate = Math.random() < 0.5;
    const info = rate
      ? { type: "rate", val: 0.4, label: "⚡속도+0.4" }
      : { type: "dmg", val: 1, label: "🔥뎀+1" };
    const hp = Math.round(40 * Math.pow(1.3, level));
    return { hp, maxhp: hp, info, level, y };
  }

  // ---------- 런 생성 ----------
  function newRun(restore) {
    run = {
      army: restore ? restore.army : 10,
      fireRate: restore ? restore.fireRate : 2,
      dmg: restore ? restore.dmg : 1,
      px: laneCenter(1),
      enemies: [],
      gates: [],
      bullets: [],
      weaponLevel: restore ? restore.weaponLevel : 0,
      weapons: [],
      elapsed: restore ? restore.elapsed : 0,
      kills: restore ? restore.kills || 0 : 0,
      score: restore ? restore.score || 0 : 0,
      gateT: 0,
      enemyT: 0.3,
      bossT: 14,
      fireAcc: 0,
      flash: 0,
      borderFlash: 0,
      floats: [],
      meleeAcc: 0,
      meleeTextT: 0,
      ended: false,
    };
    run.weapons = WEAPON_SLOTS_Y.map((y, i) => makeWeapon(run.weaponLevel + i, y));
  }

  // ---------- 효과 텍스트 ----------
  function floatText(text, x, y, color) {
    run.floats.push({ text, x, y, color, life: 1.0 });
  }
  function triggerDamage(amount) {
    amount = Math.floor(amount);
    if (amount <= 0) return;
    run.borderFlash = 0.5;
    floatText("-" + formatNum(amount), run.px, SQUAD_Y - 80, "#ff3b5c");
  }

  function killEnemy(en) {
    en.dead = true;
    run.kills++;
    run.score += en.boss ? 25 : 1;
    if (en.boss) run.flash = 0.18;
  }
  // 무기 파괴 → 정보대로 업그레이드 + 같은 칸에 더 강한 무기 보충(항상 5개)
  function destroyWeapon(w) {
    if (w.info.type === "rate")
      run.fireRate = +(run.fireRate + w.info.val).toFixed(2);
    else run.dmg += w.info.val;
    floatText(w.info.label, laneCenter(2), w.y, "#ffd54d");
    run.flash = 0.12;
    run.weaponLevel++;
    const idx = run.weapons.indexOf(w);
    if (idx >= 0) run.weapons[idx] = makeWeapon(run.weaponLevel, w.y);
  }

  // 총알 1발(관통 없음): 부대 폭 안 한 곳에서 위로 발사, 데미지는 인자로 받음
  const MAX_BULLETS = 90; // 동시 총알 상한(보이는 수 절감)
  const SHOOTER_CAP = 20; // 동시 사격 "대표" 병사 수 상한
  function spawnBullet(dmg) {
    run.bullets.push({
      x: run.px + (Math.random() - 0.5) * 96,
      y: SQUAD_Y - 24,
      vy: -560,
      dmg,
    });
  }

  // ===========================================================================
  //  업데이트
  // ===========================================================================
  function update(dt) {
    const e = (run.elapsed += dt);
    // 난이도 시간 D: 1000점 전에는 경과시간과 동일, 1000점 초과분은 제곱식으로 가산
    // → 1000점 이후부터 점수가 오를수록 적 강화 증가폭이 점점 더 커진다.
    const over = Math.max(0, run.score - 1000);
    const D = e + (over * over) / 10000;

    // 이동
    const dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    if (dir !== 0) {
      run.px += dir * 320 * dt;
      pointerTarget = null;
    }
    if (pointerTarget != null)
      run.px += (pointerTarget - run.px) * Math.min(1, 18 * dt);
    run.px = Math.max(PLAY_L + 12, Math.min(PLAY_R - 12, run.px));
    const lane = laneOf(run.px);

    // 스폰: 성장 게이트 (레인 전체 폭, 빽빽하게, 느리게)
    run.gateT -= dt;
    if (run.gateT <= 0) {
      run.gateT = 0.4;
      run.gates.push({ y: -16 });
    }
    // 스폰: 졸병 (밀도 2배 + 시간 지날수록 더 강하고 빠르게)
    run.enemyT -= dt;
    if (run.enemyT <= 0) {
      run.enemyT = Math.max(0.12, 0.32 - D * 0.006);
      const hp = 1 + D / 5; // 시작 1배(원복), 증가 속도 D/5
      const spd = 42 + Math.min(60, D * 0.8);
      const mel = 2 + Math.floor(D / 12);
      for (let s = 0; s < 2; s++) {
        run.enemies.push({
          x: laneCenter(1) + (Math.random() - 0.5) * (LANE_W - 26),
          y: -16 - s * 26,
          hp,
          maxhp: hp,
          spd,
          mel,
          boss: false,
        });
      }
    }
    // 스폰: 보스 — 졸병보다 HP·근접피해가 압도적으로 큼
    run.bossT -= dt;
    if (run.bossT <= 0) {
      run.bossT = 14;
      const hp = Math.round(320 + D * 30); // 시작 320, 증가속도 D 기준
      run.enemies.push({
        x: laneCenter(1),
        y: -40,
        hp,
        maxhp: hp,
        spd: 26,
        mel: Math.round(50 + D),
        boss: true,
      });
    }

    // 발사: 병사 1명당 초당 fireRate발. 단, 보이는 총알을 줄이려 동시 사격 병사를
    // SHOOTER_CAP 으로 제한하고 그만큼 한 발의 데미지를 병력에 비례해 키운다.
    // (총알은 여전히 실제로 날아가 적에 맞아야만 피해 — 자동/관통 아님)
    const shooters = Math.min(Math.floor(run.army), SHOOTER_CAP);
    if (shooters > 0) {
      run.fireAcc += shooters * run.fireRate * dt;
      let toFire = Math.floor(run.fireAcc);
      run.fireAcc -= toFire;
      toFire = Math.min(toFire, MAX_BULLETS - run.bullets.length);
      const bdmg = run.dmg * (run.army / shooters);
      for (let i = 0; i < toFire; i++) spawnBullet(bdmg);
    }

    // 이동: 게이트(느리게). 성장 레인에서 도달하면 +1
    const scroll = 55;
    for (const g of run.gates) {
      g.y += scroll * dt;
      if (g.y >= SQUAD_Y) {
        if (lane === 0) {
          run.army += 1;
          floatText("+1", laneCenter(0), SQUAD_Y - 40, "#5cff8f");
        }
        g.dead = true;
      }
    }
    run.gates = run.gates.filter((g) => !g.dead);

    // 이동: 적. 부대 앞(MELEE_Y)에 도달하면 멈춰서, 죽을 때까지 병력을 계속 깎는다.
    // (즉시 제거/즉사 아님 — 총알로 처치해야 사라짐)
    const MELEE_Y = SQUAD_Y - 50;
    let drain = 0;
    for (const en of run.enemies) {
      if (!en.engaged) {
        en.y += en.spd * dt;
        if (en.y >= MELEE_Y) {
          en.y = MELEE_Y;
          en.engaged = true;
        }
      }
      // 졸병 드레인 0.1, 보스는 추가로 0.1배 → 0.01
      if (en.engaged) drain += en.mel * dt * (en.boss ? 0.01 : 0.1);
    }
    if (drain > 0) {
      run.army -= drain;
      run.borderFlash = Math.max(run.borderFlash, 0.25);
      run.meleeAcc += drain;
      run.meleeTextT -= dt;
      if (run.meleeTextT <= 0) {
        floatText("-" + formatNum(run.meleeAcc), run.px, SQUAD_Y - 80, "#ff3b5c");
        run.meleeAcc = 0;
        run.meleeTextT = 0.5;
      }
    }

    // 이동 + 충돌: 총알(관통 없음). 닿은 칸의 "맨 앞(가까운) 적"부터 1발씩 피해.
    const wx = laneCenter(2);
    for (const b of run.bullets) {
      b.y += b.vy * dt;
      if (b.y < -10) {
        b.dead = true;
        continue;
      }
      // 무기 스택: 같은 칸(x)에서 가장 가까운(y 큰) 무기 1개
      let tw = null;
      for (const w of run.weapons)
        if (Math.abs(b.x - wx) < LANE_W / 2 && Math.abs(b.y - w.y) < 20)
          if (!tw || w.y > tw.y) tw = w;
      if (tw) {
        tw.hp -= b.dmg;
        b.dead = true;
        if (tw.hp <= 0) destroyWeapon(tw);
        continue;
      }
      // 적: 총알 x칸에서 가장 앞쪽(y 큰) 적 1마리만 피해, 총알 소멸
      let te = null;
      for (const en of run.enemies) {
        if (en.dead) continue;
        const rx = en.boss ? 24 : 11;
        const ry = en.boss ? 24 : 12;
        if (Math.abs(b.x - en.x) < rx && Math.abs(b.y - en.y) < ry)
          if (!te || en.y > te.y) te = en;
      }
      if (te) {
        te.hp -= b.dmg;
        b.dead = true;
        if (te.hp <= 0) killEnemy(te);
      }
    }
    run.bullets = run.bullets.filter((b) => !b.dead);
    run.enemies = run.enemies.filter((en) => !en.dead);

    // 효과 감쇠
    if (run.flash > 0) run.flash -= dt;
    if (run.borderFlash > 0) run.borderFlash -= dt;
    for (const t of run.floats) {
      t.life -= dt;
      t.y -= 26 * dt;
    }
    run.floats = run.floats.filter((t) => t.life > 0);

    // 패배
    if (run.army <= 0 && !run.ended) {
      run.army = 0;
      finish();
      return;
    }

    // HUD
    hudArmy.textContent = "🪖 " + formatNum(Math.floor(run.army));
    hudPower.textContent = "⚡" + run.fireRate.toFixed(1) + " 🔥" + run.dmg;
    hudStage.textContent = "SCORE " + run.score;
  }

  // ===========================================================================
  //  렌더링
  // ===========================================================================
  const FIG = ["·H·", "BBB", "·B·", "·B·", "L·L"];
  const ALLY_PAL = { head: "#ffd9a0", body: "#4dd0e1", leg: "#2a2150" };
  const ENEMY_PAL = { head: "#ffd9a0", body: "#ff4d6d", leg: "#2a0a16" };

  function drawFigure(cx, cy, pal, s) {
    const ox = Math.round(cx - (3 * s) / 2);
    const oy = Math.round(cy - (5 * s) / 2);
    for (let r = 0; r < 5; r++)
      for (let c = 0; c < 3; c++) {
        const ch = FIG[r][c];
        if (ch === "·") continue;
        ctx.fillStyle = ch === "H" ? pal.head : ch === "L" ? pal.leg : pal.body;
        ctx.fillRect(ox + c * s, oy + r * s, s, s);
      }
  }

  function drawLanes() {
    const tints = [
      "rgba(40,140,70,0.16)",
      "rgba(150,40,55,0.16)",
      "rgba(60,90,170,0.16)",
    ];
    for (let l = 0; l < 3; l++) {
      ctx.fillStyle = tints[l];
      ctx.fillRect(PLAY_L + LANE_W * l, 0, LANE_W, H);
    }
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(PLAY_L + LANE_W - 1, 0, 2, H);
    ctx.fillRect(PLAY_L + LANE_W * 2 - 1, 0, 2, H);
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.font = '9px "Press Start 2P", monospace';
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (let l = 0; l < 3; l++) ctx.fillText(LANE_NAMES[l], laneCenter(l), 8);
  }

  function drawGate(g) {
    // 성장 레인 전체 폭 가로 막대
    const x1 = PLAY_L + 3;
    const w = LANE_W - 6;
    ctx.fillStyle = "#1d6b3a";
    ctx.fillRect(x1, g.y - 13, w, 26);
    ctx.fillStyle = "#5cff8f";
    ctx.fillRect(x1, g.y - 13, w, 3);
    ctx.fillStyle = "#fff";
    ctx.font = '13px "Press Start 2P", monospace';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("+1", laneCenter(0), g.y);
  }

  function drawEnemy(en) {
    if (en.boss) {
      ctx.fillStyle = "#b71c3a";
      ctx.fillRect(en.x - 22, en.y - 22, 44, 44);
      ctx.fillStyle = "#ffd54d";
      ctx.fillRect(en.x - 22, en.y - 22, 44, 3);
      drawFigure(en.x, en.y, { head: "#ffd9a0", body: "#7a0f25", leg: "#2a0a16" }, 5);
      // HP 바
      hpBar(en.x - 26, en.y - 34, 52, en.hp / en.maxhp);
      ctx.fillStyle = "#fff";
      ctx.font = '9px "Press Start 2P", monospace';
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(formatNum(Math.ceil(en.hp)), en.x, en.y - 36);
    } else {
      drawFigure(en.x, en.y, ENEMY_PAL, 3);
      if (en.maxhp > 1) hpBar(en.x - 10, en.y - 14, 20, en.hp / en.maxhp);
    }
  }

  function hpBar(x, y, w, ratio) {
    ratio = Math.max(0, Math.min(1, ratio));
    ctx.fillStyle = "#000";
    ctx.fillRect(x - 1, y - 1, w + 2, 5);
    ctx.fillStyle = "#3a0010";
    ctx.fillRect(x, y, w, 3);
    ctx.fillStyle = "#ff5b6e";
    ctx.fillRect(x, y, w * ratio, 3);
  }

  function drawWeapons() {
    const cx = laneCenter(2);
    const halfW = LANE_W / 2 - 4; // 레인 전체 폭 채움
    for (const w of run.weapons) {
      ctx.fillStyle = "#2a3550";
      ctx.fillRect(cx - halfW, w.y - 15, halfW * 2, 30);
      ctx.fillStyle = "#9fb4ff";
      ctx.fillRect(cx - halfW, w.y - 15, halfW * 2, 3);
      hpBar(cx - halfW, w.y - 26, halfW * 2, w.hp / w.maxhp);
      ctx.fillStyle = "#ffd54d";
      ctx.font = '7px "Press Start 2P", monospace';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(w.info.label, cx, w.y + 1);
    }
  }

  const TIER_NONE = ALLY_PAL;
  function drawSquad() {
    const n = Math.floor(run.army);
    const shown = Math.min(40, Math.max(1, n));
    const cols = 7;
    for (let i = 0; i < shown; i++) {
      const r = Math.floor(i / cols);
      const c = i % cols;
      const rowCount = Math.min(cols, shown - r * cols);
      const x = run.px + (c - (rowCount - 1) / 2) * 13;
      const y = SQUAD_Y + r * 11;
      drawFigure(x, y, TIER_NONE, 2);
    }
    ctx.fillStyle = "#fff";
    ctx.font = '16px "Press Start 2P", monospace';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(formatNum(n), run.px, SQUAD_Y - 26);
  }

  function render() {
    ctx.clearRect(0, 0, W, H);
    drawLanes();
    drawWeapons();
    for (const g of run.gates) drawGate(g);
    for (const en of run.enemies) drawEnemy(en);
    // 총알
    ctx.fillStyle = "#ffe66d";
    for (const b of run.bullets) ctx.fillRect(b.x - 2, b.y - 6, 4, 8);
    drawSquad();

    if (run.flash > 0) {
      ctx.fillStyle = "rgba(255,255,255," + run.flash * 1.4 + ")";
      ctx.fillRect(0, 0, W, H);
    }
    if (run.borderFlash > 0) {
      const t = run.borderFlash;
      const blink = Math.floor(t * 12) % 2 === 0 ? 0.95 : 0.25;
      const a = Math.min(1, t / 0.5) * blink;
      ctx.fillStyle = "rgba(255,40,70," + a + ")";
      const b = 14;
      ctx.fillRect(0, 0, W, b);
      ctx.fillRect(0, H - b, W, b);
      ctx.fillRect(0, 0, b, H);
      ctx.fillRect(W - b, 0, b, H);
    }
    // 떠오르는 텍스트
    for (const t of run.floats) {
      ctx.globalAlpha = t.life > 0.4 ? 1 : t.life / 0.4;
      ctx.font = '16px "Press Start 2P", monospace';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#000";
      ctx.fillText(t.text, t.x + 2, t.y + 2);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
      ctx.globalAlpha = 1;
    }
  }

  function formatNum(n) {
    n = Math.floor(n);
    if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
    if (n >= 1e4) return (n / 1e3).toFixed(1) + "K";
    return "" + n;
  }

  // ===========================================================================
  //  루프 / 흐름
  // ===========================================================================
  function tick(t) {
    if (state !== "playing") return;
    const dt = Math.min(0.033, (t - lastT) / 1000 || 0);
    lastT = t;
    update(dt);
    if (state !== "playing") return;
    render();
    raf = requestAnimationFrame(tick);
  }

  function beginLoop() {
    hideOverlays();
    hud.hidden = false;
    state = "playing";
    lastT = performance.now();
    flashHint();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
  }

  function startSurvival(restore) {
    pointerTarget = null;
    newRun(restore || null);
    beginLoop();
  }

  function finish() {
    if (run.ended) return;
    run.ended = true;
    cancelAnimationFrame(raf);
    state = "result";
    data.bestScore = Math.max(data.bestScore, run.score);
    data.slot = null;
    persist();
    $("#result-title").textContent = "GAME OVER";
    $("#result-sub").textContent =
      "점수 " + run.score + " · 처치 " + run.kills + " · " + Math.floor(run.elapsed) + "초";
    hud.hidden = true;
    show("#screen-result");
  }

  function openMenu() {
    cancelAnimationFrame(raf);
    state = "menu";
    run = null;
    hud.hidden = true;
    data = loadData();
    renderMenu();
    show("#screen-select");
  }

  function renderMenu() {
    const best = $("#tw-best");
    if (best) best.textContent = "최고 점수 " + data.bestScore;
    const cont = $("#continue-row");
    cont.innerHTML = "";
    if (data.slot) {
      const c = document.createElement("div");
      c.className = "continue-card";
      c.innerHTML =
        '<div class="ct-title">▶ 이어하기</div><div class="ct-sub">🪖' +
        data.slot.army +
        " ⚡" +
        data.slot.fireRate +
        " 🔥" +
        data.slot.dmg +
        " · SCORE " +
        data.slot.score +
        "</div>";
      c.onclick = continueFromSlot;
      cont.appendChild(c);
    }
  }

  function continueFromSlot() {
    if (!data.slot) return;
    startSurvival(data.slot);
  }

  function saveRun() {
    if (!run || run.ended) {
      toast("저장할 게임이 없습니다");
      return;
    }
    data.slot = {
      army: Math.floor(run.army),
      fireRate: run.fireRate,
      dmg: run.dmg,
      elapsed: run.elapsed,
      weaponLevel: run.weaponLevel,
      kills: run.kills,
      score: run.score,
      savedAt: Date.now(),
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
  //  입력 (상대 드래그 + 키보드)
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
    pointerTarget = run.px;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!dragging || state !== "playing") return;
    const x = canvasX(e.clientX);
    const base = pointerTarget == null ? run.px : pointerTarget;
    pointerTarget = Math.max(PLAY_L + 12, Math.min(PLAY_R - 12, base + (x - lastDragX)));
    lastDragX = x;
  });
  canvas.addEventListener("pointerup", () => (dragging = false));
  canvas.addEventListener("pointercancel", () => (dragging = false));

  // ---------- 버튼 ----------
  $("#btn-start").onclick = () => startSurvival(null);
  $("#btn-menu").onclick = openMenu;
  $("#btn-quit").onclick = openMenu;
  $("#btn-tomenu").onclick = openMenu;
  $("#btn-save").onclick = saveRun;
  $("#btn-save2").onclick = saveRun;
  $("#btn-pause").onclick = pause;
  $("#btn-resume").onclick = resume;
  $("#btn-retry").onclick = () => startSurvival(null);

  // ---------- 시작 ----------
  openMenu();
})();
