const express = require('express');
const cors = require('cors');
const md5 = require('md5');
require('dotenv').config();

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const serviceAccount = require('./serviceAccountKey.json');

// Инициализация Firebase
initializeApp({
    credential: cert(serviceAccount)
});
const db = getFirestore();

const app = express();
app.use(cors());
// Данные приложения (история, аватар) могут быть большими
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

const usersRef = db.collection('users');
const DAY = 24 * 60 * 60 * 1000;

// Код привязки — только 6 цифр
const cleanCode = value => String(value ?? '').replace(/\D/g, '').slice(0, 6);

// Поиск пользователя по коду (код мог сохраниться строкой или числом)
async function findUserDocs(code, tx = null) {
    const run = query => (tx ? tx.get(query) : query.get());
    let snapshot = await run(usersRef.where('code', '==', String(code)));
    if (snapshot.empty && !isNaN(Number(code))) {
        snapshot = await run(usersRef.where('code', '==', Number(code)));
    }
    return snapshot.docs;
}

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
app.post('/api/result', async (req, res) => {
    const { OutSum, InvId, SignatureValue, Shp_code } = req.body;
    const mySignature = md5(`${OutSum}:${InvId}:${pass2}:Shp_code=${Shp_code}`).toUpperCase();

    if (mySignature !== (SignatureValue || '').toUpperCase()) {
        return res.status(400).send('Bad signature');
    }

    // Было: ждали 199/999/1799, а страница продаёт за 129/649/1299 — 6 месяцев и год давали 1 месяц
    const monthsToAdd = PLAN_MONTHS[parseInt(OutSum, 10)] || 1;

    try {
        const docs = await findUserDocs(Shp_code);
        if (!docs.length) {
            const endDate = new Date();
            endDate.setMonth(endDate.getMonth() + monthsToAdd);
            await usersRef.add({
                code: String(Shp_code),
                premium: true,
                premiumUntil: endDate.toISOString(),
                createdAt: new Date().toISOString()
            });
        } else {
            await Promise.all(docs.map(doc => {
                const data = doc.data();
                let currentEnd = new Date();
                if (data.premium && data.premiumUntil) {
                    const existingEnd = new Date(data.premiumUntil);
                    if (existingEnd > currentEnd) currentEnd = existingEnd;
                }
                currentEnd.setMonth(currentEnd.getMonth() + monthsToAdd);
                return usersRef.doc(doc.id).update({ premium: true, premiumUntil: currentEnd.toISOString() });
            }));
        }
    } catch (err) {
        console.error(err);
    }
    res.send(`OK${InvId}`);
});

// ==========================================
// 4. Проверка статуса (для приложения)
// ==========================================
app.get('/api/check', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.status(400).json({ error: 'Код не передан' });

    try {
        const docs = await findUserDocs(code);
        if (!docs.length) return res.json({ premium: false });

        let isPremium = false;
        let validUntil = null;
        for (const doc of docs) {
            const data = doc.data();
            if (!data.premium) continue;
            if (data.premiumUntil && new Date(data.premiumUntil) < new Date()) {
                usersRef.doc(doc.id).update({ premium: false }).catch(console.error);
            } else {
                isPremium = true;
                validUntil = data.premiumUntil || null;
            }
        }
        return res.json({ premium: isPremium, premiumUntil: validUntil });
    } catch (err) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// ==========================================
// 5. Авторегистрация нового устройства
// ==========================================
app.post('/api/registerUser', async (req, res) => {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Код не передан' });

    try {
        const docs = await findUserDocs(code);
        if (!docs.length) {
            await usersRef.add({
                code: String(code),
                premium: false,
                createdAt: new Date().toISOString()
            });
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// ==========================================
// 6–7. Синхронизация
// Данные целиком заменяются при каждом сохранении (без слияния со старыми),
// поэтому удалённые операции и напоминания не возвращаются.
// Документ Firestore ограничен 1 МБ, поэтому данные хранятся частями
// в подколлекции users/{id}/syncChunks.
// ==========================================
const CHUNK = 700000; // символов на часть — с запасом до лимита 1 МБ

async function saveState(docId, state) {
    const json = JSON.stringify(state);
    const parts = [];
    for (let i = 0; i < json.length; i += CHUNK) parts.push(json.slice(i, i + CHUNK));
    const userDoc = usersRef.doc(docId);
    const old = await userDoc.collection('syncChunks').get();
    const lastSync = new Date().toISOString();
    const batch = db.batch();
    parts.forEach((data, i) => batch.set(userDoc.collection('syncChunks').doc(String(i)), { data }));
    old.docs.forEach(d => { if (Number(d.id) >= parts.length) batch.delete(d.ref); });
    // старое поле userData убираем — источником теперь служат части
    batch.update(userDoc, { syncParts: parts.length, lastSync, userData: FieldValue.delete() });
    await batch.commit();
    return lastSync;
}

async function loadState(doc) {
    const data = doc.data();
    if (data.syncParts) {
        const chunks = await usersRef.doc(doc.id).collection('syncChunks').get();
        const byIndex = new Map(chunks.docs.map(d => [Number(d.id), d.data().data]));
        let json = '';
        for (let i = 0; i < data.syncParts; i++) {
            if (!byIndex.has(i)) throw new Error('Не хватает части данных');
            json += byIndex.get(i);
        }
        return { state: JSON.parse(json), updatedAt: data.lastSync || null };
    }
    // данные, сохранённые прежней версией сервера
    if (data.userData) return { state: data.userData, updatedAt: data.lastSync || null };
    return null;
}

// Сохранение данных в облако
app.post('/api/sync', async (req, res) => {
    const code = cleanCode(req.body.code);
    const { state } = req.body;
    if (!code || !state || typeof state !== 'object') return res.status(400).json({ error: 'Нет данных для синхронизации' });

    try {
        let docs = await findUserDocs(code);
        if (!docs.length) {
            const ref = await usersRef.add({ code, premium: false, createdAt: new Date().toISOString() });
            docs = [await ref.get()];
        }
        // ждём, пока данные действительно запишутся, и только потом отвечаем
        const updatedAt = await saveState(docs[0].id, state);
        return res.json({ success: true, ok: true, updatedAt });
    } catch (err) {
        console.error('Ошибка сохранения данных:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Загрузка данных из облака
app.get('/api/sync', async (req, res) => {
    const code = cleanCode(req.query.code);
    if (!code) return res.status(400).json({ error: 'Нет кода' });

    try {
        const docs = await findUserDocs(code);
        if (!docs.length) return res.status(404).json({ error: 'Нет данных' });
        const saved = await loadState(docs[0]);
        // данных ещё нет (например, только купил Премиум) — приложение пришлёт свои
        if (!saved) return res.json({ empty: true });
        return res.json(saved);
    } catch (err) {
        console.error('Ошибка загрузки данных:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// ==========================================
// 8. Код друга: +7 дней Премиума обоим
// Правила:
//  - код друга должен существовать и не быть своим;
//  - один аккаунт получает бонус за код друга только один раз (поле referredBy);
//  - нельзя обменяться кодами: если друг уже получил бонус по вашему коду — отказ;
//  - пригласивший может звать разных людей, его дни суммируются.
// Всё в одной транзакции, двойное нажатие не начислит бонус дважды.
// ==========================================
function extendIso(currentIso, now) {
    const current = currentIso ? new Date(currentIso).getTime() : 0;
    return new Date(Math.max(now, Number.isFinite(current) ? current : 0) + 7 * DAY).toISOString();
}

app.post('/api/referral', async (req, res) => {
    const code = cleanCode(req.body.code);
    const friendCode = cleanCode(req.body.friendCode);
    if (code.length !== 6 || friendCode.length !== 6) return res.json({ ok: false, error: 'not_found' });
    if (code === friendCode) return res.json({ ok: false, error: 'self' });

    try {
        const result = await db.runTransaction(async tx => {
            const [meDocs, friendDocs] = await Promise.all([findUserDocs(code, tx), findUserDocs(friendCode, tx)]);
            const me = meDocs[0], friend = friendDocs[0];
            if (!me || !friend) return { ok: false, error: 'not_found' };
            const meData = me.data(), friendData = friend.data();
            if (meData.referredBy) return { ok: false, error: 'already_used' };
            if (String(friendData.referredBy || '') === code) return { ok: false, error: 'mutual' };

            const now = Date.now();
            const myUntil = extendIso(meData.premium ? meData.premiumUntil : null, now);
            const friendUntil = extendIso(friendData.premium ? friendData.premiumUntil : null, now);
            const nowIso = new Date(now).toISOString();

            tx.update(me.ref, { premium: true, premiumUntil: myUntil, referredBy: friendCode, referredAt: nowIso });
            tx.update(friend.ref, {
                premium: true,
                premiumUntil: friendUntil,
                referrals: [...(Array.isArray(friendData.referrals) ? friendData.referrals : []), code]
            });
            return { ok: true, premiumUntil: myUntil };
        });
        res.json(result);
    } catch (err) {
        console.error('Ошибка кода друга:', err);
        res.status(500).json({ ok: false, error: 'server' });
    }
});

// ==========================================
// 9. Награды: заявка «пост о моно в соцсетях» → Firestore + письмо на почту
// Сообщение в Telegram — если в .env заданы TG_BOT_TOKEN и TG_CHAT_ID.
// Письмо отправляется, если в .env заданы MAIL_USER и MAIL_PASS (пароль приложения Gmail)
// и установлен nodemailer (npm install nodemailer). Без них заявка всё равно сохраняется в Firestore.
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
const rewardHits = new Map(); // не больше 10 заявок в сутки с одного кода

app.post('/api/reward', async (req, res) => {
    const code = cleanCode(req.body.code);
    const network = String(req.body.network || '');
    const link = String(req.body.link || '').trim().slice(0, 500);
    if (code.length !== 6 || !REWARD_NETWORKS[network] || !/^https?:\/\/\S+\.\S+/i.test(link)) {
        return res.status(400).json({ ok: false, error: 'bad_request' });
    }
    const day = new Date().toISOString().slice(0, 10), key = code + '|' + day;
    const hits = (rewardHits.get(key) || 0) + 1;
    rewardHits.set(key, hits);
    if (hits > 10) return res.status(429).json({ ok: false, error: 'too_many' });

    const [networkName, days] = REWARD_NETWORKS[network];
    try {
        // Награду можно запросить только один раз с одного кода — что-то одно
        const reqRef = db.collection('rewardRequests').doc(code);
        const created = await db.runTransaction(async tx => {
            const existing = await tx.get(reqRef);
            if (existing.exists) return false;
            tx.set(reqRef, { code, network, networkName, days, link, status: 'new', createdAt: new Date().toISOString() });
            return true;
        });
        if (!created) return res.json({ ok: false, error: 'already_sent' });
        // Уведомление в Telegram (если в .env заданы TG_BOT_TOKEN и TG_CHAT_ID)
        await sendTelegram(`🎁 Новая заявка на награду\n\nСоцсеть: ${networkName}\nКод привязки: ${code}\nНаграда: +${days} дней Премиума\nСсылка: ${link}`);
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
// 10. Поддержка: обращение из приложения → Firestore + Telegram-бот
// ==========================================
// Защита от спама: не больше 3 обращений за 12 часов с одного кода и с одного IP-адреса
const SUPPORT_LIMIT = 3, SUPPORT_WINDOW = 12 * 60 * 60 * 1000;
const supportByIp = new Map();
async function sendTelegram(text) {
    if (!process.env.TG_BOT_TOKEN || !process.env.TG_CHAT_ID) return;
    try {
        const tg = await fetch(`https://api.telegram.org/bot${process.env.TG_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: process.env.TG_CHAT_ID, text: text.slice(0, 4000), disable_web_page_preview: true })
        });
        if (!tg.ok) console.error('Telegram не принял сообщение:', await tg.text());
    } catch (e) {
        console.error('Ошибка отправки в Telegram:', e.message);
    }
}

app.post('/api/support', async (req, res) => {
    const code = cleanCode(req.body.code);
    const topic = ['Ошибка', 'Идея', 'Вопрос'].includes(req.body.topic) ? req.body.topic : 'Вопрос';
    // Контакт для ответа: почта или ник в Telegram
    let contact = String(req.body.contact ?? req.body.email ?? '').trim().slice(0, 200);
    if (/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(contact)) contact = '@' + contact;
    const message = String(req.body.message || '').trim().slice(0, 3000);
    if (!message) return res.status(400).json({ ok: false, error: 'empty' });
    if (contact && !/^\S+@\S+\.\S+$/.test(contact) && !/^@[A-Za-z][A-Za-z0-9_]{4,31}$/.test(contact)) return res.status(400).json({ ok: false, error: 'bad_contact' });

    const now = Date.now();
    const ip = String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();
    // по IP считаем только запросы без кода: если nginx не передаёт адрес, у всех был бы один IP
    const ipHits = code ? [] : (supportByIp.get(ip) || []).filter(t => now - t < SUPPORT_WINDOW);
    if (!code && ipHits.length >= SUPPORT_LIMIT) return res.status(429).json({ ok: false, error: 'too_many' });
    if (code) {
        // по коду считаем в базе — лимит сохраняется и после перезапуска сервера
        const since = new Date(now - SUPPORT_WINDOW).toISOString();
        const recent = await db.collection('supportTickets').where('code', '==', code).get();
        if (recent.docs.filter(d => String(d.get('createdAt') || '') >= since).length >= SUPPORT_LIMIT) {
            return res.status(429).json({ ok: false, error: 'too_many' });
        }
    }
    if (!code) { ipHits.push(now); supportByIp.set(ip, ipHits); }

    try {
        await db.collection('supportTickets').add({ code, topic, contact, message, status: 'new', createdAt: new Date().toISOString() });
        const icon = topic === 'Ошибка' ? '🐞' : topic === 'Идея' ? '💡' : '❓';
        await sendTelegram(`${icon} Поддержка · ${topic}\n\nКод: ${code || '—'}\nОтветить: ${contact || '—'}\n\n${message}`);
        res.json({ ok: true });
    } catch (err) {
        console.error('Ошибка обращения в поддержку:', err);
        res.status(500).json({ ok: false, error: 'server' });
    }
});

// ==========================================
// 11. Удаление данных пользователя («Удалить мои данные» в настройках)
// Удаляется: копия истории (части syncChunks и старое поле userData), обращения в поддержку.
// Из заявки на награду убирается ссылка (сама отметка остаётся, чтобы награду нельзя было получить повторно).
// Остаётся: код привязки и Премиум (premium, premiumUntil), отметки кода друга — они нужны для подписки и защиты от повторов.
// ==========================================
app.post('/api/deleteData', async (req, res) => {
    const code = cleanCode(req.body.code);
    if (code.length !== 6) return res.status(400).json({ ok: false, error: 'bad_code' });
    try {
        const docs = await findUserDocs(code);
        for (const doc of docs) {
            const chunks = await usersRef.doc(doc.id).collection('syncChunks').get();
            const batch = db.batch();
            chunks.docs.forEach(d => batch.delete(d.ref));
            batch.update(doc.ref, { userData: FieldValue.delete(), syncParts: FieldValue.delete(), lastSync: FieldValue.delete(), dataDeletedAt: new Date().toISOString() });
            await batch.commit();
        }
        const tickets = await db.collection('supportTickets').where('code', '==', code).get();
        await Promise.all(tickets.docs.map(d => d.ref.delete()));
        const reward = db.collection('rewardRequests').doc(code);
        const rewardDoc = await reward.get();
        if (rewardDoc.exists) await reward.update({ link: FieldValue.delete(), dataDeletedAt: new Date().toISOString() });
        res.json({ ok: true });
    } catch (err) {
        console.error('Ошибка удаления данных:', err);
        res.status(500).json({ ok: false, error: 'server' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
