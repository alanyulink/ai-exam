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

    this.currentIndex = 0;
    this.answers = {};
    this.timeLeft = this.exam.time_limit || 3600;
    this.ended = false;

    if (this.timer) clearInterval(this.timer);
    this.startTimer();

    return this.renderQuestion();
  },

  startTimer() {
    this.timer = setInterval(() => {
      this.timeLeft -= 1;
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.submitExam();
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

    const isAnswered = this.answers[this.currentIndex] !== undefined;
    const userAnswer = this.answers[this.currentIndex] || '';

    return `
      <div class="page exam-room-page">
        <div class="exam-room-header">
          <button class="back-btn" onclick="ExamRoomPage.confirmExit()">✕ 退出</button>
          <div class="exam-room-title">${this.exam.name}</div>
          <div class="exam-room-timer" id="exam-timer">${Utils.formatTime(this.timeLeft)}</div>
        </div>

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
          <button class="submit-exam-btn" onclick="ExamRoomPage.confirmSubmit()">交卷</button>
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

  confirmExit() {
    if (Object.keys(this.answers).length > 0) {
      if (confirm('确定要退出考试吗？答题进度将丢失。')) {
        if (this.timer) clearInterval(this.timer);
        Utils.navigate('exam');
      }
    } else {
      if (this.timer) clearInterval(this.timer);
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
      this.submitExam();
    }
  },

  submitExam() {
    this.ended = true;
    if (this.timer) clearInterval(this.timer);

    // 计算得分
    const questions = this.exam.questions;
    let correct = 0;
    const details = questions.map((q, i) => {
      const userAnswer = this.answers[i] || '';
      const isCorrect = userAnswer === q.answer;
      if (isCorrect) correct++;
      return { index: i, userAnswer, isCorrect };
    });

    const score = correct * this.exam.per_score;
    const passed = score >= this.exam.pass_score;

    // 记录考试
    Store.addExamRecord({
      examId: this.examId,
      score,
      totalScore: this.exam.total_score,
      answers: this.answers,
      timeSpent: (this.exam.time_limit || 3600) - this.timeLeft,
      timestamp: Date.now()
    });

    // 更新统计
    Store.updateStats({
      totalAnswered: correct,
      totalCorrect: correct,
      totalExams: 1,
      passedExams: passed ? 1 : 0
    });

    // 记录错题
    details.forEach(d => {
      if (!d.isCorrect) {
        Store.addWrongQuestion(questions[d.index].id, d.userAnswer, false);
      }
    });

    // 跳转到成绩页
    const state = encodeURIComponent(JSON.stringify({
      examId: this.examId,
      score,
      totalScore: this.exam.total_score,
      passScore: this.exam.pass_score,
      correct,
      total: questions.length,
      perScore: this.exam.per_score,
      timeSpent: (this.exam.time_limit || 3600) - this.timeLeft,
      timeLimit: this.exam.time_limit,
      details,
      passed
    }));
    window.location.hash = `exam/${this.examId}/result?state=${state}`;
  },

  renderCurrent() {
    document.getElementById('app').innerHTML = this.renderQuestion();
  }
};