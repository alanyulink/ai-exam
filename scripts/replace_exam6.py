#!/usr/bin/env python3
"""替换 data.js 中第6套试卷的数据（含解析）"""

import json
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_JS = os.path.join(BASE_DIR, "js", "data.js")
EXAM6_JSON = os.path.join(BASE_DIR, "scripts", "exam6.json")


def main():
    with open(EXAM6_JSON, "r", encoding="utf-8") as f:
        exam6_new = json.load(f)

    with open(DATA_JS, "r", encoding="utf-8") as f:
        lines = f.readlines()

    # 找 exam 6在exams数组中的起始行
    # 特征: 在exams数组内的 "id": 6, (非题库中的)
    # 题库中的id 6在早前位置, exams中的exam 6在接近末尾
    # 更可靠的标记: 行内容包含 "name": "AI考试模拟试卷6"
    start_line = None
    for i, line in enumerate(lines):
        if '"name": "AI考试模拟试卷6"' in line:
            # 向上找到 "id": 6, 所在行
            for j in range(i, max(0, i-5), -1):
                if '"id": 6,' in lines[j]:
                    # 再往上一行是 { 起始行
                    if j > 0 and lines[j-1].strip() == '{':
                        start_line = j - 1
                    else:
                        start_line = j
                    break
            break

    if start_line is None:
        print("❌ 未找到试卷6的起始位置")
        return

    # 找 exams 数组的结束行
    # 从 start_line 往后找
    end_line = None
    for i in range(start_line, len(lines)):
        stripped = lines[i].strip()
        if stripped == "]" and i > len(lines) - 5:  # 倒数几行的 ]
            end_line = i
            break

    if end_line is None:
        print("❌ 未找到 exams 数组结束位置")
        return

    print(f"找到试卷6: 行 {start_line+1} ~ {end_line+1}")

    # 生成新的 exam6 JSON（缩进4格）
    exam6_str = json.dumps(exam6_new, ensure_ascii=False, indent=2)
    exam6_indented = '\n'.join('    ' + line if line else '' for line in exam6_str.split('\n'))

    # 替换内容
    # 保留 end_line 的 ]
    new_lines = lines[:start_line] + [exam6_indented + '\n'] + lines[end_line:]

    with open(DATA_JS, "w", encoding="utf-8") as f:
        f.writelines(new_lines)

    print(f"✅ 替换完成！新大小: {sum(len(l) for l in new_lines)} 字符")

    # 验证
    import re
    content = ''.join(new_lines)
    # 确认 exam6 的题目中有explanation
    # 找到exam 6在exams数组中的数据段
    exam6_start = content.find('"name": "AI考试模拟试卷6"')
    exam6_section = content[exam6_start:exam6_start+50000]  # 取足够长

    q_with_expl = len(re.findall(r'"explanation":', exam6_section))
    q_total = len(re.findall(r'"type":', exam6_section))
    print(f"   试卷6中带解析的题目: {q_with_expl}/{q_total}")


if __name__ == "__main__":
    main()
