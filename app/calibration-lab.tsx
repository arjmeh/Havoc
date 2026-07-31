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
  CalibrationDevicePose,
  CalibrationEffectsProps,
  CalibrationPhase,
  ShakeImpulse,
} from "./calibration-effects";
import {
  CalibrationBrowserRuntime,
  CalibrationFaceRuntime,
  type CalibrationAudioLevels,
  type CalibrationFaceMode,
  type CalibrationMediaMode,
  type CalibrationVoiceMode,
} from "./calibration-runtime";
import {
  DeviceSensorRuntime,
  requestCalibrationSensorPermissions,
  type SensorRuntimeStatus,
} from "./device-sensors";
import {
  HAVOC_DEVICE_TEST_EVENT,
  type HavocDeviceTestMotion,
} from "./device-test-events";

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

const REQUIRED_REVERSALS = 10;
const SPOKEN_PHRASE = "Havoc’s about to get interesting.";

const PHASE_DURATION_MS: Partial<Record<CalibrationPhase, number>> = {
  "scan-exit": 1050,
  "face-hold": 2900,
  "voice-prompt": 2400,
  "voice-hold": 140,
  "voice-success": 1450,
  "expression-prompt": 3100,
  expression: 2450,
  "expression-success": 1200,
  charge: 3100,
  freeze: 1650,
  drop: 820,
  "ice-rain": 2200,
  "zoom-prompt": 1850,
  pour: 3900,
  "return-phone": 1220,
  "drink-prompt": 2800,
  drain: 2200,
  "drink-finish": 2800,
  shatter: 900,
  blackout: 540,
};

const NEXT_PHASE: Partial<Record<CalibrationPhase, CalibrationPhase>> = {
  "scan-exit": "face-hold",
  "face-hold": "voice-prompt",
  "voice-prompt": "voice",
  "voice-hold": "voice-success",
  "voice-success": "expression-prompt",
  "expression-prompt": "expression",
  "expression-success": "charge",
  charge: "freeze",
  freeze: "drop",
  drop: "break",
  "ice-rain": "zoom-prompt",
  "zoom-prompt": "zoom",
  pour: "return-phone",
  "return-phone": "drink-prompt",
  "drink-prompt": "drink",
  drain: "drink-finish",
  "drink-finish": "blackout",
  shatter: "blackout",
};

const CALIBRATION_PREVIEW_PHASES = new Set<CalibrationPhase>([
  "charge",
  "freeze",
  "drop",
  "break",
  "ice-rain",
  "zoom-prompt",
  "zoom",
  "pour",
  "return-phone",
  "drink-prompt",
  "drink",
  "drain",
  "drink-finish",
  "shatter",
]);

const playQuietly = (audio: HTMLAudioElement | null, volume: number) => {
  if (!audio) return;
  audio.pause();
  audio.currentTime = 0;
  audio.volume = volume;
  void audio.play().catch(() => undefined);
};

const captureMouthFrame = (
  video: HTMLVideoElement,
  mirror: boolean,
) => {
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
  context.save();
  if (mirror) {
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
  }
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
  context.restore();
  return canvas.toDataURL("image/jpeg", 0.92);
};

const voiceModeLabel = (mode: CalibrationVoiceMode) => {
  if (mode === "vapi") return "GODFREY LIVE";
  if (mode === "connecting") return "LINKING VOICE";
  if (mode === "browser") return "ON-DEVICE GUIDE";
  return "CAPTION GUIDE";
};

export function CalibrationLabScreen({ next }: { next: () => void }) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const runtimeRef = useRef<CalibrationBrowserRuntime | null>(null);
  const faceRuntimeRef = useRef<CalibrationFaceRuntime | null>(null);
  const sensorRuntimeRef = useRef<DeviceSensorRuntime | null>(null);
  const nextRef = useRef(next);
  const phaseRef = useRef<CalibrationPhase>("idle");
  const phaseElapsedRef = useRef(0);
  const lastEngineTickAtRef = useRef<number | null>(null);
  const phaseCuesRef = useRef(new Set<string>());
  const initialGuideSpokenRef = useRef(false);
  const voiceHeardRef = useRef(false);
  const faceModeRef = useRef<CalibrationFaceMode>("idle");
  const mouthOpenSinceRef = useRef<number | null>(null);
  const frameCapturePendingRef = useRef(false);
  const lastDirectionRef = useRef(0);
  const accumulatedWheelRef = useRef(0);
  const reversalCountRef = useRef(0);
  const zoomProgressRef = useRef(0);
  const zoomAutoRef = useRef(false);
  const lastAcceptedAtRef = useRef(0);
  const touchStartYRef = useRef<number | null>(null);
  const touchDistanceRef = useRef<number | null>(null);
  const poseSequenceRef = useRef(0);
  const completionStartedRef = useRef(false);
  const mountedRef = useRef(true);
  const syntheticTimersRef = useRef<number[]>([]);
  const audioLevelsRef = useRef<CalibrationAudioLevels>({
    agent: 0,
    user: 0,
  });
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
  const [zoomProgress, setZoomProgress] = useState(0);
  const [shakeImpulse, setShakeImpulse] = useState<ShakeImpulse>({
    direction: 0,
    progress: 0,
    sequence: 0,
  });
  const [devicePose, setDevicePose] = useState<CalibrationDevicePose>({
    pitch: 0,
    roll: 0,
    velocity: 0,
    sequence: 0,
  });
  const [playError, setPlayError] = useState(false);
  const [effectsFailed, setEffectsFailed] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [mediaMode, setMediaMode] =
    useState<CalibrationMediaMode>("idle");
  const [faceMode, setFaceMode] =
    useState<CalibrationFaceMode>("idle");
  const [voiceMode, setVoiceMode] =
    useState<CalibrationVoiceMode>("browser");
  const [sensorStatus, setSensorStatus] =
    useState<SensorRuntimeStatus>("idle");
  const [runtimeNote, setRuntimeNote] = useState(
    "Camera preview and motion stay local. Voice is optional.",
  );
  const [announcement, setAnnouncement] = useState(
    "Godfrey’s online. Start whenever you’re ready.",
  );

  nextRef.current = next;

  const transitionTo = useCallback((nextPhase: CalibrationPhase) => {
    phaseRef.current = nextPhase;
    phaseElapsedRef.current = 0;
    lastEngineTickAtRef.current = performance.now();
    phaseCuesRef.current.clear();
    setPhase(nextPhase);
  }, []);

  const shutdownExternalRuntime = useCallback(async () => {
    syntheticTimersRef.current.forEach((timer) =>
      window.clearTimeout(timer),
    );
    syntheticTimersRef.current = [];
    sensorRuntimeRef.current?.dispose();
    faceRuntimeRef.current?.dispose();
    faceRuntimeRef.current = null;
    await runtimeRef.current?.dispose();
    audioLevelsRef.current.agent = 0;
    audioLevelsRef.current.user = 0;
  }, []);

  const acceptDirection = useCallback(
    (direction: number, movement = 60) => {
      if (phaseRef.current !== "break" || Math.abs(movement) < 54) return;
      const normalizedDirection = Math.sign(direction);
      if (!normalizedDirection) return;

      const now = performance.now();
      if (now - lastAcceptedAtRef.current < 78) return;
      lastAcceptedAtRef.current = now;

      if (lastDirectionRef.current === 0) {
        lastDirectionRef.current = normalizedDirection;
        reversalCountRef.current = 1;
        setReversalCount(1);
        setShakeImpulse((current) => ({
          direction: normalizedDirection,
          progress: 1 / REQUIRED_REVERSALS,
          sequence: current.sequence + 1,
        }));
        setAnnouncement(`1 of ${REQUIRED_REVERSALS} shake gestures complete.`);
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

      if ([2, 4, 6, 8].includes(nextCount)) {
        playQuietly(audioRef.current.crack, 0.17);
      }
      if (nextCount === REQUIRED_REVERSALS) {
        phaseCuesRef.current.add("ending");
        runtimeRef.current?.say("Yeah, this isn’t breaking. New plan.");
        setAnnouncement("Yeah, this isn’t breaking. New plan.");
        const timer = window.setTimeout(() => {
          if (phaseRef.current === "break") transitionTo("ice-rain");
        }, 920);
        syntheticTimersRef.current.push(timer);
        return;
      }
      setAnnouncement(
        `${nextCount} of ${REQUIRED_REVERSALS} shake reversals complete.`,
      );
    },
    [transitionTo],
  );

  const acceptZoom = useCallback(
    (change: number) => {
      if (phaseRef.current !== "zoom" || !Number.isFinite(change)) return;
      const nextProgress = Math.min(
        1,
        Math.max(0, zoomProgressRef.current + change),
      );
      zoomProgressRef.current = nextProgress;
      setZoomProgress(nextProgress);
      setAnnouncement(
        nextProgress >= 0.28
          ? "Got it. Pulling the camera back."
          : `Zoomed out ${Math.round(nextProgress * 100)} percent.`,
      );
      if (nextProgress >= 0.28) zoomAutoRef.current = true;
    },
    [transitionTo],
  );

  const acceptInversion = useCallback(() => {
    if (phaseRef.current !== "drink") return;
    runtimeRef.current?.say("Bottoms up.");
    setAnnouncement("Draining the glass.");
    transitionTo("drain");
  }, [transitionTo]);

  const finishMouthCapture = useCallback(
    (video: HTMLVideoElement, useFallbackPortrait = false) => {
      video.pause();
      const frame = useFallbackPortrait
        ? null
        : captureMouthFrame(video, mediaMode === "live");
      setFreezeFrame(frame ?? "/havoc-calibration-freeze.jpg");
      faceRuntimeRef.current?.dispose();
      faceRuntimeRef.current = null;
      frameCapturePendingRef.current = false;
      transitionTo("expression-success");
    },
    [mediaMode, transitionTo],
  );

  const handleJawOpen = useCallback(
    (score: number, faceDetected: boolean) => {
      if (phaseRef.current !== "expression" || !faceDetected) {
        mouthOpenSinceRef.current = null;
        return;
      }
      const runtime = runtimeRef.current;
      if (!phaseCuesRef.current.has("wider") && score >= 0.2) {
        phaseCuesRef.current.add("wider");
        runtime?.say("Wider.");
        setAnnouncement("Wider.");
        return;
      }
      if (
        phaseCuesRef.current.has("wider") &&
        !phaseCuesRef.current.has("wiiider") &&
        score >= 0.4
      ) {
        phaseCuesRef.current.add("wiiider");
        runtime?.say("Wiiider!");
        setAnnouncement("Wiiider.");
        return;
      }
      if (score < 0.58) {
        mouthOpenSinceRef.current = null;
        return;
      }
      if (mouthOpenSinceRef.current === null) {
        mouthOpenSinceRef.current = performance.now();
        setAnnouncement("Hold it.");
        return;
      }
      if (
        performance.now() - mouthOpenSinceRef.current < 450 ||
        frameCapturePendingRef.current
      ) {
        return;
      }
      const video = videoRef.current;
      if (!video) return;
      frameCapturePendingRef.current = true;
      runtime?.say("Perfect.");
      setAnnouncement("Perfect. Hold that.");
      finishMouthCapture(video);
    },
    [finishMouthCapture],
  );

  const onEngineTick = useCallback(
    (_deltaMs: number) => {
      const currentPhase = phaseRef.current;
      const now = performance.now();
      const previousTick = lastEngineTickAtRef.current ?? now;
      lastEngineTickAtRef.current = now;
      const tickDelta = Math.max(0, Math.min(now - previousTick, 50));
      phaseElapsedRef.current += tickDelta;
      const elapsed = phaseElapsedRef.current;

      if (currentPhase === "scan") {
        if (
          (voiceHeardRef.current && elapsed >= 650) ||
          elapsed >= 4800
        ) {
          runtimeRef.current?.disarmVoiceCapture();
          transitionTo("scan-exit");
        }
        return;
      }

      if (currentPhase === "voice") {
        if ((voiceHeardRef.current && elapsed >= 460) || elapsed >= 3900) {
          runtimeRef.current?.disarmVoiceCapture();
          if (!typedPhrase) {
            setTypedPhrase(
              mediaMode === "prerecorded"
                ? SPOKEN_PHRASE
                : "Voice detected. Loud and clear.",
            );
          }
          transitionTo("voice-hold");
        }
        return;
      }

      if (currentPhase === "expression") {
        const localFaceActive =
          faceModeRef.current === "loading" ||
          faceModeRef.current === "live";
        if (localFaceActive) {
          if (elapsed >= 10_000 && !frameCapturePendingRef.current) {
            const video = videoRef.current;
            faceRuntimeRef.current?.dispose();
            faceRuntimeRef.current = null;
            faceModeRef.current = "fallback";
            setFaceMode("fallback");
            runtimeRef.current?.say(
              "We’ll save the game-face check for later.",
            );
            setAnnouncement(
              "On-device expression check timed out. Continuing safely.",
            );
            if (video) {
              frameCapturePendingRef.current = true;
              finishMouthCapture(video, true);
            } else {
              transitionTo("expression-success");
            }
          }
          return;
        }

        const cue = (id: string, at: number, line: string) => {
          if (elapsed < at || phaseCuesRef.current.has(id)) return;
          phaseCuesRef.current.add(id);
          runtimeRef.current?.say(line);
          setAnnouncement(line);
        };
        cue("wider", 780, "Wider.");
        cue("wiiider", 1580, "Wiiider!");

        const duration = PHASE_DURATION_MS.expression!;
        if (elapsed >= duration && !frameCapturePendingRef.current) {
          const video = videoRef.current;
          if (!video) {
            transitionTo("expression-success");
            return;
          }
          frameCapturePendingRef.current = true;
          finishMouthCapture(
            video,
            faceModeRef.current === "fallback" && mediaMode === "live",
          );
        }
        return;
      }

      if (currentPhase === "break") {
        const cue = (id: string, at: number, line: string) => {
          if (elapsed < at || phaseCuesRef.current.has(id)) return;
          phaseCuesRef.current.add(id);
          runtimeRef.current?.say(line);
          setAnnouncement(line);
        };
        cue("muscle", 1450, "Come on—put some muscle into it.");
        cue("challenge", 3000, "That’s all you’ve got?");
        if (phaseCuesRef.current.has("ending")) return;
        const holdForManualShake =
          process.env.NODE_ENV !== "production" &&
          new URLSearchParams(window.location.search).get(
            "calibrationShake",
          ) === "manual";
        if (
          !holdForManualShake &&
          elapsed >= 5900 &&
          phaseRef.current === "break"
        ) {
          phaseCuesRef.current.add("ending");
          runtimeRef.current?.say("Yeah, this isn’t breaking. New plan.");
          setAnnouncement("Yeah, this isn’t breaking. New plan.");
          const timer = window.setTimeout(() => {
            if (phaseRef.current === "break") transitionTo("ice-rain");
          }, 920);
          syntheticTimersRef.current.push(timer);
        }
        return;
      }

      if (currentPhase === "zoom") {
        if (zoomAutoRef.current) {
          const nextProgress = Math.min(
            1,
            zoomProgressRef.current + tickDelta / 1650,
          );
          zoomProgressRef.current = nextProgress;
          setZoomProgress(nextProgress);
          if (nextProgress >= 1) {
            zoomAutoRef.current = false;
            runtimeRef.current?.say("There it is. Let’s get a drink.");
            setAnnouncement("A whole field of glasses.");
            transitionTo("pour");
          }
          return;
        }
        const holdForManualZoom =
          process.env.NODE_ENV !== "production" &&
          new URLSearchParams(window.location.search).get(
            "calibrationZoom",
          ) === "manual";
        if (
          !holdForManualZoom &&
          elapsed >= 6500 &&
          phaseRef.current === "zoom"
        ) {
          zoomProgressRef.current = 1;
          setZoomProgress(1);
          runtimeRef.current?.say("There it is. Let’s get a drink.");
          setAnnouncement("Table revealed.");
          transitionTo("pour");
        }
        return;
      }

      if (currentPhase === "drink") {
        const holdForManualDrink =
          process.env.NODE_ENV !== "production" &&
          new URLSearchParams(window.location.search).get(
            "calibrationDrink",
          ) === "manual";
        if (
          !holdForManualDrink &&
          elapsed >= 6500 &&
          phaseRef.current === "drink"
        ) {
          runtimeRef.current?.say(
            "Desktop mode—I’ll tip the glass for you. Bottoms up.",
          );
          setAnnouncement("Draining the glass.");
          transitionTo("drain");
        }
        return;
      }

      const duration = PHASE_DURATION_MS[currentPhase];
      const nextPhase = NEXT_PHASE[currentPhase];
      if (
        duration !== undefined &&
        nextPhase &&
        elapsed >=
          (reducedMotion &&
          ["charge", "freeze", "drop", "shatter"].includes(currentPhase)
            ? Math.min(duration, 260)
            : duration)
      ) {
        transitionTo(nextPhase);
        return;
      }

      if (
        currentPhase === "blackout" &&
        elapsed >= PHASE_DURATION_MS.blackout! &&
        !completionStartedRef.current
      ) {
        completionStartedRef.current = true;
        void shutdownExternalRuntime().finally(() => {
          if (mountedRef.current) nextRef.current();
        });
      }
    },
    [
      finishMouthCapture,
      mediaMode,
      reducedMotion,
      shutdownExternalRuntime,
      transitionTo,
      typedPhrase,
    ],
  );

  useEffect(() => {
    mountedRef.current = true;
    const mediaQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    const forcedReducedMotion =
      process.env.NODE_ENV !== "production" &&
      new URLSearchParams(window.location.search).get(
        "calibrationReducedMotion",
      ) === "1";
    const syncReducedMotion = () =>
      setReducedMotion(mediaQuery.matches || forcedReducedMotion);
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

    const browserRuntime = new CalibrationBrowserRuntime({
      onAgentSpeaking: (speaking) => {
        if (speaking) setRuntimeNote("Godfrey is talking.");
      },
      onAudioLevel: (source, level) => {
        audioLevelsRef.current[source] = level;
      },
      onStatus: (message) => setRuntimeNote(message),
      onTranscript: (transcript) => {
        setTypedPhrase(transcript);
        voiceHeardRef.current = true;
      },
      onUserVoice: () => {
        voiceHeardRef.current = true;
      },
      onVoiceMode: setVoiceMode,
    });
    runtimeRef.current = browserRuntime;

    const sensorRuntime = new DeviceSensorRuntime({
      onInversion: acceptInversion,
      onShake: (direction, strength) =>
        acceptDirection(direction, 54 + strength * 76),
      onStatus: setSensorStatus,
      onTilt: ({ pitch, roll }) => {
        poseSequenceRef.current += 1;
        setDevicePose((current) => ({
          pitch,
          roll,
          velocity:
            Math.abs(pitch - current.pitch) + Math.abs(roll - current.roll),
          sequence: poseSequenceRef.current,
        }));
      },
    });
    sensorRuntimeRef.current = sensorRuntime;

    return () => {
      mountedRef.current = false;
      mediaQuery.removeEventListener("change", syncReducedMotion);
      syntheticTimersRef.current.forEach((timer) =>
        window.clearTimeout(timer),
      );
      syntheticTimersRef.current = [];
      sensorRuntime.dispose();
      faceRuntimeRef.current?.dispose();
      faceRuntimeRef.current = null;
      void browserRuntime.dispose();
      Object.values(audio).forEach((clip) => {
        clip?.pause();
        if (clip) clip.src = "";
      });
      runtimeRef.current = null;
      sensorRuntimeRef.current = null;
    };
  }, [acceptDirection, acceptInversion]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;

    if (phase === "scan") {
      voiceHeardRef.current = false;
      setTypedPhrase("");
      setAnnouncement("Hey—can you hear me?");
      if (!initialGuideSpokenRef.current) {
        runtime.say("Hey—can you hear me?");
      }
      const armTimer = window.setTimeout(() => {
        if (phaseRef.current !== "scan") return;
        runtime.armVoiceCapture();
        setAnnouncement("Your turn—say anything.");
      }, 1150);
      syntheticTimersRef.current.push(armTimer);
    } else if (phase === "scan-exit") {
      runtime.disarmVoiceCapture();
      setAnnouncement("Okay, we’ll save this for later.");
      runtime.say("Okay, we’ll save this for later.");
    } else if (phase === "face-hold") {
      setAnnouncement(
        "Cool, there you are. Let’s do a ridiculously quick calibration.",
      );
      runtime.say(
        "Cool, there you are. Let’s do a ridiculously quick calibration.",
      );
    } else if (phase === "voice-prompt") {
      setAnnouncement(
        "Say literally anything—the first thing that comes to mind.",
      );
      runtime.say(
        "Say literally anything—the first thing that comes to mind.",
      );
    } else if (phase === "voice") {
      voiceHeardRef.current = false;
      setTypedPhrase("");
      runtime.armVoiceCapture();
      setAnnouncement("Listening.");
    } else if (phase === "voice-success") {
      runtime.disarmVoiceCapture();
      runtime.say("Heck yeah. Havoc can hear you.");
      setAnnouncement("Heck yeah. Havoc can hear you.");
    } else if (phase === "expression-prompt") {
      faceRuntimeRef.current?.dispose();
      faceRuntimeRef.current = null;
      mouthOpenSinceRef.current = null;
      if (
        mediaMode === "live" &&
        !reducedMotion &&
        videoRef.current
      ) {
        faceModeRef.current = "loading";
        setFaceMode("loading");
        setRuntimeNote("Loading the on-device expression model.");
        const faceRuntime = new CalibrationFaceRuntime({
          onJawOpen: handleJawOpen,
          onMode: (mode) => {
            faceModeRef.current = mode;
            setFaceMode(mode);
            if (mode === "live") {
              setRuntimeNote(
                "On-device facial-expression calibration ready.",
              );
            } else if (mode === "fallback") {
              setRuntimeNote(
                "Expression model unavailable. Using the timed guide.",
              );
            }
          },
        });
        faceRuntimeRef.current = faceRuntime;
        const expressionVideo = videoRef.current;
        void faceRuntime.start(expressionVideo).then((started) => {
          if (!started) {
            if (faceRuntimeRef.current === faceRuntime) {
              faceRuntimeRef.current = null;
            }
            return;
          }
          if (
            ["expression-prompt", "expression"].includes(phaseRef.current)
          ) {
            return;
          }
          faceRuntime.dispose();
          if (faceRuntimeRef.current === faceRuntime) {
            faceRuntimeRef.current = null;
          }
        });
      } else {
        faceModeRef.current = "fallback";
        setFaceMode("fallback");
      }
      runtime.say(
        "Now open your mouth for the game-face check. This powers a lot of our games.",
      );
      setAnnouncement(
        "Open your mouth for the game-face check.",
      );
    } else if (phase === "expression") {
      setAnnouncement("Open wide.");
    } else if (phase === "expression-success") {
      faceRuntimeRef.current?.dispose();
      faceRuntimeRef.current = null;
      if (faceModeRef.current === "live") {
        setAnnouncement("Game face locked.");
      } else {
        runtime.say("Perfect. Hold that.");
        setAnnouncement("Perfect. Hold that.");
      }
    } else if (phase === "charge") {
      runtime.say(
        "I’m sorry, but we need to test some movement. Don’t move. This is probably safe.",
      );
      setAnnouncement("One movement test. Don’t move. This is probably safe.");
      playQuietly(audioRef.current.charge, 0.18);
    } else if (phase === "freeze") {
      runtime.say("FREEZE GUN!");
      setAnnouncement("Freeze gun.");
      playQuietly(audioRef.current.fire, 0.22);
    } else if (phase === "drop") {
      setAnnouncement("Frozen portrait dropping.");
    } else if (phase === "break") {
      runtime.say(
        "Okay, tiny problem. You’re an ice cube. Shake your phone like you mean it.",
      );
      setAnnouncement("You’re an ice cube. Shake your phone like you mean it.");
    } else if (phase === "ice-rain") {
      runtime.say("If you can’t leave the ice, I’m bringing the ice to you.");
      setAnnouncement("Ice delivery.");
    } else if (phase === "zoom-prompt") {
      runtime.say("Zoom out for me, would ya?");
      setAnnouncement("Zoom out for me, would ya?");
    } else if (phase === "zoom") {
      setAnnouncement("Pinch, scroll, or press minus to zoom out.");
    } else if (phase === "pour") {
      runtime.say("There it is. Let’s get a drink.");
      setAnnouncement("Pouring something extremely classified.");
    } else if (phase === "return-phone") {
      setAnnouncement("Returning to your glass.");
    } else if (phase === "drink-prompt") {
      runtime.say(
        "Go ahead—flip your phone upside down and drink the secret juice.",
      );
      setAnnouncement("Flip your phone and drink the secret juice.");
    } else if (phase === "drink") {
      setAnnouncement("Turn the phone upside down.");
    } else if (phase === "drain") {
      setAnnouncement("Secret juice draining.");
    } else if (phase === "drink-finish") {
      runtime.say(
        "Okay, all done. Drinking yourself… pretty weird.",
      );
      setAnnouncement("Calibration complete.");
    } else if (phase === "shatter") {
      setAnnouncement("Calibration complete.");
      playQuietly(audioRef.current.shatter, 0.25);
    }

    if (
      process.env.NODE_ENV !== "production" &&
      new URLSearchParams(window.location.search).get("calibrationSensors") ===
        "synthetic"
    ) {
      if (phase === "scan") {
        const timer = window.setTimeout(() => {
          voiceHeardRef.current = true;
        }, 1650);
        syntheticTimersRef.current.push(timer);
      } else if (phase === "voice") {
        const timer = window.setTimeout(() => {
          setTypedPhrase(SPOKEN_PHRASE);
          voiceHeardRef.current = true;
        }, 720);
        syntheticTimersRef.current.push(timer);
      } else if (
        phase === "break" &&
        new URLSearchParams(window.location.search).get(
          "calibrationShake",
        ) !== "manual"
      ) {
        for (let index = 0; index < 12; index += 1) {
          const timer = window.setTimeout(
            () => sensorRuntimeRef.current?.synthetic.shake(1),
            420 + index * 120,
          );
          syntheticTimersRef.current.push(timer);
        }
      } else if (
        phase === "zoom" &&
        new URLSearchParams(window.location.search).get(
          "calibrationZoom",
        ) !== "manual"
      ) {
        const timer = window.setTimeout(() => acceptZoom(1), 520);
        syntheticTimersRef.current.push(timer);
      } else if (
        phase === "drink" &&
        new URLSearchParams(window.location.search).get(
          "calibrationDrink",
        ) !== "manual"
      ) {
        const timer = window.setTimeout(
          () => sensorRuntimeRef.current?.synthetic.invert(),
          520,
        );
        syntheticTimersRef.current.push(timer);
      }
    }
  }, [
    acceptZoom,
    handleJawOpen,
    mediaMode,
    phase,
    reducedMotion,
  ]);

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

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const requested = new URLSearchParams(window.location.search).get(
      "calibrationPreview",
    ) as CalibrationPhase | null;
    if (!requested || !CALIBRATION_PREVIEW_PHASES.has(requested)) return;
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    video.srcObject = null;
    video.src = "/havoc-calibration-demo.mp4";
    video.muted = true;
    video.loop = true;
    setMediaMode("prerecorded");
    setFreezeFrame("/havoc-calibration-freeze.jpg");
    if (requested === "zoom") {
      zoomProgressRef.current = 0.62;
      setZoomProgress(0.62);
    }
    const timer = window.setTimeout(() => transitionTo(requested), 120);
    return () => window.clearTimeout(timer);
  }, [transitionTo]);

  const startLab = useCallback(() => {
    if (phaseRef.current !== "idle") return;
    const video = videoRef.current;
    const runtime = runtimeRef.current;
    const sensors = sensorRuntimeRef.current;
    if (!video || !runtime || !sensors) return;

    voiceHeardRef.current = false;
    initialGuideSpokenRef.current = true;
    lastDirectionRef.current = 0;
    accumulatedWheelRef.current = 0;
    reversalCountRef.current = 0;
    zoomProgressRef.current = 0;
    zoomAutoRef.current = false;
    lastAcceptedAtRef.current = 0;
    poseSequenceRef.current = 0;
    frameCapturePendingRef.current = false;
    completionStartedRef.current = false;
    faceRuntimeRef.current?.dispose();
    faceRuntimeRef.current = null;
    faceModeRef.current = "idle";
    mouthOpenSinceRef.current = null;
    setTypedPhrase("");
    setFreezeFrame(null);
    setReversalCount(0);
    setZoomProgress(0);
    setFaceMode("idle");
    setShakeImpulse({ direction: 0, progress: 0, sequence: 0 });
    setDevicePose({ pitch: 0, roll: 0, velocity: 0, sequence: 0 });
    setPlayError(false);
    setSensorStatus("listening");
    setAnnouncement("Hey—can you hear me?");
    runtime.unlockGuideAudio("Hey—can you hear me?");

    // Keep the lab visually complete while the browser permission sheet is
    // open. A granted camera stream replaces this privacy-safe preview in
    // `startMedia`; a denied or ignored prompt never leaves a blank chamber.
    video.pause();
    video.srcObject = null;
    video.src = "/havoc-calibration-demo.mp4";
    video.muted = true;
    video.loop = true;
    video.currentTime = 0;
    setMediaMode("prerecorded");
    setRuntimeNote(
      "Camera permission pending. The privacy-safe preview is ready.",
    );
    void video.play().catch(() => setPlayError(true));

    // Both permission requests are invoked synchronously inside this click.
    // Do not insert an await above them: iOS requires transient activation.
    const sensorPermission = requestCalibrationSensorPermissions();
    const forceDemoMedia =
      process.env.NODE_ENV !== "production" &&
      new URLSearchParams(window.location.search).get("calibrationMedia") ===
        "demo";
    const mediaAttempt = forceDemoMedia
      ? Promise.resolve<CalibrationMediaMode>("prerecorded")
      : runtime.startMedia(video, () =>
          [
            "scan",
            "scan-exit",
            "face-hold",
            "voice-prompt",
            "voice",
            "voice-hold",
            "voice-success",
          ].includes(phaseRef.current),
        );
    const voiceAttempt = runtime.startVoiceAgent();
    transitionTo("scan");

    void sensorPermission.then((permission) => {
      if (!mountedRef.current) return;
      sensors.start(permission);
    });

    void mediaAttempt
      .then((mode) => {
        if (!mountedRef.current) return;
        setMediaMode(mode);
      })
      .catch(() => {
        if (!mountedRef.current) return;
        video.pause();
        video.srcObject = null;
        video.src = "/havoc-calibration-demo.mp4";
        video.muted = true;
        video.loop = true;
        video.currentTime = 0;
        setMediaMode("prerecorded");
        setRuntimeNote(
          "Camera unavailable. Playing the privacy-safe concept fallback.",
        );
        void video.play().catch(() => setPlayError(true));
      });

    void voiceAttempt;
  }, [transitionTo]);

  useEffect(() => {
    const onDesktopMotion = (
      event: CustomEvent<HavocDeviceTestMotion>,
    ) => {
      const motion = event.detail;
      poseSequenceRef.current += 1;
      setDevicePose({
        pitch: motion.pitch,
        roll: motion.roll,
        velocity:
          Math.abs(motion.deltaPitch) + Math.abs(motion.deltaRoll),
        sequence: poseSequenceRef.current,
      });

      if (
        phaseRef.current === "break" &&
        Math.abs(motion.deltaPitch) >= 3
      ) {
        acceptDirection(
          Math.sign(motion.deltaPitch),
          54 + Math.abs(motion.deltaPitch) * 2.2,
        );
      }
      if (
        phaseRef.current === "drink" &&
        Math.abs(motion.pitch) >= 145
      ) {
        acceptInversion();
      }
    };

    window.addEventListener(HAVOC_DEVICE_TEST_EVENT, onDesktopMotion);
    return () =>
      window.removeEventListener(HAVOC_DEVICE_TEST_EVENT, onDesktopMotion);
  }, [acceptDirection, acceptInversion]);

  useEffect(() => {
    if (!["break", "zoom", "drink"].includes(phase)) return;
    const stage = stageRef.current;
    if (!stage) return;
    stage.focus({ preventScroll: true });

    const onWheel = (event: WheelEvent) => {
      if (!stage.contains(event.target as Node)) return;
      event.preventDefault();
      event.stopPropagation();
      if (phaseRef.current === "drink") {
        if (Math.abs(event.deltaY) >= 45) acceptInversion();
        return;
      }
      const multiplier =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? 16
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? stage.clientHeight
            : 1;
      if (phaseRef.current === "zoom") {
        acceptZoom((event.deltaY * multiplier) / 420);
        return;
      }
      accumulatedWheelRef.current += event.deltaY * multiplier;
      if (Math.abs(accumulatedWheelRef.current) < 54) return;
      const distance = accumulatedWheelRef.current;
      accumulatedWheelRef.current = 0;
      acceptDirection(Math.sign(distance), Math.abs(distance));
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      const key = event.key.toLowerCase();
      if (phaseRef.current === "drink") {
        if (["r", " ", "enter", "arrowup", "arrowdown"].includes(key)) {
          event.preventDefault();
          event.stopPropagation();
          acceptInversion();
        }
        return;
      }
      if (phaseRef.current === "zoom") {
        const zoomChange =
          ["-", "_", "arrowdown", "pagedown", " ", "enter"].includes(key)
            ? 0.24
            : ["+", "=", "arrowup", "pageup"].includes(key)
              ? -0.18
              : 0;
        if (!zoomChange) return;
        event.preventDefault();
        event.stopPropagation();
        acceptZoom(zoomChange);
        return;
      }
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
      touchDistanceRef.current =
        event.touches.length >= 2
          ? Math.hypot(
              event.touches[0].clientX - event.touches[1].clientX,
              event.touches[0].clientY - event.touches[1].clientY,
            )
          : null;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (phaseRef.current !== "zoom" || event.touches.length < 2) return;
      const currentDistance = Math.hypot(
        event.touches[0].clientX - event.touches[1].clientX,
        event.touches[0].clientY - event.touches[1].clientY,
      );
      const previousDistance = touchDistanceRef.current;
      touchDistanceRef.current = currentDistance;
      if (previousDistance === null) return;
      event.preventDefault();
      event.stopPropagation();
      acceptZoom((previousDistance - currentDistance) / 150);
    };

    const onTouchEnd = (event: TouchEvent) => {
      const startY = touchStartYRef.current;
      touchStartYRef.current = null;
      touchDistanceRef.current = null;
      const endY = event.changedTouches[0]?.clientY;
      if (startY === null || endY === undefined) return;
      const distance = endY - startY;
      if (phaseRef.current === "drink" && Math.abs(distance) >= 72) {
        event.preventDefault();
        acceptInversion();
        return;
      }
      if (phaseRef.current === "zoom" && Math.abs(distance) >= 45) {
        event.preventDefault();
        acceptZoom(Math.min(0.34, Math.abs(distance) / 320));
        return;
      }
      if (Math.abs(distance) < 54) return;
      event.preventDefault();
      acceptDirection(Math.sign(distance), Math.abs(distance));
    };

    stage.addEventListener("wheel", onWheel, {
      capture: true,
      passive: false,
    });
    stage.addEventListener("touchstart", onTouchStart, { passive: true });
    stage.addEventListener("touchmove", onTouchMove, { passive: false });
    stage.addEventListener("touchend", onTouchEnd, { passive: false });
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      stage.removeEventListener("wheel", onWheel, { capture: true });
      stage.removeEventListener("touchstart", onTouchStart);
      stage.removeEventListener("touchmove", onTouchMove);
      stage.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [acceptDirection, acceptInversion, acceptZoom, phase]);

  const onVisibilityChange = useCallback((hidden: boolean) => {
    const video = videoRef.current;
    if (!video) return;
    if (hidden) {
      video.pause();
    } else if (
      [
        "scan",
        "scan-exit",
        "face-hold",
        "voice-prompt",
        "voice",
        "voice-hold",
        "voice-success",
        "expression-prompt",
        "expression",
      ].includes(phaseRef.current)
    ) {
      void video.play().catch(() => setPlayError(true));
    }
  }, []);

  const instruction = useMemo(() => {
    if (phase === "voice-prompt" || phase === "voice") {
      return "SAY ANYTHING";
    }
    if (phase === "expression-prompt" || phase === "expression") {
      return "OPEN WIDE";
    }
    if (phase === "break") return "SHAKE TO CRACK IT";
    if (phase === "zoom-prompt" || phase === "zoom") return "ZOOM OUT";
    if (phase === "drink-prompt" || phase === "drink") {
      return "FLIP TO DRINK";
    }
    if (phase === "drain") return "BOTTOMS UP";
    return "";
  }, [phase]);

  const success =
    phase === "voice-success"
      ? "LOUD & CLEAR"
      : phase === "expression-success"
        ? "GAME FACE SAVED"
        : "";
  const cameraState =
    phase === "idle"
      ? "idle"
      : phase === "scan" || phase === "scan-exit"
        ? "scan"
        : "found";
  const showFrozenVisual = [
    "freeze",
    "drop",
    "break",
    "ice-rain",
    "zoom-prompt",
    "zoom",
    "pour",
    "return-phone",
    "drink-prompt",
    "drink",
    "drain",
    "drink-finish",
    "shatter",
    "blackout",
  ].includes(phase);
  const showVideo = !showFrozenVisual;
  const crackStage =
    reversalCount >= 10
      ? 5
      : reversalCount >= 8
        ? 4
        : reversalCount >= 6
          ? 3
          : reversalCount >= 4
            ? 2
            : reversalCount >= 2
              ? 1
              : 0;
  const sensorReady = sensorStatus === "healthy";
  const stepIndex = [
    "idle",
    "scan",
    "scan-exit",
    "face-hold",
    "voice-prompt",
    "voice",
    "voice-hold",
    "voice-success",
  ].includes(phase)
    ? 0
    : ["expression-prompt", "expression", "expression-success"].includes(phase)
      ? 1
      : ["charge", "freeze", "drop", "break"].includes(phase)
        ? 2
        : [
              "ice-rain",
              "zoom-prompt",
              "zoom",
              "pour",
              "return-phone",
            ].includes(phase)
          ? 3
          : 4;
  const stepLabel = [
    "Sound check",
    "Game face",
    "Movement",
    "Party trick",
    "Last sip",
  ][stepIndex];

  return (
    <div
      className={`${styles.lab} screen`}
      data-camera={cameraState}
      data-face-mode={faceMode}
      data-media={mediaMode}
      data-phase={phase}
      data-playback={playError ? "paused" : "playing"}
      data-reduced-motion={reducedMotion ? "true" : "false"}
      data-sensors={sensorStatus}
      ref={stageRef}
      tabIndex={["break", "zoom", "drink"].includes(phase) ? 0 : -1}
      aria-label={
        phase === "break"
          ? "Shake or swipe to crack the frozen portrait cube"
          : phase === "zoom"
            ? "Pinch or scroll to pull the camera out of the glass"
            : phase === "drink"
              ? "Turn the device upside down to pour out the drink"
              : "Havoc Calibration Lab"
      }
    >
      <header className={styles.labHeader}>
        <div>
          <span className={styles.brand}>HAVOC</span>
          <span className={styles.sectionName}>Calibration lab</span>
        </div>
        <span className={styles.stepCount}>
          {stepIndex + 1} / 5 · {stepLabel}
        </span>
        <div className={styles.progressRail} aria-hidden="true">
          {Array.from({ length: 5 }, (_, index) => (
            <i
              key={index}
              data-active={index === stepIndex ? "true" : "false"}
              data-complete={index < stepIndex ? "true" : "false"}
            />
          ))}
        </div>
      </header>

      <div className={styles.effectsHost} aria-hidden="true">
        <CalibrationEffects
          audioLevels={audioLevelsRef}
          devicePose={devicePose}
          freezeFrame={freezeFrame}
          impulse={shakeImpulse}
          onFallback={() => setEffectsFailed(true)}
          onTick={onEngineTick}
          onVisibilityChange={onVisibilityChange}
          phase={phase}
          reducedMotion={reducedMotion}
          zoomProgress={zoomProgress}
        />
      </div>

      {effectsFailed && phase === "idle" && (
        <div className={styles.fallbackOrbit} aria-hidden="true">
          <span>GODFREY IS READY</span>
        </div>
      )}

      <div className={styles.chamber} data-video={showVideo ? "on" : "off"}>
        <video
          aria-label={
            mediaMode === "live"
              ? "Live mirrored front camera preview"
              : "Calibration camera concept fallback"
          }
          autoPlay
          className={styles.cameraVideo}
          muted
          playsInline
          preload="metadata"
          ref={videoRef}
        />
        {phase === "scan" && (
          <span className={styles.scanLine} aria-hidden="true" />
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

      {phase === "idle" && (
        <button
          type="button"
          className={styles.startButton}
          onClick={startLab}
          aria-label="Start the Calibration Lab"
        >
          <span>
            <b>Start calibration</b>
            <small>Camera + voice + motion stay on-device</small>
          </span>
          <i aria-hidden="true">→</i>
        </button>
      )}

      <div className={styles.gunRig} data-phase={phase} aria-hidden="true">
        <img
          src="/havoc-calibration-water-gun.png"
          alt=""
          draggable={false}
        />
      </div>

      {!["shatter", "blackout"].includes(phase) && (
        <div className={styles.guideCard} data-phase={phase}>
          <span className={styles.guideAvatar} aria-hidden="true">
            <i />
            <i />
            <b />
          </span>
          <p>
            <strong>GODFREY</strong>
            <span>{announcement}</span>
          </p>
          <span className={styles.guideLive} aria-hidden="true">
            {voiceMode === "vapi" ? "LIVE" : "GUIDE"}
          </span>
        </div>
      )}

      <div className={styles.copyLayer}>
        {success && <strong className={styles.success}>{success}</strong>}
        {instruction && (
          <div className={styles.instruction}>
            <strong>{instruction}</strong>
            {phase === "break" && (
              <>
                <span>
                  {reversalCount} / {REQUIRED_REVERSALS} CRACKS
                </span>
                <small>
                  {sensorReady
                    ? "Shake your phone"
                    : "Swipe up and down, use ↑/↓, or rotate the preview"}
                </small>
              </>
            )}
            {(phase === "zoom-prompt" || phase === "zoom") && (
              <>
                <span>{Math.round(zoomProgress * 100)}% REVEALED</span>
                <small>Pinch in, scroll down, or press −</small>
              </>
            )}
            {(phase === "drink-prompt" || phase === "drink") && (
              <>
                <span>DRINK TEST</span>
                <small>
                  {sensorReady
                    ? "Turn the phone upside down"
                    : "Rotate the preview, swipe, scroll, or press R"}
                </small>
              </>
            )}
          </div>
        )}
        {(phase === "voice" ||
          phase === "voice-hold" ||
          phase === "voice-success") &&
          typedPhrase && (
            <p className={styles.typedPhrase} aria-label={typedPhrase}>
              “{typedPhrase}”
            </p>
        )}
      </div>

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

      <span
        className={styles.liveBadge}
        data-live={mediaMode === "live" ? "true" : "false"}
        title={runtimeNote}
      >
        <i aria-hidden="true" />
        {mediaMode === "live"
          ? "LIVE CAMERA"
          : mediaMode === "prerecorded"
            ? "SAFE DEMO MODE"
            : "READY"}{" "}
        · {voiceModeLabel(voiceMode)}
      </span>
      <span className={styles.liveRegion} aria-live="polite">
        {announcement}
      </span>
      <span className={styles.blackCover} aria-hidden="true" />
    </div>
  );
}
