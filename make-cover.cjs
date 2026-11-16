/* 封面 cover.svg（1200×1200），读数来自 core.js 同一次 compute；再用浏览器截成 cover.png。 */
const fs = require('node:fs');
const A = require('./core.js');
const o = A.compute(A.defaultState()), P = o.P;
if (!o.ok || o.cum !== '3.337' || o.points !== 7 || o.planCum !== '3.402') throw new Error('默认场景不对');
const F = "-apple-system,'PingFang SC','Microsoft YaHei',sans-serif";
/* 一把 60–100 的分数尺，细档每档颜色，标出 89 与 90 */
const L = 140, R = 1060, Y = 640, Hh = 90, X = (s) => L + (R - L) * (s - 60) / 41;
const rows = P.scale.rows.slice().reverse();
let bands = '';
rows.forEach((r, i) => { const a = r[0], b = i + 1 < rows.length ? rows[i + 1][0] : 101; bands += `<rect x="${X(a).toFixed(1)}" y="${Y}" width="${(X(b) - X(a) - 3).toFixed(1)}" height="${Hh}" fill="rgba(44,86,135,${(0.12 + 0.68 * r[1] / 400).toFixed(3)})"/><text x="${X(a).toFixed(1)}" y="${Y + Hh + 40}" font-family="${F}" font-size="26" fill="#85877c">${a}</text>`; });
const g89 = A.g2(A.gp(P.scale, 89)), g90 = A.g2(A.gp(P.scale, 90));
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
  <rect width="1200" height="1200" fill="#f3f1ea"/>
  <rect x="70" y="60" width="1060" height="1080" rx="10" fill="#fffdf7" stroke="#d9d5c7" stroke-width="3"/>
  <text x="140" y="220" font-family="${F}" font-size="128" font-weight="800" fill="#20211d">八十九分最亏</text>
  <rect x="140" y="262" width="920" height="5" fill="#20211d"/><rect x="140" y="274" width="920" height="5" fill="#20211d"/>
  <text x="140" y="356" font-family="${F}" font-size="40" fill="#4f5148">期末前，把哪门课多考几分最值</text>
  <text x="140" y="470" font-family="${F}" font-size="46" font-weight="800" fill="#20211d">89 分 = <tspan fill="#2c5687">${g89}</tspan>　　90 分 = <tspan fill="#c2410c">${g90}</tspan></text>
  <text x="140" y="540" font-family="${F}" font-size="32" fill="#4f5148">这份成绩单里，高数多考 1 分，累计绩点就涨 ${o.rows[0].next.dStr.slice(1)}</text>
  ${bands}
  <rect x="${(X(89) + 6).toFixed(1)}" y="${Y - 22}" width="10" height="${Hh + 44}" rx="4" fill="#20211d"/>
  <rect x="${(X(90) + 6).toFixed(1)}" y="${Y - 22}" width="10" height="${Hh + 44}" rx="4" fill="#c2410c"/>
  <text x="140" y="900" font-family="${F}" font-size="38" font-weight="800" fill="#20211d">冲 3.40：最少再多考 <tspan fill="#c2410c">${o.points} 分</tspan>，分在 ${o.planCourses} 门课上</text>
  <text x="140" y="962" font-family="${F}" font-size="30" fill="#4f5148">${o.plan.filter((x) => x.cost).map((x) => A.short(P.courses[x.i].name) + ' ' + x.from + '→' + x.to).join('　')}</text>
  <text x="140" y="1080" font-family="${F}" font-size="24" fill="#85877c">按「细档」换算 · 换算表以学校教务规定为准 · 数字均为虚构示例</text>
</svg>`;
fs.writeFileSync('cover.svg', svg);
console.log('cover.svg', svg.length);
