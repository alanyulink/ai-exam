#!/usr/bin/env python3
"""将 questions.json 转换为 JS 文件，方便前端直接引用"""
import json
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
json_path = os.path.join(BASE_DIR, "src", "data", "questions.json")
js_path = os.path.join(BASE_DIR, "js", "data.js")

with open(json_path, "r", encoding="utf-8") as f:
    data = json.load(f)

with open(js_path, "w", encoding="utf-8") as f:
    f.write("// 自动生成 - 题库数据\n")
    f.write("const QUESTION_DATA = ")
    json.dump(data, f, ensure_ascii=False, indent=2)
    f.write(";\n")

print(f"数据已写入 {js_path}")
print(f"题库: {len(data['questions'])} 题, 试卷: {len(data['exams'])} 套")