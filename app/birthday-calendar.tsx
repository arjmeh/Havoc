"use client";

import { Player } from "@remotion/player";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  useEffect,
  useRef,
  useState,
} from "react";
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from "react";

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

const WEEKDAYS = [
  ["S", "Sunday"],
  ["M", "Monday"],
  ["T", "Tuesday"],
  ["W", "Wednesday"],
  ["T", "Thursday"],
  ["F", "Friday"],
  ["S", "Saturday"],
] as const;

type Season = "winter" | "spring" | "summer" | "autumn";
type FlipDirection = -1 | 1;

type CalendarFlipProps = {
  direction: FlipDirection;
  monthIndex: number;
};

function getSeason(month: number): Season {
  if (month === 11 || month <= 1) return "winter";
  if (month <= 4) return "spring";
  if (month <= 7) return "summer";
  return "autumn";
}

function getMonthCells(month: number) {
  const firstWeekday = new Date(2024, month, 1).getDay();
  const dayCount = new Date(2024, month + 1, 0).getDate();

  return Array.from({ length: 42 }, (_, index) => {
    const day = index - firstWeekday + 1;
    return day >= 1 && day <= dayCount ? day : null;
  });
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return reduced;
}

function CalendarPageLift({ direction, monthIndex }: CalendarFlipProps) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const progress = interpolate(frame, [0, durationInFrames - 1], [0, 1], {
    easing: Easing.bezier(0.22, 0.78, 0.22, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = interpolate(progress, [0, 0.72, 1], [1, 0.92, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const rotateX = interpolate(
    progress,
    [0, 0.58, 1],
    [0, direction === 1 ? -52 : 48, direction === 1 ? -88 : 82],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
  const translateY = interpolate(
    progress,
    [0, 1],
    [0, direction === 1 ? -62 : 48],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
  const cells = getMonthCells(monthIndex);

  return (
    <AbsoluteFill
      style={{
        background: "transparent",
        perspective: 900,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          padding: "28px 30px 24px",
          borderRadius: "0 0 30px 30px",
          background: "#fffef8",
          boxShadow: "0 15px 24px rgba(37, 20, 47, 0.16)",
          color: "#17131f",
          opacity,
          transform: `translateY(${translateY}px) rotateX(${rotateX}deg)`,
          transformOrigin: direction === 1 ? "50% 0%" : "50% 100%",
          backfaceVisibility: "hidden",
        }}
      >
        <div
          style={{
            marginBottom: 20,
            fontFamily: "Arial, Helvetica, sans-serif",
            fontSize: 52,
            fontWeight: 900,
            lineHeight: 1,
            letterSpacing: "-0.05em",
          }}
        >
          {MONTHS[monthIndex]}
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: 8,
          }}
        >
          {cells.map((day, index) => (
            <span
              key={`${day ?? "blank"}-${index}`}
              style={{
                display: "grid",
                height: 52,
                placeItems: "center",
                borderRadius: 16,
                color: day ? "#17131f" : "transparent",
                fontFamily: "Arial, Helvetica, sans-serif",
                fontSize: 24,
                fontWeight: 800,
              }}
            >
              {day ?? "•"}
            </span>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
}

function Chevron({ direction }: { direction: "up" | "down" }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <path
        d={direction === "up" ? "M4 12.5 10 6.5l6 6" : "M4 7.5l6 6 6-6"}
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SeasonalScene({ season }: { season: Season }) {
  if (season === "winter") {
    return (
      <div className="birthday-seasonal-scene winter-scene" aria-hidden="true">
        {Array.from({ length: 7 }, (_, index) => (
          <img
            key={index}
            className="winter-flake"
            src="/havoc-season-winter.png"
            alt=""
            width={1254}
            height={1254}
            style={{ "--season-index": index } as CSSProperties}
          />
        ))}
      </div>
    );
  }

  if (season === "summer") {
    return (
      <div className="birthday-seasonal-scene summer-scene" aria-hidden="true">
        <span className="summer-glow" />
        <img
          className="summer-sun"
          src="/havoc-season-summer.png"
          alt=""
          width={1254}
          height={1254}
        />
      </div>
    );
  }

  if (season === "autumn") {
    return (
      <div className="birthday-seasonal-scene autumn-scene" aria-hidden="true">
        {Array.from({ length: 6 }, (_, index) => (
          <img
            key={index}
            className="autumn-leaf"
            src="/havoc-season-autumn.png"
            alt=""
            width={1254}
            height={1254}
            style={{ "--season-index": index } as CSSProperties}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="birthday-seasonal-scene spring-scene" aria-hidden="true">
      <span className="spring-rain rain-one" />
      <span className="spring-rain rain-two" />
      <span className="spring-rain rain-three" />
      <img
        className="spring-sprout"
        src="/havoc-season-spring.png"
        alt=""
        width={1183}
        height={1329}
      />
    </div>
  );
}

export function BirthdayCalendarScreen({ next }: { next: () => void }) {
  const [month, setMonth] = useState(0);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [flip, setFlip] = useState<{
    direction: FlipDirection;
    id: number;
    monthIndex: number;
  } | null>(null);
  const [dragDistance, setDragDistance] = useState(0);
  const pointerStartRef = useRef<number | null>(null);
  const flipIdRef = useRef(0);
  const reducedMotion = useReducedMotion();
  const season = getSeason(month);
  const cells = getMonthCells(month);

  useEffect(() => {
    if (!flip) return;
    const activeFlip = flip.id;
    const timer = window.setTimeout(() => {
      setFlip((current) => (current?.id === activeFlip ? null : current));
    }, 430);
    return () => window.clearTimeout(timer);
  }, [flip]);

  const changeMonth = (direction: FlipDirection) => {
    const previousMonth = month;
    const nextMonth = (month + direction + 12) % 12;
    setSelectedDay(null);

    if (!reducedMotion) {
      flipIdRef.current += 1;
      setFlip({
        direction,
        id: flipIdRef.current,
        monthIndex: previousMonth,
      });
    } else {
      setFlip(null);
    }

    setMonth(nextMonth);
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointerStartRef.current = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerStartRef.current === null) return;
    const distance = event.clientY - pointerStartRef.current;
    setDragDistance(Math.max(-18, Math.min(18, distance * 0.22)));
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerStartRef.current === null) return;
    const distance = event.clientY - pointerStartRef.current;
    pointerStartRef.current = null;
    setDragDistance(0);
    if (Math.abs(distance) < 42) return;
    event.preventDefault();
    changeMonth(distance < 0 ? 1 : -1);
  };

  const onCalendarKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowUp" || event.key === "PageUp") {
      event.preventDefault();
      changeMonth(-1);
    }
    if (event.key === "ArrowDown" || event.key === "PageDown") {
      event.preventDefault();
      changeMonth(1);
    }
  };

  return (
    <div className={`screen birthday-screen season-${season}`}>
      <SeasonalScene season={season} />

      <div className="status">
        <span>9:41</span>
        <span>● ●●</span>
      </div>

      <header className="birthday-heading">
        <h2>When&apos;s your birthday?</h2>
        <p>
          So we can line up future freebies, surprise drops, and a little
          birthday chaos.
        </p>
      </header>

      <div className="birthday-calendar-stage">
        <section
          className="tear-calendar"
          aria-label={`Choose a birthday in ${MONTHS[month]}`}
        >
          <div className="calendar-binding">
            <span className="calendar-ring ring-left" aria-hidden="true" />
            <span className="calendar-ring ring-right" aria-hidden="true" />
            <button
              type="button"
              className="calendar-month-button"
              onClick={() => changeMonth(-1)}
              aria-label={`Previous month, ${MONTHS[(month + 11) % 12]}`}
            >
              <Chevron direction="up" />
            </button>
            <span className="calendar-binding-label">Havoc birthdays</span>
            <button
              type="button"
              className="calendar-month-button"
              onClick={() => changeMonth(1)}
              aria-label={`Next month, ${MONTHS[(month + 1) % 12]}`}
            >
              <Chevron direction="down" />
            </button>
          </div>

          <div
            className="calendar-paper"
            style={{ "--calendar-drag": `${dragDistance}px` } as CSSProperties}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => {
              pointerStartRef.current = null;
              setDragDistance(0);
            }}
            onKeyDown={onCalendarKeyDown}
            role="group"
            tabIndex={0}
            aria-label={`${MONTHS[month]} calendar. Swipe up or down, or use arrow keys, to change month.`}
          >
            <div className="calendar-month-row">
              <h3>{MONTHS[month]}</h3>
              <span>{season}</span>
            </div>
            <div className="calendar-weekdays" aria-hidden="true">
              {WEEKDAYS.map(([short, full]) => (
                <span key={full}>{short}</span>
              ))}
            </div>
            <div className="calendar-days">
              {cells.map((day, index) =>
                day ? (
                  <button
                    type="button"
                    className={selectedDay === day ? "is-selected" : ""}
                    key={`${day}-${index}`}
                    onClick={() => setSelectedDay(day)}
                    aria-label={`${MONTHS[month]} ${day}`}
                    aria-pressed={selectedDay === day}
                  >
                    {day}
                  </button>
                ) : (
                  <span key={`blank-${index}`} aria-hidden="true" />
                ),
              )}
            </div>

            {flip ? (
              <div className="calendar-flip-player" aria-hidden="true">
                <Player
                  key={flip.id}
                  component={CalendarPageLift}
                  inputProps={{
                    direction: flip.direction,
                    monthIndex: flip.monthIndex,
                  }}
                  durationInFrames={11}
                  compositionWidth={640}
                  compositionHeight={520}
                  fps={30}
                  autoPlay
                  acknowledgeRemotionLicense
                  controls={false}
                  loop={false}
                  clickToPlay={false}
                  style={{
                    width: "100%",
                    height: "100%",
                  }}
                />
              </div>
            ) : null}
          </div>
        </section>

        <div className="calendar-swipe-hint" aria-hidden="true">
          <Chevron direction="up" />
          <span>Swipe to flip months</span>
          <Chevron direction="down" />
        </div>
      </div>

      <div className="birthday-confirm">
        <p aria-live="polite">
          {selectedDay
            ? `${MONTHS[month]} ${selectedDay} selected`
            : "Choose your day"}
        </p>
        <button
          type="button"
          className="cta"
          onClick={next}
          disabled={selectedDay === null}
          aria-label={
            selectedDay
              ? `Confirm birthday ${MONTHS[month]} ${selectedDay}`
              : "Choose a birthday before confirming"
          }
        >
          Confirm
        </button>
      </div>
    </div>
  );
}
