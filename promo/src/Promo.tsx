import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";

// Превью для App Store: 886×1920, 30 кадров/с, около 20 секунд.
// Экраны — настоящие снимки приложения (public/shots), снятые в том же размере.

const FONT = "Inter, -apple-system, sans-serif";
const ACCENT = "#6551dc";

// cover — плашка повыше: целиком закрывает крупный заголовок главного экрана
const Caption: React.FC<{ text: string; sub?: React.ReactNode; cover?: boolean }> = ({ text, sub, cover }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - 6, fps, config: { damping: 200 } });
  return (
    <div
      style={{
        position: "absolute",
        left: 48,
        right: 48,
        top: cover ? 120 : 150,
        minHeight: cover ? 380 : undefined,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "34px 40px",
        borderRadius: 44,
        background: cover ? "rgba(255,255,255,0.94)" : "rgba(255,255,255,0.86)",
        boxShadow: "0 24px 60px rgba(30,36,60,0.18), inset 0 1px 0 #fff",
        backdropFilter: "blur(24px)",
        fontFamily: FONT,
        opacity: cover ? 1 : p,
        translate: cover ? undefined : `0 ${(1 - p) * -40}px`,
      }}
    >
      <div style={{ opacity: p, translate: `0 ${(1 - p) * 16}px` }}>
      <div style={{ fontSize: 60, fontWeight: 700, letterSpacing: -1.5, color: "#1b1c26", lineHeight: 1.12 }}>{text}</div>
      {sub ? (
        <div style={{ marginTop: 14, fontSize: 36, fontWeight: 500, color: "#6e7285", lineHeight: 1.3 }}>{sub}</div>
      ) : null}
      </div>
    </div>
  );
};

// Экран приложения с лёгким медленным приближением
const Screen: React.FC<{ src: string; zoomTo?: number; origin?: string }> = ({ src, zoomTo = 1.04, origin = "50% 60%" }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const scale = interpolate(frame, [0, durationInFrames], [1, zoomTo], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: "#eceef2" }}>
      <Img src={staticFile(`shots/${src}.png`)} style={{ width: "100%", height: "100%", scale: String(scale), transformOrigin: origin }} />
    </AbsoluteFill>
  );
};

const Scene: React.FC<{ src: string; text: string; sub?: React.ReactNode; cover?: boolean; zoomTo?: number; origin?: string; children?: React.ReactNode }> = ({ src, text, sub, cover, zoomTo, origin, children }) => (
  <AbsoluteFill>
    <Screen src={src} zoomTo={zoomTo} origin={origin} />
    {children}
    <Caption text={text} sub={sub} cover={cover} />
  </AbsoluteFill>
);

// Микрофон слушает: расходящиеся круги и фраза, которая «произносится» по словам
const Listening: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const phrase = "«Кофе 280 и такси 400»";
  const words = phrase.split(" ");
  const shown = Math.min(words.length, Math.floor(Math.max(0, frame - 18) / 9));
  const press = spring({ frame, fps, config: { damping: 18 } });
  return (
    <AbsoluteFill>
      {[0, 1, 2].map((i) => {
        const t = ((frame + i * 16) % 48) / 48;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 443 - 170,
              top: 960 - 170,
              width: 340,
              height: 340,
              borderRadius: "50%",
              border: `4px solid ${ACCENT}`,
              opacity: (1 - t) * 0.55 * press,
              scale: String(1 + t * 0.9),
            }}
          />
        );
      })}
      <Caption text="Зажмите микрофон и скажите" cover sub={<span style={{ color: ACCENT, fontWeight: 600, fontSize: 52 }}>{words.slice(0, shown).join(" ") || "…"}</span>} />
    </AbsoluteFill>
  );
};

const THEMES = ["black", "blue", "green", "burgundy"];
const Themes: React.FC = () => {
  const frame = useCurrentFrame();
  const step = 24;
  return (
    <AbsoluteFill>
      {THEMES.map((t, i) => {
        const o = i === 0 ? 1 : interpolate(frame, [i * step - 8, i * step], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return (
          <AbsoluteFill key={t} style={{ opacity: o }}>
            <Img src={staticFile(`shots/08-theme-${t}.png`)} style={{ width: "100%", height: "100%" }} />
          </AbsoluteFill>
        );
      })}
      <Caption text="Темы на любой вкус" sub="Чёрно-белая, голубая, зелёная, бургунди" cover />
    </AbsoluteFill>
  );
};

const EndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame, fps, config: { damping: 200 } });
  const p2 = spring({ frame: frame - 10, fps, config: { damping: 200 } });
  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(165deg,#f5f6f8 0%,#e8eaef 55%,#dcdfe6 100%)",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT,
      }}
    >
      <div style={{ fontSize: 210, fontWeight: 800, letterSpacing: -10, color: "#1b1c26", opacity: p, scale: String(0.9 + p * 0.1) }}>
        моно<span style={{ color: ACCENT }}>•</span>
      </div>
      <div style={{ marginTop: 26, fontSize: 56, fontWeight: 600, color: "#6e7285", opacity: p2, translate: `0 ${(1 - p2) * 24}px` }}>
        Деньги голосом
      </div>
    </AbsoluteFill>
  );
};

const T = 12; // длина перехода между сценами, кадров
const timing = springTiming({ config: { damping: 200 }, durationInFrames: T });

export const Promo: React.FC = () => (
  <TransitionSeries>
    <TransitionSeries.Sequence name="Главная" durationInFrames={90}>
      <Scene src="01-home" text="Просто скажите, сколько потратили" sub="Учёт денег голосом" cover zoomTo={1} />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={fade()} timing={timing} />
    <TransitionSeries.Sequence name="Голос" durationInFrames={96}>
      <AbsoluteFill>
        <Screen src="02-listening" zoomTo={1.02} />
        <Listening />
      </AbsoluteFill>
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={slide({ direction: "from-bottom" })} timing={timing} />
    <TransitionSeries.Sequence name="Разбор" durationInFrames={90}>
      <Scene src="03-entry" text="моно сам разберёт траты" sub="Сумма, категория и счёт — готово" origin="50% 40%" />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={fade()} timing={timing} />
    <TransitionSeries.Sequence name="Операции" durationInFrames={75}>
      <Scene src="04-history" text="Все операции под рукой" />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={timing} />
    <TransitionSeries.Sequence name="Категории" durationInFrames={90}>
      <Scene src="05-chart" text="Куда уходят деньги" sub="Расходы по категориям" origin="50% 35%" />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={fade()} timing={timing} />
    <TransitionSeries.Sequence name="Лимиты" durationInFrames={75}>
      <Scene src="06-limits" text="Лимиты, цели, напоминания" sub="Всё для спокойного бюджета" />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={fade()} timing={timing} />
    <TransitionSeries.Sequence name="Темы" durationInFrames={96}>
      <Themes />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={fade()} timing={timing} />
    <TransitionSeries.Sequence name="Финал" durationInFrames={75}>
      <EndCard />
    </TransitionSeries.Sequence>
  </TransitionSeries>
);

// 90+96+90+75+90+75+96+75 = 687 кадров минус 7 переходов по 12 = 603 кадра ≈ 20 с
export const PROMO_DURATION = 687 - 7 * T;
