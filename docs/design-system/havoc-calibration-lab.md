# Havoc Calibration Lab — production design system

This page-level system adapts the UI/UX Pro Max “Immersive/Interactive
Experience” and “Tactile Digital” recommendations to Havoc’s established
visual language. It overrides generic palette and font suggestions from the
search result.

## Design intent

Calibration should feel like the first playable Havoc game, not a hardware
settings checklist. The phone is a reaction chamber, Godfrey is an energetic
lab guide, and every permission or sensor check has an immediate physical
payoff.

Design dials:

- Variance: 7/10 — surprising compositions without losing orientation.
- Motion: 9/10 — authored choreography, physics, and audio reactivity.
- Density: 4/10 — one instruction and one action at a time.
- Tone: tactile, glossy, funny, slightly dangerous, never corporate.

## Core tokens

| Role | Value | Use |
| --- | --- | --- |
| Ink | `#111015` | Primary copy, outlines, press shadows |
| Cream | `#FFFAF1` | Default environment |
| Paper | `#FFFFFF` | Guide card and chamber highlights |
| Violet | `#7048FF` | Godfrey, agent waveform, liquid |
| Coral | `#FF4F62` | Energy, warnings, red-table family |
| Cyan | `#35DFF4` | User waveform, ice, beam |
| Lime | `#C8FF37` | Accessible physical-action controls |
| Muted ink | `#756D79` | Secondary copy only |

Use the bundled Geist family. Do not add network fonts. Headings use 900–950
weight, tight tracking, and compact line height. Body copy stays at 11–14px on
the phone, with no critical text below 9px.

## Composition

1. Persistent top rail: `HAVOC`, “Calibration lab,” five-step progress.
2. Godfrey guide card: compact avatar, one spoken line, live/guide status.
3. One dominant stage: circular camera/reaction chamber or the phone-as-glass
   world.
4. One imperative instruction.
5. One visible 48px+ fallback action when hardware input is not available.
6. Compact privacy/runtime state at the safe-area edge.

Godfrey disappears during physical interactions so the stage has room to
breathe. Development navigation never appears in the mobile production view.

## Materials and effects

- Chamber borders precisely share the chamber center and radius.
- Agent audio animates the violet upper arc; user audio animates the cyan lower
  arc. Both are continuous paths, not detached dots.
- Ice uses translucent shells, facets, bubbles, frost, refraction, cracks, and
  a controlled cyan glow.
- The freeze gun fires from its visible front muzzle.
- The drink world uses a perspective red tabletop, tapered glasses, specular
  rims, distinct colored liquids, and soft contact shadows.
- Purple liquid needs a continuous stream, bright core, volume, moving
  surface, contact ripples, droplets, and visible fill/drain state.
- Tactile controls use a thin ink outline, lime fill, and a 6px press shadow.
  Active press moves the control into its shadow without shifting layout.

## Motion rules

- Motion must communicate cause and effect: voice moves the border, the gun
  creates ice, shake creates cracks, zoom reveals the table, the flask creates
  liquid, inversion drains it.
- Use 150–300ms UI transitions and authored 500–900ms scene handoffs.
- Physics actors may overshoot; text and navigation may not flicker.
- No decorative infinite motion outside the idle flask and audio waveform.
- Remove all loose letters before the interactive cube hold.
- The final black frame contains no shards, shadow, status, or one-frame flash.
- Under `prefers-reduced-motion`, remove shake, travel, falling letters, and
  repeated loops while preserving every state and control.

## Interaction and accessibility

- Every physical gesture has visible desktop and keyboard fallbacks.
- Shake/zoom/drink own wheel and touch input only during their active phase and
  prevent document scrolling while active.
- Minimum target size: 44×44px; primary physical fallback is at least 50px
  high.
- Visible focus rings are mandatory.
- Live camera is mirrored; prerecorded media is not.
- Face analysis is an on-device `jawOpen` interaction gate, never identity or
  emotion recognition.
- Caption timing and the local phase machine remain authoritative if Vapi,
  browser speech, media, or sensors are unavailable.

## Production checklist

- Test 300×650, 375×812, 390×844, 430×932, and 812×375.
- Confirm no horizontal/document scroll in all three physical interactions.
- Confirm both synthetic and manual desktop fallbacks complete.
- Confirm camera/mic and GPU resources are released before route handoff.
- Confirm no console errors after a clean reload.
- Confirm `npm test` passes the TypeScript and production Next.js build.
- Do not purchase software, APIs, assets, or plans. Vapi is optional and may
  use only the owner’s existing credits.
