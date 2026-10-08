// Engine tests: run with `node --test tests/`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const ctx = {};
ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ["web/data.js", "web/engine.js"]) {
  const src = readFileSync(new URL("../" + f, import.meta.url), "utf8").replace(/^window\./, "globalThis.");
  vm.runInContext(src, ctx);
}
const CR = ctx.CR;
const spx = CR.decode(ctx.CR_DATA.spx);
const ndq = CR.decode(ctx.CR_DATA.ndq);
const close = (s, d) => s.close[CR.indexOf(s, d)];

test("dates decode to real trading days", () => {
  assert.equal(CR.iso(spx.t[0]), "1950-01-03");
  assert.equal(CR.iso(spx.t[CR.indexOf(spx, "1987-10-19")]), "1987-10-19");
  assert.equal(CR.iso(spx.t[CR.indexOf(spx, "2008-09-29")]), "2008-09-29");
});

test("historic days match the record", () => {
  const bm = close(spx, "1987-10-19") / close(spx, "1987-10-16") - 1;
  assert.ok(Math.abs(bm - -0.2047) < 0.0005, `Black Monday ${bm}`);
  const l = close(spx, "2008-09-29") / close(spx, "2008-09-26") - 1;
  assert.ok(Math.abs(l - -0.0881) < 0.0005, `2008-09-29 ${l}`);
  const dd = CR.indexDrawdown(spx, CR.indexOf(spx, "2007-06-01"), CR.indexOf(spx, "2009-12-31")).dd;
  assert.ok(Math.abs(dd - 0.568) < 0.002, `2008 drawdown ${dd}`);
  const dot = CR.indexDrawdown(ndq, CR.indexOf(ndq, "1999-10-01"), CR.indexOf(ndq, "2002-12-31")).dd;
  assert.ok(dot > 0.77 && dot < 0.79, `dot-com drawdown ${dot}`);
  const oil = CR.indexDrawdown(spx, CR.indexOf(spx, "1972-10-02"), CR.indexOf(spx, "1975-06-30")).dd;
  assert.ok(Math.abs(oil - 0.482) < 0.002, `1973-74 drawdown ${oil}`);
  const dg = close(spx, "2011-08-08") / close(spx, "2011-08-05") - 1;
  assert.ok(Math.abs(dg - -0.0666) < 0.0005, `2011-08-08 ${dg}`);
});

test("buy and hold compounds the market return exactly", () => {
  const ret = CR.windowReturns(spx, CR.indexOf(spx, "2019-12-02"), CR.indexOf(spx, "2020-12-31"));
  let v = CR.START_CASH;
  for (const r of ret.mkt) v *= 1 + r;
  assert.ok(Math.abs(CR.runHold(ret).value - v) < 1e-6);
});

test("a trade costs 5 bp of the value moved", () => {
  const b = new CR.Book(1);
  b.set(0);
  assert.equal(b.value, CR.START_CASH * (1 - 0.0005));
  b.set(0.5);
  assert.ok(Math.abs(b.value - CR.START_CASH * (1 - 0.0005) * (1 - 0.00025)) < 1e-9);
  assert.equal(b.trades, 2);
});

test("no look-ahead: tomorrow's return never changes today's value", () => {
  const ret = CR.windowReturns(spx, CR.indexOf(spx, "2008-01-02"), CR.indexOf(spx, "2008-12-31"));
  const a = new CR.Book(1);
  const b = new CR.Book(1);
  for (let k = 0; k < 100; k++) {
    a.step(ret.mkt[k], ret.cash[k]);
    b.step(ret.mkt[k], ret.cash[k]);
  }
  a.step(-0.5, 0);
  b.step(0.5, 0);
  assert.equal(a.path[100], b.path[100]);
});

test("quant sizes are valid and it is out of the market in October 2008", () => {
  const i0 = CR.indexOf(spx, "2007-06-01");
  const i1 = CR.indexOf(spx, "2009-12-31");
  const sig = CR.quantSignals(spx, i0, i1);
  for (const x of sig) {
    assert.ok(x >= 0 && x <= 1);
    assert.ok(Math.abs(x * 20 - Math.round(x * 20)) < 1e-9);
  }
  assert.equal(sig[CR.indexOf(spx, "2008-10-15") - i0], 0);
});

test("skill test is reproducible and bounded", () => {
  const ret = CR.windowReturns(spx, CR.indexOf(spx, "2007-06-01"), CR.indexOf(spx, "2009-12-31"));
  const a = CR.skillTest(ret, 4, 12000, 500, 7);
  const b = CR.skillTest(ret, 4, 12000, 500, 7);
  assert.equal(a.pct, b.pct);
  assert.ok(a.pct >= 0 && a.pct <= 1);
  // With zero trades every random trader just holds, so nobody is beaten.
  assert.equal(CR.skillTest(ret, 0, CR.runHold(ret).value, 200, 1).pct, 0);
});
