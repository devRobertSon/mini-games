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
//  ES 모듈 미사용: 전역 MG.STAGES / MG.endlessSlot 에 등록.
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

// 메인 격자: 게이트 / 적 / 보스가 놓이는 슬롯. 간격은 항상 일정.
const MAIN_GAP = 600;
function endlessMainDist(i) {
  return 700 + i * MAIN_GAP;
}

// 무한 모드: i번째 "메인 슬롯"에 해당하는 이벤트들의 배열을 결정적으로 생성.
//   - 메인 이벤트(게이트/적/보스)는 항상 MAIN_GAP 간격으로 배치 (좁아지지 않음).
//   - 장애물은 메인 슬롯 "사이 빈 공간"에 별도로 배치 (뒤로 갈수록 더, 단 피할 수 있게).
//   - 적/보스는 게이트가 없는 슬롯에 등장.
function endlessSlot(seed, i) {
  const rng = makeRng(seed * 1000003 + i * 97 + 7);
  const d = endlessMainDist(i);
  const tier = 1 + i * 0.16;
  const out = [];

  // ----- 메인 이벤트 -----
  if (i < 1) {
    // 첫 게이트만 곱하기로 가볍게 시작
    out.push(gate(d, { op: "*", val: 2 }, { op: "/", val: 2 }));
  } else if (i % 14 === 0) {
    // 일정 간격마다 보스(장교)
    out.push(boss(d, Math.round(40 * tier)));
  } else if (rng() < 0.22) {
    // 적 (게이트가 없는 슬롯)
    const count = Math.round((18 + i * 11) * (0.8 + rng() * 0.5));
    out.push(enemy(d, Math.max(5, count)));
  } else {
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
    out.push(rng() < 0.5 ? gate(d, good, bad) : gate(d, bad, good));
  }

  // ----- 장애물: 이 슬롯 ~ 다음 슬롯 사이 빈 공간에 배치 -----
  // 후보 위치 2곳(간격의 40%, 73% 지점). 각각 확률적으로 채우며,
  // 뒤로 갈수록 채워질 확률↑. 좁은 장애물 + 충분한 세로 간격으로 항상 회피 가능.
  const cand = [0.4, 0.73];
  const fillProb = [Math.min(0.8, i * 0.05), Math.min(0.7, (i - 8) * 0.05)];
  for (let k = 0; k < cand.length; k++) {
    if (rng() < fillProb[k]) {
      const od = d + MAIN_GAP * cand[k];
      const x = 100 + rng() * 200; // [100, 300] — 항상 우회 가능
      out.push(obstacle(od, x, 84));
    }
  }
  return out;
}

  window.MG.STAGES = STAGES;
  window.MG.endlessSlot = endlessSlot;
  window.MG.endlessMainDist = endlessMainDist;
})();
