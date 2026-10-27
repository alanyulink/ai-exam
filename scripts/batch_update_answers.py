#!/usr/bin/env python3
"""批量修改题库中两道题的答案，并同步更新所有试卷"""

import json
import re
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_JS = os.path.join(BASE_DIR, "js", "data.js")

with open(DATA_JS, "r", encoding="utf-8") as f:
    content = f.read()

# 定义替换： (content_text, old_answer, new_answer)
replacements = [
    # ID=238: 现代图像检索中常用的查询形式包括哪几种？ AC → ABCD
    ("现代图像检索中常用的查询形式包括哪几种？", "AC", "ABCD"),
    # ID=219: 以下哪些算法可以用于词性标注？ ACD → ABCD
    ("以下哪些算法可以用于词性标注？", "ACD", "ABCD"),
]

for qtext, old_ans, new_ans in replacements:
    count = 0
    # 查找该题目的所有出现位置
    start = 0
    while True:
        pos = content.find(qtext, start)
        if pos == -1:
            break
        # 从该位置往后找 "answer": "old_ans"
        ans_marker = f'"answer": "{old_ans}"'
        ans_pos = content.find(ans_marker, pos)
        if ans_pos != -1:
            # 确认这是在同一个题目块内（在下一个content之前）
            next_content = content.find('"content":', ans_pos)
            if next_content == -1 or next_content > ans_pos + 100:
                # 替换
                old_str = f'"answer": "{old_ans}"'
                new_str = f'"answer": "{new_ans}"'
                content = content[:ans_pos] + new_str + content[ans_pos + len(old_str):]
                count += 1
                start = ans_pos + len(new_str)
            else:
                start = ans_pos + 1
        else:
            # 没找到answer，继续找下一个出现
            start = pos + 1

    print(f'✅ "{qtext[:30]}"')
    print(f'   答案: {old_ans} → {new_ans}, 替换 {count} 处')

# 写入
with open(DATA_JS, "w", encoding="utf-8") as f:
    f.write(content)

# 验证
match = re.search(r'const QUESTION_DATA = ({.*});', content, re.DOTALL)
data = json.loads(match.group(1))

print('\n=== 最终验证 ===')
for qtext, old_ans, new_ans in replacements:
    # 找题库中的题目
    for q in data['questions']:
        if q['content'].replace(' ', '') == qtext.replace(' ', ''):
            pid = q['id']
            assert q['answer'] == new_ans, f'题库ID={pid} 答案应为{new_ans}, 实际为{q["answer"]}'
            print(f'✅ 题库ID={pid}: "{q["content"][:30]}..." 答案: {q["answer"]}')
            break

    # 找试卷中的题目
    for exam in data['exams']:
        for eq in exam['questions']:
            eq_norm = re.sub(r'\s+', '', eq['content'])
            qt_norm = re.sub(r'\s+', '', qtext)
            if eq_norm == qt_norm:
                if eq['answer'] == new_ans:
                    print(f'   ✅ 试卷{exam["id"]} 题号{eq["id"]}: {eq["answer"]}')
                else:
                    print(f'   ❌ 试卷{exam["id"]} 题号{eq["id"]}: {eq["answer"]} (应为{new_ans})')
                    raise AssertionError(f'试卷{exam["id"]} 答案未更新!')

print('\n✅ 全部验证通过！')