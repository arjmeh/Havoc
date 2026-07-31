"use client";

import { Easing, interpolate } from "remotion";
import { useLayoutEffect, useMemo, useRef } from "react";

// The Remotion stage can letterbox inside a short desktop preview. Keeping the
// renderer wider than the 640px stage lets confetti fill that visible gutter
// without stretching or duplicating thousands of DOM nodes.
const WIDTH = 1920;
const LEFT = -640;
const HEIGHT = 1355;
const COLORS = [
  "#c9ff2f",
  "#ef4b47",
  "#7c3aed",
  "#20d9df",
  "#ffb51f",
  "#ff7b70",
  "#f5c84b",
] as const;

type FlightPiece = {
  color: string;
  controlX: number;
  controlY: number;
  height: number;
  index: number;
  phase: number;
  settleFrame: number;
  sourceX: number;
  sourceY: number;
  startFrame: number;
  targetX: number;
  targetY: number;
  width: number;
};

function noise(seed: number) {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43_758.5453;
  return value - Math.floor(value);
}

export function getCannonSweepX(frame: number, reducedMotion: boolean) {
  if (reducedMotion) return 0;

  return interpolate(
    frame,
    [100, 134, 158, 175, 187, 196, 203, 209, 214, 219, 224],
    [-750, 750, -750, 750, -750, 750, -750, 750, -750, 750, 0],
    {
      easing: Easing.inOut(Easing.quad),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
}

function getCannonSway(frame: number, reducedMotion: boolean) {
  if (reducedMotion) return 0;

  return interpolate(
    frame,
    [100, 134, 158, 175, 187, 196, 203, 209, 214, 219, 224],
    [-6, 9, -11, 12, -13, 14, -15, 15, -14, 11, 0],
    {
      easing: Easing.inOut(Easing.quad),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
}

function buildCarpet() {
  const carpet = document.createElement("canvas");
  carpet.width = WIDTH;
  carpet.height = HEIGHT;
  const context = carpet.getContext("2d", { alpha: true });
  if (!context) return carpet;

  // The tiled underlayer removes every white pinhole at peak coverage.
  // Thousands of larger rotated pieces hide the grid and keep it organic.
  const tileSize = 8;
  for (let y = 0; y < HEIGHT; y += tileSize) {
    for (let x = 0; x < WIDTH; x += tileSize) {
      const tileIndex = (y / tileSize) * 80 + x / tileSize;
      context.fillStyle =
        COLORS[Math.floor(noise(tileIndex + 13) * COLORS.length)];
      context.fillRect(x, y, tileSize + 1, tileSize + 1);
    }
  }

  for (let index = 0; index < 8_600; index += 1) {
    const x = noise(index * 7 + 101) * WIDTH;
    const y = noise(index * 11 + 211) * HEIGHT;
    const pieceWidth = 5 + noise(index * 13 + 307) * 8;
    const pieceHeight = 8 + noise(index * 17 + 401) * 12;
    const angle = (noise(index * 19 + 503) - 0.5) * 1.35;

    context.setTransform(
      Math.cos(angle),
      Math.sin(angle),
      -Math.sin(angle),
      Math.cos(angle),
      x,
      y,
    );
    context.fillStyle =
      COLORS[Math.floor(noise(index * 23 + 601) * COLORS.length)];
    context.fillRect(
      -pieceWidth / 2,
      -pieceHeight / 2,
      pieceWidth,
      pieceHeight,
    );
  }

  context.setTransform(1, 0, 0, 1, 0, 0);
  return carpet;
}

export function BirthdayConfettiCanvas({
  frame,
  reducedMotion,
}: {
  frame: number;
  reducedMotion: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const carpetRef = useRef<HTMLCanvasElement | null>(null);
  const flightPieces = useMemo<FlightPiece[]>(() => {
    const count = reducedMotion ? 260 : 1_080;

    return Array.from({ length: count }, (_, index) => {
      const startFrame =
        97 + 91 * Math.sqrt(index / Math.max(1, count - 1));
      const cannonX = getCannonSweepX(startFrame, reducedMotion);
      const previousCannonX = getCannonSweepX(startFrame - 1, reducedMotion);
      const nextCannonX = getCannonSweepX(startFrame + 1, reducedMotion);
      const swayRadians =
        (getCannonSway(startFrame, reducedMotion) * Math.PI) / 180;
      const mouthOffset = (noise(index * 31 + 29) - 0.5) * 38;
      const sourceX =
        320 +
        cannonX -
        Math.sin(swayRadians) * 400 +
        Math.cos(swayRadians) * mouthOffset;
      const sourceY =
        -293 +
        Math.cos(swayRadians) * 400 +
        Math.sin(swayRadians) * mouthOffset;
      const inheritedVelocity = Math.max(
        -190,
        Math.min(190, (nextCannonX - previousCannonX) * 2.35),
      );
      const launchRadians =
        swayRadians + (noise(index * 41 + 59) - 0.5) * 1.05;
      const launchDistance = 160 + (index % 13) * 12;

      return {
        color: COLORS[index % COLORS.length],
        controlX:
          sourceX -
          Math.sin(launchRadians) * launchDistance +
          inheritedVelocity,
        controlY: sourceY + Math.cos(launchRadians) * launchDistance,
        height: 8 + Math.floor(noise(index * 29 + 17) * 11),
        index,
        phase: noise(index * 37 + 43) * Math.PI * 2,
        settleFrame: Math.min(222, startFrame + 20 + (index % 12)),
        sourceX,
        sourceY,
        startFrame,
        targetX: LEFT - 32 + noise(index * 43 + 71) * (WIDTH + 64),
        targetY: -28 + noise(index * 47 + 89) * (HEIGHT + 56),
        width: 5 + Math.floor(noise(index * 53 + 97) * 8),
      };
    });
  }, [reducedMotion]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d", {
      alpha: true,
      desynchronized: true,
    });
    if (!context) return;

    if (!carpetRef.current) carpetRef.current = buildCarpet();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, WIDTH, HEIGHT);
    if (frame < 90) return;

    const carpet = carpetRef.current;
    const sliceCount = 40;
    const sliceWidth = Math.ceil(WIDTH / sliceCount) + 2;

    // Reveal the dense layer with an irregular front, then let uneven strips
    // fall away so Permissions is already visible behind the celebration.
    for (let slice = 0; slice < sliceCount; slice += 1) {
      const sourceX = Math.max(0, slice * (WIDTH / sliceCount) - 1);
      const delay = (noise(slice * 61 + 113) - 0.5) * 12;
      const fillProgress =
        frame >= 218
          ? 1
          : Math.max(0, Math.min(1, (frame - 134 - delay) / 72));
      const organicFront =
        Math.sin(slice * 1.47 + frame * 0.16) * 34 +
        (noise(slice * 67 + 127) - 0.5) * 78;
      const coveredHeight = Math.max(
        0,
        Math.min(HEIGHT, fillProgress * (HEIGHT + 100) + organicFront),
      );
      if (coveredHeight <= 0) continue;

      const fallDelay = noise(slice * 71 + 139) * 3.5;
      const fallProgress = Math.max(
        0,
        Math.min(1, (frame - 241 - fallDelay) / 17.5),
      );
      const fallX =
        Math.sin(slice * 0.91 + frame * 0.09) * 15 * fallProgress;
      const fallY = fallProgress * (HEIGHT + 180 + (slice % 5) * 35);

      context.drawImage(
        carpet,
        sourceX,
        0,
        sliceWidth,
        coveredHeight,
        sourceX + fallX,
        fallY,
        sliceWidth,
        coveredHeight,
      );
    }

    for (const piece of flightPieces) {
      if (frame < piece.startFrame) continue;

      const flightProgress = Math.max(
        0,
        Math.min(
          1,
          (frame - piece.startFrame) /
            (piece.settleFrame - piece.startFrame),
        ),
      );
      const easedFlightProgress = 1 - Math.pow(1 - flightProgress, 3);
      const inverseProgress = 1 - easedFlightProgress;
      const flutter =
        Math.sin((frame - piece.startFrame) * 0.55 + piece.phase) *
        (1 - easedFlightProgress) *
        (10 + (piece.index % 5) * 3);
      const x =
        inverseProgress * inverseProgress * piece.sourceX +
        2 * inverseProgress * easedFlightProgress * piece.controlX +
        easedFlightProgress * easedFlightProgress * piece.targetX +
        flutter;
      const y =
        inverseProgress * inverseProgress * piece.sourceY +
        2 * inverseProgress * easedFlightProgress * piece.controlY +
        easedFlightProgress * easedFlightProgress * piece.targetY +
        Math.sin(easedFlightProgress * Math.PI) *
          (76 + (piece.index % 9) * 11);
      const fallProgress = Math.max(0, Math.min(1, (frame - 241) / 21));
      const finalX =
        x +
        (((piece.index * 31) % 180) - 90) * fallProgress +
        Math.sin(frame * 0.25 + piece.phase) * 9;
      const finalY =
        y +
        (HEIGHT + 260 + ((piece.index * 53) % 360)) * fallProgress;
      const angle =
        piece.phase +
        easedFlightProgress * (Math.PI * 2 + piece.index * 0.13) +
        fallProgress * Math.PI * 4;

      context.setTransform(
        Math.cos(angle),
        Math.sin(angle),
        -Math.sin(angle),
        Math.cos(angle),
        finalX - LEFT,
        finalY,
      );
      context.fillStyle = piece.color;
      context.fillRect(
        -piece.width / 2,
        -piece.height / 2,
        piece.width,
        piece.height,
      );
    }

    context.setTransform(1, 0, 0, 1, 0, 0);
  }, [flightPieces, frame, reducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-confetti-renderer="canvas"
      height={HEIGHT}
      width={WIDTH}
      style={{
        position: "absolute",
        zIndex: 30,
        top: 0,
        bottom: 0,
        left: LEFT,
        width: WIDTH,
        height: "100%",
        pointerEvents: "none",
      }}
    />
  );
}
