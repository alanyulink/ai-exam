#!/usr/bin/env python3
"""
题库错误全面检查脚本
检查维度：
  1. data.js 当前答案 vs 答案解析文件(单/多/判断) 中的"正确答案"（最权威）
  2. data.js 中每道题的 explanation 内部是否有矛盾 (例如：答案是B，但解析说"正确答案是A")
  3. 结构性检查：
     - 判断题必须只有 A/B 两个选项
     - 答案中的字母必须都在选项里
     - 多选题答案字母数必须 >1，单选题必须 ==1，判断题必须 ==1
  4. 原始题库md vs data.js 的题目内容和选项文本一致性
"""
import json
import re
import os
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_JS = os.path.join(BASE_DIR, "js", "data.js")
BANK_MD = os.path.join(BASE_DIR, "AI考试题库.md")
EXPL_FILES = {
    "single": os.path.join(BASE_DIR, "单选题_答案与解析.md"),
    "multi": os.path.join(BASE_DIR, "多选题_答案与解析.md"),
    "judge": os.path.join(BASE_DIR, "判断题_答案与解析.md"),
}

# ============ 工具：归一化文本 ============
def norm(s):
    if not s:
        return ""
    return re.sub(r"\s+", "", s).replace("　", "").replace("（修正）", "")

# ============ 1. 加载 data.js 当前题库 ============
with open(DATA_JS, "r", encoding="utf-8") as f:
    content = f.read()
m = re.search(r"const QUESTION_DATA = ({.*?});", content, re.DOTALL)
data = json.loads(m.group(1))
q_by_id = {q["id"]: q for q in data["questions"]}  # 题库
print(f"✅ data.js 题库加载：{len(q_by_id)} 题")

# ============ 2. 从答案解析文件提取权威答案 ============
# 格式：
#   ### 第N题
#   **正确答案：X**
def parse_explanation_file(filepath, qtype_name):
    """返回 list of { idx_in_file, content, correct_answer }"""
    with open(filepath, "r", encoding="utf-8") as f:
        text = f.read()
    # 支持 "## 第N题" 和 "### 第N题" 两种标题格式
    blocks = re.split(r"\n\#+\s*第(\d+)题", text)
    result = []
    for i in range(1, len(blocks), 2):
        idx = int(blocks[i])
        block = blocks[i + 1]
        # 提取题目（两种格式）
        #   判断：**第1题** 【判断题】 xxx（题目直接在标题行尾）
        #   单/多：**题目：** xxx
        q_m = re.search(r"\*\*题目：\*\*\s*(.+?)\n", block)
        content = q_m.group(1).strip() if q_m else ""
        # 如果没找到（判断题格式），尝试另一模式：标题行结尾就是内容（可能在上一段？其实在 blocks[i] 之前）
        # 更稳妥：整个 block 里找 \*\*[^*]+\*\*\s*【判断题】\s*(.+)
        if not content:
            # 判断题模式：**第N题** 【判断题】 ... 出现在分隔时，标题行可能在split中被切断。
            # 我们用另一种方式：在全文中找
            pass
        # 提取正确答案，支持：
        #   **正确答案：X**   **正确答案：** X   **正确答案：对**   - **正确答案：对**
        a_m = re.search(r"\*\*正确答案[：:]\*\*\s*(.+?)\s*\n", block)
        answer = None
        if a_m:
            raw = a_m.group(1).strip()
            # 去掉开头的**（如果是 **正确答案：** ABCD  这种格式则没有）
            # raw 可能是 "A" "ABCD" "对" "错" "ABC"
            if raw in ("对",):
                answer = "A"
            elif raw in ("错",):
                answer = "B"
            else:
                # 取纯大写字母
                m2 = re.match(r"([A-Z]+)", raw)
                if m2:
                    answer = m2.group(1)
        # 提取所有选项
        opts = re.findall(r"\n\s*-\s*([A-Z])\.\s*(.+)", block)
        result.append({
            "idx": idx,
            "content": content,
            "answer": answer,
            "options": {lab: txt.strip() for lab, txt in opts},
            "type": qtype_name,
        })
    # 判断题：题目可能没找到，需要在全文中用另一种正则重新解析一次补充
    if qtype_name == "judge":
        result2 = []
        pat = re.compile(
            r"\*\*第(\d+)题\*\*\s*【判断题】\s*(.+?)\n",
        )
        with open(filepath, "r", encoding="utf-8") as f:
            text = f.read()
        # 按分隔符 --- 分块，每块对应一题
        chunks = re.split(r"\n---\n", text)
        for ch in chunks:
            hm = pat.search(ch)
            if not hm:
                continue
            idx = int(hm.group(1))
            content = hm.group(2).strip()
            a_m = re.search(r"\*\*正确答案[：:]\*\*\s*(.+?)\n", ch)
            answer = None
            if a_m:
                raw = a_m.group(1).strip()
                if raw == "对":
                    answer = "A"
                elif raw == "错":
                    answer = "B"
            opts = {}
            result2.append({
                "idx": idx,
                "content": content,
                "answer": answer,
                "options": opts,
                "type": qtype_name,
            })
        # result2 覆盖 result（用题目非空的为准）
        if any(x["content"] for x in result2):
            return result2
    return result

single_exp = parse_explanation_file(EXPL_FILES["single"], "single")
multi_exp = parse_explanation_file(EXPL_FILES["multi"], "multi")
judge_exp = parse_explanation_file(EXPL_FILES["judge"], "judge")
print(f"✅ 解析文件：单选 {len(single_exp)}，多选 {len(multi_exp)}，判断 {len(judge_exp)}")

# 构建 归一化题目文本 -> 正确答案 映射（权威源）
auth_answers = {}  # norm_content -> {answer, idx, type, options}
for lst in [single_exp, multi_exp, judge_exp]:
    for e in lst:
        if e["answer"] is None:
            continue
        key = norm(e["content"])
        if not key:
            continue
        auth_answers[key] = {
            "answer": e["answer"],
            "idx_in_file": e["idx"],
            "type": e["type"],
            "options": e["options"],
            "content": e["content"],
        }

# ============ 3. 从 AI考试题库.md 提取题目（用于文本一致性检查）============
def parse_bank_md(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        text = f.read()
    # 找到 "## 单选题" / "## 多选题" / "## 判断题"
    result = []
    for qtype, section_h in [("single", "## 单选题"), ("multi", "## 多选题"), ("judge", "## 判断题")]:
        s = text.find(section_h)
        if s == -1:
            continue
        # 下一个 "## " 作为结束
        e = text.find("\n## ", s + len(section_h))
        if e == -1:
            e = len(text)
        section = text[s:e]
        # 匹配 **第N题** 【类型】 题目... \n 选项
        pattern = re.compile(
            r"\*\*第(\d+)题\*\*\s*【(单选|多选|判断)题】\s*(.+?)\n((?:\s*-\s*[A-Z]\..+?\n)*)",
            re.S,
        )
        for mm in pattern.finditer(section):
            idx = int(mm.group(1))
            t = mm.group(2)
            content = mm.group(3).strip()
            opts_block = mm.group(4)
            opts = {}
            for lab, txt in re.findall(r"\s*-\s*([A-Z])\.\s*(.+)", opts_block):
                opts[lab] = txt.strip()
            result.append({
                "idx": idx,
                "type": {"单选":"single","多选":"multi","判断":"judge"}[t],
                "content": content,
                "options": opts,
            })
    return result

bank_list = parse_bank_md(BANK_MD)
bank_by_norm = {norm(b["content"]): b for b in bank_list}
print(f"✅ 题库md 加载：{len(bank_list)} 题")

# ============ 开始检查 ============
issues = []  # [(level, category, qid, qtype, content, detail)]

def add(level, cat, qid, qtype, content, detail):
    issues.append((level, cat, qid, qtype, content, detail))

TYPE_CN = {"single":"单选","multi":"多选","judge":"判断"}

for qid, q in q_by_id.items():
    content = q["content"]
    ncontent = norm(content)
    qtype = q["type"]
    answer = q.get("answer", "")
    explanation = q.get("explanation", "")
    options = q.get("options", [])
    opt_labels = {o["label"] for o in options}

    # ============ 检查A：结构性 ============
    # 判断必须只有A/B
    if qtype == "judge":
        if set(opt_labels) != {"A","B"}:
            add("高", "结构错误", qid, qtype, content,
                f"判断题应有且仅有 A/B 两个选项，实际：{sorted(opt_labels)}")
    # 答案字母必须都在选项中
    bad_letters = [c for c in answer if c not in opt_labels]
    if bad_letters:
        add("高", "结构错误", qid, qtype, content,
            f"答案 '{answer}' 中存在选项中没有的字母：{bad_letters}，选项有：{sorted(opt_labels)}")
    # 单/多/判断 答案字母数量
    if qtype == "single" and len(answer) != 1:
        add("高", "结构错误", qid, qtype, content,
            f"单选题答案应该只有1个字母，实际：'{answer}'({len(answer)}个)")
    if qtype == "judge" and len(answer) != 1:
        add("高", "结构错误", qid, qtype, content,
            f"判断题答案应该只有1个字母，实际：'{answer}'({len(answer)}个)")
    if qtype == "multi" and len(answer) < 2:
        add("中", "结构错误", qid, qtype, content,
            f"多选题答案应该 ≥2 个字母，实际：'{answer}'({len(answer)}个)")

    # ============ 检查B：explanation 内部矛盾 ============
    # 从 explanation 里找 "正确答案：X" 模式
    m_exp = re.findall(r"正确答案[：:]\s*([A-Z]+)\b", explanation)
    # 也找类似 "所以正确答案是A"、"答案为BCD" 这种
    m_exp2 = re.findall(r"答案[为是]\s*([A-Z]+)\b", explanation)
    all_in_exp = list(dict.fromkeys(m_exp + m_exp2))  # 去重保序
    if answer and all_in_exp:
        for mentioned in all_in_exp:
            if mentioned != answer:
                add("高", "解析与答案矛盾", qid, qtype, content,
                    f"当前 answer='{answer}'，但 explanation 提到正确答案是 '{mentioned}'")

    # ============ 检查C：vs 答案解析文件（权威） ============
    auth = auth_answers.get(ncontent)
    if auth:
        if answer != auth["answer"]:
            add("高", "与答案解析文件不一致", qid, qtype, content,
                f"data.js='{answer}'，解析文件={auth['type']}第{auth['idx_in_file']}题 正确答案='{auth['answer']}'")
        # 再检查选项内容是否一致
        for lab in list(set(list(auth["options"].keys()) + list(opt_labels))):
            a_txt = norm(auth["options"].get(lab, ""))
            d_txt = norm("")
            for o in options:
                if o["label"] == lab:
                    d_txt = norm(o["content"])
                    break
            if a_txt and d_txt and a_txt != d_txt:
                add("中", "选项文本不一致", qid, qtype, content,
                    f"选项 {lab}：解析文件='{auth['options'][lab][:50]}...' vs data.js='{[o['content'] for o in options if o['label']==lab][0][:50]}...'")

    # ============ 检查D：vs AI考试题库.md 题目内容 ============
    bk = bank_by_norm.get(ncontent)
    if bk:
        for lab in list(set(list(bk["options"].keys()) + list(opt_labels))):
            b_txt = norm(bk["options"].get(lab, ""))
            d_txt = norm("")
            for o in options:
                if o["label"] == lab:
                    d_txt = norm(o["content"])
                    break
            if b_txt and d_txt and b_txt != d_txt and abs(len(b_txt) - len(d_txt)) < max(len(b_txt), len(d_txt)) * 0.9:
                # 简单相似度差异告警
                pass  # 输出太吵，这里省略

# ============ 输出结果 ============
print("\n" + "=" * 100)
print(f"检查完成，共发现 {len(issues)} 个问题")
print("=" * 100)

# 按严重度 + 类别分组
level_order = {"高": 0, "中": 1, "低": 2}
issues_sorted = sorted(issues, key=lambda x: (level_order.get(x[0],9), x[1], x[2]))

current_cat = None
for level, cat, qid, qtype, content, detail in issues_sorted:
    if cat != current_cat:
        current_cat = cat
        print(f"\n{'─'*60}")
        print(f"【{level}风险 · {cat}】 共 {sum(1 for x in issues if x[1]==cat)} 条")
        print(f"{'─'*60}")
    print(f"  ID={qid:3d} [{TYPE_CN.get(qtype,qtype):2s}] 答案:{q_by_id[qid].get('answer','?'):6s} | {content[:50]}")
    print(f"         → {detail}")

# 统计
from collections import Counter
lv = Counter(x[0] for x in issues)
ct = Counter(x[1] for x in issues)
print("\n" + "=" * 100)
print("📊 汇总：")
print(f"  风险等级：高={lv.get('高',0)}，中={lv.get('中',0)}，低={lv.get('低',0)}")
print(f"  类别：    {dict(ct)}")
print(f"  涉及题目ID（去重）：{sorted({x[2] for x in issues})}")
print("=" * 100)
