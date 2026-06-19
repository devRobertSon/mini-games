// ===========================================================================
//  Gate Rush - 스테이지 정의
//  거리(d) 단위는 픽셀. 유닛 무리가 d 만큼 전진하면 해당 이벤트를 만난다.
//
//  이벤트 종류:
//    { d, type:'gate', left:{op,val}, right:{op,val} }   ← 두 갈림길
//    { d, type:'enemy', count }                          ← 적 무리(유닛 차감)
//    { d, type:'obstacle', x, w }                        ← 장애물(부딪히면 5% 감소)
//    { d, type:'boss',  count }                          ← 보스(>= 면 클리어)
//
//  op: '+', '-', '*', '/'   (각각 더하기/빼기/곱하기/나누기)
//  좌표계: 플레이 영역 x 는 40(좌)~360(우), 중앙 200.
//  ES 모듈 미사용: 전역 MG.STAGES / MG.endlessEvent 에 등록.
// ===========================================================================
(function () {
  window.MG = window.MG || {};

function gate(d, l, r) {
  return { d, type: "gate", left: l, right: r };
}
function enemy(d, count) {
  return { d, type: "enemy", count };
}
function obstacle(d, x, w) {
  return { d, type: "obstacle", x, w: w || 84 };
}
function boss(d, count) {
  return { d, type: "boss", count };
}

const STAGES = [
  {
    id: 1,
    name: "STAGE 1",
    startArmy: 12,
    speed: 175,
    events: [
      gate(700, { op: "+", val: 6 }, { op: "*", val: 2 }),
      gate(1500, { op: "-", val: 4 }, { op: "*", val: 2 }),
      enemy(2300, 14),
      gate(3100, { op: "/", val: 2 }, { op: "+", val: 24 }),
      enemy(3900, 22),
      boss(4700, 30),
    ],
  },
  {
    id: 2,
    name: "STAGE 2",
    startArmy: 15,
    speed: 190,
    events: [
      gate(700, { op: "*", val: 2 }, { op: "+", val: 10 }),
      obstacle(1050, 150),
      enemy(1400, 18),
      gate(2100, { op: "-", val: 8 }, { op: "*", val: 3 }),
      gate(2800, { op: "+", val: 30 }, { op: "/", val: 3 }),
      obstacle(3050, 250),
      enemy(3600, 40),
      gate(4300, { op: "*", val: 2 }, { op: "-", val: 12 }),
      boss(5100, 45),
    ],
  },
  {
    id: 3,
    name: "STAGE 3",
    startArmy: 20,
    speed: 205,
    events: [
      gate(650, { op: "+", val: 15 }, { op: "*", val: 2 }),
      obstacle(1000, 150),
      gate(1300, { op: "/", val: 2 }, { op: "*", val: 3 }),
      enemy(2000, 35),
      gate(2700, { op: "-", val: 15 }, { op: "+", val: 50 }),
      obstacle(3050, 260),
      enemy(3400, 60),
      gate(4100, { op: "*", val: 2 }, { op: "/", val: 4 }),
      gate(4800, { op: "+", val: 40 }, { op: "-", val: 20 }),
      obstacle(5200, 200),
      boss(5600, 120),
    ],
  },
  {
    id: 4,
    name: "STAGE 4",
    startArmy: 25,
    speed: 225,
    events: [
      gate(650, { op: "*", val: 3 }, { op: "+", val: 20 }),
      obstacle(1000, 260),
      enemy(1300, 40),
      gate(2000, { op: "/", val: 3 }, { op: "*", val: 4 }),
      obstacle(2350, 140),
      enemy(2700, 80),
      gate(3400, { op: "+", val: 80 }, { op: "-", val: 40 }),
      gate(4100, { op: "*", val: 2 }, { op: "/", val: 2 }),
      obstacle(4450, 250),
      enemy(4800, 130),
      boss(5600, 130),
    ],
  },
  {
    id: 5,
    name: "STAGE 5",
    startArmy: 30,
    speed: 240,
    events: [
      gate(600, { op: "*", val: 3 }, { op: "-", val: 10 }),
      obstacle(900, 150),
      gate(1250, { op: "+", val: 30 }, { op: "*", val: 4 }),
      enemy(1950, 70),
      obstacle(2300, 260),
      gate(2650, { op: "/", val: 2 }, { op: "+", val: 120 }),
      enemy(3350, 150),
      gate(4050, { op: "*", val: 2 }, { op: "/", val: 3 }),
      obstacle(4400, 140),
      gate(4750, { op: "+", val: 100 }, { op: "-", val: 60 }),
      enemy(5450, 220),
      obstacle(5800, 250),
      boss(6300, 350),
    ],
  },
  {
    id: 6,
    name: "STAGE 6 · FINAL",
    startArmy: 35,
    speed: 255,
    events: [
      gate(600, { op: "*", val: 4 }, { op: "+", val: 25 }),
      obstacle(900, 260),
      enemy(1250, 60),
      gate(1950, { op: "/", val: 3 }, { op: "*", val: 5 }),
      obstacle(2300, 140),
      gate(2650, { op: "+", val: 150 }, { op: "-", val: 50 }),
      enemy(3350, 200),
      obstacle(3700, 250),
      gate(4050, { op: "*", val: 3 }, { op: "/", val: 4 }),
      enemy(4750, 320),
      obstacle(5050, 150),
      gate(5450, { op: "+", val: 200 }, { op: "*", val: 2 }),
      obstacle(5800, 260),
      boss(6300, 600),
    ],
  },
];

// ---------- 무한 모드용 시드 PRNG (mulberry32) ----------
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

// 이벤트 간격: 뒤로 갈수록 촘촘해지되 하한(400px)을 둬 항상 피할 수 있게
function spacingAt(k) {
  return Math.max(400, 640 - k * 4);
}
function endlessDist(i) {
  let d = 600;
  for (let k = 0; k < i; k++) d += spacingAt(k);
  return d;
}

// 무한 모드: 시드로부터 i번째 이벤트를 결정적으로 생성.
//   - 앞쪽: 곱하기 게이트가 흔함 → 빠르게 성장
//   - 뒤쪽: 곱하기 확률 급감, 적/장애물 증가 → 난이도 상승
//   - 장애물은 좁은 단일 형태라 항상 지나갈 틈이 남는다.
function endlessEvent(seed, i) {
  const rng = makeRng(seed * 1000003 + i * 97 + 7);
  const d = endlessDist(i);
  const tier = 1 + i * 0.16;

  // 첫 게이트만 곱하기로 가볍게 시작
  if (i < 1) {
    return gate(d, { op: "*", val: 2 }, { op: "/", val: 2 });
  }

  // 일정 간격마다 보스(장교) 등장
  if (i % 14 === 0) {
    return boss(d, Math.round(40 * tier));
  }

  // 종류 결정: 뒤로 갈수록 장애물 비중↑ (단, 피할 수 있을 만큼만)
  const obstacleChance = Math.min(0.5, 0.08 + i * 0.012);
  const enemyChance = 0.2;
  const r = rng();

  if (r < enemyChance) {
    const count = Math.round((18 + i * 11) * (0.8 + rng() * 0.5));
    return enemy(d, Math.max(5, count));
  }
  if (r < enemyChance + obstacleChance) {
    const x = 90 + rng() * 220; // [90, 310] — 벽에서 떨어져 항상 우회 가능
    return obstacle(d, x, 84);
  }

  // 게이트: 곱하기 확률은 i 가 커질수록 급감 (앞쪽도 과하지 않게 → 뒤쪽 거의 없음)
  const pMult = Math.max(0.05, 0.42 - i * 0.03);
  let good;
  if (rng() < pMult) {
    good = rng() < 0.35 ? { op: "*", val: 3 } : { op: "*", val: 2 };
  } else {
    good =
      rng() < 0.5
        ? { op: "+", val: Math.round(30 * tier) }
        : { op: "+", val: Math.round(60 * tier) };
  }
  const badPool = [
    { op: "/", val: 2 },
    { op: "/", val: 3 },
    { op: "-", val: Math.round(20 * tier) },
    { op: "-", val: Math.round(40 * tier) },
  ];
  const bad = badPool[(rng() * badPool.length) | 0];
  return rng() < 0.5 ? gate(d, good, bad) : gate(d, bad, good);
}

  window.MG.STAGES = STAGES;
  window.MG.endlessEvent = endlessEvent;
})();
