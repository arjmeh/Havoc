"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

import { getAgeLine } from "./age-copy";
import { BirthdayCalendarScreen } from "./birthday-calendar";

const screens = [
  { id: "loading", group: "Entry & setup", label: "Loading", job: "Brand ignition", emoji: "💥" },
  { id: "welcome", group: "Entry & setup", label: "Welcome", job: "Promise in one beat", emoji: "👋" },
  { id: "auth", group: "Entry & setup", label: "Account", job: "Fake sign-in flow", emoji: "🔐" },
  { id: "age", group: "Entry & setup", label: "Age gate", job: "Trust without drag", emoji: "🎂" },
  { id: "birthday", group: "Entry & setup", label: "Birthday", job: "Perks meet the seasons", emoji: "📅" },
  { id: "permissions", group: "Entry & setup", label: "Permissions", job: "Explain before asking", emoji: "🎥" },
  { id: "calibration", group: "Entry & setup", label: "Calibration", job: "Setup becomes play", emoji: "🧪" },
  { id: "home", group: "Play hub", label: "Home", job: "Instant ignition", emoji: "🏠" },
  { id: "daily", group: "Play hub", label: "Daily Havoc", job: "Fresh challenge", emoji: "⚡" },
  { id: "friends", group: "Play hub", label: "Friends", job: "Social continuity", emoji: "🫂" },
  { id: "join", group: "Party", label: "Join party", job: "Code to room fast", emoji: "🔑" },
  { id: "create", group: "Party", label: "Create party", job: "Set the vibe", emoji: "🎉" },
  { id: "lobby", group: "Party", label: "Lobby", job: "No dead waiting", emoji: "😎" },
  { id: "reveal", group: "Live match", label: "Reveal", job: "Five-second rule", emoji: "🤪" },
  { id: "countdown", group: "Live match", label: "Countdown", job: "Shared ignition", emoji: "3️⃣" },
  { id: "live", group: "Live match", label: "Live game", job: "Reaction is gameplay", emoji: "🎬" },
  { id: "verification", group: "Live match", label: "Verification", job: "Readable fairness", emoji: "🔍" },
  { id: "result", group: "Live match", label: "Result", job: "Drama + revenge", emoji: "👑" },
  { id: "no-contest", group: "Live match", label: "No Contest", job: "Trust over guessing", emoji: "🤝" },
  { id: "highlight", group: "After play", label: "Highlight", job: "Consent then share", emoji: "🔥" },
  { id: "profile", group: "After play", label: "Profile", job: "Identity + mastery", emoji: "🏆" },
  { id: "settings", group: "After play", label: "Settings", job: "Comfort controls", emoji: "⚙️" },
  { id: "safety", group: "After play", label: "Safety center", job: "Fast recovery", emoji: "🛡️" },
];

const groups = [...new Set(screens.map((screen) => screen.group))];
const screenIndex = (id: string) => screens.findIndex((screen) => screen.id === id);

function Status() {
  return <div className="status"><span>9:41</span><span>● ●●</span></div>;
}

function LoadingScreen({ next }: { next: () => void }) {
  const [phase, setPhase] = useState<"idle" | "igniting" | "complete">("idle");
  const [flameSettled, setFlameSettled] = useState(false);

  useEffect(() => {
    const loopImage = new Image();
    loopImage.src = "/havoc-controller-fire-loop-v8.gif";
    const timer = window.setTimeout(() => setFlameSettled(true), 2130);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (phase !== "igniting") return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const completionDelay = reduceMotion ? 350 : 3100;
    const completeTimer = window.setTimeout(() => setPhase("complete"), completionDelay);
    return () => window.clearTimeout(completeTimer);
  }, [phase]);

  useEffect(() => {
    if (phase !== "complete") return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const handoffTimer = window.setTimeout(next, reduceMotion ? 100 : 140);
    return () => window.clearTimeout(handoffTimer);
  }, [next, phase]);

  const startIgnition = () => {
    if (phase !== "idle") return;
    setPhase("igniting");
  };

  const letters = ["H", "A", "V", "O", "C"];

  return <button
    type="button"
    className={`screen loading-screen is-${phase}`}
    onClick={startIgnition}
    aria-label={phase === "idle" ? "Start Havoc opening animation" : "Havoc opening animation playing"}
    aria-disabled={phase !== "idle"}
  >
    <span className="splash-mark">
      <span className="splash-mark-core">
        <img
          className="splash-controller-gif"
          src={flameSettled
            ? "/havoc-controller-fire-loop-v8.gif"
            : "/havoc-controller-fire-intro-v6.gif"}
          alt=""
          width={500}
          height={500}
        />
      </span>
      <span className="splash-shards" aria-hidden="true">
        {Array.from({ length: 8 }, (_, index) => <span
          className={`splash-shard splash-shard-${index + 1}`}
          key={index}
        >
          <img
            className="splash-shard-image"
            src="/havoc-controller-fire-shatter.png"
            alt=""
            width={1254}
            height={1254}
          />
        </span>)}
      </span>
    </span>
    <span className="splash-wordmark" aria-label="HAVOC">
      {letters.map((letter) => <span className="splash-letter" aria-hidden="true" key={letter}>
        <span className="letter-piece letter-piece-top">{letter}</span>
        <span className="letter-piece letter-piece-middle">{letter}</span>
        <span className="letter-piece letter-piece-bottom">{letter}</span>
      </span>)}
    </span>
    <span className="splash-tagline">Your friends. Your chaos.</span>
    <small className="splash-hint">Tap to start</small>
    <span className="splash-blackout" aria-hidden="true" />
    <span className="splash-black-cover" aria-hidden="true" />
  </button>;
}

type AuthMode = "signup" | "login";
type AuthMethod = "google" | "apple" | "phone" | "email";
type AuthStep = "services" | "identity" | "password" | "verify";

function WelcomeScreen({ onChooseAuth }: { onChooseAuth: (mode: AuthMode) => void }) {
  const [launching, setLaunching] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("signup");

  useEffect(() => {
    const rocket = new Image();
    rocket.src = "/havoc-rocket-flame-launch.webp";
  }, []);

  useEffect(() => {
    if (!launching) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => onChooseAuth(authMode), reduceMotion ? 240 : 1120);
    return () => window.clearTimeout(timer);
  }, [authMode, launching, onChooseAuth]);

  const startAuth = (mode: AuthMode) => {
    if (launching) return;
    setAuthMode(mode);
    setLaunching(true);
  };

  return <div
    className={`screen welcome-screen${launching ? " is-launching" : ""}`}
    aria-busy={launching}
  >
    <div className="welcome-joystick-stage" aria-hidden="true">
      <img
        className="welcome-joystick welcome-joystick-motion"
        src="/havoc-joystick-transparent.webp"
        alt=""
        width={360}
        height={480}
      />
      <img
        className="welcome-joystick welcome-joystick-still"
        src="/havoc-joystick-still.png"
        alt=""
        width={360}
        height={480}
      />
    </div>
    <div className="welcome-copy">
      <h2>Set up your account.</h2>
      <p>You&apos;ll need an account to continue—and to keep your progress, highlights, and wins.</p>
    </div>
    <div className="welcome-actions">
      <button
        className="welcome-primary"
        onClick={() => startAuth("signup")}
        disabled={launching}
      >
        Get started
        <img
          className="welcome-rocket-mark"
          src="/havoc-rocket-cutout.png"
          alt=""
          width={383}
          height={665}
          aria-hidden="true"
        />
      </button>
      <button className="welcome-secondary" onClick={() => startAuth("login")} disabled={launching}>
        I already have an account
      </button>
    </div>
    <div className="rocket-transition" aria-hidden="true">
      <span className="rocket-divider-mask">
        <span className="rocket-divider-edge" />
        <span className="rocket-divider-surface" />
      </span>
      <span className="rocket-launch-track">
        <img
          className="rocket-launch rocket-launch-motion"
          src="/havoc-rocket-flame-launch.webp"
          alt=""
          width={383}
          height={665}
        />
      </span>
    </div>
  </div>;
}

const authMethods: Array<{
  id: AuthMethod;
  label: string;
  mark: string;
}> = [
  { id: "google", label: "Google", mark: "G" },
  { id: "apple", label: "Apple", mark: "" },
  { id: "phone", label: "Phone number", mark: "☎" },
  { id: "email", label: "Email", mark: "@" },
];

function AuthScreen({
  mode,
  onBack,
  onComplete,
}: {
  mode: AuthMode;
  onBack: () => void;
  onComplete: () => void;
}) {
  const [step, setStep] = useState<AuthStep>("services");
  const [method, setMethod] = useState<AuthMethod | null>(null);
  const [identity, setIdentity] = useState("");
  const [password, setPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [finishing, setFinishing] = useState(false);
  const isSignup = mode === "signup";

  useEffect(() => {
    setStep("services");
    setMethod(null);
    setIdentity("");
    setPassword("");
    setVerificationCode("");
    setFinishing(false);
  }, [mode]);

  const finish = () => {
    if (finishing) return;
    setFinishing(true);
    window.setTimeout(onComplete, 320);
  };

  const chooseMethod = (nextMethod: AuthMethod) => {
    setMethod(nextMethod);
    if (nextMethod === "google" || nextMethod === "apple") {
      finish();
      return;
    }
    setStep("identity");
  };

  const submitIdentity = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStep("password");
  };

  const submitPassword = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (method === "phone") {
      setStep("verify");
      return;
    }
    finish();
  };

  const submitVerification = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    finish();
  };

  const back = () => {
    if (step === "services") {
      onBack();
      return;
    }
    if (step === "identity") {
      setStep("services");
      setMethod(null);
      return;
    }
    if (step === "password") {
      setStep("identity");
      return;
    }
    setStep("password");
  };

  const title = step === "services"
    ? isSignup ? "Create your account." : "Welcome back."
    : step === "identity"
      ? method === "phone" ? "What’s your number?" : "What’s your email?"
      : step === "password"
        ? isSignup ? "Create a password." : "Enter your password."
        : "Check your phone.";

  const description = step === "services"
    ? isSignup
      ? "Choose a quick way in. You can finish your profile after the fun starts."
      : "Use the same method you picked when you joined."
    : step === "identity"
      ? method === "phone"
        ? "We’ll text a one-time code to make sure it’s you."
        : "Use an email you can get back into later."
      : step === "password"
        ? isSignup
          ? "Make it memorable. You can change it anytime."
          : "Enter your password to jump back in."
        : "Enter the six-digit code we pretended to send.";

  const progress = step === "services" ? "1 of 3" : step === "identity" ? "2 of 3" : "3 of 3";

  return <div className={`screen auth-screen${finishing ? " is-finishing" : ""}`}>
    <Status />
    <div className="auth-topline">
      <button className="auth-back" type="button" onClick={back} aria-label="Go back">
        <span aria-hidden="true">←</span>
      </button>
      <span className="auth-progress">{progress}</span>
    </div>

    <div className="auth-heading" aria-live="polite">
      <span className="auth-kicker">{isSignup ? "New player" : "Player login"}</span>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>

    {step === "services" && <div className="auth-methods" aria-label={`${isSignup ? "Sign up" : "Log in"} methods`}>
      {authMethods.map((item) => <button
        className={`auth-method auth-method-${item.id}`}
        type="button"
        key={item.id}
        onClick={() => chooseMethod(item.id)}
        disabled={finishing}
      >
        <span className="auth-method-mark" aria-hidden="true">{item.mark}</span>
        <b>{isSignup ? "Continue" : "Log in"} with {item.label}</b>
        <span className="auth-method-arrow" aria-hidden="true">→</span>
      </button>)}
    </div>}

    {step === "identity" && <form className="auth-form" onSubmit={submitIdentity} noValidate>
      <label htmlFor="auth-identity">{method === "phone" ? "Phone number" : "Email address"}</label>
      <input
        id="auth-identity"
        type={method === "phone" ? "tel" : "email"}
        inputMode={method === "phone" ? "tel" : "email"}
        autoComplete={method === "phone" ? "tel" : "email"}
        value={identity}
        onChange={(event) => setIdentity(event.target.value)}
        placeholder={method === "phone" ? "(555) 555-0123" : "you@example.com"}
        autoFocus
      />
      <button className="auth-submit" type="submit">Continue <span aria-hidden="true">→</span></button>
    </form>}

    {step === "password" && <form className="auth-form" onSubmit={submitPassword} noValidate>
      <label htmlFor="auth-password">{isSignup ? "Create password" : "Password"}</label>
      <input
        id="auth-password"
        type="password"
        autoComplete={isSignup ? "new-password" : "current-password"}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="••••••••"
        autoFocus
      />
      <small>{isSignup ? "Eight characters is a solid start." : "Forgot it? We’ll fake that later."}</small>
      <button className="auth-submit" type="submit">
        {method === "phone" ? "Send code" : isSignup ? "Create account" : "Log in"}
        <span aria-hidden="true">→</span>
      </button>
    </form>}

    {step === "verify" && <form className="auth-form auth-code-form" onSubmit={submitVerification} noValidate>
      <label htmlFor="auth-code">Verification code</label>
      <input
        id="auth-code"
        className="auth-code"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={verificationCode}
        onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
        placeholder="000000"
        autoFocus
      />
      <button className="auth-resend" type="button">Send another code</button>
      <button className="auth-submit" type="submit">Verify &amp; continue <span aria-hidden="true">→</span></button>
    </form>}

    <p className="auth-prototype-note">Prototype mode · blank fields still work</p>
    <div className="auth-finish-card" role="status" aria-live="polite">
      <span aria-hidden="true">✓</span>
      <b>You’re in.</b>
    </div>
  </div>;
}

const AGE_VALUES = Array.from({ length: 99 }, (_, index) => index + 1);

type CandleStyle = CSSProperties & {
  "--candle-delay": string;
  "--candle-rotate": string;
  "--candle-scale": string;
  "--candle-width": string;
  "--candle-x": string;
  "--candle-y": string;
};

function getCandleLayout(age: number): CandleStyle[] {
  const showerDuration = Math.min(780, 300 + age * 5);
  const width = age <= 10 ? 25 : age <= 25 ? 18 : age <= 50 ? 14 : age <= 75 ? 11.5 : 9.5;

  return Array.from({ length: age }, (_, index) => {
    const radius = Math.sqrt((index + .5) / age);
    const angle = index * 2.399963;
    const x = 50 + Math.cos(angle) * radius * 44;
    const y = 52 + Math.sin(angle) * radius * 31;
    const delay = age === 1 ? 0 : index * showerDuration / (age - 1);
    const scale = .8 + y / 100 * .34;

    return {
      "--candle-delay": `${delay.toFixed(1)}ms`,
      "--candle-rotate": `${((index % 7) - 3) * 3.5}deg`,
      "--candle-scale": scale.toFixed(3),
      "--candle-width": `${width}px`,
      "--candle-x": `${x.toFixed(2)}%`,
      "--candle-y": `${y.toFixed(2)}%`,
      zIndex: Math.round(y * 2),
    };
  });
}

function AgeScreen({ next }: { next: () => void }) {
  const [age, setAge] = useState(18);
  const [poppingAge, setPoppingAge] = useState<number | null>(null);
  const [celebration, setCelebration] = useState<
    "idle" | "dropping" | "holding" | "sweeping" | "falling"
  >("idle");
  const carouselRef = useRef<HTMLDivElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const readyRef = useRef(false);
  const settleTimerRef = useRef<number | null>(null);
  const celebrationTimersRef = useRef<number[]>([]);
  const settledAgeRef = useRef(18);
  const keyboardAgeRef = useRef(18);
  const wheelDistanceRef = useRef(0);
  const wheelStepAtRef = useRef(0);
  const candleLayout = celebration === "idle" ? [] : getCandleLayout(age);

  useEffect(() => {
    const cake = new Image();
    cake.src = "/havoc-birthday-cake-tall.png";
    const candle = new Image();
    candle.src = "/havoc-candle-flame-loop.png";

    return () => {
      celebrationTimersRef.current.forEach(window.clearTimeout);
      celebrationTimersRef.current = [];
    };
  }, []);

  const scrollToAge = (nextAge: number, behavior: ScrollBehavior = "smooth") => {
    const safeAge = Math.max(1, Math.min(99, nextAge));
    const carousel = carouselRef.current;
    const card = carousel?.querySelector<HTMLElement>(`[data-age="${safeAge}"]`);
    keyboardAgeRef.current = safeAge;

    if (carousel && card) {
      const left = card.offsetLeft - (carousel.clientWidth - card.offsetWidth) / 2;
      if (behavior === "auto") {
        carousel.style.scrollBehavior = "auto";
        carousel.scrollLeft = left;
        window.requestAnimationFrame(() => {
          carousel.style.scrollBehavior = "";
        });
      } else {
        carousel.scrollTo({ left, behavior });
      }
    }
  };

  useEffect(() => {
    let readyFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      const carousel = carouselRef.current;
      const card = carousel?.querySelector<HTMLElement>('[data-age="18"]');

      if (carousel && card) {
        const left = card.offsetLeft - (carousel.clientWidth - card.offsetWidth) / 2;
        carousel.style.scrollBehavior = "auto";
        carousel.scrollLeft = left;
      }

      readyFrame = window.requestAnimationFrame(() => {
        if (carousel) carousel.style.scrollBehavior = "";
        readyRef.current = true;
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(readyFrame);
      if (settleTimerRef.current !== null) {
        window.clearTimeout(settleTimerRef.current);
      }
    };
  }, []);

  const syncAgeFromScroll = () => {
    if (!readyRef.current || !carouselRef.current) return;

    const carousel = carouselRef.current;
    const center = carousel.scrollLeft + carousel.clientWidth / 2;
    const cards = Array.from(carousel.querySelectorAll<HTMLElement>("[data-age]"));
    const closest = cards.reduce((best, card) => {
      const cardCenter = card.offsetLeft + card.offsetWidth / 2;
      const bestCenter = best.offsetLeft + best.offsetWidth / 2;
      return Math.abs(cardCenter - center) < Math.abs(bestCenter - center) ? card : best;
    });
    const nextAge = Number(closest.dataset.age);

    if (settleTimerRef.current !== null) {
      window.clearTimeout(settleTimerRef.current);
    }
    settleTimerRef.current = window.setTimeout(() => {
      keyboardAgeRef.current = nextAge;
      if (nextAge !== settledAgeRef.current) {
        settledAgeRef.current = nextAge;
        setAge(nextAge);
        setPoppingAge(nextAge);
      }
    }, 110);
  };

  const handleAgeKeys = (event: Pick<KeyboardEvent, "key" | "preventDefault">) => {
    const keyboardAge = keyboardAgeRef.current;
    const commands: Record<string, number> = {
      ArrowLeft: keyboardAge - 1,
      ArrowRight: keyboardAge + 1,
      PageDown: keyboardAge - 10,
      PageUp: keyboardAge + 10,
      Home: 1,
      End: 99,
    };

    if (commands[event.key] === undefined) return;
    event.preventDefault();
    scrollToAge(commands[event.key], event.key === "Home" || event.key === "End" ? "auto" : "smooth");
  };

  useEffect(() => {
    if (celebration !== "idle") return;

    const handleWindowAgeKeys = (event: KeyboardEvent) => {
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

      const ageKeys = [
        "ArrowLeft",
        "ArrowRight",
        "PageDown",
        "PageUp",
        "Home",
        "End",
      ];
      if (!ageKeys.includes(event.key)) return;

      event.stopPropagation();
      handleAgeKeys(event);
    };

    window.addEventListener("keydown", handleWindowAgeKeys, true);
    return () =>
      window.removeEventListener("keydown", handleWindowAgeKeys, true);
  }, [celebration]);

  useEffect(() => {
    const screen = screenRef.current;
    if (!screen || celebration !== "idle") return;

    const handleAgeWheel = (event: WheelEvent) => {
      const horizontalDistance = Math.abs(event.deltaX);
      const verticalDistance = Math.abs(event.deltaY);
      if (horizontalDistance < 3 || horizontalDistance <= verticalDistance) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      wheelDistanceRef.current += event.deltaX;

      const now = window.performance.now();
      if (
        Math.abs(wheelDistanceRef.current) < 24 ||
        now - wheelStepAtRef.current < 160
      ) {
        return;
      }

      const direction = wheelDistanceRef.current > 0 ? 1 : -1;
      wheelDistanceRef.current = 0;
      wheelStepAtRef.current = now;
      scrollToAge(keyboardAgeRef.current + direction);
    };

    screen.addEventListener("wheel", handleAgeWheel, {
      capture: true,
      passive: false,
    });
    return () => screen.removeEventListener("wheel", handleAgeWheel, true);
  }, [celebration]);

  const confirmAge = () => {
    if (celebration !== "idle") return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const showerDuration = reduceMotion ? 160 : Math.min(780, 300 + age * 5) + 360;
    const holdDuration = reduceMotion ? 160 : 900;
    const sweepDuration = reduceMotion ? 140 : 400;
    const fallDuration = reduceMotion ? 200 : 540;
    const sweepAt = showerDuration + holdDuration;
    const fallAt = sweepAt + sweepDuration;

    setCelebration("dropping");
    celebrationTimersRef.current = [
      window.setTimeout(() => setCelebration("holding"), showerDuration),
      window.setTimeout(() => setCelebration("sweeping"), sweepAt),
      window.setTimeout(() => setCelebration("falling"), fallAt),
      window.setTimeout(next, fallAt + fallDuration),
    ];
  };

  return <div
    className={`screen age-screen is-${celebration}`}
    ref={screenRef}
    aria-busy={celebration !== "idle"}
  >
    <Status />
    <div className="age-heading">
      <h2>How old are you?</h2>
      <p>Double-check it—this can&apos;t be changed later.</p>
    </div>
    <div
      className="age-carousel"
      ref={carouselRef}
      onScroll={syncAgeFromScroll}
      onKeyDown={handleAgeKeys}
      role="slider"
      tabIndex={0}
      aria-label="Choose your age"
      aria-valuemin={1}
      aria-valuemax={99}
      aria-valuenow={age}
      aria-valuetext={`${age}. ${getAgeLine(age)}`}
    >
      {AGE_VALUES.map((value) => <button
        type="button"
        className={`age-keycap${value === age ? " is-selected" : ""}${value === poppingAge ? " is-popping" : ""}`}
        data-age={value}
        key={value}
        onClick={() => scrollToAge(value)}
        aria-label={`Choose age ${value}`}
        aria-current={value === age ? "true" : undefined}
        tabIndex={value === age ? 0 : -1}
      >
        <span>{value}</span>
      </button>)}
    </div>
    <div className="age-fact" aria-live="polite" aria-atomic="true">
      <strong key={age}>{getAgeLine(age)}</strong>
    </div>
    <div className="age-confirm">
      <button
        className="cta"
        onClick={confirmAge}
        disabled={celebration !== "idle"}
        aria-label={`Confirm age ${age}`}
      >
        Confirm
      </button>
    </div>
    <div className="birthday-cake-stage" aria-hidden="true">
      <img
        className="birthday-cake"
        src="/havoc-birthday-cake-tall.png"
        alt=""
        width={1024}
        height={1536}
      />
      <div className="birthday-candle-field">
        {candleLayout.map((style, index) => <i
          className="birthday-candle"
          key={index}
          style={style}
        />)}
      </div>
    </div>
    <span className="sr-only" aria-live="polite">
      {celebration === "dropping"
        ? `Adding ${age} candles to your cake.`
        : celebration === "falling"
          ? "Age confirmed."
          : ""}
    </span>
  </div>;
}

function PermissionsScreen({ next }: { next: () => void }) {
  const [enabled, setEnabled] = useState([true, true, false]);
  const rows = [["📷","Camera","Live video + pose games"],["🎙️","Microphone","Voice, rhythm, and reactions"],["📍","Motion + GPS","Opt-in distance games"]];
  return <div className="screen form-screen"><Status /><span className="pill">Set up the fun</span><h2>Three permissions. Thirty games.</h2><p className="sub">We only ask when a game needs them.</p><div className="permission-list">{rows.map(([icon,title,copy], index) => <button key={title} onClick={() => setEnabled(items => items.map((item,i) => i === index ? !item : item))}><span>{icon}</span><div><b>{title}</b><small>{copy}</small></div><em className={enabled[index] ? "on" : ""}>{enabled[index] ? "ON" : "LATER"}</em></button>)}</div><button className="cta sticky" onClick={next}>Enable essentials</button></div>;
}

function CalibrationScreen({ next }: { next: () => void }) {
  const [sample, setSample] = useState(0);
  const tests = [["👀","Blink once"],["✋","Show a hand"],["😗","Copy the face"]];
  return <div className="screen calibration-screen"><Status /><span className="pill cyan">30-second setup</span><h2>Calibration Lab</h2><p>Quick checks improve scoring as you play.</p><div className="calibration-orb">{tests[sample][0]}</div><div className="calibration-copy"><b>{tests[sample][1]}</b><small>{sample + 1} of {tests.length}</small></div><div className="progress-dots">{tests.map((_,i) => <i key={i} className={i <= sample ? "done" : ""} />)}</div><button className="cta" onClick={() => sample < tests.length - 1 ? setSample(sample + 1) : next()}>{sample < tests.length - 1 ? "Looks good" : "Finish setup"}</button><button className="text-button" onClick={next}>Skip for now</button></div>;
}

function HomeScreen({ next }: { next: () => void }) {
  return <div className="screen home-screen">
    <Status />
    <div className="app-row"><b className="mini-logo">HAVOC</b><div className="avatars" aria-label="Three friends online"><span>😎</span><span>🤠</span><span>😈</span></div></div>
    <h2>Your friends are bored. Fix it.</h2>
    <p className="sub">Maya, Jules, and Kai are online right now.</p>
    <button className="cta" onClick={next}>Start a party <span aria-hidden>💥</span></button>
    <button className="secondary">Join with a code</button>
    <p className="kicker">Tonight&apos;s chaos</p>
    <div className="game-card"><span className="pill">6 min · perfect for 4</span><strong>Face-off frenzy</strong><div className="emoji-cloud">😵‍💫🤪</div></div>
    <nav className="bottom-nav" aria-label="Prototype navigation"><span className="active">●<small>Play</small></span><span>○<small>Friends</small></span><span>◇<small>Highlights</small></span><span>□<small>You</small></span></nav>
  </div>;
}

function DailyScreen() {
  return <div className="screen list-screen"><Status /><div className="app-row"><b className="mini-logo">Daily Havoc</b><span className="pill">New · 11h left</span></div><h2>Same games. No excuses.</h2><p className="sub">Five shared challenges. Best total wins.</p><div className="challenge-list">{[["1","😗","Emoji Face-Off","ready"],["2","🎨","Color Dash","locked"],["3","👏","Beat Repeat","locked"],["4","🧊","Freeze!","locked"],["5","🔎","Find It Fast","locked"]].map(([n,e,t,s]) => <div key={n}><span>{n}</span><b>{e} {t}</b><small>{s}</small></div>)}</div><div className="rival-row"><span>😎</span><div><b>Maya · 3,840 pts</b><small>Friend to beat</small></div><em>#1</em></div><button className="cta sticky">Start today&apos;s run</button></div>;
}

function FriendsScreen() {
  return <div className="screen list-screen"><Status /><div className="app-row"><b className="mini-logo">Friends</b><button className="round-button" aria-label="Add friend">＋</button></div><div className="rival-card"><span>😎</span><div><small>Your rivalry</small><b>You vs Maya</b><em>All-time · 42–41</em></div><button>Rematch</button></div><p className="kicker">Online now</p><div className="friend-list">{[["🤠","Jules","Ready for pose games"],["🤭","Maya","In a party"],["😈","Kai","Ready for anything"],["🥸","Noor","Daily Havoc"]].map(([e,n,s]) => <button key={n}><span>{e}</span><div><b>{n}</b><small>{s}</small></div><em>{s === "In a party" ? "JOIN" : "INVITE"}</em></button>)}</div><nav className="bottom-nav" aria-label="App navigation"><span>○<small>Play</small></span><span className="active">●<small>Friends</small></span><span>◇<small>Highlights</small></span><span>□<small>You</small></span></nav></div>;
}

function JoinScreen({ next }: { next: () => void }) {
  const [code, setCode] = useState("H A V O C 7");
  return <div className="screen form-screen"><Status /><button className="back-link">← Back</button><span className="pill">Join a party</span><h2>Got the code? You&apos;re in.</h2><p className="sub">Party codes expire when the party ends.</p><label>Party code<input className="code-input" value={code} onChange={event => setCode(event.target.value.toUpperCase())} /></label><button className="cta" onClick={next}>Join party</button><button className="secondary">Scan invite QR</button><div className="invite-preview"><span>🤠</span><div><b>Jules invited you</b><small>Face-Off Frenzy · 4 players</small></div></div></div>;
}

function CreateScreen({ next }: { next: () => void }) {
  const [size, setSize] = useState(4);
  const [vibe, setVibe] = useState("Chaotic");
  return <div className="screen form-screen"><Status /><button className="back-link">← Back</button><span className="pill">Create party</span><h2>Set the vibe.</h2><label>Party name<input defaultValue="Friday Night Menaces" /></label><p className="kicker">Party size</p><div className="choice-row">{[2,3,4,5,6].map(item => <button className={size === item ? "selected" : ""} key={item} onClick={() => setSize(item)}>{item}</button>)}</div><p className="kicker">Vibe</p><div className="vibe-row">{["Chaotic","Chill","Sweaty"].map(item => <button className={vibe === item ? "selected" : ""} key={item} onClick={() => setVibe(item)}>{item}</button>)}</div><div className="filter-list"><span><b>Camera games</b><i className="toggle on" /></span><span><b>Voice + music</b><i className="toggle on" /></span><span><b>Movement</b><i className="toggle on" /></span><span><b>GPS outdoors</b><i className="toggle" /></span></div><button className="cta sticky" onClick={next}>Create party</button></div>;
}

function LobbyScreen({ next }: { next: () => void }) {
  return <div className="screen lobby-screen">
    <Status />
    <div className="app-row"><b className="mini-logo">Friday night chaos</b><span className="pill">Host</span></div>
    <div className="party-code"><span>Party code</span><b>HAVOC7</b></div>
    <div className="players">
      {[
        ["😎", "Arjun", "ready"],
        ["🤭", "Maya", "ready"],
        ["🤠", "Jules", "ready"],
        ["👀", "Kai", "joining…"],
      ].map(([face, name, state]) => <div className="player" key={name}><span>{face}</span><b>{name}</b><small>{state}</small></div>)}
    </div>
    <div className="warmup"><span>😗</span><div><b>Warm-up: copy this face</b><small>Everyone calibrates while Kai joins.</small></div></div>
    <button className="cta sticky" onClick={next}>We&apos;re ready</button>
  </div>;
}

function RevealScreen({ next }: { next: () => void }) {
  return <div className="screen reveal-screen" onClick={next} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && next()}>
    <Status /><span className="sticker sticker-a">👀</span><span className="sticker sticker-b">⚡</span>
    <span className="pill cyan">Round 1 · reflex</span><h2>Emoji Face-Off</h2><div className="hero-emoji">🤪</div>
    <div className="rule-card">Match the face. <em>Best expression wins.</em></div><small className="tap-hint">Tap anywhere to start</small>
  </div>;
}

function CountdownScreen({ next }: { next: () => void }) {
  const [count, setCount] = useState(3);
  return <button className="screen countdown-screen" onClick={() => count > 1 ? setCount(count - 1) : next()} aria-label="Advance countdown">
    <Status /><span className="pill">Emoji Face-Off</span><div className="count-ring"><b>{count}</b></div><h2>{count === 3 ? "Ready?" : count === 2 ? "Camera set." : "Go!"}</h2><p>Tap to advance the prototype</p><div className="camera-ready"><span>😎</span><span>🤭</span><span>🤠</span><span>😈</span></div>
  </button>;
}

function LiveScreen({ next }: { next: () => void }) {
  const [reaction, setReaction] = useState("");
  return <div className="screen live-screen">
    <Status /><div className="score-row"><b>ARJUN 2</b><strong>08</strong><b>MAYA 2</b></div>
    <div className="target"><b>Make this face</b><span>😵‍💫</span></div><div className="camera-person">🧑🏽</div>
    {reaction && <div className="reaction-pop" aria-live="polite">{reaction}</div>}
    <div className="reaction-rail" aria-label="Quick reactions">{["😂","🔥","😱"].map(item => <button key={item} aria-label={`Send ${item} reaction`} onClick={() => setReaction(item)}>{item}</button>)}</div>
    <button className="safety">Leave or report</button><button className="finish-round" onClick={next}>Finish round</button>
  </div>;
}

function VerificationScreen({ next }: { next: () => void }) {
  return <div className="screen verification-screen"><Status /><span className="pill">Round complete</span><h2>Photo finish</h2><p>Checking what actually won…</p><div className="verify-ring"><b>93%</b></div><div className="verify-list"><span><b>Clock sync</b><em>VERIFIED</em></span><span><b>Detector confidence</b><em>96%</em></span><span><b>Fair-play check</b><em>CLEAN</em></span><span><b>Winner verdict</b><em>CALCULATING</em></span></div><button className="cta sticky" onClick={next}>Show result</button></div>;
}

function ResultScreen({ next }: { next: () => void }) {
  return <div className="screen result-screen">
    <Status /><div className="crown">👑</div><h2>You won!</h2><p><b>3–2</b> · your “dizzy face” was 94% spot on</p>
    <div className="replay"><span className="stamp">NAILED IT</span><div>😵‍💫</div><b>Maya sent 😂 😂 😂</b></div>
    <div className="result-actions"><button className="secondary">Next game</button><button className="cta" onClick={next}>Run it back ⚡</button></div>
  </div>;
}

function NoContestScreen() {
  return <div className="screen no-contest-screen"><Status /><span className="pill cyan">Fairness first</span><div className="question-orb">?</div><h2>No Contest</h2><p>We couldn&apos;t score this round confidently—so nobody loses.</p><div className="reason-card"><span>📷</span><div><b>Camera lost both faces near the finish.</b><small>No rank or streak changes.</small></div></div><button className="cta">Instant replay</button><button className="secondary">Choose another game</button></div>;
}

function HighlightScreen({ restart }: { restart: () => void }) {
  const [shared, setShared] = useState(false);
  return <div className="screen highlight-screen">
    <Status /><div className="app-row"><b className="mini-logo">Your highlight</b><span className="pill">0:08</span></div>
    <div className="clip"><div className="clip-head"><span className="pill">Emoji Face-Off</span><b>9:16</b></div><div className="clip-art">😵‍💫</div><div className="clip-caption">THE FACE THAT WON IT</div></div>
    <div className="consent"><span>✓</span><div><b>Everyone approved</b><small>Handles and backgrounds stay hidden.</small></div></div>
    {shared ? <div className="shared"><b>Chaos shared! 💥</b><button onClick={restart}>Replay prototype</button></div> : <button className="cta" onClick={() => setShared(true)}>Share the chaos <span aria-hidden>💥</span></button>}
  </div>;
}

function ProfileScreen() {
  return <div className="screen list-screen"><Status /><div className="app-row"><b className="mini-logo">Profile</b><button className="round-button" aria-label="Edit profile">✎</button></div><div className="profile-head"><span>😎</span><div><h2>Arjun</h2><p>@chaosengineer · Level 19</p></div></div><div className="xp-card"><small>This season</small><b>4,820 XP</b><i><em /></i></div><div className="stats-row"><span><b>42</b><small>wins</small></span><span><b>7</b><small>best streak</small></span><span><b>18</b><small>highlights</small></span></div><p className="kicker">Best game families</p><div className="family-list"><span><b>🤪 Face + Reaction</b><em>Gold II · top 12%</em></span><span><b>⚡ Reflex</b><em>Silver I · top 31%</em></span><span><b>🔎 Scavenger</b><em>Bronze III · top 48%</em></span></div><nav className="bottom-nav" aria-label="App navigation"><span>○<small>Play</small></span><span>○<small>Friends</small></span><span>◇<small>Highlights</small></span><span className="active">●<small>You</small></span></nav></div>;
}

function SettingsScreen() {
  const [values, setValues] = useState([true,false,true,true]);
  const items = [["Captions","Always on"],["Reduced motion","Replace bursts with fades"],["Color-safe scoring","Symbols + color"],["Haptics","Medium"]];
  return <div className="screen list-screen"><Status /><div className="app-row"><button className="back-link">←</button><b className="mini-logo">Settings</b><span /></div><p className="kicker">Play your way</p><div className="settings-list">{items.map(([title,copy],i) => <button key={title} onClick={() => setValues(list => list.map((v,x) => x === i ? !v : v))}><div><b>{title}</b><small>{copy}</small></div><i className={`toggle ${values[i] ? "on" : ""}`} /></button>)}</div><p className="kicker">Privacy + party</p><div className="menu-list"><button>Blocked players <span>›</span></button><button>Location + motion permissions <span>›</span></button><button>Highlight approval history <span>›</span></button><button>Account controls <span>›</span></button></div></div>;
}

function SafetyScreen() {
  return <div className="screen safety-screen"><Status /><div className="app-row"><button className="back-link">←</button><b className="mini-logo">Party controls</b><span /></div><div className="leave-card"><span>↩</span><div><b>Leave immediately</b><small>Exit any game or party in one tap.</small></div><button>LEAVE</button></div><p className="kicker">Report a problem</p><div className="report-list">{["Cheating or unfair play","Bullying or harassment","Unsafe physical challenge","Privacy or location concern","Technical scoring problem"].map(item => <button key={item}><span>!</span><b>{item}</b><em>›</em></button>)}</div><div className="safety-note"><b>Reports never affect your play.</b><p>Safety tools are always free and quickly prioritized.</p></div><button className="secondary sticky">Get help</button></div>;
}

function AppScreen({ index, setIndex }: { index: number; setIndex: (value: number) => void }) {
  const [authMode, setAuthMode] = useState<AuthMode>("signup");
  const next = () => setIndex(Math.min(index + 1, screens.length - 1));
  const id = screens[index].id;
  if (id === "loading") return <LoadingScreen next={next} />;
  if (id === "welcome") return <WelcomeScreen onChooseAuth={(mode) => {
    setAuthMode(mode);
    setIndex(screenIndex("auth"));
  }} />;
  if (id === "auth") return <AuthScreen
    mode={authMode}
    onBack={() => setIndex(screenIndex("welcome"))}
    onComplete={() => setIndex(screenIndex("age"))}
  />;
  if (id === "age") return <AgeScreen next={next} />;
  if (id === "birthday") return <BirthdayCalendarScreen next={next} />;
  if (id === "permissions") return <PermissionsScreen next={next} />;
  if (id === "calibration") return <CalibrationScreen next={next} />;
  if (id === "home") return <HomeScreen next={() => setIndex(screenIndex("create"))} />;
  if (id === "daily") return <DailyScreen />;
  if (id === "friends") return <FriendsScreen />;
  if (id === "join") return <JoinScreen next={() => setIndex(screenIndex("lobby"))} />;
  if (id === "create") return <CreateScreen next={() => setIndex(screenIndex("lobby"))} />;
  if (id === "lobby") return <LobbyScreen next={next} />;
  if (id === "reveal") return <RevealScreen next={next} />;
  if (id === "countdown") return <CountdownScreen next={next} />;
  if (id === "live") return <LiveScreen next={next} />;
  if (id === "verification") return <VerificationScreen next={next} />;
  if (id === "result") return <ResultScreen next={() => setIndex(screenIndex("highlight"))} />;
  if (id === "no-contest") return <NoContestScreen />;
  if (id === "highlight") return <HighlightScreen restart={() => setIndex(screenIndex("home"))} />;
  if (id === "profile") return <ProfileScreen />;
  if (id === "settings") return <SettingsScreen />;
  return <SafetyScreen />;
}

export default function Home() {
  const [step, setStep] = useState(0);
  const next = () => setStep((value) => Math.min(value + 1, screens.length - 1));
  const previous = () => setStep((value) => Math.max(value - 1, 0));

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.isContentEditable ||
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT"
      ) {
        return;
      }

      const activeScreen = screens[step].id;
      if (activeScreen === "age" || activeScreen === "birthday") return;

      if (event.key === "ArrowRight") next();
      if (event.key === "ArrowLeft") previous();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step]);

  return <main>
    <header className="site-header">
      <a className="brand" href="#prototype"><span>💥</span> HAVOC</a>
      <span className="header-chip">Friends in → game on ✦</span>
    </header>

    <section className="hero">
      <div><span className="eyebrow">Complete app layout · 23 screens</span><h1>Make the group chat playable.</h1><p>A full mobile product system from first launch to live competition, Highlights, progression, settings, and safety.</p></div>
      <aside><span>🗺️</span><h2>Every main page.</h2><p>Explore the app by system, jump to any screen, or walk the complete flow with the arrow controls.</p></aside>
    </section>

    <section className="prototype" id="prototype">
      <div className="prototype-copy">
        <span className="eyebrow dark">Interactive app atlas</span>
        <h2>The whole Havoc app.</h2>
        <p>Twenty-three main screens grouped into five product systems. Every page has one emotional job and one obvious next action.</p>
        <nav className="screen-map" aria-label="Havoc screen map">
          {groups.map(group => <section key={group}><h3>{group}</h3><div>{screens.map((item, index) => item.group === group && <button key={item.id} className={step === index ? "selected" : ""} onClick={() => setStep(index)} aria-current={step === index ? "page" : undefined}><span>{item.emoji}</span><b>{item.label}</b><small>{item.job}</small></button>)}</div></section>)}
        </nav>
      </div>

      <div className="device-stage">
        <div className="device-label"><span>{String(step + 1).padStart(2, "0")}</span><div><b>{screens[step].label}</b><small>{screens[step].group} · {screens[step].job}</small></div></div>
        <div className="phone">
          <div className="notch" />
          <AppScreen index={step} setIndex={setStep} />
        </div>
        <div className="prototype-controls">
          <button onClick={previous} disabled={step === 0}>← Back</button>
          <span>{step + 1} / {screens.length}</span>
          <button onClick={next} disabled={step === screens.length - 1}>Next →</button>
        </div>
      </div>
    </section>

    <section className="principles">
      {[["🎬","Camera is the stage","UI frames the live reaction instead of covering it with chrome."],["😵‍💫","Emoji are content","Prompts, players, reactions, and punchlines become the visual cast."],["⚡","One beat, one action","Every state has one dominant decision and a fast emotional payoff."],["🏆","Failure is shareable","Results explain fairness, then turn the funniest beat into a replay."]].map(([emoji,title,copy]) => <article key={title}><span>{emoji}</span><h3>{title}</h3><p>{copy}</p></article>)}
    </section>
  </main>;
}
