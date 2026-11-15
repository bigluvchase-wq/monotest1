#!/usr/bin/env bash
set -eu
mono_ref="${1:?Укажите полный SHA проверенного коммита}"
[[ "$mono_ref" =~ ^[0-9a-f]{40}$ ]] || exit 1
cd /root/mono-server
mono_backup="/root/mono-before-together-$(date -u +%Y%m%d-%H%M%S)"
mkdir -m 700 "$mono_backup"
for file in server.js shared-accounts.js engine.js schedule.js speech-dates.js speech-categories.js bank-merchants.js shared-data.js; do
 if [ -f "$file" ]; then cp -p "$file" "$mono_backup/"; fi
done
node backup.js
mono_stage="$(mktemp -d)"
trap 'rm -rf "$mono_stage"' EXIT
mono_source="https://raw.githubusercontent.com/bigluvchase-wq/monotest1/$mono_ref"
for file in server.js shared-accounts.js; do
 curl -fsSL "$mono_source/server/$file" -o "$mono_stage/$file"
 node --check "$mono_stage/$file"
done
for file in engine.js schedule.js speech-dates.js speech-categories.js bank-merchants.js shared-data.js; do
 curl -fsSL "$mono_source/Mono/Web/$file" -o "$mono_stage/$file"
 node --check "$mono_stage/$file"
done
node - "$mono_stage/engine.js" <<'JS'
const E=require(process.argv[2]);if(!E.validateState(E.initialState()))throw Error('Проверка движка не пройдена');
JS
cp "$mono_stage/"*.js /root/mono-server/
pm2 restart mono-pay --update-env
curl -fsS --retry 8 --retry-delay 1 https://api.monoapp.ru/api/voice/status
mono_status="$(curl -sS -o /dev/null -w '%{http_code}' -H 'Content-Type: application/json' -d '{}' https://api.monoapp.ru/api/together/status)"
[[ "$mono_status" == 400 ]] || { printf '\nПроверка совместного API не пройдена: HTTP %s\n' "$mono_status"; exit 1; }
printf '\nСовместный API установлен. Резервная копия файлов: %s\n' "$mono_backup"
