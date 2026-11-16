#!/usr/bin/env python3
"""八十九分最亏 · 独立参考实现（不读 core.js）。
- 学分、绩点用 Fraction 精确算；累计绩点截到 3 位小数。
- 「最少多考几分」不假设「只会停在分数线上」：每门课把 s..100 每一个整数分都当候选，
  课程 ≤3 门时直接全枚举，否则用按「多考分数」的精确 DP（最大增益），两种都不用 core.js 的「只看分数线」剪枝。
- 输出 ref.json：300 组随机用例 + 期望读数。"""
import json, random, itertools
from fractions import Fraction as F
from math import floor

SCALES = {
    'five': [(90, F(4)), (80, F(3)), (70, F(2)), (60, F(1))],
    'fine': [(90, F('4.0')), (85, F('3.7')), (82, F('3.3')), (78, F('3.0')), (75, F('2.7')), (72, F('2.3')), (68, F('2.0')), (64, F('1.5')), (60, F('1.0'))],
    'linear': [(s, F(s - 50, 10)) for s in range(100, 59, -1)],
}

def gp(rows, s):
    for t, g in rows:
        if s >= t: return g
    return F(0)

def trunc3(x):
    t = floor(x * 1000)
    return '%d.%03d' % (t // 1000, t % 1000)

def best_plan(rows, courses, need):
    """返回 (最少多考分数, 该分数下最大增益)；无解返回 None。增益单位 = 学分×绩点。"""
    if len(courses) <= 3:
        best = None
        ranges = [range(s, 101) for _, s in courses]
        for combo in itertools.product(*ranges):
            cost = sum(t - s for t, (_, s) in zip(combo, courses))
            gain = sum(c * (gp(rows, t) - gp(rows, s)) for t, (c, s) in zip(combo, courses))
            if gain >= need:
                if best is None or cost < best[0] or (cost == best[0] and gain > best[1]): best = (cost, gain)
        return best
    dp = {0: F(0)}
    for c, s in courses:
        nd = {}
        for p, g in dp.items():
            for t in range(s, 101):
                q = p + t - s; v = g + c * (gp(rows, t) - gp(rows, s))
                if q not in nd or v > nd[q]: nd[q] = v
        dp = nd
    ok = [(p, g) for p, g in dp.items() if g >= need]
    if not ok: return None
    p = min(x[0] for x in ok)
    return (p, max(g for q, g in ok if q == p))

def main():
    rnd = random.Random(20261117)
    out = []
    for i in range(300):
        scale = rnd.choice(['five', 'fine', 'linear'])
        rows = SCALES[scale]
        n = rnd.choice([1, 2, 3, 3, 4, 5]) if i % 3 else rnd.choice([1, 2, 3])
        courses = []
        for _ in range(n):
            c = F(rnd.choice([1, 1, 2, 2, 3, 3, 4, 5, 1, 3]) * 2 + rnd.choice([0, 0, 0, 1]), 2)
            lo = 85 if n >= 4 else rnd.choice([55, 70, 80, 85])
            courses.append((c, rnd.randint(lo, 100)))
        pc = F(rnd.choice([0, 0, 20, 35, 62, 100, 141]), 1) + (F(1, 2) if rnd.random() < .2 else 0)
        pg = F(rnd.randint(150, 400 if scale != 'linear' else 500) if pc else 0, 100)
        if pg > rows[0][1]: pg = rows[0][1]
        semC = sum(c for c, _ in courses); semW = sum(c * gp(rows, s) for c, s in courses)
        C = pc + semC; W = pc * pg + semW
        maxW = W + sum(c * (rows[0][1] - gp(rows, s)) for c, s in courses)
        u = rnd.random()
        if u < .1: tg = None
        elif u < .65: tg = F(rnd.randint(floor(W / C * 100), floor(maxW / C * 100)), 100)  # 落在「现在」与「全 100」之间（含两端）
        else: tg = F(rnd.randint(200, int(rows[0][1] * 100)), 100)
        o = {'sem': trunc3(semW / semC), 'cum': trunc3(W / C), 'max': trunc3(maxW / C)}
        if tg is None: o['status'] = 'none'
        elif W >= tg * C: o['status'] = 'reached'
        else:
            r = best_plan(rows, courses, tg * C - W)
            if r is None: o['status'] = 'impossible'
            else: o['status'] = 'reachable'; o['points'] = r[0]; o['planCum'] = trunc3((W + r[1]) / C)
        st = {'scale': scale, 'custom': '', 'prevCredits': str(float(pc)).rstrip('0').rstrip('.') if pc else '0',
              'prevGpa': '%.2f' % float(pg) if pc else '', 'target': '' if tg is None else '%.2f' % float(tg),
              'courses': [{'name': 'c%d' % j, 'credits': str(float(c)).rstrip('0').rstrip('.'), 'score': str(s)} for j, (c, s) in enumerate(courses)]}
        out.append({'state': st, 'out': o})
    json.dump(out, open(__file__.replace('ref.py', 'ref.json'), 'w'), ensure_ascii=False)
    from collections import Counter
    print('cases', len(out), dict(Counter(x['out']['status'] for x in out)), dict(Counter(x['state']['scale'] for x in out)))

main()
