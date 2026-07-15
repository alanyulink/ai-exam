// 考试成绩
const ExamResultPage = {
  render(examId) {
    const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
    let state = null;
    try {
      state = JSON.parse(decodeURIComponent(params.get('state') || ''));
    } catch { /* ignore */ }

    if (!state) {
      return `<div class="page"><div class="empty-state">成绩数据不存在</div></div>`;
    }

    const accuracy = state.total > 0 ? Math.round((state.correct / state.total) * 100) : 0;
    const timeStr = Utils.formatTime(state.timeSpent);

    return `
      <div class="page result-page">
        <header class="page-header">
          <button class="back-btn" onclick="Utils.navigate('exam')">← 返回</button>
          <h1>${state.passed ? '🎉 恭喜通过！' : '😅 再接再厉'}</h1>
        </header>

        <div class="result-hero">
          <div class="result-ring ${state.passed ? 'passed' : 'failed'}">
            <svg viewBox="0 0 120 120" class="ring-svg">
              <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="8"/>
              <circle cx="60" cy="60" r="54" fill="none" stroke="currentColor" stroke-width="8"
                stroke-dasharray="${accuracy * 3.39} 339" stroke-dashoffset="0" transform="rotate(-90 60 60)"
                stroke-linecap="round"/>
            </svg>
            <div class="result-score">
              <span class="result-score-num">${state.score}</span>
              <span class="result-score-total">/${state.totalScore}</span>
            </div>
          </div>
          <div class="result-stats">
            <div class="result-stat-item">
              <span class="result-stat-num">${state.correct}</span>
              <span class="result-stat-label">正确</span>
            </div>
            <div class="result-stat-divider"></div>
            <div class="result-stat-item">
              <span class="result-stat-num">${state.total - state.correct}</span>
              <span class="result-stat-label">错误</span>
            </div>
            <div class="result-stat-divider"></div>
            <div class="result-stat-item">
              <span class="result-stat-num">${accuracy}%</span>
              <span class="result-stat-label">正确率</span>
            </div>
            <div class="result-stat-divider"></div>
            <div class="result-stat-item">
              <span class="result-stat-num">${timeStr}</span>
              <span class="result-stat-label">用时</span>
            </div>
          </div>
        </div>

        <div class="result-detail">
          <div class="result-detail-item">
            <span class="detail-label">单选题</span>
            <span class="detail-value">${state.details.filter(d => state.examId ? true : true).length}题</span>
          </div>
          <div class="result-detail-item">
            <span class="detail-label">得分</span>
            <span class="detail-value ${state.passed ? 'text-green' : 'text-red'}">${state.score}分</span>
          </div>
          <div class="result-detail-item">
            <span class="detail-label">及格线</span>
            <span class="detail-value">${state.passScore}分</span>
          </div>
        </div>

        <div class="section">
          <h2 class="section-title">逐题回顾</h2>
          <div class="result-questions">
            ${state.details.map((d, i) => {
              const exam = QUESTION_DATA.exams.find(e => e.id === state.examId);
              const q = exam ? exam.questions[i] : null;
              if (!q) return '';
              const isCorrect = d.isCorrect;
              return `
                <div class="result-q-item ${isCorrect ? 'correct' : 'wrong'}" onclick="ExamResultPage.showDetail(${i}, ${state.examId})">
                  <span class="result-q-num">${i + 1}</span>
                  <span class="result-q-type">${Utils.typeLabel(q.type)}</span>
                  <span class="result-q-preview">${Utils.escapeHtml(q.content.substring(0, 30))}${q.content.length > 30 ? '...' : ''}</span>
                  <span class="result-q-status">${isCorrect ? '✅' : '❌'}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <div class="result-actions">
          <button class="action-btn action-btn-exam" onclick="Utils.navigate('exam/${state.examId}')">
            <span class="action-icon">🔄</span>
            <span class="action-title">重新考试</span>
          </button>
          <button class="action-btn action-btn-practice" onclick="Utils.navigate('exam')">
            <span class="action-icon">📋</span>
            <span class="action-title">返回试卷列表</span>
          </button>
        </div>
      </div>
    `;
  },

  showDetail(index, examId) {
    const exam = QUESTION_DATA.exams.find(e => e.id === examId);
    if (!exam) return;
    const q = exam.questions[index];
    if (!q) return;

    // 获取答案
    const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
    let state = null;
    try {
      state = JSON.parse(decodeURIComponent(params.get('state') || ''));
    } catch { /* ignore */ }

    const userAnswer = state ? (state.details[index]?.userAnswer || '未作答') : '未作答';
    const isCorrect = state ? state.details[index]?.isCorrect : false;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <span class="question-type-badge">${Utils.typeLabel(q.type)}</span>
          <span class="question-number">第 ${index + 1} 题</span>
          <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
        </div>
        <div class="modal-body">
          <div class="question-content">${Utils.escapeHtml(q.content)}</div>
          <div class="options-list">
            ${q.options.map(opt => {
              const isCorrectOpt = q.answer.includes(opt.label);
              const isUserOpt = userAnswer.includes(opt.label);
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
          <div class="result-answer-info ${isCorrect ? 'correct' : 'wrong'}">
            <span>${isCorrect ? '✅ 回答正确' : '❌ 回答错误'}</span>
            <span>你的答案：${userAnswer}</span>
            <span>正确答案：${q.answer}</span>
          </div>
          ${q.explanation ? `
            <div class="explanation-panel correct">
              <div class="explanation-header">📖 知识讲解</div>
              <div class="explanation-body">${Utils.renderText(q.explanation)}</div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  }
};