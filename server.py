#!/usr/bin/env python3
"""AI考试系统服务器 - 静态文件 + TTS 语音合成代理"""

import os
import json
import time
import hmac
import hashlib
import base64
import urllib.parse
import urllib.request
import socketserver
from http.server import HTTPServer, SimpleHTTPRequestHandler

# ==================== 阿里云 TTS 配置 ====================
# 从环境变量读取，由 start.sh 设置
TTS_CONFIG = {
    "access_key_id": os.environ.get("ALIYUN_ACCESS_KEY_ID", ""),
    "access_key_secret": os.environ.get("ALIYUN_ACCESS_KEY_SECRET", ""),
    "app_key": os.environ.get("ALIYUN_APP_KEY", ""),
    "voice": os.environ.get("ALIYUN_TTS_VOICE", "知米_多情感"),
    "format": "mp3",
    "sample_rate": int(os.environ.get("ALIYUN_TTS_SAMPLE_RATE", "24000")),
    "volume": int(os.environ.get("ALIYUN_TTS_VOLUME", "50")),
    "speech_rate": int(os.environ.get("ALIYUN_TTS_SPEECH_RATE", "0")),
    "pitch_rate": int(os.environ.get("ALIYUN_TTS_PITCH_RATE", "0"))
}

token_cache = {"token": None, "expire_time": 0}


def percent_encode(s):
    """阿里云签名专用 percent encode"""
    s = urllib.parse.quote(str(s), safe='')
    # 阿里云规范：空格编码为 %20（quote默认是 %20）
    # 额外替换：! ' ( ) *
    for a, b in (('!', '%21'), ("'", '%27'), ('(', '%28'), (')', '%29'), ('*', '%2A')):
        s = s.replace(a, b)
    return s


def build_canonical_query(params):
    """对参数排序并构建规范查询字符串"""
    keys = sorted(params.keys())
    return '&'.join(f"{percent_encode(k)}={percent_encode(params[k])}" for k in keys)


def get_tts_token():
    """获取阿里云 NLS Token（带缓存）"""
    now = time.time()
    if token_cache["token"] and now < token_cache["expire_time"]:
        return token_cache["token"]

    cfg = TTS_CONFIG
    params = {
        "AccessKeyId": cfg["access_key_id"],
        "Action": "CreateToken",
        "Format": "JSON",
        "SignatureMethod": "HMAC-SHA1",
        "SignatureNonce": str(int(time.time() * 1000)) + str(os.getpid()),
        "SignatureVersion": "1.0",
        "Timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "Version": "2019-02-28"
    }

    # 计算签名
    canonical_query = build_canonical_query(params)
    string_to_sign = f"GET&{percent_encode('/')}&{percent_encode(canonical_query)}"
    key = (cfg["access_key_secret"] + "&").encode('utf-8')
    signature = base64.b64encode(
        hmac.new(key, string_to_sign.encode('utf-8'), hashlib.sha1).digest()
    ).decode('utf-8')
    params["Signature"] = signature

    # 发送请求
    query_str = urllib.parse.urlencode(params, safe='')
    url = f"https://nls-meta.cn-shanghai.aliyuncs.com/?{query_str}"

    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read().decode('utf-8'))

    if "Token" in data and "Id" in data["Token"]:
        token_cache["token"] = data["Token"]["Id"]
        expire_seconds = int(data["Token"].get("ExpireTime", 3600))
        token_cache["expire_time"] = now + expire_seconds - 60  # 提前1分钟刷新
        print(f"[TTS] Token 已刷新，有效期 {expire_seconds} 秒")
        return token_cache["token"]
    else:
        raise Exception(f"获取Token失败: {data}")


def call_tts(text):
    """调用阿里云 TTS REST API，返回音频二进制数据"""
    cfg = TTS_CONFIG
    token = get_tts_token()

    body = json.dumps({
        "appkey": cfg["app_key"],
        "text": text,
        "format": cfg["format"],
        "sample_rate": cfg["sample_rate"],
        "voice": cfg["voice"],
        "volume": cfg["volume"],
        "speech_rate": cfg["speech_rate"],
        "pitch_rate": cfg["pitch_rate"]
    }, ensure_ascii=False).encode('utf-8')

    url = f"https://nls-gateway.cn-shanghai.aliyuncs.com/stream/v1/tts?token={token}"
    req = urllib.request.Request(url, data=body, method='POST')
    req.add_header("Content-Type", "application/json")

    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read()


# ==================== HTTP 服务器 ====================

class ExamHandler(SimpleHTTPRequestHandler):
    """自定义 HTTP 处理器"""

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        # API: TTS 语音合成
        if path == '/api/tts':
            self._handle_tts(query)
            return

        # API: 健康检查
        if path == '/api/ping':
            self._send_json({"ok": True, "time": int(time.time() * 1000)})
            return

        # 静态文件
        return super().do_GET()

    def _handle_tts(self, query):
        text = (query.get('text') or [None])[0]
        if not text or not text.strip():
            self._send_json({"error": "缺少 text 参数"}, 400)
            return
        if len(text) > 500:
            self._send_json({"error": "文本过长，请控制在500字以内"}, 400)
            return

        try:
            audio_data = call_tts(text.strip())
            self.send_response(200)
            self.send_header('Content-Type', 'audio/mpeg')
            self.send_header('Content-Length', str(len(audio_data)))
            self.send_header('Cache-Control', 'public, max-age=3600')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(audio_data)
        except Exception as e:
            print(f"[TTS] 错误: {e}")
            self._send_json({"error": "语音合成失败", "detail": str(e)}, 500)

    def _send_json(self, obj, status=200):
        data = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, format, *args):
        try:
            print(f"[{self.log_date_time_string()}] {args[0]} {args[1]} {args[2]}")
        except Exception:
            print(f"[{self.log_date_time_string()}] {' '.join(str(a) for a in args)}")


# ==================== 启动 ====================
if __name__ == '__main__':
    PORT = int(os.environ.get('PORT', 8000))
    server = HTTPServer(('0.0.0.0', PORT), ExamHandler)
    print(f"✅ AI考试系统已启动")
    print(f"   本地访问: http://localhost:{PORT}")
    print(f"   服务器类型: Python TTS 代理")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n服务已停止")
        server.server_close()
