const express = require('express');
const cors = require('cors');
const md5 = require('md5');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ quiet: true });

// ==========================================
// База данных: SQLite — один файл на этом сервере (по умолчанию mono.db рядом с server.js).
// Все данные пользователей хранятся в России, на этом сервере.
// ==========================================
const Database = require('better-sqlite3');
const db = new Database(process.env.DB_PATH || path.join(__dirname, 'mono.db'));
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');
db.exec(`
CREATE TABLE IF NOT EXISTS users (
    code TEXT PRIMARY KEY,
    premium INTEGER NOT NULL DEFAULT 0,
    premium_until TEXT,
    created_at TEXT NOT NULL,
    key_hash TEXT,
    key_set_at TEXT,
    referred_by TEXT,
    referred_at TEXT,
    referrals TEXT NOT NULL DEFAULT '[]',
    state TEXT,
    last_sync TEXT,
    data_deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS payments (
    inv_id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    sum TEXT NOT NULL,
    months INTEGER NOT NULL,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS support_tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT,
    topic TEXT,
    contact TEXT,
    message TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS support_by_code ON support_tickets (code, created_at);
CREATE TABLE IF NOT EXISTS reward_requests (
    code TEXT PRIMARY KEY,
    network TEXT,
    network_name TEXT,
    days INTEGER,
    link TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    created_at TEXT NOT NULL,
    data_deleted_at TEXT
);
`);
const now = () => new Date().toISOString();
const q = {
    user: db.prepare('SELECT * FROM users WHERE code = ?'),
    addUser: db.prepare('INSERT OR IGNORE INTO users (code, created_at, key_hash, key_set_at) VALUES (?, ?, ?, ?)'),
    setKey: db.prepare('UPDATE users SET key_hash = ?, key_set_at = ? WHERE code = ? AND key_hash IS NULL'),
    setPremium: db.prepare('UPDATE users SET premium = ?, premium_until = ? WHERE code = ?'),
    expire: db.prepare('UPDATE users SET premium = 0 WHERE code = ?'),
    saveState: db.prepare('UPDATE users SET state = ?, last_sync = ? WHERE code = ?'),
    deleteState: db.prepare('UPDATE users SET state = NULL, last_sync = NULL, data_deleted_at = ? WHERE code = ?'),
    payment: db.prepare('INSERT OR IGNORE INTO payments (inv_id, code, sum, months, created_at) VALUES (?, ?, ?, ?, ?)'),
    addTicket: db.prepare('INSERT INTO support_tickets (code, topic, contact, message, created_at) VALUES (?, ?, ?, ?, ?)'),
    recentTickets: db.prepare('SELECT COUNT(*) AS n FROM support_tickets WHERE code = ? AND created_at >= ?'),
    deleteTickets: db.prepare('DELETE FROM support_tickets WHERE code = ?'),
    addReward: db.prepare('INSERT OR IGNORE INTO reward_requests (code, network, network_name, days, link, created_at) VALUES (?, ?, ?, ?, ?, ?)'),
    clearRewardLink: db.prepare('UPDATE reward_requests SET link = NULL, data_deleted_at = ? WHERE code = ?'),
    referral: db.prepare('UPDATE users SET premium = 1, premium_until = ?, referred_by = ?, referred_at = ? WHERE code = ?'),
    referrer: db.prepare('UPDATE users SET premium = 1, premium_until = ?, referrals = ? WHERE code = ?')
};

const app = express();
// Адрес клиента берём из заголовка, который ставит nginx (сервер стоит за ним на этой же машине)
app.set('trust proxy', 'loopback');
app.use(cors());
// Данные приложения (история) могут быть большими
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true }));

const {
    ROBOKASSA_MERCHANT_LOGIN,
    ROBOKASSA_PASSWORD_1,
    ROBOKASSA_PASSWORD_2,
    ROBOKASSA_TEST_PASSWORD_1,
    ROBOKASSA_TEST_PASSWORD_2,
    IS_TEST
} = process.env;

const isTestMode = IS_TEST === 'true';
const pass1 = isTestMode ? ROBOKASSA_TEST_PASSWORD_1 : ROBOKASSA_PASSWORD_1;
const pass2 = isTestMode ? ROBOKASSA_TEST_PASSWORD_2 : ROBOKASSA_PASSWORD_2;

const DAY = 24 * 60 * 60 * 1000;

// Код привязки — только 6 цифр
const cleanCode = value => String(value ?? '').replace(/\D/g, '').slice(0, 6);

// ==========================================
// Защита данных: ключ устройства + ограничение попыток
// Код привязки почти публичный (вводится на сайте, виден в профиле), поэтому для истории
// требуется ещё и секретный ключ устройства. Приложение хранит его в Keychain и передаёт
// в заголовке X-Mono-Key. На сервере хранится только его хеш.
// Первый запрос с ключом для кода, у которого ключа ещё нет, запоминает его.
// ==========================================
const hashKey = key => crypto.createHash('sha256').update(String(key)).digest('hex');
const keyOf = req => String(req.get('x-mono-key') || req.body?.key || '').trim();
const validKey = key => /^[0-9a-f]{64}$/i.test(key);
function sameHash(a, b) {
    const x = Buffer.from(String(a)), y = Buffer.from(String(b));
    return x.length === y.length && crypto.timingSafeEqual(x, y);
}
// Проверяет ключ пользователя. true — можно, иначе отправляет ошибку сам.
function checkKey(req, res, user) {
    const key = keyOf(req);
    if (!validKey(key)) { noteFailure(req); res.status(401).json({ ok: false, error: 'no_key' }); return false; }
    if (!user.key_hash) { q.setKey.run(hashKey(key), now(), user.code); return true; }
    if (sameHash(user.key_hash, hashKey(key))) return true;
    noteFailure(req);
    res.status(403).json({ ok: false, error: 'wrong_key' });
    return false;
}
// Не больше 20 неудачных попыток (неверный ключ или неизвестный код) в минуту с одного адреса
// и не больше 120 запросов к данным в минуту с одного адреса
const failures = new Map(), hits = new Map();
const ipOf = req => String(req.ip || '');
// если nginx не передал адрес клиента, все запросы выглядят как с 127.0.0.1 — такие не ограничиваем, чтобы не заблокировать всех
const isLoopback = ip => /^(::1|127\.|::ffff:127\.)/.test(ip);
function noteFailure(req) { if (isLoopback(ipOf(req))) return; const t = Date.now(), list = (failures.get(ipOf(req)) || []).filter(x => t - x < 60000); list.push(t); failures.set(ipOf(req), list); }
function rateLimit(req, res, next) {
    const ip = ipOf(req), t = Date.now();
    if (isLoopback(ip)) return next();
    const failed = (failures.get(ip) || []).filter(x => t - x < 60000);
    const recent = (hits.get(ip) || []).filter(x => t - x < 60000);
    recent.push(t); hits.set(ip, recent);
    if (failed.length >= 20 || recent.length > 120) return res.status(429).json({ ok: false, error: 'too_many' });
    next();
}
setInterval(() => { const t = Date.now(); for (const m of [failures, hits]) for (const [k, v] of m) { const f = v.filter(x => t - x < 60000); if (f.length) m.set(k, f); else m.delete(k); } }, 60000).unref();

// Тарифы: сумма → месяцы. Цены со страницы оплаты и прежние цены — на всякий случай
const PLAN_MONTHS = { 129: 1, 649: 6, 1299: 12, 199: 1, 999: 6, 1799: 12 };

// ==========================================
// 1. Страница выбора тарифов (открывается из приложения)
// ==========================================
app.get('/pay', (req, res) => {
    const code = cleanCode(req.query.code);
    if (!code) return res.send('Ошибка: не указан код устройства');

    const html = `
    <!DOCTYPE html>
    <html lang="ru">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Оплата Премиум</title>
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #1c1c1e; color: white; padding: 20px; text-align: center; }
            .card { background: #2c2c2e; border-radius: 16px; padding: 24px; max-width: 400px; margin: 40px auto; }
            h2 { margin-top: 0; }
            .code { color: #f2c94c; font-weight: bold; font-size: 20px; margin-bottom: 24px; }
            button { background: #4a4a55; color: white; border: none; padding: 16px; border-radius: 12px; width: 100%; font-size: 16px; font-weight: bold; margin-bottom: 12px; cursor: pointer; transition: 0.2s; }
            button:hover { background: #5a5a65; }
            .best-choice { background: #5e5ce6; }
            .best-choice:hover { background: #6e6cf6; }
        </style>
    </head>
    <body>
        <div class="card">
            <h2>Выберите тариф</h2>
            <p>Ваш код привязки:</p>
            <div class="code">${code}</div>
            <form action="/api/pay" method="POST">
                <input type="hidden" name="code" value="${code}">
                <button type="submit" name="price" value="129">1 месяц — 129 ₽</button>
                <button type="submit" name="price" value="649">6 месяцев — 649 ₽</button>
                <button type="submit" name="price" value="1299" class="best-choice">1 год — 1299 ₽</button>
            </form>
        </div>
    </body>
    </html>
    `;
    res.send(html);
});

// ==========================================
// 2. Создание ссылки на оплату и редирект в Робокассу
// ==========================================
app.post('/api/pay', (req, res) => {
    const code = cleanCode(req.body.code);
    const price = String(req.body.price || '');
    if (!code || !PLAN_MONTHS[price]) return res.status(400).send('Не указан код или цена');

    let planTitle = 'Премиум';
    if (price == 129) planTitle = '1 месяц';
    if (price == 649) planTitle = '6 месяцев';
    if (price == 1299) planTitle = '1 год';

    const invId = Math.floor(Math.random() * 1000000);
    const outSum = price;
    const signature = md5(`${ROBOKASSA_MERCHANT_LOGIN}:${outSum}:${invId}:${pass1}:Shp_code=${code}`);

    let paymentUrl = `https://auth.robokassa.ru/Merchant/Index.aspx?MerchantLogin=${ROBOKASSA_MERCHANT_LOGIN}&OutSum=${outSum}&InvId=${invId}&Description=${encodeURIComponent(`Премиум подписка (${planTitle})`)}&SignatureValue=${signature}&Shp_code=${code}`;

    if (isTestMode) paymentUrl += '&IsTest=1';

    res.json({ url: paymentUrl });
});

// ==========================================
// 3. Вебхук об успешной оплате от Робокассы
// ==========================================
app.post('/api/result', (req, res) => {
    const { OutSum, InvId, SignatureValue, Shp_code } = req.body;
    const mySignature = md5(`${OutSum}:${InvId}:${pass2}:Shp_code=${Shp_code}`).toUpperCase();
    if (mySignature !== (SignatureValue || '').toUpperCase()) {
        return res.status(400).send('Bad signature');
    }
    const code = cleanCode(Shp_code);
    const monthsToAdd = PLAN_MONTHS[parseInt(OutSum, 10)] || 1;
    try {
        const applied = db.transaction(() => {
            // Робокасса может прислать одно уведомление дважды — продлеваем только один раз
            if (!q.payment.run(String(InvId), code, String(OutSum), monthsToAdd, now()).changes) return false;
            q.addUser.run(code, now(), null, null);
            const user = q.user.get(code);
            let end = new Date();
            if (user.premium && user.premium_until && new Date(user.premium_until) > end) end = new Date(user.premium_until);
            end.setMonth(end.getMonth() + monthsToAdd);
            q.setPremium.run(1, end.toISOString(), code);
            return true;
        })();
        console.log(applied ? `Оплата: код ${code}, сумма ${OutSum}, +${monthsToAdd} мес.` : `Повторное уведомление об оплате ${InvId} — пропущено`);
    } catch (err) {
        console.error('Ошибка обработки оплаты:', err);
    }
    res.send(`OK${InvId}`);
});

// ==========================================
// 4. Проверка статуса (для приложения)
// ==========================================
app.get('/api/check', rateLimit, (req, res) => {
    const code = cleanCode(req.query.code);
    if (!code) return res.status(400).json({ error: 'Код не передан' });
    try {
        const user = q.user.get(code);
        if (!user || !user.premium) return res.json({ premium: false });
        if (user.premium_until && new Date(user.premium_until) < new Date()) {
            q.expire.run(code);
            return res.json({ premium: false });
        }
        return res.json({ premium: true, premiumUntil: user.premium_until || null });
    } catch (err) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// ==========================================
// 5. Авторегистрация нового устройства
// ==========================================
app.post('/api/registerUser', (req, res) => {
    const code = cleanCode(req.body.code);
    if (!code) return res.status(400).json({ error: 'Код не передан' });
    try {
        const key = keyOf(req), ok = validKey(key);
        q.addUser.run(code, now(), ok ? hashKey(key) : null, ok ? now() : null);
        if (ok) q.setKey.run(hashKey(key), now(), code);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// ==========================================
// 6–7. Синхронизация (Премиум)
// Данные целиком заменяются при каждом сохранении, поэтому удалённое не возвращается.
// ==========================================
app.post('/api/sync', rateLimit, (req, res) => {
    const code = cleanCode(req.body.code);
    const { state } = req.body;
    if (!code || !state || typeof state !== 'object') return res.status(400).json({ error: 'Нет данных для синхронизации' });
    try {
        let user = q.user.get(code);
        if (!user) {
            const key = keyOf(req);
            if (!validKey(key)) { noteFailure(req); return res.status(401).json({ ok: false, error: 'no_key' }); }
            q.addUser.run(code, now(), hashKey(key), now());
            user = q.user.get(code);
        } else if (!checkKey(req, res, user)) return;
        const updatedAt = now();
        q.saveState.run(JSON.stringify(state), updatedAt, code);
        return res.json({ success: true, ok: true, updatedAt });
    } catch (err) {
        console.error('Ошибка сохранения данных:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.get('/api/sync', rateLimit, (req, res) => {
    const code = cleanCode(req.query.code);
    if (!code) return res.status(400).json({ error: 'Нет кода' });
    try {
        const user = q.user.get(code);
        if (!user) { noteFailure(req); return res.status(404).json({ error: 'Нет данных' }); }
        if (!checkKey(req, res, user)) return;
        // данных ещё нет (например, только купил Премиум) — приложение пришлёт свои
        if (!user.state) return res.json({ empty: true });
        return res.json({ state: JSON.parse(user.state), updatedAt: user.last_sync || null });
    } catch (err) {
        console.error('Ошибка загрузки данных:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// ==========================================
// 8. Код друга: +7 дней Премиума обоим (в приложении сейчас скрыт)
// Один бонус на аккаунт; нельзя обменяться кодами; пригласивший копит дни за разных друзей.
// ==========================================
function extendIso(currentIso, from) {
    const current = currentIso ? new Date(currentIso).getTime() : 0;
    return new Date(Math.max(from, Number.isFinite(current) ? current : 0) + 7 * DAY).toISOString();
}
app.post('/api/referral', rateLimit, (req, res) => {
    const code = cleanCode(req.body.code);
    const friendCode = cleanCode(req.body.friendCode);
    if (code.length !== 6 || friendCode.length !== 6) return res.json({ ok: false, error: 'not_found' });
    if (code === friendCode) return res.json({ ok: false, error: 'self' });
    try {
        const result = db.transaction(() => {
            const me = q.user.get(code), friend = q.user.get(friendCode);
            if (!me || !friend) { noteFailure(req); return { ok: false, error: 'not_found' }; }
            if (me.referred_by) return { ok: false, error: 'already_used' };
            if (String(friend.referred_by || '') === code) return { ok: false, error: 'mutual' };
            const t = Date.now();
            const myUntil = extendIso(me.premium ? me.premium_until : null, t);
            const friendUntil = extendIso(friend.premium ? friend.premium_until : null, t);
            let refs = []; try { refs = JSON.parse(friend.referrals || '[]'); } catch {}
            q.referral.run(myUntil, friendCode, new Date(t).toISOString(), code);
            q.referrer.run(friendUntil, JSON.stringify([...refs, code]), friendCode);
            return { ok: true, premiumUntil: myUntil };
        })();
        res.json(result);
    } catch (err) {
        console.error('Ошибка кода друга:', err);
        res.status(500).json({ ok: false, error: 'server' });
    }
});

// ==========================================
// 9. Награды (в приложении сейчас скрыты): одна заявка на код → база + Telegram/почта
// ==========================================
let mailer = null;
try {
    if (process.env.MAIL_USER && process.env.MAIL_PASS) {
        const nodemailer = require('nodemailer');
        mailer = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS } });
    }
} catch (e) {
    console.error('nodemailer не установлен — письма о наградах не отправляются');
}
const REWARD_TO = process.env.REWARD_MAIL_TO || 'monofinapp@gmail.com';
const REWARD_NETWORKS = { threads: ['Threads', 7], telegram: ['Telegram', 7], instagram: ['Instagram', 30], vk: ['ВКонтакте', 7] };

// TG_API_BASE — адрес-посредник для Telegram, если из России api.telegram.org недоступен (например, https://tg.monoapp.ru)
const TG_API = (process.env.TG_API_BASE || 'https://api.telegram.org').replace(/\/+$/, '');
async function sendTelegram(text) {
    if (!process.env.TG_BOT_TOKEN || !process.env.TG_CHAT_ID) return;
    try {
        const tg = await fetch(`${TG_API}/bot${process.env.TG_BOT_TOKEN}/sendMessage`, {
            signal: AbortSignal.timeout(15000),
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: process.env.TG_CHAT_ID, text: text.slice(0, 4000), disable_web_page_preview: true })
        });
        if (!tg.ok) console.error('Telegram не принял сообщение:', await tg.text());
    } catch (e) {
        console.error('Ошибка отправки в Telegram:', e.message);
    }
}

app.post('/api/reward', rateLimit, async (req, res) => {
    const code = cleanCode(req.body.code);
    const network = String(req.body.network || '');
    const link = String(req.body.link || '').trim().slice(0, 500);
    if (code.length !== 6 || !REWARD_NETWORKS[network] || !/^https?:\/\/\S+\.\S+/i.test(link)) {
        return res.status(400).json({ ok: false, error: 'bad_request' });
    }
    const [networkName, days] = REWARD_NETWORKS[network];
    try {
        if (!q.addReward.run(code, network, networkName, days, link, now()).changes) return res.json({ ok: false, error: 'already_sent' });
        sendTelegram(`🎁 Новая заявка на награду\n\nСоцсеть: ${networkName}\nКод привязки: ${code}\nНаграда: +${days} дней Премиума\nСсылка: ${link}`);
        if (mailer) {
            await mailer.sendMail({
                from: `моно <${process.env.MAIL_USER}>`,
                to: REWARD_TO,
                subject: `Награда моно: ${networkName} · код ${code}`,
                text: `Новая заявка на награду\n\nСоцсеть: ${networkName}\nКод привязки: ${code}\nСсылка: ${link}\nНаграда: +${days} дней Премиума\n`
            });
        }
        res.json({ ok: true });
    } catch (err) {
        console.error('Ошибка заявки на награду:', err);
        res.status(500).json({ ok: false, error: 'server' });
    }
});

// ==========================================
// 10. Поддержка: обращение из приложения → база + Telegram-бот
// Не больше 3 обращений за 12 часов с одного кода (и с одного адреса — для запросов без кода)
// ==========================================
const SUPPORT_LIMIT = 3, SUPPORT_WINDOW = 12 * 60 * 60 * 1000;
const supportByIp = new Map();
app.post('/api/support', rateLimit, async (req, res) => {
    const code = cleanCode(req.body.code);
    const topic = ['Ошибка', 'Идея', 'Вопрос'].includes(req.body.topic) ? req.body.topic : 'Вопрос';
    let contact = String(req.body.contact ?? req.body.email ?? '').trim().slice(0, 200);
    if (/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(contact)) contact = '@' + contact;
    const message = String(req.body.message || '').trim().slice(0, 3000);
    if (!message) return res.status(400).json({ ok: false, error: 'empty' });
    if (contact && !/^\S+@\S+\.\S+$/.test(contact) && !/^@[A-Za-z][A-Za-z0-9_]{4,31}$/.test(contact)) return res.status(400).json({ ok: false, error: 'bad_contact' });

    const t = Date.now();
    const ip = ipOf(req);
    const ipHits = code ? [] : (supportByIp.get(ip) || []).filter(x => t - x < SUPPORT_WINDOW);
    if (!code && ipHits.length >= SUPPORT_LIMIT) return res.status(429).json({ ok: false, error: 'too_many' });
    if (code && q.recentTickets.get(code, new Date(t - SUPPORT_WINDOW).toISOString()).n >= SUPPORT_LIMIT) {
        return res.status(429).json({ ok: false, error: 'too_many' });
    }
    if (!code) { ipHits.push(t); supportByIp.set(ip, ipHits); }
    try {
        q.addTicket.run(code, topic, contact, message, now());
        const icon = topic === 'Ошибка' ? '🐞' : topic === 'Идея' ? '💡' : '❓';
        sendTelegram(`${icon} Поддержка · ${topic}\n\nКод: ${code || '—'}\nОтветить: ${contact || '—'}\n\n${message}`);
        res.json({ ok: true });
    } catch (err) {
        console.error('Ошибка обращения в поддержку:', err);
        res.status(500).json({ ok: false, error: 'server' });
    }
});

// ==========================================
// 11. Удаление данных пользователя («Удалить мои данные» в настройках)
// Удаляется копия истории и обращения; из заявки на награду — ссылка.
// Остаются код, Премиум и отметки кода друга — они нужны для подписки и защиты от повторов.
// ==========================================
app.post('/api/deleteData', rateLimit, (req, res) => {
    const code = cleanCode(req.body.code);
    if (code.length !== 6) return res.status(400).json({ ok: false, error: 'bad_code' });
    try {
        const user = q.user.get(code);
        if (!user) { noteFailure(req); return res.status(404).json({ ok: false, error: 'not_found' }); }
        if (!checkKey(req, res, user)) return;
        db.transaction(() => {
            q.deleteState.run(now(), code);
            q.deleteTickets.run(code);
            q.clearRewardLink.run(now(), code);
        })();
        res.json({ ok: true });
    } catch (err) {
        console.error('Ошибка удаления данных:', err);
        res.status(500).json({ ok: false, error: 'server' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
