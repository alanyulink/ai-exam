// 刷题模式
const PracticePage = {
  currentType: 'single',
  currentIndex: 0,
  answered: {},
  confirmed: {},
  gridExpanded: false,

  getQuestions() {
    return QUESTION_DATA.questions.filter(q => q.type === this.currentType);
  },

  render(type) {
    this.currentType = type || 'single';
    this.currentIndex = 0;
    this.answered = {};
    this.confirmed = {};
    this.gridExpanded = false;

    setTimeout(() => this.autoPlayCurrent(), 200);
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

        <div class="question-grid-header" onclick="PracticePage.toggleGrid()">
          <div class="grid-header-bar">
            <div class="grid-progress-fill" style="width:${progress}%"></div>
          </div>
          <div class="grid-header-info">
            <span>${this.currentIndex + 1}/${total}</span>
            <span class="grid-header-badges">
              <span class="grid-badge fav-badge">★ ${Store.getFavorites().filter(id => questions.some(qx => qx.id === id)).length}</span>
            </span>
            <span class="grid-toggle-btn">${this.gridExpanded ? '▲' : '▼'}</span>
          </div>
        </div>

        ${this.gridExpanded ? `
        <div class="question-grid expanded">
          ${questions.map((qx, i) => {
            const isFav = Store.isFavorite(qx.id);
            const isAnswered = this.confirmed[i] === true;
            const isCurrent = i === this.currentIndex;
            let dotClass = 'grid-dot';
            if (isCurrent) dotClass += ' current';
            else if (isAnswered) {
              const ansCorrect = this.answered[i] === qx.answer;
              dotClass += ansCorrect ? ' correct' : ' wrong';
            }
            if (isFav) dotClass += ' fav';
            return `<span class="${dotClass}" onclick="PracticePage.goTo(${i})">${i + 1}</span>`;
          }).join('')}
        </div>
        ` : ''}

        <div class="question-card">
          <div class="question-header">
            <span class="question-type-badge">${Utils.typeLabel(q.type)}</span>
            <span class="question-number">第 ${this.currentIndex + 1} 题</span>
            <span class="fav-btn ${Store.isFavorite(q.id) ? 'faved' : ''}" onclick="PracticePage.toggleFav(${q.id})">
              ${Store.isFavorite(q.id) ? '★' : '☆'}
            </span>
            <span class="tts-btn ${TTS._isPlaying ? 'playing' : ''}" onclick="PracticePage.toggleSpeak()" title="朗读/停止题目">🔊</span>
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
          </div>
          <div class="explanation-body">${Utils.renderText(q.explanation)}</div>
        </div>
        ` : ''}
      </div>
    `;
  },

  toggleGrid() {
    this.gridExpanded = !this.gridExpanded;
    this.renderCurrent();
  },

  toggleFav(questionId) {
    Store.toggleFavorite(questionId);
    this.renderCurrent();
  },

  toggleSpeak() {
    if (TTS.isPlaying()) {
      TTS.stop();
      this.updateTtsButton(false);
    } else {
      const questions = this.getQuestions();
      const q = questions[this.currentIndex];
      if (!q) return;
      this.updateTtsButton(true);
      TTS.speakQuestion(q).finally(() => {
        this.updateTtsButton(false);
      });
    }
  },

  updateTtsButton(playing) {
    const btn = document.querySelector('.tts-btn');
    if (btn) {
      btn.classList.toggle('playing', playing);
    }
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

    TTS.speakFeedback(isCorrect, q.type, q.answer, q.options);
  },

  goTo(index) {
    TTS.stop();
    const questions = this.getQuestions();
    if (index < 0 || index >= questions.length) return;
    this.currentIndex = index;
    this.renderCurrent();
  },

  renderCurrent() {
    document.getElementById('app').innerHTML = this.renderPage();
    setTimeout(() => this.autoPlayCurrent(), 100);
  },

  autoPlayCurrent() {
    if (TTS.isPlaying()) return;
    const questions = this.getQuestions();
    const q = questions[this.currentIndex];
    if (!q) return;
    this.updateTtsButton(true);
    TTS.speakQuestion(q).finally(() => {
      this.updateTtsButton(false);
    });
  }
};