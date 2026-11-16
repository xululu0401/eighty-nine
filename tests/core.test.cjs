/* 八十九分最亏 · 核心测试：node --test tests/core.test.cjs
 * 锚点：tests/ref.json（独立 Python Fraction 参考实现，逐整数分枚举、不用「只看分数线」剪枝，300 组）、
 *       默认场景手算、常识性质（不信引擎自报）。 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const A = require(path.join(__dirname, '..', 'core.js'));
const REF = JSON.parse(fs.readFileSync(path.join(__dirname, 'ref.json'), 'utf8'));
const S = (o) => Object.assign(A.defaultState(), o);
const C1 = (credits, score) => ({ name: 'x', credits: String(credits), score: String(score) });

test('默认场景：本学期 / 累计 / 每门下一条线 / 最少多考几分（手算核对）', () => {
  const o = A.compute(A.defaultState());
  assert.ok(o.ok);
  /* 手算：细档 89→3.7、83→3.3、81→3.0、92→4.0、77→2.7、85→3.7；学分 5/4/3/3/2/1 = 18 */
  const sem = (5 * 3.7 + 4 * 3.3 + 3 * 3.0 + 3 * 4.0 + 2 * 2.7 + 1 * 3.7);
  assert.equal(Math.round(sem * 100), 6180);
  assert.equal(o.sem, '3.433'); /* 61.8 / 18 = 3.4333… */
  /* 累计：(62×3.31 + 61.8) / 80 = 266.92 / 80 = 3.3365 → 截断 3.336？ 62×3.31=205.22，+61.8=267.02，/80=3.33775 */
  assert.equal(62 * 331 + 6180, 26702);
  assert.equal(o.cum, '3.337');
  assert.equal(o.max, '3.465'); /* 全 100：(205.22 + 18×4) / 80 = 3.46525 */
  assert.deepEqual(o.rows.map((r) => r.next ? r.next.t + '/' + r.next.d + '/' + r.next.dStr : '顶'), ['90/1/+0.019', '85/2/+0.020', '82/1/+0.011', '顶', '78/1/+0.008', '90/5/+0.004']);
  /* 每多考 1 分换多少（×100 学分绩点 / 分）：高数 5×30/1=150，物理 4×40/2=80，线代 3×30/1=90，英语 2×30/1=60，形策 1×30/5=6 */
  assert.deepEqual(o.rank, [0, 2, 1, 4, 5]);
  assert.deepEqual(o.edge, [5]);
  assert.deepEqual(o.near, [0, 1, 2, 4]); /* 差 1–2 分就跨线的 */ /* 形策 85 正好压在 85 线上 */
  assert.equal(o.rows[5].onLine.dStr, '−0.005');
  /* 目标 3.40：要 3.40×80 = 272，差 272 − 267.02 = 4.98（学分绩点） */
  assert.equal(o.status, 'reachable');
  assert.equal(o.points, 7); assert.equal(o.planCourses, 3); assert.equal(o.planCum, '3.402');
  assert.deepEqual(o.plan.filter((x) => x.cost).map((x) => x.from + '→' + x.to), ['89→90', '83→85', '81→85']);
  /* 方案增益 = 5×0.3 + 4×0.4 + 3×0.7 = 1.5 + 1.6 + 2.1 = 5.2 ≥ 4.98 */
  assert.equal(o.plan.reduce((a, x) => a + x.gain, 0), 1040); /* 增益用半学分×绩点×100 单位：5.2 × 2 × 100 */
  assert.deepEqual(o.actions.map((a) => a.id), ['actPlan']);
  assert.deepEqual(o.actions[0].set.scores, ['90', '85', '85', '92', '77', '85']);
});

test('最少多考几分：没有 6 分以内的方案（逐整数分暴力枚举所有组合）', () => {
  const o = A.compute(A.defaultState()), P = o.P;
  const base = P.courses.map((c) => A.gp(P.scale, c.score));
  let best = Infinity;
  const rec = (i, cost, gain) => {
    if (cost >= best) return;
    if (i === P.courses.length) { if (gain >= o.need) best = cost; return; }
    for (let t = P.courses[i].score; t <= 100; t++) rec(i + 1, cost + t - P.courses[i].score, gain + P.courses[i].c2 * (A.gp(P.scale, t) - base[i]));
  };
  rec(0, 0, 0);
  assert.equal(best, 7);
});

test('300 组独立参考实现对拍：本学期、累计、全 100 上限、状态、最少几分、方案后累计', () => {
  let n = 0;
  const seen = {};
  for (const c of REF) {
    const o = A.compute(c.state);
    assert.ok(o.ok, JSON.stringify(c.state) + JSON.stringify(o.errors));
    const g = { sem: o.sem, cum: o.cum, max: o.max, status: o.status };
    if (o.status === 'reachable') { g.points = o.points; g.planCum = o.planCum; }
    assert.deepEqual(g, c.out, JSON.stringify(c.state));
    seen[o.status] = (seen[o.status] || 0) + 1; n++;
  }
  assert.equal(n, 300);
  for (const k of ['none', 'reached', 'reachable', 'impossible']) assert.ok(seen[k] >= 20, k + ' 只有 ' + seen[k]);
});

test('三种换算表：分档边界两侧', () => {
  const sc = A.SCALES;
  assert.deepEqual([59, 60, 69, 70, 79, 80, 89, 90, 100].map((s) => A.gp(sc.five, s)), [0, 100, 100, 200, 200, 300, 300, 400, 400]);
  assert.deepEqual([84, 85, 81, 82, 63, 64, 59].map((s) => A.gp(sc.fine, s)), [330, 370, 300, 330, 100, 150, 0]);
  assert.deepEqual([59, 60, 61, 89, 100].map((s) => A.gp(sc.linear, s)), [0, 100, 110, 390, 500]);
  /* 一分一档的表：下一条线永远差 1 分 */
  const o = A.compute(S({ scale: 'linear' }));
  assert.ok(o.rows.every((r) => r.next ? r.next.d === 1 : r.score === 100));
});

test('掉 1 分就掉档（压线）与已经到顶', () => {
  const o = A.compute(S({ scale: 'five', courses: [C1(4, 90), C1(2, 100), C1(3, 89), C1(1, 60), C1(1, 0)], prevCredits: '0', prevGpa: '' }));
  assert.ok(o.ok);
  assert.deepEqual(o.rows.map((r) => r.onLine ? r.onLine.num : 0), [800, 0, 0, 200, 0]); /* num 用半学分单位（×2）：90 掉到 89 损 1 档 ×4 学分 = 8×100；100 不在线上；0 分掉不了 */
  assert.equal(o.rows[0].next, null); assert.equal(o.rows[1].next, null);
  assert.equal(o.rows[2].next.t, 90);
  assert.equal(o.rows[4].next.t, 60); assert.equal(o.rows[4].next.d, 60);
  /* 「差一两分」只收差 1–2 分的：77 差 3 分不算，78 差 2 分算 */
  assert.deepEqual(A.compute(S({ scale: 'five', courses: [C1(2, 77), C1(2, 78)] })).near, [1]);
});

test('目标已到 / 到不了 / 正好等于：阈值两侧', () => {
  const r = A.compute(S({ target: '3.33' }));
  assert.equal(r.status, 'reached');
  /* 目标正好等于累计（整数比较不靠浮点）：W/C = 26702/80 = 333.775（×100） → 用一个能整除的例子 */
  const eq = A.compute(S({ prevCredits: '0', prevGpa: '', courses: [C1(2, 90), C1(2, 80)], scale: 'five', target: '3.50' }));
  assert.equal(eq.cum, '3.500'); assert.equal(eq.status, 'reached');
  const up = A.compute(S({ prevCredits: '0', prevGpa: '', courses: [C1(2, 90), C1(2, 80)], scale: 'five', target: '3.51' }));
  assert.equal(up.status, 'reachable'); assert.equal(up.points, 10); assert.equal(up.planCum, '4.000');
  const imp = A.compute(S({ target: '3.47' }));
  assert.equal(imp.status, 'impossible'); assert.equal(imp.max, '3.465');
  assert.deepEqual(imp.actions.map((a) => a.id), ['actMax', 'actTop']);
  assert.equal(imp.actions[0].set.target, '3.46');
  assert.equal(A.compute(S({ target: '3.46' })).status, 'reachable');
  assert.equal(A.compute(S({ target: '' })).status, 'none');
});

test('换算表最高分 = 目标上限：全 100 正好到目标', () => {
  const o = A.compute(S({ prevCredits: '0', prevGpa: '', scale: 'five', courses: [C1(3, 70)], target: '4.00' }));
  assert.equal(o.status, 'reachable'); assert.equal(o.points, 20); assert.equal(o.planCum, '4.000');
});

test('同样少的分数里取绩点更高的方案', () => {
  /* 两门：A 3 学分 89（差 1 分 +0.3×3），B 1 学分 89（差 1 分 +0.3×1）；目标只要一门就够 → 都是 1 分，取 A */
  const o = A.compute(S({ prevCredits: '0', prevGpa: '', courses: [C1(1, 89), C1(3, 89)], target: '3.71' }));
  assert.equal(o.status, 'reachable'); assert.equal(o.points, 1);
  assert.deepEqual(o.plan.map((x) => x.to), [89, 90]);
});

test('非法输入：每一项报错并指出字段，多项一起列', () => {
  const bad = A.compute(S({ prevCredits: '-1', prevGpa: '5.5', target: '4.1', courses: [{ name: '', credits: '0', score: '101' }, { name: '体育', credits: '1.3', score: '88.5' }] }));
  assert.equal(bad.ok, false);
  assert.deepEqual(bad.errors.map((e) => e.field).sort(), ['c0_credits', 'c0_score', 'c1_credits', 'c1_score', 'prevCredits', 'prevGpa', 'target'].sort());
  assert.ok(bad.errors.some((e) => e.message.indexOf('「第 1 门」') >= 0));
  assert.equal(A.compute(S({ prevGpa: '4.10' })).errors[0].field, 'prevGpa'); /* 细档满分 4.0 */
  assert.equal(A.compute(S({ prevGpa: '3.315' })).errors[0].field, 'prevGpa'); /* 三位小数 */
  assert.equal(A.compute(S({ courses: [] })).errors[0].field, 'courses');
  assert.equal(A.compute(S({ courses: Array.from({ length: 13 }, () => C1(1, 80)) })).ok, false);
  assert.ok(A.compute(S({ courses: Array.from({ length: 12 }, () => C1(1, 80)) })).ok);
  assert.equal(A.compute(S({ scale: 'nope' })).errors[0].field, 'scale');
  /* 没修过：已修 0 学分，已有绩点可以留空 */
  const fresh = A.compute(S({ prevCredits: '0', prevGpa: '' }));
  assert.ok(fresh.ok); assert.equal(fresh.cum, fresh.sem);
  assert.equal(A.compute(S({ prevCredits: '10', prevGpa: '' })).ok, false);
  /* 全角与中文标点 */
  assert.ok(A.compute(S({ prevGpa: '3。31', prevCredits: '62．0' })).ok);
  assert.equal(A.compute(S({ prevCredits: '62.5' })).ok, true);
  assert.equal(A.compute(S({ prevCredits: '62.25' })).ok, false);
});

test('自己填的换算表：解析、排序、重复、倒挂、空', () => {
  const ok = A.compute(S({ scale: 'custom', custom: '60=1.0，90=4.0；80:3.0 70＝2' }));
  assert.ok(ok.ok, JSON.stringify(ok.errors));
  assert.deepEqual(ok.P.scale.rows, [[90, 400], [80, 300], [70, 200], [60, 100]]);
  assert.equal(ok.sem, A.compute(S({ scale: 'five' })).sem);
  assert.match(A.compute(S({ scale: 'custom', custom: '90=4, 90=3.9' })).errors[0].message, /写了两次/);
  assert.match(A.compute(S({ scale: 'custom', custom: '90=3, 80=3.5' })).errors[0].message, /反而越高/);
  assert.match(A.compute(S({ scale: 'custom', custom: '' })).errors[0].message, /空的/);
  assert.match(A.compute(S({ scale: 'custom', custom: '90=4.0, 优秀=4' })).errors[0].message, /优秀=4/);
  assert.match(A.compute(S({ scale: 'custom', custom: '90=5.01' })).errors[0].message, /看不懂/);
  /* 两档同绩点：只有绩点真变高的线才算「下一条线」 */
  const flat = A.compute(S({ scale: 'custom', custom: '90=4, 85=3, 80=3, 60=1', prevCredits: '0', prevGpa: '', courses: [C1(2, 79)] }));
  assert.equal(flat.rows[0].next.t, 80);
  const flat2 = A.compute(S({ scale: 'custom', custom: '90=4, 85=3, 80=3, 60=1', prevCredits: '0', prevGpa: '', courses: [C1(2, 80)] }));
  assert.equal(flat2.rows[0].next.t, 90);
});

test('截断显示：显示值 ≥ 目标 ⇔ 真实值 ≥ 目标（逐个精确核对）', () => {
  for (const c of REF) {
    const o = A.compute(c.state); if (o.P.target == null) continue;
    const shown = Math.round(Number(o.cum) * 1000), real = o.W * 10 / o.C2; /* 千分位单位 */
    assert.ok(shown <= real + 1e-9 && real < shown + 1);
    assert.equal(Math.round(Number(o.cum) * 1000) >= o.P.target * 10, o.status === 'reached');
  }
  assert.equal(A.gpaStr(1, 3), '0.003'); assert.equal(A.gpaStr(2, 3), '0.006');
  assert.equal(A.dStr(-5, 80), '−0.001'); assert.equal(A.dStr(4, 80), '+0.001'); assert.equal(A.dStr(3, 80), '+0.000');
});

test('格式：学分半分、绩点两位', () => {
  assert.deepEqual([1, 2, 3, 9, 40].map(A.credit), ['0.5', '1', '1.5', '4.5', '20']);
  assert.deepEqual([0, 5, 370, 400].map(A.g2), ['0.00', '0.05', '3.70', '4.00']);
  assert.equal(A.short('一二三四五六七八'), '一二三四五六七八');
  assert.equal(A.short('一二三四五六七八九'), '一二三四五六七…');
});

test('导出：CSV 防公式注入与转义，MD 转义竖线，出错时为空', () => {
  const o = A.compute(S({ courses: [{ name: '=HYPERLINK("x")', credits: '2', score: '88' }, { name: 'a|b,c', credits: '1', score: '70' }] }));
  const csv = A.toCSV(o, 'T');
  assert.ok(csv.indexOf('"=HYPERLINK(""x"")"') >= 0);
  assert.ok(csv.indexOf('"a|b,c"') >= 0);
  const inj = A.toCSV(A.compute(S({ courses: [{ name: '=1+1', credits: '2', score: '88' }, { name: '-2', credits: '1', score: '70' }] })), 'T');
  assert.ok(inj.indexOf('\n"=1+1",') >= 0 && inj.indexOf('\n"-2",') >= 0);
  assert.equal(csv.split('\n')[0], '八十九分最亏,导出 T');
  const md = A.toMD(o, 'T');
  assert.ok(md.indexOf('a\\|b,c') >= 0);
  assert.ok(md.indexOf('不代表任何具体学校') >= 0);
  const d = A.compute(A.defaultState());
  assert.ok(A.toMD(d, 'T').indexOf('89→90') >= 0 && A.toCSV(d, 'T').split('\n').length === 6 + 6);
  assert.equal(A.toCSV(A.compute(S({ prevCredits: 'x' })), 'T'), '');
});
