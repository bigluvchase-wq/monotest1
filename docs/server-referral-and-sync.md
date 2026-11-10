# Сервер: код друга (+7 дней Премиума) и синхронизация

Приложение уже вызывает эти адреса на `https://api.monoapp.ru`. Ниже описано, что сервер должен принимать и возвращать, и приведён пример реализации. Пример написан для Node.js (Express) с Firestore: судя по полю `premiumUntil` (`{_seconds}`), база похожа на Firestore. Его нужно адаптировать под ваш реальный код сервера.

## 1. Код друга — `POST /api/referral`

Тело запроса:

```json
{ "code": "123456", "friendCode": "654321" }
```

- `code` — код привязки того, кто вводит код друга.
- `friendCode` — код друга, который пригласил.

Ответ при успехе:

```json
{ "ok": true, "premiumUntil": 1767225600000 }
```

`premiumUntil` — новая дата окончания Премиума у того, кто ввёл код. Подходит число в миллисекундах или секундах, ISO-строка или `{_seconds}`.

Ответ при ошибке (HTTP 200 или 4xx, поле `ok: false`):

| `error`        | Когда |
|----------------|-------|
| `not_found`    | Кода друга нет в базе (или нет кода самого пользователя) |
| `self`         | Пользователь ввёл свой собственный код |
| `already_used` | Этот аккаунт уже получал бонус за код друга (любой) |
| `mutual`       | Друг уже получил бонус по коду этого пользователя: обменяться кодами дважды нельзя |

### Правила, которые проверяет сервер

1. Оба кода существуют, и `friendCode !== code`.
2. **Один аккаунт получает бонус за код друга только один раз.** У пользователя сохраняется `referredBy`. Если поле уже заполнено, сервер возвращает `already_used`.
3. **Нельзя обменяться кодами.** Если `friend.referredBy === code`, сервер возвращает `mutual`.
4. Приглашающий может звать разных людей, и дни у него складываются.
5. Обоим начисляется +7 дней: `premiumUntil = max(сейчас, текущий premiumUntil) + 7 дней`. Статус обоих становится «Премиум».
6. Всё выполняется в **одной транзакции**, чтобы двойное нажатие не начислило бонус дважды.

### Пример (Express + Firebase Admin, Firestore)

Предполагается коллекция `users`, где id документа — 6-значный код (как в `/api/registerUser`), и поля `premium` и `premiumUntil` (Timestamp).

```js
const DAY = 24 * 60 * 60 * 1000;
app.post('/api/referral', async (req, res) => {
  const code = String(req.body?.code || '').replace(/\D/g, '');
  const friendCode = String(req.body?.friendCode || '').replace(/\D/g, '');
  if (code.length !== 6 || friendCode.length !== 6) return res.json({ ok: false, error: 'not_found' });
  if (code === friendCode) return res.json({ ok: false, error: 'self' });
  const meRef = db.collection('users').doc(code);
  const friendRef = db.collection('users').doc(friendCode);
  try {
    const result = await db.runTransaction(async tx => {
      const [me, friend] = await Promise.all([tx.get(meRef), tx.get(friendRef)]);
      if (!me.exists || !friend.exists) return { ok: false, error: 'not_found' };
      if (me.get('referredBy')) return { ok: false, error: 'already_used' };
      if (friend.get('referredBy') === code) return { ok: false, error: 'mutual' };
      const now = Date.now();
      const extend = doc => {
        const until = doc.get('premiumUntil')?.toMillis?.() || 0;
        return admin.firestore.Timestamp.fromMillis(Math.max(now, until) + 7 * DAY);
      };
      const myUntil = extend(me), friendUntil = extend(friend);
      tx.update(meRef, { premium: true, premiumUntil: myUntil, referredBy: friendCode, referredAt: admin.firestore.FieldValue.serverTimestamp() });
      tx.update(friendRef, { premium: true, premiumUntil: friendUntil, referrals: admin.firestore.FieldValue.arrayUnion(code) });
      return { ok: true, premiumUntil: myUntil.toMillis() };
    });
    res.json(result);
  } catch (e) {
    res.status(500).json({ ok: false, error: 'server' });
  }
});
```

`/api/check?code=…` должен по-прежнему возвращать `{ premium: true, premiumUntil }`. Тогда новый срок сразу виден в профиле у обоих.

## 2. Синхронизация — `POST /api/sync` и `GET /api/sync?code=…`

Чтобы удалённые операции и напоминания не возвращались, нужно соблюдать три правила.

1. **`POST /api/sync` полностью заменяет** сохранённое состояние на присланное `state`, без слияния со старым. Если сервер объединяет старые и новые записи, удалённые будут возвращаться.
2. Сервер ставит `updatedAt` (время сохранения на сервере) и **возвращает его в ответе POST**:
   ```json
   { "ok": true, "updatedAt": 1767225600000 }
   ```
3. `GET /api/sync?code=…` возвращает `{ state, updatedAt }` или `{ empty: true }`.

Приложение дополнительно присылает `updatedAt` и `rev` (счётчик изменений на устройстве). Хранить их не обязательно.

Логика на устройстве:
- пока есть неотправленные изменения, данные с сервера их не перезаписывают;
- данные с сервера применяются только тогда, когда сервер изменился с прошлой синхронизации (например, с другого устройства);
- новое пустое устройство всегда берёт данные с сервера.
