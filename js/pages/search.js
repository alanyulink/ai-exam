// 搜题模式
const SearchPage = {
  keyword: '',
  results: [],
  selectedId: null,
  _isComposing: false,

  render() {
    setTimeout(() => this.bindInputEvents(), 0);
    return this.renderPage();
  },

  renderPage() {
    const selectedQ = this.selectedId
      ? QUESTION_DATA.questions.find(q => q.id === this.selectedId)
      : null;

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
            value="${Utils.escapeHtml(this.keyword)}">
          <button class="search-clear-btn" id="search-clear" onclick="SearchPage.clearKeyword()" style="${this.keyword ? '' : 'display:none'}">✕</button>
        </div>

        <div class="search-info">
          ${this.keyword ? `找到 <strong>${this.results.length}</strong> 道相关题目` : '输入关键词开始搜索'}
        </div>

        <div class="search-results">
          ${this.results.length > 0 ? this.results.map(q => this.renderResultItem(q)).join('') : (this.keyword ? '<div class="empty-state">没有找到相关题目</div>' : '')}
        </div>

        ${selectedQ ? this.renderDetailModal(selectedQ) : ''}
      </div>
    `;
  },

  renderResultItem(q) {
    return `
      <div class="search-result-item" onclick="SearchPage.openDetail(${q.id})">
        <div class="search-result-left">
          <span class="search-result-type">${Utils.typeLabel(q.type)}</span>
          <span class="search-result-id">第${q.id}题</span>
        </div>
        <div class="search-result-content">${Utils.escapeHtml(q.content)}</div>
        <span class="search-result-arrow">›</span>
      </div>
    `;
  },

  renderDetailModal(q) {
    return `
      <div class="search-mask" onclick="SearchPage.closeDetail()"></div>
      <div class="search-detail-modal" id="search-detail-modal">
        <div class="detail-modal-header">
          <span class="detail-modal-type">${Utils.typeLabel(q.type)}</span>
          <span class="detail-modal-id">第${q.id}题</span>
          <span class="fav-btn ${Store.isFavorite(q.id) ? 'faved' : ''}" onclick="event.stopPropagation(); SearchPage.toggleFav(${q.id})">
            ${Store.isFavorite(q.id) ? '★' : '☆'}
          </span>
          <button class="detail-close-btn" onclick="SearchPage.closeDetail()">✕</button>
        </div>
        <div class="detail-modal-body">
          <div class="detail-question">${Utils.escapeHtml(q.content)}</div>

          <div class="options-list ${q.type === 'multi' ? 'multi-select' : ''}">
            ${q.options.map((opt, idx) => {
              const isCorrect = q.answer.includes(opt.label);
              return `
                <div class="option-item ${isCorrect ? 'correct' : ''}">
                  <span class="option-marker">${opt.label}</span>
                  <span class="option-text">${Utils.escapeHtml(opt.content)}</span>
                  ${isCorrect ? '<span class="option-check">✓</span>' : ''}
                </div>
              `;
            }).join('')}
          </div>

          <div class="explanation-panel correct">
            <div class="explanation-header">
              <span class="explanation-answer">正确答案：${q.answer}</span>
            </div>
            ${q.explanation ? `<div class="explanation-body">${Utils.renderText(q.explanation)}</div>` : ''}
          </div>
        </div>
      </div>
    `;
  },

  bindInputEvents() {
    const input = document.getElementById('search-input');
    if (!input) return;

    input.addEventListener('compositionstart', () => {
      this._isComposing = true;
    });

    input.addEventListener('compositionend', (e) => {
      this._isComposing = false;
      this.keyword = e.target.value;
      this.doSearch();
      this.updateResultsOnly();
    });

    input.addEventListener('input', (e) => {
      if (this._isComposing) return;
      this.keyword = e.target.value;
      this.doSearch();
      this.updateResultsOnly();
    });

    input.focus();
    const len = input.value.length;
    input.setSelectionRange(len, len);
  },

  updateResultsOnly() {
    const infoEl = document.querySelector('.search-info');
    const resultsEl = document.querySelector('.search-results');
    const clearBtn = document.getElementById('search-clear');

    if (infoEl) {
      infoEl.innerHTML = this.keyword
        ? `找到 <strong>${this.results.length}</strong> 道相关题目`
        : '输入关键词开始搜索';
    }

    if (resultsEl) {
      resultsEl.innerHTML = this.results.length > 0
        ? this.results.map(q => this.renderResultItem(q)).join('')
        : (this.keyword ? '<div class="empty-state">没有找到相关题目</div>' : '');
    }

    if (clearBtn) {
      clearBtn.style.display = this.keyword ? '' : 'none';
    }
  },

  clearKeyword() {
    this.keyword = '';
    this.results = [];
    this.selectedId = null;
    this.renderCurrent();
  },

  doSearch() {
    const kw = this.keyword.trim().toLowerCase();
    if (!kw) {
      this.results = [];
      return;
    }

    this.results = QUESTION_DATA.questions.filter(q => {
      const content = q.content.toLowerCase();
      return content.includes(kw);
    }).slice(0, 200);
  },

  openDetail(id) {
    this.selectedId = id;
    this.renderCurrent();
    setTimeout(() => {
      const modal = document.getElementById('search-detail-modal');
      if (modal) {
        modal.classList.add('show');
      }
    }, 10);
  },

  closeDetail() {
    const modal = document.getElementById('search-detail-modal');
    if (modal) {
      modal.classList.remove('show');
    }
    setTimeout(() => {
      this.selectedId = null;
      this.renderCurrent();
    }, 250);
  },

  toggleFav(questionId) {
    Store.toggleFavorite(questionId);
    const q = QUESTION_DATA.questions.find(qx => qx.id === questionId);
    if (q) {
      this.openDetail(questionId);
    }
  },

  renderCurrent() {
    document.getElementById('app').innerHTML = this.renderPage();
    this.bindInputEvents();
  }
};
