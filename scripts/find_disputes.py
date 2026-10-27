#!/usr/bin/env python3
"""
全库争议题目扫描
交叉比对四个独立来源的答案/文本：
  S1: data.js 题库 questions        (线上实际数据: answer + explanation)
  S2: 解析文件 单选题/多选题/判断题  (含“正确答案”字段 + 知识讲解正文)
  S3: 题库内 explanation 中声明的答案 (内部矛盾检测)
  S4: data.js exams 6套试卷中同题干题的答案 (试卷是否与题库同步)
额外: 多选题知识讲解正文若明确否定某选项、但答案仍包含它 => 疑似争议
"""
import json, re, os, sys
from difflib import SequenceMatcher

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_JS = os.path.join(BASE, "js", "data.js")
EXPL = {
    "single": os.path.join(BASE, "单选题_答案与解析.md"),
    "multi":  os.path.join(BASE, "多选题_答案与解析.md"),
    "judge":  os.path.join(BASE, "判断题_答案与解析.md"),
}
TYPE_CN = {"single": "单选", "multi": "多选", "judge": "判断"}

def norm(s):
    if not s:
        return ""
    return re.sub(r"\s+", "", s).replace("　", "").replace("（修正）", "").replace("(修正)", "")

# ---------------- 1. 加载 data.js ----------------
raw = open(DATA_JS, encoding="utf-8").read()
data = json.loads(re.search(r"const QUESTION_DATA = ({.*?});", raw, re.DOTALL).group(1))
bank = data["questions"]          # S1
exams = data["exams"]             # S4

# ---------------- 2. 解析解析文件 ----------------
def parse_single_multi(fp):
    """单选/多选: ### 第N题 / ## 第N题  +  **题目：** + - A. + **正确答案：X** + 【知识讲解】"""
    text = open(fp, encoding="utf-8").read()
    out = []
    blocks = re.split(r"\n\#+\s*第(\d+)题", text)
    for i in range(1, len(blocks), 2):
        idx = int(blocks[i])
        block = blocks[i + 1]
        qm = re.search(r"\*\*题目：\*\*\s*(.+?)\n", block)
        if not qm:
            continue
        opts = {lab: t.strip() for lab, t in re.findall(r"\n\s*-\s*([A-Z])\.\s*(.+)", block)}
        # 兼容两种格式：**正确答案：X**（同一处加粗）与 **正确答案：** X（加粗闭合在冒号后）
        am = re.search(r"\*\*正确答案[：:]\*{0,2}\s*([A-H]+)", block)
        ans = am.group(1) if am else None
        bm = re.search(r"\*\*【知识讲解】\*\*(.*)$", block, re.S)
        body = bm.group(1) if bm else ""
        # 解析正文可能包含到下一题之前，但因为 split 已截断，body 即该题剩余
        out.append({"idx": idx, "content": qm.group(1).strip(), "options": opts,
                    "answer": ans, "body": body})
    return out

def parse_judge(fp):
    """判断: **第N题** 【判断题】 题干\n- **正确答案：对/错**\n- **【知识讲解】** ... (以 --- 分块)"""
    text = open(fp, encoding="utf-8").read()
    out = []
    for ch in re.split(r"\n---\n", text):
        hm = re.search(r"\*\*第(\d+)题\*\*\s*【判断题】\s*(.+?)\n", ch)
        if not hm:
            continue
        am = re.search(r"\*\*正确答案[：:]\s*(对|错)", ch)
        ans = None
        if am:
            ans = "A" if am.group(1) == "对" else "B"
        bm = re.search(r"- \*\*【知识讲解】\*\*\s*\n?(.*)$", ch, re.S)
        body = bm.group(1) if bm else ""
        out.append({"idx": int(hm.group(1)), "content": hm.group(2).strip(),
                    "options": {"A": "对", "B": "错"}, "answer": ans, "body": body})
    return out

exp = {}
for t, fp in EXPL.items():
    exp[t] = parse_single_multi(fp) if t != "judge" else parse_judge(fp)
    print(f"解析文件 {t}: {len(exp[t])} 题")

# 建立 题干norm -> 解析条目
exp_by_norm = {}
for t, lst in exp.items():
    for e in lst:
        exp_by_norm.setdefault(norm(e["content"]), []).append((t, e))

# ---------------- 3. 题库索引 ----------------
bank_by_norm = {}
dup = []
for q in bank:
    k = norm(q["content"])
    if k in bank_by_norm:
        dup.append((k, q["id"], bank_by_norm[k]["id"]))
    bank_by_norm.setdefault(k, []).append(q)

def find_in_bank(text):
    k = norm(text)
    if k in bank_by_norm:
        return [q for q in bank_by_norm[k]], "exact"
    # 模糊
    best, bestr = None, 0.0
    for kk, qs in bank_by_norm.items():
        r = SequenceMatcher(None, k, kk).ratio()
        if r > bestr:
            bestr, best = r, qs[0]
    if bestr >= 0.93:
        return [best], f"fuzzy{bestr:.2f}"
    return None, ""

# ---------------- 4. 扫描 ----------------
report = []   # (level, cat, qid, qtype, content, detail, source_explain)

def add(level, cat, q, detail, src):
    report.append((level, cat, q["id"], q["type"], q["content"], detail, src))

def evidence(body):
    """从解析正文中抽取结论/论证句作为“解析文件答案字段”的支持证据"""
    if not body:
        return ""
    body = re.sub(r"^\s*\d+\.\s*\*\*", "", body, flags=re.M)
    sents = [s.strip().replace("\n", "") for s in re.split(r"(?<=[。！？!?])\s*|\n{1,}", body) if s.strip()]
    picks = []
    for s in sents:
        if len(s) < 6:
            continue
        if re.search(r"(因此|所以|综上|综上所述|故选|因此选|正确答案|因此正确|说法错误|说法正确|故此|可见|即答案|答案为)", s):
            picks.append(s)
        if len(picks) >= 2:
            break
    if not picks:
        picks = [s for s in sents if len(s) > 10][-2:]
    return "；".join(picks)[:220]

RE_ANS = re.compile(r"正确答案\s*[为是]?\s*[:：]?\s*([A-H]+)")
RE_ANS2 = re.compile(r"(?:答案|正确选项|应选|选择|选)\s*[为是]\s*[:：]?\s*([A-H]+)")
RE_NEG = re.compile(
    r"选项\s*([A-D])\s*[（(]?[^）)\n，。]{0,18}[）)]?[^。\n]{0,14}"
    r"(不准确|不正确|不是|不属于|不能|不用于|不适用|不常用|一般不|并非|非|错误|排除|无(法|需|效)|不构成|不是独立|不适合|不选)")

neg_hit, no_expl, total_dis = 0, 0, 0

for q in bank:
    k = norm(q["content"])
    qtype, ans = q["type"], q.get("answer", "")
    expl = q.get("explanation", "")
    opt_labs = {o["label"] for o in q.get("options", [])}

    # ---- E1: 题库 answer vs 解析文件答案字段 ----
    hit = exp_by_norm.get(k)
    matched_exp = False
    if hit:
        matched_exp = True
        for t, e in hit:
            if e["answer"] and e["answer"] != ans:
                total_dis += 1
                ev = evidence(e["body"])
                add("高", "①题库与解析文件答案不一致", q,
                    f"data.js答案='{ans}'，但{TYPE_CN[t]}解析文件第{e['idx']}题 正确答案='{e['answer']}'"
                    + (f"\n         [解析证据] {ev}" if ev else ""), "S1 vs S2")
    else:
        no_expl += 1

    # ---- E2: explanation 内部声明的答案与 answer 字段矛盾 ----
    if expl:
        mentions = []
        for m in RE_ANS.findall(expl) + RE_ANS2.findall(expl):
            for mm in re.findall(r"[A-H]", m):
                mentions.append(mm)
        mentions = list(dict.fromkeys(mentions))
        diff = [x for x in mentions if x not in ans]
        if ans and diff:
            total_dis += 1
            add("高", "②题库内 解析(explanation)与答案矛盾", q,
                f"answer='{ans}'，但explanation中提到答案含 '{''.join(diff)}'", "S1 vs S3")

    # ---- E3: 多选题正文否定选项，但答案仍含它（疑似） ----
    if qtype == "multi" and matched_exp:
        for t, e in hit:
            for mm in RE_NEG.finditer(e["body"]):
                lab = mm.group(1)
                if lab in ans:
                    neg_hit += 1
                    add("中", "③多选题解析正文否定该选项却仍在答案中(疑似)", q,
                        f"answer='{ans}' 含 {lab}，但解析正文称“{mm.group(0)[:60]}”", "S2正文 vs S1")

# ---- E4: 试卷 vs 题库 答案不同步 ----
exam_sync_issues = 0
for ex in exams:
    ename = ex.get("title") or ex.get("name") or ex.get("id")
    for eq in ex.get("questions", []):
        found, how = find_in_bank(eq["content"])
        if not found:
            continue
        for bq in found:
            if eq.get("answer") and bq.get("answer") and eq["answer"] != bq["answer"]:
                exam_sync_issues += 1
                total_dis += 1
                add("高", "④试卷与题库答案不同步", bq,
                    f"试卷『{ename}』中该题答案='{eq['answer']}'，但题库答案='{bq['answer']}'（匹配:{how}）", "S1 vs S4")

# ---------------- 5. 输出 ----------------
print("=" * 100)
print(f"全库扫描完成: 题库 {len(bank)} 题 | 解析文件覆盖 {len(bank)-no_expl} 题 | 未覆盖 {no_expl} 题")
print(f"争议总数 {total_dis}（含正文疑似 {neg_hit}，试卷不同步 {exam_sync_issues}）")
if dup:
    print(f"⚠ 题库存在归一化后重复题干 {len(dup)} 组")
print("=" * 100)

order = {"高": 0, "中": 1}
report.sort(key=lambda x: (order.get(x[0], 9), x[1], x[2]))
cur = None
for level, cat, qid, qtype, content, detail, src in report:
    if cat != cur:
        cur = cat
        n = sum(1 for x in report if x[1] == cat)
        print(f"\n【{cat}】({n}条)  {'─'*60}")
    print(f"  ID={qid} [{TYPE_CN.get(qtype, qtype)}] 答案:{dict((q['id'], q.get('answer','')) for q in bank).get(qid,'?')}")
    print(f"      题: {content[:60]}")
    print(f"      →  {detail}")

print("\n未覆盖(无解析文件)题:")
for q in bank:
    if norm(q["content"]) not in exp_by_norm:
        print(f"  ID={q['id']} [{TYPE_CN.get(q['type'], q['type'])}] {q['content'][:60]}  (答案 {q.get('answer','')})")
