'use strict';
/* 注入测试：对 core.js 做一处小改动，看核心测试能不能抓到。跑完自动还原。 */
const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const F=path.join(__dirname,'../core.js'),src=fs.readFileSync(F,'utf8');
/* 删掉的等价变异（输出不可能变，记在这里不计数）：upLines 里 r[0]>=s（等分时 r[1]==cur 已被排除）；去掉同绩点去重（下一条线仍取最低、背包多一个被支配选项）；credit 改 String(c2/2)（JS 输出相同，已直接简化源码）。 */
const M=[
["for (var i = 0; i < r.length; i++) if (s >= r[i][0]) return r[i][1];","for (var i = 0; i < r.length; i++) if (s > r[i][0]) return r[i][1];"],
["if (r[0] > s && r[1] > cur &&","if (r[0] > s && r[1] >= cur &&"],
["return s > 0 ? gp(scale, s) - gp(scale, s - 1) : 0;","return s > 0 ? gp(scale, s) - gp(scale, s - 2) : 0;"],
["var t = Math.floor(W * 10 / C2);","var t = Math.round(W * 10 / C2);"],
["var t = Math.round(num * 10 / C2);","var t = Math.floor(num * 10 / C2);"],
["gain: c.c2 * (u.g - base[c.idx])","gain: (u.g - base[c.idx])"],
["if (v > nx[p]) { nx[p] = v; pick[p] = j; }","if (v >= nx[p] && nx[p] === NEG) { nx[p] = v; pick[p] = j; }"],
["if (cur[q] !== NEG && cur[q] >= need) { bestP = q; break; }","if (cur[q] !== NEG && cur[q] > need) { bestP = q; break; }"],
["var C2 = P.pC2 + semC2, W = P.pC2 * P.pG + semW;","var C2 = semC2, W = semW;"],
["var C2 = P.pC2 + semC2, W = P.pC2 * P.pG + semW;","var C2 = P.pC2 + semC2, W = P.pG + semW;"],
["if (need <= 0) { o.status = 'reached';","if (need < 0) { o.status = 'reached';"],
["o.maxTarget = Math.floor(o.maxW / C2);","o.maxTarget = Math.round(o.maxW / C2);"],
["return a + c.c2 * (gp(P.scale, 100) - base[i]);","return a + c.c2 * (P.scale.rows[0][1] - base[i]) * 0 + c.c2 * (gp(P.scale, 99) - base[i]);"],
["b.r.next.num * a.r.next.d - a.r.next.num * b.r.next.d","b.r.next.num - a.r.next.num"],
["if (!(c2 >= 5 && c2 <= MAX_CREDIT * 10 && c2 % 5 === 0))","if (!(c2 >= 0 && c2 <= MAX_CREDIT * 10 && c2 % 5 === 0))"],
["if (!(c2 >= 5 && c2 <= MAX_CREDIT * 10 && c2 % 5 === 0))","if (!(c2 >= 5 && c2 <= MAX_CREDIT * 10))"],
["if (!(sc >= 0 && sc <= 100))","if (!(sc >= 0 && sc <= 101))"],
["if (pC2 === 0 && blank(st.prevGpa)) pG = 0;","if (blank(st.prevGpa)) pG = 0;"],
["else if (scale && pG > top)","else if (scale && pG > top + 10)"],
["else if (scale && tg > top)","else if (false)"],
["if (cs.length > MAX_COURSES) err","if (cs.length > MAX_COURSES + 1) err"],
["if (f.length > d) { if (/^0*$/.test(f.slice(d))) f = f.slice(0, d); else return NaN; }","if (f.length > d) f = f.slice(0, d);"],
["if (seen[rows[i][0]]) {","if (false) {"],
["if (i && rows[i][1] > rows[i - 1][1]) {","if (i && rows[i][1] > rows[i - 1][1] + 100) {"],
["if (!(s >= 0 && s <= 100) || !(g >= 0 && g <= 500))","if (!(s >= 0 && s <= 100) || !(g >= 0))"],
[".replace(/[；、]/g, ',')",""],
["/^[=+\\-@]/.test(s)","false"],
["return String(s).replace(/\\|/g, '\\\\|')","return String(s)"],
["function short(n) { n = String(n); return n.length > 8 ?","function short(n) { n = String(n); return n.length >= 8 ?"],
["if (o.status === 'impossible') acts.push","if (false) acts.push"],
["if (o.status !== 'reachable' && o.rank.length)","if (o.rank.length)"],
["o.planCourses = o.plan.filter(function (x) { return x.cost > 0; }).length;","o.planCourses = o.plan.length;"],
["return { feasible: false, maxGain: maxGain, maxCost: B };","return { feasible: true, points: 0, gain: 0, plan: [], maxGain: maxGain, maxCost: B };"],
["return r.next && r.next.d <= 2 ? i : -1;","return r.next && r.next.d <= 3 ? i : -1;"],
];
let caught=0,missed=[],nomatch=[],same=[];
try{
M.forEach(([a,b],i)=>{
  if(src.indexOf(a)<0){nomatch.push(i);return;}
  if(a===b){same.push(i);return;}
  fs.writeFileSync(F,src.replace(a,b));
  let fail=false;try{execFileSync(process.execPath,['--test',path.join(__dirname,'core.test.cjs')],{stdio:'pipe',timeout:180000});}catch(e){fail=true;}
  if(fail)caught++;else missed.push(i+': '+b.slice(0,90));
});
}finally{fs.writeFileSync(F,src);}
const n=M.length-same.length-nomatch.length;
console.log('注入 '+n+' 处，抓到 '+caught+'，漏 '+missed.length+(nomatch.length?'，未匹配 '+nomatch.join(','):'')+(same.length?'，（空改动跳过 '+same.join(',')+'）':''));
missed.forEach(m=>console.log('  漏：'+m));
