// Experiments for the Crash Replay paper. Run: node paper/experiments.mjs
// Writes paper/results.json. Deterministic (seeded).
import { readFileSync, writeFileSync } from "node:fs";
import vm from "node:vm";

const ctx = {}; ctx.globalThis = ctx; vm.createContext(ctx);
for (const f of ["web/data.js", "web/engine.js"]) {
  vm.runInContext(readFileSync(new URL("../" + f, import.meta.url), "utf8").replace(/^window\./, "globalThis."), ctx);
}
const CR = ctx.CR;
const S = { spx: CR.decode(ctx.CR_DATA.spx), ndq: CR.decode(ctx.CR_DATA.ndq) };
const SC = [
  ["1973", "Oil Shock", "spx", "1972-10-02", "1975-06-30"],
  ["1987", "Black Monday", "spx", "1987-06-01", "1988-03-31"],
  ["2000", "Dot-com Bust", "ndq", "1999-10-01", "2002-12-31"],
  ["2008", "Financial Crisis", "spx", "2007-06-01", "2009-12-31"],
  ["2011", "Debt-Ceiling Scare", "spx", "2011-04-01", "2012-02-29"],
  ["2020", "COVID Crash", "spx", "2019-12-02", "2020-12-31"],
  ["2022", "Rate Shock", "ndq", "2021-09-01", "2023-06-30"],
];
const rng = (seed) => { let x = seed >>> 0; return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296); };

// run a schedule {k: exposure} (decision at close k, before return k)
function runSchedule(ret, e0, sched) {
  const b = new CR.Book(e0);
  for (let k = 0; k < ret.mkt.length; k++) { if (k in sched) b.set(sched[k]); b.step(ret.mkt[k], ret.cash[k]); }
  return b;
}
// causal rule: f(k, priceSoFar, state) -> exposure or undefined
function runRule(s, i0, i1, ret, e0, rule) {
  const b = new CR.Book(e0); const st = {};
  for (let k = 0; k < ret.mkt.length; k++) {
    const want = rule(k, i0 + k, st, b.exposure);
    if (want !== undefined) b.set(want);
    b.step(ret.mkt[k], ret.cash[k]);
  }
  return b;
}
const SIMS = 2000, SEED = 7;
const out = { scenarios: [], rules: [], calibration: [], power: [] };

for (const [id, name, ix, from, to] of SC) {
  const s = S[ix], i0 = CR.indexOf(s, from), i1 = CR.indexOf(s, to) - 1; // same window as the game
  const ret = CR.windowReturns(s, i0, i1), m = ret.mkt.length;
  const idd = CR.indexDrawdown(s, i0, i1);
  const hold = CR.stats(CR.runHold(ret), ret.cash);
  const q = CR.runQuant(CR.quantSignals(s, i0, i1), ret);
  const quant = CR.stats(q.book, ret.cash);
  out.scenarios.push({ id, name, ix, from, to, days: m, indexDD: idd.dd, peak: CR.iso(s.t[idd.peak]), trough: CR.iso(s.t[idd.trough]), hold, quant });

  // --- behavioural rules (all causal except the oracle) ---
  const pk = idd.peak - i0, tr = idd.trough - i0;
  const rules = {
    // hindsight upper bound: out at the peak close, back in at the trough close
    oracle: () => runSchedule(ret, 1, { [pk]: 0, [tr]: 1 }),
    // sells everything once the index is 20% below its running peak; buys back
    // only when it regains that old peak (what many retail investors do)
    panic: () => runRule(s, i0, i1, ret, 1, (k, i, st, e) => {
      st.p = Math.max(st.p || 0, s.close[i]);
      if (e === 1 && !st.sold && s.close[i] <= 0.8 * st.p) { st.sold = st.p; return 0; }
      if (e === 0 && st.sold && s.close[i] >= st.sold) return 1;
    }),
    // sells at -20% from peak, buys back once the index is 20% off its post-sale low
    rebound: () => runRule(s, i0, i1, ret, 1, (k, i, st, e) => {
      st.p = Math.max(st.p || 0, s.close[i]);
      if (e === 1 && !st.sold && s.close[i] <= 0.8 * st.p) { st.sold = 1; st.lo = s.close[i]; return 0; }
      if (st.sold) st.lo = Math.min(st.lo, s.close[i]);
      if (e === 0 && st.sold && s.close[i] >= 1.2 * st.lo) return 1;
    }),
    // starts half invested, goes all in at -20% from peak
    dip: () => runRule(s, i0, i1, ret, 0.5, (k, i, st, e) => {
      st.p = Math.max(st.p || 0, s.close[i]);
      if (e === 0.5 && s.close[i] <= 0.8 * st.p) return 1;
    }),
  };
  const row = { id };
  for (const [rn, f] of Object.entries(rules)) {
    const b = f(); const st = CR.stats(b, ret.cash);
    const t = st.trades ? CR.skillTest(ret, st.trades, st.final, SIMS, SEED) : { pct: null };
    row[rn] = { ret: st.ret, maxDD: st.maxDD, sharpe: st.sharpe, trades: st.trades, pct: t.pct };
  }
  out.rules.push(row);

  // --- calibration: null traders drawn exactly like the reference population
  // but from an independent stream; how often does the test call them skilled?
  for (const k of [2, 6]) {
    const r = rng(1000 + Number(id) + k); const N = 400; const pcts = [];
    for (let j = 0; j < N; j++) {
      const days = new Set(); while (days.size < k) days.add(Math.floor(r() * m));
      const sched = {}; let e = 1; [...days].sort((a, b) => a - b).forEach((d) => { let ne = e; while (ne === e) ne = [0, 0.5, 1][Math.floor(r() * 3)]; sched[d] = ne; e = ne; });
      const b = runSchedule(ret, 1, sched);
      pcts.push(CR.skillTest(ret, k, b.value, 1000, 99 + j).pct);
    }
    const fp = pcts.filter((p) => p >= 0.95).length / N;
    const fp10 = pcts.filter((p) => p >= 0.9).length / N;
    const mean = pcts.reduce((a, b) => a + b, 0) / N;
    out.calibration.push({ id, k, N, fp05: fp, fp10, meanPct: mean });
  }

  // --- power: a noisy oracle sells within ±J trading days of the peak and buys
  // within ±J days of the trough (2 trades). Power = P(pct >= 0.95).
  for (const J of [0, 5, 10, 21, 42, 63, 126]) {
    const r = rng(5000 + Number(id) + J); const N = 200; let hit = 0, avgRet = 0;
    for (let j = 0; j < N; j++) {
      const jit = () => Math.round((r() * 2 - 1) * J);
      let a = Math.min(m - 2, Math.max(0, pk + jit())), b = Math.min(m - 1, Math.max(0, tr + jit()));
      if (b <= a) b = Math.min(m - 1, a + 1);
      const bk = runSchedule(ret, 1, { [a]: 0, [b]: 1 });
      avgRet += bk.value / CR.START_CASH - 1;
      if (CR.skillTest(ret, 2, bk.value, 1000, 31 + j).pct >= 0.95) hit++;
    }
    out.power.push({ id, J, power: hit / N, meanRet: avgRet / N });
  }
  if (id === "2008") {
    // the run shown in the demo video: sell at the Lehman close, all in on 2009-03-18
    const a = CR.indexOf(s, "2008-09-15") - i0, b2 = CR.indexOf(s, "2009-03-18") - i0;
    const bk = runSchedule(ret, 1, { [a]: 0, [b2]: 1 }); const st = CR.stats(bk, ret.cash);
    const t = CR.skillTest(ret, 2, st.final, SIMS, SEED);
    const r4 = (a) => Array.from(a, (v) => Math.round(v));
    out.caseStudy = { ret: st.ret, maxDD: st.maxDD, sharpe: st.sharpe, pct: t.pct, sell: a, buy: b2,
      you: r4(bk.path), hold: r4(CR.runHold(ret).path), quant: r4(q.book.path), finals: r4(t.finals) };
  }
  console.error("done", id);
}
writeFileSync(new URL("./results.json", import.meta.url), JSON.stringify(out, null, 1));
