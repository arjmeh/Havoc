# Calibration Lab browser runtime

Calibration Lab V2 is fully playable without credentials. Live camera,
microphone analysis, browser speech, desktop gestures, and the deterministic
synthetic adapter all run in the browser. Vapi is an optional enhancement that
may use Evan's existing credits; the app never creates, purchases, or
auto-reloads credits.

## Optional Vapi configuration

Set only these public build-time variables in the existing Vercel project:

```text
NEXT_PUBLIC_VAPI_PUBLIC_KEY
NEXT_PUBLIC_VAPI_ASSISTANT_ID
```

The browser must receive a **Vapi public key**, never a private API key. No key
is committed to the repository. If either variable is absent, invalid, out of
credits, or blocked by the network, the runtime immediately continues with
local browser speech and microphone energy detection.

The referenced assistant should be configured in the existing Vapi account
with:

- Godfrey New V2 or the closest available energetic Vapi voice.
- No first message, autonomous system prompt, or independent conversation
  script. The browser phase machine owns every cue and every transition.
- No recording or persistent transcript storage.
- No background sound.
- Existing Vapi credits only and no automatic recharge.

The client also overrides the first-message mode to
`assistant-waits-for-user`, disables background sound, and caps a web call at
90 seconds. It uses the official `@vapi-ai/web` events for call lifecycle,
assistant volume, local volume, speech state, and user transcripts. See the
[Vapi web-call quickstart](https://docs.vapi.ai/quickstart/web) and
[official Web SDK repository](https://github.com/VapiAI/client-sdk-web).
Do not configure Vapi to improvise its own calibration dialogue: doing so can
double-talk over the authored cues. Browser timing and the local state machine
remain authoritative even while Vapi supplies the voice.

## Opening voice gate

The first flask beat is interaction-driven, not a cosmetic timer:

1. The guide asks, “Hey—can you hear me?” and arms local voice capture.
2. The flask remains in its chamber until speech recognition, microphone
   energy, or an optional Vapi user-transcript event confirms a reply.
3. A 4.8-second escape advances only when microphone access is unavailable,
   silent, or ignored, so the demo cannot deadlock.
4. “Okay, we’ll save this for later” plays while the flask exits. The camera
   reveal and “Cool, there you are…” follow in the next authored phase.

Browser echo suppression, noise suppression, agent-speaking gating, and a
short minimum hold keep the guide's own line from satisfying the gate.

## On-device game-face calibration

Live camera sessions use MediaPipe Face Landmarker locally in the browser. The
runtime dynamically loads `@mediapipe/tasks-vision@1.0.0`, serves the matching
Wasm and Face Landmarker model from `/calibration-vision`, samples at most once
every 90 ms, and reads only the `jawOpen` facial-expression blendshape.

The authored response ladder is:

- `jawOpen >= 0.20`: “Wider.”
- `jawOpen >= 0.40`: “Wiiider!”
- `jawOpen >= 0.58` held for 450 ms: “Perfect,” capture the displayed frame,
  and continue to the freeze-gun beat.

This is facial-expression/game-face calibration, not identity recognition. The
app does not enroll a face, name a face, compare identities, persist
landmarks, or upload camera frames to a Havoc server. MediaPipe states that
input processing happens on-device and input data is not sent to Google;
MediaPipe may still collect API utilization and performance metrics, as
described in its current
[privacy notice](https://developers.google.com/edge/mediapipe/legal/tos).
The Web implementation follows Google's
[Face Landmarker guide](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker/web_js).

Exact third-party versions, source URLs, licenses, byte sizes, and SHA-256
checksums are recorded in
[`docs/calibration-third-party-notices.md`](./calibration-third-party-notices.md).

## Permission order

The `Tap to start` handler intentionally invokes these operations before its
first `await`:

1. `DeviceMotionEvent.requestPermission()` when Safari exposes it.
2. `DeviceOrientationEvent.requestPermission()` when Safari exposes it.
3. `navigator.mediaDevices.getUserMedia()` for the front camera and microphone.
4. Optional Vapi startup.

Motion/orientation APIs require a secure top-level context and transient user
activation on iOS. Keep the deployed experience on HTTPS and do not iframe it.
See the [W3C Device Orientation and Motion
specification](https://www.w3.org/TR/orientation-event/) and
[MDN getUserMedia security requirements](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia).

## Gesture inputs

`CalibrationGestureDetector` is a DOM-free detector shared by real and
synthetic inputs:

- Shake uses linear acceleration when available and a high-pass
  gravity-removal fallback otherwise.
- A smoothed energy threshold, 135 ms refractory window, and direction
  alternation prevent one noisy movement from counting repeatedly.
- Inversion primarily compares the current normalized gravity vector with the
  starting vector. It requires a dot product below `-0.74` for 450 ms.
- Orientation beta/gamma deltas provide an independent inversion fallback.
- Sensor health becomes `unavailable` when fewer than three events arrive in
  1.5 seconds.

Every physical input has a desktop/accessibility equivalent:

- Shake: phone motion, alternating swipe, contained wheel movement, repeated
  tap, W/S, or arrow keys.
- Zoom reveal: pinch-in, contained drag/wheel, repeated tap, Minus, Space,
  Enter, Page Down, or Arrow Down.
- Drink inversion: phone rotation, contained swipe/wheel, tap, `R`, Space,
  Enter, or arrow keys.

In a non-production build, append:

```text
?calibrationSensors=synthetic&calibrationMedia=demo
```

The page then emits deterministic alternating shake samples and a held
inversion sample, advances the two voice gates and zoom adapter, and keeps the
bundled media source instead of opening a camera permission sheet. Shake
samples are spaced at realistic 120 ms intervals so UI debouncing is
exercised. Both flags are ignored in production.

For desktop containment audits, append one or more manual holds:

```text
&calibrationShake=manual&calibrationZoom=manual&calibrationDrink=manual
```

Each development-only hold disables both the synthetic gesture and that
phase's accessibility timeout. This leaves the requested phase waiting for
real wheel, keyboard, tap, touch, pinch, or motion input. Remove a hold after
auditing that phase so the deterministic sequence can continue. These flags
are inert in production.

## Deterministic story chain

The local state machine owns the complete payoff and never depends on an LLM
response arriving on time:

1. The opening flask waits for a user reply, exits, and reveals the camera.
2. Voice calibration waits for speech; live-camera expression calibration uses
   local `jawOpen` scores and freezes the captured portrait after a sufficient
   held expression.
3. The front-facing toy blaster fires from its muzzle and drops the portrait
   inside the ice cube.
4. Shake attempts add cracks; success or timeout both continue to the same
   authored ice-rain beat.
5. Ice fills the phone-shaped glass. The contained zoom gesture smoothly
   reveals that it is one glass among many on a large red table.
6. The flask returns, tips from its mouth, and pours a highlighted purple
   stream into the user's glass.
7. The view returns to the phone. Physical inversion or a desktop fallback
   rotates the glass, drains the liquid, and carries the ice naturally.
8. Godfrey lands “Okay, all done. Drinking yourself… pretty weird.” before the
   fragment-free black handoff.

Vapi and browser speech only deliver the locked cues. Phase timing, transcripts,
gesture acceptance, visual effects, and fallback completion remain local.

## Runtime fallbacks

- Camera permission pending, denied, or unavailable: the bundled muted
  calibration concept starts immediately so the chamber never goes blank. A
  granted live stream replaces it in place.
- Microphone denied: phase timing and visible controls keep the sequence
  playable.
- Browser speech recognition unavailable: microphone energy is enough to
  advance; the transcript displays `Voice detected. Loud and clear.`
- Live Face Landmarker unavailable, camera denied, reduced motion requested,
  or no qualifying expression held within 10 seconds: the same authored
  “Wider / Wiiider / Perfect” timed guide continues without blocking.
- Vapi unavailable: `SpeechSynthesisUtterance` delivers the same energetic
  locked script. If speech synthesis is also unavailable, captions and timing
  remain authoritative.
- PixiJS unavailable: the DOM fallback retains the frozen portrait and gesture
  controls.

## Cleanup contract

`CalibrationBrowserRuntime.dispose()`, `CalibrationFaceRuntime.dispose()`, and
`DeviceSensorRuntime.dispose()` are idempotent. Before the black handoff
completes they:

- stop all camera and microphone tracks;
- detach the live `MediaStream` from the video;
- cancel speech synthesis and recognition restarts;
- cancel analyzer animation frames;
- disconnect Web Audio nodes and close the `AudioContext`;
- stop Vapi and remove all SDK listeners;
- cancel Face Landmarker sampling, close the MediaPipe task, and release its
  video reference;
- remove motion/orientation listeners and health timers; and
- zero both reactive audio-border levels.

The PixiJS/Matter component separately stops its ticker, disconnects its resize
and visibility observers, clears the Matter world, releases filters and owned
textures, unloads the ice shell, and destroys the Pixi application with global
resource release enabled.

## Manual acceptance pass

1. With no Vapi variables, grant camera/mic. Confirm the opening flask waits
   for a reply, the preview is mirrored, the lower cyan border reacts to
   speech, the guide remains audible, and the transcript advances.
2. Open the mouth gradually and confirm the guide responds to the three local
   expression thresholds, then freezes only after the wide expression is held.
3. Deny camera/mic and confirm `SAFE DEMO MODE` completes the same sequence.
4. On iPhone Safari over HTTPS, grant motion access, shake during the cube
   phase, then hold the phone inverted.
5. On desktop, finish shake, zoom, and drink using wheel/swipe/keyboard. Confirm
   each gesture changes only its contained stage and the document does not
   scroll.
6. Confirm the zoom reveal shows multiple glasses on the red table, the stream
   visibly leaves the flask mouth, the return close-up drains liquid and ice,
   and the final line finishes before the fragment-free black frame.
7. In development synthetic mode, confirm the complete story hands off without
   manual gestures.
8. Navigate away during live camera and confirm the browser camera indicator
   turns off.
