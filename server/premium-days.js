// Добавить или убрать дни Премиума пользователю по коду привязки.
// Запуск в папке сервера:
//   node premium-days.js 350835 +7     — добавить 7 дней
//   node premium-days.js 350835 -3     — убрать 3 дня
//   node premium-days.js 350835 off    — выключить Премиум
//   node premium-days.js 350835        — просто показать текущий срок
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });
const Database = require('better-sqlite3');
const db = new Database(process.env.DB_PATH || path.join(__dirname, 'mono.db'));
const DAY = 24 * 60 * 60 * 1000;
const fmt = iso => iso ? new Date(iso).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', dateStyle: 'long', timeStyle: 'short' }) + ' (МСК)' : '—';

const code = String(process.argv[2] || '').replace(/\D/g, '');
const change = String(process.argv[3] || '').trim();
if (code.length !== 6) { console.log('Укажите код из 6 цифр: node premium-days.js 350835 +7'); process.exit(1); }

let user = db.prepare('SELECT * FROM users WHERE code = ?').get(code);
if (!user) {
    // код ещё не регистрировался на этом сервере — создаём запись, чтобы можно было начислить дни
    if (!change || change === 'off') { console.log(`Пользователь с кодом ${code} не найден.`); process.exit(1); }
    db.prepare('INSERT INTO users (code, created_at) VALUES (?, ?)').run(code, new Date().toISOString());
    user = db.prepare('SELECT * FROM users WHERE code = ?').get(code);
    console.log(`Код ${code} добавлен в базу.`);
}
const t = Date.now();
const current = user.premium && user.premium_until ? new Date(user.premium_until).getTime() : 0;
console.log(`Код ${code}: Премиум ${user.premium && current > t ? 'активен до ' + fmt(user.premium_until) : 'не активен'}`);
if (!change) process.exit(0);

const set = db.prepare('UPDATE users SET premium = ?, premium_until = ? WHERE code = ?');
if (change === 'off') {
    set.run(0, new Date(t - 1000).toISOString(), code);
    console.log('Премиум выключен.');
    process.exit(0);
}
const days = Number(change.replace(',', '.'));
if (!Number.isFinite(days) || days === 0) { console.log('Число дней: +7, -3 или off'); process.exit(1); }
// добавляем к текущему сроку, а если он уже истёк — от сегодняшнего дня
const base = days > 0 ? Math.max(t, current) : current;
const until = base + days * DAY;
if (until <= t) {
    set.run(0, new Date(until).toISOString(), code);
    console.log(`Срок ушёл в прошлое — Премиум выключен (было до ${fmt(user.premium_until)}).`);
} else {
    set.run(1, new Date(until).toISOString(), code);
    console.log(`Готово: Премиум активен до ${fmt(new Date(until).toISOString())}.`);
}
