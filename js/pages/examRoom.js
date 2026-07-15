// 考试界面
const ExamRoomPage = {
  examId: null,
  exam: null,
  currentIndex: 0,
  answers: {},
  timeLeft: 0,
  timer: null,
  ended: false,

  render(id) {
    this.examId = parseInt(id);
    this.exam = QUESTION_DATA.exams.find(e => e.id === this.examId);
    if (!this.exam) {
      return `<div class="page"><div class="empty-state">试卷不存在</div></div>`;
    }

    if (this.timer) clearInterval(this.timer);

    // 检查是否有草稿
    const draft = Store.getExamDraft(this.examId);
    if (draft) {
      this.answers = draft.answers || {};
      this.currentIndex = draft.currentIndex || 0;
      this.timeLeft = draft.timeLeft !== undefined ? draft.timeLeft : (this.exam.time_limit || 3600);
    } else {
      this.answers = {};
      this.currentIndex = 0;
      this.timeLeft = this.exam.time_limit || 3600;
    }
    this.ended = false;

    this.startTimer();
    return this.renderQuestion();
  },

  startTimer() {
    this.timer = setInterval(() => {
      this.timeLeft -= 1;
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.doSubmit();
      }
      const timerEl = document.getElementById('exam-timer');
      if (timerEl) {
        timerEl.textContent = Utils.formatTime(this.timeLeft);
        if (this.timeLeft < 300) {
          timerEl.classList.add('timer-warning');
        }
      }
    }, 1000);
  },

  renderQuestion() {
    const questions = this.exam.questions;
    const total = questions.length;
    const q = questions[this.currentIndex];
    if (!q) return `<div class="page"><div class="empty-state">题目加载失败</div></div>`;

    const userAnswer = this.answers[this.currentIndex] || '';
    const draft = Store.getExamDraft(this.examId);
    const hasDraft = draft !== null;

    return `
      <div class="page exam-room-page">
        <div class="exam-room-header">
          <button class="back-btn" onclick="ExamRoomPage.confirmExit()">✕ 退出</button>
          <div class="exam-room-title">${this.exam.name}</div>
          <div class="exam-room-timer" id="exam-timer">${Utils.formatTime(this.timeLeft)}</div>
        </div>
        ${hasDraft ? '<div class="draft-banner">📝 上次未完成的考试，已恢复进度</div>' : ''}

        <div class="progress-bar-container">
          <div class="progress-bar">
            <div class="progress-fill" style="width:${((this.currentIndex + 1) / total * 100).toFixed(1)}%"></div>
          </div>
          <span class="progress-text">${this.currentIndex + 1}/${total}</span>
        </div>

        <div class="question-card">
          <div class="question-header">
            <span class="question-type-badge">${Utils.typeLabel(q.type)}</span>
            <span class="question-number">第 ${this.currentIndex + 1} 题</span>
            <span class="question-pool-id">题库#${q.id}</span>
          </div>
          <div class="question-content">${Utils.escapeHtml(q.content)}</div>

          <div class="options-list ${q.type === 'multi' ? 'multi-select' : ''}">
            ${q.options.map((opt, idx) => {
              const selected = q.type === 'multi'
                ? userAnswer.includes(opt.label)
                : userAnswer === opt.label;
              return `
                <div class="option-item ${selected ? 'selected' : ''}" onclick="ExamRoomPage.selectOption(${idx})">
                  <span class="option-marker">${opt.label}</span>
                  <span class="option-text">${Utils.escapeHtml(opt.content)}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <div class="question-nav">
          <button class="nav-btn" onclick="ExamRoomPage.goTo(${this.currentIndex - 1})" ${this.currentIndex === 0 ? 'disabled' : ''}>
            ← 上一题
          </button>

          <div class="question-dots">
            ${questions.slice(0, Math.min(total, 60)).map((_, i) => {
              const answered = this.answers[i] !== undefined;
              return `<span class="q-dot ${answered ? 'answered' : ''} ${i === this.currentIndex ? 'current' : ''}" onclick="ExamRoomPage.goTo(${i})"></span>`;
            }).join('')}
            ${total > 60 ? '<span class="q-dot-more">⋯</span>' : ''}
          </div>

          <button class="nav-btn" onclick="ExamRoomPage.goTo(${this.currentIndex + 1})" ${this.currentIndex >= total - 1 ? 'disabled' : ''}>
            下一题 →
          </button>
        </div>

        <div class="exam-room-footer">
          <span class="answered-count">已答 ${Object.keys(this.answers).length}/${total} 题</span>
          <div class="exam-room-actions">
            <button class="save-exam-btn" onclick="ExamRoomPage.saveDraft()">💾 仅保存</button>
            <button class="submit-exam-btn" onclick="ExamRoomPage.confirmSubmit()">交卷</button>
          </div>
        </div>
      </div>
    `;
  },

  selectOption(optIndex) {
    if (this.ended) return;
    const questions = this.exam.questions;
    const q = questions[this.currentIndex];
    const optLabel = q.options[optIndex].label;

    if (q.type === 'multi') {
      const current = this.answers[this.currentIndex] || '';
      const selected = current.split('').filter(Boolean);
      if (selected.includes(optLabel)) {
        this.answers[this.currentIndex] = selected.filter(l => l !== optLabel).join('');
      } else {
        this.answers[this.currentIndex] = [...selected, optLabel].sort().join('');
      }
    } else {
      this.answers[this.currentIndex] = optLabel;
    }

    this.renderCurrent();
  },

  goTo(index) {
    const questions = this.exam.questions;
    if (index < 0 || index >= questions.length) return;
    this.currentIndex = index;
    this.renderCurrent();
  },

  saveDraft() {
    Store.saveExamDraft(this.examId, {
      answers: this.answers,
      currentIndex: this.currentIndex,
      timeLeft: this.timeLeft
    });
    if (this.timer) clearInterval(this.timer);
    Utils.navigate('exam');
  },

  confirmExit() {
    if (Object.keys(this.answers).length > 0) {
      if (confirm('确定要退出考试吗？答题进度将丢失。')) {
        if (this.timer) clearInterval(this.timer);
        Store.removeExamDraft(this.examId);
        Utils.navigate('exam');
      }
    } else {
      if (this.timer) clearInterval(this.timer);
      Store.removeExamDraft(this.examId);
      Utils.navigate('exam');
    }
  },

  confirmSubmit() {
    const total = this.exam.questions.length;
    const answered = Object.keys(this.answers).length;
    const unanswered = total - answered;
    let msg = `你已答 ${answered}/${total} 题`;
    if (unanswered > 0) msg += `，还有 ${unanswered} 题未答`;
    msg += '，确定要交卷吗？';
    if (confirm(msg)) {
      this.doSubmit();
    }
  },

  doSubmit() {
    this.ended = true;
    if (this.timer) clearInterval(this.timer);
    Store.removeExamDraft(this.examId);

    const questions = this.exam.questions;
    let correct = 0;
    const wrongDetails = [];

    const singleStats = { correct: 0, total: 0 };
    const multiStats = { correct: 0, total: 0 };
    const judgeStats = { correct: 0, total: 0 };

    questions.forEach((q, i) => {
      const userAnswer = this.answers[i] || '';
      const isCorrect = userAnswer === q.answer;
      if (isCorrect) correct++;

      const stats = q.type === 'single' ? singleStats : q.type === 'multi' ? multiStats : judgeStats;
      stats.total++;
      if (isCorrect) stats.correct++;

      if (!isCorrect) {
        wrongDetails.push({
          index: i,
          type: q.type,
          content: q.content,
          options: q.options,
          userAnswer: userAnswer,
          correctAnswer: q.answer,
          explanation: q.explanation
        });
      }
    });

    const score = correct * this.exam.per_score;
    const passed = score >= this.exam.pass_score;

    // 保存详细记录
    Store.addExamRecord({
      examId: this.examId,
      score,
      totalScore: this.exam.total_score,
      passScore: this.exam.pass_score,
      passed,
      timestamp: Date.now(),
      timeSpent: (this.exam.time_limit || 3600) - this.timeLeft,
      singleCorrect: singleStats.correct,
      singleTotal: singleStats.total,
      multiCorrect: multiStats.correct,
      multiTotal: multiStats.total,
      judgeCorrect: judgeStats.correct,
      judgeTotal: judgeStats.total,
      wrongDetails: wrongDetails.slice(0, 60)
    });

    // 更新统计
    Store.updateStats({
      totalAnswered: correct,
      totalCorrect: correct,
      totalExams: 1,
      passedExams: passed ? 1 : 0
    });

    // 返回试卷列表
    if (passed) Utils.playCorrect();
    else Utils.playWrong();
    Utils.navigate('exam');
  },

  renderCurrent() {
    document.getElementById('app').innerHTML = this.renderQuestion();
  }
};