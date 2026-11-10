// Добавить или убрать дни Премиума пользователю по коду привязки.
// Запуск в папке сервера:
//   node premium-days.js 350835 +7     — добавить 7 дней
//   node premium-days.js 350835 -3     — убрать 3 дня
//   node premium-days.js 350835 off    — выключить Премиум
//   node premium-days.js 350835        — просто показать текущий срок
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
initializeApp({ credential: cert(require('./serviceAccountKey.json')) });
const db = getFirestore();
const DAY = 24 * 60 * 60 * 1000;

const fmt = iso => iso ? new Date(iso).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', dateStyle: 'long', timeStyle: 'short' }) + ' (МСК)' : '—';

(async () => {
    const code = String(process.argv[2] || '').replace(/\D/g, '');
    const change = String(process.argv[3] || '').trim();
    if (code.length !== 6) {
        console.log('Укажите код из 6 цифр: node premium-days.js 350835 +7');
        process.exit(1);
    }
    let snap = await db.collection('users').where('code', '==', code).get();
    if (snap.empty) snap = await db.collection('users').where('code', '==', Number(code)).get();
    if (snap.empty) { console.log(`Пользователь с кодом ${code} не найден.`); process.exit(1); }
    const doc = snap.docs[0], data = doc.data();
    const now = Date.now();
    const current = data.premium && data.premiumUntil ? new Date(data.premiumUntil).getTime() : 0;
    console.log(`Код ${code}: Премиум ${data.premium && current > now ? 'активен до ' + fmt(data.premiumUntil) : 'не активен'}`);
    if (!change) process.exit(0);

    if (change === 'off') {
        await doc.ref.update({ premium: false, premiumUntil: new Date(now - 1000).toISOString() });
        console.log('Премиум выключен.');
        process.exit(0);
    }
    const days = Number(change.replace(',', '.'));
    if (!Number.isFinite(days) || days === 0) { console.log('Число дней: +7, -3 или off'); process.exit(1); }
    // добавляем к текущему сроку, а если он уже истёк — от сегодняшнего дня
    const base = days > 0 ? Math.max(now, current) : current;
    const until = base + days * DAY;
    if (until <= now) {
        await doc.ref.update({ premium: false, premiumUntil: new Date(until).toISOString() });
        console.log(`Срок ушёл в прошлое — Премиум выключен (было до ${fmt(data.premiumUntil)}).`);
    } else {
        await doc.ref.update({ premium: true, premiumUntil: new Date(until).toISOString() });
        console.log(`Готово: Премиум активен до ${fmt(new Date(until).toISOString())}.`);
    }
    process.exit(0);
})().catch(e => { console.error('Ошибка:', e.message); process.exit(1); });
