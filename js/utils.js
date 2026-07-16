// 工具函数
const Utils = {
  // 题型映射
  typeLabel(type) {
    return { single: '单选题', multi: '多选题', judge: '判断题' }[type] || type;
  },

  // 获取选项字母
  optionLabel(index) {
    return String.fromCharCode(65 + index);
  },

  // 随机打乱数组
  shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  },

  // 格式化时间 (秒 -> MM:SS)
  formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  },

  // 获取相对时间
  timeAgo(timestamp) {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}小时前`;
    const days = Math.floor(hours / 24);
    return `${days}天前`;
  },

  // 获取今日开始时间戳
  getTodayStart() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  },

  // 创建一个带安全HTML转义的渲染函数
  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  // 解析Markdown中的粗体和换行
  renderText(text) {
    if (!text) return '';
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  },

  // 导航
  navigate(path) {
    window.location.hash = path;
  },

  // ==================== 音效合成 (Web Audio API) ====================
  _audioCtx: null,

  // 初始化 AudioContext（必须在用户手势中调用一次）
  _initAudio() {
    if (this._audioCtx) return this._audioCtx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      const ctx = new AC();
      if (ctx.state === 'suspended') ctx.resume();
      this._audioCtx = ctx;
    } catch (e) {}
    return this._audioCtx;
  },

  // 播放单个音调
  _playTone(freq, startAt, duration, type = 'sine', volume = 0.3) {
    const ctx = this._audioCtx;
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime + startAt);
      gain.gain.setValueAtTime(0, ctx.currentTime + startAt);
      gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + startAt + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startAt + duration);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + startAt);
      osc.stop(ctx.currentTime + startAt + duration);
    } catch (e) {}
  },

  // 答对音效：上行三和弦 (C5 - E5 - G5)
  playCorrect() {
    [523.25, 659.25, 783.99].forEach((f, i) => this._playTone(f, i * 0.1, 0.25, 'sine', 0.25));
  },

  // 答错音效：下行二音 (E4 - C4)
  playWrong() {
    this._playTone(329.63, 0, 0.18, 'triangle', 0.25);
    this._playTone(261.63, 0.18, 0.3, 'triangle', 0.25);
  }
};