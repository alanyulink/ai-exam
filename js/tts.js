// 语音合成服务
// 优先使用阿里云 TTS（通过本地服务器代理），回退到浏览器 Web Speech API
const TTS = {
  _audio: null,
  _busy: false,
  _queue: [],
  _useWebSpeech: false,
  _checkedServer: false,

  async _checkServer() {
    if (this._checkedServer) return;
    this._checkedServer = true;
    try {
      const resp = await fetch('/api/ping');
      if (resp.ok) {
        this._useWebSpeech = false;
        console.log('[TTS] 使用阿里云语音引擎');
      } else {
        throw new Error('server error');
      }
    } catch {
      this._useWebSpeech = true;
      console.log('[TTS] 服务器不可用，回退到浏览器语音引擎');
    }
  },

  _stopAudio() {
    if (this._audio) {
      this._audio.pause();
      this._audio = null;
    }
    window.speechSynthesis && window.speechSynthesis.cancel();
  },

  _speakAliyun(text) {
    return new Promise((resolve, reject) => {
      const url = `/api/tts?text=${encodeURIComponent(text)}`;
      this._audio = new Audio(url);
      this._audio.onended = () => {
        this._audio = null;
        resolve();
      };
      this._audio.onerror = (e) => {
        this._audio = null;
        reject(e);
      };
      this._audio.play().catch(reject);
    });
  },

  _speakWebSpeech(text) {
    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-CN';
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.onend = resolve;
      utterance.onerror = resolve;
      window.speechSynthesis.speak(utterance);
    });
  },

  async speak(text) {
    if (!text || !text.trim()) return;
    await this._checkServer();

    // 停止当前播放
    this._stopAudio();

    try {
      if (this._useWebSpeech) {
        await this._speakWebSpeech(text);
      } else {
        await this._speakAliyun(text);
      }
    } catch (e) {
      console.warn('[TTS] 阿里云播放失败，回退到浏览器语音:', e.message);
      try {
        await this._speakWebSpeech(text);
      } catch (e2) {
        console.warn('[TTS] 浏览器语音也失败:', e2.message);
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

  speakFeedback(isCorrect, type, answer, questionContent) {
    if (isCorrect) {
      if (type === 'multi') {
        return this.speak('回答正确');
      } else {
        const answerLabel = questionContent ? `回答正确。正确答案是${answer}` : '回答正确';
        return this.speak(answerLabel);
      }
    } else {
      return this.speak('回答错误');
    }
  }
};