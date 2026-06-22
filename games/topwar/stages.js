// ===========================================================================
//  Top War - 스테이지 정의 (성장 레인 vs 적 레인, 실시간 사격)
//  좌표계: 플레이 영역 x 40~360, 중앙 200.
//   - 왼쪽 레인(40~200) = 성장 레인: 성장 게이트가 흘러내려온다(통과 시 성장).
//   - 오른쪽 레인(200~360) = 적 레인: 적이 위에서 돌격해 내려온다.
//  부대는 위로 자동 사격(DPS=병력×등급). 적을 멀리서 처치하지 못하면
//  적이 스쿼드에 닿아 병력을 깎는다.
//
//  이벤트(거리 d 기준):
//    gate(d, growth)         성장 게이트  growth: GC(op,val)|GT(val)
//    wave(d, n, hp, spd, mel) 적 n마리(각 hp), 돌격속도 spd, 닿으면 병력 -mel
//    boss(d, hp, mel)        보스(거대 적 1)
//  ES 모듈 미사용: 전역 MG.* 에 등록.
// ===========================================================================
(function () {
  window.MG = window.MG || {};

  const GC = (op, val) => ({ kind: "count", op, val }); // 수량 성장
  const GT = (val) => ({ kind: "tier", val }); // 등급 성장(머지)
  const gate = (d, growth) => ({ d, type: "gate", growth });
  const wave = (d, n, hp, spd, mel) => ({ d, type: "wave", n, hp, spd, mel });
  const boss = (d, hp, mel) => ({ d, type: "boss", hp, mel });

  const STAGES = [
    {
      id: 1,
      name: "STAGE 1 · 훈련",
      startArmy: 20,
      speed: 120,
      events: [
        gate(500, GC("*", 2)),
        wave(800, 5, 18, 80, 3),
        gate(1400, GT(1)),
        wave(1700, 8, 26, 85, 4),
        gate(2300, GC("*", 2)),
        wave(2700, 12, 34, 90, 5),
        gate(3300, GT(1)),
        wave(3700, 16, 44, 95, 5),
        boss(4600, 1400, 20),
      ],
    },
    {
      id: 2,
      name: "STAGE 2 · 방어선",
      startArmy: 25,
      speed: 135,
      events: [
        gate(500, GC("*", 2)),
        wave(800, 8, 26, 90, 4),
        gate(1400, GT(1)),
        wave(1700, 12, 36, 95, 5),
        gate(2300, GC("*", 3)),
        wave(2700, 16, 48, 100, 6),
        gate(3300, GT(2)),
        wave(3700, 22, 60, 105, 7),
        gate(4300, GC("*", 2)),
        wave(4700, 28, 75, 110, 8),
        boss(5800, 6000, 35),
      ],
    },
    {
      id: 3,
      name: "STAGE 3 · FINAL",
      startArmy: 30,
      speed: 150,
      events: [
        gate(500, GC("*", 3)),
        wave(800, 12, 36, 100, 5),
        gate(1400, GT(2)),
        wave(1700, 18, 52, 105, 6),
        gate(2300, GC("*", 3)),
        wave(2700, 24, 70, 110, 7),
        gate(3300, GT(2)),
        wave(3700, 30, 90, 115, 8),
        gate(4300, GC("*", 2)),
        wave(4700, 38, 115, 120, 9),
        gate(5300, GT(2)),
        wave(5700, 46, 140, 125, 10),
        boss(7000, 30000, 60),
      ],
    },
  ];

  // ---------- 무한 모드 ----------
  function makeRng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const MAIN_GAP = 500; // 게이트/웨이브 슬롯 간격
  function endlessMainDist(i) {
    return 500 + i * MAIN_GAP;
  }

  // 짝수 슬롯=성장 게이트, 홀수 슬롯=적 웨이브, 10마다 보스
  function endlessSlot(seed, i) {
    const rng = makeRng(seed * 1000003 + i * 97 + 7);
    const d = endlessMainDist(i);
    const tier = 1 + i * 0.12;
    if (i > 0 && i % 10 === 0) {
      return [boss(d, Math.round(900 * Math.pow(1.45, i / 2)), Math.round(20 + i * 2))];
    }
    if (i % 2 === 0) {
      // 성장 게이트: 수량/등급 번갈아·랜덤
      const g =
        rng() < 0.4
          ? GT(1)
          : rng() < 0.5
          ? GC("*", 2)
          : GC("*", 3);
      return [gate(d, g)];
    }
    // 적 웨이브 (뒤로 갈수록 수·HP 증가, 속도 증가)
    const n = Math.min(40, 5 + Math.round(i * 1.6));
    const hp = Math.round(18 * Math.pow(1.22, i));
    const spd = Math.min(150, 80 + i * 2.5);
    const mel = Math.round(3 + i * 0.6);
    return [wave(d, n, hp, spd, mel)];
  }

  window.MG.STAGES = STAGES;
  window.MG.endlessSlot = endlessSlot;
  window.MG.endlessMainDist = endlessMainDist;
})();
