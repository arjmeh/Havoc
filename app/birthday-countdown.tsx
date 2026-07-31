"use client";

import { Player } from "@remotion/player";
import type { PlayerRef } from "@remotion/player";
import {
  AbsoluteFill,
  Easing,
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
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from "react";

import styles from "./birthday-countdown.module.css";
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

const COMPOSITION_WIDTH = 640;
const COMPOSITION_HEIGHT = 1355;
const ENTRY_END_FRAME = 16;
const SPIN_START_FRAME = 17;
const RESULT_FRAME = 82;
const CELEBRATION_START_FRAME = 86;
const EXIT_START_FRAME = 190;
const FINAL_FRAME = 214;
const MAX_LEVER_PULL = 82;

const MACHINE = {
  height: 1138,
  left: 30,
  top: 112,
  width: 540,
} as const;

const REELS = {
  gap: 9,
  height: 187,
  left: 124,
  top: 397,
  width: 328,
} as const;

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
  leverPull: number;
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

function seededUnit(seed: number) {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43_758.5453;
  return value - Math.floor(value);
}

function getReelPosition(
  frame: number,
  stopFrame: number,
  targetCell: number,
) {
  if (frame <= SPIN_START_FRAME) return 0;

  const launchEnd = SPIN_START_FRAME + 9;
  const brakeStart = stopFrame - 11;
  const settleStart = stopFrame - 3;

  if (frame < launchEnd) {
    return interpolate(frame, [SPIN_START_FRAME, launchEnd], [0, 4.4], {
      easing: Easing.bezier(0.55, 0.02, 0.82, 0.42),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  }

  if (frame < brakeStart) {
    return interpolate(
      frame,
      [launchEnd, brakeStart],
      [4.4, targetCell - 1.15],
      {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      },
    );
  }

  if (frame < settleStart) {
    return interpolate(
      frame,
      [brakeStart, settleStart],
      [targetCell - 1.15, targetCell + 0.14],
      {
        easing: Easing.bezier(0.12, 0.78, 0.22, 1),
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      },
    );
  }

  return interpolate(
    frame,
    [settleStart, stopFrame],
    [targetCell + 0.14, targetCell],
    {
      easing: Easing.bezier(0.2, 0.82, 0.24, 1),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
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
  const stopFrame = [58, 68, 78][index];
  const turns = [6, 8, 10][index];
  const targetCell = turns * 10 + targetDigit;
  const position = getReelPosition(frame, stopFrame, targetCell);
  const cyclePosition = ((position % 10) + 10) % 10;
  const isWaiting = frame < SPIN_START_FRAME;
  const isSpinning = frame >= SPIN_START_FRAME && frame < stopFrame;
  const stopImpact = interpolate(
    frame,
    [stopFrame - 2, stopFrame, stopFrame + 2, stopFrame + 4],
    [0, 1, -0.35, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
  const motionBlur = isSpinning
    ? interpolate(frame, [SPIN_START_FRAME, stopFrame - 9, stopFrame], [0.4, 2.4, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 0;

  return (
    <div
      className={styles.reelWindow}
      data-reel-index={index}
      data-reel-state={
        isWaiting ? "waiting" : frame >= stopFrame ? "stopped" : "spinning"
      }
      data-reel-value={frame >= stopFrame ? targetDigit : undefined}
      style={{
        transform: `translate3d(0, ${stopImpact * 4}px, 0) scaleY(${
          1 - Math.abs(stopImpact) * 0.018
        })`,
      }}
    >
      <div className={styles.reelShade} />
      <span
        className={styles.reelDash}
        style={{
          opacity: interpolate(
            frame,
            [SPIN_START_FRAME - 1, SPIN_START_FRAME + 2],
            [1, 0],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            },
          ),
        }}
      >
        —
      </span>
      <div
        className={styles.reelStrip}
        style={{
          filter: `blur(${motionBlur}px)`,
          opacity: interpolate(
            frame,
            [SPIN_START_FRAME, SPIN_START_FRAME + 2],
            [0, 1],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            },
          ),
          transform: `translate3d(0, ${-cyclePosition * REELS.height}px, 0)`,
        }}
      >
        {Array.from({ length: 20 }, (_, cellIndex) => (
          <span className={styles.reelDigit} key={cellIndex}>
            {cellIndex % 10}
          </span>
        ))}
      </div>
    </div>
  );
}

function ConfettiParticle({
  frame,
  index,
  reducedMotion,
}: {
  frame: number;
  index: number;
  reducedMotion: boolean;
}) {
  if (reducedMotion) {
    const angle = seededUnit(index + 4) * Math.PI * 2;
    const radius = 130 + seededUnit(index + 18) * 205;
    const x = COMPOSITION_WIDTH / 2 + Math.cos(angle) * radius;
    const y = 850 + Math.sin(angle) * radius * 0.62;
    const opacity =
      interpolate(frame, [CELEBRATION_START_FRAME, CELEBRATION_START_FRAME + 4], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }) *
      interpolate(frame, [EXIT_START_FRAME, FINAL_FRAME], [1, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });

    return (
      <span
        className={styles.confettiPiece}
        style={{
          background: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
          borderRadius: index % 4 === 0 ? 999 : 2,
          height: 18 + (index % 3) * 3,
          left: x,
          opacity,
          top: y,
          transform: `rotate(${index * 37}deg)`,
          width: 8 + (index % 2) * 3,
          zIndex: index % 3 === 0 ? 1 : 6,
        }}
      />
    );
  }

  const groupSize = 60;
  const wave = Math.floor(index / groupSize);
  const slot = index % groupSize;
  const isLeft = slot % 2 === 0;
  const startFrame =
    CELEBRATION_START_FRAME + 8 + wave * 25 + (slot % 12) * 0.55;
  const age = Math.max(0, frame - startFrame);
  const sourceX = isLeft ? 153 : 487;
  const sourceY = 955;
  const lateralSpeed =
    (isLeft ? 1 : -1) * (3.4 + seededUnit(index + 11) * 4.8);
  const upwardSpeed = -(13.2 + seededUnit(index + 31) * 7.4);
  const gravity = 0.34 + seededUnit(index + 47) * 0.08;
  const x =
    sourceX +
    lateralSpeed * age +
    Math.sin(age * 0.2 + index) * (3 + seededUnit(index + 63) * 7);
  const y = sourceY + upwardSpeed * age + 0.5 * gravity * age * age;
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
    frame,
    [EXIT_START_FRAME, FINAL_FRAME - 2],
    [1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
  const inBoundsOpacity =
    x < -40 || x > COMPOSITION_WIDTH + 40 || y > COMPOSITION_HEIGHT + 50
      ? 0
      : 1;
  const width = 8 + Math.round(seededUnit(index + 79) * 7);
  const height = 15 + Math.round(seededUnit(index + 91) * 11);

  return (
    <span
      className={styles.confettiPiece}
      style={{
        background: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
        borderRadius: index % 6 === 0 ? 999 : index % 3 === 0 ? 4 : 2,
        height,
        opacity: entranceOpacity * exitOpacity * inBoundsOpacity,
        transform: `translate3d(${x}px, ${y}px, 0) rotate(${
          index * 31 + age * (8 + (index % 7))
        }deg) scaleX(${0.65 + Math.abs(Math.sin(age * 0.16 + index)) * 0.45})`,
        width,
        zIndex: index % 5 === 0 ? 6 : 1,
      }}
    />
  );
}

function BirthdaySlotComposition({
  day,
  daysUntil,
  famousName,
  leverPull,
  monthIndex,
  reducedMotion,
}: BirthdaySlotProps) {
  const frame = useCurrentFrame();
  const digits = String(daysUntil).padStart(3, "0").split("").map(Number);
  const resultVisible = reducedMotion
    ? frame >= SPIN_START_FRAME
    : frame >= 72;
  const entryProgress = interpolate(frame, [0, ENTRY_END_FRAME], [0, 1], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const exitProgress = interpolate(
    frame,
    [EXIT_START_FRAME, FINAL_FRAME],
    [0, 1],
    {
      easing: Easing.bezier(0.4, 0, 1, 1),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
  const reelStopShake = reducedMotion
    ? 0
    : [58, 68, 78].reduce(
        (sum, stopFrame, index) =>
          sum +
          interpolate(
            frame,
            [stopFrame - 1, stopFrame, stopFrame + 2, stopFrame + 4],
            [0, index % 2 === 0 ? -4 : 4, index % 2 === 0 ? 2 : -2, 0],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            },
          ),
        0,
      );
  const spinRattle =
    !reducedMotion && frame >= SPIN_START_FRAME && frame < RESULT_FRAME
      ? Math.sin(frame * 2.6) * 1.6
      : 0;
  const machineOpacity = interpolate(
    frame,
    [EXIT_START_FRAME, FINAL_FRAME - 4],
    [1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
  const backgroundOpacity = interpolate(
    frame,
    [EXIT_START_FRAME + 4, FINAL_FRAME],
    [1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
  const famousNameFontSize =
    famousName.length >= 22
      ? 19
      : famousName.length >= 19
        ? 21
        : famousName.length >= 16
          ? 24
          : famousName.length >= 13
            ? 27
            : 30;
  const leverAngle = `${(leverPull / MAX_LEVER_PULL) * 48}deg`;
  const confettiCount = reducedMotion ? 36 : 180;

  return (
    <AbsoluteFill className={styles.composition}>
      <AbsoluteFill
        className={styles.compositionBackground}
        style={{ opacity: backgroundOpacity }}
      />

      <div
        className={styles.machineScene}
        style={{
          opacity: machineOpacity,
          transform: `translate3d(${reelStopShake + spinRattle}px, ${
            (1 - entryProgress) * 74 - exitProgress * 74
          }px, 0) scale(${0.94 + entryProgress * 0.06 - exitProgress * 0.025})`,
        }}
      >
        <img
          alt=""
          className={styles.machineArtwork}
          draggable={false}
          src={staticFile("havoc-birthday-slot-machine.png")}
          style={{
            height: MACHINE.height,
            left: MACHINE.left,
            top: MACHINE.top,
            width: MACHINE.width,
          }}
        />

        <div className={styles.machineDate}>
          {MONTHS[monthIndex].slice(0, 3)} {day}
        </div>

        <div
          className={styles.reels}
          style={{
            gap: REELS.gap,
            gridTemplateColumns: "repeat(3, 1fr)",
            height: REELS.height,
            left: REELS.left,
            top: REELS.top,
            width: REELS.width,
          }}
        >
          {digits.map((digit, index) => (
            <SlotReel
              frame={reducedMotion && frame >= SPIN_START_FRAME ? RESULT_FRAME : frame}
              index={index}
              key={index}
              targetDigit={digit}
            />
          ))}
        </div>

        <div
          className={styles.daysLabel}
          style={{
            opacity: resultVisible
              ? interpolate(frame, [72, 79], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                })
              : 0,
            transform: `translate3d(0, ${
              resultVisible
                ? interpolate(frame, [72, 79], [-13, 0], {
                    easing: Easing.bezier(0.16, 1, 0.3, 1),
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  })
                : -13
            }px, 0)`,
          }}
        >
          {daysUntil === 0
            ? "Birthday today"
            : daysUntil === 1
              ? "Day until your birthday"
              : "Days until your birthday"}
        </div>

        <div
          className={styles.twinPlaque}
          style={{
            opacity: resultVisible
              ? interpolate(frame, [75, 82], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                })
              : 0,
            transform: `scale(${
              resultVisible
                ? interpolate(frame, [75, 79, 82], [1.12, 0.97, 1], {
                    easing: Easing.bezier(0.16, 1, 0.3, 1),
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                    output: "perceptual-scale",
                  })
                : 1.12
            })`,
          }}
        >
          <span>Your birthday twin</span>
          <strong style={{ fontSize: famousNameFontSize }}>
            {famousName}
          </strong>
        </div>

        <div
          className={styles.leverVisual}
          style={{ "--slot-lever-angle": leverAngle } as CSSProperties}
        >
          <span className={styles.leverBase} />
          <span className={styles.leverArm}>
            <i />
          </span>
        </div>
      </div>

      {frame >= CELEBRATION_START_FRAME ? (
        <>
          <img
            alt=""
            className={styles.cannons}
            draggable={false}
            src={staticFile("havoc-confetti-cannons.png")}
            style={{
              opacity:
                interpolate(
                  frame,
                  [
                    CELEBRATION_START_FRAME,
                    CELEBRATION_START_FRAME + 7,
                    EXIT_START_FRAME,
                    FINAL_FRAME - 3,
                  ],
                  [0, 1, 1, 0],
                  {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  },
                ),
              transform: reducedMotion
                ? "translate3d(0, 0, 0)"
                : `translate3d(0, ${interpolate(
                    frame,
                    [CELEBRATION_START_FRAME, CELEBRATION_START_FRAME + 9],
                    [70, 0],
                    {
                      easing: Easing.bezier(0.16, 1, 0.3, 1),
                      extrapolateLeft: "clamp",
                      extrapolateRight: "clamp",
                    },
                  )}px, 0)`,
            }}
          />
          {Array.from({ length: confettiCount }, (_, index) => (
            <ConfettiParticle
              frame={frame}
              index={index}
              key={index}
              reducedMotion={reducedMotion}
            />
          ))}
        </>
      ) : null}
    </AbsoluteFill>
  );
}

export function BirthdayCountdownScreen({
  day,
  monthIndex,
  next,
  onTransitionStart,
  reducedMotion,
}: {
  day: number;
  monthIndex: number;
  next: () => void;
  onTransitionStart: () => void;
  reducedMotion: boolean;
}) {
  const daysUntil = getDaysUntilBirthday(monthIndex, day);
  const famousName =
    FAMOUS_BIRTHDAY_MATCHES[`${monthIndex + 1}-${day}`] ?? "someone iconic";
  const playerRef = useRef<PlayerRef>(null);
  const animationFrameRef = useRef<number | null>(null);
  const timeoutRefs = useRef<Set<number>>(new Set());
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

  const clearScheduledWork = useCallback(() => {
    timeoutRefs.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    timeoutRefs.current.clear();
  }, []);

  const schedule = useCallback((callback: () => void, delay: number) => {
    const timeoutId = window.setTimeout(() => {
      timeoutRefs.current.delete(timeoutId);
      callback();
    }, delay);
    timeoutRefs.current.add(timeoutId);
  }, []);

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
    setLeverPull(MAX_LEVER_PULL);
    setPhase("spinning");
    navigator.vibrate?.(16);

    schedule(() => setLeverPull(0), reducedMotion ? 70 : 180);
    playFrames(
      SPIN_START_FRAME,
      RESULT_FRAME,
      reducedMotion ? 190 : 1650,
      () => {
        setPhase("revealed");
        navigator.vibrate?.([12, 36, 16]);
        schedule(
          () => continueButtonRef.current?.focus({ preventScroll: true }),
          30,
        );
      },
    );
  }, [phase, playFrames, reducedMotion, schedule]);

  const startCelebration = useCallback(() => {
    if (phase !== "revealed") return;
    onTransitionStart();
    setPhase("celebrating");
    navigator.vibrate?.(18);
    playFrames(
      CELEBRATION_START_FRAME,
      FINAL_FRAME,
      reducedMotion ? 820 : 3400,
      next,
    );
  }, [next, onTransitionStart, phase, playFrames, reducedMotion]);

  useEffect(() => {
    playFrames(0, ENTRY_END_FRAME, reducedMotion ? 70 : 440, () => {
      setPhase("ready");
      schedule(
        () => leverButtonRef.current?.focus({ preventScroll: true }),
        30,
      );
    });

    return () => {
      stopAnimation();
      clearScheduledWork();
    };
  }, [
    clearScheduledWork,
    playFrames,
    reducedMotion,
    schedule,
    stopAnimation,
  ]);

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
    const distance = Math.max(
      0,
      Math.min(MAX_LEVER_PULL + 6, event.clientY - pullStartRef.current),
    );
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

    if (distance >= 30) {
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
      className={`screen birthday-countdown-screen birthday-slot-screen ${styles.screen}`}
      data-countdown-days={daysUntil}
      data-slot-phase={phase}
      data-testid="birthday-slot-screen"
      aria-label={`Birthday slot machine for ${MONTHS[monthIndex]} ${day}`}
    >
      <div className={styles.visualStage}>
        <div className={styles.playerLayer} aria-hidden="true">
          <Player
            className={styles.player}
            ref={playerRef}
            component={BirthdaySlotComposition}
            inputProps={{
              day,
              daysUntil,
              famousName,
              leverPull,
              monthIndex,
              reducedMotion,
            }}
            durationInFrames={FINAL_FRAME + 1}
            compositionWidth={COMPOSITION_WIDTH}
            compositionHeight={COMPOSITION_HEIGHT}
            fps={30}
            autoPlay={false}
            acknowledgeRemotionLicense
            controls={false}
            loop={false}
            clickToPlay={false}
            style={{
              height: "100%",
              inset: 0,
              pointerEvents: "none",
              position: "absolute",
              width: "100%",
            }}
          />
        </div>

        <button
          ref={leverButtonRef}
          type="button"
          className={styles.leverHit}
          data-testid="birthday-slot-lever"
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
          aria-label="Pull the lever to reveal days until your birthday"
        >
          {phase === "ready" ? (
            <span className={styles.leverCue} aria-hidden="true">
              <b>Pull</b>
              <i>↓</i>
            </span>
          ) : null}
        </button>
      </div>

      {phase === "revealed" ? (
        <button
          ref={continueButtonRef}
          type="button"
          className={styles.continueButton}
          data-testid="birthday-slot-continue"
          onClick={startCelebration}
        >
          Continue
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
