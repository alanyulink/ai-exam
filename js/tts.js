const TTS = {
  _audio: null,
  _isPlaying: false,
  _ws: null,
  _audioBuffer: null,
  _audioContext: null,
  _sourceNode: null,

  _cfg: (() => {
    const d = s => atob(s);
    return {
      accessKeyId: d('TFRBSTV0Nmh2SEFKeGRvTk5oYzExQ0RR'),
      accessKeySecret: d('dGlRUU9mVzJpa3V5Tm9CQ0VNTTVjTXpUSmJlOGJj'),
      appKey: d('MFFzdDBidDd1cW1Yejl5Vg=='),
      voice: 'ruoxi',
    };
  })(),

  async _hmacSha1(message, secret) {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', encoder.encode(secret + '&'),
      { name: 'HMAC', hash: 'SHA-1' },
      false, ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
    return btoa(String.fromCharCode(...new Uint8Array(sig)));
  },

  _percentEncode(s) {
    return encodeURIComponent(s)
      .replace(/!/g, '%21').replace(/'/g, '%27')
      .replace(/\(/g, '%28').replace(/\)/g, '%29')
      .replace(/\*/g, '%2A');
  },

  async _getAliyunToken() {
    const cfg = this._cfg;
    const params = {
      AccessKeyId: cfg.accessKeyId,
      Action: 'CreateToken',
      Format: 'JSON',
      SignatureMethod: 'HMAC-SHA1',
      SignatureNonce: '' + Date.now() + Math.random(),
      SignatureVersion: '1.0',
      Timestamp: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
      Version: '2019-02-28'
    };

    const keys = Object.keys(params).sort();
    const qs = keys.map(k => this._percentEncode(k) + '=' + this._percentEncode(params[k])).join('&');
    const stringToSign = 'GET&' + this._percentEncode('/') + '&' + this._percentEncode(qs);
    const signature = await this._hmacSha1(stringToSign, cfg.accessKeySecret);
    params.Signature = signature;

    const url = 'https://nls-meta.cn-shanghai.aliyuncs.com/?' +
      keys.map(k => encodeURIComponent(k) + '=' + encodeURIComponent(params[k])).join('&');

    const resp = await fetch(url);
    const data = await resp.json();
    return data.Token.Id;
  },

  _generateId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  },

  async _speakWebSocket(text) {
    const cfg = this._cfg;
    const token = await this._getAliyunToken();
    const taskId = this._generateId();
    const messageId = this._generateId();

    return new Promise((resolve, reject) => {
      const url = 'wss://nls-gateway-cn-shanghai.aliyuncs.com/ws/v1';
      const ws = new WebSocket(url);
      ws.binaryType = 'arraybuffer';
      this._ws = ws;

      let audioChunks = [];
      let receivedAudio = false;

      ws.onopen = () => {
        ws.send(JSON.stringify({
          header: {
            message_id: messageId,
            task_id: taskId,
            namespace: 'FlowingSpeechSynthesizer',
            name: 'StartSynthesis',
            appkey: cfg.appKey
          },
          payload: {
            voice: cfg.voice,
            format: 'mp3',
            sample_rate: 24000,
            volume: 50,
            speech_rate: 0,
            pitch_rate: 0
          }
        }));
      };

      ws.onmessage = (event) => {
        if (typeof event.data === 'string') {
          const msg = JSON.parse(event.data);
          const name = msg.header?.name;
          if (name === 'SynthesisStarted') {
            ws.send(JSON.stringify({
              header: {
                message_id: this._generateId(),
                task_id: taskId,
                namespace: 'FlowingSpeechSynthesizer',
                name: 'RunSynthesis',
                appkey: cfg.appKey
              },
              payload: { text: text }
            }));
          } else if (name === 'SynthesisCompleted') {
            ws.close();
          } else if (msg.header?.status && msg.header.status !== 20000000) {
            ws.close();
            reject(new Error('TTS error: ' + msg.header.status_message));
          }
        } else if (event.data instanceof ArrayBuffer) {
          receivedAudio = true;
          audioChunks.push(new Uint8Array(event.data));
        }
      };

      ws.onclose = () => {
        this._ws = null;
        if (receivedAudio && audioChunks.length > 0) {
          const totalLength = audioChunks.reduce((sum, chunk) => sum + chunk.length, 0);
          const merged = new Uint8Array(totalLength);
          let offset = 0;
          for (const chunk of audioChunks) {
            merged.set(chunk, offset);
            offset += chunk.length;
          }
          const blob = new Blob([merged], { type: 'audio/mp3' });
          resolve(blob);
        } else {
          reject(new Error('No audio received'));
        }
      };

      ws.onerror = () => {
        this._ws = null;
        reject(new Error('WebSocket error'));
      };
    });
  },

  async _speakAliyun(text) {
    const cfg = this._cfg;
    const token = await this._getAliyunToken();

    const body = JSON.stringify({
      appkey: cfg.appKey,
      text: text,
      format: 'mp3',
      sample_rate: 24000,
      voice: cfg.voice,
      volume: 50,
      speech_rate: 0,
      pitch_rate: 0
    });

    const resp = await fetch('https://nls-gateway.cn-shanghai.aliyuncs.com/stream/v1/tts?token=' + token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body
    });

    if (!resp.ok) throw new Error('TTS ' + resp.status);
    const blob = await resp.blob();
    return blob;
  },

  _speakWebSpeech(text) {
    return new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'zh-CN';
      u.rate = 0.95;
      u.pitch = 1.0;

      const voices = window.speechSynthesis.getVoices();
      const v = voices.find(v => v.lang.startsWith('zh') && v.name.includes('Ting-Ting'))
        || voices.find(v => v.lang.startsWith('zh') && v.name.includes('Xiaoxiao'))
        || voices.find(v => v.lang.startsWith('zh'));
      if (v) u.voice = v;

      u.onstart = () => { this._isPlaying = true; };
      u.onend = () => { this._isPlaying = false; resolve(); };
      u.onerror = () => { this._isPlaying = false; resolve(); };
      window.speechSynthesis.speak(u);
    });
  },

  stop() {
    if (this._audio) { this._audio.pause(); this._audio = null; }
    if (this._ws) { this._ws.close(); this._ws = null; }
    if (this._sourceNode) { this._sourceNode.stop(); this._sourceNode = null; }
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    this._isPlaying = false;
    this._audioBuffer = null;
  },

  isPlaying() {
    if (this._audio && !this._audio.paused) return true;
    if (this._ws) return true;
    if (window.speechSynthesis && window.speechSynthesis.speaking) return true;
    return false;
  },

  async speak(text) {
    if (!text || !text.trim()) return;
    this.stop();
    this._isPlaying = true;

    try {
      const resp = await fetch('/api/tts?text=' + encodeURIComponent(text));
      if (resp.ok) {
        const blob = await resp.blob();
        return this._playBlob(blob);
      }
    } catch (e) {}

    try {
      const blob = await this._speakWebSocket(text);
      return this._playBlob(blob);
    } catch (e) {}

    try {
      const blob = await this._speakAliyun(text);
      return this._playBlob(blob);
    } catch (e) {}

    await this._speakWebSpeech(text);
    this._isPlaying = false;
  },

  _playBlob(blob) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(blob);
      this._audio = new Audio(url);
      this._audio.onended = () => {
        URL.revokeObjectURL(url);
        this._audio = null;
        this._isPlaying = false;
        resolve();
      };
      this._audio.onerror = () => {
        URL.revokeObjectURL(url);
        this._audio = null;
        this._isPlaying = false;
        resolve();
      };
      this._audio.play();
    });
  },

  speakQuestion(q) {
    const t = q.type === 'single' ? '单选题' : q.type === 'multi' ? '多选题' : '判断题';
    return this.speak(`${t}：${q.content}。${q.options.map(o => `${o.label}. ${o.content}`).join('，')}`);
  },

  speakExplanation(text) {
    return text ? this.speak(text) : Promise.resolve();
  },

  speakFeedback(isCorrect, type, answer, options) {
    if (!isCorrect) return this.speak('回答错误');
    if (type === 'multi') return this.speak('回答正确');
    const opt = options ? options.find(o => o.label === answer) : null;
    return this.speak(opt ? `回答正确。正确答案是${answer} ${opt.content}` : `回答正确。正确答案是${answer}`);
  }
};

if (window.speechSynthesis) {
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => {};
}