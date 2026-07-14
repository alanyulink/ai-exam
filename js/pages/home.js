// 首页
const HomePage = {
  render() {
    const stats = Store.getStats();
    const favIds = Store.getFavorites();
    const favCount = favIds.length;
    const examRecords = Store.getExamRecords();
    const recentExams = examRecords.slice(0, 3);

    // 从题库数据动态计算
    const singleCount = QUESTION_DATA.questions.filter(q => q.type === 'single').length;
    const multiCount = QUESTION_DATA.questions.filter(q => q.type === 'multi').length;
    const judgeCount = QUESTION_DATA.questions.filter(q => q.type === 'judge').length;

    const accuracy = stats.totalAnswered > 0
      ? Math.round((stats.totalCorrect / stats.totalAnswered) * 100)
      : 0;

    return `
      <div class="page home-page">
        <header class="home-header">
          <div class="home-title-area">
            <h1>AI 考试</h1>
            <p class="home-subtitle">在线刷题 · 轻松备考</p>
          </div>
          <div class="streak-badge">
            <span class="streak-icon">🔥</span>
            <span class="streak-num">${stats.streakDays}</span>
            <span class="streak-label">天</span>
          </div>
        </header>

        <div class="stats-grid">
          <div class="stat-card stat-card-today">
            <div class="stat-icon">📝</div>
            <div class="stat-body">
              <span class="stat-value">${stats.todayAnswered}</span>
              <span class="stat-label">今日答题</span>
            </div>
          </div>
          <div class="stat-card stat-card-accuracy">
            <div class="stat-icon">🎯</div>
            <div class="stat-body">
              <span class="stat-value">${accuracy}%</span>
              <span class="stat-label">正确率</span>
            </div>
          </div>
          <div class="stat-card stat-card-total">
            <div class="stat-icon">📚</div>
            <div class="stat-body">
              <span class="stat-value">${stats.totalAnswered}</span>
              <span class="stat-label">总答题</span>
            </div>
          </div>
          <div class="stat-card stat-card-wrong">
            <div class="stat-icon">⭐</div>
            <div class="stat-body">
              <span class="stat-value">${favCount}</span>
              <span class="stat-label">已收藏</span>
            </div>
          </div>
        </div>

        <div class="action-grid">
          <button class="action-btn action-btn-practice" onclick="Utils.navigate('practice')">
            <span class="action-icon">✏️</span>
            <span class="action-title">刷题模式</span>
            <span class="action-desc">按题型分类练习，逐题作答</span>
          </button>
          <button class="action-btn action-btn-exam" onclick="Utils.navigate('exam')">
            <span class="action-icon">📋</span>
            <span class="action-title">模拟考试</span>
            <span class="action-desc">5套模拟卷，限时60分钟</span>
          </button>
          <button class="action-btn action-btn-wrong" onclick="Utils.navigate('wrong')">
            <span class="action-icon">📕</span>
            <span class="action-title">难题收藏</span>
            <span class="action-desc">针对性复习薄弱环节</span>
            ${favCount > 0 ? `<span class="action-badge">${favCount}</span>` : ''}
          </button>
        </div>

        ${recentExams.length > 0 ? `
        <div class="section">
          <h2 class="section-title">最近考试</h2>
          <div class="recent-exams">
            ${recentExams.map(e => {
              const exam = QUESTION_DATA.exams.find(ex => ex.id === e.examId);
              const passed = e.score >= (exam ? exam.pass_score : 72);
              return `
                <div class="exam-card-mini">
                  <div class="exam-card-mini-left">
                    <span class="exam-card-mini-name">${exam ? exam.name : '模拟考试'}</span>
                    <span class="exam-card-mini-time">${Utils.timeAgo(e.timestamp)}</span>
                  </div>
                  <div class="exam-card-mini-right ${passed ? 'passed' : 'failed'}">
                    <span class="exam-card-mini-score">${e.score}</span>
                    <span class="exam-card-mini-label">分</span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
        ` : ''}

        <div class="section">
          <h2 class="section-title">题库概况</h2>
          <div class="overview-cards">
            <div class="overview-item" onclick="Utils.navigate('practice/single')">
              <span class="overview-icon">🔵</span>
              <span class="overview-info">
                <span class="overview-num">${singleCount}</span>
                <span class="overview-label">单选题</span>
              </span>
            </div>
            <div class="overview-item" onclick="Utils.navigate('practice/multi')">
              <span class="overview-icon">🟢</span>
              <span class="overview-info">
                <span class="overview-num">${multiCount}</span>
                <span class="overview-label">多选题</span>
              </span>
            </div>
            <div class="overview-item" onclick="Utils.navigate('practice/judge')">
              <span class="overview-icon">🟠</span>
              <span class="overview-info">
                <span class="overview-num">${judgeCount}</span>
                <span class="overview-label">判断题</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    `;
  }
};