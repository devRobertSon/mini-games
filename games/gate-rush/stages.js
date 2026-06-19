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

// 무한모드 전 단계: 5개 스테이지.
//   1) 더하기·빼기만   2) 곱하기·나누기만   3) 4연산 전부
//   4) 4연산 + 장애물   5) 속도 = 무한모드 최대(600)의 절반(300)
//   ※ 장애물은 4스테이지부터 등장.
const STAGES = [
  {
    id: 1,
    name: "STAGE 1 · +/−",
    startArmy: 12,
    speed: 150,
    events: [
      gate(700, { op: "+", val: 8 }, { op: "-", val: 4 }),
      gate(1400, { op: "-", val: 6 }, { op: "+", val: 12 }),
      enemy(2100, 12),
      gate(2800, { op: "+", val: 20 }, { op: "-", val: 8 }),
      gate(3500, { op: "-", val: 10 }, { op: "+", val: 25 }),
      enemy(4200, 25),
      boss(4900, 35),
    ],
  },
  {
    id: 2,
    name: "STAGE 2 · ×/÷",
    startArmy: 18,
    speed: 165,
    events: [
      gate(700, { op: "*", val: 2 }, { op: "/", val: 2 }),
      gate(1400, { op: "/", val: 2 }, { op: "*", val: 3 }),
      enemy(2100, 20),
      gate(2800, { op: "*", val: 2 }, { op: "/", val: 3 }),
      enemy(3500, 40),
      gate(4200, { op: "/", val: 2 }, { op: "*", val: 2 }),
      boss(4900, 200),
    ],
  },
  {
    id: 3,
    name: "STAGE 3 · 4연산",
    startArmy: 22,
    speed: 180,
    events: [
      gate(700, { op: "*", val: 2 }, { op: "+", val: 10 }),
      gate(1400, { op: "-", val: 8 }, { op: "*", val: 2 }),
      enemy(2100, 30),
      gate(2800, { op: "/", val: 2 }, { op: "+", val: 40 }),
      gate(3500, { op: "*", val: 2 }, { op: "-", val: 15 }),
      enemy(4200, 60),
      gate(4900, { op: "+", val: 50 }, { op: "/", val: 3 }),
      boss(5600, 150),
    ],
  },
  {
    id: 4,
    name: "STAGE 4 · 장애물",
    startArmy: 25,
    speed: 190,
    events: [
      gate(700, { op: "*", val: 2 }, { op: "+", val: 12 }),
      obstacle(1050, 150),
      gate(1400, { op: "+", val: 30 }, { op: "/", val: 2 }),
      enemy(2100, 35),
      obstacle(2450, 250),
      gate(2800, { op: "*", val: 3 }, { op: "-", val: 20 }),
      gate(3500, { op: "/", val: 3 }, { op: "+", val: 60 }),
      obstacle(3850, 160),
      enemy(4200, 80),
      gate(4900, { op: "*", val: 2 }, { op: "-", val: 30 }),
      obstacle(5250, 260),
      boss(5600, 180),
    ],
  },
  {
    id: 5,
    name: "STAGE 5 · FINAL",
    startArmy: 30,
    speed: 300,
    events: [
      gate(700, { op: "*", val: 2 }, { op: "+", val: 20 }),
      obstacle(1050, 150),
      gate(1400, { op: "/", val: 2 }, { op: "*", val: 3 }),
      enemy(2100, 50),
      obstacle(2450, 260),
      gate(2800, { op: "+", val: 80 }, { op: "-", val: 30 }),
      gate(3500, { op: "*", val: 2 }, { op: "/", val: 3 }),
      obstacle(3850, 140),
      enemy(4200, 120),
      gate(4900, { op: "*", val: 2 }, { op: "-", val: 50 }),
      obstacle(5250, 250),
      gate(5600, { op: "+", val: 150 }, { op: "/", val: 2 }),
      boss(6300, 400),
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

  // 처음 두 개는 곱하기 게이트로 워밍업
  if (i < 2) {
    const good = { op: "*", val: 2 };
    const bad = { op: "/", val: 2 };
    return rng() < 0.5 ? gate(d, good, bad) : gate(d, bad, good);
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

  // 게이트: 곱하기 확률은 i 가 커질수록 급감 (앞쪽 多 → 뒤쪽 거의 없음)
  const pMult = Math.max(0.07, 0.85 - i * 0.04);
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
