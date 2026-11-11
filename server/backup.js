// Резервная копия базы: node backup.js
// Кладёт копию в папку backups рядом с сервером и хранит последние 14 копий.
// Запускается каждый день планировщиком (cron), см. инструкцию по установке.
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });
const Database = require('better-sqlite3');
const db = new Database(process.env.DB_PATH || path.join(__dirname, 'mono.db'), { readonly: true });
const dir = path.join(__dirname, 'backups');
fs.mkdirSync(dir, { recursive: true });
const name = path.join(dir, 'mono-' + new Date().toISOString().slice(0, 10) + '.db');
db.backup(name).then(() => {
    const files = fs.readdirSync(dir).filter(f => /^mono-\d{4}-\d{2}-\d{2}\.db$/.test(f)).sort();
    for (const f of files.slice(0, Math.max(0, files.length - 14))) fs.unlinkSync(path.join(dir, f));
    console.log('Копия сохранена:', name);
}).catch(e => { console.error('Ошибка резервной копии:', e.message); process.exit(1); });
