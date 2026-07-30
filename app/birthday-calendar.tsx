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

import { BirthdayCountdownScreen } from "./birthday-countdown";

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

type SeasonParticleStyle = CSSProperties & {
  "--particle-delay": string;
  "--particle-drift": string;
  "--particle-duration": string;
  "--particle-scale": string;
  "--particle-x": string;
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
    easing: Easing.bezier(0.2, 0.72, 0.22, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = interpolate(progress, [0, 0.94, 1], [1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const rotateX = interpolate(
    progress,
    [0, 0.5, 1],
    [0, direction === 1 ? 38 : -38, direction === 1 ? 132 : -132],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
  const translateY = interpolate(
    progress,
    [0, 0.48, 1],
    [0, -4, -46],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
  const scaleY = interpolate(progress, [0, 0.55, 1], [1, 0.99, 0.965], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const foldShadow = interpolate(
    progress,
    [0, 0.45, 0.82, 1],
    [0, 0.44, 0.24, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
  const cells = getMonthCells(monthIndex);
  const season = getSeason(monthIndex);

  return (
    <AbsoluteFill
      style={{
        background: "transparent",
        perspective: 1160,
        overflow: "visible",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity,
          transform: `translateY(${translateY}px) rotateX(${rotateX}deg) scaleY(${scaleY})`,
          transformOrigin: "50% 0%",
          transformStyle: "preserve-3d",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            overflow: "hidden",
            padding: "28px 30px 24px",
            borderRadius: "0 0 30px 30px",
            background:
              "linear-gradient(90deg, transparent 50%, rgba(230,221,234,.32) 50% 51%, transparent 51%) 0 0 / 52px 52px, #fffef8",
            boxShadow: `0 ${18 + foldShadow * 42}px ${28 + foldShadow * 44}px rgba(37,20,47,${0.14 + foldShadow})`,
            color: "#17131f",
            backfaceVisibility: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              minHeight: 62,
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
            }}
          >
            <span
              style={{
                fontFamily: "Arial, Helvetica, sans-serif",
                fontSize: 52,
                fontWeight: 900,
                lineHeight: 1,
                letterSpacing: "-0.05em",
              }}
            >
              {MONTHS[monthIndex]}
            </span>
            <span
              style={{
                padding: "8px 13px",
                border: "3px solid #17131f",
                borderRadius: 999,
                background: "#c9ff2f",
                fontFamily: "Arial, Helvetica, sans-serif",
                fontSize: 15,
                fontWeight: 900,
                letterSpacing: ".08em",
                textTransform: "uppercase",
              }}
            >
              {season}
            </span>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: 8,
              marginTop: 12,
              color: "#756b77",
              fontFamily: "Arial, Helvetica, sans-serif",
              fontSize: 16,
              fontWeight: 900,
              textAlign: "center",
            }}
          >
            {WEEKDAYS.map(([short, full]) => (
              <span key={full}>{short}</span>
            ))}
          </div>
          <div
            style={{
              position: "absolute",
              right: 0,
              top: 0,
              left: 0,
              height: 56,
              background: `linear-gradient(180deg, rgba(46,25,55,${foldShadow}), transparent)`,
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              right: 0,
              top: 0,
              left: 0,
              height: 3,
              background: `rgba(72,43,80,${foldShadow + 0.08})`,
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: 8,
              marginTop: 9,
            }}
          >
            {cells.map((day, index) => (
              <span
                key={`${day ?? "blank"}-${index}`}
                style={{
                  display: "grid",
                  height: 48,
                  placeItems: "center",
                  borderRadius: 16,
                  color: day ? "#17131f" : "transparent",
                  fontFamily: "Arial, Helvetica, sans-serif",
                  fontSize: 22,
                  fontWeight: 800,
                }}
              >
                {day ?? "•"}
              </span>
            ))}
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            overflow: "hidden",
            borderRadius: "0 0 30px 30px",
            background:
              "linear-gradient(180deg,#fffdf7 0%,#f3ebf4 100%)",
            boxShadow: "inset 0 0 54px rgba(89,61,94,.13)",
            transform: "rotateX(180deg) translateZ(1px)",
            backfaceVisibility: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: "5% 6%",
              border: "3px solid rgba(92,69,97,.12)",
              borderRadius: "0 0 24px 24px",
            }}
          />
          {Array.from({ length: 7 }, (_, index) => (
            <span
              key={index}
              style={{
                position: "absolute",
                top: `${18 + index * 10}%`,
                right: "10%",
                left: "10%",
                height: 2,
                borderRadius: 999,
                background: "rgba(92,69,97,.09)",
              }}
            />
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
}

function SeasonalScene({ season }: { season: Season }) {
  const particleCount = season === "winter" ? 11 : season === "autumn" ? 9 : 8;
  const particlePositions = [5, 15, 27, 39, 51, 63, 75, 87, 95, 21, 69];

  return (
    <div
      className={`birthday-seasonal-scene ${season}-scene`}
      aria-hidden="true"
    >
      <div className="season-particles">
        {Array.from({ length: particleCount }, (_, index) => (
          <span
            className="season-particle"
            key={`${season}-${index}`}
            style={
              {
                "--particle-delay": `${-(index * 0.83 + (index % 3) * 0.41)}s`,
                "--particle-drift": `${((index % 5) - 2) * 13}px`,
                "--particle-duration": `${5.4 + (index % 4) * 0.78}s`,
                "--particle-scale": `${0.72 + (index % 4) * 0.13}`,
                "--particle-x": `${particlePositions[index]}%`,
              } as SeasonParticleStyle
            }
          />
        ))}
      </div>
      <img
        className={`season-ground season-ground-${season}`}
        src={`/havoc-season-${season}.png`}
        alt=""
        width={1200}
        height={400}
      />
    </div>
  );
}

export function BirthdayCalendarScreen({ next }: { next: () => void }) {
  const [month, setMonth] = useState(0);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [confirmedBirthday, setConfirmedBirthday] = useState<{
    day: number;
    monthIndex: number;
  } | null>(null);
  const [flip, setFlip] = useState<{
    direction: FlipDirection;
    id: number;
    monthIndex: number;
  } | null>(null);
  const [dragDistance, setDragDistance] = useState(0);
  const pointerStartRef = useRef<number | null>(null);
  const calendarRef = useRef<HTMLElement>(null);
  const flipIdRef = useRef(0);
  const monthRef = useRef(0);
  const wheelDistanceRef = useRef(0);
  const wheelGestureLockedRef = useRef(false);
  const wheelGestureResetTimerRef = useRef<number | null>(null);
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
    const previousMonth = monthRef.current;
    const nextMonth = (previousMonth + direction + 12) % 12;
    monthRef.current = nextMonth;
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
    if ((event.target as HTMLElement).closest("button")) {
      pointerStartRef.current = null;
      return;
    }

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

  useEffect(() => {
    if (confirmedBirthday) return;

    const handleWindowCalendarKeys = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      if (
        target?.isContentEditable ||
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT"
      ) {
        return;
      }

      if (event.key === "ArrowUp" || event.key === "PageUp") {
        event.preventDefault();
        event.stopPropagation();
        changeMonth(-1);
      }
      if (event.key === "ArrowDown" || event.key === "PageDown") {
        event.preventDefault();
        event.stopPropagation();
        changeMonth(1);
      }
    };

    window.addEventListener("keydown", handleWindowCalendarKeys, true);
    return () =>
      window.removeEventListener("keydown", handleWindowCalendarKeys, true);
  }, [confirmedBirthday, reducedMotion]);

  useEffect(() => {
    if (confirmedBirthday) return;
    const calendar = calendarRef.current;
    if (!calendar) return;

    const handleCalendarWheel = (event: WheelEvent) => {
      // Keep every wheel/trackpad gesture over the calendar inside the phone
      // preview, including small or diagonal movement that does not flip a page.
      event.preventDefault();
      event.stopPropagation();

      if (wheelGestureResetTimerRef.current !== null) {
        window.clearTimeout(wheelGestureResetTimerRef.current);
      }
      wheelGestureResetTimerRef.current = window.setTimeout(() => {
        wheelDistanceRef.current = 0;
        wheelGestureLockedRef.current = false;
        wheelGestureResetTimerRef.current = null;
      }, 180);

      const verticalDistance = Math.abs(event.deltaY);
      const horizontalDistance = Math.abs(event.deltaX);
      if (
        wheelGestureLockedRef.current ||
        verticalDistance < 3 ||
        verticalDistance < horizontalDistance
      ) {
        return;
      }

      wheelDistanceRef.current += event.deltaY;
      if (Math.abs(wheelDistanceRef.current) < 28) {
        return;
      }

      const direction = wheelDistanceRef.current > 0 ? 1 : -1;
      wheelDistanceRef.current = 0;
      wheelGestureLockedRef.current = true;
      changeMonth(direction);
    };

    calendar.addEventListener("wheel", handleCalendarWheel, {
      capture: true,
      passive: false,
    });
    return () => {
      calendar.removeEventListener("wheel", handleCalendarWheel, true);
      if (wheelGestureResetTimerRef.current !== null) {
        window.clearTimeout(wheelGestureResetTimerRef.current);
      }
      wheelDistanceRef.current = 0;
      wheelGestureLockedRef.current = false;
      wheelGestureResetTimerRef.current = null;
    };
  }, [confirmedBirthday, reducedMotion]);

  return (
    <>
      <div
        className={`screen birthday-screen season-${season}`}
        inert={confirmedBirthday ? true : undefined}
      >
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
            ref={calendarRef}
            aria-label={`Choose a birthday in ${MONTHS[month]}`}
          >
            <div className="calendar-binding">
              <span className="calendar-ring ring-left" aria-hidden="true" />
              <span className="calendar-ring ring-right" aria-hidden="true" />
              <span className="calendar-binding-label">Havoc birthdays</span>
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
                    compositionHeight={610}
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
            <span>Swipe to flip months</span>
          </div>
        </div>

        <div className="birthday-confirm">
          <p aria-live="polite">
            {selectedDay
              ? `${MONTHS[month]} ${selectedDay} selected`
              : "\u00a0"}
          </p>
          <button
            type="button"
            className="cta"
            onClick={() => {
              if (selectedDay === null) return;
              (document.activeElement as HTMLElement | null)?.blur();
              setConfirmedBirthday({ day: selectedDay, monthIndex: month });
            }}
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
      {confirmedBirthday ? (
        <BirthdayCountdownScreen
          day={confirmedBirthday.day}
          monthIndex={confirmedBirthday.monthIndex}
          next={next}
          reducedMotion={reducedMotion}
        />
      ) : null}
    </>
  );
}
