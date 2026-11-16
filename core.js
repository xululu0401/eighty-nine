/* 八十九分最亏 · 计算核心（core.js）
 * 问题：绩点按分数「分档」换算，89 和 90 可能差一整档，80 和 89 却一样。期末前精力有限，
 *       把哪门课多考几分最值？想把累计绩点拉到某个数，最少要多考几分、加在哪几门？
 * 模型（设计选择，页面「怎么算的」里写明）：
 *   - 换算表：分数 ≥ 某个线就给对应绩点（取满足的最高那条线），低于最低线给 0。
 *     预置三种常见形式（五档、细档、(分数−50)÷10），也可以自己填学校的表；预置表不代表任何具体学校。
 *   - 累计绩点 = (已修学分 × 已有绩点 + Σ 本学期每门学分 × 该门绩点) ÷ 总学分。
 *   - 「最少多考几分」：每门课只可能把分数提到某条线上（停在两条线中间是白考），
 *     对每门课的每条更高的线做分组背包，求「多考的总分最少、且累计绩点 ≥ 目标」，同样少时取绩点更高的。
 * 精确性：学分以 0.5 为单位（×2 成整数），绩点以 0.01 为单位（×100 成整数），
 *         比较全用整数；显示的绩点截到小数点后 3 位（不四舍五入），所以显示值 ≥ 目标 ⇔ 真实值 ≥ 目标。 */
(function (root) {
  'use strict';
  var MAX_COURSES = 12, MAX_PREV_CREDITS = 400, MAX_CREDIT = 20;

  var SCALES = {
    five: { name: '五档（90/80/70/60）', rows: [[90, 400], [80, 300], [70, 200], [60, 100]] },
    fine: { name: '细档（90 / 85 / 82 / 78 / 75 / 72 / 68 / 64 / 60）', rows: [[90, 400], [85, 370], [82, 330], [78, 300], [75, 270], [72, 230], [68, 200], [64, 150], [60, 100]] },
    linear: { name: '每分都算：(分数 − 50) ÷ 10，60 分以下 0', rows: (function () { var r = []; for (var s = 100; s >= 60; s--) r.push([s, (s - 50) * 10]); return r; })() }
  };

  function defaultState() {
    return {
      scale: 'fine', custom: '90=4.0, 85=3.7, 82=3.3, 78=3.0, 75=2.7, 72=2.3, 68=2.0, 64=1.5, 60=1.0',
      prevCredits: '62', prevGpa: '3.31', target: '3.40',
      courses: [
        { name: '高等数学（下）', credits: '5', score: '89' },
        { name: '大学物理', credits: '4', score: '83' },
        { name: '线性代数', credits: '3', score: '81' },
        { name: '程序设计基础', credits: '3', score: '92' },
        { name: '大学英语', credits: '2', score: '77' },
        { name: '形势与政策', credits: '1', score: '85' }
      ]
    };
  }

  function blank(s) { return String(s == null ? '' : s).trim() === ''; }
  function clean(s) { return String(s == null ? '' : s).trim().replace(/，/g, ',').replace(/。/g, '.').replace(/．/g, '.'); }
  /* 十进制字符串 → 乘以 10^d 后的整数；小数位超过 d 或不是数字 → NaN */
  function fixed(s, d) {
    s = clean(s);
    var m = /^(\d+)(?:\.(\d+))?$/.exec(s);
    if (!m) return NaN;
    var f = m[2] || '';
    if (f.length > d) { if (/^0*$/.test(f.slice(d))) f = f.slice(0, d); else return NaN; }
    while (f.length < d) f += '0';
    return Number(m[1] + f);
  }

  function parseCustom(text) {
    var parts = clean(text).replace(/[；、]/g, ',').split(/[,;\s\n]+/).filter(Boolean), rows = [], bad = [];
    parts.forEach(function (p) {
      var m = /^(\d+(?:\.\d+)?)\s*[=:：＝]\s*(\d+(?:\.\d+)?)$/.exec(p);
      if (!m) { bad.push(p); return; }
      var s = fixed(m[1], 0), g = fixed(m[2], 2);
      if (!(s >= 0 && s <= 100) || !(g >= 0 && g <= 500)) { bad.push(p); return; }
      rows.push([s, g]);
    });
    return { rows: rows, bad: bad };
  }

  function parse(st) {
    var E = [];
    function err(f, m) { E.push({ field: f, message: m }); }
    var scale = null, scaleKey = st.scale;
    if (scaleKey === 'custom') {
      var pc = parseCustom(st.custom);
      if (pc.bad.length) err('custom', '自己填的换算表有看不懂的项：' + pc.bad.slice(0, 3).join('、') + '。写成「分数线=绩点」，比如 90=4.0，用逗号隔开；绩点最多两位小数、不超过 5。');
      else if (!pc.rows.length) err('custom', '自己填的换算表是空的。写成「90=4.0, 80=3.0, 60=1.0」这样。');
      else {
        var rows = pc.rows.slice().sort(function (a, b) { return b[0] - a[0]; }), seen = {};
        for (var i = 0; i < rows.length; i++) {
          if (seen[rows[i][0]]) { err('custom', '换算表里 ' + rows[i][0] + ' 分写了两次。'); break; }
          seen[rows[i][0]] = 1;
          if (i && rows[i][1] > rows[i - 1][1]) { err('custom', '换算表里分数线越低绩点反而越高（' + rows[i][0] + ' 分 ' + g2(rows[i][1]) + ' > ' + rows[i - 1][0] + ' 分 ' + g2(rows[i - 1][1]) + '），检查一下。'); break; }
        }
        if (!E.length) scale = { name: '自己填的表', rows: rows };
      }
    } else if (SCALES[scaleKey]) scale = SCALES[scaleKey];
    else err('scale', '先选一种绩点换算方式。');
    var top = scale ? scale.rows[0][1] : 500;

    var pC2 = fixed(st.prevCredits, 1);
    if (!(pC2 >= 0 && pC2 <= MAX_PREV_CREDITS * 10 && pC2 % 5 === 0)) { err('prevCredits', '已修学分填 0 到 400，最小单位 0.5（没修过就填 0）。'); pC2 = null; } else pC2 = pC2 / 5;
    var pG = null;
    if (pC2 === 0 && blank(st.prevGpa)) pG = 0;
    else {
      pG = fixed(st.prevGpa, 2);
      if (!(pG >= 0 && pG <= 500)) { err('prevGpa', '已有的平均绩点填 0 到 5，最多两位小数。'); pG = null; }
      else if (scale && pG > top) { err('prevGpa', '已有绩点 ' + g2(pG) + ' 比这张换算表的满分 ' + g2(top) + ' 还高，换算方式可能选错了。'); pG = null; }
    }
    var tg = null;
    if (!blank(st.target)) {
      tg = fixed(st.target, 2);
      if (!(tg >= 0 && tg <= 500)) { err('target', '目标绩点填 0 到 5，最多两位小数；不想设目标就留空。'); tg = null; }
      else if (scale && tg > top) { err('target', '目标 ' + g2(tg) + ' 比满分 ' + g2(top) + ' 还高。'); tg = null; }
    }
    var cs = Array.isArray(st.courses) ? st.courses : [], C = [];
    if (!cs.length) err('courses', '本学期至少要有一门课。');
    if (cs.length > MAX_COURSES) err('courses', '最多 ' + MAX_COURSES + ' 门课。');
    cs.slice(0, MAX_COURSES).forEach(function (c, i) {
      var nm = String(c && c.name != null ? c.name : '').trim().slice(0, 40) || ('第 ' + (i + 1) + ' 门');
      var c2 = fixed(c && c.credits, 1), sc = fixed(c && c.score, 0);
      if (!(c2 >= 5 && c2 <= MAX_CREDIT * 10 && c2 % 5 === 0)) { err('c' + i + '_credits', '「' + nm + '」的学分填 0.5 到 20，最小单位 0.5。'); c2 = null; } else c2 = c2 / 5;
      if (!(sc >= 0 && sc <= 100)) { err('c' + i + '_score', '「' + nm + '」的预计分数填 0 到 100 的整数。'); sc = null; }
      C.push({ name: nm, c2: c2, score: sc });
    });
    if (E.length) return { ok: false, errors: E };
    return { ok: true, P: { scale: scale, scaleKey: scaleKey, pC2: pC2, pG: pG, target: tg, courses: C } };
  }

  /* 分数 → 绩点（×100） */
  function gp(scale, s) { var r = scale.rows; for (var i = 0; i < r.length; i++) if (s >= r[i][0]) return r[i][1]; return 0; }
  /* 比 s 高、且绩点真的更高的那些线（只有提到这些线上才有用） */
  function upLines(scale, s) {
    var cur = gp(scale, s), out = [];
    scale.rows.slice().reverse().forEach(function (r) { if (r[0] > s && r[1] > cur && (!out.length || r[1] > out[out.length - 1].g)) out.push({ t: r[0], g: r[1] }); });
    return out;
  }
  /* 压线：掉 1 分就掉档 */
  function dropLoss(scale, s) { return s > 0 ? gp(scale, s) - gp(scale, s - 1) : 0; }

  /* 截断显示：W/C2 是「绩点×100」，返回截到 3 位小数的字符串 */
  function gpaStr(W, C2) { if (!C2) return '—'; var t = Math.floor(W * 10 / C2); return Math.floor(t / 1000) + '.' + String(t % 1000).padStart(3, '0'); }
  function g2(v) { return Math.floor(v / 100) + '.' + String(v % 100).padStart(2, '0'); }
  /* 绩点增量（×100 单位的分子 / C2）→ 「+0.032」，四舍五入到 3 位 */
  function dStr(num, C2) { var t = Math.round(num * 10 / C2); return (t < 0 ? '−' : '+') + Math.floor(Math.abs(t) / 1000) + '.' + String(Math.abs(t) % 1000).padStart(3, '0'); }
  function credit(c2) { return String(c2 / 2); }

  /* 分组背包：每门课选「不动」或提到某条线上；求多考总分最少且增益 ≥ need；同样少时增益最大 */
  function solve(P, base, need) {
    var cs = P.courses, B = 0, opts = cs.map(function (c) {
      var L = [{ t: c.score, cost: 0, gain: 0 }];
      upLines(P.scale, c.score).forEach(function (u) { L.push({ t: u.t, cost: u.t - c.score, gain: c.c2 * (u.g - base[c.idx]) }); });
      B += L[L.length - 1].cost;
      return L;
    });
    var NEG = -1, dp = [], ch = [];
    var cur = new Array(B + 1).fill(NEG); cur[0] = 0;
    for (var i = 0; i < cs.length; i++) {
      var nx = new Array(B + 1).fill(NEG), pick = new Array(B + 1).fill(-1);
      for (var p = 0; p <= B; p++) {
        for (var j = 0; j < opts[i].length; j++) {
          var o = opts[i][j]; if (o.cost > p || cur[p - o.cost] === NEG) continue;
          var v = cur[p - o.cost] + o.gain;
          if (v > nx[p]) { nx[p] = v; pick[p] = j; }
        }
      }
      ch.push(pick); cur = nx;
    }
    /* cur[p] = 恰好多考 p 分的最大增益；要「至多」→ 前缀最大 */
    var bestP = null;
    for (var q = 0; q <= B; q++) if (cur[q] !== NEG && cur[q] >= need) { bestP = q; break; }
    var maxGain = 0; for (var r = 0; r <= B; r++) if (cur[r] > maxGain) maxGain = cur[r];
    if (bestP == null) return { feasible: false, maxGain: maxGain, maxCost: B };
    /* 同样多考 bestP 分时，cur[bestP] 已是最大增益 */
    var plan = new Array(cs.length), pp = bestP;
    for (var k = cs.length - 1; k >= 0; k--) { var jj = ch[k][pp]; plan[k] = opts[k][jj]; pp -= opts[k][jj].cost; }
    return { feasible: true, points: bestP, gain: cur[bestP], plan: plan, maxGain: maxGain, maxCost: B };
  }

  function compute(st) {
    var pr = parse(st);
    if (!pr.ok) return pr;
    var P = pr.P, o = { ok: true, P: P };
    var base = P.courses.map(function (c) { return gp(P.scale, c.score); });
    P.courses.forEach(function (c, i) { c.idx = i; });
    var semC2 = 0, semW = 0;
    P.courses.forEach(function (c, i) { semC2 += c.c2; semW += c.c2 * base[i]; });
    var C2 = P.pC2 + semC2, W = P.pC2 * P.pG + semW;
    o.semC2 = semC2; o.semW = semW; o.C2 = C2; o.W = W;
    o.sem = gpaStr(semW, semC2); o.cum = gpaStr(W, C2);
    o.rows = P.courses.map(function (c, i) {
      var ups = upLines(P.scale, c.score), nx = ups[0] || null, loss = dropLoss(P.scale, c.score);
      return {
        name: c.name, credits: credit(c.c2), c2: c.c2, score: c.score, gp: base[i], gpStr: g2(base[i]),
        next: nx ? { t: nx.t, d: nx.t - c.score, g: nx.g, num: c.c2 * (nx.g - base[i]), dStr: dStr(c.c2 * (nx.g - base[i]), C2), per: c.c2 * (nx.g - base[i]) / (nx.t - c.score) } : null,
        onLine: loss > 0 ? { loss: loss, num: c.c2 * loss, dStr: dStr(-c.c2 * loss, C2) } : null
      };
    });
    /* 「多考 1 分最值」：每多考 1 分换来的累计绩点，按下一条线摊；同样值时学分大的在前、再按原顺序 */
    o.rank = o.rows.map(function (r, i) { return { i: i, r: r }; }).filter(function (x) { return x.r.next; })
      .sort(function (a, b) { return b.r.next.num * a.r.next.d - a.r.next.num * b.r.next.d || b.r.c2 - a.r.c2 || a.i - b.i; }).map(function (x) { return x.i; });
    o.near = o.rows.map(function (r, i) { return r.next && r.next.d <= 2 ? i : -1; }).filter(function (i) { return i >= 0; });
    o.edge = o.rows.map(function (r, i) { return r.onLine ? i : -1; }).filter(function (i) { return i >= 0; });
    o.maxW = W + P.courses.reduce(function (a, c, i) { return a + c.c2 * (gp(P.scale, 100) - base[i]); }, 0);
    o.max = gpaStr(o.maxW, C2);
    o.minW = W - P.courses.reduce(function (a, c, i) { return a + c.c2 * base[i]; }, 0);
    if (P.target != null) {
      var need = P.target * C2 - W;
      o.need = need;
      if (need <= 0) { o.status = 'reached'; o.slackW = -need; }
      else {
        var sv = solve(P, base, need);
        if (!sv.feasible) { o.status = 'impossible'; o.maxTarget = Math.floor(o.maxW / C2); }
        else {
          o.status = 'reachable'; o.plan = sv.plan.map(function (x, i) { return { i: i, from: P.courses[i].score, to: x.t, cost: x.cost, gain: x.gain }; });
          o.points = sv.points; o.planW = W + sv.gain; o.planCum = gpaStr(o.planW, C2);
          o.planCourses = o.plan.filter(function (x) { return x.cost > 0; }).length;
        }
      }
    } else o.status = 'none';
    var acts = [];
    if (o.status === 'reachable') acts.push({ id: 'actPlan', text: '把预计分改成这个方案（' + o.plan.filter(function (x) { return x.cost; }).map(function (x) { return short(P.courses[x.i].name) + ' ' + x.from + '→' + x.to; }).join('、') + '）', set: { scores: o.plan.map(function (x) { return String(x.to); }) } });
    if (o.status === 'impossible') acts.push({ id: 'actMax', text: '把目标改成全考 100 也能到的 ' + g2(o.maxTarget), set: { target: g2(o.maxTarget) } });
    if (o.status !== 'reachable' && o.rank.length) { var b = o.rows[o.rank[0]]; acts.push({ id: 'actTop', text: '先试试最值的一门：' + short(b.name) + ' ' + b.score + '→' + b.next.t + '（累计 ' + b.next.dStr + '）', set: { one: { i: o.rank[0], score: String(b.next.t) } } }); }
    o.actions = acts;
    return o;
  }
  function short(n) { n = String(n); return n.length > 8 ? n.slice(0, 7) + '…' : n; }

  function csvCell(s) { s = String(s); return /[",\n\r]/.test(s) || /^[=+\-@]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  function toCSV(o, stamp) {
    if (!o.ok) return '';
    var P = o.P, L = [];
    L.push(['八十九分最亏', '导出 ' + stamp].map(csvCell).join(','));
    L.push(['换算方式', P.scale.name, '已修学分', credit(P.pC2), '已有绩点', g2(P.pG), '目标', P.target == null ? '未设' : g2(P.target)].map(csvCell).join(','));
    L.push(['本学期绩点', o.sem, '累计绩点', o.cum, '全考 100 最高', o.max].map(csvCell).join(','));
    L.push('');
    L.push(['课程', '学分', '预计分', '这档绩点', '下一条线', '还差几分', '跨过去累计绩点变化', '掉 1 分累计绩点变化', '方案里考到'].map(csvCell).join(','));
    o.rows.forEach(function (r, i) {
      L.push([r.name, r.credits, r.score, r.gpStr, r.next ? r.next.t : '已到顶', r.next ? r.next.d : '', r.next ? r.next.dStr : '', r.onLine ? r.onLine.dStr : '0', o.plan ? o.plan[i].to : ''].map(csvCell).join(','));
    });
    return L.join('\n') + '\n';
  }
  function mdCell(s) { return String(s).replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' '); }
  function headline(o) {
    var P = o.P;
    if (o.status === 'reached') return '按预计分，累计绩点 ' + o.cum + '，已经到 ' + g2(P.target) + '。';
    if (o.status === 'impossible') return '目标 ' + g2(P.target) + ' 这学期到不了：全考 100 累计最高 ' + o.max + '。';
    if (o.status === 'reachable') return '离 ' + g2(P.target) + ' 最少还要多考 ' + o.points + ' 分，分在 ' + o.planCourses + ' 门课上，累计到 ' + o.planCum + '。';
    return '按预计分，本学期 ' + o.sem + '，累计 ' + o.cum + '。';
  }
  function toMD(o, stamp) {
    if (!o.ok) return '';
    var P = o.P, L = ['# 八十九分最亏', '', '导出时间：' + stamp, ''];
    L.push('换算方式：' + P.scale.name + '；已修 ' + credit(P.pC2) + ' 学分、已有绩点 ' + g2(P.pG) + '；目标 ' + (P.target == null ? '未设' : g2(P.target)) + '。', '');
    L.push('**' + headline(o) + '**', '');
    L.push('本学期绩点 ' + o.sem + '，累计 ' + o.cum + '（截到 3 位小数，不四舍五入）。', '');
    L.push('| 课程 | 学分 | 预计分 | 绩点 | 下一条线 | 跨过去累计 | 掉 1 分累计 |' + (o.plan ? ' 方案 |' : ''), '|---|---|---|---|---|---|---|' + (o.plan ? '---|' : ''));
    o.rows.forEach(function (r, i) {
      L.push('| ' + mdCell(r.name) + ' | ' + r.credits + ' | ' + r.score + ' | ' + r.gpStr + ' | ' + (r.next ? r.next.t + '（差 ' + r.next.d + ' 分）' : '已到顶') + ' | ' + (r.next ? r.next.dStr : '—') + ' | ' + (r.onLine ? r.onLine.dStr : '不掉档') + ' |' + (o.plan ? ' ' + (o.plan[i].cost ? r.score + '→' + o.plan[i].to : '不动') + ' |' : ''));
    });
    L.push('', '_换算表以你学校教务的规定为准；预置的三种只是常见形式，不代表任何具体学校。预计分是你自己的估计，默认数字为虚构示例。_');
    return L.join('\n') + '\n';
  }

  var api = { MAX_COURSES: MAX_COURSES, SCALES: SCALES, defaultState: defaultState, parse: parse, parseCustom: parseCustom, gp: gp, upLines: upLines, dropLoss: dropLoss, solve: solve, compute: compute, gpaStr: gpaStr, g2: g2, dStr: dStr, credit: credit, fixed: fixed, headline: headline, short: short, toCSV: toCSV, toMD: toMD };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AppCore = api;
})(typeof window !== 'undefined' ? window : this);
