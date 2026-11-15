#!/usr/bin/env bash
set -eu
# Run on the VPS: bash disable-yandex.sh <reviewed Git commit SHA>
mono_ref="${1:?Укажите полный SHA проверенного коммита}"
[[ "$mono_ref" =~ ^[0-9a-f]{40}$ ]] || { echo 'Нужен полный SHA коммита'; exit 1; }
cd /root/mono-server
mono_backup="/root/mono-without-yandex-$(date -u +%Y%m%d-%H%M%S)"
mkdir -m 700 "$mono_backup"
cp -p server.js .env "$mono_backup/"
mono_tmp="$(mktemp -d)"
trap 'rm -rf "$mono_tmp"' EXIT
curl --fail --silent --show-error --location "https://raw.githubusercontent.com/bigluvchase-wq/monotest1/$mono_ref/server/server.js" -o "$mono_tmp/server.js"
node --check "$mono_tmp/server.js"
node <<'JS'
const fs=require('fs');const source=fs.readFileSync('.env','utf8');const next=source.split(/\r?\n/).filter(line=>!/^\s*(?:export\s+)?(?:VOICE_AI_ENABLED|YANDEX_[A-Z0-9_]+)\s*=/.test(line)).join('\n').trimEnd()+'\nVOICE_AI_ENABLED=0\n';fs.writeFileSync('.env.without-yandex.tmp',next,{mode:0o600});fs.renameSync('.env.without-yandex.tmp','.env');
JS
cp "$mono_tmp/server.js" server.js
VOICE_AI_ENABLED=0 YANDEX_API_KEY='' YANDEX_FOLDER_ID='' YANDEX_MODEL_URI='' pm2 restart mono-pay --update-env
curl --fail --silent --show-error --retry 8 --retry-delay 1 https://api.monoapp.ru/api/voice/status
printf '\nРезервная копия конфигурации: %s\n' "$mono_backup"
