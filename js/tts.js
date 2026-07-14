// 语音合成服务
const TTS = {
  _audio: null,
  _isPlaying: false,
  _useWebSpeech: false,
  _checkedServer: false,
  _onDone: null,

  async _checkServer() {
    if (this._checkedServer) return;
    this._checkedServer = true;
    try {
      const resp = await fetch('/api/ping');
      if (resp.ok) {
        this._useWebSpeech = false;
      } else {
        throw new Error('server error');
      }
    } catch {
      this._useWebSpeech = true;
    }
  },

  stop() {
    if (this._audio) {
      this._audio.pause();
      this._audio.currentTime = 0;
      this._audio = null;
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    this._isPlaying = false;
    if (this._onDone) {
      this._onDone();
      this._onDone = null;
    }
  },

  isPlaying() {
    if (this._audio && !this._audio.paused) return true;
    if (window.speechSynthesis && window.speechSynthesis.speaking) return true;
    return false;
  },

  _speakAliyun(text) {
    return new Promise((resolve, reject) => {
      const url = `/api/tts?text=${encodeURIComponent(text)}`;
      this._audio = new Audio(url);
      this._audio.onended = () => {
        this._audio = null;
        this._isPlaying = false;
        resolve();
      };
      this._audio.onerror = (e) => {
        this._audio = null;
        this._isPlaying = false;
        reject(e);
      };
      this._audio.play().then(() => {
        this._isPlaying = true;
      }).catch(reject);
    });
  },

  _speakWebSpeech(text) {
    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-CN';
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.onstart = () => { this._isPlaying = true; };
      utterance.onend = () => { this._isPlaying = false; resolve(); };
      utterance.onerror = () => { this._isPlaying = false; resolve(); };
      window.speechSynthesis.speak(utterance);
    });
  },

  async speak(text) {
    if (!text || !text.trim()) return;
    this.stop();
    await this._checkServer();

    try {
      if (this._useWebSpeech) {
        await this._speakWebSpeech(text);
      } else {
        await this._speakAliyun(text);
      }
    } catch (e) {
      try {
        await this._speakWebSpeech(text);
      } catch (e2) {
      }
    }
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

  speakFeedback(isCorrect, type, answer) {
    if (isCorrect) {
      if (type === 'multi') {
        return this.speak('回答正确');
      } else {
        return this.speak(`回答正确。正确答案是${answer}`);
      }
    } else {
      return this.speak('回答错误');
    }
  }
};