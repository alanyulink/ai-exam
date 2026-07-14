// 主应用 - 路由和渲染
const App = {
  init() {
    window.addEventListener('hashchange', () => this.route());
    this.route();
  },

  route() {
    const hash = window.location.hash.slice(1) || '/';
    this.renderPage(hash);
  },

  renderPage(path) {
    const app = document.getElementById('app');
    if (!app) return;

    // 解析路由
    const parts = path.split('/').filter(Boolean);

    if (path === '/' || path === '' || path === 'home') {
      app.innerHTML = HomePage.render();
    } else if (parts[0] === 'practice') {
      const type = parts[1] || 'single';
      app.innerHTML = PracticePage.render(type);
    } else if (parts[0] === 'exam') {
      if (parts.length === 1) {
        app.innerHTML = ExamListPage.render();
      } else if (parts.length === 2) {
        app.innerHTML = ExamRoomPage.render(parts[1]);
      } else if (parts.length === 3 && parts[2] === 'result') {
        app.innerHTML = ExamResultPage.render(parts[1]);
      }
    } else if (parts[0] === 'wrong') {
      app.innerHTML = WrongBookPage.render();
    } else {
      app.innerHTML = HomePage.render();
    }
  }
};

// 启动应用
document.addEventListener('DOMContentLoaded', () => App.init());