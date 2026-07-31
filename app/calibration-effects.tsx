"use client";

import {
  Bodies,
  Body,
  Composite,
  Engine,
  type Body as MatterBody,
} from "matter-js";
import {
  Application,
  Assets,
  BlurFilter,
  Container,
  DisplacementFilter,
  defaultFilterVert,
  Filter,
  Graphics,
  Particle,
  ParticleContainer,
  Rectangle,
  Sprite,
  Text,
  Texture,
  UPDATE_PRIORITY,
} from "pixi.js";
import { useEffect, useRef } from "react";

import type { CalibrationAudioLevels } from "./calibration-runtime";

export type CalibrationPhase =
  | "idle"
  | "scan"
  | "scan-exit"
  | "face-hold"
  | "voice-prompt"
  | "voice"
  | "voice-hold"
  | "voice-success"
  | "expression-prompt"
  | "expression"
  | "expression-success"
  | "charge"
  | "freeze"
  | "drop"
  | "break"
  | "ice-rain"
  | "zoom-prompt"
  | "zoom"
  | "pour"
  | "return-phone"
  | "drink-prompt"
  | "drink"
  | "drain"
  | "drink-finish"
  | "shatter"
  | "blackout";

export type ShakeImpulse = {
  direction: number;
  progress: number;
  sequence: number;
};

export type CalibrationDevicePose = {
  pitch: number;
  roll: number;
  velocity: number;
  sequence: number;
};

export type CalibrationEffectsProps = {
  audioLevels: { current: CalibrationAudioLevels };
  devicePose: CalibrationDevicePose;
  freezeFrame: string | null;
  impulse: ShakeImpulse;
  onFallback: () => void;
  onTick: (deltaMs: number) => void;
  onVisibilityChange: (hidden: boolean) => void;
  phase: CalibrationPhase;
  reducedMotion: boolean;
  zoomProgress: number;
};

type LiquidParticle = {
  active: boolean;
  body: MatterBody;
  particle: Particle;
};

type OrbitGlyph = {
  body: MatterBody | null;
  glyph: Text;
  xOffset: number;
};

type ShardActor = {
  body: MatterBody | null;
  graphic: Graphics;
  height: number;
  width: number;
};

type SceneRuntime = {
  app: Application;
  faceSprite: Sprite;
  faceTexture: Texture | null;
  impulseApplied: number;
  phaseElapsed: number;
  phaseSeen: CalibrationPhase;
};

const ICE_SHELL_URL =
  "/calibration-models/ice-face-cube-shell-front.webp";
const GLASS_FRONT_URL =
  "/calibration-models/glass-tumbler-front.webp";
const GLASS_QUARTER_URL =
  "/calibration-models/glass-tumbler-three-quarter.webp";
const FIELD_ICE_URL = "/calibration-models/ice-cube-field.webp";
const LIQUID_POOL_SIZE = 34;
const SHARD_COUNT = 18;
const FIXED_STEP = 1000 / 60;
const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(Math.max(value, minimum), maximum);

const easeOutCubic = (value: number) => 1 - Math.pow(1 - value, 3);

const makeLiquidTexture = () => {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  if (!context) return Texture.WHITE;
  const gradient = context.createRadialGradient(32, 26, 3, 32, 32, 31);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.55, "rgba(255,255,255,.96)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  return Texture.from(canvas);
};

const makeDisplacementTexture = () => {
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 96;
  const context = canvas.getContext("2d");
  if (!context) return Texture.WHITE;
  const image = context.createImageData(96, 96);
  for (let index = 0; index < image.data.length; index += 4) {
    const pixel = index / 4;
    const x = pixel % 96;
    const y = Math.floor(pixel / 96);
    const wave =
      128 +
      Math.sin(x * 0.23 + y * 0.08) * 42 +
      Math.sin(y * 0.31) * 25;
    image.data[index] = wave;
    image.data[index + 1] = 255 - wave;
    image.data[index + 2] = 160;
    image.data[index + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  return Texture.from(canvas);
};

const loadImageTexture = async (source: string) => {
  const image = new Image();
  image.decoding = "async";
  image.src = source;
  await image.decode();
  return Texture.from(image);
};

const drawCrystal = (
  graphic: Graphics,
  x: number,
  y: number,
  size: number,
  rotation: number,
) => {
  const dx = Math.cos(rotation) * size;
  const dy = Math.sin(rotation) * size;
  graphic
    .moveTo(x - dx, y - dy)
    .lineTo(x + dx, y + dy)
    .stroke({ color: 0xffffff, width: 1.5, alpha: 0.74, cap: "round" });
  for (const sign of [-1, 1]) {
    const branchX = x + dx * 0.36 * sign;
    const branchY = y + dy * 0.36 * sign;
    graphic
      .moveTo(branchX, branchY)
      .lineTo(
        branchX + Math.cos(rotation + 1.05 * sign) * size * 0.38,
        branchY + Math.sin(rotation + 1.05 * sign) * size * 0.38,
      )
      .stroke({
        color: 0xdafaff,
        width: 1,
        alpha: 0.68,
        cap: "round",
      });
  }
};

const buildCrack = (
  centerX: number,
  centerY: number,
  direction: number,
  level: number,
) => {
  const graphic = new Graphics();
  const length = 58 + level * 10;
  const startX = centerX + Math.cos(direction) * 42;
  const startY = centerY + Math.sin(direction) * 42;
  graphic.moveTo(startX, startY);
  for (let step = 1; step <= 5; step += 1) {
    const distance = (length * step) / 5;
    const wobble = Math.sin(step * 4.7 + level) * (5 + level);
    const x =
      startX +
      Math.cos(direction) * distance +
      Math.cos(direction + Math.PI / 2) * wobble;
    const y =
      startY +
      Math.sin(direction) * distance +
      Math.sin(direction + Math.PI / 2) * wobble;
    graphic.lineTo(x, y);
  }
  graphic.stroke({
    color: 0xffffff,
    width: 1.7 + level * 0.22,
    alpha: 0.92,
    cap: "round",
    join: "round",
  });
  graphic.visible = false;
  return graphic;
};

export function CalibrationEffects({
  audioLevels,
  devicePose,
  freezeFrame,
  impulse,
  onFallback,
  onTick,
  onVisibilityChange,
  phase,
  reducedMotion,
  zoomProgress,
}: CalibrationEffectsProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const runtimeRef = useRef<SceneRuntime | null>(null);
  const phaseRef = useRef(phase);
  const devicePoseRef = useRef(devicePose);
  const impulseRef = useRef(impulse);
  const tickRef = useRef(onTick);
  const fallbackRef = useRef(onFallback);
  const visibilityRef = useRef(onVisibilityChange);
  const reducedMotionRef = useRef(reducedMotion);
  const zoomProgressRef = useRef(zoomProgress);
  const freezeFrameRef = useRef(freezeFrame);

  phaseRef.current = phase;
  devicePoseRef.current = devicePose;
  impulseRef.current = impulse;
  tickRef.current = onTick;
  fallbackRef.current = onFallback;
  visibilityRef.current = onVisibilityChange;
  reducedMotionRef.current = reducedMotion;
  zoomProgressRef.current = zoomProgress;
  freezeFrameRef.current = freezeFrame;

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime || !freezeFrame) return;
    let cancelled = false;
    void loadImageTexture(freezeFrame)
      .then((texture) => {
        if (cancelled || !runtimeRef.current) {
          texture.destroy(true);
          return;
        }
        runtime.faceTexture?.destroy(true);
        runtime.faceTexture = texture;
        runtime.faceSprite.texture = texture;
      })
      .catch(() => fallbackRef.current());
    return () => {
      cancelled = true;
    };
  }, [freezeFrame]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;
    let visibilityHandler: (() => void) | null = null;

    const start = async () => {
      const width = Math.max(host.clientWidth, 1);
      const height = Math.max(host.clientHeight, 1);
      const app = new Application();

      try {
        await app.init({
          width,
          height,
          backgroundAlpha: 0,
          antialias: true,
          autoDensity: true,
          autoStart: false,
          sharedTicker: false,
          preference: "webgl",
          powerPreference: "high-performance",
          resolution: Math.min(window.devicePixelRatio || 1, 2),
          gcActive: true,
          gcFrequency: 30_000,
          gcMaxUnusedTime: 60_000,
        });
      } catch {
        if (!cancelled) fallbackRef.current();
        return;
      }

      if (cancelled) {
        app.destroy(
          { removeView: true, releaseGlobalResources: true },
          { children: true, texture: false, textureSource: false },
        );
        return;
      }

      app.canvas.className = "calibration-pixi-canvas";
      app.canvas.setAttribute("aria-hidden", "true");
      host.appendChild(app.canvas);

      let shellTexture: Texture;
      let glassFrontTexture: Texture;
      let glassQuarterTexture: Texture;
      let fieldIceTexture: Texture;
      try {
        [
          shellTexture,
          glassFrontTexture,
          glassQuarterTexture,
          fieldIceTexture,
        ] = await Promise.all([
          Assets.load<Texture>(ICE_SHELL_URL),
          Assets.load<Texture>(GLASS_FRONT_URL),
          Assets.load<Texture>(GLASS_QUARTER_URL),
          Assets.load<Texture>(FIELD_ICE_URL),
        ]);
      } catch {
        app.destroy(
          { removeView: true, releaseGlobalResources: true },
          { children: true, texture: false, textureSource: false },
        );
        if (!cancelled) fallbackRef.current();
        return;
      }

      if (cancelled) {
        app.destroy(
          { removeView: true, releaseGlobalResources: true },
          { children: true, texture: false, textureSource: false },
        );
        return;
      }

      const engine = Engine.create({
        gravity: { x: 0, y: 1, scale: 0.00125 },
      });
      const ambientLayer = new Container({ label: "ambient-layer" });
      const liquidLayer = new Container({ label: "liquid-layer" });
      const actorLayer = new Container({
        label: "actor-layer",
        sortableChildren: true,
      });
      const fxLayer = new Container({ label: "fx-layer" });
      app.stage.addChild(ambientLayer, liquidLayer, actorLayer, fxLayer);

      const tableBackdrop = new Graphics({ label: "party-table-backdrop" });
      const tableGlow = new Graphics({ label: "party-table-glow" });
      const partyWorld = new Container({
        label: "party-glass-world",
        sortableChildren: true,
      });
      const userGlass = new Container({ label: "user-glass" });
      const userGlassShell = new Container({ label: "user-glass-shell" });
      const userGlassShadow = new Graphics()
        .ellipse(0, 132, 98, 22)
        .fill({ color: 0x090613, alpha: 0.34 });
      const userLiquidMask = new Graphics()
        .poly([-73, -104, 73, -104, 59, 108, -59, 108])
        .fill(0xffffff);
      const userLiquid = new Graphics({ label: "screen-container-liquid" });
      userLiquid.mask = userLiquidMask;
      const userGlassBody = new Graphics()
        .poly([-86, -118, 86, -118, 68, 128, -68, 128])
        .fill({ color: 0xdff8ff, alpha: 0.075 })
        .stroke({ color: 0xffffff, width: 5, alpha: 0.92, join: "round" })
        .poly([-75, -105, 75, -105, 59, 112, -59, 112])
        .stroke({ color: 0xbcecff, width: 1.5, alpha: 0.42, join: "round" });
      const userGlassRim = new Graphics()
        .ellipse(0, -118, 86, 19)
        .fill({ color: 0xe8fbff, alpha: 0.1 })
        .stroke({ color: 0xffffff, width: 4, alpha: 0.95 })
        .ellipse(0, -114, 70, 11)
        .stroke({ color: 0xb5ecff, width: 1.5, alpha: 0.68 });
      const userGlassShine = new Graphics()
        .moveTo(-67, -91)
        .bezierCurveTo(-63, -28, -59, 37, -52, 82)
        .stroke({ color: 0xffffff, width: 9, alpha: 0.28, cap: "round" })
        .moveTo(53, -85)
        .bezierCurveTo(49, -42, 46, 12, 41, 39)
          .stroke({ color: 0xffffff, width: 3, alpha: 0.17, cap: "round" });
      const userGlassModel = new Sprite({
        texture: glassFrontTexture,
        anchor: 0.5,
      });
      userGlassModel.width = 264;
      userGlassModel.height = 264;
      userGlassModel.alpha = 0.96;
      userGlassShell.addChild(
        userGlassShadow,
        userGlassModel,
        userGlassBody,
        userGlassRim,
        userGlassShine,
      );
      userGlass.addChild(userLiquidMask, userLiquid, userGlassShell);
      userGlass.zIndex = 4;
      partyWorld.addChild(userGlass);

      const companionGlasses = Array.from({ length: 63 }, (_, index) => {
        const palette = [
          0xffcf3b,
          0x2ee5cf,
          0x7956ff,
          0xff5c7d,
          0x38a7ff,
          0xff8e36,
          0x8bdd52,
          0xef54df,
        ];
        const glass = new Container({ label: `companion-glass-${index}` });
        const color = palette[index % palette.length];
        const shadow = new Graphics()
          .ellipse(0, 68, 54, 12)
          .fill({ color: 0x090613, alpha: 0.28 });
        const fill = new Graphics()
          .poly([-41, -39, 41, -39, 33, 57, -33, 57])
          .fill({ color, alpha: 0.86 })
          .ellipse(0, -38, 40, 8)
          .fill({ color: 0xffffff, alpha: 0.18 });
        const shell = new Sprite({
          texture: glassQuarterTexture,
          anchor: 0.5,
        });
        shell.width = 148;
        shell.height = 148;
        shell.alpha = 0.94;
        const emoji = new Text({
          text: ["😈", "🤪", "🥶", "👽", "🤠", "🥳", "😎", "🤖"][
            index % 8
          ],
          style: { fontSize: 27 },
        });
        emoji.anchor.set(0.5);
        emoji.position.y = 6;
        emoji.alpha = index % 4 === 0 ? 0.84 : 0.22;
        glass.addChild(shadow, fill, shell, emoji);
        partyWorld.addChild(glass);
        return glass;
      });

      const iceRainGroup = new Container({ label: "ice-rain" });
      iceRainGroup.zIndex = 5;
      const iceRainCubes = Array.from({ length: 10 }, (_, index) => {
        const cube = new Sprite({
          texture: fieldIceTexture,
          anchor: 0.5,
        });
        const size = 44 + (index % 3) * 4;
        cube.width = size;
        cube.height = size;
        cube.alpha = 0.92;
        cube.visible = false;
        cube.zIndex = 6;
        iceRainGroup.addChild(cube);
        return cube;
      });
      partyWorld.addChild(iceRainGroup);
      partyWorld.visible = false;
      tableBackdrop.visible = false;
      tableGlow.visible = false;
      ambientLayer.addChildAt(tableBackdrop, 0);
      ambientLayer.addChildAt(tableGlow, 1);
      actorLayer.addChild(partyWorld);

      const chamberMask = new Graphics();
      const causticGroup = new Container();
      causticGroup.mask = chamberMask;
      const caustics = Array.from({ length: 7 }, (_, index) => {
        const graphic = new Graphics()
          .ellipse(0, 0, 82 + index * 13, 24 + (index % 3) * 8)
          .fill({
            color: index % 2 ? 0x62e9ff : 0x8d63ff,
            alpha: 0.18 + (index % 3) * 0.05,
          });
        graphic.blendMode = "screen";
        causticGroup.addChild(graphic);
        return graphic;
      });
      const auraRed = new Graphics();
      const auraGreen = new Graphics();
      const auraBlue = new Graphics();
      const waveLayer = new Container({ label: "reactive-audio-border" });
      const agentWaveGlow = new Graphics({ label: "agent-wave-glow" });
      const agentWave = new Graphics({ label: "agent-wave" });
      const userWaveGlow = new Graphics({ label: "user-wave-glow" });
      const userWave = new Graphics({ label: "user-wave" });
      waveLayer.addChild(
        agentWaveGlow,
        userWaveGlow,
        agentWave,
        userWave,
      );
      const chamberGlass = new Graphics();
      ambientLayer.addChild(
        chamberGlass,
        chamberMask,
        causticGroup,
        auraRed,
        auraGreen,
        auraBlue,
        waveLayer,
      );

      const liquidTexture = makeLiquidTexture();
      const particles = Array.from(
        { length: LIQUID_POOL_SIZE },
        () =>
          new Particle({
            texture: liquidTexture,
            anchorX: 0.5,
            anchorY: 0.5,
            alpha: 0,
            scaleX: 0.44,
            scaleY: 0.62,
            tint: 0x6d4cff,
          }),
      );
      const particleContainer = new ParticleContainer({
        texture: liquidTexture,
        particles,
        dynamicProperties: {
          color: true,
          position: true,
          rotation: false,
          vertex: true,
        },
        boundsArea: new Rectangle(0, 0, width, height),
      });
      const metaballContainer = new Container();
      metaballContainer.addChild(particleContainer);
      const liquidBlur = new BlurFilter({
        strength: 8,
        quality: 3,
        resolution: 0.5,
        padding: 22,
      });
      const liquidThreshold = Filter.from({
        gl: {
          vertex: defaultFilterVert,
          fragment: `
            in vec2 vTextureCoord;
            out vec4 finalColor;
            uniform sampler2D uTexture;
            void main(void) {
              vec4 sampleColor = texture(uTexture, vTextureCoord);
              float alpha = smoothstep(0.035, 0.16, sampleColor.a);
              vec3 topColor = vec3(0.39, 0.21, 1.0);
              vec3 bottomColor = vec3(0.06, 0.83, 0.95);
              vec3 color = mix(topColor, bottomColor, clamp(vTextureCoord.y, 0.0, 1.0));
              finalColor = vec4(color * alpha, alpha);
            }
          `,
        },
      });
      metaballContainer.filters = [liquidBlur, liquidThreshold];
      const liquidRibbon = new Graphics({ label: "liquid-ribbon" });
      const liquidSplash = new Graphics({ label: "liquid-splash" });
      liquidLayer.addChild(metaballContainer, liquidRibbon, liquidSplash);

      const liquidParticles: LiquidParticle[] = particles.map((particle) => ({
        active: false,
        body: Bodies.circle(-100, -100, 10, {
          collisionFilter: { group: -7 },
          friction: 0.01,
          frictionAir: 0.005,
          label: "calibration-liquid",
          restitution: 0.05,
        }),
        particle,
      }));
      let nextLiquidIndex = 0;
      let liquidEmissionElapsed = 0;

      const orbitLayer = new Container({
        label: "impact-copy",
        sortableChildren: true,
      });
      actorLayer.addChild(orbitLayer);
      const orbitGlyphs: OrbitGlyph[] = [];
      [..."HAVOC"].forEach((character, index) => {
        const glyph = new Text({
          text: character,
          style: {
            fill: 0x0b0911,
            fontFamily: "Geist, Helvetica Neue, Arial, sans-serif",
            fontSize: 18,
            fontWeight: "900",
            letterSpacing: -0.6,
          },
        });
        glyph.anchor.set(0.5);
        glyph.visible = false;
        orbitLayer.addChild(glyph);
        orbitGlyphs.push({
          body: null,
          glyph,
          xOffset: (index - 2) * 21,
        });
      });

      const beamGroup = new Container({ label: "ice-beam" });
      const beamHalo = new Graphics();
      const beamCore = new Graphics();
      const beamHot = new Graphics();
      const impactFlash = new Graphics();
      beamHalo.filters = [
        new BlurFilter({
          strength: 14,
          quality: 3,
          resolution: 0.5,
          padding: 30,
        }),
      ];
      beamGroup.addChild(beamHalo, beamCore, beamHot, impactFlash);
      beamGroup.visible = false;
      fxLayer.addChild(beamGroup);

      const frostTexture = makeLiquidTexture();
      const frostParticles = Array.from({ length: 20 }, (_, index) => {
        const sprite = new Sprite({
          texture: frostTexture,
          anchor: 0.5,
          tint: index % 3 === 0 ? 0x8beeff : 0xffffff,
        });
        sprite.alpha = 0;
        sprite.scale.set(0.07 + (index % 4) * 0.025);
        fxLayer.addChild(sprite);
        return sprite;
      });

      const iceGroup = new Container({
        label: "frozen-portrait",
        sortableChildren: true,
      });
      iceGroup.visible = false;
      actorLayer.addChild(iceGroup);
      const iceGlow = new Graphics();
      const faceMask = new Graphics();
      const faceSprite = new Sprite({
        texture: Texture.WHITE,
        anchor: 0.5,
      });
      faceSprite.mask = faceMask;
      const displacementTexture = makeDisplacementTexture();
      const displacementSprite = new Sprite({
        texture: displacementTexture,
        anchor: 0.5,
      });
      displacementSprite.alpha = 0.001;
      displacementSprite.scale.set(2.9);
      const displacement = new DisplacementFilter({
        sprite: displacementSprite,
        scale: { x: 0, y: 0 },
      });
      faceSprite.filters = [displacement];
      const shellSprite = new Sprite({
        texture: shellTexture,
        anchor: 0.5,
      });
      const frostGraphic = new Graphics();
      const bubbleGraphic = new Graphics();
      const specularGraphic = new Graphics();
      iceGroup.addChild(
        iceGlow,
        faceSprite,
        faceMask,
        displacementSprite,
        shellSprite,
        bubbleGraphic,
        frostGraphic,
        specularGraphic,
      );

      const cracks = Array.from({ length: 5 }, (_, index) => {
        const crack = buildCrack(
          0,
          0,
          -2.25 + index * 1.08,
          index,
        );
        iceGroup.addChild(crack);
        return crack;
      });

      const shards: ShardActor[] = Array.from(
        { length: SHARD_COUNT },
        (_, index) => {
          const widthValue = 24 + (index % 5) * 8;
          const heightValue = 28 + ((index * 3) % 5) * 9;
          const graphic = new Graphics()
            .poly([
              -widthValue / 2,
              -heightValue / 2,
              widthValue / 2,
              -heightValue * 0.24,
              widthValue * 0.28,
              heightValue / 2,
              -widthValue * 0.42,
              heightValue * 0.32,
            ])
            .fill({
              color: index % 3 === 0 ? 0xc8fbff : 0x82dfff,
              alpha: 0.58 + (index % 4) * 0.08,
            })
            .stroke({
              color: 0xffffff,
              width: 1.2,
              alpha: 0.82,
            });
          graphic.visible = false;
          fxLayer.addChild(graphic);
          return {
            body: null,
            graphic,
            height: heightValue,
            width: widthValue,
          };
        },
      );
      const blackCore = new Graphics().circle(0, 0, 52).fill(0x000000);
      blackCore.visible = false;
      fxLayer.addChild(blackCore);

      let sceneWidth = width;
      let sceneHeight = height;
      let centerX = width / 2;
      let chamberRadius = clamp(width * 0.39, 143, 158);
      let centerY =
        clamp(height * 0.22, 172, 186) + chamberRadius;
      let orbBody: MatterBody | null = null;
      let iceBody: MatterBody | null = null;
      let boundaries: MatterBody[] = [];
      let orbitDropped = false;
      let shattered = false;
      let pendingSize = { height, width };
      let resizePending = true;
      let accumulator = 0;
      let renderedLiquidLevel = 0;
      let renderedLiquidTilt = 0;

      const clearBoundaries = () => {
        boundaries.forEach((body) => Composite.remove(engine.world, body));
        boundaries = [];
      };

      const rebuildStaticScene = () => {
        sceneWidth = Math.max(pendingSize.width, 1);
        sceneHeight = Math.max(pendingSize.height, 1);
        const hostRectangle = host.getBoundingClientRect();
        const labElement = host.closest("[data-phase]") as HTMLElement | null;
        const chamberElement =
          labElement?.querySelector("video")?.parentElement ?? null;
        const chamberRectangle = chamberElement?.getBoundingClientRect();
        const compactLandscape =
          sceneHeight < 700 && sceneWidth > sceneHeight;
        if (
          chamberRectangle &&
          chamberRectangle.width > 1 &&
          chamberRectangle.height > 1
        ) {
          chamberRadius = chamberRectangle.width / 2;
          centerX =
            chamberRectangle.left - hostRectangle.left + chamberRadius;
          centerY =
            chamberRectangle.top - hostRectangle.top + chamberRadius;
        } else if (compactLandscape) {
          const chamberSize = Math.min(sceneHeight * 0.67, 252);
          chamberRadius = chamberSize / 2;
          centerX = sceneWidth * 0.2;
          centerY = 70 + chamberRadius;
        } else {
          chamberRadius = clamp(sceneWidth * 0.39, 143, 158);
          centerX = sceneWidth / 2;
          centerY =
            clamp(sceneHeight * 0.22, 172, 186) + chamberRadius;
        }
        app.renderer.resize(sceneWidth, sceneHeight);

        tableBackdrop
          .clear()
          .rect(0, 0, sceneWidth, sceneHeight)
          .fill({ color: 0xf5f1ff, alpha: 1 })
          .ellipse(
            sceneWidth * 0.5,
            sceneHeight * 0.08,
            sceneWidth * 0.94,
            sceneHeight * 0.42,
          )
          .fill({ color: 0xd7ceff, alpha: 0.82 })
          .ellipse(
            sceneWidth * 0.18,
            sceneHeight * 0.34,
            sceneWidth * 0.5,
            sceneHeight * 0.28,
          )
          .fill({ color: 0xc5f7ff, alpha: 0.34 })
          .ellipse(
            sceneWidth * 0.86,
            sceneHeight * 0.42,
            sceneWidth * 0.48,
            sceneHeight * 0.3,
          )
          .fill({ color: 0xffd8e3, alpha: 0.26 })
          .rect(0, sceneHeight * 0.6, sceneWidth, sceneHeight * 0.4)
          .fill({ color: 0xffffff, alpha: 0.5 });
        tableGlow
          .clear()
          .ellipse(
            sceneWidth * 0.5,
            sceneHeight * 0.57,
            sceneWidth * 0.78,
            sceneHeight * 0.16,
          )
          .fill({ color: 0xffffff, alpha: 0.58 })
          .ellipse(
            sceneWidth * 0.5,
            sceneHeight * 0.26,
            sceneWidth * 0.52,
            sceneHeight * 0.08,
          )
          .fill({ color: 0xffffff, alpha: 0.5 });
        partyWorld.position.set(sceneWidth / 2, sceneHeight * 0.56);
        userGlass.position.set(0, 34);
        userGlass.zIndex = 100;
        companionGlasses.forEach((glass, index) => {
          const row = Math.floor(index / 9);
          const column = index % 9;
          const depth = (row + 1) / 7;
          const spacing = 38 + depth * 34;
          let x = (column - 4) * spacing + ((row % 2) - 0.5) * 24;
          if (column === 4 && row >= 4) x += row % 2 ? -64 : 64;
          const y = -316 + row * 68 + (column % 3) * 4;
          const scale = 0.28 + depth * 0.5;
          glass.position.set(x, y);
          glass.scale.set(scale);
          glass.rotation =
            ((index % 5) - 2) * 0.009 + Math.sin(index * 1.7) * 0.008;
          glass.zIndex = row + 1;
        });

        chamberMask
          .clear()
          .circle(centerX, centerY, chamberRadius - 7)
          .fill(0xffffff);
        chamberGlass
          .clear()
          .circle(centerX, centerY, chamberRadius)
          .fill({ color: 0xffffff, alpha: 0.045 })
          .stroke({ color: 0xd8d3df, width: 1.2, alpha: 0.7 });
        auraRed
          .clear()
          .circle(centerX, centerY, chamberRadius - 1)
          .stroke({ color: 0xff385d, width: 4, alpha: 0.92 });
        auraGreen
          .clear()
          .circle(centerX, centerY, chamberRadius - 1)
          .stroke({ color: 0x34df91, width: 4, alpha: 0.96 });
        auraBlue
          .clear()
          .circle(centerX, centerY, chamberRadius - 1)
          .stroke({ color: 0x8b7ca6, width: 1.2, alpha: 0.3 });
        metaballContainer.filterArea = new Rectangle(
          centerX - chamberRadius - 70,
          centerY - chamberRadius - 190,
          chamberRadius * 2 + 140,
          chamberRadius * 2 + 300,
        );
        particleContainer.boundsArea = new Rectangle(
          0,
          0,
          sceneWidth,
          sceneHeight,
        );

        if (orbBody) Composite.remove(engine.world, orbBody);
        orbBody = Bodies.circle(centerX, centerY, chamberRadius + 2, {
          isStatic: true,
          label: "calibration-chamber",
          friction: 0.02,
          restitution: 0.04,
        });
        Composite.add(engine.world, orbBody);

        clearBoundaries();
        boundaries = [
          Bodies.rectangle(-18, sceneHeight / 2, 36, sceneHeight * 2, {
            isStatic: true,
            label: "calibration-boundary-left",
          }),
          Bodies.rectangle(
            sceneWidth + 18,
            sceneHeight / 2,
            36,
            sceneHeight * 2,
            {
              isStatic: true,
              label: "calibration-boundary-right",
            },
          ),
          Bodies.rectangle(sceneWidth / 2, -18, sceneWidth * 2, 36, {
            isStatic: true,
            label: "calibration-boundary-top",
          }),
          Bodies.rectangle(
            sceneWidth / 2,
            sceneHeight - 48,
            sceneWidth * 2,
            48,
            {
              isStatic: true,
              label: "calibration-boundary-floor",
              restitution: 0.38,
              friction: 0.08,
            },
          ),
        ];
        Composite.add(engine.world, boundaries);

        const beamStartY = sceneHeight - 148;
        const beamEndY = centerY + chamberRadius * 0.74;
        const beamLength = Math.max(60, beamStartY - beamEndY);
        beamHalo
          .clear()
          .poly([
            centerX - 28,
            beamStartY,
            centerX - 8,
            beamEndY,
            centerX + 8,
            beamEndY,
            centerX + 28,
            beamStartY,
          ])
          .fill({ color: 0x4ddfff, alpha: 0.72 });
        beamCore
          .clear()
          .poly([
            centerX - 12,
            beamStartY,
            centerX - 4,
            beamEndY,
            centerX + 4,
            beamEndY,
            centerX + 12,
            beamStartY,
          ])
          .fill({ color: 0x7eeeff, alpha: 0.9 });
        beamHot
          .clear()
          .roundRect(
            centerX - 2.5,
            beamEndY,
            5,
            beamLength,
            3,
          )
          .fill({ color: 0xffffff, alpha: 0.96 });
        impactFlash
          .clear()
          .circle(centerX, beamEndY, 26)
          .fill({ color: 0xffffff, alpha: 0.9 })
          .circle(centerX, beamEndY, 47)
          .stroke({ color: 0x62ebff, width: 4, alpha: 0.74 });

        const portraitSize = clamp(sceneWidth * 0.43, 152, 178);
        faceMask
          .clear()
          .circle(0, 0, portraitSize * 0.33)
          .fill(0xffffff);
        faceSprite.width = portraitSize * 0.74;
        faceSprite.height = portraitSize * 0.74;
        shellSprite.width = portraitSize * 1.62;
        shellSprite.height = portraitSize * 1.62;
        iceGlow
          .clear()
          .roundRect(
            -portraitSize * 0.51,
            -portraitSize * 0.51,
            portraitSize * 1.02,
            portraitSize * 1.02,
            34,
          )
          .fill({ color: 0x56dcff, alpha: 0.16 })
          .stroke({ color: 0xffffff, width: 2.2, alpha: 0.82 });
        frostGraphic.clear();
        for (let index = 0; index < 18; index += 1) {
          const angle = (Math.PI * 2 * index) / 18;
          const radius = portraitSize * (0.37 + (index % 3) * 0.022);
          drawCrystal(
            frostGraphic,
            Math.cos(angle) * radius,
            Math.sin(angle) * radius,
            9 + (index % 4) * 3,
            angle + Math.PI / 2,
          );
        }
        bubbleGraphic.clear();
        for (let index = 0; index < 12; index += 1) {
          const angle = index * 1.87;
          const radius = 58 + (index % 4) * 20;
          bubbleGraphic
            .circle(
              Math.cos(angle) * radius,
              Math.sin(angle) * radius,
              2.4 + (index % 3),
            )
            .stroke({ color: 0xffffff, width: 1, alpha: 0.5 });
        }
        specularGraphic
          .clear()
          .moveTo(-portraitSize * 0.35, -portraitSize * 0.43)
          .bezierCurveTo(
            -portraitSize * 0.08,
            -portraitSize * 0.56,
            portraitSize * 0.18,
            -portraitSize * 0.53,
            portraitSize * 0.35,
            -portraitSize * 0.39,
          )
          .stroke({
            color: 0xffffff,
            width: 7,
            alpha: 0.58,
            cap: "round",
          });
        iceGroup.position.set(centerX, centerY);
        displacementSprite.position.set(0, 0);
        resizePending = false;
      };

      const positionOrbit = () => {
        if (orbitDropped) return;
        const visible = [
          "expression-success",
          "charge",
          "freeze",
        ].includes(phaseRef.current);
        orbitGlyphs.forEach((entry) => {
          entry.glyph.visible = visible;
          entry.glyph.position.set(
            centerX + entry.xOffset,
            centerY - chamberRadius - 19,
          );
          entry.glyph.rotation = 0;
        });
      };

      const emitLiquid = (storyPour = false) => {
        const item = liquidParticles[nextLiquidIndex % LIQUID_POOL_SIZE];
        nextLiquidIndex += 1;
        if (item.active) Composite.remove(engine.world, item.body);
        const cycle = nextLiquidIndex % 5;
        Body.setPosition(item.body, {
          x: storyPour
            ? centerX + Math.min(sceneWidth * 0.42, 142) + cycle * 1.2
            : centerX + chamberRadius * 0.53 + cycle * 1.8,
          y: storyPour
            ? Math.min(sceneHeight * 0.29, 230) - (cycle % 2) * 7
            : centerY - chamberRadius - 78 - (cycle % 2) * 6,
        });
        Body.setVelocity(item.body, {
          x: storyPour ? -0.62 - cycle * 0.08 : -1.28 - cycle * 0.1,
          y: storyPour ? 5.1 + (cycle % 3) * 0.24 : 2.7 + (cycle % 3) * 0.2,
        });
        Body.setAngularVelocity(item.body, 0);
        item.particle.scaleX = 0.8 + (cycle % 3) * 0.06;
        item.particle.scaleY = 0.98 + (cycle % 2) * 0.08;
        item.particle.alpha = 0;
        item.particle.tint = cycle % 2 ? 0x704cff : 0x4d8fff;
        item.active = true;
        Composite.add(engine.world, item.body);
      };

      const clearLiquid = () => {
        liquidParticles.forEach((item) => {
          if (item.active) Composite.remove(engine.world, item.body);
          item.active = false;
          item.particle.alpha = 0;
        });
      };

      const updateLiquid = (deltaMs: number, time: number) => {
        const storyPour = phaseRef.current === "pour";
        if (storyPour && !reducedMotionRef.current) {
          liquidEmissionElapsed += deltaMs;
          const cadence = 26;
          while (liquidEmissionElapsed >= cadence) {
            liquidEmissionElapsed -= cadence;
            emitLiquid(true);
          }
        }
        liquidParticles.forEach((item) => {
          if (!item.active) return;
          item.particle.x = item.body.position.x;
          item.particle.y = item.body.position.y;
          if (item.body.position.y > sceneHeight + 80) {
            Composite.remove(engine.world, item.body);
            item.active = false;
            item.particle.alpha = 0;
          }
        });

        liquidRibbon.clear();
        liquidSplash.clear();
        if (storyPour) {
          const pourProgress = easeOutCubic(
            clamp(runtime.phaseElapsed / 620, 0, 1),
          );
          const fadeProgress = clamp(
            (runtime.phaseElapsed - 3300) / 520,
            0,
            1,
          );
          const liquidAlpha = 1 - fadeProgress;
          const sway = Math.sin(time * 0.015) * 4;
          const pourX = centerX + Math.min(sceneWidth * 0.42, 142);
          const pourY = Math.min(sceneHeight * 0.29, 230);
          const contactX = centerX + sway * 0.18;
          const contactY =
            partyWorld.position.y + (userGlass.y - 104) * 0.6;
          const ripple = 10 + Math.abs(Math.sin(time * 0.014)) * 13;

          liquidRibbon
            .moveTo(pourX + sway, pourY)
            .bezierCurveTo(
              pourX + 15,
              pourY + 82,
              contactX + 42,
              contactY - 106,
              contactX,
              contactY,
            )
            .stroke({
              alpha: 0.88 * liquidAlpha * pourProgress,
              cap: "round",
              color: 0x6b35ff,
              width: 28,
            })
            .moveTo(pourX + sway - 2, pourY)
            .bezierCurveTo(
              pourX + 8,
              pourY + 84,
              contactX + 28,
              contactY - 92,
              contactX - 2,
              contactY,
            )
            .stroke({
              alpha: 0.72 * liquidAlpha * pourProgress,
              cap: "round",
              color: 0xbc8cff,
              width: 16,
            })
            .moveTo(pourX + sway - 5, pourY + 1)
            .bezierCurveTo(
              pourX + 1,
              pourY + 78,
              contactX + 16,
              contactY - 86,
              contactX - 6,
              contactY,
            )
            .stroke({
              alpha: 0.62 * liquidAlpha * pourProgress,
              cap: "round",
              color: 0xffffff,
              width: 4,
            });
          liquidSplash
            .ellipse(contactX, contactY + 2, ripple, 5)
            .stroke({
              color: 0xc8b2ff,
              width: 4,
              alpha: 0.56 * liquidAlpha * pourProgress,
            })
            .ellipse(contactX, contactY + 3, ripple * 1.75, 8)
            .stroke({
              color: 0x6b35ff,
              width: 2,
              alpha: 0.36 * liquidAlpha * pourProgress,
            });
          for (let index = 0; index < 5; index += 1) {
            const dropletAngle = time * 0.008 + index * 1.37;
            const dropletDistance = 8 + (index % 3) * 8;
            liquidSplash
              .circle(
                contactX + Math.cos(dropletAngle) * dropletDistance,
                contactY -
                  9 -
                  Math.abs(Math.sin(dropletAngle)) * (10 + index * 2),
                2.1 + (index % 2),
              )
              .fill({
                color: index % 2 ? 0xb78cff : 0x6b35ff,
                alpha: 0.5 * liquidAlpha * pourProgress,
              });
          }
          return;
        }

        if (phaseRef.current === "drain") {
          const drainProgress = easeOutCubic(
            clamp(runtime.phaseElapsed / 1780, 0, 1),
          );
          const pose = devicePoseRef.current;
          const streamX =
            centerX +
            clamp(pose.roll / 90, -1, 1) * sceneWidth * 0.2 +
            Math.sin(time * 0.014) * 5;
          const streamWidth = 30 * (1 - drainProgress * 0.48);
          liquidRibbon
            .moveTo(streamX, sceneHeight - 126)
            .bezierCurveTo(
              streamX - 8,
              sceneHeight - 72,
              streamX + 12,
              sceneHeight - 28,
              streamX + 2,
              sceneHeight + 28,
            )
            .stroke({
              alpha: 0.88 * (1 - clamp((drainProgress - 0.72) / 0.28, 0, 1)),
              cap: "round",
              color: 0x6435ff,
              width: streamWidth,
            })
            .moveTo(streamX - 5, sceneHeight - 124)
            .bezierCurveTo(
              streamX - 10,
              sceneHeight - 70,
              streamX + 5,
              sceneHeight - 30,
              streamX - 2,
              sceneHeight + 24,
            )
            .stroke({
              alpha: 0.62 * (1 - drainProgress),
              cap: "round",
              color: 0xe4d7ff,
              width: 5,
            });
          for (let index = 0; index < 5; index += 1) {
            const fall = (drainProgress * 1.7 + index * 0.19) % 1;
            liquidSplash
              .circle(
                streamX + Math.sin(index * 1.8 + time * 0.006) * 16,
                sceneHeight - 90 + fall * 150,
                3 + (index % 2) * 2,
              )
              .fill({
                color: index % 2 ? 0xb58cff : 0x6435ff,
                alpha: 0.58 * (1 - drainProgress),
              });
          }
        }
      };

      const resetIce = () => {
        if (iceBody) {
          Composite.remove(engine.world, iceBody);
          iceBody = null;
        }
        iceGroup.visible = false;
        iceGroup.alpha = 0;
        shellSprite.alpha = 0;
        frostGraphic.alpha = 0;
        bubbleGraphic.alpha = 0;
        specularGraphic.alpha = 0;
        cracks.forEach((crack) => {
          crack.visible = false;
        });
      };

      const createIceBody = () => {
        if (iceBody) Composite.remove(engine.world, iceBody);
        if (orbBody) {
          Composite.remove(engine.world, orbBody);
          orbBody = null;
        }
        const size = clamp(sceneWidth * 0.44, 158, 186);
        iceBody = Bodies.rectangle(centerX, centerY, size, size, {
          chamfer: { radius: 38 },
          friction: 0.06,
          frictionAir: 0.018,
          label: "calibration-ice",
          restitution: 0.4,
        });
        Composite.add(engine.world, iceBody);
      };

      const dropOrbitCopy = () => {
        if (orbitDropped) return;
        orbitDropped = true;
        if (reducedMotionRef.current) {
          orbitGlyphs.forEach((entry) => {
            entry.glyph.visible = false;
          });
          return;
        }
        orbitGlyphs.forEach((entry, index) => {
          const body = Bodies.rectangle(
            entry.glyph.x,
            entry.glyph.y,
            Math.max(entry.glyph.width, 7),
            Math.max(entry.glyph.height, 13),
            {
              friction: 0.08,
              frictionAir: 0.006,
              label: "calibration-impact-letter",
              restitution: 0.42,
            },
          );
          Body.setAngle(body, entry.glyph.rotation);
          Body.setVelocity(body, {
            x: (index - 2) * 0.52,
            y: 2.1 + (index % 3) * 0.38,
          });
          Body.setAngularVelocity(
            body,
            ((index % 2) * 2 - 1) * (0.025 + (index % 4) * 0.006),
          );
          entry.body = body;
          Composite.add(engine.world, body);
        });
      };

      const createShards = () => {
        if (shattered) return;
        shattered = true;
        const origin = iceBody?.position ?? {
          x: centerX,
          y: sceneHeight - 190,
        };
        if (iceBody) {
          Composite.remove(engine.world, iceBody);
          iceBody = null;
        }
        iceGroup.visible = false;
        shards.forEach((shard, index) => {
          const angle =
            (Math.PI * 2 * index) / shards.length + (index % 3) * 0.09;
          const body = Bodies.rectangle(
            origin.x,
            origin.y,
            shard.width,
            shard.height,
            {
              frictionAir: 0.003,
              label: "calibration-shard",
              restitution: 0.18,
            },
          );
          Body.setVelocity(body, {
            x: Math.cos(angle) * (6.8 + (index % 5) * 1.05),
            y:
              Math.sin(angle) * (7 + (index % 4) * 0.9) -
              2.2,
          });
          Body.setAngularVelocity(
            body,
            ((index % 2) * 2 - 1) * (0.12 + (index % 4) * 0.035),
          );
          shard.body = body;
          shard.graphic.position.copyFrom(origin);
          shard.graphic.visible = true;
          Composite.add(engine.world, body);
        });
        blackCore.position.copyFrom(origin);
        blackCore.scale.set(0.05);
        blackCore.visible = true;
      };

      const syncPhase = (deltaMs: number) => {
        const currentPhase = phaseRef.current;
        if (currentPhase !== runtime.phaseSeen) {
          runtime.phaseSeen = currentPhase;
          runtime.phaseElapsed = 0;

          if (currentPhase === "idle") {
            clearLiquid();
            resetIce();
            orbitDropped = false;
            shattered = false;
            orbitGlyphs.forEach((entry) => {
              if (entry.body) {
                Composite.remove(engine.world, entry.body);
                entry.body = null;
              }
              entry.glyph.visible = false;
              entry.glyph.alpha = 1;
            });
            shards.forEach((shard) => {
              if (shard.body) {
                Composite.remove(engine.world, shard.body);
                shard.body = null;
              }
              shard.graphic.visible = false;
            });
            blackCore.visible = false;
          }
          if (currentPhase === "freeze") {
            clearLiquid();
            if (iceBody) {
              Composite.remove(engine.world, iceBody);
              iceBody = null;
            }
            iceGroup.visible = true;
            iceGroup.alpha = 1;
          }
          if (currentPhase === "drop") {
            dropOrbitCopy();
            createIceBody();
            if (iceBody) {
              Body.setPosition(iceBody, { x: centerX, y: centerY });
              Body.setVelocity(iceBody, { x: 0.25, y: 5.2 });
              Body.setAngularVelocity(iceBody, -0.025);
            }
          }
          if (
            currentPhase === "break" &&
            (!iceBody ||
              !Number.isFinite(iceBody.position.x) ||
              !Number.isFinite(iceBody.position.y))
          ) {
            createIceBody();
          }
          if (currentPhase === "break" && iceBody) {
            orbitGlyphs.forEach((entry) => {
              if (entry.body) {
                Composite.remove(engine.world, entry.body);
                entry.body = null;
              }
              entry.glyph.visible = false;
            });
            Body.setPosition(iceBody, {
              x: centerX,
              y: sceneHeight - 192,
            });
            Body.setVelocity(iceBody, { x: 0, y: 0 });
            Body.setAngularVelocity(iceBody, 0);
          }
          if (currentPhase === "ice-rain" && iceBody) {
            Composite.remove(engine.world, iceBody);
            iceBody = null;
          }
          if (currentPhase === "pour") clearLiquid();
          if (currentPhase === "drink-finish") {
            blackCore.visible = false;
            blackCore.scale.set(0.05);
          }
          if (currentPhase === "shatter") createShards();
        } else {
          runtime.phaseElapsed += deltaMs;
        }
      };

      const updateAmbient = (time: number) => {
        const currentPhase = phaseRef.current;
        const idle = currentPhase === "idle";
        chamberGlass.alpha = [
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
        ].includes(currentPhase)
          ? 0
          : 1;
        causticGroup.visible = idle;
        caustics.forEach((graphic, index) => {
          graphic.position.set(
            centerX +
              Math.sin(time * (0.00032 + index * 0.000015) + index) *
                chamberRadius *
                0.58,
            centerY +
              Math.cos(time * (0.00027 + index * 0.000012) + index * 1.7) *
                chamberRadius *
                0.48,
          );
          graphic.rotation =
            time * (index % 2 ? -0.00008 : 0.0001) + index * 0.4;
        });

        auraRed.alpha =
          currentPhase === "scan" || currentPhase === "scan-exit" ? 1 : 0;
        auraGreen.alpha = [
          "voice-success",
          "expression-success",
        ].includes(currentPhase)
          ? 1
          : 0;
        auraBlue.alpha = [
          "scan",
          "scan-exit",
          "face-hold",
          "voice-prompt",
          "voice",
          "voice-hold",
          "voice-success",
          "expression-prompt",
          "expression",
          "expression-success",
          "charge",
          "freeze",
        ].includes(currentPhase)
          ? 1
          : 0;
        const pulse = 1 + Math.sin(time * 0.006) * 0.012;
        auraRed.scale.set(pulse);
        auraGreen.scale.set(pulse);
        const levels = audioLevels.current;
        const waveActive = auraBlue.alpha > 0 && currentPhase !== "idle";
        waveLayer.visible = waveActive;
        const drawAudioArc = (
          graphic: Graphics,
          speaker: "agent" | "user",
          level: number,
          glow: boolean,
        ) => {
          graphic.clear();
          if (!waveActive) return;
          const start = speaker === "agent" ? -Math.PI : 0;
          const color = speaker === "agent" ? 0x7651ff : 0x24d7ef;
          const pointCount = 46;
          const motionLevel = reducedMotionRef.current
            ? Math.min(level, 0.28)
            : level;
          for (let index = 0; index <= pointCount; index += 1) {
            const progress = index / pointCount;
            const angle = start + progress * Math.PI;
            const envelope = Math.sin(progress * Math.PI);
            const waveform =
              Math.sin(time * 0.009 + index * 0.78) * 0.62 +
              Math.sin(time * 0.0047 - index * 1.31) * 0.38;
            const radius =
              chamberRadius +
              0.5 +
              waveform * envelope * (1.3 + motionLevel * 13);
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;
            if (index === 0) graphic.moveTo(x, y);
            else graphic.lineTo(x, y);
          }
          graphic.stroke({
            color,
            width: glow ? 11 : 3.2,
            alpha: glow ? 0.11 + motionLevel * 0.18 : 0.7 + motionLevel * 0.28,
            cap: "round",
            join: "round",
          });
        };
        drawAudioArc(agentWaveGlow, "agent", levels.agent, true);
        drawAudioArc(userWaveGlow, "user", levels.user, true);
        drawAudioArc(agentWave, "agent", levels.agent, false);
        drawAudioArc(userWave, "user", levels.user, false);
      };

      const updatePartyWorld = (time: number) => {
        const currentPhase = phaseRef.current;
        const storyPhases: CalibrationPhase[] = [
          "ice-rain",
          "zoom-prompt",
          "zoom",
          "pour",
          "return-phone",
          "drink-prompt",
          "drink",
          "drain",
          "drink-finish",
        ];
        const active = storyPhases.includes(currentPhase);
        partyWorld.visible = active;
        tableBackdrop.visible = active;
        tableGlow.visible = active;
        if (!active) {
          userLiquid.clear();
          userGlassShell.alpha = 0;
          iceRainCubes.forEach((cube) => {
            cube.visible = false;
          });
          return;
        }

        const elapsed = runtime.phaseElapsed;
        const zoom = clamp(zoomProgressRef.current, 0, 1);
        const pose = devicePoseRef.current;
        const returnProgress =
          currentPhase === "return-phone"
            ? easeOutCubic(clamp(elapsed / 1180, 0, 1))
            : [
                  "drink-prompt",
                  "drink",
                  "drain",
                  "drink-finish",
                ].includes(currentPhase)
              ? 1
              : 0;
        const reveal =
          currentPhase === "zoom"
            ? easeOutCubic(zoom)
            : currentPhase === "pour"
              ? 1
              : currentPhase === "return-phone"
                ? 1 - returnProgress
                : 0;
        const fieldAlpha = clamp((reveal - 0.18) / 0.72, 0, 1);
        tableBackdrop.alpha = fieldAlpha;
        tableGlow.alpha = fieldAlpha;

        const wideScale = 0.6;
        const phoneScale = 3.45;
        const worldScale =
          currentPhase === "zoom"
            ? phoneScale + (wideScale - phoneScale) * easeOutCubic(zoom)
            : currentPhase === "pour"
              ? wideScale
              : currentPhase === "return-phone"
                ? wideScale + (phoneScale - wideScale) * returnProgress
                : phoneScale;
        partyWorld.scale.set(worldScale);
        partyWorld.rotation = clamp(-pose.roll / 720, -0.08, 0.08);
        partyWorld.alpha =
          currentPhase === "drink-finish"
            ? 1 - clamp((elapsed - 2380) / 720, 0, 1)
            : 1;

        userGlassShell.alpha =
          currentPhase === "zoom"
            ? clamp((zoom - 0.08) / 0.24, 0, 1)
            : currentPhase === "pour"
              ? 1
              : currentPhase === "return-phone"
                ? 1 - returnProgress
                : 0;

        companionGlasses.forEach((glass, index) => {
          const row = Math.floor(index / 9);
          const threshold = 0.14 + (6 - row) * 0.085;
          glass.alpha =
            clamp((reveal - threshold) / 0.2, 0, 1) * fieldAlpha;
          glass.scale.y =
            glass.scale.x *
            (1 + Math.sin(time * 0.0012 + index * 0.7) * 0.006);
        });

        const targetLiquidLevel =
          currentPhase === "pour"
            ? easeOutCubic(clamp((elapsed - 460) / 2550, 0, 1)) * 0.78
            : ["return-phone", "drink-prompt", "drink"].includes(currentPhase)
              ? 0.78
              : currentPhase === "drain"
                ? 0.78 * (1 - easeOutCubic(clamp(elapsed / 1780, 0, 1)))
                : 0;
        renderedLiquidLevel +=
          (targetLiquidLevel - renderedLiquidLevel) *
          (currentPhase === "drain" ? 0.12 : 0.075);
        const targetTilt = clamp(
          pose.roll / 115 + Math.sin((pose.pitch * Math.PI) / 180) * 0.32,
          -0.55,
          0.55,
        );
        renderedLiquidTilt +=
          (targetTilt - renderedLiquidTilt) *
          clamp(0.08 + pose.velocity * 0.006, 0.08, 0.3);

        userLiquid.clear();
        if (renderedLiquidLevel > 0.004) {
          const surfaceY = 108 - renderedLiquidLevel * 218;
          const wave = reducedMotionRef.current
            ? 0
            : Math.sin(time * 0.007) * (2.2 + pose.velocity * 0.06);
          const leftY = surfaceY - renderedLiquidTilt * 58 + wave;
          const rightY = surfaceY + renderedLiquidTilt * 58 - wave;
          userLiquid
            .poly([-75, leftY, 75, rightY, 59, 110, -59, 110])
            .fill({ color: 0x6435ff, alpha: 0.94 })
            .poly([
              -63,
              leftY + 8,
              -42,
              leftY + 11,
              -32,
              104,
              -52,
              108,
            ])
            .fill({ color: 0xc5a4ff, alpha: 0.22 })
            .moveTo(-73, leftY)
            .bezierCurveTo(
              -32,
              leftY - 4 - wave,
              31,
              rightY + 4 + wave,
              73,
              rightY,
            )
            .stroke({
              color: 0xe1d2ff,
              width: 4,
              alpha: 0.76,
              cap: "round",
            });
        }

        iceRainCubes.forEach((cube, index) => {
          const column = index % 3;
          const row = Math.floor(index / 3);
          const settleX =
            (column - 1) * 46 +
            Math.sin(index * 2.17) * 4 +
            renderedLiquidTilt * (14 + row * 2);
          const settleY = -30 + row * 30 + (index % 3) * 2;
          const fallProgress =
            currentPhase === "ice-rain"
              ? easeOutCubic(clamp((elapsed - index * 48) / 980, 0, 1))
              : 1;
          cube.visible = fallProgress > 0;
          cube.position.set(
            settleX + Math.sin(time * 0.003 + index) * 1.2,
            -470 + (settleY + 470) * fallProgress,
          );
          cube.rotation =
            index * 0.47 +
            (1 - fallProgress) * 3.8 +
            renderedLiquidTilt * 0.26;
          const drainProgress =
            currentPhase === "drain"
              ? easeOutCubic(clamp((elapsed - 190) / 1680, 0, 1))
              : currentPhase === "drink-finish"
                ? 1
                : 0;
          if (drainProgress > 0) {
            cube.y += drainProgress * (190 + (index % 4) * 34);
            cube.x += renderedLiquidTilt * drainProgress * 80;
            cube.alpha = 1 - clamp((drainProgress - 0.66) / 0.34, 0, 1);
          } else {
            cube.alpha = 0.92;
          }
        });

        iceGroup.visible = true;
        iceGroup.alpha =
          currentPhase === "drink-finish"
            ? 1 - clamp((elapsed - 2120) / 720, 0, 1)
            : 1;
        iceGroup.position.set(
          partyWorld.position.x,
          partyWorld.position.y +
            (userGlass.y + 18 + renderedLiquidTilt * 18) * worldScale,
        );
        iceGroup.scale.set(worldScale * 0.19);
        iceGroup.rotation =
          partyWorld.rotation + renderedLiquidTilt * 0.18;
        shellSprite.alpha = 1;
        frostGraphic.alpha = 0.92;
        bubbleGraphic.alpha = 0.7;
        specularGraphic.alpha = 0.78;
        iceGlow.alpha = 0.52;

        if (currentPhase === "drink-finish" && elapsed >= 2460) {
          const blackProgress = easeOutCubic(
            clamp((elapsed - 2460) / 680, 0, 1),
          );
          blackCore.visible = true;
          blackCore.position.set(centerX, centerY);
          blackCore.scale.set(0.05 + blackProgress * 14);
        }
      };

      const updateBeamAndIce = (time: number) => {
        const currentPhase = phaseRef.current;
        const freezing = currentPhase === "freeze";
        beamGroup.visible = freezing;
        if (freezing) {
          const progress = clamp(runtime.phaseElapsed / 1500, 0, 1);
          const flicker =
            0.82 +
            Math.sin(time * 0.075) * 0.1 +
            Math.sin(time * 0.031) * 0.08;
          beamGroup.alpha = clamp(flicker, 0.5, 1);
          beamHalo.alpha = 0.72 + Math.sin(time * 0.045) * 0.13;
          beamCore.alpha = 0.88 + Math.sin(time * 0.072) * 0.08;
          impactFlash.alpha = 0.74 + Math.sin(time * 0.052) * 0.2;

          iceGroup.visible = true;
          iceGroup.alpha = 1;
          const shakeStrength = reducedMotionRef.current
            ? 0
            : 1.5 + progress * 6.5;
          iceGroup.position.set(
            centerX +
              Math.sin(time * (0.028 + progress * 0.04)) * shakeStrength,
            centerY +
              Math.cos(time * (0.034 + progress * 0.045)) *
                shakeStrength *
                0.7,
          );
          iceGroup.rotation =
            Math.sin(time * (0.019 + progress * 0.028)) *
            (0.004 + progress * 0.018);
          iceGroup.scale.set(1.48 - easeOutCubic(progress) * 0.48);
          shellSprite.alpha = easeOutCubic(progress);
          frostGraphic.alpha = clamp(progress * 1.34, 0, 0.94);
          bubbleGraphic.alpha = clamp((progress - 0.16) * 1.6, 0, 0.72);
          specularGraphic.alpha = clamp((progress - 0.32) * 1.8, 0, 0.78);
          iceGlow.alpha = 0.22 + progress * 0.48;
          displacement.scale.x = progress * 5.5;
          displacement.scale.y = progress * 4.2;
        } else if (["drop", "break"].includes(currentPhase) && iceBody) {
          iceGroup.visible = true;
          iceGroup.alpha = 1;
          iceGroup.position.copyFrom(iceBody.position);
          iceGroup.rotation = iceBody.angle;
          iceGroup.scale.set(1);
          shellSprite.alpha = 1;
          frostGraphic.alpha = 0.92;
          bubbleGraphic.alpha = 0.7;
          specularGraphic.alpha = 0.78;
          iceGlow.alpha = 0.58;
          displacement.scale.x = 4.8;
          displacement.scale.y = 3.8;
        } else if (!["shatter", "blackout"].includes(currentPhase)) {
          beamGroup.visible = false;
        }

        frostParticles.forEach((sprite, index) => {
          if (!freezing) {
            sprite.alpha = 0;
            return;
          }
          const progress = clamp(runtime.phaseElapsed / 1500, 0, 1);
          const angle = index * 2.14 + time * 0.0015;
          const distance =
            chamberRadius * (1.18 - progress * 0.72) +
            (index % 4) * 7;
          sprite.position.set(
            centerX + Math.cos(angle) * distance,
            centerY + Math.sin(angle) * distance,
          );
          sprite.alpha = clamp(progress * 1.3, 0, 0.74);
        });
      };

      const updateImpulse = () => {
        const nextImpulse = impulseRef.current;
        if (
          nextImpulse.sequence === runtime.impulseApplied ||
          !iceBody
        ) {
          return;
        }
        runtime.impulseApplied = nextImpulse.sequence;
        if (reducedMotionRef.current) return;
        const strength = 0.048 + nextImpulse.progress * 0.095;
        Body.applyForce(iceBody, iceBody.position, {
          x: nextImpulse.direction * strength,
          y: -0.06 - nextImpulse.progress * 0.045,
        });
        Body.setAngularVelocity(
          iceBody,
          nextImpulse.direction * (0.11 + nextImpulse.progress * 0.15),
        );
      };

      const updateCracks = () => {
        const count = Math.round(
          impulseRef.current.progress * 14,
        );
        const thresholds = [3, 6, 9, 12, 14];
        cracks.forEach((crack, index) => {
          crack.visible =
            ["break", "drop"].includes(phaseRef.current) &&
            count >= thresholds[index];
        });
      };

      const updateOrbitBodies = () => {
        if (!orbitDropped) return;
        orbitGlyphs.forEach((entry) => {
          if (!entry.body) return;
          entry.glyph.position.copyFrom(entry.body.position);
          entry.glyph.rotation = entry.body.angle;
          if (entry.body.position.y > sceneHeight + 80) {
            entry.glyph.visible = false;
          }
        });
      };

      const updateShards = () => {
        if (phaseRef.current !== "shatter") return;
        shards.forEach((shard) => {
          if (!shard.body) return;
          shard.graphic.position.copyFrom(shard.body.position);
          shard.graphic.rotation = shard.body.angle;
        });
        if (runtime.phaseElapsed >= 100) {
          const coreProgress = clamp(
            (runtime.phaseElapsed - 100) / 700,
            0,
            1,
          );
          blackCore.scale.set(
            0.05 + easeOutCubic(coreProgress) * 14,
          );
        }
      };

      const runtime: SceneRuntime = {
        app,
        faceSprite,
        faceTexture: null,
        impulseApplied: 0,
        phaseElapsed: 0,
        phaseSeen: phaseRef.current,
      };
      runtimeRef.current = runtime;
      const initialFreezeFrame = freezeFrameRef.current;
      if (initialFreezeFrame) {
        void loadImageTexture(initialFreezeFrame)
          .then((texture) => {
            if (cancelled || runtimeRef.current !== runtime) {
              texture.destroy(true);
              return;
            }
            runtime.faceTexture?.destroy(true);
            runtime.faceTexture = texture;
            runtime.faceSprite.texture = texture;
          })
          .catch(() => fallbackRef.current());
      }

      resizeObserver = new ResizeObserver((entries) => {
        const rectangle = entries[0]?.contentRect;
        if (!rectangle) return;
        pendingSize = {
          height: Math.max(rectangle.height, 1),
          width: Math.max(rectangle.width, 1),
        };
        resizePending = true;
      });
      resizeObserver.observe(host);

      const tick = (ticker: import("pixi.js").Ticker) => {
          const deltaMs = Math.min(ticker.elapsedMS, 50);
          if (resizePending) rebuildStaticScene();
          syncPhase(deltaMs);
          tickRef.current(deltaMs);

          if (!reducedMotionRef.current) {
            accumulator += deltaMs;
            let steps = 0;
            while (accumulator >= FIXED_STEP && steps < 3) {
              Engine.update(engine, FIXED_STEP);
              accumulator -= FIXED_STEP;
              steps += 1;
            }
          }

          const now = performance.now();
          positionOrbit();
          updateAmbient(now);
          updatePartyWorld(now);
          updateLiquid(deltaMs, now);
          updateBeamAndIce(now);
          updateImpulse();
          updateCracks();
          updateOrbitBodies();
          updateShards();
      };
      app.ticker.add(tick, undefined, UPDATE_PRIORITY.HIGH);
      app.ticker.maxFPS = 60;
      app.ticker.minFPS = 20;
      app.start();

      visibilityHandler = () => {
        const hidden = document.hidden;
        accumulator = 0;
        if (hidden) app.stop();
        else app.start();
        visibilityRef.current(hidden);
      };
      document.addEventListener("visibilitychange", visibilityHandler);

      return () => {
        app.stop();
        app.ticker.remove(tick);
        resizeObserver?.disconnect();
        if (visibilityHandler) {
          document.removeEventListener(
            "visibilitychange",
            visibilityHandler,
          );
        }
        clearLiquid();
        Composite.clear(engine.world, false, true);
        Engine.clear(engine);
        metaballContainer.filters = null;
        faceSprite.filters = null;
        liquidBlur.destroy();
        liquidThreshold.destroy();
        displacement.destroy();
        runtime.faceTexture?.destroy(true);
        liquidTexture.destroy(true);
        displacementTexture.destroy(true);
        frostTexture.destroy(true);
        runtimeRef.current = null;
        void Promise.allSettled([
          Assets.unload(ICE_SHELL_URL),
          Assets.unload(GLASS_FRONT_URL),
          Assets.unload(GLASS_QUARTER_URL),
          Assets.unload(FIELD_ICE_URL),
        ]);
        app.destroy(
          { removeView: true, releaseGlobalResources: true },
          { children: true, texture: false, textureSource: false },
        );
      };
    };

    let dispose: (() => void) | undefined;
    void start()
      .then((cleanup) => {
        if (cancelled) cleanup?.();
        else dispose = cleanup;
      })
      .catch(() => {
        if (!cancelled) fallbackRef.current();
      });

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      if (visibilityHandler) {
        document.removeEventListener(
          "visibilitychange",
          visibilityHandler,
        );
      }
      dispose?.();
    };
  }, []);

  return <div ref={hostRef} className="calibration-pixi-host" />;
}
