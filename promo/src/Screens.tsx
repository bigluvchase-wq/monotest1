import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";

// Скриншоты для карточки App Store: 1290×2796 (iPhone 6.7″–6.9″).
// Экраны — настоящие снимки приложения (public/phone, 1179×2556), телефон нарисован CSS и повёрнут в 3D.

const FONT = "Inter, -apple-system, sans-serif";
export const SHOT_W = 1290;
export const SHOT_H = 2796;

type Tilt = { x?: number; y?: number; z?: number };

const Phone: React.FC<{ src: string; width: number; tilt?: Tilt; style?: React.CSSProperties; dark?: boolean }> = ({ src, width, tilt = {}, style, dark }) => {
  const h = width * (2556 / 1179);
  const pad = width * 0.034;
  const r = width * 0.155;
  return (
    <div style={{ position: "absolute", width: width + pad * 2, height: h + pad * 2, perspective: 3200, ...style }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          transformStyle: "preserve-3d",
          transform: `rotateX(${tilt.x ?? 0}deg) rotateY(${tilt.y ?? 0}deg) rotateZ(${tilt.z ?? 0}deg)`,
        }}
      >
        {/* корпус */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: r + pad,
            background: dark ? "linear-gradient(145deg,#3a3b40,#121214 60%,#2a2b30)" : "linear-gradient(145deg,#4a4b52,#17181b 55%,#3b3c42)",
            boxShadow: `0 ${width * 0.06}px ${width * 0.16}px rgba(20,24,40,${dark ? 0.6 : 0.32}), inset 0 0 0 ${width * 0.004}px rgba(255,255,255,0.18)`,
          }}
        />
        {/* экран */}
        <div style={{ position: "absolute", left: pad, top: pad, width, height: h, borderRadius: r, overflow: "hidden", background: "#000" }}>
          <Img src={staticFile(`phone/${src}.png`)} style={{ width: "100%", height: "100%", display: "block" }} />
          {/* Dynamic Island */}
          <div style={{ position: "absolute", left: "50%", top: width * 0.03, width: width * 0.3, height: width * 0.086, marginLeft: -width * 0.15, borderRadius: width, background: "#000" }} />
          {/* блик на стекле */}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(120deg,rgba(255,255,255,0.14) 0%,rgba(255,255,255,0) 32%)" }} />
        </div>
      </div>
    </div>
  );
};

const Headline: React.FC<{ title: string; sub?: string; light?: boolean; accent: string }> = ({ title, sub, light, accent }) => (
  <div style={{ position: "absolute", left: 110, right: 110, top: 190, fontFamily: FONT, textAlign: "center" }}>
    <div style={{ fontSize: 112, fontWeight: 800, letterSpacing: -3.5, lineHeight: 1.06, color: light ? "#fff" : "#16171d" }}>{title}</div>
    {sub ? <div style={{ marginTop: 34, fontSize: 52, fontWeight: 500, lineHeight: 1.3, color: light ? "rgba(255,255,255,0.72)" : accent }}>{sub}</div> : null}
  </div>
);

const Background: React.FC<{ from: string; to: string; blob: string; blob2: string }> = ({ from, to, blob, blob2 }) => (
  <AbsoluteFill style={{ background: `linear-gradient(170deg,${from} 0%,${to} 100%)` }}>
    <div style={{ position: "absolute", width: 1500, height: 1500, left: -520, top: 900, borderRadius: "50%", background: `radial-gradient(circle,${blob} 0%,transparent 62%)` }} />
    <div style={{ position: "absolute", width: 1300, height: 1300, right: -560, top: -260, borderRadius: "50%", background: `radial-gradient(circle,${blob2} 0%,transparent 62%)` }} />
  </AbsoluteFill>
);

const THEMES = {
  light: { from: "#f6f7f9", to: "#dfe2e9", blob: "rgba(101,81,220,0.22)", blob2: "rgba(160,182,208,0.45)", accent: "#6551dc" },
  blue: { from: "#f1f6fd", to: "#d6e3f6", blob: "rgba(52,120,220,0.28)", blob2: "rgba(150,200,255,0.5)", accent: "#2f6fc4" },
  green: { from: "#f0fbf6", to: "#d3efe2", blob: "rgba(40,150,100,0.26)", blob2: "rgba(150,230,190,0.5)", accent: "#2f8a5e" },
  burgundy: { from: "#fbf1f3", to: "#efd7dd", blob: "rgba(140,40,70,0.24)", blob2: "rgba(240,170,190,0.5)", accent: "#7a344a" },
  purple: { from: "#f4f0ff", to: "#ddd3fb", blob: "rgba(120,92,255,0.3)", blob2: "rgba(255,170,214,0.35)", accent: "#6551dc" },
  dark: { from: "#1c1d22", to: "#050506", blob: "rgba(101,81,220,0.35)", blob2: "rgba(255,255,255,0.08)", accent: "#a99cff" },
};

type SlideProps = { theme: keyof typeof THEMES; title: string; sub?: string; children: React.ReactNode };
const Slide: React.FC<SlideProps> = ({ theme, title, sub, children }) => {
  const t = THEMES[theme];
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Background {...t} />
      {children}
      <Headline title={title} sub={sub} light={theme === "dark"} accent={t.accent} />
    </AbsoluteFill>
  );
};

const PW = 900; // ширина экрана телефона на макете

export const Shot1 = () => (
  <Slide theme="light" title="Просто скажите, сколько потратили" sub="Учёт денег голосом">
    <Phone src="light-home" width={PW} tilt={{ x: 6, y: -14, z: 2 }} style={{ left: 175, top: 820 }} />
  </Slide>
);

export const Shot2 = () => (
  <Slide theme="purple" title="моно сам разберёт траты" sub="Сумма, категория и счёт — за секунду">
    <Phone src="purple-entry" width={PW} tilt={{ x: 4, y: 16, z: -2 }} style={{ left: 175, top: 820 }} />
  </Slide>
);

export const Shot3 = () => (
  <Slide theme="blue" title="Все операции под рукой" sub="Расходы, доходы и переводы">
    <Phone src="blue-history" width={PW} tilt={{ x: 8, y: -18, z: -3 }} style={{ left: 175, top: 840 }} />
  </Slide>
);

export const Shot4 = () => (
  <Slide theme="green" title="Куда уходят деньги" sub="Наглядно по категориям">
    <Phone src="green-chart" width={PW} tilt={{ x: 6, y: 14, z: 3 }} style={{ left: 175, top: 820 }} />
  </Slide>
);

export const Shot5 = () => (
  <Slide theme="burgundy" title="Лимиты, цели и напоминания" sub="Предупредим, если тратите больше плана">
    <Phone src="burgundy-limits" width={PW} tilt={{ x: 5, y: -12, z: -2 }} style={{ left: 175, top: 840 }} />
  </Slide>
);

export const Shot6 = () => (
  <Slide theme="dark" title="Тёмная и чёрно-белая темы" sub="Приятно и днём, и ночью">
    <Phone src="dark-menu" width={640} dark tilt={{ x: 6, y: 22, z: -5 }} style={{ left: 40, top: 1020 }} />
    <Phone src="black-home" width={720} dark tilt={{ x: 6, y: -18, z: 4 }} style={{ left: 480, top: 900 }} />
  </Slide>
);

export const Shot7 = () => (
  <Slide theme="light" title="Темы на любой вкус" sub="Голубая, зелёная, бургунди и другие">
    <Phone src="burgundy-home" width={500} tilt={{ z: -14 }} style={{ left: 30, top: 1400 }} />
    <Phone src="green-home" width={540} tilt={{ z: -5 }} style={{ left: 250, top: 1260 }} />
    <Phone src="purple-home" width={540} tilt={{ z: 5 }} style={{ left: 465, top: 1260 }} />
    <Phone src="blue-home" width={500} tilt={{ z: 14 }} style={{ left: 705, top: 1400 }} />
  </Slide>
);

export const SHOTS = [Shot1, Shot2, Shot3, Shot4, Shot5, Shot6, Shot7];
