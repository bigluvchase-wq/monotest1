// Просмотр базы на сервере (только чтение, ничего не меняет).
//   node users.js            — все коды: Премиум, когда была синхронизация, сколько записей в истории
//   node users.js 350835     — подробно по одному коду: что сохранено и последние операции
//   node users.js payments   — последние оплаты
//   node users.js tickets    — последние обращения в поддержку
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });
const Database = require('better-sqlite3');
const db = new Database(process.env.DB_PATH || path.join(__dirname, 'mono.db'), { readonly: true, fileMustExist: true });

const fmt = iso => iso ? new Date(iso).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const parse = text => { try { return text ? JSON.parse(text) : null; } catch { return null; } };
const count = (s, k) => Array.isArray(s?.[k]) ? s[k].filter(x => !x?.deleted).length : 0;
const premium = u => u.premium && (!u.premium_until || new Date(u.premium_until) > new Date()) ? 'до ' + fmt(u.premium_until).slice(0, 10) : 'нет';
const arg = (process.argv[2] || '').trim();

if (!arg) {
    const users = db.prepare('SELECT * FROM users ORDER BY COALESCE(last_sync, created_at) DESC').all();
    console.log(`Всего кодов: ${users.length}\n`);
    console.table(users.map(u => {
        const s = parse(u.state);
        return {
            'Код': u.code,
            'Премиум': premium(u),
            'Ключ устройства': u.key_hash ? 'есть' : 'нет',
            'Синхронизация': fmt(u.last_sync),
            'Операций': count(s, 'entries'),
            'Счетов': count(s, 'accounts'),
            'Создан': fmt(u.created_at).slice(0, 10)
        };
    }));
} else if (arg === 'payments') {
    console.table(db.prepare('SELECT * FROM payments ORDER BY created_at DESC LIMIT 30').all()
        .map(p => ({ 'Счёт': p.inv_id, 'Код': p.code, 'Сумма': p.sum, 'Месяцев': p.months, 'Когда': fmt(p.created_at) })));
} else if (arg === 'tickets') {
    for (const t of db.prepare('SELECT * FROM support_tickets ORDER BY id DESC LIMIT 20').all()) {
        console.log(`#${t.id} · ${fmt(t.created_at)} · ${t.topic} · код ${t.code || '—'} · ответить: ${t.contact || '—'}\n${t.message}\n`);
    }
} else {
    const code = arg.replace(/\D/g, '');
    const u = db.prepare('SELECT * FROM users WHERE code = ?').get(code);
    if (!u) { console.log(`Код ${code} не найден.`); process.exit(1); }
    const s = parse(u.state);
    console.log(`Код ${u.code}`);
    console.log(`Премиум: ${premium(u)}`);
    console.log(`Ключ устройства: ${u.key_hash ? 'есть (с ' + fmt(u.key_set_at) + ')' : 'нет — приложение ещё не присылало ключ'}`);
    console.log(`Создан: ${fmt(u.created_at)}`);
    console.log(`Последняя синхронизация: ${fmt(u.last_sync)}`);
    if (u.data_deleted_at) console.log(`Данные удалены пользователем: ${fmt(u.data_deleted_at)}`);
    const pays = db.prepare('SELECT * FROM payments WHERE code = ? ORDER BY created_at DESC').all(u.code);
    console.log(pays.length ? `\nОплаты Премиума (${pays.length}):` : '\nОплат через сайт не было (Премиум мог быть выдан вручную).');
    for (const p of pays) console.log(`  ${fmt(p.created_at)} — ${p.sum} ₽, ${p.months} мес. (счёт ${p.inv_id})`);
    if (!s) { console.log('\nИстория на сервере не сохранена.'); process.exit(0); }
    console.log(`\nНа сервере сохранено:`);
    for (const [k, name] of [['entries', 'операций'], ['accounts', 'счетов'], ['categories', 'категорий расходов'], ['goals', 'целей'], ['limits', 'лимитов'], ['payments', 'платежей'], ['deposits', 'вкладов'], ['reminders', 'напоминаний']]) {
        console.log(`  ${name}: ${count(s, k)}`);
    }
    const entries = (s.entries || []).filter(e => !e?.deleted).sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 10);
    if (entries.length) {
        console.log('\nПоследние операции:');
        console.table(entries.map(e => ({ 'Дата': e.date, 'Тип': e.type === 'income' ? 'доход' : e.type === 'expense' ? 'расход' : e.type, 'Сумма': (Number(e.amount) || 0) / 100, 'Название': e.title || e.category || '' })));
    }
}
