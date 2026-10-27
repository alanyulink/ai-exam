#!/bin/bash
# 一键部署到阿里云服务器（https://www.beeol.cn/tools/ai-exam/）
set -euo pipefail

SERVER="root@47.93.237.222"
DEST="/var/www/sites/beeol.cn/tools/ai-exam/"
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"

echo "🚀 1/3 备份服务器旧版本..."
ssh "$SERVER" "tar czf /root/ai-exam-backup-$STAMP.tar.gz -C /var/www/sites/beeol.cn/tools ai-exam"

echo "🚀 2/3 同步 index.html / css / js 到 $SERVER:$DEST"
scp -r "$SRC/index.html" "$SRC/css" "$SRC/js" "$SERVER:$DEST"

echo "🔍 3/3 校验 md5..."
LOCAL_MD5=$(cd "$SRC" && md5 -q index.html css/style.css js/*.js js/pages/*.js | sort)
REMOTE_MD5=$(ssh "$SERVER" "cd $DEST && md5sum index.html css/style.css js/*.js js/pages/*.js | awk '{print \$1}' | sort")
if [ "$LOCAL_MD5" != "$REMOTE_MD5" ]; then
  echo "❌ 校验不一致，请检查服务器文件（备份：/root/ai-exam-backup-$STAMP.tar.gz）"
  exit 1
fi

echo "✅ 同步完成且校验一致：https://www.beeol.cn/tools/ai-exam/"
