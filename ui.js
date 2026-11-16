/* 八十九分最亏 · 界面（ui.js）
 * 读 state → AppCore.compute → 把同一次输出画出来。页面自己不做绩点计算。 */
(function () {
  'use strict';
  var A = window.AppCore;
  var KEY = 'eighty-nine:v1';
  var $ = function (id) { return document.getElementById(id); };
  var TOP = ['prevCredits', 'prevGpa', 'target'];
  var SCALE_KEYS = [['fine', '细档'], ['five', '五档'], ['linear', '每分都算'], ['custom', '自己填']];
  var PRESETS = [
    { key: 'base', name: '大二上，冲 3.40（默认）', note: '虚构示例：之前修了 62 学分、平均 3.31，想到 3.40；这学期 6 门课，预计分是自己估的，按「细档」换算。' },
    { key: 'five', name: '五档换算', note: '虚构示例：同一份成绩单，学校按 90/80/70/60 五档换算。', s: { scale: 'five' } },
    { key: 'linear', name: '每分都算', note: '虚构示例：同一份成绩单，学校按（分数 − 50）÷ 10 换算，没有台阶。', s: { scale: 'linear' } },
    { key: 'fresh', name: '大一第一学期', note: '虚构示例：之前没有成绩（已修 0 学分），目标 3.60，其余同默认。', s: { prevCredits: '0', prevGpa: '', target: '3.60' } }
  ];
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function presetState(k) { var s = A.defaultState(), p = PRESETS.filter(function (q) { return q.key === k; })[0]; Object.keys(p.s || {}).forEach(function (f) { s[f] = p.s[f]; }); return s; }
  function norm(s) { var d = { scale: s.scale, custom: s.scale === 'custom' ? s.custom : '', courses: s.courses }; TOP.forEach(function (k) { d[k] = s[k]; }); return JSON.stringify(d); }
  function presetKey(s) { var j = norm(s); for (var i = 0; i < PRESETS.length; i++) if (norm(presetState(PRESETS[i].key)) === j) return PRESETS[i].key; return null; }

  function str(v, n) { return v == null || typeof v === 'object' ? '' : String(v).slice(0, n); }
  function sanitize(s) {
    if (!s || typeof s !== 'object') return null;
    var d = A.defaultState(), any = false;
    TOP.forEach(function (k) { if (k in s) { d[k] = str(s[k], 12); any = true; } });
    if ('custom' in s) { d.custom = str(s.custom, 600); any = true; }
    if (typeof s.scale === 'string' && SCALE_KEYS.some(function (x) { return x[0] === s.scale; })) { d.scale = s.scale; any = true; }
    if (Array.isArray(s.courses)) {
      d.courses = s.courses.slice(0, A.MAX_COURSES).map(function (c) { c = c && typeof c === 'object' ? c : {}; return { name: str(c.name, 40), credits: str(c.credits, 8), score: str(c.score, 8) }; });
      if (!d.courses.length) d.courses = [{ name: '', credits: '', score: '' }];
      any = true;
    }
    return any ? d : null;
  }
  function load() { try { var t = localStorage.getItem(KEY); if (!t) return null; var j = JSON.parse(t); return sanitize(j && j.state); } catch (e) { return null; } }
  var state = load() || A.defaultState();
  var out = null;
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify({ state: state })); $('saveTag').textContent = '· 已存到本机'; }
    catch (e) { $('saveTag').textContent = '· 没能存到本机'; }
  }
  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  /* ── 课程行：输入框只在增删时重建，打字时只更新读数，焦点不丢 ── */
  function buildCourses() {
    var h = '<div class="cr hd"><span>课程</span><span>学分</span><span>预计分</span><span>分数尺（黑 = 预计，橙 = 方案）</span><span>这门的读数</span><span></span></div>';
    state.courses.forEach(function (c, i) {
      h += '<div class="cr" id="row' + i + '"><input class="nm" id="c' + i + '_name" data-i="' + i + '" data-f="name" maxlength="40" placeholder="课程名" value="' + esc(c.name) + '">' +
        '<input class="cs" id="c' + i + '_credits" data-i="' + i + '" data-f="credits" inputmode="decimal" aria-label="学分" value="' + esc(c.credits) + '">' +
        '<input class="sc" id="c' + i + '_score" data-i="' + i + '" data-f="score" inputmode="numeric" aria-label="预计分" value="' + esc(c.score) + '">' +
        '<div class="ruler" id="ru' + i + '"></div><div class="rd" id="rd' + i + '"></div>' +
        '<button type="button" class="x" id="del' + i + '" data-del="' + i + '" title="删掉这门"' + (state.courses.length <= 1 ? ' disabled' : '') + '>×</button></div>';
    });
    $('cl').innerHTML = h;
    $('addC').disabled = state.courses.length >= A.MAX_COURSES;
    $('cnt').textContent = state.courses.length + ' / ' + A.MAX_COURSES + ' 门';
  }
  $('cl').addEventListener('input', function (e) { var t = e.target, i = t.getAttribute('data-i'); if (i == null) return; state.courses[+i][t.getAttribute('data-f')] = t.value; update(); });
  $('cl').addEventListener('click', function (e) { var b = e.target.closest('[data-del]'); if (!b || state.courses.length <= 1) return; state.courses.splice(+b.getAttribute('data-del'), 1); buildCourses(); update(); });
  $('addC').addEventListener('click', function () { if (state.courses.length >= A.MAX_COURSES) return; state.courses.push({ name: '', credits: '2', score: '80' }); buildCourses(); update(); var n = $('c' + (state.courses.length - 1) + '_name'); if (n) n.focus(); });

  function fillTop() { TOP.forEach(function (k) { $(k).value = state[k]; }); $('custom').value = state.custom; }
  TOP.forEach(function (k) { $(k).addEventListener('input', function () { state[k] = this.value; update(); }); });
  $('custom').addEventListener('input', function () { state.custom = this.value; update(); });
  $('scales').addEventListener('click', function (e) { var b = e.target.closest('[data-s]'); if (!b) return; state.scale = b.getAttribute('data-s'); update(); });
  $('presets').addEventListener('click', function (e) { var b = e.target.closest('[data-p]'); if (!b) return; state = presetState(b.getAttribute('data-p')); fillAll(); update(); });
  function fillAll() { fillTop(); buildCourses(); }
  $('acts').addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b) return;
    var a = out.actions.filter(function (x) { return x.id === b.getAttribute('data-act'); })[0]; if (!a) return;
    if (a.set.scores) a.set.scores.forEach(function (v, i) { state.courses[i].score = v; });
    if (a.set.target) state.target = a.set.target;
    if (a.set.one) state.courses[a.set.one.i].score = a.set.one.score;
    fillAll(); update();
  });

  function markErrors() {
    document.querySelectorAll('.bad').forEach(function (e) { e.classList.remove('bad'); });
    if (out.ok) return;
    out.errors.forEach(function (er) { var el = $(er.field); if (el) el.classList.add('bad'); });
  }

  function renderPresets() {
    var key = presetKey(state);
    $('presets').innerHTML = PRESETS.map(function (p) { return '<button type="button" class="chip" id="preset_' + p.key + '" data-p="' + p.key + '" aria-pressed="' + (key === p.key) + '">' + esc(p.name) + '</button>'; }).join('');
    var cur = PRESETS.filter(function (p) { return p.key === key; })[0];
    $('presetNote').textContent = cur ? cur.note : '你改过的（按你填的算）。';
    $('scales').innerHTML = SCALE_KEYS.map(function (s) { return '<button type="button" class="chip" id="scale_' + s[0] + '" data-s="' + s[0] + '" aria-pressed="' + (state.scale === s[0]) + '">' + s[1] + '</button>'; }).join('');
    $('customBox').classList.toggle('hide', state.scale !== 'custom');
  }

  function why(o) {
    var P = o.P, t = [], R = o.rows;
    var lim = function (L) { return L.length > 4 ? L.slice(0, 4).join('、') + ' 等 ' + L.length + ' 门' : L.join('、'); };
    if (P.scale.rows.length > 12) t.push('这张换算表每 1 分一档，没有台阶：哪门多考 1 分都加，学分越大越值，最值的是' + (o.rank.length ? A.short(R[o.rank[0]].name) + '（' + R[o.rank[0]].credits + ' 学分）' : '——每门都已到顶') + '。');
    else if (o.near.length) t.push('差一两分就跨档的有 ' + o.near.length + ' 门：' + lim(o.near.map(function (i) { return A.short(R[i].name) + ' ' + R[i].score + '（差 ' + R[i].next.d + ' 分到 ' + R[i].next.t + '）'; })) + '。');
    else t.push('没有哪门只差一两分就跨档。');
    if (o.edge.length && P.scale.rows.length <= 12) t.push('正好压在线上、掉 1 分就掉档的：' + lim(o.edge.map(function (i) { return A.short(R[i].name) + ' ' + R[i].score + '（累计 ' + R[i].onLine.dStr + '）'; })) + '。');
    if (o.status === 'reached') t.push('就算不多考，也比目标多 ' + A.dStr(o.slackW, o.C2).slice(1) + '。');
    if (o.status === 'impossible') t.push('累计里之前的 ' + A.credit(P.pC2) + ' 学分已经定了，这学期只有 ' + A.credit(o.semC2) + ' 学分能动。');
    return t.join('');
  }

  function head(o) {
    var P = o.P, h = esc(A.headline(o));
    if (o.status === 'reachable') h = h.replace(String(o.points) + ' 分', '<b>' + o.points + ' 分</b>');
    else if (o.status === 'impossible') h = h.replace('到不了', '<b>到不了</b>');
    else if (o.status === 'reached') h = h.replace('已经到', '<b>已经到</b>');
    return h;
  }

  function ruler(r, P, planTo) {
    var lo = Math.max(0, Math.min(50, Math.floor(r.score / 10) * 10)), span = 100 - lo, pos = function (s) { return (100 * (s - lo) / span).toFixed(2) + '%'; };
    var rows = P.scale.rows.slice().reverse().filter(function (x) { return x[0] >= lo; }), topG = P.scale.rows[0][1] || 1, h = '';
    var edges = [lo].concat(rows.map(function (x) { return x[0]; })).concat([100]);
    for (var k = 0; k < edges.length - 1; k++) {
      var a = edges[k], b = k + 1 < edges.length - 1 ? edges[k + 1] : 101, g = A.gp(P.scale, a);
      if (b <= a) continue;
      var w = (100 * (Math.min(b, 101) - a) / (span + 1)).toFixed(2);
      h += '<span class="bd" style="left:' + (100 * (a - lo) / (span + 1)).toFixed(2) + '%;width:' + w + '%;background:rgba(44,86,135,' + (0.08 + 0.62 * g / topG).toFixed(3) + ')"></span>';
    }
    var lab = rows.length > 12 ? rows.filter(function (x) { return x[0] % 10 === 0; }) : rows;
    lab.forEach(function (x) { h += '<span class="tk" style="left:' + (100 * (x[0] - lo) / (span + 1)).toFixed(2) + '%">' + x[0] + '</span>'; });
    var px = function (s) { return (100 * (s - lo + 0.5) / (span + 1)).toFixed(2) + '%'; };
    if (planTo != null && planTo > r.score) h += '<span class="gap" style="left:' + px(r.score) + ';width:' + (100 * (planTo - r.score) / (span + 1)).toFixed(2) + '%"></span><span class="to" style="left:' + px(planTo) + '"></span>';
    h += '<span class="dot" style="left:' + px(r.score) + '"></span>';
    return h;
  }

  function render() {
    var o = out;
    $('errBox').classList.toggle('hide', o.ok);
    ['okBox', 'rankPanel', 'tblPanel'].forEach(function (id) { $(id).classList.toggle('hide', !o.ok); });
    if (!o.ok) {
      $('errBox').innerHTML = '先改好标红的格子：<ul>' + o.errors.map(function (e) { return '<li>' + esc(e.message) + '</li>'; }).join('') + '</ul>';
      state.courses.forEach(function (c, i) { $('ru' + i).innerHTML = ''; $('rd' + i).innerHTML = ''; $('row' + i).classList.remove('plan'); });
      renderScaleTable(null); return;
    }
    var P = o.P;
    $('tot').innerHTML = '<div id="totSem"><span>这学期</span><b>' + o.sem + '</b></div><div id="totCum"><span>累计（' + A.credit(o.C2) + ' 学分）</span><b>' + o.cum + '</b></div>' +
      '<div class="goal" id="totGoal"><span>' + (P.target == null ? '全考 100 最高' : '目标 ' + A.g2(P.target) + (o.status === 'reachable' ? ' · 按方案累计' : '')) + '</span><b>' + (P.target == null ? o.max : o.status === 'reachable' ? o.planCum : o.status === 'reached' ? '已到' : '到不了') + '</b></div>';
    $('headline').innerHTML = head(o);
    $('why').textContent = why(o);
    $('acts').innerHTML = o.actions.map(function (a) { return '<button type="button" class="act" id="' + a.id + '" data-act="' + a.id + '">→ ' + esc(a.text) + '</button>'; }).join('');
    o.rows.forEach(function (r, i) {
      var pl = o.plan ? o.plan[i] : null;
      $('ru' + i).innerHTML = ruler(r, P, pl && pl.cost ? pl.to : null);
      var tags = (o.near.indexOf(i) >= 0 ? '<span class="tag near">差 ' + r.next.d + ' 分</span>' : '') + (o.edge.indexOf(i) >= 0 ? '<span class="tag edge">压线</span>' : '') + (pl && pl.cost ? '<span class="tag pl">方案 →' + pl.to + '</span>' : '');
      $('rd' + i).innerHTML = '绩点 <b>' + r.gpStr + '</b>' + tags + '<br>' + (r.next ? '到 ' + r.next.t + ' 累计 <span class="up">' + r.next.dStr + '</span>' : '已到最高档') + (r.onLine ? ' · <span style="white-space:nowrap">掉 1 分 <span class="dn">' + r.onLine.dStr + '</span></span>' : '');
      $('row' + i).classList.toggle('plan', !!(pl && pl.cost));
    });
    var mx = 0; o.rank.forEach(function (i) { var v = o.rows[i].next.num / o.rows[i].next.d; if (v > mx) mx = v; });
    $('rank').innerHTML = o.rank.length ? o.rank.map(function (i, k) {
      var r = o.rows[i], v = r.next.num / r.next.d;
      return '<li id="rk' + k + '"><span class="i">' + (k + 1) + '</span><span class="t">' + esc(r.name) + ' ' + r.score + ' → ' + r.next.t + '</span><span class="bar"><span style="width:' + (100 * v / mx).toFixed(1) + '%"></span></span><span class="v">' + r.credits + ' 学分，多考 ' + r.next.d + ' 分，绩点 ' + r.gpStr + ' → ' + A.g2(r.next.g) + '，累计 ' + r.next.dStr + (r.next.d > 1 ? '（摊到每分 ' + A.dStr(r.next.num / r.next.d, o.C2) + '）' : '') + '</span></li>';
    }).join('') : '<li><span></span><span class="t">每门都已经在最高档，多考也不加绩点。</span></li>';
    renderTable();
    renderScaleTable(P.scale);
  }

  function renderTable() {
    var o = out;
    var h = '<tr><th>课程</th><th class="n">学分</th><th class="n">预计分</th><th class="n">绩点</th><th class="n">下一条线</th><th class="n">跨过去累计</th><th class="n">掉 1 分累计</th>' + (o.plan ? '<th class="n">方案</th>' : '') + '</tr>';
    o.rows.forEach(function (r, i) {
      h += '<tr id="tr' + i + '"><td>' + esc(r.name) + '</td><td class="n">' + r.credits + '</td><td class="n">' + r.score + '</td><td class="n">' + r.gpStr + '</td><td class="n">' + (r.next ? r.next.t + '（差 ' + r.next.d + '）' : '已到顶') + '</td><td class="n">' + (r.next ? r.next.dStr : '—') + '</td><td class="n">' + (r.onLine ? r.onLine.dStr : '不掉档') + '</td>' + (o.plan ? '<td class="n">' + (o.plan[i].cost ? r.score + '→' + o.plan[i].to : '不动') + '</td>' : '') + '</tr>';
    });
    $('tbl').innerHTML = h;
  }
  function renderScaleTable(sc) {
    if (!sc) { $('scaleTbl').innerHTML = ''; return; }
    var r = sc.rows.length > 12 ? sc.rows.filter(function (x) { return x[0] % 5 === 0; }) : sc.rows;
    $('scaleTbl').innerHTML = '<tr><th>分数达到</th>' + r.map(function (x) { return '<td class="n">' + x[0] + '</td>'; }).join('') + '<td class="n">更低</td></tr><tr><th>绩点</th>' + r.map(function (x) { return '<td class="n">' + A.g2(x[1]) + '</td>'; }).join('') + '<td class="n">0.00</td></tr>' + (sc.rows.length > 12 ? '<tr><td colspan="' + (r.length + 2) + '" class="muted">每 1 分一档，这里只列 5 的倍数</td></tr>' : '');
  }

  function update() { out = A.compute(state); markErrors(); renderPresets(); render(); save(); }

  /* 导出 */
  function stamp() { var d = new Date(), p = function (x) { return (x < 10 ? '0' : '') + x; }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()); }
  function download(name, blob) { var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }
  function tag() { return out.ok ? out.cum : '待改'; }
  $('dlCsv').addEventListener('click', function () { if (out.ok) download('八十九分最亏-逐门.csv', new Blob(['\ufeff' + A.toCSV(out, stamp())], { type: 'text/csv;charset=utf-8' })); });
  $('dlMd').addEventListener('click', function () { if (out.ok) download('八十九分最亏-累计' + tag() + '.md', new Blob([A.toMD(out, stamp())], { type: 'text/markdown;charset=utf-8' })); });
  $('dlJson').addEventListener('click', function () { download('八十九分最亏-备份.json', new Blob([JSON.stringify({ app: '八十九分最亏', slug: 'eighty-nine', version: 1, exported_at: stamp(), state: state }, null, 2)], { type: 'application/json' })); });
  $('impJson').addEventListener('click', function () { $('impFile').click(); });
  $('impFile').addEventListener('change', function () { var f = this.files && this.files[0]; if (!f) return; var rd = new FileReader(); rd.onload = function () { importText(String(rd.result)); }; rd.readAsText(f); this.value = ''; });
  function importText(t) {
    var s = null;
    try { var j = JSON.parse(t); s = sanitize(j && j.state ? j.state : j); } catch (e) { s = null; }
    if (!s) { $('saveTag').textContent = '· 这个文件读不出来，没改动'; return false; }
    state = s; fillAll(); update(); return true;
  }
  $('reset').addEventListener('click', function () { state = A.defaultState(); fillAll(); update(); });

  /* 结果卡 PNG 1080×1350：文字取自同一次 out */
  function drawCard() {
    var W = 1080, H = 1350, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var g = cv.getContext('2d'), FF = '-apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    g.fillStyle = '#f3f1ea'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#fffdf7'; g.fillRect(60, 50, W - 120, H - 100);
    g.strokeStyle = '#d9d5c7'; g.lineWidth = 2; g.strokeRect(60, 50, W - 120, H - 100);
    var L = 110, Rr = W - 110, maxW = Rr - L, y = 150;
    function font(size, bold) { g.font = (bold ? '700 ' : '') + size + 'px ' + FF; }
    function clip(t, w) { t = String(t); if (g.measureText(t).width <= w) return t; while (t.length > 1 && g.measureText(t + '…').width > w) t = t.slice(0, -1); return t + '…'; }
    function wrap(t, size, color, bold, lim) {
      font(size, bold); g.fillStyle = color; var cur = '', n = 0;
      var toks = String(t).match(/[+−]?[0-9.]+ ?(?:分|学分|门)?[）)。，、；：]?|[（(「]?[A-Za-z]+[）)」。，、；：]?|[（(「]?[^\s（(「][）)」。，、；：]?|\s/g) || [];
      for (var i = 0; i < toks.length; i++) { var ch = toks[i]; if (g.measureText(cur + ch).width > maxW && cur) { if (lim && ++n >= lim) { g.fillText(clip(cur + '…', maxW), L, y); y += size * 1.5; return; } g.fillText(cur, L, y); y += size * 1.5; cur = ch.trim() ? ch : ''; } else cur += ch; }
      if (cur) { g.fillText(cur, L, y); y += size * 1.5; }
    }
    font(52, true); g.fillStyle = '#20211d'; g.fillText('八十九分最亏', L, y); y += 20;
    g.fillRect(L, y, maxW, 3); g.fillRect(L, y + 7, maxW, 3); y += 66;
    if (!out.ok) { y += 30; font(48, true); g.fillStyle = '#b3261e'; g.fillText('还算不了', L, y); y += 70; out.errors.slice(0, 6).forEach(function (e) { wrap('· ' + e.message, 28, '#4f5148', false, 2); y += 8; }); y += 30; wrap('改好标红的格子，结果会自动重算。', 26, '#85877c'); y += 40; wrap('这张卡算的是：绩点按分档换算时，期末前哪门课多考几分最值、到目标最少还要多考几分。', 26, '#85877c'); return cv; }
    var o = out, P = o.P;
    wrap(A.headline(o), 40, '#c2410c', true, 3); y += 6;
    wrap('这学期 ' + o.sem + ' · 累计 ' + o.cum + '（' + A.credit(o.C2) + ' 学分）· 全考 100 最高 ' + o.max, 26, '#4f5148', false, 2); y += 4;
    wrap('换算：' + P.scale.name, 22, '#85877c', false, 2); y += 26;
    /* 课程表 */
    var rowsMax = Math.min(o.rows.length, 8), rh = Math.min(86, Math.floor((H - 260 - y) / Math.max(rowsMax, 1)));
    font(20); g.fillStyle = '#85877c'; g.fillText('课程 · 学分', L, y); g.textAlign = 'right'; g.fillText(o.plan ? '方案：预计 → 考到 · 累计变化；其余：下一条线' : '预计 · 下一条线 · 累计变化', Rr, y); g.textAlign = 'left'; y += 12;
    g.fillStyle = '#20211d'; g.fillRect(L, y, maxW, 2); y += 10;
    o.rows.slice(0, rowsMax).forEach(function (r, i) {
      var pl = o.plan ? o.plan[i] : null, mid = y + rh / 2;
      if (pl && pl.cost) { g.fillStyle = '#fff1e4'; g.fillRect(L, y, maxW, rh - 4); }
      var right = pl && pl.cost ? r.score + ' → ' + pl.to + ' · 累计 ' + A.dStr(pl.gain, o.C2) : r.score + (r.next ? ' · 到 ' + r.next.t + ' ' + r.next.dStr : ' · 已到顶');
      font(26, true); var rw = g.measureText(right).width;
      g.fillStyle = pl && pl.cost ? '#c2410c' : '#20211d'; g.textAlign = 'right'; g.fillText(right, Rr - 10, mid + 9); g.textAlign = 'left';
      font(26, true); g.fillStyle = '#20211d'; var nm = clip(r.name, maxW - rw - 190), nw = g.measureText(nm).width; g.fillText(nm, L + 10, mid + 9);
      font(20); g.fillStyle = '#85877c'; g.fillText(r.credits + ' 学分 · ' + r.gpStr, L + 18 + nw, mid + 8);
      g.fillStyle = '#ebe7da'; g.fillRect(L, y + rh - 3, maxW, 1);
      y += rh;
    });
    if (o.rows.length > rowsMax) { font(20); g.fillStyle = '#85877c'; g.fillText('…另有 ' + (o.rows.length - rowsMax) + ' 门见 CSV', L, y + 26); y += 34; }
    /* 下半：多考 1 分最值的前 3 门（与页面排名同一组数） */
    if (o.rank.length && H - 150 - y > 190) {
      y += 50; font(24, true); g.fillStyle = '#20211d'; g.fillText('多考 1 分，哪门最值', L, y); y += 14; g.fillRect(L, y, maxW, 2); y += 40;
      o.rank.slice(0, 3).forEach(function (i, k) {
        var r = o.rows[i]; font(24, true); g.fillStyle = '#2d7146'; g.fillText((k + 1) + '', L + 4, y);
        g.fillStyle = '#20211d'; g.fillText(clip(r.name + ' ' + r.score + ' → ' + r.next.t, maxW - 330), L + 40, y);
        font(22); g.fillStyle = '#4f5148'; g.textAlign = 'right'; g.fillText('多考 ' + r.next.d + ' 分 · 累计 ' + r.next.dStr, Rr, y); g.textAlign = 'left';
        y += 46;
      });
    }
    font(21); g.fillStyle = '#85877c';
    g.fillText(clip('换算表以学校教务规定为准；预置换算不代表具体学校；默认数字为虚构示例', maxW), L, H - 92);
    return cv;
  }
  $('dlPng').addEventListener('click', function () { drawCard().toBlob(function (b) { if (b) download('八十九分最亏-累计' + tag() + '-1080x1350.png', b); }, 'image/png'); });

  window.__enUi = { state: function () { return clone(state); }, out: function () { return out; }, importText: importText, drawCard: drawCard, storageKey: KEY };
  fillAll(); update();
})();
