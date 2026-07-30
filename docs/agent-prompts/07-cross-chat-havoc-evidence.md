# Cross-task Havoc prompt evidence

This index records the reusable evidence behind
[`06-successful-prompting-playbook.md`](./06-successful-prompting-playbook.md).
It was built from every Codex task titled `Improve emoji UI design` available
in the Havoc workspace: the original task, tasks 2 through 5, two separate
task-6 conversations, and task 7.

This is not a transcript archive. It excludes account details, local personal
data, raw tool output, and abandoned implementation instructions.

## How evidence is classified

- **Accepted** — Evan explicitly approved the result or asked to preserve it.
- **Shipped** — the result was committed, exercised in the prototype, and
  reported with passing build or deployment checks.
- **Corrective** — the request identifies a real regression and the later
  result resolves it.
- **Rejected** — an intermediate direction that must not be copied into a new
  prompt.

Only accepted, shipped, and resolved corrective patterns become
recommendations. Rejected work appears only as a failure warning.

## Task coverage

| Task history | Main evidence retained | Rejected or superseded directions |
| --- | --- | --- |
| Improve emoji UI design | Emoji-first app atlas, tactile neo-brutalism, splash destruction, welcome hierarchy, product flow, partner handoff, Vercel delivery | Giant unstructured emoji, generic “vibecoded” typography, private-only delivery as the final handoff |
| Improve emoji UI design (2) | Calibration media contract, one-tap audible start, video-to-still handoff, scroll-driven ice interaction, reduced-motion parity, stacked integration | Asking the video generator to create app UI, ice physics, cracking, and shatter inside prerecorded footage |
| Improve emoji UI design (3) | Required-account copy, friend-plus-random positioning, original emoji family, birthday cake/candle source assets | Near-copying vendor emoji, assuming a recolor makes a derivative asset original, geometric sci-fi art that lost the simple emoji silhouette |
| Improve emoji UI design (4) | Rocket/divider wipe, calendar scroll containment, tap-versus-drag separation, smooth seasonal morph, compact generator prompts | A second red wipe line, rocket starting halfway on-screen, black reopening below the wipe, parent input suppression that broke dates |
| Improve emoji UI design (5) | Age picker, cake/candle sequence, seasonal calendar, slot-machine reveal, cannon sweep, physically sourced confetti, optical plaque centering | Double-bounce age cards, exposed cake/slot bases, confetti emitted from the viewport, perfect tiled coverage, hiding the old UI before coverage |
| Improve emoji UI design (6), asset integration | Original controller/joystick/rocket replacement, visible-pixel centering, motion preservation, source/runtime assets, smooth post-rocket entrance | Centering the transparent canvas instead of the visible art, replacing artwork and choreography together, losing the approved flame framing |
| Improve emoji UI design (6), splash/prompt audit | Optical splash placement, loop-seam repair, layer-order cleanup, contact-sheet motion review, final-black enforcement | Synthetic hold frames that stalled the fire, explosion fragments above the black cover, duplicate visible media |
| Improve emoji UI design (7) | Complete fake auth prototype, separate signup/login paths, permissive demo fields, preserved rocket handoff, exact preview-branch promotion | Rebuilding the approved transition, overwriting a newer dependency branch, assuming any Vercel URL automatically follows the new feature branch |

## Evidence that repeatedly produced accepted work

### 1. Start from the product truth and one emotional job

The first successful redesign did not merely ask for “better UI.” It anchored
the work in the PRD, the existing phone scale, and a clear visual direction:
playful emoji content inside a tactile neo-brutalist system.

Later welcome-screen refinements succeeded when the prompt corrected the
product truth:

- Accounts are required, not optional.
- Havoc works for existing friend groups and random matchmaking.
- “Better with friends” belongs in an invite step, not the account-creation
  promise.

Reusable instruction:

```text
State what the player must understand in this screen, what action is required,
and which real product modes the copy must support. Do not let visual style
invent product behavior.
```

### 2. Preserve approved motion while changing artwork

The controller, joystick, and rocket replacements converged only after artwork
and choreography were treated as separate contracts.

Accepted invariants included:

- Controller flame keeps its approved wide, short top-emission shape.
- Joystick begins visually upright and retains the existing tilt cadence.
- Rocket keeps the approved scale, launch path, divider push, vibration, and
  exit.
- Only one animated media instance is visible.

Reusable instruction:

```text
Replace the pixels, not the behavior. Measure the new asset's visible bounds,
recenter those bounds, and make the existing animation consume the new asset
without rewriting the state machine.
```

### 3. Measure visible art, not the transparent rectangle

Several “centered” assets still looked wrong because their transparent padding
was asymmetric. The successful corrections inspected alpha bounds and the
actual optical center.

The same lesson applied to:

- The rocket body inside a larger flame canvas.
- The splash logo inside a transparent GIF.
- Copy inside an off-center gold plaque embedded in source artwork.
- Cake and slot-machine bases that visually stopped above or below their
  nominal boxes.

Reusable acceptance test:

```text
Report the visible alpha bounding box and its center delta from the phone.
Center the subject within half a pixel where practical. Do not prove alignment
using only the CSS container rectangle.
```

### 4. Give motion a causal chain and a clean cover

The strongest Havoc transitions behave like physical events:

- The rocket nose hits the existing coral divider.
- That divider pushes its attached cream surface.
- The surface continuously covers the old page.
- The rocket vibrates during ascent and exits above the phone.
- The next screen enters only after coverage is stable.

Splash destruction followed the same model:

- Tap cue disappears.
- Vibration accelerates without scale growth.
- Letters wait until the aggressive shake is established.
- Controller and flame shatter.
- Black expands above the shards.
- All fragments are gone before the final black frame.

The old UI must not disappear before its replacement has genuinely covered it.

### 5. Diagnose loops from frame timing

The flame became smooth after inspecting the actual frames rather than adding
more easing. The accepted structure was:

1. One-time rise into the high-fire pose.
2. A stable left/right living-fire loop.
3. No return to the low-fire pose.
4. No synthetic hold frames that create a visible pause at the seam.

Frame duration, duplicate frames, first/last pose compatibility, and alpha
edge consistency are all part of loop QA.

For important motion, capture:

- first frame;
- pre-impact frame;
- impact or peak-energy frame;
- coverage frame;
- terminal frame;
- a contact sheet when the defect is hard to localize.

### 6. Make particle motion inherit its source

Confetti looked artificial when it was assigned directly to a viewport grid.
It became convincing when each particle:

- originated at the measured cannon mouth;
- inherited some cannon velocity;
- launched with directional variation;
- responded to gravity and drag;
- rotated and settled irregularly;
- covered the screen with overlaps and small uneven gaps.

The cannon itself started with wide, slow passes, accelerated, swayed with
momentum, and progressively emitted more particles. The slot machine remained
visible until the packed coverage frame.

Reusable instruction:

```text
Define the emitter, inherited velocity, acceleration, drag, gravity, rotation,
coverage threshold, and layer-removal threshold. Do not position particles at
their final destinations and call that physics.
```

### 7. Treat gestures as a state machine

The birthday calendar only became reliable after its inputs were separated:

- Date cells are tap-only.
- Swipes begin on non-date calendar paper.
- Wheel or trackpad input changes one month per gesture.
- Momentum belongs to the same gesture until it settles.
- The calendar owns wheel input only when the pointer is over it.
- The outer prototype page keeps the same scroll position.
- Selecting a date does not trigger browser focus scrolling.
- Inactive seasonal layers stop painting after their fade.

The Calibration Lab used a different gesture contract:

- Wheel input is captured only over the ice stage.
- Tiny deltas are ignored.
- Valid hits are throttled.
- Direction reversal adds extra “break” energy.
- Scrolling elsewhere remains normal.

Prompts must define the gesture boundary, gesture lifetime, state change, and
unlock condition.

### 8. Keep generated footage narrow and app interaction native

The calibration video prompt worked after it was reduced to what a generative
video model should own:

- A stable fictional subject.
- An exact sentence.
- An exact silent period.
- One facial-expression change.
- A held final frame.

The app owns:

- Detection feedback.
- Freeze flash.
- Video-to-still handoff.
- Ice formation and drop.
- Scroll energy.
- Crack layers.
- Shatter.
- Navigation.

This boundary keeps the experience interactive and prevents misspelled
interface text or baked-in effects that cannot respond to the player.

The first audible playback must follow a user gesture. The poster, video, and
frozen still must share the same crop and scale so the handoff does not jump.

### 9. Prototype truth must be explicit

The fake auth flow succeeded because the prompt stated that it was a complete
interactive prototype, not production authentication:

- Signup and login are separate visible paths.
- Google, Apple, phone, and email are represented.
- Phone demonstrates identity, password, and verification states.
- Blank fields may advance because validation is deliberately fake.
- Every route returns to the existing onboarding flow.
- No account, persistence, or backend behavior is implied.

Prompts should state which controls are simulated and what their deterministic
destination is.

### 10. Integration targets are part of the requirement

Several features were correct locally but absent from the link Evan was
testing. The reason was branch-to-preview mapping, not UI code.

Successful integration followed this order:

1. Identify the exact branch powering the requested URL.
2. Fetch and inspect whether it advanced.
3. Merge or rebase the latest dependency into the feature branch.
4. Resolve only real overlaps.
5. Run the full build and interaction path again.
6. Merge the feature into the preview branch without discarding newer work.
7. Wait for the exact Vercel deployment to become ready.
8. Verify that URL, not a different branch preview.

“Push it” is incomplete unless the target branch and target preview are named.

## Prompt fragments worth reusing

### Optical alignment

```text
The container may be mathematically centered while the visible artwork is not.
Measure the non-transparent subject bounds and center those bounds in the phone.
Preserve the approved scale and animation.
```

### Transition coverage

```text
Keep the outgoing screen fully visible until the incoming particles/surface
have covered it. Remove the old layer only after the coverage threshold is
reached. The next clean screen appears only after every fragment exits.
```

### Loop repair

```text
Let the flame rise once. After it reaches the high pose, loop only the stable
left/right fire motion. Inspect frame durations and remove duplicate or hold
frames that create a pause at the seam.
```

### Input containment

```text
While the pointer is over the calendar, one wheel/trackpad gesture changes one
month and the surrounding page keeps the same scroll position. Date buttons
remain tap-only. Unlock month navigation only after momentum settles.
```

### Generated media boundary

```text
The video owns only the person, speech, and held expression. The app owns all
interface, freeze, ice, cracks, shatter, and navigation. Start audible playback
from one user tap and crossfade to a crop-matched still with no jump.
```

### Shared preview handoff

```text
Integrate this onto the latest tip of the branch powering [exact URL]. Preserve
every newer commit already there. Re-run the complete flow, wait for that
deployment to report Ready, and verify the exact URL before reporting success.
```

## What not to learn from the history

- Do not interpret a first implementation as accepted merely because it was
  committed.
- Do not preserve an intermediate direction that Evan immediately rejected.
- Do not treat profanity or frustration as a style request; extract the
  concrete regression underneath it.
- Do not copy proprietary vendor emoji or produce a near-copy designed to
  evade review. A recolor is not a structural redesign.
- Do not bake responsive interaction into generated video.
- Do not use a synthetic DOM state change as proof of a real pointer, wheel,
  touch, media, or audio interaction.
- Do not report a deployment as complete until the requested URL serves the
  expected branch.

## Adding future evidence

When a new Havoc task produces a useful pattern:

1. Record the user-visible problem.
2. Record the final accepted invariants and behavior.
3. Record the measurable validation that proved it.
4. Record rejected intermediate versions only as failure warnings.
5. Generalize the lesson without copying account details, local paths, or
   one-off implementation noise.
6. Update the playbook only when the result is accepted or demonstrably stable.
