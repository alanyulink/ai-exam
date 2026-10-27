#!/usr/bin/env python3
"""解析 AI考试预测卷.md 并生成第6套试卷的 JSON 数据"""

import json
import re
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def extract_explanation(qbody):
    """从题目块中提取解析内容"""
    # 查找 【解析】 或 **【解析】** 后的内容，直到 --- 分隔线或结尾
    m = re.search(r'\*?\*?【解析】\*?\*?\s*(.*?)(?=\n---|\Z)', qbody, re.DOTALL)
    if m:
        expl = m.group(1).strip()
        # 去除末尾的 *本预测卷内容提取自...* 等无关内容
        expl = re.sub(r'\*本预测卷内容.*$', '', expl, flags=re.DOTALL).strip()
        return expl
    return ""


def parse_prediction_paper():
    """解析预测卷中的40道题，提取题目内容、选项、答案和解析"""
    filepath = os.path.join(BASE_DIR, "AI考试预测卷.md")
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    questions = []

    # 按题型区块分割: 单选题 → 多选题 → 判断题
    sections = re.split(r'^## ', content, flags=re.MULTILINE)

    for section in sections:
        if section.startswith("一、单选题"):
            qtype = "single"
        elif section.startswith("二、多选题"):
            qtype = "multi"
        elif section.startswith("三、判断题"):
            qtype = "judge"
        else:
            continue

        # 提取每个题目块
        # 格式: **第N题** 题目内容\n- A. ...\n- B. ...\n**正确答案：** X\n**【解析】** ...
        q_blocks = re.findall(
            r'\*\*第(\d+)题\*\*\s*(.*?)(?=\*\*第\d+题\*\*|\Z)',
            section, re.DOTALL
        )

        for qid_str, qbody in q_blocks:
            qid = int(qid_str)

            if qtype == "judge":
                # 判断题: 先取题目内容，正确答案
                lines = qbody.strip().split('\n')
                question_content = lines[0].strip()
                options = [
                    {"label": "A", "content": "对"},
                    {"label": "B", "content": "错"}
                ]
                # 提取正确答案
                answer_match = re.search(r'\*\*正确答案：\*\*\s*(\w+)', qbody)
                answer = answer_match.group(1).strip() if answer_match else ""
                # 将 对/错 转为 A/B
                if answer == "对":
                    answer = "A"
                elif answer == "错":
                    answer = "B"

            else:
                # 单选题/多选题
                lines = qbody.strip().split('\n')
                question_content = lines[0].strip()

                # 提取选项
                options = []
                for line in lines:
                    m = re.match(r'-\s*([A-D])\.\s*(.+)', line.strip())
                    if m:
                        options.append({"label": m.group(1), "content": m.group(2).strip()})

                # 提取正确答案
                answer_match = re.search(r'\*\*正确答案：\*\*\s*([\w、]+)', qbody)
                if answer_match:
                    answer = answer_match.group(1).strip().replace('、', '')
                else:
                    answer = ""

            explanation = extract_explanation(qbody)

            questions.append({
                "id": qid,
                "type": qtype,
                "content": question_content,
                "options": options,
                "answer": answer,
                "explanation": explanation
            })

    return questions


def build_exam6_json(questions):
    """构建第6套试卷的完整JSON"""
    single_qs = [q for q in questions if q["type"] == "single"]
    multi_qs = [q for q in questions if q["type"] == "multi"]
    judge_qs = [q for q in questions if q["type"] == "judge"]

    # 按预测卷原序排列
    exam_questions = single_qs + multi_qs + judge_qs

    # 重新编号
    for idx, q in enumerate(exam_questions, 1):
        q["id"] = idx

    exam = {
        "id": 6,
        "name": "AI考试模拟试卷6",
        "total_score": 100,
        "per_score": 2.5,
        "pass_score": 60,
        "total_questions": 40,
        "single_count": 20,
        "multi_count": 10,
        "judge_count": 10,
        "time_limit": 3600,
        "questions": exam_questions
    }

    return exam


def main():
    questions = parse_prediction_paper()
    exam = build_exam6_json(questions)

    # 分类统计
    print(f"解析完成！共 {len(questions)} 道题")
    types = {}
    for q in questions:
        types[q["type"]] = types.get(q["type"], 0) + 1
    for t, c in types.items():
        print(f"  {t}: {c} 题")

    # 输出 JSON 字符串（用于粘贴到 data.js）
    json_str = json.dumps(exam, ensure_ascii=False, indent=2)
    print("\n=== 生成的 JSON 数据 ===")
    print(json_str)

    # 输出 JSON 到文件方便后续处理
    out_path = os.path.join(BASE_DIR, "scripts", "exam6.json")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(json_str)
    print(f"\n已保存到: {out_path}")

    # 检查答案完整性
    missing = [q for q in questions if not q["answer"]]
    if missing:
        print(f"\n⚠️ 以下题目缺少答案:")
        for q in missing:
            print(f"  第{q['id']}题 ({q['type']}): {q['content'][:30]}")
    else:
        print(f"\n✅ 所有题目均有答案")


if __name__ == "__main__":
    main()
