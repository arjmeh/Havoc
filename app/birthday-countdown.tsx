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
} from "remotion";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from "react";

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
  "#f5c84b",
] as const;

const ENTRY_END_FRAME = 18;
const SPIN_START_FRAME = 19;
const RESULT_FRAME = 88;
const CELEBRATION_START_FRAME = 90;
const FINAL_FRAME = 262;

type SlotPhase =
  | "entering"
  | "ready"
  | "spinning"
  | "revealed"
  | "celebrating";

type BirthdaySlotProps = {
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

function positiveModulo(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor;
}

function SlotReel({
  frame,
  index,
  targetDigit,
}: {
  frame: number;
  index: number;
  targetDigit: number;
}) {
  const stopFrame = [50, 60, 70][index];
  const turns = [12, 15, 18][index];
  const isWaiting = frame <= ENTRY_END_FRAME;
  const spinPosition =
    frame < SPIN_START_FRAME
      ? 0
      : interpolate(
          frame,
          [SPIN_START_FRAME, stopFrame - 5, stopFrame],
          [0, turns * 10 + targetDigit - 0.12, turns * 10 + targetDigit],
          {
            easing: [
              Easing.bezier(0.12, 0.72, 0.18, 1),
              Easing.spring({ damping: 150 }),
            ],
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          },
        );
  const baseDigit = Math.floor(spinPosition);
  const fraction = spinPosition - baseDigit;
  const stopImpact = interpolate(
    frame,
    [stopFrame - 1, stopFrame, stopFrame + 2, stopFrame + 4],
    [0, 9, -4, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );

  return (
    <Interactive.Div
      name={`Reel ${index + 1}`}
      data-reel-index={index}
      data-reel-state={
        isWaiting ? "waiting" : frame >= stopFrame ? "stopped" : "spinning"
      }
      data-reel-value={
        frame >= stopFrame
          ? targetDigit
          : positiveModulo(baseDigit, 10)
      }
      style={{
        position: "relative",
        overflow: "hidden",
        height: 211,
        borderRadius: 28,
        background:
          "linear-gradient(180deg,#d33a39 0%,#f45c54 25%,#ef4b47 60%,#bd272f 100%)",
        boxShadow:
          "inset 0 18px 26px rgba(89,10,26,.38), inset 0 -20px 26px rgba(89,10,26,.38), 0 0 0 4px #17131f",
      }}
    >
      <div
        style={{
          position: "absolute",
          zIndex: 2,
          inset: 0,
          borderRadius: 28,
          background:
            "linear-gradient(180deg,rgba(23,19,31,.42),transparent 29%,transparent 70%,rgba(23,19,31,.46))",
          pointerEvents: "none",
        }}
      />
      {isWaiting ? (
        <span
          style={{
            display: "grid",
            height: "100%",
            placeItems: "center",
            color: "#fffef8",
            fontSize: 105,
            fontWeight: 950,
            lineHeight: 1,
            textShadow: "0 5px 0 rgba(83,8,25,.45)",
          }}
        >
          —
        </span>
      ) : (
        Array.from({ length: 5 }, (_, offsetIndex) => {
          const relativeIndex = offsetIndex - 2;
          const digit = positiveModulo(baseDigit + relativeIndex, 10);

          return (
            <span
              key={`${baseDigit}-${relativeIndex}`}
              style={{
                position: "absolute",
                top: "50%",
                right: 0,
                left: 0,
                color: "#fffef8",
                fontSize: 131,
                fontWeight: 950,
                lineHeight: 1,
                textAlign: "center",
                textShadow: "0 6px 0 rgba(83,8,25,.46)",
                translate: `0px calc(-50% + ${(relativeIndex - fraction) * 169 + stopImpact * 1.38}px)`,
              }}
            >
              {digit}
            </span>
          );
        })
      )}
    </Interactive.Div>
  );
}

function BirthdaySlotComposition({
  day,
  daysUntil,
  famousName,
  monthIndex,
  reducedMotion,
}: BirthdaySlotProps) {
  const frame = useCurrentFrame();
  const digits = String(daysUntil).padStart(3, "0").split("").map(Number);
  const resultVisible = reducedMotion
    ? frame >= SPIN_START_FRAME
    : frame >= 72;
  const celebrationProgress = interpolate(
    frame,
    [CELEBRATION_START_FRAME, FINAL_FRAME],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
  const machineOpacity = interpolate(
    frame,
    [232, 239],
    [1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
  const famousNameFontSize =
    famousName.length >= 22
      ? 22
      : famousName.length >= 19
        ? 24
        : famousName.length >= 16
          ? 27
          : famousName.length >= 13
            ? 30
            : 34;

  return (
    <AbsoluteFill
      style={{
        overflow: "hidden",
        background:
          "radial-gradient(circle at 11% 7%,rgba(201,255,47,.58),transparent 24%),radial-gradient(circle at 92% 17%,rgba(124,58,237,.24),transparent 27%),linear-gradient(180deg,#fffef8 0%,#fff2e7 62%,#eee5ff 100%)",
        color: "#17131f",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <Interactive.Div
        name="Slot machine scene"
        style={{
          position: "absolute",
          zIndex: 2,
          inset: 0,
          opacity: machineOpacity,
          scale: reducedMotion
            ? 1
            : interpolate(frame, [0, 14, 18], [0.94, 1.012, 1], {
                easing: Easing.spring({ damping: 170 }),
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                output: "perceptual-scale",
              }),
          translate: reducedMotion
            ? "0px 0px"
            : interpolate(frame, [0, 18], ["0px 82px", "0px 0px"], {
                easing: Easing.bezier(0.16, 1, 0.3, 1),
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
        }}
      >
        <CanvasImage
          name="Havoc birthday slot machine"
          src={staticFile("havoc-birthday-slot-machine.png")}
          width={864}
          height={1821}
          style={{
            position: "absolute",
            top: 195,
            left: 15,
            width: 610,
            height: 1285,
            // The draggable CSS lever covers the artwork's arm before launch.
            // Reveal the artwork's real arm for the celebration so it remains
            // attached to the machine and can be buried by the confetti layer.
            clipPath:
              frame >= CELEBRATION_START_FRAME
                ? "polygon(0 0,100% 0,100% 90.35%,0 90.35%)"
                : "polygon(0 0,87% 0,87% 90.35%,0 90.35%)",
          }}
        />

        <div
          style={{
            position: "absolute",
            zIndex: 4,
            top: 517,
            left: 121,
            display: "grid",
            width: 371,
            gridTemplateColumns: "repeat(3,1fr)",
            gap: 10,
          }}
        >
          {digits.map((digit, index) => (
            <SlotReel
              frame={reducedMotion && frame >= SPIN_START_FRAME ? 88 : frame}
              index={index}
              key={index}
              targetDigit={digit}
            />
          ))}
        </div>

        <Interactive.Div
          name="Days label"
          style={{
            position: "absolute",
            zIndex: 5,
            top: 886,
            left: 140,
            display: "grid",
            width: 360,
            minHeight: 67,
            placeItems: "center",
            padding: "0 21px",
            border: "5px solid #e4b54b",
            borderRadius: 22,
            background: "#17131f",
            boxShadow: "0 7px 0 rgba(23,19,31,.32)",
            color: "#fffef8",
            fontSize: 23,
            fontWeight: 950,
            letterSpacing: ".05em",
            lineHeight: 1.05,
            textAlign: "center",
            textTransform: "uppercase",
            opacity: resultVisible
              ? interpolate(frame, [72, 80], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                })
              : 0,
            translate: resultVisible
              ? interpolate(frame, [72, 80], ["0px -18px", "0px 0px"], {
                  easing: Easing.bezier(0.16, 1, 0.3, 1),
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                })
              : "0px -18px",
          }}
        >
          {daysUntil === 0
            ? "Your birthday is today"
            : daysUntil === 1
              ? "Day until your birthday"
              : "Days until your birthday"}
        </Interactive.Div>

        <Interactive.Div
          name="Birthday twin plaque"
          style={{
            position: "absolute",
            zIndex: 5,
            top: 1153,
            // The plaque is optically left of the artwork canvas because of the lever.
            left: 159,
            display: "flex",
            width: 288,
            height: 128,
            boxSizing: "border-box",
            alignItems: "center",
            flexDirection: "column",
            justifyContent: "center",
            padding: "12px 20px",
            color: "#17131f",
            fontFamily:
              "var(--font-fredoka), 'Arial Rounded MT Bold', Arial, sans-serif",
            opacity: resultVisible
              ? interpolate(frame, [76, 84], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                })
              : 0,
            scale: resultVisible
              ? interpolate(frame, [76, 80, 82, 84], [1.17, 0.96, 1.03, 1], {
                  easing: Easing.spring({ damping: 170 }),
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                  output: "perceptual-scale",
                })
              : 1.17,
            overflow: "hidden",
            textAlign: "center",
          }}
        >
          <span
            style={{
              display: "block",
              width: "100%",
              fontSize: 16,
              fontWeight: 800,
              letterSpacing: ".075em",
              lineHeight: 1,
              textAlign: "center",
              textTransform: "uppercase",
            }}
          >
            Your birthday twin
          </span>
          <strong
            style={{
              display: "block",
              width: "100%",
              maxHeight: 70,
              marginTop: 8,
              overflow: "visible",
              fontSize: famousNameFontSize,
              fontWeight: 800,
              letterSpacing: "-.035em",
              lineHeight: 1.08,
              overflowWrap: "break-word",
              textAlign: "center",
              textWrap: "balance",
            }}
          >
            {famousName}
          </strong>
        </Interactive.Div>
      </Interactive.Div>

      {frame >= CELEBRATION_START_FRAME ? (
        <>
          <CanvasImage
            name="Overhead confetti cannon"
            src={staticFile("havoc-overhead-confetti-cannon.png")}
            width={864}
            height={1820}
            style={{
              position: "absolute",
              zIndex: 35,
              top: -390,
              left: 170,
              width: 300,
              height: 632,
              opacity: interpolate(frame, [90, 94, 225, 234], [0, 1, 1, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              rotate: reducedMotion
                ? "0deg"
                : interpolate(
                    frame,
                    [90, 100, 134, 158, 175, 187, 196, 203, 209, 214, 219, 224, 234],
                    [
                      "0deg",
                      "-6deg",
                      "9deg",
                      "-11deg",
                      "12deg",
                      "-13deg",
                      "14deg",
                      "-15deg",
                      "15deg",
                      "-14deg",
                      "11deg",
                      "0deg",
                      "0deg",
                    ],
                    {
                      easing: Easing.inOut(Easing.quad),
                      extrapolateLeft: "clamp",
                      extrapolateRight: "clamp",
                    },
                  ),
              scale: interpolate(frame, [90, 100, 103], [0.88, 1.02, 1], {
                easing: Easing.spring({ damping: 170 }),
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                output: "perceptual-scale",
              }),
              transformOrigin: "50% 15.4%",
              translate: reducedMotion
                ? "0px 0px"
                : interpolate(
                    frame,
                    [90, 100, 134, 158, 175, 187, 196, 203, 209, 214, 219, 224, 234],
                    [
                      "-340px -190px",
                      "-340px 0px",
                      "340px 0px",
                      "-340px 0px",
                      "340px 0px",
                      "-340px 0px",
                      "340px 0px",
                      "-340px 0px",
                      "340px 0px",
                      "-340px 0px",
                      "340px 0px",
                      "0px 0px",
                      "0px -240px",
                    ],
                    {
                      easing: Easing.inOut(Easing.quad),
                      extrapolateLeft: "clamp",
                      extrapolateRight: "clamp",
                    },
                  ),
            }}
          />

          {Array.from({ length: reducedMotion ? 2160 : 4096 }, (_, index) => {
            // The square-root distribution deliberately increases the emission
            // rate: a trickle at first, then a near-solid burst at full speed.
            const particleCount = reducedMotion ? 2160 : 4096;
            const particleColumns = reducedMotion ? 40 : 64;
            const particleRows = particleCount / particleColumns;
            const startFrame =
              102 + 112 * Math.sqrt(index / (particleCount - 1));
            const birthCannonX = reducedMotion
              ? 0
              : interpolate(
                  startFrame,
                  [100, 134, 158, 175, 187, 196, 203, 209, 214, 219, 224],
                  [-340, 340, -340, 340, -340, 340, -340, 340, -340, 340, 0],
                  {
                    easing: Easing.inOut(Easing.quad),
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  },
                );
            const previousCannonX = reducedMotion
              ? 0
              : interpolate(
                  startFrame - 1,
                  [100, 134, 158, 175, 187, 196, 203, 209, 214, 219, 224],
                  [-340, 340, -340, 340, -340, 340, -340, 340, -340, 340, 0],
                  {
                    easing: Easing.inOut(Easing.quad),
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  },
                );
            const nextCannonX = reducedMotion
              ? 0
              : interpolate(
                  startFrame + 1,
                  [100, 134, 158, 175, 187, 196, 203, 209, 214, 219, 224],
                  [-340, 340, -340, 340, -340, 340, -340, 340, -340, 340, 0],
                  {
                    easing: Easing.inOut(Easing.quad),
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  },
                );
            const birthSwayDegrees = reducedMotion
              ? 0
              : interpolate(
                  startFrame,
                  [100, 134, 158, 175, 187, 196, 203, 209, 214, 219, 224],
                  [-6, 9, -11, 12, -13, 14, -15, 15, -14, 11, 0],
                  {
                    easing: Easing.inOut(Easing.quad),
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  },
                );
            const birthSwayRadians = (birthSwayDegrees * Math.PI) / 180;
            const mouthOffset = ((index * 47) % 33) - 16;
            const sourceX =
              320 +
              birthCannonX -
              Math.sin(birthSwayRadians) * 400 +
              Math.cos(birthSwayRadians) * mouthOffset;
            const sourceY =
              -293 +
              Math.cos(birthSwayRadians) * 400 +
              Math.sin(birthSwayRadians) * mouthOffset;
            const inheritedVelocity = Math.max(
              -150,
              Math.min(150, (nextCannonX - previousCannonX) * 2.2),
            );
            const spreadRadians =
              ((((index * 37) % 101) / 100) - 0.5) * 0.9;
            const launchRadians = birthSwayRadians + spreadRadians;
            const launchDistance = 185 + (index % 11) * 11;
            const controlX =
              sourceX -
              Math.sin(launchRadians) * launchDistance +
              inheritedVelocity;
            const controlY =
              sourceY + Math.cos(launchRadians) * launchDistance;
            const cellIndex = (index * 487) % particleCount;
            const column = cellIndex % particleColumns;
            const row = Math.floor(cellIndex / particleColumns);
            const jitterX =
              ((((index * 83) % 103) / 102) - 0.5) * 6;
            const jitterY =
              ((((index * 149) % 107) / 106) - 0.5) * 10;
            const targetX = Math.max(
              -30,
              Math.min(
                670,
                (column / (particleColumns - 1)) * 640 + jitterX,
              ),
            );
            const targetY = Math.max(
              -38,
              Math.min(
                1393,
                (row / (particleRows - 1)) * 1355 + jitterY,
              ),
            );
            const settleFrame = Math.min(
              231,
              startFrame + 28 + (index % 12),
            );
            const flightProgress = interpolate(
              frame,
              [startFrame, settleFrame],
              [0, 1],
              {
                easing: Easing.bezier(0.12, 0.72, 0.2, 1),
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              },
            );
            const fallProgress = interpolate(
              frame,
              [242, 262],
              [0, 1],
              {
                easing: Easing.in(Easing.quad),
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              },
            );
            const inverseFlightProgress = 1 - flightProgress;
            const flutter =
              Math.sin((frame - startFrame) * 0.58 + index * 1.73) *
              (1 - flightProgress) *
              (12 + (index % 5) * 3);
            const flightX =
              inverseFlightProgress *
                inverseFlightProgress *
                sourceX +
              2 *
                inverseFlightProgress *
                flightProgress *
                controlX +
              flightProgress * flightProgress * targetX +
              flutter;
            const flightY =
              inverseFlightProgress *
                inverseFlightProgress *
                sourceY +
              2 *
                inverseFlightProgress *
                flightProgress *
                controlY +
              flightProgress * flightProgress * targetY +
              Math.sin(flightProgress * Math.PI) *
                (90 + (index % 9) * 12);
            const fallDrift = ((index * 31) % 180) - 90;
            const entranceOpacity = interpolate(
              frame,
              [startFrame, startFrame + 2],
              [0, 1],
              {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              },
            );
            const exitOpacity = interpolate(
              fallProgress,
              [0, 0.82, 1],
              [1, 1, 0],
              {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              },
            );
            const pieceWidth =
              index % 11 === 0
                ? 28
                : index % 5 === 0
                  ? 24
                  : index % 3 === 0
                    ? 22
                    : 20;
            const pieceHeight =
              index % 13 === 0
                ? 42
                : index % 7 === 0
                  ? 38
                  : index % 3 === 0
                    ? 34
                    : 32;

            return (
              <span
                key={index}
                style={{
                  position: "absolute",
                  zIndex: 30 + (index % 3),
                  top: 0,
                  left: 0,
                  width: pieceWidth,
                  height: pieceHeight,
                  border: "1px solid rgba(23,19,31,.38)",
                  borderRadius:
                    index % 5 === 0
                      ? 999
                      : index % 4 === 0
                        ? 8
                        : 3,
                  background:
                    CONFETTI_COLORS[index % CONFETTI_COLORS.length],
                  opacity: entranceOpacity * exitOpacity,
                  rotate: `${
                    (index % 2 === 0 ? 1 : -1) *
                      (360 + index * 17) *
                      flightProgress +
                    Math.sin((frame - startFrame) * 0.42 + index) *
                      28 *
                      (1 - flightProgress) +
                    720 * fallProgress
                  }deg`,
                  translate: reducedMotion
                    ? `${targetX}px ${targetY}px`
                    : `${
                        flightX + fallDrift * fallProgress
                      }px ${
                        flightY +
                        (1450 + ((index * 53) % 420)) * fallProgress
                      }px`,
                  willChange: "translate, rotate, opacity",
                }}
              />
            );
          })}
        </>
      ) : null}

      <div
        style={{
          position: "absolute",
          zIndex: 1,
          inset: 0,
          background: "#fffef8",
          opacity: interpolate(
            celebrationProgress,
            [0.83, 0.87],
            [0, 1],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            },
          ),
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
  const animationFrameRef = useRef<number | null>(null);
  const leverButtonRef = useRef<HTMLButtonElement>(null);
  const continueButtonRef = useRef<HTMLButtonElement>(null);
  const pullStartRef = useRef<number | null>(null);
  const committedPullRef = useRef(false);
  const [phase, setPhase] = useState<SlotPhase>("entering");
  const [leverPull, setLeverPull] = useState(0);
  const resultAnnouncement = useMemo(
    () =>
      daysUntil === 0
        ? `Your birthday is today. You share your big day with ${famousName}.`
        : `${daysUntil} ${daysUntil === 1 ? "day" : "days"} until your birthday. You share your big day with ${famousName}.`,
    [daysUntil, famousName],
  );

  const stopAnimation = useCallback(() => {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  const playFrames = useCallback(
    (
      fromFrame: number,
      toFrame: number,
      durationMs: number,
      onComplete: () => void,
    ) => {
      stopAnimation();
      playerRef.current?.seekTo(fromFrame);
      const startedAt = window.performance.now();

      const tick = (now: number) => {
        const progress = Math.min(1, (now - startedAt) / durationMs);
        const frame = Math.round(
          interpolate(progress, [0, 1], [fromFrame, toFrame], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        );
        playerRef.current?.seekTo(frame);

        if (progress < 1) {
          animationFrameRef.current = window.requestAnimationFrame(tick);
          return;
        }

        animationFrameRef.current = null;
        onComplete();
      };

      animationFrameRef.current = window.requestAnimationFrame(tick);
    },
    [stopAnimation],
  );

  const startSpin = useCallback(() => {
    if (phase !== "ready") return;
    committedPullRef.current = true;
    setLeverPull(82);
    setPhase("spinning");
    navigator.vibrate?.(16);

    window.setTimeout(() => setLeverPull(0), reducedMotion ? 80 : 170);
    playFrames(
      SPIN_START_FRAME,
      RESULT_FRAME,
      reducedMotion ? 220 : 2050,
      () => {
        setPhase("revealed");
        navigator.vibrate?.([12, 42, 16]);
        window.setTimeout(
          () => continueButtonRef.current?.focus({ preventScroll: true }),
          30,
        );
      },
    );
  }, [phase, playFrames, reducedMotion]);

  const startCelebration = useCallback(() => {
    if (phase !== "revealed") return;
    setPhase("celebrating");
    navigator.vibrate?.(18);
    playFrames(
      CELEBRATION_START_FRAME,
      FINAL_FRAME,
      reducedMotion ? 1300 : 4800,
      next,
    );
  }, [next, phase, playFrames, reducedMotion]);

  useEffect(() => {
    playFrames(0, ENTRY_END_FRAME, reducedMotion ? 90 : 480, () => {
      setPhase("ready");
      window.setTimeout(
        () => leverButtonRef.current?.focus({ preventScroll: true }),
        30,
      );
    });
    return stopAnimation;
  }, [playFrames, reducedMotion, stopAnimation]);

  const onLeverPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (phase !== "ready") return;
    committedPullRef.current = false;
    pullStartRef.current = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
    navigator.vibrate?.(7);
  };

  const onLeverPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (phase !== "ready" || pullStartRef.current === null) return;
    event.preventDefault();
    const distance = Math.max(0, Math.min(88, event.clientY - pullStartRef.current));
    setLeverPull(distance);
  };

  const finishLeverPull = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (pullStartRef.current === null) return;
    event.preventDefault();
    const distance = Math.max(0, event.clientY - pullStartRef.current);
    pullStartRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (distance >= 32) {
      startSpin();
      return;
    }

    setLeverPull(0);
  };

  const onLeverKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowDown") return;
    event.preventDefault();
    startSpin();
  };

  return (
    <div
      className="screen birthday-countdown-screen birthday-slot-screen"
      data-countdown-days={daysUntil}
      data-slot-phase={phase}
      aria-label={`Birthday slot machine for ${MONTHS[monthIndex]} ${day}`}
    >
      <div className="birthday-slot-player" aria-hidden="true">
        <Player
          className="birthday-slot-remotion-player"
          ref={playerRef}
          component={BirthdaySlotComposition}
          inputProps={{
            day,
            daysUntil,
            famousName,
            monthIndex,
            reducedMotion,
          }}
          durationInFrames={263}
          compositionWidth={640}
          compositionHeight={1355}
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
            pointerEvents: "none",
          }}
        />
      </div>

      <button
        ref={leverButtonRef}
        type="button"
        className="birthday-slot-lever"
        disabled={phase !== "ready"}
        onClick={() => {
          if (committedPullRef.current) {
            committedPullRef.current = false;
            return;
          }
          startSpin();
        }}
        onKeyDown={onLeverKeyDown}
        onPointerDown={onLeverPointerDown}
        onPointerMove={onLeverPointerMove}
        onPointerUp={finishLeverPull}
        onPointerCancel={(event) => {
          pullStartRef.current = null;
          setLeverPull(0);
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
        style={{ "--lever-pull": `${leverPull}px` } as React.CSSProperties}
        aria-label="Pull the lever to reveal days until your birthday"
      >
        <span className="slot-lever-base" aria-hidden="true" />
        <span className="slot-lever-stem" aria-hidden="true" />
        <span className="slot-lever-knob" aria-hidden="true" />
        {phase === "ready" ? (
          <span
            className="slot-lever-cue"
            style={{ right: "105%" }}
            aria-hidden="true"
          >
            <b>Pull down</b>
            <i>↓</i>
          </span>
        ) : null}
      </button>

      {phase === "revealed" ? (
        <button
          ref={continueButtonRef}
          type="button"
          className="birthday-slot-continue"
          onClick={startCelebration}
        >
          Tap to continue
        </button>
      ) : null}

      <span className="sr-only" aria-live="polite">
        {phase === "spinning"
          ? "Spinning birthday countdown."
          : phase === "revealed"
            ? resultAnnouncement
            : phase === "ready"
              ? "Slot machine ready. Pull the lever or press Enter."
              : ""}
      </span>
    </div>
  );
}
