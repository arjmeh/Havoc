"use client";

import type { FaceLandmarker } from "@mediapipe/tasks-vision";
import type Vapi from "@vapi-ai/web";

export type CalibrationVoiceMode =
  | "vapi"
  | "browser"
  | "silent"
  | "connecting";

export type CalibrationMediaMode = "live" | "prerecorded" | "idle";

export type CalibrationAudioLevels = {
  agent: number;
  user: number;
};

export type CalibrationRuntimeCallbacks = {
  onAgentSpeaking?: (speaking: boolean) => void;
  onAudioLevel?: (source: "agent" | "user", level: number) => void;
  onStatus?: (message: string) => void;
  onTranscript?: (transcript: string, final: boolean) => void;
  onUserVoice?: () => void;
  onVoiceMode?: (mode: CalibrationVoiceMode) => void;
};

export type CalibrationFaceMode =
  | "idle"
  | "loading"
  | "live"
  | "fallback";

export type CalibrationFaceCallbacks = {
  onJawOpen: (score: number, faceDetected: boolean) => void;
  onMode?: (mode: CalibrationFaceMode) => void;
};

type SpeechRecognitionResultLike = {
  0?: { transcript?: string };
  isFinal?: boolean;
};

type SpeechRecognitionEventLike = {
  resultIndex?: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
};

type SpeechRecognitionLike = {
  abort: () => void;
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(Math.max(value, minimum), maximum);

const EXPECTED_MEDIAPIPE_INIT_LOGS = [
  "face_landmarker_graph.cc:180",
  "gl_context.cc:1119",
  "Created TensorFlow Lite XNNPACK delegate for CPU",
  "inference_feedback_manager.cc:121",
];

const isExpectedMediaPipeInitLog = (parts: unknown[]) => {
  const message = parts.map((part) => String(part)).join(" ");
  return EXPECTED_MEDIAPIPE_INIT_LOGS.some((token) => message.includes(token));
};

let mediaPipeLogFilterDepth = 0;
let unfilteredConsoleWarn: typeof console.warn | null = null;
let unfilteredConsoleError: typeof console.error | null = null;

const installMediaPipeLogFilter = () => {
  mediaPipeLogFilterDepth += 1;
  if (mediaPipeLogFilterDepth === 1) {
    unfilteredConsoleWarn = console.warn;
    unfilteredConsoleError = console.error;
    console.warn = (...parts: unknown[]) => {
      if (!isExpectedMediaPipeInitLog(parts)) {
        unfilteredConsoleWarn?.(...parts);
      }
    };
    console.error = (...parts: unknown[]) => {
      if (!isExpectedMediaPipeInitLog(parts)) {
        unfilteredConsoleError?.(...parts);
      }
    };
  }

  let restored = false;
  return () => {
    if (restored) return;
    restored = true;
    mediaPipeLogFilterDepth = Math.max(0, mediaPipeLogFilterDepth - 1);
    if (mediaPipeLogFilterDepth !== 0) return;
    if (unfilteredConsoleWarn) console.warn = unfilteredConsoleWarn;
    if (unfilteredConsoleError) console.error = unfilteredConsoleError;
    unfilteredConsoleWarn = null;
    unfilteredConsoleError = null;
  };
};

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY?.trim() ?? "";
const ASSISTANT_ID =
  process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID?.trim() ?? "";

const isFinalTranscript = (message: unknown) => {
  if (!message || typeof message !== "object") return false;
  const candidate = message as { transcriptType?: unknown };
  return candidate.transcriptType === "final";
};

const readUserTranscript = (message: unknown) => {
  if (!message || typeof message !== "object") return null;
  const candidate = message as {
    role?: unknown;
    transcript?: unknown;
    type?: unknown;
  };
  if (
    candidate.type !== "transcript" ||
    candidate.role !== "user" ||
    typeof candidate.transcript !== "string"
  ) {
    return null;
  }
  return candidate.transcript.trim();
};

export const hasConfiguredVapi = () => Boolean(PUBLIC_KEY && ASSISTANT_ID);

/**
 * Local facial-expression adapter. The model and Wasm files are served from
 * this app; camera frames are passed directly from the HTMLVideoElement to
 * MediaPipe and are never serialized by Havoc or sent to a Havoc server.
 * MediaPipe's own utilization-metrics disclosure is documented in
 * docs/calibration-runtime.md.
 */
export class CalibrationFaceRuntime {
  private readonly callbacks: CalibrationFaceCallbacks;
  private disposed = false;
  private frame = 0;
  private landmarker: FaceLandmarker | null = null;
  private lastInferenceAt = 0;
  private lastVideoTime = -1;
  private restoreLogFilter: (() => void) | null = null;
  private video: HTMLVideoElement | null = null;

  public constructor(callbacks: CalibrationFaceCallbacks) {
    this.callbacks = callbacks;
  }

  public async start(video: HTMLVideoElement): Promise<boolean> {
    if (this.disposed) return false;
    this.callbacks.onMode?.("loading");
    this.video = video;
    this.restoreLogFilter?.();
    this.restoreLogFilter = installMediaPipeLogFilter();
    try {
      const { FaceLandmarker, FilesetResolver } = await import(
        "@mediapipe/tasks-vision"
      );
      const fileset = await FilesetResolver.forVisionTasks(
        "/calibration-vision",
      );
      if (this.disposed) return false;
      const landmarker = await FaceLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath:
            "/calibration-vision/face_landmarker.task",
        },
        minFaceDetectionConfidence: 0.5,
        minFacePresenceConfidence: 0.5,
        minTrackingConfidence: 0.45,
        numFaces: 1,
        outputFaceBlendshapes: true,
        runningMode: "VIDEO",
      });
      if (this.disposed) {
        landmarker.close();
        return false;
      }
      this.landmarker = landmarker;
      this.callbacks.onMode?.("live");
      this.frame = window.requestAnimationFrame(this.sample);
      return true;
    } catch {
      this.restoreLogFilter?.();
      this.restoreLogFilter = null;
      this.callbacks.onMode?.("fallback");
      return false;
    }
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.frame) window.cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.landmarker?.close();
    this.landmarker = null;
    this.restoreLogFilter?.();
    this.restoreLogFilter = null;
    this.video = null;
  }

  private readonly sample = (now: number) => {
    if (this.disposed || !this.landmarker || !this.video) return;
    const video = this.video;
    if (
      now - this.lastInferenceAt >= 90 &&
      video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
      video.currentTime !== this.lastVideoTime
    ) {
      this.lastInferenceAt = now;
      this.lastVideoTime = video.currentTime;
      try {
        const result = this.landmarker.detectForVideo(video, now);
        const jawOpen = result.faceBlendshapes[0]?.categories.find(
          (category) => category.categoryName === "jawOpen",
        );
        this.callbacks.onJawOpen(
          jawOpen?.score ?? 0,
          result.faceLandmarks.length > 0,
        );
      } catch {
        this.callbacks.onJawOpen(0, false);
      }
    }
    this.frame = window.requestAnimationFrame(this.sample);
  };
}

/**
 * Owns every browser media, audio, speech, and optional Vapi resource used by
 * the Calibration Lab. `dispose` is intentionally idempotent.
 */
export class CalibrationBrowserRuntime {
  private readonly callbacks: CalibrationRuntimeCallbacks;
  private analyser: AnalyserNode | null = null;
  private audioContext: AudioContext | null = null;
  private audioFrame = 0;
  private browserAgentSpeaking = false;
  private disposed = false;
  private mediaStream: MediaStream | null = null;
  private recognition: SpeechRecognitionLike | null = null;
  private recognitionRestartTimer: number | null = null;
  private recognitionRunning = false;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private userLevel = 0;
  private userNoiseFloor = 0.012;
  private userSpeechFrames = 0;
  private userVoiceArmAt = 0;
  private userVoiceArmed = false;
  private userVoiceDelivered = false;
  private vapi: Vapi | null = null;
  private vapiActive = false;
  private vapiAgentLevel = 0;
  private vapiListeners: Array<() => void> = [];
  private video: HTMLVideoElement | null = null;

  public constructor(callbacks: CalibrationRuntimeCallbacks = {}) {
    this.callbacks = callbacks;
  }

  public async startMedia(
    video: HTMLVideoElement,
    shouldAdoptStream: () => boolean = () => true,
  ): Promise<CalibrationMediaMode> {
    if (this.disposed) return "idle";
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Live camera and microphone require HTTPS.");
    }

    this.video = video;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        autoGainControl: true,
        echoCancellation: true,
        noiseSuppression: true,
      },
      video: {
        aspectRatio: { ideal: 1 },
        facingMode: "user",
        frameRate: { ideal: 30, max: 30 },
        height: { ideal: 720 },
        width: { ideal: 720 },
      },
    });

    // Permission sheets can stay open long enough for the authored sequence to
    // reach expression capture. Never swap a late camera stream underneath an
    // in-progress capture; keep the already-playing privacy-safe source stable.
    if (this.disposed || !shouldAdoptStream()) {
      stream.getTracks().forEach((track) => track.stop());
      return this.disposed ? "idle" : "prerecorded";
    }

    this.mediaStream = stream;
    try {
      video.pause();
      video.removeAttribute("src");
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      await video.play();
      await this.startAudioAnalysis(stream);
    } catch (error) {
      stream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
      video.srcObject = null;
      throw error;
    }
    this.callbacks.onStatus?.("Live camera and microphone ready.");
    return "live";
  }

  public async startVoiceAgent(): Promise<CalibrationVoiceMode> {
    if (this.disposed) return "silent";
    if (!hasConfiguredVapi()) {
      const mode = this.hasBrowserSpeech() ? "browser" : "silent";
      this.callbacks.onVoiceMode?.(mode);
      return mode;
    }

    this.callbacks.onVoiceMode?.("connecting");
    try {
      const { default: VapiClient } = await import("@vapi-ai/web");
      if (this.disposed) return "silent";
      const client = new VapiClient(PUBLIC_KEY);
      this.vapi = client;
      this.bindVapi(client);
      await client.start(ASSISTANT_ID, {
        backgroundSound: "off",
        firstMessage: "",
        firstMessageMode: "assistant-waits-for-user",
        maxDurationSeconds: 90,
      });
      if (this.disposed) {
        await client.stop().catch(() => undefined);
        return "silent";
      }
      this.vapiActive = true;
      this.callbacks.onVoiceMode?.("vapi");
      this.callbacks.onStatus?.("Godfrey voice agent connected.");
      return "vapi";
    } catch {
      await this.stopVapi();
      const mode = this.hasBrowserSpeech() ? "browser" : "silent";
      this.callbacks.onVoiceMode?.(mode);
      this.callbacks.onStatus?.(
        "Voice agent unavailable. Continuing with the on-device guide.",
      );
      return mode;
    }
  }

  public armVoiceCapture(): void {
    this.userVoiceArmed = true;
    this.userVoiceArmAt = performance.now();
    this.userVoiceDelivered = false;
    this.userSpeechFrames = 0;
    this.startRecognition();
  }

  public disarmVoiceCapture(): void {
    this.userVoiceArmed = false;
    this.userVoiceArmAt = 0;
    this.userSpeechFrames = 0;
    this.stopRecognition();
  }

  public say(message: string): void {
    if (this.disposed || !message.trim()) return;
    if (this.vapiActive && this.vapi) {
      this.vapi.say(message, false, false, true);
      return;
    }
    this.speakInBrowser(message);
  }

  public async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    this.userVoiceArmed = false;

    this.stopRecognition();
    if (this.recognitionRestartTimer !== null) {
      window.clearTimeout(this.recognitionRestartTimer);
      this.recognitionRestartTimer = null;
    }
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();

    if (this.audioFrame) window.cancelAnimationFrame(this.audioFrame);
    this.audioFrame = 0;
    this.analyser?.disconnect();
    this.sourceNode?.disconnect();
    this.analyser = null;
    this.sourceNode = null;

    const context = this.audioContext;
    this.audioContext = null;
    if (context && context.state !== "closed") {
      await context.close().catch(() => undefined);
    }

    this.mediaStream?.getTracks().forEach((track) => track.stop());
    this.mediaStream = null;
    if (this.video) {
      this.video.pause();
      this.video.srcObject = null;
    }
    this.video = null;

    await this.stopVapi();
    this.callbacks.onAudioLevel?.("user", 0);
    this.callbacks.onAudioLevel?.("agent", 0);
    this.callbacks.onAgentSpeaking?.(false);
  }

  private async startAudioAnalysis(stream: MediaStream): Promise<void> {
    const AudioContextConstructor =
      window.AudioContext ??
      (
        window as typeof window & {
          webkitAudioContext?: typeof AudioContext;
        }
      ).webkitAudioContext;
    if (!AudioContextConstructor || !stream.getAudioTracks().length) return;

    const context = new AudioContextConstructor();
    this.audioContext = context;
    if (context.state === "suspended") {
      await context.resume().catch(() => undefined);
    }
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.62;
    source.connect(analyser);
    this.sourceNode = source;
    this.analyser = analyser;

    const samples = new Float32Array(analyser.fftSize);
    const sampleAudio = () => {
      if (this.disposed || !this.analyser) return;
      this.analyser.getFloatTimeDomainData(samples);
      let sum = 0;
      for (const sample of samples) sum += sample * sample;
      const rms = Math.sqrt(sum / samples.length);
      const normalized = clamp((rms - this.userNoiseFloor) * 8.6, 0, 1);
      this.userLevel = this.userLevel * 0.7 + normalized * 0.3;

      if (
        !this.userVoiceArmed ||
        this.browserAgentSpeaking ||
        this.vapiAgentLevel > 0.12
      ) {
        this.userNoiseFloor =
          this.userNoiseFloor * 0.988 + Math.min(rms, 0.04) * 0.012;
        this.userSpeechFrames = 0;
      } else if (
        performance.now() - this.userVoiceArmAt >= 800 &&
        this.userLevel > Math.max(0.24, this.userNoiseFloor * 5)
      ) {
        this.userSpeechFrames += 1;
        if (this.userSpeechFrames >= 8 && !this.userVoiceDelivered) {
          this.userVoiceDelivered = true;
          this.callbacks.onUserVoice?.();
        }
      } else {
        this.userSpeechFrames = Math.max(0, this.userSpeechFrames - 1);
      }

      const browserPulse = this.browserAgentSpeaking
        ? 0.38 + Math.abs(Math.sin(performance.now() * 0.014)) * 0.44
        : 0;
      const agentLevel = Math.max(this.vapiAgentLevel, browserPulse);
      this.vapiAgentLevel *= 0.86;
      this.callbacks.onAudioLevel?.("user", this.userLevel);
      this.callbacks.onAudioLevel?.("agent", agentLevel);
      this.audioFrame = window.requestAnimationFrame(sampleAudio);
    };
    this.audioFrame = window.requestAnimationFrame(sampleAudio);
  }

  private hasBrowserSpeech(): boolean {
    return "speechSynthesis" in window;
  }

  private speakInBrowser(message: string): void {
    if (!this.hasBrowserSpeech()) {
      this.callbacks.onStatus?.(message);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(message);
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice =
      voices.find(
        (voice) =>
          voice.lang.startsWith("en") &&
          /guy|daniel|aaron|reed|eddy|male/i.test(voice.name),
      ) ?? voices.find((voice) => voice.lang.startsWith("en"));
    if (preferredVoice) utterance.voice = preferredVoice;
    utterance.lang = "en-US";
    utterance.pitch = 0.96;
    utterance.rate = 1.08;
    utterance.volume = 0.92;
    utterance.onstart = () => {
      this.browserAgentSpeaking = true;
      this.callbacks.onAgentSpeaking?.(true);
    };
    utterance.onend = () => {
      this.browserAgentSpeaking = false;
      this.callbacks.onAgentSpeaking?.(false);
    };
    utterance.onerror = utterance.onend;
    window.speechSynthesis.speak(utterance);
  }

  private startRecognition(): void {
    if (this.vapiActive || this.recognitionRunning || this.disposed) return;
    const Recognition =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) return;

    if (!this.recognition) {
      const recognition = new Recognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      recognition.onresult = (event) => {
        if (
          this.browserAgentSpeaking ||
          performance.now() - this.userVoiceArmAt < 650
        ) {
          return;
        }
        let transcript = "";
        let final = false;
        const start = event.resultIndex ?? 0;
        for (let index = start; index < event.results.length; index += 1) {
          const result = event.results[index];
          transcript += result?.[0]?.transcript ?? "";
          final ||= Boolean(result?.isFinal);
        }
        const normalized = transcript.trim();
        if (!normalized) return;
        this.callbacks.onTranscript?.(normalized, final);
        if (!this.userVoiceDelivered) {
          this.userVoiceDelivered = true;
          this.callbacks.onUserVoice?.();
        }
      };
      recognition.onerror = () => {
        this.recognitionRunning = false;
      };
      recognition.onend = () => {
        this.recognitionRunning = false;
        if (!this.userVoiceArmed || this.disposed) return;
        this.recognitionRestartTimer = window.setTimeout(() => {
          this.recognitionRestartTimer = null;
          this.startRecognition();
        }, 240);
      };
      this.recognition = recognition;
    }

    try {
      this.recognition.start();
      this.recognitionRunning = true;
    } catch {
      this.recognitionRunning = false;
    }
  }

  private stopRecognition(): void {
    if (this.recognitionRestartTimer !== null) {
      window.clearTimeout(this.recognitionRestartTimer);
      this.recognitionRestartTimer = null;
    }
    if (!this.recognition || !this.recognitionRunning) return;
    try {
      this.recognition.stop();
    } catch {
      this.recognition.abort();
    }
    this.recognitionRunning = false;
  }

  private bindVapi(client: Vapi): void {
    const onCallStart = () => {
      this.vapiActive = true;
      this.callbacks.onVoiceMode?.("vapi");
    };
    const onCallEnd = () => {
      this.vapiActive = false;
      this.vapiAgentLevel = 0;
      this.callbacks.onVoiceMode?.(
        this.hasBrowserSpeech() ? "browser" : "silent",
      );
    };
    const onVolume = (level: number) => {
      this.vapiAgentLevel = clamp(level, 0, 1);
    };
    const onLocalVolume = (level: number) => {
      if (this.analyser) return;
      this.userLevel = clamp(level, 0, 1);
      this.callbacks.onAudioLevel?.("user", this.userLevel);
      if (
        this.userVoiceArmed &&
        !this.userVoiceDelivered &&
        this.vapiAgentLevel < 0.12 &&
        performance.now() - this.userVoiceArmAt >= 800 &&
        this.userLevel > 0.28
      ) {
        this.userVoiceDelivered = true;
        this.callbacks.onUserVoice?.();
      }
    };
    const onSpeechStart = () => {
      this.callbacks.onAgentSpeaking?.(true);
    };
    const onSpeechEnd = () => {
      this.callbacks.onAgentSpeaking?.(false);
    };
    const onMessage = (message: unknown) => {
      const transcript = readUserTranscript(message);
      if (!transcript) return;
      this.callbacks.onTranscript?.(
        transcript,
        isFinalTranscript(message),
      );
      if (!this.userVoiceDelivered) {
        this.userVoiceDelivered = true;
        this.callbacks.onUserVoice?.();
      }
    };
    const onError = () => {
      this.callbacks.onStatus?.(
        "Voice connection interrupted. The on-device guide is continuing.",
      );
    };

    client.on("call-start", onCallStart);
    client.on("call-end", onCallEnd);
    client.on("volume-level", onVolume);
    client.on("local-volume-level", onLocalVolume);
    client.on("speech-start", onSpeechStart);
    client.on("speech-end", onSpeechEnd);
    client.on("message", onMessage);
    client.on("error", onError);
    this.vapiListeners = [
      () => client.removeListener("call-start", onCallStart),
      () => client.removeListener("call-end", onCallEnd),
      () => client.removeListener("volume-level", onVolume),
      () => client.removeListener("local-volume-level", onLocalVolume),
      () => client.removeListener("speech-start", onSpeechStart),
      () => client.removeListener("speech-end", onSpeechEnd),
      () => client.removeListener("message", onMessage),
      () => client.removeListener("error", onError),
    ];
  }

  private async stopVapi(): Promise<void> {
    const client = this.vapi;
    this.vapi = null;
    this.vapiActive = false;
    this.vapiAgentLevel = 0;
    this.vapiListeners.forEach((remove) => remove());
    this.vapiListeners = [];
    if (client) await client.stop().catch(() => undefined);
  }
}
