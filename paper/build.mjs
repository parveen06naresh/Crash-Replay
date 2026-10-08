// Builds paper/crash-replay.html from paper/results.json. Run: node paper/build.mjs
import { readFileSync, writeFileSync } from "node:fs";
const R = JSON.parse(readFileSync(new URL("./results.json", import.meta.url), "utf8"));
const P = (v, d = 1) => (v >= 0 ? "+" : "−") + Math.abs(v * 100).toFixed(d) + "%";
const U = (v, d = 1) => (v * 100).toFixed(d) + "%";
const $ = (v) => "$" + Math.round(v).toLocaleString("en-US");
const C = { you: "#0b7a4b", hold: "#b3262d", quant: "#b7791f", ink: "#111", grid: "#ccc", blue: "#2850b8" };

function poly(arr, W, H, mn, mx, P0 = 6) {
  return arr.map((v, i) => ((i / (arr.length - 1)) * W).toFixed(1) + "," + (P0 + (1 - (v - mn) / (mx - mn)) * (H - 2 * P0)).toFixed(1)).join(" ");
}
// Figure 1: case study curves
function fig1() {
  const c = R.caseStudy, W = 560, H = 230, all = [...c.you, ...c.hold, ...c.quant];
  const mn = Math.min(...all), mx = Math.max(...all), n = c.you.length;
  const x = (k) => (k / (n - 1)) * W, y0 = 6 + (1 - (10000 - mn) / (mx - mn)) * (H - 12);
  return `<svg viewBox="-34 -8 ${W + 44} ${H + 34}" width="100%" font-family="DejaVu Sans, sans-serif" font-size="9">
  <line x1="0" x2="${W}" y1="${y0}" y2="${y0}" stroke="${C.grid}" stroke-dasharray="3 3"/><text x="-4" y="${y0 + 3}" text-anchor="end" fill="#555">$10k</text>
  <text x="-4" y="12" text-anchor="end" fill="#555">${$(mx)}</text><text x="-4" y="${H}" text-anchor="end" fill="#555">${$(mn)}</text>
  <line x1="${x(c.sell)}" x2="${x(c.sell)}" y1="0" y2="${H}" stroke="#999" stroke-dasharray="2 3"/><text x="${x(c.sell) - 4}" y="${H + 12}" text-anchor="end" fill="#555">sell, 2008-09-15</text>
  <line x1="${x(c.buy)}" x2="${x(c.buy)}" y1="0" y2="${H}" stroke="#999" stroke-dasharray="2 3"/><text x="${x(c.buy) + 4}" y="${H + 12}" fill="#555">all in, 2009-03-18</text>
  <polyline points="${poly(c.hold, W, H, mn, mx)}" fill="none" stroke="${C.hold}" stroke-width="1.4"/>
  <polyline points="${poly(c.quant, W, H, mn, mx)}" fill="none" stroke="${C.quant}" stroke-width="1.4"/>
  <polyline points="${poly(c.you, W, H, mn, mx)}" fill="none" stroke="${C.you}" stroke-width="1.8"/>
  <g transform="translate(8,10)"><rect x="0" y="0" width="150" height="46" fill="#fff" stroke="#bbb"/>
   <line x1="8" x2="26" y1="11" y2="11" stroke="${C.you}" stroke-width="2"/><text x="32" y="14">Player (${P(c.ret)})</text>
   <line x1="8" x2="26" y1="25" y2="25" stroke="${C.hold}" stroke-width="2"/><text x="32" y="28">Buy and hold (${P(R.scenarios[3].hold.ret)})</text>
   <line x1="8" x2="26" y1="39" y2="39" stroke="${C.quant}" stroke-width="2"/><text x="32" y="42">Trend + vol target (${P(R.scenarios[3].quant.ret)})</text></g></svg>`;
}
// Figure 2: null distribution
function fig2() {
  const c = R.caseStudy, f = c.finals, lo = Math.min(...f), hi = Math.max(...f), B = 50, bins = new Array(B).fill(0);
  f.forEach((v) => bins[Math.min(B - 1, Math.floor(((v - lo) / (hi - lo)) * B))]++);
  const W = 560, H = 170, bw = W / B, mx = Math.max(...bins), X = (v) => ((v - lo) / (hi - lo)) * W;
  const you = 10000 * (1 + c.ret), hold = R.scenarios[3].hold;
  let bars = "";
  bins.forEach((k, i) => { const h = (k / mx) * (H - 24), v0 = lo + (i / B) * (hi - lo); bars += `<rect x="${(i * bw + 0.5).toFixed(1)}" y="${(H - h).toFixed(1)}" width="${(bw - 1).toFixed(1)}" height="${h.toFixed(1)}" fill="${v0 < you ? "#9db4e8" : "#c9c9c9"}"/>`; });
  const holdV = 10000 * (1 + hold.ret);
  return `<svg viewBox="-6 -8 ${W + 12} ${H + 32}" width="100%" font-family="DejaVu Sans, sans-serif" font-size="9">${bars}
  <line x1="${X(you)}" x2="${X(you)}" y1="0" y2="${H}" stroke="${C.you}" stroke-width="2"/><text x="${X(you) + 4}" y="8" fill="${C.you}">player ${$(you)}</text>
  <line x1="${X(holdV)}" x2="${X(holdV)}" y1="14" y2="${H}" stroke="${C.hold}" stroke-dasharray="3 3"/><text x="${X(holdV) - 4}" y="22" text-anchor="end" fill="${C.hold}">buy and hold ${$(holdV)}</text>
  <line x1="0" x2="${W}" y1="${H}" y2="${H}" stroke="#333"/><text x="0" y="${H + 12}" fill="#555">${$(lo)}</text><text x="${W}" y="${H + 12}" text-anchor="end" fill="#555">${$(hi)}</text><text x="${W / 2}" y="${H + 12}" text-anchor="middle" fill="#555">final value of 2,000 random traders making 2 trades</text></svg>`;
}
// Figure 3: power curves
function fig3() {
  const W = 560, H = 190, Js = [0, 5, 10, 21, 42, 63, 126], xs = (i) => (i / (Js.length - 1)) * W, ys = (p) => 6 + (1 - p) * (H - 12);
  const cols = ["#6b7280", "#2850b8", "#b3262d", "#0b7a4b", "#b7791f", "#7c3aed", "#0e7490"];
  let g = "";
  [0, 0.25, 0.5, 0.75, 1].forEach((p) => (g += `<line x1="0" x2="${W}" y1="${ys(p)}" y2="${ys(p)}" stroke="#e3e3e3"/><text x="-4" y="${ys(p) + 3}" text-anchor="end" fill="#555">${p}</text>`));
  Js.forEach((j, i) => (g += `<text x="${xs(i)}" y="${H + 12}" text-anchor="middle" fill="#555">${j}</text>`));
  let lines = "", leg = "";
  R.scenarios.forEach((s, k) => {
    const pts = R.power.filter((p) => p.id === s.id).map((p, i) => xs(i).toFixed(1) + "," + ys(p.power).toFixed(1)).join(" ");
    lines += `<polyline points="${pts}" fill="none" stroke="${cols[k]}" stroke-width="1.6"/>`;
    leg += `<g transform="translate(${k * 78},${H + 42})"><line x1="0" x2="14" y1="-3" y2="-3" stroke="${cols[k]}" stroke-width="2"/><text x="18" y="0">${s.id}</text></g>`;
  });
  return `<svg viewBox="-30 -8 ${W + 40} ${H + 54}" width="100%" font-family="DejaVu Sans, sans-serif" font-size="9">${g}<line x1="0" x2="${W}" y1="${ys(0.95)}" y2="${ys(0.95)}" stroke="#b3262d" stroke-dasharray="4 3"/>${lines}
  <text x="${W / 2}" y="${H + 24}" text-anchor="middle" fill="#555">timing error J (trading days, uniform ±J around the true peak and trough)</text>${leg}</svg>`;
}
const S = R.scenarios, RU = Object.fromEntries(R.rules.map((r) => [r.id, r]));
const t1 = S.map((s) => `<tr><td>${s.id} ${s.name}</td><td>${s.days}</td><td>${U(s.indexDD, 0)}</td><td>${P(s.hold.ret)}</td><td>${U(s.hold.maxDD, 0)}</td><td>${s.hold.sharpe.toFixed(2)}</td><td>${P(s.quant.ret)}</td><td>${U(s.quant.maxDD, 0)}</td><td>${s.quant.sharpe.toFixed(2)}</td><td>${s.quant.trades}</td></tr>`).join("");
const cell = (x) => (x.trades === 0 ? "no trade" : `${P(x.ret)} (${(x.pct * 100).toFixed(0)})`);
const t2 = S.map((s) => { const r = RU[s.id]; return `<tr><td>${s.id}</td><td>${P(r.oracle.ret)}</td><td>${cell(r.panic)}</td><td>${cell(r.rebound)}</td><td>${cell(r.dip)}</td></tr>`; }).join("");
const cal = R.calibration, mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const fp05 = mean(cal.map((c) => c.fp05)), fp10 = mean(cal.map((c) => c.fp10));
const fpMin = Math.min(...cal.map((c) => c.fp05)), fpMax = Math.max(...cal.map((c) => c.fp05));
const pw = (id, J) => R.power.find((p) => p.id === id && p.J === J).power;
const pwRange = (J) => { const v = S.map((s) => pw(s.id, J)); return [Math.min(...v), Math.max(...v)]; };
const r10 = pwRange(10), r21 = pwRange(21), r63 = pwRange(63), r126 = pwRange(126);
const quantWinsRet = S.filter((s) => s.quant.ret > s.hold.ret).length, quantWinsSh = S.filter((s) => s.quant.sharpe > s.hold.sharpe).length;
const ddHold = S.map((s) => s.hold.maxDD), ddQ = S.map((s) => s.quant.maxDD);
const cs = R.caseStudy;

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Crash Replay: Telling Skill from Luck in Market-Crash Decisions with a Permutation Test</title>
<style>
@page{size:Letter;margin:.8in .85in}
body{font-family:"Times New Roman","Liberation Serif","DejaVu Serif",serif;font-size:10.5pt;line-height:1.38;color:#111}
h1{font-size:17pt;text-align:center;margin:0 0 6pt;line-height:1.2}.authors{text-align:center;margin-bottom:14pt}
.abstract{margin:0 .35in 12pt;font-size:9.8pt}.abstract b{display:block;text-align:center;margin-bottom:3pt}
h2{font-size:12pt;margin:14pt 0 4pt}h3{font-size:10.5pt;margin:10pt 0 3pt;font-style:italic}p{margin:0 0 6pt;text-align:justify}
table{border-collapse:collapse;margin:6pt auto 4pt;font-size:8.6pt}th,td{padding:2pt 6pt;text-align:right}th:first-child,td:first-child{text-align:left}
thead tr{border-top:1.2pt solid #000;border-bottom:.6pt solid #000}tbody tr:last-child{border-bottom:1.2pt solid #000}
.cap{font-size:9pt;text-align:center;margin:2pt 0 10pt}figure{margin:8pt 0;text-align:center;break-inside:avoid}
.box{border:.6pt solid #444;padding:6pt 9pt;margin:6pt 0 8pt;break-inside:avoid}code,.mono{font-family:"DejaVu Sans Mono",monospace;font-size:8.8pt}
.eq{text-align:center;margin:5pt 0;font-style:italic}ol.refs{font-size:9pt;padding-left:16pt}ol.refs li{margin-bottom:2pt}sup{font-size:7pt}
</style></head><body>
<h1>Crash Replay: Telling Skill from Luck in Market-Crash<br>Decisions with a Permutation Test</h1>
<div class="authors">Parveen Kumar Naresh Kumar<br>University of South Florida<br><span class="mono">github.com/parveen06naresh/crash-replay</span></div>

<div class="abstract"><b>Abstract</b>
A good result in one market episode says little about skill, because a path that is rising or falling does most of the work. We describe Crash Replay, an open-source simulator in which a player manages $10,000 through seven real equity drawdowns (1973 to 2022) one trading day at a time, and an engine that scores the result against buy-and-hold, a trend-following quant, and a reference population of 2,000 random traders who make the same number of trades. The percentile of the player among those traders is a permutation test. We check the test three ways. It is calibrated: on traders drawn from the null itself it flags ${U(fp05)} at the 95th percentile (range ${U(fpMin)}–${U(fpMax)} over 14 settings, 400 draws each). It has power: a two-trade player whose timing is within ${"±"}10 trading days of the true peak and trough is detected ${(r10[0] * 100).toFixed(0)}–${(r10[1] * 100).toFixed(0)}% of the time in every crash, but that falls to ${(r63[0] * 100).toFixed(0)}–${(r63[1] * 100).toFixed(0)}% at ±63 days. And it separates three common retail rules: a panic seller in Black Monday is worse than 99.5% of random traders, while a buy-the-dip rule in the 2020 rebound beats essentially all 2,000. The engine has no look-ahead and is tested in CI against historic days.
</div>

<h2>1&nbsp;&nbsp;Introduction</h2>
<p>Anyone who sold in September 2008 and bought back in March 2009 looks brilliant, and anyone who did the opposite looks foolish. Both stories are told after the fact, with the path known. The question a skeptical reader should ask is the one quantitative researchers ask of every backtest: how often would a trader with no information have done as well?<sup>[5,6]</sup> The answer is a number between 0 and 1, and it depends heavily on how many trades were made and how long the episode lasted.</p>
<p>Crash Replay turns that question into something a person can play in about three minutes, then answers it with a permutation test. The contribution is not a trading strategy. It is a small, fully reproducible measurement instrument, and a study of that instrument: is it calibrated, how much power does it have, and does it say sensible things about behaviour people actually exhibit? The code, data pipeline and every experiment in this paper are in the repository and run in under three minutes on a laptop.</p>

<h2>2&nbsp;&nbsp;Design</h2>
<h3>2.1 Data and accounting</h3>
<p>The simulator uses 76 years of daily S&amp;P 500 closes and a Nasdaq series, 3-month Treasury bill yields from FRED, and S&amp;P dividend yields from Robert Shiller's data.<sup>[9]</sup> A portfolio holds an exposure <i>e</i> between 0 and 1 to the index, with the rest in cash at the T-bill rate. Dividends are added to the S&amp;P return; the Nasdaq series is price-only. A decision is made at a close and earns the next day's return, so no decision ever sees the day it is paid for. Each change of exposure costs 5 basis points of the value moved:</p>
<div class="eq">V<sub>t+1</sub> = V<sub>t</sub> (1 + e<sub>t</sub> r<sup>m</sup><sub>t+1</sub> + (1 − e<sub>t</sub>) r<sup>f</sup><sub>t+1</sub>), &nbsp;&nbsp; V ← V − 0.0005 |e′ − e| V on a trade.</div>
<p>Both properties are unit-tested: tomorrow's return cannot change today's value, and a trade costs exactly 5 bp. The tests also pin the data to the record (Black Monday is −20.47%, 29 September 2008 is −8.81%, and the 2008 and 1973 to 1974 index drawdowns are 56.8% and 48.2%).</p>
<h3>2.2 Seven crashes</h3>
<p>Windows are chosen to start before the peak and end after the recovery begins (Table 1). They differ a lot: Black Monday falls 34% in about three months, the dot-com bust takes 78% off the Nasdaq over three years, and the 2011 debt-ceiling episode is a 19% fall that fully recovers within the window.</p>
<h3>2.3 The quant opponent</h3>
<p>The opponent follows two rules used by trend-following funds: be invested only while the close is above its 200-day average<sup>[2,3]</sup>, and size the position as min(1, 15% / realised 20-day volatility)<sup>[4]</sup>, rounded to 5-point steps and only re-sized when the target moves by 10 points. Nothing about it is tuned to any of the seven windows.</p>
<h3>2.4 The skill test</h3>
<p>If a player makes <i>k</i> trades, the reference population is 2,000 traders who also make exactly <i>k</i> trades, on days drawn uniformly without replacement, each moving to a position drawn uniformly from {0, 0.5, 1} other than the current one. Everyone starts fully invested. The player's score is the share of reference traders whose final value is lower, called the percentile <i>q</i>. This is a Monte Carlo permutation test of the null "trade timing is exchangeable with random timing",<sup>[8]</sup> and 1 − <i>q</i> is its one-sided p-value. Conditioning on <i>k</i> matters: a trader who trades twice is not compared with one who trades forty times, and the reference includes the cost of its own trades.</p>

<h2>3&nbsp;&nbsp;Results</h2>
<h3>3.1 A worked example</h3>
<p>Figure 1 is the run shown in the project's demo video: sell everything at the Lehman close (15 September 2008) and go all in on 18 March 2009. It returns ${P(cs.ret)} against ${P(S[3].hold.ret)} for buy-and-hold and ${P(S[3].quant.ret)} for the quant, with a maximum drawdown of ${U(cs.maxDD)} against ${U(S[3].hold.maxDD)}. Against 2,000 random two-trade traders it ranks at the ${(cs.pct * 100).toFixed(1)}th percentile (Figure 2; the in-game number can differ by about a point because each game draws its own seed, and the Monte Carlo standard error at 2,000 draws is 0.6 points). The one-sided p-value is about ${(1 - cs.pct).toFixed(2)}. That is good, but it is not evidence of skill at the 5% level: with one run in one crash, a lucky pair of dates is the more economical explanation, and the game says so to the player.</p>
<figure><div style="width:92%;margin:auto">${fig1()}</div><div class="cap">Figure 1. The worked example. Starting value $10,000, 2007-06-01 to 2009-12-31.</div></figure>
<figure><div style="width:92%;margin:auto">${fig2()}</div><div class="cap">Figure 2. Reference distribution for the worked example. Blue bars are traders the player beats (${(cs.pct * 100).toFixed(1)}%).</div></figure>

<h3>3.2 The seven crashes and the quant</h3>
<table><thead><tr><th>Crash</th><th>Days</th><th>Index DD</th><th colspan="3">Buy and hold</th><th colspan="4">Trend + vol target</th></tr>
<tr><th></th><th></th><th></th><th>Ret</th><th>MaxDD</th><th>Sharpe</th><th>Ret</th><th>MaxDD</th><th>Sharpe</th><th>Trades</th></tr></thead><tbody>${t1}</tbody></table>
<div class="cap">Table 1. The seven windows. Returns are total returns over the window, net of costs, with dividends and cash interest.</div>
<p>The quant has a higher return than holding in ${quantWinsRet} of 7 windows and a higher Sharpe ratio in ${quantWinsSh} of 7; it loses in 2011, where it was whipsawed (11 trades) by a sharp August fall and rebound, and in the 2020 rebound. Its maximum drawdown is ${U(Math.min(...ddQ), 0)}–${U(Math.max(...ddQ), 0)} against ${U(Math.min(...ddHold), 0)}–${U(Math.max(...ddHold), 0)} for holding. This should be read as a property of the scenario selection, not of the rule. The windows were picked because they contain crashes, and trend-following is built to do well in sustained falls;<sup>[3]</sup> a fair evaluation would also include long bull markets, where the same filter lags. The quant is an opponent, not a result.</p>

<h3>3.3 Calibration</h3>
<p>A test that flags skill too often is worse than none. We drew 400 reference-style traders per setting (<i>k</i> = 2 and <i>k</i> = 6, all seven windows), scored each with an independent 1,000-draw test, and counted how often the percentile reached 0.95. The false-positive rate is ${U(fp05)} on average (range ${U(fpMin)}–${U(fpMax)}), and ${U(fp10)} at the 0.90 threshold, within Monte Carlo error of the nominal 5% and 10% (the standard error at <i>N</i> = 400 is 1.1 points). The mean percentile is between 0.48 and 0.52 everywhere. This confirms the implementation rather than the realism of the null, which is a modelling choice discussed in Section 5.</p>

<h3>3.4 Power</h3>
<p>Power depends on the effect: how much better than random timing a player is. We use a controlled one. A noisy oracle sells within ±<i>J</i> trading days of the true peak and buys within ±<i>J</i> days of the true trough (two trades), with <i>J</i> drawn uniformly, and we report how often its percentile reaches 0.95 (200 oracles per cell). Figure 3 shows the result. At <i>J</i> = 10, about two weeks, detection is ${(r10[0] * 100).toFixed(0)}–${(r10[1] * 100).toFixed(0)}% in every crash. At 21 days it is ${(r21[0] * 100).toFixed(0)}–${(r21[1] * 100).toFixed(0)}%, at 63 days ${(r63[0] * 100).toFixed(0)}–${(r63[1] * 100).toFixed(0)}%, and at 126 days ${(r126[0] * 100).toFixed(0)}–${(r126[1] * 100).toFixed(0)}%.</p>
<p>The spread across crashes is the useful finding. Long, deep windows (2008, 1973, 2000) keep power above 0.8 at 42 days because a mistimed exit still avoids most of the fall; Black Monday, which is over in about three months, drops below 0.4 at the same error. The practical reading is that a high percentile is strong evidence of good timing in a long crash, and a middling one in a short crash tells you almost nothing, because there was little to time. The game reports the percentile with the sentence "better than most, though luck could still explain it" for exactly this reason.</p>
<figure><div style="width:92%;margin:auto">${fig3()}</div><div class="cap">Figure 3. Detection rate (percentile ≥ 0.95) of a two-trade player with timing error J. Dashed line: 0.95.</div></figure>

<h3>3.5 Three common behaviours</h3>
<p>To check that the test says sensible things about real behaviour, we ran three mechanical rules with thresholds fixed in advance (not tuned). <b>Panic seller</b>: sell everything when the index is 20% below its running peak, and buy back only when it regains that peak. <b>Rebound buyer</b>: sell at the same trigger, buy back after a 20% bounce off the post-sale low. <b>Dip buyer</b>: start half invested, go all in at −20% from peak. An oracle that sells at the peak close and buys at the trough close shows the ceiling. Table 2 gives returns with the percentile in brackets.</p>
<table><thead><tr><th>Crash</th><th>Oracle</th><th>Panic seller</th><th>Rebound buyer</th><th>Dip buyer</th></tr></thead><tbody>${t2}</tbody></table>
<div class="cap">Table 2. Return and percentile among random traders with the same trade count (in brackets). The oracle ranks 100 everywhere by construction. "No trade": the −20% trigger never fired in 2011, whose fall was 19%.</div>
<p>The panic seller's results are mixed, and instructively so. It is catastrophic in Black Monday (${P(RU["1987"].panic.ret)}, percentile ${(RU["1987"].panic.pct * 100).toFixed(1)}: worse than 99.5% of random single-trade traders), because the \u221220% trigger first fires at the close of the crash day itself, near the low, and the rule then sits in cash through the rebound. It is also poor in 2020 (${P(RU["2020"].panic.ret)}, percentile ${(RU["2020"].panic.pct * 100).toFixed(0)}). In the dot-com bust it ranks ${(RU["2000"].panic.pct * 100).toFixed(0)} (${P(RU["2000"].panic.ret)}): the Nasdaq never regained its 2000 peak inside the window, so staying in cash was right. In 1973 and 2008 it is unremarkable. The dip buyer is the clearest split: ${P(RU["2020"].dip.ret)} in 2020 (percentile 100, the V-shaped rebound rewarded buying early) and ${P(RU["2000"].dip.ret)} in 2000 (percentile ${(RU["2000"].dip.pct * 100).toFixed(1)}, buying a falling Nasdaq at −20% two years early). Neither is skill or stupidity. They are one rule meeting two different paths, which is precisely what a single-crash anecdote cannot show, and why the game lets a player try several crashes.</p>

<h2>4&nbsp;&nbsp;Related Work</h2>
<p>Barber and Odean show that active retail trading lowers returns on average,<sup>[1]</sup> which motivates conditioning the null on trade count. Faber and Moskowitz, Ooi and Pedersen document trend and time-series momentum rules of the kind the quant uses,<sup>[2,3]</sup> and Moreira and Muir study volatility-targeted sizing.<sup>[4]</sup> The statistical frame is the standard one for backtest overfitting and data snooping: White's reality check,<sup>[6]</sup> and the deflated Sharpe ratio and the warning against tuning many variants on one path.<sup>[5,7]</sup> We apply the same logic to a single player's decisions, with a simulation null instead of an analytic one.</p>

<h2>5&nbsp;&nbsp;Limitations</h2>
<p><b>The null is a model.</b> Random timing to random exposures is a convenient reference, not a model of a skilled trader or of a typical investor; a different null (for example, uniform over exposures in [0, 1], or timing drawn near turning points) changes the percentile. <b>Seven windows chosen for being crashes</b> bias every comparison with buy-and-hold, as noted in Section 3.2. <b>One index at a time</b>, daily closes only, no taxes, a flat 5 bp cost, and exposure in only three levels for the reference. <b>Few trades.</b> With one or two trades the test has few distinct reference outcomes, and a single percentile has Monte Carlo error of about 0.6 points. <b>No multiple-comparison correction</b> across replays: a player who tries all seven crashes and reports the best has inflated their own result (the game's per-crash percentile does not account for this). <b>The behavioural rules</b> in Section 3.5 are three simple stand-ins, not a study of investors, and we did not tune them. <b>Educational use only</b>; none of this is investment advice.</p>
<h2>6&nbsp;&nbsp;Reproducing</h2>
<p>Everything is in the repository: <code>node --test tests/</code> runs the 7 engine tests, <code>node paper/experiments.mjs</code> regenerates every number in this paper from the same <code>web/engine.js</code> the game runs (seeded, deterministic, about two minutes), and <code>node paper/build.mjs</code> rebuilds the figures and tables. The game is playable at parveenkumar.site/crash-replay.</p>

<h2>References</h2>
<ol class="refs">
<li>B. Barber and T. Odean. Trading is hazardous to your wealth: the common stock investment performance of individual investors. <i>Journal of Finance</i> 55(2), 2000.</li>
<li>M. Faber. A quantitative approach to tactical asset allocation. <i>Journal of Wealth Management</i> 9(4), 2007.</li>
<li>T. Moskowitz, Y. Ooi and L. Pedersen. Time series momentum. <i>Journal of Financial Economics</i> 104(2), 2012.</li>
<li>A. Moreira and T. Muir. Volatility-managed portfolios. <i>Journal of Finance</i> 72(4), 2017.</li>
<li>D. Bailey, J. Borwein, M. López de Prado and Q. Zhu. Pseudo-mathematics and financial charlatanism: the effects of backtest overfitting on out-of-sample performance. <i>Notices of the AMS</i> 61(5), 2014.</li>
<li>H. White. A reality check for data snooping. <i>Econometrica</i> 68(5), 2000.</li>
<li>D. Bailey and M. López de Prado. The deflated Sharpe ratio. <i>Journal of Portfolio Management</i> 40(5), 2014.</li>
<li>P. Good. <i>Permutation, Parametric and Bootstrap Tests of Hypotheses</i>, 3rd ed. Springer, 2005.</li>
<li>R. Shiller. <i>Irrational Exuberance</i> (online data), Yale. S&amp;P composite prices and dividends. Also: FRED, Federal Reserve Bank of St. Louis, 3-month Treasury bill; Yahoo Finance index histories.</li>
</ol>
</body></html>`;
writeFileSync(new URL("./crash-replay.html", import.meta.url), html);
console.log("ok", html.length);
