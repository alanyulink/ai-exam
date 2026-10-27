// 错题本
const WrongBookPage = {
  filter: 'all',
  _detail: null,
  _answer: '',
  _confirmed: false,

  questionById(id) {
    return QUESTION_DATA.questions.find(q => q.id === id) || null;
  },

  allWrong() {
    return Object.values(Store.getWrongQuestions())
      .map(w => ({ ...w, question: this.questionById(w.questionId) }))
      .filter(w => w.question);
  },

  items() {
    return this.allWrong()
      .filter(w => this.filter === 'all' || w.question.type === this.filter)
      .sort((a, b) => b.lastWrongTime - a.lastWrongTime);
  },

  render(filter) {
    this.filter = filter || 'all';
    return this.renderPage();
  },

  renderPage() {
    const all = this.allWrong();
    if (all.length === 0) {
      return `
        <div class="page wrong-page">
          <div class="practice-header">
            <button class="back-btn" onclick="Utils.navigate('')">← 返回</button>
            <div class="wrong-title">错题本</div>
          </div>
          <div class="empty-state">
            <div class="empty-icon">🎉</div>
            <div>还没有错题，继续保持</div>
            <button class="wrong-action-btn" style="margin-top:20px" onclick="Utils.navigate('practice/single')">去刷题</button>
          </div>
        </div>
      `;
    }

    const counts = { all: all.length, single: 0, multi: 0, judge: 0 };
    all.forEach(w => { counts[w.question.type]++; });
    const items = this.items();

    const chip = (key, label) => `
      <span class="wrong-stat-chip ${this.filter === key ? 'active' : ''}" onclick="WrongBookPage.setFilter('${key}')">
        ${label}<span class="wrong-stat-num">${counts[key]}</span>
      </span>
    `;

    return `
      <div class="page wrong-page">
        <div class="practice-header">
          <button class="back-btn" onclick="Utils.navigate('')">← 返回</button>
          <div class="wrong-title">错题本</div>
          <button class="wrong-clear-btn" onclick="WrongBookPage.clearAll()">清空</button>
        </div>

        <div class="wrong-stats">
          ${chip('all', '全部')}
          ${chip('single', '单选')}
          ${chip('multi', '多选')}
          ${chip('judge', '判断')}
        </div>

        ${items.length === 0 ? `
          <div class="empty-state">该题型暂无错题</div>
        ` : `
          <div class="wrong-list">
            ${items.map(w => this.renderItem(w)).join('')}
          </div>
        `}
      </div>
    `;
  },

  renderItem(w) {
    const q = w.question;
    return `
      <div class="wrong-item" onclick="WrongBookPage.openDetail(${q.id})">
        <div class="wrong-item-top">
          <span class="question-type-badge small">${Utils.typeLabel(q.type)}</span>
          <span class="wrong-count">错 ${w.wrongCount} 次</span>
          <span class="wrong-time">${Utils.timeAgo(w.lastWrongTime)}</span>
        </div>
        <div class="wrong-item-content wrong-clamp">${Utils.escapeHtml(q.content)}</div>
        <div class="wrong-item-answer">
          正确答案：<span class="correct-answer">${q.answer}</span>
          · 我的答案：${w.lastAnswer ? Utils.escapeHtml(w.lastAnswer) : '—'}
        </div>
      </div>
    `;
  },

  setFilter(filter) {
    this.filter = filter;
    document.getElementById('app').innerHTML = this.renderPage();
  },

  clearAll() {
    const total = this.allWrong().length;
    if (!total) return;
    if (!confirm(`确定清空全部 ${total} 道错题吗？此操作不可恢复。`)) return;
    Store.clearAllWrong();
    document.getElementById('app').innerHTML = this.renderPage();
  },

  // ===== 详情 / 重做 =====
  openDetail(id) {
    const w = this.allWrong().find(x => x.questionId === id);
    if (!w) return;
    this._detail = w;
    this._answer = '';
    this._confirmed = false;
    this.closeDetail();
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" onclick="if (event.target === this) WrongBookPage.closeDetail()">
        <div class="modal-content">
          <div class="modal-header">
            <span class="question-type-badge">${Utils.typeLabel(w.question.type)}</span>
            <span class="wrong-count">错 ${w.wrongCount} 次</span>
            <button class="modal-close" onclick="WrongBookPage.closeDetail()">✕</button>
          </div>
          <div class="modal-body" id="wrong-detail-body">${this.renderDetail()}</div>
        </div>
      </div>
    `);
  },

  closeDetail() {
    document.querySelector('.modal-overlay')?.remove();
  },

  retry() {
    this._answer = '';
    this._confirmed = false;
    this._refreshDetail();
  },

  pick(index) {
    if (this._confirmed) return;
    const q = this._detail.question;
    const label = q.options[index].label;

    if (q.type === 'multi') {
      const selected = this._answer.split('').filter(Boolean);
      this._answer = (selected.includes(label)
        ? selected.filter(l => l !== label)
        : [...selected, label].sort()
      ).join('');
      this._refreshDetail();
      return;
    }

    this._answer = label;
    this._confirmed = true;
    this.judge();
  },

  submitMulti() {
    if (this._confirmed || !this._answer) return;
    this._confirmed = true;
    this.judge();
  },

  judge() {
    const q = this._detail.question;
    const isCorrect = this._answer === q.answer;
    if (isCorrect) {
      Utils.playCorrect();
    } else {
      Utils.playWrong();
      Store.addWrongQuestion(q.id, this._answer, false);
      this._detail = this.allWrong().find(x => x.questionId === q.id) || this._detail;
    }
    this._refreshDetail();
  },

  _refreshDetail() {
    const body = document.getElementById('wrong-detail-body');
    if (body) body.innerHTML = this.renderDetail();
  },

  renderDetail() {
    const w = this._detail;
    const q = w.question;
    const show = this._confirmed;
    const isCorrect = this._answer === q.answer;

    const optionsHtml = q.options.map((opt, idx) => {
      let cls = 'option-item';
      if (show) {
        if (q.answer.includes(opt.label)) cls += ' correct';
        else if (this._answer.includes(opt.label)) cls += ' wrong';
      } else if (this._answer.includes(opt.label)) {
        cls += ' selected';
      }
      return `
        <div class="${cls}" onclick="WrongBookPage.pick(${idx})">
          <span class="option-marker">${opt.label}</span>
          <span class="option-text">${Utils.escapeHtml(opt.content)}</span>
          ${show && q.answer.includes(opt.label) ? '<span class="option-check">✓</span>' : ''}
          ${show && this._answer.includes(opt.label) && !q.answer.includes(opt.label) ? '<span class="option-cross">✗</span>' : ''}
        </div>
      `;
    }).join('');

    return `
      <div class="question-content">${Utils.escapeHtml(q.content)}</div>
      <div class="options-list ${q.type === 'multi' ? 'multi-select' : ''}">${optionsHtml}</div>

      ${show ? `
        <div class="result-answer-info ${isCorrect ? 'correct' : 'wrong'}">
          <span>${isCorrect ? '✅ 回答正确，已掌握可移出错题本' : '❌ 回答错误，已累计错 ' + w.wrongCount + ' 次'}</span>
          <span>你的答案：${this._answer || '—'} · 正确答案：${q.answer}</span>
        </div>
      ` : `
        <div class="wrong-meta">
          <span>正确答案：<span class="correct-answer">${q.answer}</span> · 上次作答：${w.lastAnswer ? Utils.escapeHtml(w.lastAnswer) : '—'}</span>
        </div>
      `}

      ${q.explanation ? `
        <div class="explanation-panel ${show ? (isCorrect ? 'correct' : 'wrong') : 'neutral'}">
          <div class="explanation-body">${Utils.renderText(q.explanation)}</div>
        </div>
      ` : ''}

      <div class="wrong-actions">
        ${show
          ? '<button class="wrong-action-btn" onclick="WrongBookPage.retry()">重新作答</button>'
          : (q.type === 'multi' && this._answer
            ? '<button class="wrong-action-btn" onclick="WrongBookPage.submitMulti()">确认提交</button>'
            : '')}
        <button class="wrong-action-btn secondary" onclick="WrongBookPage.removeCurrent()">移出错题本</button>
      </div>
    `;
  },

  removeCurrent() {
    if (!this._detail) return;
    Store.removeWrongQuestion(this._detail.questionId);
    this.closeDetail();
    document.getElementById('app').innerHTML = this.renderPage();
  },
};
