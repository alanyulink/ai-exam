#!/usr/bin/env python3
"""将 exam6.json 的数据插入到 data.js 的 exams 数组中"""

import json
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_JS = os.path.join(BASE_DIR, "js", "data.js")
EXAM6_JSON = os.path.join(BASE_DIR, "scripts", "exam6.json")


def main():
    # 读取 exam6 数据
    with open(EXAM6_JSON, "r", encoding="utf-8") as f:
        exam6_data = json.load(f)

    # 读取 data.js
    with open(DATA_JS, "r", encoding="utf-8") as f:
        content = f.read()

    # 找到 exams 数组的结尾位置
    # 末尾结构: ...\n      ]\n    }\n  ]\n};
    # 替换成:   ...\n      ]\n    },\n    <exam6>\n  ]\n};

    old_end = "      ]\n    }\n  ]\n};"

    # 生成 exam6 的 JSON 字符串（缩进与 data.js 一致）
    exam6_str = json.dumps(exam6_data, ensure_ascii=False, indent=2)
    # 每行加 4个空格缩进（与 exam5 同级）
    exam6_indented = "\n".join("    " + line if line else "" for line in exam6_str.split("\n"))

    new_end = f"""      ]
    }},
{exam6_indented}
  ]
}};"""

    if old_end not in content:
        print("❌ 未找到 data.js 尾部匹配内容，请检查文件结构")
        return

    new_content = content.replace(old_end, new_end)

    with open(DATA_JS, "w", encoding="utf-8") as f:
        f.write(new_content)

    print("✅ 第6套试卷已成功插入 data.js！")
    print(f"   原文件大小: {len(content)} 字符")
    print(f"   新文件大小: {len(new_content)} 字符")

    # 验证 JSON 正确性
    # 提取 QUESTION_DATA 部分
    try:
        # 简单验证：检查 exams 数组长度
        import re
        exam_ids = re.findall(r'"id":\s*(\d+),?\s*\n\s*"name":\s*"AI考试模拟试卷', new_content)
        print(f"   试卷数量: {len(exam_ids)} 套 (ID: {', '.join(exam_ids)})")
    except Exception as e:
        print(f"   ⚠️ 验证出错: {e}")


if __name__ == "__main__":
    main()
