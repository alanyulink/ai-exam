// 难题收藏
const WrongBookPage = {
  render() {
    const favIds = Store.getFavorites();
    const questions = QUESTION_DATA.questions.filter(q => favIds.includes(q.id));

    // 按题型统计
    const typeCount = { single: 0, multi: 0, judge: 0 };
    questions.forEach(q => { typeCount[q.type] = (typeCount[q.type] || 0) + 1; });

    const total = questions.length;

    if (total === 0) {
      return `
        <div class="page wrong-book-page">
          <header class="page-header">
            <button class="back-btn" onclick="Utils.navigate('')">← 返回</button>
            <h1>难题收藏</h1>
          </header>
          <div class="empty-state">
            <div class="empty-icon">🎉</div>
            <p>暂无收藏的难题，继续加油！</p>
          </div>
        </div>
      `;
    }

    return `
      <div class="page wrong-book-page">
        <header class="page-header">
          <button class="back-btn" onclick="Utils.navigate('')">← 返回</button>
          <h1>难题收藏</h1>
          <span class="header-count">${total}题</span>
        </header>

        <div class="wrong-stats">
          ${Object.entries(typeCount).filter(([_, c]) => c > 0).map(([type, count]) => `
            <div class="wrong-stat-chip">
              <span class="wrong-stat-label">${Utils.typeLabel(type)}</span>
              <span class="wrong-stat-num">${count}</span>
            </div>
          `).join('')}
        </div>

        <div class="wrong-actions">
          <button class="wrong-action-btn" onclick="WrongBookPage.startReview()">
            📖 开始复习
          </button>
          <button class="wrong-action-btn secondary" onclick="WrongBookPage.clearAllFav()">
            🗑 清空收藏
          </button>
        </div>

        <div class="wrong-list">
          ${questions.sort((a, b) => favIds.indexOf(a.id) - favIds.indexOf(b.id)).map(q => {
            return `
              <div class="wrong-item" onclick="WrongBookPage.showQuestion(${q.id})">
                <div class="wrong-item-top">
                  <span class="question-type-badge small">${Utils.typeLabel(q.type)}</span>
                  <span class="wrong-time">收藏于收藏夹</span>
                </div>
                <div class="wrong-item-content">${Utils.escapeHtml(q.content.substring(0, 60))}${q.content.length > 60 ? '...' : ''}</div>
                <div class="wrong-item-answer">
                  正确答案：<span class="correct-answer">${q.answer}</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  },

  startReview() {
    const favIds = Store.getFavorites();
    if (favIds.length === 0) return;

    const first = favIds[0];
    const q = QUESTION_DATA.questions.find(q => q.id === first);
    if (q) {
      Utils.navigate(`practice/${q.type}`);
    }
  },

  clearAllFav() {
    if (confirm('确定要清空所有收藏的难题吗？此操作不可恢复。')) {
      Store.clearFavorites();
      App.renderPage('wrong');
    }
  },

  showQuestion(questionId) {
    const q = QUESTION_DATA.questions.find(q => q.id === questionId);
    if (!q) return;

    const isFaved = Store.isFavorite(questionId);

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <span class="question-type-badge">${Utils.typeLabel(q.type)}</span>
          <span class="question-number">#${q.id}</span>
          <span class="tts-btn" onclick="WrongBookPage.speakCurrentQuestion(${questionId})" title="朗读题目">🔊</span>
          <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
        <div class="modal-body">
          <div class="question-content">${Utils.escapeHtml(q.content)}</div>
          <div class="options-list">
            ${q.options.map(opt => {
              const isCorrectOpt = q.answer.includes(opt.label);
              return `
                <div class="option-item ${isCorrectOpt ? 'correct' : ''}">
                  <span class="option-marker">${opt.label}</span>
                  <span class="option-text">${Utils.escapeHtml(opt.content)}</span>
                  ${isCorrectOpt ? '<span class="option-check">✓</span>' : ''}
                </div>
              `;
            }).join('')}
          </div>
          <div class="wrong-meta">
            <span>${isFaved ? '⭐ 已收藏' : '☆ 未收藏'}</span>
          </div>
          ${q.explanation ? `
            <div class="explanation-panel correct">
              <div class="explanation-header">
                📖 知识讲解
                <span class="tts-btn tts-btn-explanation" onclick="WrongBookPage.speakCurrentExplanation(${questionId})" title="朗读解析">🔊</span>
              </div>
              <div class="explanation-body">${Utils.renderText(q.explanation)}</div>
            </div>
          ` : ''}
          <div class="wrong-modal-actions">
            <button class="wrong-action-btn" onclick="WrongBookPage.removeFromFav(${questionId})">${isFaved ? '💔 取消收藏' : '⭐ 收藏此题'}</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  },

  removeFromFav(questionId) {
    Store.toggleFavorite(questionId);
    document.querySelector('.modal-overlay')?.remove();
    App.renderPage('wrong');
  },

  speakCurrentQuestion(questionId) {
    const q = QUESTION_DATA.questions.find(q => q.id === questionId);
    if (q) TTS.speakQuestion(q);
  },

  speakCurrentExplanation(questionId) {
    const q = QUESTION_DATA.questions.find(q => q.id === questionId);
    if (q && q.explanation) TTS.speakExplanation(q.explanation);
  }
};