"use client";

import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import styles from "./calibration-lab.module.css";
import type {
  CalibrationEffectsProps,
  CalibrationPhase,
  ShakeImpulse,
} from "./calibration-effects";

const CalibrationEffects = dynamic<CalibrationEffectsProps>(
  () =>
    import("./calibration-effects").then(
      (module) => module.CalibrationEffects,
    ),
  {
    ssr: false,
    loading: () => null,
  },
);

const REQUIRED_REVERSALS = 14;
const FACE_FOUND_AT = 32 / 24;
const FACE_HOLD_AT = 34 / 24;
const SPEECH_START_AT = 1.56;
const SPEECH_HOLD_AT = 83 / 24;
const MOUTH_HOLD_AT = 118 / 24;
const SPOKEN_PHRASE = "Havoc’s about to get interesting.";

const PHASE_DURATION_MS: Partial<Record<CalibrationPhase, number>> = {
  "face-hold": 2283,
  "voice-prompt": 550,
  "voice-hold": 78,
  "voice-success": 700,
  "expression-prompt": 800,
  "expression-success": 500,
  charge: 1000,
  freeze: 3000,
  drop: 1000,
  shatter: 900,
  blackout: 480,
};

const NEXT_PHASE: Partial<Record<CalibrationPhase, CalibrationPhase>> = {
  "face-hold": "voice-prompt",
  "voice-prompt": "voice",
  "voice-hold": "voice-success",
  "voice-success": "expression-prompt",
  "expression-prompt": "expression",
  "expression-success": "charge",
  charge: "freeze",
  freeze: "drop",
  drop: "break",
  shatter: "blackout",
};

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(Math.max(value, minimum), maximum);

const playQuietly = (audio: HTMLAudioElement | null, volume: number) => {
  if (!audio) return;
  audio.pause();
  audio.currentTime = 0;
  audio.volume = volume;
  void audio.play().catch(() => undefined);
};

const captureMouthFrame = (video: HTMLVideoElement) => {
  const sourceWidth = video.videoWidth;
  const sourceHeight = video.videoHeight;
  if (!sourceWidth || !sourceHeight) return null;

  const crop = Math.min(sourceWidth, sourceHeight);
  const sourceX = Math.max(0, (sourceWidth - crop) / 2);
  const sourceY = Math.max(0, (sourceHeight - crop) / 2);
  const canvas = document.createElement("canvas");
  canvas.width = 720;
  canvas.height = 720;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(
    video,
    sourceX,
    sourceY,
    crop,
    crop,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  return canvas.toDataURL("image/jpeg", 0.94);
};

export function CalibrationLabScreen({ next }: { next: () => void }) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const nextRef = useRef(next);
  const phaseRef = useRef<CalibrationPhase>("idle");
  const phaseElapsedRef = useRef(0);
  const typedCountRef = useRef(0);
  const faceFoundRef = useRef(false);
  const frameCapturePendingRef = useRef(false);
  const lastDirectionRef = useRef(0);
  const accumulatedWheelRef = useRef(0);
  const reversalCountRef = useRef(0);
  const lastAcceptedAtRef = useRef(0);
  const touchStartYRef = useRef<number | null>(null);
  const virtualTapDirectionRef = useRef(1);
  const audioRef = useRef<{
    charge: HTMLAudioElement | null;
    crack: HTMLAudioElement | null;
    fire: HTMLAudioElement | null;
    shatter: HTMLAudioElement | null;
  }>({
    charge: null,
    crack: null,
    fire: null,
    shatter: null,
  });

  const [phase, setPhase] = useState<CalibrationPhase>("idle");
  const [typedPhrase, setTypedPhrase] = useState("");
  const [freezeFrame, setFreezeFrame] = useState<string | null>(null);
  const [reversalCount, setReversalCount] = useState(0);
  const [shakeImpulse, setShakeImpulse] = useState<ShakeImpulse>({
    direction: 0,
    progress: 0,
    sequence: 0,
  });
  const [playError, setPlayError] = useState(false);
  const [effectsFailed, setEffectsFailed] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [announcement, setAnnouncement] = useState(
    "Calibration Lab. Tap the reaction chamber to start.",
  );

  nextRef.current = next;

  const transitionTo = useCallback((nextPhase: CalibrationPhase) => {
    phaseRef.current = nextPhase;
    phaseElapsedRef.current = 0;
    setPhase(nextPhase);
  }, []);

  const finishMouthCapture = useCallback(
    (video: HTMLVideoElement) => {
      const frame = captureMouthFrame(video);
      if (frame) setFreezeFrame(frame);
      frameCapturePendingRef.current = false;
      transitionTo("expression-success");
    },
    [transitionTo],
  );

  const seekAndCaptureMouthFrame = useCallback(
    (video: HTMLVideoElement) => {
      if (frameCapturePendingRef.current) return;
      frameCapturePendingRef.current = true;
      video.pause();

      const capture = () => {
        finishMouthCapture(video);
      };

      if (Math.abs(video.currentTime - MOUTH_HOLD_AT) <= 1 / 48) {
        capture();
        return;
      }

      const onSeeked = () => {
        video.removeEventListener("seeked", onSeeked);
        capture();
      };
      video.addEventListener("seeked", onSeeked);
      video.currentTime = MOUTH_HOLD_AT;
    },
    [finishMouthCapture],
  );

  const onEngineTick = useCallback(
    (deltaMs: number) => {
      const currentPhase = phaseRef.current;
      const video = videoRef.current;
      phaseElapsedRef.current += Math.min(deltaMs, 50);

      if (currentPhase === "scan" && video) {
        if (!faceFoundRef.current && video.currentTime >= FACE_FOUND_AT) {
          faceFoundRef.current = true;
          setAnnouncement("Face found.");
        }
        if (video.currentTime >= FACE_HOLD_AT) {
          video.pause();
          video.currentTime = FACE_HOLD_AT;
          transitionTo("face-hold");
          setAnnouncement("Face found. Calibration ready.");
        }
        return;
      }

      if (currentPhase === "voice" && video) {
        const transcriptProgress = clamp(
          (video.currentTime - SPEECH_START_AT) /
            (SPEECH_HOLD_AT - SPEECH_START_AT),
          0,
          1,
        );
        const nextTypedCount = Math.round(
          SPOKEN_PHRASE.length * transcriptProgress,
        );
        if (nextTypedCount !== typedCountRef.current) {
          typedCountRef.current = nextTypedCount;
          setTypedPhrase(SPOKEN_PHRASE.slice(0, nextTypedCount));
        }
        if (video.currentTime >= SPEECH_HOLD_AT) {
          video.pause();
          video.currentTime = SPEECH_HOLD_AT;
          setTypedPhrase(SPOKEN_PHRASE);
          transitionTo("voice-hold");
        }
        return;
      }

      if (currentPhase === "expression" && video) {
        if (video.currentTime >= MOUTH_HOLD_AT) {
          seekAndCaptureMouthFrame(video);
        }
        return;
      }

      const duration = PHASE_DURATION_MS[currentPhase];
      const nextPhase = NEXT_PHASE[currentPhase];
      if (
        duration !== undefined &&
        nextPhase &&
        phaseElapsedRef.current >=
          (reducedMotion &&
          ["charge", "freeze", "drop", "shatter"].includes(currentPhase)
            ? Math.min(duration, 220)
            : duration)
      ) {
        transitionTo(nextPhase);
      }

      if (
        currentPhase === "blackout" &&
        phaseElapsedRef.current >= PHASE_DURATION_MS.blackout!
      ) {
        nextRef.current();
      }
    },
    [
      reducedMotion,
      seekAndCaptureMouthFrame,
      transitionTo,
    ],
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    const syncReducedMotion = () => setReducedMotion(mediaQuery.matches);
    syncReducedMotion();
    mediaQuery.addEventListener("change", syncReducedMotion);

    const audio = audioRef.current;
    audio.charge = new Audio("/calibration-sfx/beam-charge.ogg");
    audio.fire = new Audio("/calibration-sfx/beam-fire.ogg");
    audio.crack = new Audio("/calibration-sfx/ice-crack.ogg");
    audio.shatter = new Audio("/calibration-sfx/ice-shatter.ogg");
    Object.values(audio).forEach((clip) => {
      if (clip) clip.preload = "auto";
    });

    return () => {
      mediaQuery.removeEventListener("change", syncReducedMotion);
      Object.values(audio).forEach((clip) => {
        clip?.pause();
        if (clip) clip.src = "";
      });
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (phase === "voice") {
      setAnnouncement("Say the first thing on your mind.");
      void video.play().catch(() => {
        setPlayError(true);
        setAnnouncement("Tap to resume the demo with sound.");
      });
    } else if (phase === "expression") {
      setAnnouncement("Open wide.");
      void video.play().catch(() => {
        setPlayError(true);
        setAnnouncement("Tap to resume the demo with sound.");
      });
    } else if (phase === "voice-success") {
      setAnnouncement("Loud and clear.");
    } else if (phase === "expression-success") {
      setAnnouncement("Wide open.");
    } else if (phase === "charge") {
      setAnnouncement("Freezing the frame.");
      playQuietly(audioRef.current.charge, 0.18);
    } else if (phase === "freeze") {
      playQuietly(audioRef.current.fire, 0.2);
    } else if (phase === "drop") {
      setAnnouncement("The frozen portrait is dropping.");
    } else if (phase === "break") {
      setAnnouncement(
        "Break the ice. Alternate up and down fourteen times.",
      );
    } else if (phase === "shatter") {
      setAnnouncement("Calibration complete. The ice is breaking.");
      playQuietly(audioRef.current.shatter, 0.24);
    }
  }, [phase]);

  useEffect(() => {
    if (!effectsFailed) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      onEngineTick(now - last);
      last = now;
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [effectsFailed, onEngineTick]);

  const startLab = useCallback(() => {
    if (phaseRef.current !== "idle") return;
    const video = videoRef.current;
    if (!video) return;

    faceFoundRef.current = false;
    typedCountRef.current = 0;
    lastDirectionRef.current = 0;
    accumulatedWheelRef.current = 0;
    reversalCountRef.current = 0;
    lastAcceptedAtRef.current = 0;
    virtualTapDirectionRef.current = 1;
    frameCapturePendingRef.current = false;
    setTypedPhrase("");
    setFreezeFrame(null);
    setReversalCount(0);
    setShakeImpulse({ direction: 0, progress: 0, sequence: 0 });
    setPlayError(false);
    video.currentTime = 0;
    video.volume = 1;
    transitionTo("scan");
    setAnnouncement("Camera on. Hold still while we find you.");
    void video.play().catch(() => {
      setPlayError(true);
      setAnnouncement("Tap to play the calibration demo with sound.");
    });
  }, [transitionTo]);

  const retryPlayback = useCallback(() => {
    setPlayError(false);
    void videoRef.current?.play().catch(() => setPlayError(true));
  }, []);

  const acceptDirection = useCallback(
    (direction: number, movement = 60) => {
      if (phaseRef.current !== "break" || Math.abs(movement) < 60) return;
      const normalizedDirection = Math.sign(direction);
      if (!normalizedDirection) return;

      const now = performance.now();
      if (now - lastAcceptedAtRef.current < 70) return;
      lastAcceptedAtRef.current = now;

      if (lastDirectionRef.current === 0) {
        lastDirectionRef.current = normalizedDirection;
        setAnnouncement(
          "Direction set. Reverse fourteen times to break the ice.",
        );
        setShakeImpulse((current) => ({
          direction: normalizedDirection,
          progress: 0,
          sequence: current.sequence + 1,
        }));
        return;
      }

      if (normalizedDirection === lastDirectionRef.current) return;
      lastDirectionRef.current = normalizedDirection;

      const nextCount = Math.min(
        REQUIRED_REVERSALS,
        reversalCountRef.current + 1,
      );
      reversalCountRef.current = nextCount;
      setReversalCount(nextCount);
      setShakeImpulse((current) => ({
        direction: normalizedDirection,
        progress: nextCount / REQUIRED_REVERSALS,
        sequence: current.sequence + 1,
      }));

      if ([3, 6, 9, 12].includes(nextCount)) {
        playQuietly(audioRef.current.crack, 0.16);
      }

      if (nextCount === REQUIRED_REVERSALS) {
        transitionTo("shatter");
        return;
      }

      setAnnouncement(
        `${nextCount} of ${REQUIRED_REVERSALS} direction reversals complete.`,
      );
    },
    [transitionTo],
  );

  useEffect(() => {
    if (phase !== "break") return;
    const stage = stageRef.current;
    if (!stage) return;

    const onWheel = (event: WheelEvent) => {
      if (!stage.contains(event.target as Node)) return;
      event.preventDefault();
      event.stopPropagation();
      const multiplier =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? 16
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? stage.clientHeight
            : 1;
      accumulatedWheelRef.current += event.deltaY * multiplier;
      if (Math.abs(accumulatedWheelRef.current) < 60) return;
      const distance = accumulatedWheelRef.current;
      accumulatedWheelRef.current = 0;
      acceptDirection(Math.sign(distance), Math.abs(distance));
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      const key = event.key.toLowerCase();
      const direction =
        event.key === "ArrowDown" || key === "s"
          ? 1
          : event.key === "ArrowUp" || key === "w"
            ? -1
            : 0;
      if (!direction) return;
      event.preventDefault();
      event.stopPropagation();
      acceptDirection(direction, 60);
    };

    const onTouchStart = (event: TouchEvent) => {
      touchStartYRef.current = event.touches[0]?.clientY ?? null;
    };

    const onTouchEnd = (event: TouchEvent) => {
      const startY = touchStartYRef.current;
      touchStartYRef.current = null;
      const endY = event.changedTouches[0]?.clientY;
      if (startY === null || endY === undefined) return;
      const distance = endY - startY;
      if (Math.abs(distance) < 60) return;
      event.preventDefault();
      acceptDirection(Math.sign(distance), Math.abs(distance));
    };

    stage.addEventListener("wheel", onWheel, {
      capture: true,
      passive: false,
    });
    stage.addEventListener("touchstart", onTouchStart, { passive: true });
    stage.addEventListener("touchend", onTouchEnd, { passive: false });
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      stage.removeEventListener("wheel", onWheel, { capture: true });
      stage.removeEventListener("touchstart", onTouchStart);
      stage.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [acceptDirection, phase]);

  const onCubeTap = useCallback(() => {
    const direction = virtualTapDirectionRef.current;
    virtualTapDirectionRef.current *= -1;
    acceptDirection(direction, 60);
  }, [acceptDirection]);

  const onVisibilityChange = useCallback((hidden: boolean) => {
    const video = videoRef.current;
    if (!video) return;
    const currentPhase = phaseRef.current;
    const isPlaybackPhase = ["scan", "voice", "expression"].includes(
      currentPhase,
    );
    if (hidden) {
      if (isPlaybackPhase) video.pause();
    } else if (isPlaybackPhase) {
      void video.play().catch(() => setPlayError(true));
    }
  }, []);

  const instruction = useMemo(() => {
    if (phase === "voice-prompt" || phase === "voice") {
      return "SAY THE FIRST THING ON YOUR MIND";
    }
    if (phase === "expression-prompt" || phase === "expression") {
      return "OPEN WIDE";
    }
    if (phase === "break") return "BREAK THE ICE";
    return "";
  }, [phase]);

  const success =
    phase === "voice-success"
      ? "LOUD & CLEAR"
      : phase === "expression-success"
        ? "WIDE OPEN"
        : "";
  const cameraState =
    phase === "idle"
      ? "idle"
      : phase === "scan"
        ? faceFoundRef.current
          ? "found"
          : "scan"
        : "found";
  const showFrozenVisual = [
    "freeze",
    "drop",
    "break",
    "shatter",
    "blackout",
  ].includes(phase);
  const showVideo = !showFrozenVisual;
  const crackStage =
    reversalCount >= 14
      ? 5
      : reversalCount >= 12
        ? 4
        : reversalCount >= 9
          ? 3
          : reversalCount >= 6
            ? 2
            : reversalCount >= 3
              ? 1
              : 0;

  return (
    <div
      className={`${styles.lab} screen`}
      data-camera={cameraState}
      data-phase={phase}
      data-reduced-motion={reducedMotion ? "true" : "false"}
      ref={stageRef}
    >
      <div className={styles.effectsHost} aria-hidden="true">
        <CalibrationEffects
          freezeFrame={freezeFrame}
          impulse={shakeImpulse}
          onFallback={() => setEffectsFailed(true)}
          onTick={onEngineTick}
          onVisibilityChange={onVisibilityChange}
          phase={phase}
          reducedMotion={reducedMotion}
        />
      </div>

      {effectsFailed && phase === "idle" && (
        <div className={styles.fallbackOrbit} aria-hidden="true">
          <span>CALIBRATION LAB</span>
          <span>TAP TO START</span>
        </div>
      )}

      <div className={styles.chamber} data-video={showVideo ? "on" : "off"}>
        <video
          aria-label="Prerecorded Calibration Lab camera demo"
          className={styles.cameraVideo}
          playsInline
          preload="auto"
          ref={videoRef}
          src="/havoc-calibration-demo.mp4"
        />
        {phase === "scan" && (
          <span className={styles.scanLine} aria-hidden="true" />
        )}
        {phase === "idle" && (
          <button
            type="button"
            className={styles.startButton}
            onClick={startLab}
            aria-label="Start Calibration Lab with camera demo and sound"
          />
        )}
      </div>

      <div className={styles.heroFlask} data-phase={phase} aria-hidden="true">
        <img
          className={styles.flaskFull}
          src="/havoc-calibration-flask-full.png"
          alt=""
          draggable={false}
        />
        <img
          className={styles.flaskEmpty}
          src="/havoc-calibration-flask-empty.png"
          alt=""
          draggable={false}
        />
      </div>

      <div className={styles.gunRig} data-phase={phase} aria-hidden="true">
        <img
          src="/havoc-calibration-water-gun.png"
          alt=""
          draggable={false}
        />
      </div>

      <div className={styles.copyLayer}>
        {success && <strong className={styles.success}>{success}</strong>}
        {instruction && (
          <div className={styles.instruction}>
            <strong>{instruction}</strong>
            {phase === "break" && (
              <>
                <span>
                  {reversalCount} / {REQUIRED_REVERSALS} REVERSALS
                </span>
                <small>
                  Scroll, swipe, or use W/S and ↑/↓
                </small>
              </>
            )}
          </div>
        )}
        {(phase === "voice" ||
          phase === "voice-hold" ||
          phase === "voice-success") &&
          typedPhrase && (
            <p className={styles.typedPhrase} aria-label={SPOKEN_PHRASE}>
              “{typedPhrase}
              {typedPhrase.length < SPOKEN_PHRASE.length && (
                <i aria-hidden="true" />
              )}
              ”
            </p>
          )}
      </div>

      {phase === "break" && (
        <button
          type="button"
          className={styles.cubeTapTarget}
          onClick={onCubeTap}
          aria-label={`Crack the ice. ${reversalCount} of ${REQUIRED_REVERSALS} reversals complete. Tap repeatedly as an accessible alternative.`}
        />
      )}

      {effectsFailed && showFrozenVisual && freezeFrame && (
        <div
          className={styles.fallbackIce}
          data-crack={crackStage}
          aria-hidden="true"
        >
          <img className={styles.fallbackFace} src={freezeFrame} alt="" />
          <img
            className={styles.fallbackShell}
            src="/havoc-calibration-ice-shell-v2.png"
            alt=""
          />
        </div>
      )}

      {playError && (
        <button
          type="button"
          className={styles.retryButton}
          onClick={retryPlayback}
        >
          PLAY WITH SOUND
        </button>
      )}

      <span className={styles.demoLabel}>
        <i aria-hidden="true" />
        PRERECORDED CONCEPT DEMO
      </span>
      <span className={styles.liveRegion} aria-live="polite">
        {announcement}
      </span>
      <span className={styles.blackCover} aria-hidden="true" />
    </div>
  );
}
