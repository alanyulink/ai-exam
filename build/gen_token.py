#!/usr/bin/env python3
"""构建时生成阿里云 TTS Token，注入到指定目录的 js/tts.js"""

import os, sys, json, time, hmac, hashlib, base64, urllib.parse, urllib.request, re

output_dir = '.'
if '--output-dir' in sys.argv:
    idx = sys.argv.index('--output-dir')
    if idx + 1 < len(sys.argv):
        output_dir = sys.argv[idx + 1]

access_key_id = os.environ.get('ALIYUN_ACCESS_KEY_ID')
access_key_secret = os.environ.get('ALIYUN_ACCESS_KEY_SECRET')
app_key = os.environ.get('ALIYUN_APP_KEY', '0Qst0bt7uqmXz9yV')
voice = os.environ.get('ALIYUN_TTS_VOICE', 'ruoxi')

if not access_key_id or not access_key_secret:
    print("ERROR: ALIYUN_ACCESS_KEY_ID and ALIYUN_ACCESS_KEY_SECRET must be set")
    sys.exit(1)


def percent_encode(s):
    s = urllib.parse.quote(str(s), safe='')
    for a, b in (('!', '%21'), ("'", '%27'), ('(', '%28'), (')', '%29'), ('*', '%2A')):
        s = s.replace(a, b)
    return s


params = {
    "AccessKeyId": access_key_id,
    "Action": "CreateToken",
    "Format": "JSON",
    "SignatureMethod": "HMAC-SHA1",
    "SignatureNonce": str(int(time.time() * 1000)) + str(os.getpid()),
    "SignatureVersion": "1.0",
    "Timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    "Version": "2019-02-28"
}

keys = sorted(params.keys())
canonical_qs = '&'.join(f"{percent_encode(k)}={percent_encode(params[k])}" for k in keys)
string_to_sign = f"GET&{percent_encode('/')}&{percent_encode(canonical_qs)}"
key = (access_key_secret + "&").encode('utf-8')
signature = base64.b64encode(
    hmac.new(key, string_to_sign.encode('utf-8'), hashlib.sha1).digest()
).decode()
params["Signature"] = signature

query_str = urllib.parse.urlencode(params, safe='')
url = f"https://nls-meta.cn-shanghai.aliyuncs.com/?{query_str}"

req = urllib.request.Request(url)
with urllib.request.urlopen(req, timeout=15) as resp:
    data = json.loads(resp.read().decode('utf-8'))

token = data['Token']['Id']
expire_seconds = int(data['Token'].get('ExpireTime', 3600))

# 注入到指定目录的 js/tts.js
tts_path = os.path.join(output_dir, 'js', 'tts.js')
with open(tts_path, 'r') as f:
    content = f.read()

content = re.sub(
    r'__token: null',
    f"__token: '{token}'",
    content
)

with open(tts_path, 'w') as f:
    f.write(content)

print(f"OK token={token[:8]}... injected into {tts_path}, expires_in={expire_seconds}s")
