# Превью моно для App Store (Remotion)

Ролик 886×1920, 30 кадров/с, ~20 с — размер превью для iPhone 6.9″/6.7″/6.5″.
Экраны — настоящие снимки приложения в `public/shots` (сняты Playwright из `Mono/Web` в размере 443×960 @2x).

Собрать заново:

```bash
npm i
npx remotion render AppStorePreview out/raw.mp4 --codec=h264 --crf=16
# App Store ждёт видео со звуковой дорожкой — добавляем тихую стерео-дорожку
ffmpeg -y -i out/raw.mp4 -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100 -shortest \
  -c:v libx264 -profile:v high -level 4.0 -pix_fmt yuv420p -r 30 -crf 17 -c:a aac -b:a 256k \
  -movflags +faststart out/mono-app-preview.mp4
```

Если Remotion не может скачать свой браузер, добавьте `--browser-executable=<путь к Chromium>`.
Сцены и подписи — `src/Promo.tsx`.

## Скриншоты для карточки App Store

7 скриншотов 1290×2796 (iPhone 6.7″–6.9″), сцены — `src/Screens.tsx`, экраны телефона — `public/phone` (1179×2556).

```bash
for i in 1 2 3 4 5 6 7; do npx remotion still Screenshot$i out/screens/0$i.png; done
```
