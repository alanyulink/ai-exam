// 本地存储管理
const Store = {
  _prefix: 'aiexam_',

  get(key, defaultValue = null) {
    try {
      const val = localStorage.getItem(this._prefix + key);
      return val ? JSON.parse(val) : defaultValue;
    } catch { return defaultValue; }
  },

  set(key, value) {
    localStorage.setItem(this._prefix + key, JSON.stringify(value));
  },

  // 学习统计
  getStats() {
    return this.get('stats', {
      totalAnswered: 0,
      totalCorrect: 0,
      todayAnswered: 0,
      todayCorrect: 0,
      streakDays: 0,
      lastStudyDate: '',
      totalExams: 0,
      passedExams: 0
    });
  },

  updateStats(updates) {
    const stats = this.getStats();
    const today = new Date().toDateString();

    if (updates.todayAnswered > 0) {
      if (stats.lastStudyDate !== today) {
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        if (stats.lastStudyDate === yesterday) {
          stats.streakDays += 1;
        } else if (stats.lastStudyDate !== today) {
          stats.streakDays = 1;
        }
        stats.lastStudyDate = today;
      }
      stats.todayAnswered = (stats.todayAnswered || 0) + (updates.todayAnswered || 0);
      stats.todayCorrect = (stats.todayCorrect || 0) + (updates.todayCorrect || 0);
    }

    if (updates.totalAnswered) stats.totalAnswered += updates.totalAnswered;
    if (updates.totalCorrect) stats.totalCorrect += updates.totalCorrect;
    if (updates.totalExams) stats.totalExams += updates.totalExams;
    if (updates.passedExams) stats.passedExams += updates.passedExams;

    this.set('stats', stats);
    return stats;
  },

  // 错题本（废弃，保留兼容）
  getWrongQuestions() {
    return this.get('wrongQuestions', {});
  },

  addWrongQuestion(questionId, userAnswer, isCorrect) {
    if (isCorrect) return;
    const wrong = this.getWrongQuestions();
    if (!wrong[questionId]) {
      wrong[questionId] = { questionId, wrongCount: 0, lastWrongTime: Date.now() };
    }
    wrong[questionId].wrongCount += 1;
    wrong[questionId].lastWrongTime = Date.now();
    this.set('wrongQuestions', wrong);
  },

  removeWrongQuestion(questionId) {
    const wrong = this.getWrongQuestions();
    delete wrong[questionId];
    this.set('wrongQuestions', wrong);
  },

  clearAllWrong() {
    this.set('wrongQuestions', {});
  },

  // 收藏
  getFavorites() {
    return this.get('favorites', []);
  },

  toggleFavorite(questionId) {
    const favs = this.getFavorites();
    const idx = favs.indexOf(questionId);
    if (idx !== -1) {
      favs.splice(idx, 1);
      this.set('favorites', favs);
      return false;
    } else {
      favs.push(questionId);
      this.set('favorites', favs);
      return true;
    }
  },

  isFavorite(questionId) {
    return this.getFavorites().includes(questionId);
  },

  clearFavorites() {
    this.set('favorites', []);
  },

  // 考试草稿（保存进度）
  getExamDraft(examId) {
    const drafts = this.get('examDrafts', {});
    return drafts[examId] || null;
  },

  saveExamDraft(examId, draft) {
    const drafts = this.get('examDrafts', {});
    drafts[examId] = draft;
    this.set('examDrafts', drafts);
  },

  removeExamDraft(examId) {
    const drafts = this.get('examDrafts', {});
    delete drafts[examId];
    this.set('examDrafts', drafts);
  },

  // 考试记录
  getExamRecords() {
    return this.get('examRecords', []);
  },

  addExamRecord(record) {
    const records = this.getExamRecords();
    records.unshift(record);
    if (records.length > 50) records.pop();
    this.set('examRecords', records);
  }
};