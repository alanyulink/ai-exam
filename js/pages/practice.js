// 刷题模式
const PracticePage = {
  currentType: 'single',
  currentIndex: 0,
  answered: {},
  confirmed: {},
  shuffled: false,

  getQuestions() {
    return QUESTION_DATA.questions.filter(q => q.type === this.currentType);
  },

  render(type) {
    this.currentType = type || 'single';
    this.currentIndex = 0;
    this.answered = {};
    this.confirmed = {};

    return this.renderPage();
  },

  renderPage() {
    const questions = this.getQuestions();
    const total = questions.length;
    if (total === 0) {
      return `<div class="page"><div class="empty-state">暂无题目</div></div>`;
    }

    const q = questions[this.currentIndex];
    const isConfirmed = this.confirmed[this.currentIndex] === true;
    const userAnswer = this.answered[this.currentIndex] || '';
    const isCorrect = isConfirmed && userAnswer === q.answer;

    const progress = ((this.currentIndex + 1) / total * 100).toFixed(1);

    return `
      <div class="page practice-page">
        <div class="practice-header">
          <button class="back-btn" onclick="Utils.navigate('')">← 返回</button>
          <div class="practice-type-tabs">
            <span class="practice-tab ${this.currentType === 'single' ? 'active' : ''}" onclick="App.renderPage('practice/single')">单选</span>
            <span class="practice-tab ${this.currentType === 'multi' ? 'active' : ''}" onclick="App.renderPage('practice/multi')">多选</span>
            <span class="practice-tab ${this.currentType === 'judge' ? 'active' : ''}" onclick="App.renderPage('practice/judge')">判断</span>
          </div>
        </div>

        <div class="progress-bar-container">
          <div class="progress-bar">
            <div class="progress-fill" style="width:${progress}%"></div>
          </div>
          <span class="progress-text">${this.currentIndex + 1}/${total}</span>
        </div>

        <div class="question-card">
          <div class="question-header">
            <span class="question-type-badge">${Utils.typeLabel(q.type)}</span>
            <span class="question-number">第 ${this.currentIndex + 1} 题</span>
            <span class="fav-btn ${Store.isFavorite(q.id) ? 'faved' : ''}" onclick="PracticePage.toggleFav(${q.id})">
              ${Store.isFavorite(q.id) ? '★' : '☆'}
            </span>
            <span class="tts-btn" onclick="PracticePage.speakQuestion()" title="朗读题目">🔊</span>
          </div>
          <div class="question-content">${Utils.escapeHtml(q.content)}</div>

          <div class="options-list ${q.type === 'multi' ? 'multi-select' : ''}">
            ${q.options.map((opt, idx) => {
              const selected = userAnswer.includes(opt.label);
              let optClass = 'option-item';
              if (isConfirmed) {
                if (q.answer.includes(opt.label)) {
                  optClass += ' correct';
                } else if (selected && !q.answer.includes(opt.label)) {
                  optClass += ' wrong';
                }
              } else if (selected) {
                optClass += ' selected';
              }
              return `
                <div class="${optClass}" onclick="PracticePage.selectOption(${idx})" data-index="${idx}">
                  <span class="option-marker">${opt.label}</span>
                  <span class="option-text">${Utils.escapeHtml(opt.content)}</span>
                  ${isConfirmed && q.answer.includes(opt.label) ? '<span class="option-check">✓</span>' : ''}
                  ${isConfirmed && selected && !q.answer.includes(opt.label) ? '<span class="option-cross">✗</span>' : ''}
                </div>
              `;
            }).join('')}
          </div>
          ${q.type === 'multi' && !isConfirmed && userAnswer ? `
            <button class="confirm-btn" onclick="PracticePage.submitMultiAnswer()">确认提交</button>
          ` : ''}
        </div>

        <div class="practice-nav">
          <button class="nav-btn" onclick="PracticePage.goTo(${this.currentIndex - 1})" ${this.currentIndex === 0 ? 'disabled' : ''}>
            ← 上一题
          </button>
          <button class="nav-btn" onclick="PracticePage.goTo(${this.currentIndex + 1})" ${this.currentIndex >= total - 1 ? 'disabled' : ''}>
            下一题 →
          </button>
        </div>

        ${isConfirmed ? `
        <div class="explanation-panel ${isCorrect ? 'correct' : 'wrong'}">
          <div class="explanation-header">
            ${isCorrect ? '✅ 回答正确！' : '❌ 回答错误'}
            <span class="explanation-answer">正确答案：${q.answer}</span>
            <span class="tts-btn tts-btn-explanation" onclick="PracticePage.speakExplanation()" title="朗读解析">🔊</span>
          </div>
          <div class="explanation-body">${Utils.renderText(q.explanation)}</div>
        </div>
        ` : ''}
      </div>
    `;
  },

  toggleFav(questionId) {
    Store.toggleFavorite(questionId);
    this.renderCurrent();
  },

  speakQuestion() {
    const questions = this.getQuestions();
    const q = questions[this.currentIndex];
    if (q) TTS.speakQuestion(q);
  },

  speakExplanation() {
    const questions = this.getQuestions();
    const q = questions[this.currentIndex];
    if (q && q.explanation) TTS.speakExplanation(q.explanation);
  },

  selectOption(optIndex) {
    const questions = this.getQuestions();
    const q = questions[this.currentIndex];
    const isMulti = q.type === 'multi';

    if (this.confirmed[this.currentIndex]) {
      this.confirmed[this.currentIndex] = false;
    }

    const optLabel = q.options[optIndex].label;

    let newAnswer;
    if (isMulti) {
      const current = this.answered[this.currentIndex] || '';
      const selected = current.split('').filter(Boolean);
      if (selected.includes(optLabel)) {
        newAnswer = selected.filter(l => l !== optLabel).join('');
      } else {
        newAnswer = [...selected, optLabel].sort().join('');
      }
    } else {
      newAnswer = optLabel;
    }

    this.answered[this.currentIndex] = newAnswer;

    if (!isMulti) {
      this.confirmed[this.currentIndex] = true;
      this.checkAnswer();
    }
    this.renderCurrent();
  },

  submitMultiAnswer() {
    const questions = this.getQuestions();
    const q = questions[this.currentIndex];
    const userAnswer = this.answered[this.currentIndex] || '';
    if (!userAnswer) return;

    this.confirmed[this.currentIndex] = true;
    this.checkAnswer();
  },

  checkAnswer() {
    const questions = this.getQuestions();
    const q = questions[this.currentIndex];
    const userAnswer = this.answered[this.currentIndex] || '';
    const isCorrect = userAnswer === q.answer;

    const stats = Store.getStats();
    const today = new Date().toDateString();

    const updates = {
      totalAnswered: 1,
      totalCorrect: isCorrect ? 1 : 0
    };
    if (stats.lastStudyDate === today || !stats.lastStudyDate) {
      updates.todayAnswered = 1;
      updates.todayCorrect = isCorrect ? 1 : 0;
    }

    Store.updateStats(updates);
    if (!isCorrect && q.id) {
      Store.addWrongQuestion(q.id, userAnswer, false);
    }

    this.renderCurrent();

    // 语音反馈
    TTS.speakFeedback(isCorrect, q.type, q.answer, q.content);
  },

  goTo(index) {
    const questions = this.getQuestions();
    if (index < 0 || index >= questions.length) return;
    this.currentIndex = index;
    this.renderCurrent();
  },

  renderCurrent() {
    document.getElementById('app').innerHTML = this.renderPage();
  }
};