// 搜题模式
const SearchPage = {
  keyword: '',
  results: [],
  expandedId: null,

  render() {
    return this.renderPage();
  },

  renderPage() {
    return `
      <div class="page search-page">
        <div class="search-header">
          <button class="back-btn" onclick="Utils.navigate('')">← 返回</button>
          <h1 class="search-title">搜题模式</h1>
        </div>

        <div class="search-input-wrap">
          <input type="text" 
            class="search-input" 
            id="search-input"
            placeholder="输入关键词搜索题目..." 
            value="${Utils.escapeHtml(this.keyword)}"
            oninput="SearchPage.onInput(event)"
            onkeydown="SearchPage.onKeyDown(event)">
          <button class="search-clear-btn" id="search-clear" onclick="SearchPage.clearKeyword()" style="${this.keyword ? '' : 'display:none'}">✕</button>
        </div>

        <div class="search-info">
          ${this.keyword ? `找到 <strong>${this.results.length}</strong> 道相关题目` : '输入关键词开始搜索'}
        </div>

        <div class="search-results">
          ${this.results.length > 0 ? this.results.map(q => this.renderQuestionCard(q)).join('') : (this.keyword ? '<div class="empty-state">没有找到相关题目</div>' : '')}
        </div>
      </div>
    `;
  },

  renderQuestionCard(q) {
    const isExpanded = this.expandedId === q.id;
    return `
      <div class="question-card search-result-card">
        <div class="question-header" onclick="SearchPage.toggleExpand(${q.id})">
          <span class="question-type-badge">${Utils.typeLabel(q.type)}</span>
          <span class="question-number">第 ${q.id} 题</span>
          <span class="fav-btn ${Store.isFavorite(q.id) ? 'faved' : ''}" onclick="event.stopPropagation(); SearchPage.toggleFav(${q.id})">
            ${Store.isFavorite(q.id) ? '★' : '☆'}
          </span>
        </div>
        <div class="question-content">${Utils.escapeHtml(q.content)}</div>

        <div class="options-list ${q.type === 'multi' ? 'multi-select' : ''}">
          ${q.options.map((opt, idx) => {
            const isCorrect = q.answer.includes(opt.label);
            let optClass = 'option-item';
            if (isExpanded && isCorrect) {
              optClass += ' correct';
            }
            return `
              <div class="${optClass}">
                <span class="option-marker">${opt.label}</span>
                <span class="option-text">${Utils.escapeHtml(opt.content)}</span>
                ${isExpanded && isCorrect ? '<span class="option-check">✓</span>' : ''}
              </div>
            `;
          }).join('')}
        </div>

        ${isExpanded ? `
        <div class="explanation-panel correct">
          <div class="explanation-header">
            <span class="explanation-answer">正确答案：${q.answer}</span>
          </div>
          ${q.explanation ? `<div class="explanation-body">${Utils.renderText(q.explanation)}</div>` : ''}
        </div>
        ` : `
        <div class="expand-hint" onclick="SearchPage.toggleExpand(${q.id})">
          点击查看答案和解析 ▼
        </div>
        `}
      </div>
    `;
  },

  onInput(event) {
    this.keyword = event.target.value;
    this.doSearch();
    this.renderCurrent();
  },

  onKeyDown(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.doSearch();
      this.renderCurrent();
    }
  },

  clearKeyword() {
    this.keyword = '';
    this.results = [];
    this.expandedId = null;
    this.renderCurrent();
    setTimeout(() => {
      const input = document.getElementById('search-input');
      if (input) input.focus();
    }, 0);
  },

  doSearch() {
    const kw = this.keyword.trim().toLowerCase();
    if (!kw) {
      this.results = [];
      return;
    }

    this.results = QUESTION_DATA.questions.filter(q => {
      const content = q.content.toLowerCase();
      if (content.includes(kw)) return true;

      if (q.options && q.options.some(opt => opt.content.toLowerCase().includes(kw))) {
        return true;
      }

      if (q.explanation && q.explanation.toLowerCase().includes(kw)) {
        return true;
      }

      return false;
    }).slice(0, 100);
  },

  toggleExpand(id) {
    this.expandedId = this.expandedId === id ? null : id;
    this.renderCurrent();
  },

  toggleFav(questionId) {
    Store.toggleFavorite(questionId);
    this.renderCurrent();
  },

  renderCurrent() {
    document.getElementById('app').innerHTML = this.renderPage();
    const input = document.getElementById('search-input');
    if (input && document.activeElement !== input) {
      input.focus();
      const len = input.value.length;
      input.setSelectionRange(len, len);
    }
  }
};
