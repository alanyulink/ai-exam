// 刷题模式
const PracticePage = {
  currentType: 'single',
  currentIndex: 0,
  answered: {},
  confirmed: {},
  gridExpanded: false,
  _importantIds: null,

  // 归一化文本：去空格、统一标点、去除（修正）后缀
  _normalizeText(text) {
    return text
      .trim()
      .replace(/\s+/g, '')                         // 去除所有空白
      .replace(/[，,]/g, ',')                       // 统一逗号
      .replace(/[。.]/g, '.')                      // 统一句号
      .replace(/[？?]/g, '?')                      // 统一问号
      .replace(/[（(]/g, '(')
      .replace(/[）)]/g, ')')
      .replace(/[、]/g, ',')
      .replace(/[「」『』]/g, '')                   // 去除中文引号
      .replace(/\(修正\)/g, '')                    // 去除（修正）标注
      .toLowerCase();
  },

  // 计算两字符串的字符三元组 Jaccard 相似度
  _similarity(s1, s2) {
    const getTrigrams = (s) => {
      const set = new Set();
      for (let i = 0; i < s.length - 2; i++) {
        set.add(s.substring(i, i + 3));
      }
      return set;
    };
    const t1 = getTrigrams(s1);
    const t2 = getTrigrams(s2);
    let inter = 0;
    for (const t of t1) {
      if (t2.has(t)) inter++;
    }
    const union = t1.size + t2.size - inter;
    return union === 0 ? 0 : inter / union;
  },

  // 获取试卷6中的题目池ID集合（重点题目）
  getImportantQuestionIds() {
    if (this._importantIds) return this._importantIds;
    const exam6 = QUESTION_DATA.exams.find(e => e.id === 6);
    if (!exam6) return new Set();

    // 构建归一化文本 → poolId 映射（每个归一化文本只保留第一个）
    const poolMap = {};
    const poolList = [];
    for (const pq of QUESTION_DATA.questions) {
      const norm = this._normalizeText(pq.content);
      if (!poolMap[norm]) {
        poolMap[norm] = pq.id;
      }
      poolList.push({ id: pq.id, norm });
    }

    const ids = new Set();
    for (const eq of exam6.questions) {
      const norm = this._normalizeText(eq.content);

      // 1) 归一化精确匹配
      if (poolMap[norm] !== undefined) {
        ids.add(poolMap[norm]);
        continue;
      }

      // 2) 模糊匹配（≥90% 相似度）
      let bestId = null;
      let bestScore = 0;
      for (const p of poolList) {
        const score = this._similarity(norm, p.norm);
        if (score > bestScore) {
          bestScore = score;
          bestId = p.id;
        }
      }
      if (bestScore >= 0.9 && bestId !== null) {
        ids.add(bestId);
      }
    }
    this._importantIds = ids;
    return ids;
  },

  getQuestions() {
    return QUESTION_DATA.questions.filter(q => q.type === this.currentType);
  },

  render(type) {
    this.currentType = type || 'single';
    this.currentIndex = 0;
    this.answered = {};
    this.confirmed = {};
    this.gridExpanded = false;

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
            const isKey = PracticePage.getImportantQuestionIds().has(qx.id);
            let dotClass = 'grid-dot';
            if (isCurrent) dotClass += ' current';
            else if (isAnswered) {
              const ansCorrect = this.answered[i] === qx.answer;
              dotClass += ansCorrect ? ' correct' : ' wrong';
            }
            if (isFav) dotClass += ' fav';
            if (isKey && !isCurrent) dotClass += ' key';
            return `<span class="${dotClass}" onclick="PracticePage.goTo(${i})">${i + 1}</span>`;
          }).join('')}
        </div>
        ` : ''}

        <div class="question-card">
          <div class="question-header">
            <span class="question-type-badge">${Utils.typeLabel(q.type)}</span>
            <span class="question-number">第 ${this.currentIndex + 1} 题</span>
            ${this.getImportantQuestionIds().has(q.id) ? '<span class="key-icon">📌 重点</span>' : ''}
            <span class="fav-btn ${Store.isFavorite(q.id) ? 'faved' : ''}" onclick="PracticePage.toggleFav(${q.id})">
              ${Store.isFavorite(q.id) ? '★' : '☆'}
            </span>
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
          ${q.explanation ? `<div class="explanation-body">${Utils.renderText(q.explanation)}</div>` : ''}
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

    if (isCorrect) Utils.playCorrect();
    else Utils.playWrong();

    Store.updateStats({
      totalAnswered: 1,
      totalCorrect: isCorrect ? 1 : 0,
      todayAnswered: 1,
      todayCorrect: isCorrect ? 1 : 0
    });

    if (!isCorrect && q.id) {
      Store.addWrongQuestion(q.id, userAnswer, false);
    }

    this.renderCurrent();
  },

  goTo(index) {
    const questions = this.getQuestions();
    if (index < 0 || index >= questions.length) return;
    this.currentIndex = index;
    this.renderCurrent();
  },

  renderCurrent() {
    document.getElementById('app').innerHTML = this.renderPage();
  },
};