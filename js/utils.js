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

  // ==================== 音效合成 (WAV + Audio 元素) ====================
  _genWav(freqs, durs) {
    const sr = 8000;
    let totalSamples = 0;
    freqs.forEach((f, i) => { totalSamples += Math.ceil(sr * durs[i]); });
    const buf = new ArrayBuffer(44 + totalSamples * 2);
    const dv = new DataView(buf);
    const write16 = (o, v) => { dv.setUint8(o, v & 0xff); dv.setUint8(o + 1, (v >> 8) & 0xff); };
    const write32 = (o, v) => { dv.setUint32(o, v, true); };
    write32(0, 0x46464952); write32(4, 36 + totalSamples * 2);
    write32(8, 0x45564157); write32(12, 0x20746d66);
    write32(16, 16); write16(20, 1); write16(22, 1);
    write32(24, sr); write32(28, sr * 2); write16(32, 2); write16(34, 16);
    write32(36, 0x61746164); write32(40, totalSamples * 2);
    let offset = 44;
    freqs.forEach((f, i) => {
      const n = Math.ceil(sr * durs[i]);
      const env = 0.03;
      for (let s = 0; s < n; s++) {
        const t = s / sr;
        let amp = 1;
        if (t < env) amp = t / env;
        if (t > durs[i] - env) amp = Math.max(0, (durs[i] - t) / env);
        const val = Math.sin(2 * Math.PI * f * t) * amp * 6000;
        write16(offset, Math.max(-32768, Math.min(32767, Math.round(val))));
        offset += 2;
      }
    });
    return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
  },

  _correctUrl: null,
  _wrongUrl: null,

  _playUrl(url) {
    try { new Audio(url).play(); } catch (e) {}
  },

  playCorrect() {
    if (!this._correctUrl) {
      this._correctUrl = this._genWav([523.25, 659.25, 783.99], [0.15, 0.15, 0.25]);
    }
    this._playUrl(this._correctUrl);
  },

  playWrong() {
    if (!this._wrongUrl) {
      this._wrongUrl = this._genWav([349.23, 293.66, 261.63], [0.15, 0.15, 0.25]);
    }
    this._playUrl(this._wrongUrl);
  }
};