# моно — учёт денег голосом (iOS)

Отвечай владельцу по-русски, коротко и по шагам. Владелец не программист: команды для сервера давай готовыми к копированию.

## Как устроено приложение
- iOS-приложение: нативная оболочка на Swift (`Mono/*.swift`) + интерфейс в WKWebView (`Mono/Web/*.js`, `index.html`, `style.css`).
- Папка `Mono/Web` подключена в Xcode как folder reference — новые файлы попадают в сборку сами. При изменении JS/CSS повышай `?v=N` у файла в `index.html`.
- Темы «Чёрно-белая», «Голубая», «Фиолетовая», «Зелёная», «Бургунди» (только с Премиумом) — `Mono/Web/palettes.css`, генерируется из `style.css`: после правок цветов запусти `pip install tinycss2 && python3 tools/build-palettes.py` и повысь `palettes.css?v=N`.
- Сборка — Codemagic. Здесь (Linux) Xcode нет: Swift-код нельзя собрать или запустить, только проверять внимательно. JS проверяй `node --check` и в Chromium (Playwright), тесты — `node --test tests/*.test.cjs`.
- Сервер: `server/` (Node + Express + SQLite), развёрнут в Москве (pm2 `mono-pay`, папка `/root/mono-server`). Сайт и документы: `site/` (monoapp.ru).
- Данные пользователей храним только в России (152-ФЗ). Почта поддержки — monoapp@mail.ru через SMTP Mail.ru.
- Оплата Премиума только на сайте (Робокасса), в приложении цен и оплаты нет (правила App Store 3.1.1 / 3.1.3).

## Какие навыки использовать (`.claude/skills`)
- Плавность, рывки, переходы в интерфейсе (Web): `60fps-animation`, `page-transition-animation`, `micro-interaction`, `glassmorphism`, `accessible-animation`.
- Нативная часть и всё «как в iOS»: `axiom-swiftui`, `axiom-uikit`, `animation-patterns` (SwiftUI-анимации, пружины, SF Symbols), `axiom-design` (HIG, Liquid Glass).
- Тормоза, память, батарея: `axiom-performance`.
- Уведомления, напоминания, виджеты, Siri: `axiom-integration`.
- Ключи, Keychain, безопасность: `axiom-security`.
- Публикация в App Store, отказы проверки: `axiom-shipping`.
- Доступность (VoiceOver, размеры текста): `axiom-accessibility`.
- Интерфейс выглядит «как сгенерированный ИИ», нужен свой характер и аккуратность — `unslop` (автор Damir Sokolovsky, CC BY 4.0).
- Код: самое маленькое изменение, которое полностью решает задачу, без лишних абстракций — `ponytail`; проверка изменений — `ponytail-review`, аудит кода — `ponytail-audit`, технический долг — `ponytail-debt`.

Перед правкой анимаций или производительности открой подходящий навык и следуй ему: анимируй только `transform` и `opacity`, не трогай дизайн и функции без просьбы.

## Git
Работай в ветке, указанной в задаче; PR в `main`. Если прошлый PR уже слит — открывай новый.
