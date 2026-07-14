// 语音合成服务 - 纯浏览器端，不需要服务器
const TTS = {
  _voice: null,
  _isPlaying: false,

  _getVoice() {
    if (this._voice) return this._voice;
    const voices = window.speechSynthesis.getVoices();
    // 按优先顺序找中文女声
    const preferred = [
      'Ting-Ting',       // macOS 高品质中文女声
      'Mei-Jia',         // macOS 中文女声
      'Microsoft Yaoyao',// Edge 中文女声
      'Microsoft Xiaoxiao', // Edge 中文女声
      'Microsoft Kangkang', // Edge 中文男声
      'Google 普通话',   // Chrome 中文
      'zh-CN'            // 默认中文
    ];
    for (const name of preferred) {
      const found = voices.find(v => v.name.includes(name) || v.name === name);
      if (found) { this._voice = found; return found; }
    }
    this._voice = voices.find(v => v.lang.startsWith('zh')) || voices[0] || null;
    return this._voice;
  },

  stop() {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    this._isPlaying = false;
  },

  isPlaying() {
    if (window.speechSynthesis && window.speechSynthesis.speaking) return true;
    return false;
  },

  speak(text) {
    if (!text || !text.trim()) return Promise.resolve();
    this.stop();

    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-CN';
      utterance.rate = 0.95;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      const voice = this._getVoice();
      if (voice) utterance.voice = voice;

      utterance.onstart = () => { this._isPlaying = true; };
      utterance.onend = () => { this._isPlaying = false; resolve(); };
      utterance.onerror = () => { this._isPlaying = false; resolve(); };

      window.speechSynthesis.speak(utterance);
    });
  },

  speakQuestion(q) {
    const typeLabel = q.type === 'single' ? '单选题' : q.type === 'multi' ? '多选题' : '判断题';
    const optionsText = q.options.map(o => `${o.label}. ${o.content}`).join('，');
    const text = `${typeLabel}：${q.content}。选项：${optionsText}`;
    return this.speak(text);
  },

  speakExplanation(text) {
    if (!text) return Promise.resolve();
    return this.speak(text);
  },

  speakFeedback(isCorrect, type, answer, options) {
    if (isCorrect) {
      if (type === 'multi') {
        return this.speak('回答正确');
      } else {
        const label = answer;
        const opt = options ? options.find(o => o.label === label) : null;
        const content = opt ? opt.content : '';
        const text = content ? `回答正确。正确答案是${label} ${content}` : `回答正确。正确答案是${label}`;
        return this.speak(text);
      }
    } else {
      return this.speak('回答错误');
    }
  }
};

// 预加载语音列表
if (window.speechSynthesis) {
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => { TTS._voice = null; };
}