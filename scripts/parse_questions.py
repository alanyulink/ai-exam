#!/usr/bin/env python3
"""解析 AI 考试题库 Markdown 文件为结构化 JSON"""

import json
import re
import os
import random

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def parse_question_bank():
    """解析 AI考试题库.md 中的 296 道题目"""
    questions = []
    filepath = os.path.join(BASE_DIR, "AI考试题库.md")
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    sections = re.split(r'^## ', content, flags=re.MULTILINE)

    for section in sections:
        if section.startswith("单选题"):
            qtype = "single"
        elif section.startswith("多选题"):
            qtype = "multi"
        elif section.startswith("判断题"):
            qtype = "judge"
        else:
            continue

        q_blocks = re.findall(
            r'\*\*第(\d+)题\*\*\s*【[^】]*】\s*(.*?)(?=\*\*第\d+题\*\*|\Z)',
            section, re.DOTALL
        )

        for qid_str, qbody in q_blocks:
            qid = int(qid_str)
            lines = qbody.strip().split('\n')
            question_content = lines[0].strip()

            if qtype == "judge":
                options = [
                    {"label": "A", "content": "对"},
                    {"label": "B", "content": "错"}
                ]
            else:
                options = []
                for line in lines[1:]:
                    m = re.match(r'-\s*([A-D])\.(.+)', line.strip())
                    if m:
                        options.append({"label": m.group(1), "content": m.group(2).strip()})

            questions.append({
                "id": qid,
                "type": qtype,
                "content": question_content,
                "options": options,
                "answer": "",
                "explanation": ""
            })

    return questions


def parse_answer_files(questions):
    """从答案与解析文件合并答案"""
    type_map = {
        "单选题_答案与解析.md": "single",
        "多选题_答案与解析.md": "multi",
        "判断题_答案与解析.md": "judge"
    }

    # 通用的答案提取
    def extract_answer(text):
        # 格式1: **正确答案：** ABCD（**后跟空格/直接跟答案）
        m = re.search(r'\*\*正确答案：\*\*\s*(.*?)(?:\*\*|\n|$)', text)
        if m and m.group(1).strip():
            return m.group(1).strip()
        # 格式2: **正确答案：A**（整个加粗）
        m = re.search(r'\*\*正确答案：\s*(.*?)\*\*', text)
        if m:
            ans = m.group(1).strip()
            if ans.endswith('**'):
                ans = ans[:-2]
            return ans.strip()
        return ""

    # 通用的解析提取
    def extract_explanation(text):
        for pattern in [
            r'\*\*【知识讲解】\*\*(.*?)(?=\n---|\Z)',
            r'\*\*【知识讲解】\*\*(.*?)(?=\n##|\Z)',
            r'\*\*【知识讲解】\*\*(.*?)(?=\n\*\*第|\Z)',
            r'\*\*【解析】\*\*(.*?)(?=\n---|\Z)',
            r'\*\*【解析】\*\*(.*?)(?=\n##|\Z)',
            r'- \*\*【知识讲解】\*\*(.*?)(?=\n---|\Z)',
            r'- \*\*【知识讲解】\*\*(.*?)(?=\n\*\*第|\Z)',
        ]:
            m = re.search(pattern, text, re.DOTALL)
            if m:
                return m.group(1).strip()
        return ""

    for fname, qtype in type_map.items():
        fpath = os.path.join(BASE_DIR, fname)
        if not os.path.exists(fpath):
            continue
        with open(fpath, "r", encoding="utf-8") as f:
            atext = f.read()

        if qtype == "judge":
            # 判断题格式：**第N题** 【判断题】 ...
            blocks = re.split(r'\*\*第(\d+)题\*\*', atext)[1:]
        else:
            # 单选题/多选题格式：### 第N题 或 ## 第N题
            # 排除 ## 第1-50题 这种范围标题
            blocks = re.split(r'#{2,3} 第(\d+)题(?!-)', atext)[1:]

        for i in range(0, len(blocks), 2):
            if i + 1 >= len(blocks):
                break
            aid = int(blocks[i])
            block_content = blocks[i + 1]

            answer = extract_answer(block_content)
            explanation = extract_explanation(block_content)

            for q in questions:
                if q["id"] == aid and q["type"] == qtype:
                    if answer:
                        q["answer"] = answer
                    if explanation:
                        q["explanation"] = explanation
                    break


def add_extra_questions(questions):
    """补充题库中缺少的题目"""
    extra = [
        # 新单选题 1道 - 加入试卷5
        {
            "type": "single",
            "content": "在深度学习中，批归一化（Batch Normalization）的主要作用是什么？",
            "options": [
                {"label": "A", "content": "加速模型收敛"},
                {"label": "B", "content": "增加模型参数量"},
                {"label": "C", "content": "降低模型复杂度"},
                {"label": "D", "content": "减少训练数据需求"}
            ],
            "answer": "A",
            "explanation": "批归一化（Batch Normalization）通过对每一层输入进行归一化处理，使其均值为0、方差为1，可以有效缓解内部协变量偏移（Internal Covariate Shift）问题。这使得网络可以使用更大的学习率，减少对初始化参数的敏感度，同时具有轻微的正则化效果，从而显著加速模型收敛过程。"
        },
        # 新多选题 3道 - 分别加入试卷1、2、4
        {
            "type": "multi",
            "content": "以下哪些是Transformer模型中使用的核心组件？",
            "options": [
                {"label": "A", "content": "自注意力机制 (Self-Attention)"},
                {"label": "B", "content": "多头注意力 (Multi-Head Attention)"},
                {"label": "C", "content": "循环结构 (Recurrent Structure)"},
                {"label": "D", "content": "位置编码 (Positional Encoding)"}
            ],
            "answer": "ABD",
            "explanation": "Transformer模型的核心组件包括自注意力机制（Self-Attention）、多头注意力（Multi-Head Attention）和位置编码（Positional Encoding）。自注意力机制允许模型在处理每个位置时关注序列中的所有位置；多头注意力通过多个注意力头捕捉不同子空间的特征；位置编码为模型提供序列中token的位置信息。Transformer完全基于注意力机制，不使用循环结构（RNN），因此C选项不正确。"
        },
        {
            "type": "multi",
            "content": "以下哪些属于无监督学习算法？",
            "options": [
                {"label": "A", "content": "K均值聚类 (K-Means)"},
                {"label": "B", "content": "主成分分析 (PCA)"},
                {"label": "C", "content": "线性回归 (Linear Regression)"},
                {"label": "D", "content": "自编码器 (Autoencoder)"}
            ],
            "answer": "ABD",
            "explanation": "无监督学习是在没有标注数据的情况下从数据中发现模式的学习方法。K均值聚类（K-Means）是无监督聚类算法；主成分分析（PCA）是无监督降维方法；自编码器（Autoencoder）可以通过无监督方式进行特征学习。线性回归（Linear Regression）是有监督学习算法，需要标注的目标值进行训练，因此C选项不正确。"
        },
        {
            "type": "multi",
            "content": "以下哪些是卷积神经网络（CNN）的组成部分？",
            "options": [
                {"label": "A", "content": "卷积层 (Convolutional Layer)"},
                {"label": "B", "content": "池化层 (Pooling Layer)"},
                {"label": "C", "content": "全连接层 (Fully Connected Layer)"},
                {"label": "D", "content": "循环层 (Recurrent Layer)"}
            ],
            "answer": "ABC",
            "explanation": "卷积神经网络（CNN）的核心组成部分包括卷积层（用于提取局部特征）、池化层（用于降维和特征选择）和全连接层（用于整合特征并输出结果）。循环层（Recurrent Layer）是循环神经网络（RNN）的组成部分，用于处理序列数据，不属于CNN的典型结构，因此D选项不正确。"
        }
    ]

    for q in extra:
        questions.append(q)

    return questions


def generate_exam_papers(questions):
    """从题库重新生成5套试卷，每道题在试卷中只出现1次，且必须出现1次"""
    random.seed(42)  # 固定种子，保证每次生成结果一致

    # 按题型分组
    by_type = {"single": [], "multi": [], "judge": []}
    for q in questions:
        by_type[q["type"]].append(q)

    # 每类题型在各试卷的分配
    # 200 single: 40,40,40,40,40
    # 50 multi:  10,10,10,10,10
    # 50 judge:  10,10,10,10,10
    # 各卷总计:  60,60,60,60,60 = 300
    dist = {
        "single": [40, 40, 40, 40, 40],
        "multi":  [10, 10, 10, 10, 10],
        "judge":  [10, 10, 10, 10, 10]
    }

    # 打乱每个类型的题目顺序
    for t in by_type:
        random.shuffle(by_type[t])

    # 分配题目到各试卷
    exams = []
    for i in range(5):
        exam_questions = []
        pos = {"single": 0, "multi": 0, "judge": 0}
        # 计算每个类型的起始位置
        for t in by_type:
            start = sum(dist[t][:i])
            count = dist[t][i]
            for j in range(count):
                q = by_type[t][start + j]
                exam_questions.append({
                    "id": j + 1,  # 试卷内编号
                    "type": q["type"],
                    "content": q["content"],
                    "options": q["options"],
                    "answer": q["answer"],
                    "explanation": q["explanation"]
                })

        # 按题型顺序排列：单选 → 多选 → 判断
        # 每个题型内部打乱顺序
        single_qs = [q for q in exam_questions if q["type"] == "single"]
        multi_qs = [q for q in exam_questions if q["type"] == "multi"]
        judge_qs = [q for q in exam_questions if q["type"] == "judge"]
        random.shuffle(single_qs)
        random.shuffle(multi_qs)
        random.shuffle(judge_qs)
        exam_questions = single_qs + multi_qs + judge_qs

        # 重新编号
        for idx, q in enumerate(exam_questions, 1):
            q["id"] = idx

        # 统计各题型
        single_c = sum(1 for q in exam_questions if q["type"] == "single")
        multi_c = sum(1 for q in exam_questions if q["type"] == "multi")
        judge_c = sum(1 for q in exam_questions if q["type"] == "judge")
        total_q = len(exam_questions)
        per_score = 2
        total_score = total_q * per_score
        pass_score = int(total_score * 0.6)

        exams.append({
            "id": i + 1,
            "name": f"AI考试模拟试卷{i + 1}",
            "total_score": total_score,
            "per_score": per_score,
            "pass_score": pass_score,
            "total_questions": total_q,
            "single_count": single_c,
            "multi_count": multi_c,
            "judge_count": judge_c,
            "time_limit": 3600,
            "questions": exam_questions
        })

    return exams


def normalize_judge_answers(questions):
    """将判断题答案从文字（对/错）转为选项标签（A/B）"""
    for q in questions:
        if q["type"] != "judge":
            continue
        answer = q["answer"].strip()
        if answer == "对" or answer == "正确" or answer == "A":
            q["answer"] = "A"
        elif answer == "错" or answer == "错误" or answer == "B":
            q["answer"] = "B"
        # 同样处理选项中的内容
        for opt in q["options"]:
            if opt["label"] == "A":
                opt["content"] = "对"
            elif opt["label"] == "B":
                opt["content"] = "错"
    return questions


def main():
    questions = parse_question_bank()
    parse_answer_files(questions)
    normalize_judge_answers(questions)
    add_extra_questions(questions)
    exams = generate_exam_papers(questions)

    # 重新编号题库中的题目
    for idx, q in enumerate(questions, 1):
        q["id"] = idx

    output = {
        "questions": questions,
        "exams": exams
    }

    out_dir = os.path.join(BASE_DIR, "src", "data")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "questions.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"解析完成！题库：{len(questions)} 道，试卷：{len(exams)} 套")
    types = {}
    for q in questions:
        types[q["type"]] = types.get(q["type"], 0) + 1
    for t, c in types.items():
        print(f"  题库 {t}: {c} 题")
    for e in exams:
        print(f"  试卷{e['id']}: {len(e['questions'])} 题，限时 {e['time_limit']//60} 分钟")


if __name__ == "__main__":
    main()