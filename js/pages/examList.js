// 模拟考试 - 试卷列表
const ExamListPage = {
  render() {
    const exams = QUESTION_DATA.exams;
    const records = Store.getExamRecords();

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
            const draft = Store.getExamDraft(exam.id);
            const examRecords = records.filter(r => r.examId === exam.id);

            return `
              <div class="exam-card">
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
                ${draft ? `
                  <div class="exam-card-draft">
                    📝 有未完成的考试进度，点击继续答题
                  </div>
                ` : ''}
                <button class="start-exam-btn" onclick="Utils.navigate('exam/${exam.id}')">
                  ${draft ? '📝 继续答题' : '开始考试'}
                </button>

                ${examRecords.length > 0 ? `
                  <div class="exam-records">
                    <div class="exam-records-title">考试记录</div>
                    ${examRecords.map((r, recIdx) => {
                      // 兼容旧格式记录
                      const hasTypeStats = r.singleTotal !== undefined;
                      return ` 
                      <div class="exam-record-item ${r.passed ? 'passed' : 'failed'}">
                        <div class="record-header">
                          <span class="record-date">${new Date(r.timestamp).toLocaleString()}</span>
                          <span class="record-result ${r.passed ? 'passed' : 'failed'}">${r.passed ? '✅ 通过' : '❌ 未通过'}</span>
                        </div>
                        <div class="record-score-row">
                          <span class="record-score">得分：<strong>${r.score}</strong> / ${r.totalScore} 分</span>
                          <span class="record-passline">及格线 ${r.passScore || Math.round(r.totalScore * 0.6)}分</span>
                        </div>
                        ${hasTypeStats ? `
                        <div class="record-stats">
                          <span class="record-stat">单选 <strong class="stat-correct">${r.singleCorrect || 0}</strong>/${r.singleTotal || 0}</span>
                          <span class="record-stat">多选 <strong class="stat-correct">${r.multiCorrect || 0}</strong>/${r.multiTotal || 0}</span>
                          <span class="record-stat">判断 <strong class="stat-correct">${r.judgeCorrect || 0}</strong>/${r.judgeTotal || 0}</span>
                        </div>
                        ` : ''}
                        ${r.wrongDetails && r.wrongDetails.length > 0 ? `
                          <button class="record-review-btn" onclick="ExamListPage.showWrongReview(${exam.id}, ${recIdx})">
                            📖 错题检查（${r.wrongDetails.length}题）
                          </button>
                        ` : hasTypeStats ? `
                          <div class="record-no-wrong">🎉 全部答对，无错题</div>
                        ` : ''}
                      </div>
                    `}).join('')}
                  </div>
                ` : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  },

  showWrongReview(examId, recIdx) {
    const records = Store.getExamRecords();
    // 找到对应该试卷的 records，再取第 recIdx 个
    const examRecords = records.filter(r => r.examId === examId);
    const record = examRecords[recIdx];
    if (!record || !record.wrongDetails || record.wrongDetails.length === 0) return;

    const wrong = record.wrongDetails;
    const questions = QUESTION_DATA.exams.find(e => e.id === examId)?.questions || [];

    let currentWrongIndex = 0;

    const renderModal = () => {
      const w = wrong[currentWrongIndex];
      if (!w) return;

      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.innerHTML = `
        <div class="modal-content">
          <div class="modal-header">
            <span class="question-type-badge">${Utils.typeLabel(w.type)}</span>
            <span class="question-number">错题 ${currentWrongIndex + 1}/${wrong.length}</span>
            <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
          </div>
          <div class="modal-body">
            <div class="question-content">${Utils.escapeHtml(w.content)}</div>
            <div class="options-list">
              ${w.options.map(opt => {
                const isCorrectOpt = w.correctAnswer.includes(opt.label);
                const isUserOpt = w.userAnswer.includes(opt.label);
                let cls = 'option-item';
                if (isCorrectOpt) cls += ' correct';
                if (isUserOpt && !isCorrectOpt) cls += ' wrong';
                return `
                  <div class="${cls}">
                    <span class="option-marker">${opt.label}</span>
                    <span class="option-text">${Utils.escapeHtml(opt.content)}</span>
                    ${isCorrectOpt ? '<span class="option-check">✓</span>' : ''}
                    ${isUserOpt && !isCorrectOpt ? '<span class="option-cross">✗</span>' : ''}
                  </div>
                `;
              }).join('')}
            </div>
            <div class="result-answer-info wrong">
              <span>你的答案：${w.userAnswer || '未作答'}</span>
              <span>正确答案：${w.correctAnswer}</span>
            </div>
            ${w.explanation && !w.explanationHidden ? `
              <div class="explanation-panel correct">
                <div class="explanation-header">📖 知识讲解</div>
                <div class="explanation-body">${Utils.renderText(w.explanation)}</div>
              </div>
            ` : ''}
            <div class="wrong-review-nav">
              <button class="nav-btn" onclick="ExamListPage._navigateWrong(${currentWrongIndex - 1})" ${currentWrongIndex === 0 ? 'disabled' : ''}>← 上一错题</button>
              <button class="nav-btn" onclick="ExamListPage._navigateWrong(${currentWrongIndex + 1})" ${currentWrongIndex >= wrong.length - 1 ? 'disabled' : ''}>下一错题 →</button>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);
      // 更新导航函数
      ExamListPage._currentExamId = examId;
      ExamListPage._currentRecIdx = recIdx;
      ExamListPage._navigateWrong = (idx) => {
        if (idx < 0 || idx >= wrong.length) return;
        document.querySelector('.modal-overlay')?.remove();
        currentWrongIndex = idx;
        renderModal();
      };
    };

    renderModal();
  }
};