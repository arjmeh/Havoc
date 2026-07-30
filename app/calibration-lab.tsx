"use client";

import {
  Bodies,
  Body,
  Composite,
  Engine,
  type Body as MatterBody,
} from "matter-js";
import { useCallback, useEffect, useRef, useState } from "react";

import styles from "./calibration-lab.module.css";

const VIDEO_CUES = {
  faceFound: 1.33,
  speechStart: 1.56,
  speechEnd: 3.18,
  voiceSuccess: 3.3,
  openPrompt: 3.75,
  mouthOpen: 4.92,
  mouthSuccess: 5,
  iceBeam: 5.08,
  freeze: 5.75,
} as const;

const SPOKEN_PHRASE = "Havoc’s about to get interesting.";

type LabPhase = "intro" | "running" | "shake" | "burst" | "black";
type ActorKind = "drop" | "flask" | "letter" | "ice" | "prompt" | "shard";

type PhysicsActor = {
  body: MatterBody;
  element: HTMLElement;
  height: number;
  kind: ActorKind;
  width: number;
};

type OptionalFrameVideo = {
  cancelVideoFrameCallback?: (handle: number) => void;
  requestVideoFrameCallback?: (
    callback: (now: DOMHighResTimeStamp, metadata: { mediaTime: number }) => void,
  ) => number;
};

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(Math.max(value, minimum), maximum);

export function CalibrationLabScreen({ next }: { next: () => void }) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const physicsLayerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const engineRef = useRef<Engine | null>(null);
  const orbBodyRef = useRef<MatterBody | null>(null);
  const floorBodyRef = useRef<MatterBody | null>(null);
  const actorsRef = useRef(new Map<string, PhysicsActor>());
  const boundsRef = useRef({ height: 810, width: 388 });
  const firedRef = useRef(new Set<string>());
  const rafRef = useRef<number | null>(null);
  const videoFrameRef = useRef<number | null>(null);
  const timersRef = useRef(new Set<number>());
  const iceActorIdRef = useRef<string | null>(null);
  const promptIdsRef = useRef<string[]>([]);
  const crackEnergyRef = useRef(0);
  const lastScrollDirectionRef = useRef(0);
  const nextRef = useRef(next);
  const reducedMotionRef = useRef(false);
  const completedRef = useRef(false);
  const scrollLockRef = useRef({
    active: false,
    onScroll: null as (() => void) | null,
    overflow: "",
    overscrollBehavior: "",
    scrollBehavior: "",
    scrollY: 0,
  });

  const [phase, setPhase] = useState<LabPhase>("intro");
  const [mediaTime, setMediaTime] = useState(0);
  const [crackStage, setCrackStage] = useState(0);
  const [playError, setPlayError] = useState(false);
  const [announcement, setAnnouncement] = useState(
    "Calibration Lab. Tap the camera to start.",
  );

  nextRef.current = next;

  const removeActor = useCallback((id: string) => {
    const actor = actorsRef.current.get(id);
    const engine = engineRef.current;
    if (!actor || !engine) return;
    Composite.remove(engine.world, actor.body);
    actor.element.remove();
    actorsRef.current.delete(id);
  }, []);

  const addActor = useCallback(
    (
      id: string,
      kind: ActorKind,
      body: MatterBody,
      element: HTMLElement,
      width: number,
      height: number,
    ) => {
      const engine = engineRef.current;
      const layer = physicsLayerRef.current;
      if (!engine || !layer) return;

      element.dataset.physicsId = id;
      element.style.height = `${height}px`;
      element.style.width = `${width}px`;
      layer.appendChild(element);
      Composite.add(engine.world, body);
      actorsRef.current.set(id, { body, element, height, kind, width });
    },
    [],
  );

  const addTimer = useCallback((callback: () => void, delay: number) => {
    const timer = window.setTimeout(() => {
      timersRef.current.delete(timer);
      callback();
    }, delay);
    timersRef.current.add(timer);
    return timer;
  }, []);

  const spawnDroplets = useCallback(() => {
    if (reducedMotionRef.current) return;
    const { width } = boundsRef.current;
    const centerX = width / 2;

    Array.from({ length: 18 }, (_, index) => {
      const size = 8 + (index % 4) * 3;
      const body = Bodies.circle(
        centerX - 89 + (index % 3) * 7,
        205 + Math.floor(index / 3) * 4,
        size / 2,
        {
          friction: 0.02,
          frictionAir: 0.004,
          label: "calibration-liquid",
          restitution: 0.28,
        },
      );
      Body.setVelocity(body, {
        x: 1.9 + (index % 5) * 0.22,
        y: 1.1 + (index % 4) * 0.2,
      });

      const element = document.createElement("i");
      element.className = styles.liquidDrop;
      addActor(`drop-${index}`, "drop", body, element, size, size);
    });
  }, [addActor]);

  const dropFlask = useCallback(() => {
    if (reducedMotionRef.current) return;
    const { width } = boundsRef.current;
    const flaskWidth = 92;
    const flaskHeight = 112;
    const body = Bodies.trapezoid(
      width / 2 - 97,
      155,
      flaskWidth * 0.72,
      flaskHeight * 0.76,
      0.2,
      {
        friction: 0.04,
        frictionAir: 0.006,
        label: "calibration-flask",
        restitution: 0.48,
      },
    );
    Body.setAngle(body, 1.52);
    Body.setVelocity(body, { x: 2.7, y: 1.2 });
    Body.setAngularVelocity(body, 0.09);

    const element = document.createElement("span");
    element.className = styles.physicsFlask;
    const image = document.createElement("img");
    image.alt = "";
    image.draggable = false;
    image.src = "/havoc-calibration-flask-empty.png";
    element.appendChild(image);
    addActor("falling-flask", "flask", body, element, flaskWidth, flaskHeight);
  }, [addActor]);

  const spawnWord = useCallback(
    (id: string, phrase: string, y: number, background: string, kind: ActorKind) => {
      if (reducedMotionRef.current) return;
      const { width } = boundsRef.current;
      const characters = [...phrase];
      const letterWidth = kind === "prompt" ? 18 : 20;
      const gap = 2;
      const totalWidth = characters.length * (letterWidth + gap);
      const startX = width / 2 - totalWidth / 2 + letterWidth / 2;

      characters.forEach((character, index) => {
        if (character === " ") return;
        const actorId = `${id}-${index}`;
        const letterHeight = kind === "prompt" ? 27 : 31;
        const body = Bodies.rectangle(
          startX + index * (letterWidth + gap),
          y - (index % 3) * 3,
          letterWidth,
          letterHeight,
          {
            friction: 0.08,
            frictionAir: 0.006,
            label: kind === "prompt" ? "calibration-prompt" : "calibration-success",
            restitution: kind === "prompt" ? 0.48 : 0.62,
          },
        );
        Body.setAngularVelocity(body, ((index % 5) - 2) * 0.018);

        const element = document.createElement("span");
        element.className =
          kind === "prompt" ? styles.promptLetter : styles.successLetter;
        element.textContent = character;
        element.style.setProperty("--letter-color", background);
        addActor(actorId, kind, body, element, letterWidth, letterHeight);
        if (kind === "prompt") promptIdsRef.current.push(actorId);
      });
    },
    [addActor],
  );

  const spawnSuccess = useCallback(
    (id: string, copy: string, background: string) => {
      spawnWord(id, copy, 132, background, "letter");
    },
    [spawnWord],
  );

  const prepareIce = useCallback(() => {
    const engine = engineRef.current;
    const { height, width } = boundsRef.current;
    if (!engine) return;

    if (orbBodyRef.current) {
      Composite.remove(engine.world, orbBodyRef.current);
      orbBodyRef.current = null;
    }

    const floor = Bodies.rectangle(width / 2, height - 18, width + 80, 36, {
      isStatic: true,
      label: "calibration-floor",
      restitution: 0.2,
    });
    floorBodyRef.current = floor;
    Composite.add(engine.world, floor);

    if (!reducedMotionRef.current) {
      const iceWidth = 218;
      const iceHeight = 218;
      const body = Bodies.rectangle(width / 2, 342, iceWidth * 0.88, iceHeight * 0.88, {
        chamfer: { radius: 34 },
        friction: 0.08,
        frictionAir: 0.012,
        label: "calibration-ice",
        restitution: 0.34,
      });
      Body.setVelocity(body, { x: 0.25, y: 1.4 });
      Body.setAngularVelocity(body, 0.015);

      const element = document.createElement("div");
      element.className = styles.iceActor;
      element.dataset.crack = "0";

      const portrait = document.createElement("img");
      portrait.alt = "";
      portrait.draggable = false;
      portrait.src = "/havoc-calibration-freeze.jpg";
      element.appendChild(portrait);

      const glaze = document.createElement("span");
      glaze.className = styles.iceGlaze;
      element.appendChild(glaze);

      const cracks = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      cracks.setAttribute("class", styles.iceCracks);
      cracks.setAttribute("viewBox", "0 0 218 218");
      cracks.setAttribute("aria-hidden", "true");
      [
        "M109 7l-8 39 18 22-21 24",
        "M15 105l44-8 26 17-14 31",
        "M203 78l-44 13-18 29 23 18",
        "M106 210l8-42-19-21 18-28",
        "M31 171l39-17 28 9 18-17 37 22",
      ].forEach((path, index) => {
        const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
        line.setAttribute("d", path);
        line.dataset.crackLevel = String(index + 1);
        cracks.appendChild(line);
      });
      element.appendChild(cracks);

      const iceId = "frozen-player";
      iceActorIdRef.current = iceId;
      addActor(iceId, "ice", body, element, iceWidth, iceHeight);
    }

    addTimer(() => {
      spawnWord("shake-it-up", "SHAKE IT UP", 160, "#2ee7d1", "prompt");
      spawnWord("break-the-ice", "BREAK THE ICE", 205, "#c7ff32", "prompt");
    }, 280);
  }, [addActor, addTimer, spawnWord]);

  const clearPhysics = useCallback(() => {
    actorsRef.current.forEach(({ element }) => element.remove());
    actorsRef.current.clear();
    const engine = engineRef.current;
    if (engine) Composite.clear(engine.world, false, true);
    orbBodyRef.current = null;
    floorBodyRef.current = null;
    iceActorIdRef.current = null;
    promptIdsRef.current = [];
  }, []);

  const explodeIce = useCallback(() => {
    if (completedRef.current || phase === "burst" || phase === "black") return;
    completedRef.current = true;
    setPhase("burst");
    setAnnouncement("Calibration complete. The ice is breaking.");

    const iceId = iceActorIdRef.current;
    const iceActor = iceId ? actorsRef.current.get(iceId) : null;
    const center = iceActor
      ? { x: iceActor.body.position.x, y: iceActor.body.position.y }
      : { x: boundsRef.current.width / 2, y: boundsRef.current.height - 150 };

    if (iceId) removeActor(iceId);
    promptIdsRef.current.forEach(removeActor);
    promptIdsRef.current = [];

    if (!reducedMotionRef.current) {
      Array.from({ length: 16 }, (_, index) => {
        const angle = (Math.PI * 2 * index) / 16 + (index % 3) * 0.08;
        const size = 18 + (index % 5) * 6;
        const body = Bodies.rectangle(center.x, center.y, size, size * 0.78, {
          frictionAir: 0.004,
          label: "calibration-shard",
          restitution: 0.18,
        });
        Body.setVelocity(body, {
          x: Math.cos(angle) * (6 + (index % 4) * 1.2),
          y: Math.sin(angle) * (6 + (index % 3) * 1.4) - 2,
        });
        Body.setAngularVelocity(body, ((index % 2) * 2 - 1) * (0.12 + index * 0.006));

        const element = document.createElement("i");
        element.className = styles.iceShard;
        element.style.setProperty("--shard-turn", `${(index * 47) % 180}deg`);
        addActor(`ice-shard-${index}`, "shard", body, element, size, size * 0.78);
      });
    }

    addTimer(() => setPhase("black"), reducedMotionRef.current ? 100 : 520);
    addTimer(() => clearPhysics(), reducedMotionRef.current ? 180 : 700);
    addTimer(() => nextRef.current(), reducedMotionRef.current ? 260 : 850);
  }, [addActor, addTimer, clearPhysics, phase, removeActor]);

  const updateCrackStage = useCallback(
    (energy: number) => {
      const nextStage =
        energy >= 100 ? 5 : energy >= 80 ? 4 : energy >= 60 ? 3 : energy >= 40 ? 2 : energy >= 20 ? 1 : 0;
      setCrackStage(nextStage);
      const iceId = iceActorIdRef.current;
      const iceElement = iceId ? actorsRef.current.get(iceId)?.element : null;
      if (iceElement) {
        iceElement.dataset.crack = String(nextStage);
        iceElement
          .querySelectorAll<SVGPathElement>("[data-crack-level]")
          .forEach((path) => {
            path.style.opacity =
              Number(path.dataset.crackLevel) <= nextStage ? "1" : "0";
          });
      }
      if (energy >= 100) explodeIce();
    },
    [explodeIce],
  );

  const shakeScene = useCallback(
    (direction: number) => {
      if (phase !== "shake") return;

      const nextEnergy = Math.min(100, crackEnergyRef.current + 17);
      crackEnergyRef.current = nextEnergy;
      updateCrackStage(nextEnergy);
      setAnnouncement(
        nextEnergy >= 100
          ? "Ice broken."
          : `Ice crack level ${Math.ceil(nextEnergy / 20)} of 5.`,
      );

      if (reducedMotionRef.current) return;
      const iceId = iceActorIdRef.current;
      const iceBody = iceId ? actorsRef.current.get(iceId)?.body : null;
      if (iceBody) {
        Body.applyForce(iceBody, iceBody.position, {
          x: direction * 0.055,
          y: -0.038,
        });
        Body.setAngularVelocity(iceBody, direction * 0.16);
      }

      promptIdsRef.current.forEach((id, index) => {
        const promptBody = actorsRef.current.get(id)?.body;
        if (!promptBody) return;
        Body.applyForce(promptBody, promptBody.position, {
          x: direction * (0.012 + (index % 4) * 0.002),
          y: -0.01 - (index % 3) * 0.003,
        });
      });
    },
    [phase, updateCrackStage],
  );

  const processVideoTime = useCallback(
    (time: number) => {
      setMediaTime(time);
      const fireOnce = (id: string, cue: number, callback: () => void) => {
        if (time < cue || firedRef.current.has(id)) return;
        firedRef.current.add(id);
        callback();
      };

      fireOnce("face-found", VIDEO_CUES.faceFound, () => {
        setAnnouncement("Face found. Say the first thing on your mind.");
        spawnDroplets();
      });
      fireOnce("drop-flask", 1.83, dropFlask);
      fireOnce("voice-success", VIDEO_CUES.voiceSuccess, () => {
        setAnnouncement("Loud and clear.");
        spawnSuccess("voice-success", "LOUD AND CLEAR", "#c7ff32");
      });
      fireOnce("mouth-success", VIDEO_CUES.mouthSuccess, () => {
        setAnnouncement("Wide open. Freezing the frame.");
        spawnSuccess("mouth-success", "WIDE OPEN", "#ffd338");
      });
      fireOnce("freeze", VIDEO_CUES.freeze, () => {
        prepareIce();
        setPhase("shake");
        setAnnouncement("Shake it up. Scroll up and down to break the ice.");
      });
    },
    [dropFlask, prepareIce, spawnDroplets, spawnSuccess],
  );

  useEffect(() => {
    reducedMotionRef.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const stage = stageRef.current;
    const layer = physicsLayerRef.current;
    if (!stage || !layer) return;

    const engine = Engine.create({
      gravity: { scale: 0.00115, x: 0, y: 1 },
    });
    engineRef.current = engine;

    const rebuildBounds = () => {
      const rectangle = stage.getBoundingClientRect();
      const width = rectangle.width || 388;
      const height = rectangle.height || 810;
      boundsRef.current = { height, width };

      Composite.allBodies(engine.world)
        .filter((body) => body.label.startsWith("calibration-wall"))
        .forEach((body) => Composite.remove(engine.world, body));

      const walls = [
        Bodies.rectangle(-18, height / 2, 36, height * 2, {
          isStatic: true,
          label: "calibration-wall-left",
        }),
        Bodies.rectangle(width + 18, height / 2, 36, height * 2, {
          isStatic: true,
          label: "calibration-wall-right",
        }),
      ];
      Composite.add(engine.world, walls);

      if (orbBodyRef.current) Composite.remove(engine.world, orbBodyRef.current);
      if (!floorBodyRef.current) {
        const radius = Math.min(width * 0.315, 122);
        orbBodyRef.current = Bodies.circle(width / 2, 334, radius, {
          isStatic: true,
          label: "calibration-orb",
          restitution: 0.48,
        });
        Composite.add(engine.world, orbBodyRef.current);
      }
    };

    rebuildBounds();
    const resizeObserver = new ResizeObserver(rebuildBounds);
    resizeObserver.observe(stage);

    if (!reducedMotionRef.current) {
      let lastTime = performance.now();
      let accumulator = 0;
      const fixedStep = 1000 / 60;

      const tick = (now: number) => {
        const delta = Math.min(now - lastTime, 50);
        lastTime = now;
        accumulator += delta;
        let steps = 0;
        while (accumulator >= fixedStep && steps < 3) {
          Engine.update(engine, fixedStep);
          accumulator -= fixedStep;
          steps += 1;
        }

        const expired: string[] = [];
        actorsRef.current.forEach((actor, id) => {
          actor.element.style.transform = `translate3d(${
            actor.body.position.x - actor.width / 2
          }px,${actor.body.position.y - actor.height / 2}px,0) rotate(${
            actor.body.angle
          }rad)`;
          if (
            actor.kind !== "ice" &&
            actor.kind !== "prompt" &&
            actor.body.position.y > boundsRef.current.height + 220
          ) {
            expired.push(id);
          }
        });
        expired.forEach(removeActor);
        rafRef.current = window.requestAnimationFrame(tick);
      };

      rafRef.current = window.requestAnimationFrame(tick);
    }

    return () => {
      resizeObserver.disconnect();
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
      timersRef.current.clear();
      actorsRef.current.forEach(({ element }) => element.remove());
      actorsRef.current.clear();
      Composite.clear(engine.world, false, true);
      Engine.clear(engine);
      engineRef.current = null;
    };
  }, [removeActor]);

  useEffect(() => {
    if (phase === "intro" || phase === "burst" || phase === "black") return;
    const video = videoRef.current;
    if (!video) return;
    const frameVideo = video as unknown as OptionalFrameVideo;

    let cancelled = false;
    const update = (_now?: number, metadata?: { mediaTime: number }) => {
      if (cancelled) return;
      processVideoTime(metadata?.mediaTime ?? video.currentTime);
      if (!video.ended && frameVideo.requestVideoFrameCallback) {
        videoFrameRef.current = frameVideo.requestVideoFrameCallback.call(video, update);
      } else if (!video.ended) {
        videoFrameRef.current = window.requestAnimationFrame(update);
      }
    };

    if (frameVideo.requestVideoFrameCallback) {
      videoFrameRef.current = frameVideo.requestVideoFrameCallback.call(video, update);
    } else {
      videoFrameRef.current = window.requestAnimationFrame(update);
    }

    return () => {
      cancelled = true;
      if (videoFrameRef.current === null) return;
      if (frameVideo.cancelVideoFrameCallback && frameVideo.requestVideoFrameCallback) {
        frameVideo.cancelVideoFrameCallback.call(video, videoFrameRef.current);
      } else {
        window.cancelAnimationFrame(videoFrameRef.current);
      }
      videoFrameRef.current = null;
    };
  }, [phase, processVideoTime]);

  useEffect(() => {
    const shouldLock =
      phase === "shake" || phase === "burst" || phase === "black";
    const lock = scrollLockRef.current;

    if (shouldLock && !lock.active) {
      lock.active = true;
      lock.overflow = document.documentElement.style.overflow;
      lock.overscrollBehavior =
        document.documentElement.style.overscrollBehavior;
      lock.scrollBehavior = document.documentElement.style.scrollBehavior;
      lock.scrollY = window.scrollY;
      lock.onScroll = () => {
        if (Math.abs(window.scrollY - lock.scrollY) < 0.5) return;
        window.scrollTo(0, lock.scrollY);
      };
      document.documentElement.style.overflow = "hidden";
      document.documentElement.style.overscrollBehavior = "none";
      document.documentElement.style.scrollBehavior = "auto";
      window.addEventListener("scroll", lock.onScroll, { passive: true });
    } else if (!shouldLock && lock.active) {
      if (lock.onScroll) window.removeEventListener("scroll", lock.onScroll);
      window.scrollTo(0, lock.scrollY);
      document.documentElement.style.overflow = lock.overflow;
      document.documentElement.style.overscrollBehavior =
        lock.overscrollBehavior;
      document.documentElement.style.scrollBehavior = lock.scrollBehavior;
      lock.onScroll = null;
      lock.active = false;
    }
  }, [phase]);

  useEffect(
    () => () => {
      const lock = scrollLockRef.current;
      if (!lock.active) return;
      if (lock.onScroll) window.removeEventListener("scroll", lock.onScroll);
      window.scrollTo(0, lock.scrollY);
      document.documentElement.style.overflow = lock.overflow;
      document.documentElement.style.overscrollBehavior =
        lock.overscrollBehavior;
      document.documentElement.style.scrollBehavior = lock.scrollBehavior;
      lock.onScroll = null;
      lock.active = false;
    },
    [],
  );

  useEffect(() => {
    if (phase !== "shake") return;
    const stage = stageRef.current;
    if (!stage) return;

    let wheelDistance = 0;
    const onWheel = (event: WheelEvent) => {
      if (!stage.contains(event.target as Node)) return;
      event.preventDefault();
      event.stopPropagation();

      const multiplier =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? 16
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? boundsRef.current.height
            : 1;
      wheelDistance += event.deltaY * multiplier;
      if (Math.abs(wheelDistance) < 18) return;

      const direction = Math.sign(wheelDistance);
      wheelDistance = 0;
      if (direction === lastScrollDirectionRef.current) return;
      lastScrollDirectionRef.current = direction;
      shakeScene(direction);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const isUp = event.key === "ArrowUp" || event.key.toLowerCase() === "w";
      const isDown =
        event.key === "ArrowDown" || event.key.toLowerCase() === "s";
      if (!isUp && !isDown) return;
      event.preventDefault();
      const direction = isDown ? 1 : -1;
      if (direction === lastScrollDirectionRef.current) return;
      lastScrollDirectionRef.current = direction;
      shakeScene(direction);
    };

    stage.addEventListener("wheel", onWheel, { capture: true, passive: false });
    window.addEventListener("keydown", onKeyDown);
    return () => {
      stage.removeEventListener("wheel", onWheel, { capture: true });
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [phase, shakeScene]);

  const startLab = () => {
    if (phase !== "intro") return;
    const video = videoRef.current;
    if (!video) return;

    firedRef.current.clear();
    crackEnergyRef.current = 0;
    lastScrollDirectionRef.current = 0;
    setCrackStage(0);
    setMediaTime(0);
    setPlayError(false);
    setPhase("running");
    setAnnouncement("Camera on. Hold still while we find you.");
    video.currentTime = 0;
    video.play().catch(() => {
      setPlayError(true);
      setAnnouncement("Tap again to play the calibration video with sound.");
    });
  };

  const retryPlayback = () => {
    setPlayError(false);
    videoRef.current?.play().catch(() => setPlayError(true));
  };

  const found = mediaTime >= VIDEO_CUES.faceFound;
  const frozen = mediaTime >= VIDEO_CUES.freeze;
  const voiceActive =
    found && mediaTime < VIDEO_CUES.voiceSuccess + 0.25 && phase === "running";
  const transcriptProgress = clamp(
    (mediaTime - VIDEO_CUES.speechStart) /
      (VIDEO_CUES.speechEnd - VIDEO_CUES.speechStart),
    0,
    1,
  );
  const typedPhrase = SPOKEN_PHRASE.slice(
    0,
    Math.round(SPOKEN_PHRASE.length * transcriptProgress),
  );
  const flaskMode =
    phase === "intro"
      ? "idle"
      : mediaTime < VIDEO_CUES.faceFound
        ? "searching"
        : mediaTime < 1.83
          ? "pouring"
          : "gone";
  const gunActive =
    phase === "running" &&
    mediaTime >= VIDEO_CUES.iceBeam &&
    mediaTime < VIDEO_CUES.freeze + 0.06;
  const instruction =
    phase === "intro"
      ? "One tiny experiment before the chaos."
      : mediaTime < VIDEO_CUES.faceFound
        ? "Hold still — finding you"
        : mediaTime < VIDEO_CUES.openPrompt
          ? "Say the first thing on your mind"
          : mediaTime < VIDEO_CUES.mouthOpen
            ? "Open wide"
            : mediaTime < VIDEO_CUES.freeze
              ? "Perfect. Hold that pose."
              : "Scroll up + down to break the ice";

  return (
    <div
      className={`${styles.lab} screen`}
      data-phase={phase}
      ref={stageRef}
    >
      <div className={styles.backdrop} aria-hidden="true">
        <i />
        <i />
        <i />
      </div>

      <header className={styles.header}>
        <div className={styles.flaskBadge} data-mode={flaskMode} aria-hidden="true">
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
          <span className={styles.liquidStream} />
        </div>
        <div>
          <span className={styles.eyebrow}>30-second setup</span>
          <h2>Calibration Lab</h2>
        </div>
      </header>

      <div
        className={styles.cameraAura}
        data-aura={
          phase === "intro"
            ? "idle"
            : found
              ? voiceActive
                ? "voice"
                : "ready"
              : "searching"
        }
        data-frozen={frozen ? "true" : "false"}
      >
        <div className={styles.cameraViewport}>
          <video
            aria-label="Calibration demo camera"
            className={styles.cameraVideo}
            playsInline
            preload="auto"
            ref={videoRef}
            src="/havoc-calibration-demo.mp4"
          />
          {phase === "intro" && (
            <button
              type="button"
              className={styles.startButton}
              onClick={startLab}
            >
              <span aria-hidden="true">✦</span>
              <b>Tap to start</b>
              <small>camera + sound</small>
            </button>
          )}
          {phase !== "intro" && !found && (
            <span className={styles.scanLine} aria-hidden="true" />
          )}
        </div>
        <span className={styles.auraStatus}>
          {phase === "intro" ? "Ready when you are" : found ? "Face found" : "Finding you"}
        </span>
      </div>

      {gunActive && (
        <div className={styles.freezeRig} aria-hidden="true">
          <span className={styles.iceBeam} />
          <img
            className={styles.waterGun}
            src="/havoc-calibration-water-gun.png"
            alt=""
            draggable={false}
          />
        </div>
      )}

      <section className={styles.instructionCard} data-tone={voiceActive ? "voice" : "normal"}>
        <span className={styles.stepIcon} aria-hidden="true">
          {phase === "intro"
            ? "🧪"
            : mediaTime < VIDEO_CUES.faceFound
              ? "◎"
              : mediaTime < VIDEO_CUES.openPrompt
                ? "🎙️"
                : mediaTime < VIDEO_CUES.freeze
                  ? "😮"
                  : "↕"}
        </span>
        <div>
          <small>
            {phase === "intro"
              ? "Practice run"
              : mediaTime < VIDEO_CUES.faceFound
                ? "Camera"
                : mediaTime < VIDEO_CUES.openPrompt
                  ? "Voice"
                  : mediaTime < VIDEO_CUES.freeze
                    ? "Expression"
                    : "Final test"}
          </small>
          <b>{instruction}</b>
        </div>
      </section>

      {typedPhrase && mediaTime < VIDEO_CUES.openPrompt + 0.08 && (
        <p className={styles.typedPhrase} aria-label={SPOKEN_PHRASE}>
          “{typedPhrase}
          {transcriptProgress < 1 && <i aria-hidden="true" />}”
        </p>
      )}

      {phase === "shake" && (
        <button
          type="button"
          className={styles.shakeCoach}
          onClick={() => {
            const direction =
              lastScrollDirectionRef.current === 1 ? -1 : 1;
            lastScrollDirectionRef.current = direction;
            shakeScene(direction);
          }}
        >
          <span aria-hidden="true">↕</span>
          <b>Scroll up + down</b>
          <small>{crackStage}/5 cracks · click also works</small>
        </button>
      )}

      {playError && (
        <button type="button" className={styles.retryButton} onClick={retryPlayback}>
          Tap to play with sound
        </button>
      )}

      {reducedMotionRef.current && frozen && phase === "shake" && (
        <div className={styles.reducedIce} data-crack={crackStage} aria-hidden="true">
          <img src="/havoc-calibration-freeze.jpg" alt="" />
        </div>
      )}

      <div className={styles.physicsLayer} ref={physicsLayerRef} aria-hidden="true" />

      <div className={styles.demoLabel}>
        <i aria-hidden="true" />
        Concept demo · prerecorded camera
      </div>

      <span className={styles.liveRegion} aria-live="polite">
        {announcement}
      </span>

      <span className={styles.blackBurst} aria-hidden="true" />
      <span className={styles.blackCover} aria-hidden="true" />
    </div>
  );
}
