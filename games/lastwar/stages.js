// ===========================================================================
//  Last War - 스테이지 정의
//  거리(d) 단위는 픽셀. 병사 무리가 d 만큼 전진하면 해당 이벤트를 만난다.
//
//  이벤트 종류:
//    { d, type:'gate', left:{op,val}, right:{op,val} }   ← 두 갈림길
//    { d, type:'enemy', count }                          ← 적 무리(병력 차감)
//    { d, type:'boss',  count }                          ← 보스(>= 면 클리어)
//
//  op: '+', '-', '*', '/'   (각각 더하기/빼기/곱하기/나누기)
// ===========================================================================

function gate(d, l, r) {
  return { d, type: "gate", left: l, right: r };
}
function enemy(d, count) {
  return { d, type: "enemy", count };
}
function boss(d, count) {
  return { d, type: "boss", count };
}

export const STAGES = [
  {
    id: 1,
    name: "STAGE 1",
    startArmy: 12,
    speed: 150,
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
    speed: 160,
    events: [
      gate(700, { op: "*", val: 2 }, { op: "+", val: 10 }),
      enemy(1400, 18),
      gate(2100, { op: "-", val: 8 }, { op: "*", val: 3 }),
      gate(2800, { op: "+", val: 30 }, { op: "/", val: 3 }),
      enemy(3600, 40),
      gate(4300, { op: "*", val: 2 }, { op: "-", val: 12 }),
      boss(5100, 45),
    ],
  },
  {
    id: 3,
    name: "STAGE 3",
    startArmy: 20,
    speed: 175,
    events: [
      gate(650, { op: "+", val: 15 }, { op: "*", val: 2 }),
      gate(1300, { op: "/", val: 2 }, { op: "*", val: 3 }),
      enemy(2000, 35),
      gate(2700, { op: "-", val: 15 }, { op: "+", val: 50 }),
      enemy(3400, 60),
      gate(4100, { op: "*", val: 2 }, { op: "/", val: 4 }),
      gate(4800, { op: "+", val: 40 }, { op: "-", val: 20 }),
      boss(5600, 120),
    ],
  },
  {
    id: 4,
    name: "STAGE 4",
    startArmy: 25,
    speed: 190,
    events: [
      gate(650, { op: "*", val: 3 }, { op: "+", val: 20 }),
      enemy(1300, 40),
      gate(2000, { op: "/", val: 3 }, { op: "*", val: 4 }),
      enemy(2700, 80),
      gate(3400, { op: "+", val: 80 }, { op: "-", val: 40 }),
      gate(4100, { op: "*", val: 2 }, { op: "/", val: 2 }),
      enemy(4800, 130),
      boss(5600, 130),
    ],
  },
  {
    id: 5,
    name: "STAGE 5",
    startArmy: 30,
    speed: 205,
    events: [
      gate(600, { op: "*", val: 3 }, { op: "-", val: 10 }),
      gate(1250, { op: "+", val: 30 }, { op: "*", val: 4 }),
      enemy(1950, 70),
      gate(2650, { op: "/", val: 2 }, { op: "+", val: 120 }),
      enemy(3350, 150),
      gate(4050, { op: "*", val: 2 }, { op: "/", val: 3 }),
      gate(4750, { op: "+", val: 100 }, { op: "-", val: 60 }),
      enemy(5450, 220),
      boss(6300, 350),
    ],
  },
  {
    id: 6,
    name: "STAGE 6 · FINAL",
    startArmy: 35,
    speed: 220,
    events: [
      gate(600, { op: "*", val: 4 }, { op: "+", val: 25 }),
      enemy(1250, 60),
      gate(1950, { op: "/", val: 3 }, { op: "*", val: 5 }),
      gate(2650, { op: "+", val: 150 }, { op: "-", val: 50 }),
      enemy(3350, 200),
      gate(4050, { op: "*", val: 3 }, { op: "/", val: 4 }),
      enemy(4750, 320),
      gate(5450, { op: "+", val: 200 }, { op: "*", val: 2 }),
      boss(6300, 600),
    ],
  },
];

// ---------- 무한 모드용 시드 PRNG (mulberry32) ----------
export function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 무한 모드: 시드로부터 i번째 이벤트를 결정적으로 생성
//   난이도는 거리(인덱스)에 따라 점점 상승한다.
export function endlessEvent(seed, i) {
  const rng = makeRng(seed * 1000003 + i * 97 + 7);
  const d = 700 + i * 720; // 균일 간격
  const tier = 1 + i * 0.18; // 난이도 계수
  const pick = rng();

  if (i % 3 === 2) {
    // 적
    const count = Math.round((20 + i * 12) * (0.8 + rng() * 0.6));
    return enemy(d, Math.max(5, count));
  }

  // 게이트: 한쪽은 좋고 한쪽은 나쁘게(랜덤 배치)
  const goodOps = [
    { op: "*", val: 2 },
    { op: "*", val: 3 },
    { op: "+", val: Math.round(20 * tier) },
    { op: "+", val: Math.round(40 * tier) },
  ];
  const badOps = [
    { op: "/", val: 2 },
    { op: "/", val: 3 },
    { op: "-", val: Math.round(15 * tier) },
    { op: "-", val: Math.round(30 * tier) },
  ];
  const good = goodOps[(rng() * goodOps.length) | 0];
  const bad = badOps[(rng() * badOps.length) | 0];
  return pick < 0.5 ? gate(d, good, bad) : gate(d, bad, good);
}
