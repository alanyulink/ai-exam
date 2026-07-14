// 模拟考试 - 试卷列表
const ExamListPage = {
  render() {
    const exams = QUESTION_DATA.exams;
    return `
      <div class="page exam-list-page">
        <header class="page-header">
          <button class="back-btn" onclick="Utils.navigate('')">← 返回</button>
          <h1>模拟考试</h1>
        </header>

        <div class="exam-list-intro">
          <p>共 ${exams.length} 套模拟试卷，每套限时 60 分钟</p>
        </div>

        <div class="exam-cards">
          ${exams.map(exam => {
            const records = Store.getExamRecords();
            const lastRecord = records.find(r => r.examId === exam.id);
            return `
              <div class="exam-card" onclick="Utils.navigate('exam/${exam.id}')">
                <div class="exam-card-top">
                  <span class="exam-card-number">试卷 ${exam.id}</span>
                  <span class="exam-card-score">${exam.total_score}分</span>
                </div>
                <div class="exam-card-info">
                  <span>📝 ${exam.single_count}单选 · ${exam.multi_count}多选 · ${exam.judge_count}判断</span>
                  <span>⏱ ${exam.total_questions}题 / ${exam.time_limit / 60}分钟</span>
                </div>
                <div class="exam-card-pass">
                  及格线：${exam.pass_score}分
                </div>
                ${lastRecord ? `
                  <div class="exam-card-last ${lastRecord.score >= exam.pass_score ? 'passed' : 'failed'}">
                    上次成绩：${lastRecord.score}分
                  </div>
                ` : ''}
                <button class="start-exam-btn">开始考试</button>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }
};