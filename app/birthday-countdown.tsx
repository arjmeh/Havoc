"use client";

import { Player } from "@remotion/player";
import type { PlayerRef } from "@remotion/player";
import {
  AbsoluteFill,
  CanvasImage,
  Easing,
  Interactive,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { useEffect, useRef } from "react";

import { FAMOUS_BIRTHDAY_MATCHES } from "./famous-birthdays-data";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const CONFETTI_COLORS = [
  "#c9ff2f",
  "#ef4b47",
  "#7c3aed",
  "#20d9df",
  "#ffb51f",
  "#ff7b70",
] as const;

type BirthdayCountdownProps = {
  day: number;
  daysUntil: number;
  famousName: string;
  monthIndex: number;
  reducedMotion: boolean;
};

function getDaysUntilBirthday(monthIndex: number, day: number) {
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());

  const birthdayForYear = (year: number) => {
    const candidate = Date.UTC(year, monthIndex, day);
    const date = new Date(candidate);

    if (date.getUTCMonth() === monthIndex && date.getUTCDate() === day) {
      return candidate;
    }

    // Celebrate February 29 on March 1 during non-leap years.
    return Date.UTC(year, 2, 1);
  };

  let upcoming = birthdayForYear(now.getFullYear());
  if (upcoming < today) upcoming = birthdayForYear(now.getFullYear() + 1);
  return Math.round((upcoming - today) / 86_400_000);
}

function BirthdayCountdownComposition({
  day,
  daysUntil,
  famousName,
  monthIndex,
  reducedMotion,
}: BirthdayCountdownProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const finalCountFrame = 1.55 * fps;
  const launchFrame = 1.65 * fps;
  const count = reducedMotion
    ? daysUntil
    : Math.round(
        interpolate(frame, [0.22 * fps, finalCountFrame], [0, daysUntil], {
          easing: Easing.bezier(0.12, 0.82, 0.22, 1),
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
      );
  const cardScale = reducedMotion
    ? 1
    : interpolate(frame, [0, 0.5 * fps], [0.82, 1], {
        easing: Easing.spring({ damping: 180 }),
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        output: "perceptual-scale",
      });
  const cannonScale = reducedMotion
    ? 1
    : interpolate(frame, [1.25 * fps, launchFrame], [0.78, 1], {
        easing: Easing.spring({ damping: 145 }),
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        output: "perceptual-scale",
      });
  const cannonTranslate = reducedMotion
    ? 0
    : interpolate(frame, [1.25 * fps, launchFrame], [96, 0], {
        easing: Easing.bezier(0.16, 1, 0.3, 1),
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
  const factOpacity = reducedMotion
    ? 1
    : interpolate(frame, [2.25 * fps, 2.65 * fps], [0, 1], {
        easing: Easing.bezier(0.16, 1, 0.3, 1),
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });

  return (
    <AbsoluteFill
      style={{
        overflow: "hidden",
        background:
          "radial-gradient(circle at 14% 8%, rgba(201,255,47,.6), transparent 25%), radial-gradient(circle at 88% 17%, rgba(124,58,237,.2), transparent 25%), linear-gradient(180deg,#fffef8 0%,#fff4eb 54%,#f3eaff 100%)",
        color: "#17131f",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <Interactive.Div
        name="Birthday reveal heading"
        style={{
          position: "absolute",
          top: 76,
          right: 34,
          left: 34,
          textAlign: "center",
          opacity: reducedMotion
            ? 1
            : interpolate(frame, [0, 0.32 * fps], [0, 1], {
                easing: Easing.bezier(0.16, 1, 0.3, 1),
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
          translate: reducedMotion
            ? "0px 0px"
            : interpolate(frame, [0, 0.38 * fps], ["0px 18px", "0px 0px"], {
                easing: Easing.bezier(0.16, 1, 0.3, 1),
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
        }}
      >
        <span
          style={{
            display: "inline-flex",
            minHeight: 34,
            alignItems: "center",
            padding: "0 16px",
            border: "3px solid #17131f",
            borderRadius: 999,
            background: "#c9ff2f",
            boxShadow: "3px 4px 0 #17131f",
            fontSize: 14,
            fontWeight: 950,
            letterSpacing: ".08em",
            textTransform: "uppercase",
          }}
        >
          {MONTHS[monthIndex]} {day}
        </span>
        <h2
          style={{
            maxWidth: 540,
            margin: "27px auto 0",
            fontSize: 58,
            fontWeight: 950,
            lineHeight: 0.92,
            letterSpacing: "-.055em",
          }}
        >
          Your birthday is in…
        </h2>
      </Interactive.Div>

      <Interactive.Div
        name="Day count keycap"
        style={{
          position: "absolute",
          top: 274,
          left: 182,
          display: "grid",
          width: 276,
          height: 244,
          placeItems: "center",
          border: "8px solid #17131f",
          borderRadius: 62,
          background:
            "radial-gradient(circle at 34% 16%,#ffb4a6 0 8%,transparent 27%), linear-gradient(160deg,#ff7770 0 19%,#ef4b47 52%,#c8282d 100%)",
          boxShadow:
            "0 17px 0 #17131f, inset 0 8px 14px rgba(255,216,206,.62), inset 0 -18px 28px rgba(126,16,31,.36)",
          color: "#fff",
          scale: cardScale,
        }}
      >
        <span
          style={{
            fontSize: count >= 100 ? 116 : 142,
            fontWeight: 950,
            lineHeight: 1,
            letterSpacing: "-.07em",
            textShadow: "0 6px 0 rgba(112,15,27,.45)",
          }}
        >
          {count}
        </span>
      </Interactive.Div>

      <Interactive.Div
        name="Days label"
        style={{
          position: "absolute",
          top: 548,
          right: 0,
          left: 0,
          fontSize: 28,
          fontWeight: 950,
          letterSpacing: ".14em",
          textAlign: "center",
          textTransform: "uppercase",
        }}
      >
        {daysUntil === 0 ? "That means today!" : daysUntil === 1 ? "day" : "days"}
      </Interactive.Div>

      <Interactive.Div
        name="Famous birthday twin"
        style={{
          position: "absolute",
          zIndex: 5,
          top: 624,
          right: 48,
          left: 48,
          minHeight: 132,
          padding: "20px 25px",
          border: "5px solid #17131f",
          borderRadius: 32,
          background: "#fffef8",
          boxShadow: "7px 9px 0 #17131f",
          opacity: factOpacity,
          scale: reducedMotion
            ? 1
            : interpolate(frame, [2.25 * fps, 2.65 * fps], [0.86, 1], {
                easing: Easing.spring({ damping: 160 }),
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                output: "perceptual-scale",
              }),
        }}
      >
        <span
          style={{
            display: "block",
            color: "#7c3aed",
            fontSize: 14,
            fontWeight: 950,
            letterSpacing: ".11em",
            textTransform: "uppercase",
          }}
        >
          Fun fact
        </span>
        <strong
          style={{
            display: "block",
            marginTop: 9,
            fontSize: famousName.length > 22 ? 26 : 31,
            lineHeight: 1.05,
            letterSpacing: "-.03em",
          }}
        >
          You share a birthday with {famousName}!
        </strong>
      </Interactive.Div>

      {!reducedMotion
        ? Array.from({ length: 34 }, (_, index) => {
            const side = index % 2 === 0 ? -1 : 1;
            const localIndex = Math.floor(index / 2);
            const particleStart = launchFrame + (localIndex % 5) * 1.2;
            const particleProgress = interpolate(
              frame,
              [particleStart, particleStart + 2.1 * fps],
              [0, 1],
              {
                easing: Easing.out(Easing.cubic),
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              },
            );
            const originX = side === -1 ? 166 : 474;
            const spread = ((localIndex * 37) % 170) - 85;
            const x = originX + spread * particleProgress;
            const y =
              788 -
              (410 + (localIndex % 6) * 28) * particleProgress +
              235 * particleProgress * particleProgress;
            const opacity = interpolate(
              particleProgress,
              [0, 0.08, 0.84, 1],
              [0, 1, 1, 0],
              {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              },
            );

            return (
              <span
                key={index}
                style={{
                  position: "absolute",
                  zIndex: 4,
                  left: 0,
                  top: 0,
                  width: localIndex % 3 === 0 ? 14 : 10,
                  height: localIndex % 3 === 0 ? 25 : 18,
                  border: "2px solid rgba(23,19,31,.4)",
                  borderRadius: localIndex % 4 === 0 ? 999 : 4,
                  background: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
                  opacity,
                  rotate: `${side * (50 + localIndex * 31) * particleProgress}deg`,
                  translate: `${x}px ${y}px`,
                }}
              />
            );
          })
        : null}

      <CanvasImage
        name="Havoc confetti cannons"
        src={staticFile("havoc-confetti-cannons.png")}
        width={1254}
        height={1254}
        style={{
          position: "absolute",
          zIndex: 3,
          right: 0,
          bottom: -4,
          left: 0,
          width: 640,
          height: 640,
          scale: cannonScale,
          translate: `0px ${cannonTranslate}px`,
        }}
      />
    </AbsoluteFill>
  );
}

export function BirthdayCountdownScreen({
  day,
  monthIndex,
  next,
  reducedMotion,
}: {
  day: number;
  monthIndex: number;
  next: () => void;
  reducedMotion: boolean;
}) {
  const daysUntil = getDaysUntilBirthday(monthIndex, day);
  const famousName =
    FAMOUS_BIRTHDAY_MATCHES[`${monthIndex + 1}-${day}`] ?? "someone iconic";
  const playerRef = useRef<PlayerRef>(null);

  useEffect(() => {
    const startedAt = window.performance.now();
    let animationFrame = 0;
    const tick = (now: number) => {
      const elapsed = now - startedAt;
      const frame = reducedMotion
        ? 149
        : Math.min(149, Math.floor((elapsed / 1000) * 30));
      playerRef.current?.seekTo(frame);
      if (frame < 149) animationFrame = window.requestAnimationFrame(tick);
    };
    animationFrame = window.requestAnimationFrame(tick);
    const timer = window.setTimeout(next, 5000);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(timer);
    };
  }, [next, reducedMotion]);

  return (
    <div
      className="screen birthday-countdown-screen"
      data-countdown-days={daysUntil}
      aria-label={`${daysUntil} days until ${MONTHS[monthIndex]} ${day}. You share a birthday with ${famousName}.`}
    >
      <Player
        ref={playerRef}
        component={BirthdayCountdownComposition}
        inputProps={{
          day,
          daysUntil,
          famousName,
          monthIndex,
          reducedMotion,
        }}
        durationInFrames={150}
        compositionWidth={640}
        compositionHeight={1080}
        fps={30}
        autoPlay={false}
        acknowledgeRemotionLicense
        controls={false}
        loop={false}
        clickToPlay={false}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
        }}
      />
      <span className="sr-only" aria-live="polite">
        {daysUntil === 0
          ? `Your birthday is today. You share it with ${famousName}.`
          : `Your birthday is in ${daysUntil} days. You share it with ${famousName}.`}
      </span>
    </div>
  );
}
