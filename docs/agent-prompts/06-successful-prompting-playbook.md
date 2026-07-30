# Successful prompting playbook

This playbook distills the prompt patterns that repeatedly produced accepted
Havoc designs, motion, assets, copy, and interactions. It is not a raw chat
transcript. It gives Evan’s and Arjun’s agents reusable instructions for
reaching the intended result with fewer accidental changes.

Use this together with:

- [`01-shared-github-workflow.md`](./01-shared-github-workflow.md) for agent
  coordination.
- [`02-design-direction.md`](./02-design-direction.md) for the visual system.
- [`03-onboarding-motion-brief.md`](./03-onboarding-motion-brief.md) for
  accepted onboarding behavior.
- [`05-prompt-history.md`](./05-prompt-history.md) for product decisions that
  should not be rediscovered.

## The prompt formula that works

The most successful Havoc prompts contain seven parts:

1. **One outcome** — state the single result this task must produce.
2. **Reference state** — name the existing screen, asset, commit, or behavior
   that the agent must inspect before changing anything.
3. **Locked invariants** — list everything that is already right and must not
   move, resize, disappear, or be redesigned.
4. **Exact change** — describe the new behavior as a physical or visual event,
   not as a vague feeling.
5. **Timing or states** — define the order, trigger, duration, and final state
   when motion or interaction is involved.
6. **Failure list** — explicitly name the artifacts, regressions, and unwanted
   interpretations to prevent.
7. **Observable acceptance tests** — describe what the agent must click,
   swipe, resize, or inspect before publishing.

Use this compact structure:

```text
Outcome:
Make <one result>.

Inspect first:
- <current screen, asset, code path, or base commit>

Keep exactly:
- <invariant>
- <invariant>

Change only:
- <specific visual or behavioral change>

Sequence:
1. <trigger and first state>
2. <next physical event>
3. <terminal state>

Do not:
- <known failure>
- <regression to prevent>

Verify:
- <phone-size visual check>
- <real interaction check>
- npm test
```

## Accepted Havoc prompt patterns

These are the practical patterns behind iterations Evan approved:

| Accepted result | Prompt detail that unlocked it | Why it worked |
| --- | --- | --- |
| Controller-and-fire logo | Use the exact controller/fire references; fire comes only from the top; make it wider, shorter, and shaped to the controller | Locked the source style and described geometry instead of asking for a generic logo |
| Splash destruction | Controller never grows; vibration accelerates; letters fall after the aggressive shake; final frame is fully black | Separated invariants, relative timing, and the terminal frame |
| Welcome hierarchy | Reduce the oversized emoji; return to the established design skill; make required-account copy useful for real players | Named the hierarchy problem and the product truth instead of requesting abstract polish |
| Rocket wipe | Rocket nose hits the existing divider and pushes the attached next-page surface upward | Described physical cause, layer relationship, and continuous coverage |
| Calendar input | Calendar owns wheel input; one gesture changes one month; the outer page stays fixed; date taps still work | Defined the input boundary, gesture unit, and regression tests |
| Seasonal morph | Sky, falling effects, and ground transition together without remount flicker | Treated several visual layers as one environment state |
| Asset replacement | Use the new rocket, but keep the exact transition behavior | Changed one variable and froze every accepted interaction |
| Camera-calibration media | Exact timestamps, exact spoken sentence, explicit silence, locked framing, and exact final expression | Turned a creative video request into a state-and-audio contract |
| Small UI cleanup | Remove the green season pill and its dead CSS; keep all environmental and calendar behavior | Prevented a tiny request from becoming an unnecessary redesign |

## Rules learned from successful iterations

### 1. Lock what is already right

“Make this better” gives an agent permission to redesign everything. A better
prompt says which variable may change and freezes the rest.

Successful pattern:

```text
Replace only the rocket artwork. Keep the existing launch timing, divider
push, vibration, scale, mask, and age-screen handoff exactly the same.
```

Use explicit invariants such as:

- The controller does not grow; it only vibrates faster.
- The flame moves internally but changes size only minimally.
- The person, camera distance, framing, lighting, and background remain fixed.
- Date selection and Confirm behavior must survive calendar gesture changes.
- The existing coral divider is pushed; do not introduce a second red line.
- The cream wipe remains attached to the divider so black cannot reopen below
  it.

### 2. Describe physical cause and effect

Havoc motion became convincing when prompts described what causes each event.

Weak:

```text
Make a cool rocket transition.
```

Strong:

```text
Start the rocket fully below the phone. Its nose reaches the existing coral
divider, pauses for only a brief impact beat, then physically pushes that same
divider upward. The attached cream surface covers the old screen continuously.
The rocket vibrates harder during ascent and exits completely above the phone.
```

Use verbs such as **hits, pushes, drags, covers, breaks through, falls, settles,
locks, peels, flips,** and **exits**. These create spatial continuity and help
the implementation choose the correct layer ownership.

### 3. Give motion a clock

When timing matters, write beats instead of adjectives.

```text
0.0–0.2s: remove the tap cue.
0.2–0.9s: accelerate vibration from subtle to aggressive.
0.9–1.6s: begin the crumble after the aggressive shake is established.
1.6–2.0s: shatter and seal the frame to black.
Final frame: completely black with no fragment, glow, or shadow.
```

For follow-ups, move one beat at a time:

```text
Keep the full sequence unchanged. Start the aggressive shake earlier. Delay
the letter fall until 0.7 seconds after that shake begins. Remove every
fragment before the black frame.
```

This is more reliable than asking for the whole animation to feel “faster.”

### 4. State the terminal frame

The final state prevents leftover shards, gaps, half-finished expressions, and
transitions that visibly reset.

Examples:

- “The final frame is completely black.”
- “The rocket and entire flame exit above the phone before Age appears.”
- “One month is settled, no flip layer remains, and the selected date is still
  tappable.”
- “The final video frame shows the silent open-mouth expression.”
- “After the seasonal morph, only the new environment is visibly painted.”

### 5. Turn visual complaints into measurable corrections

Translate “it feels off” into position, scale, relationship, or timing.

```text
The rocket begins too high. Move the entire asset below the phone at rest, not
just the visible body. Keep the complete flame tip inside its source canvas.
```

```text
The joystick is visually dominant. Reduce it until the heading and account CTA
are the first two hierarchy levels. Keep the same art and animation.
```

```text
The season pill is unnecessary. Remove only the green label and its dead CSS.
Keep the seasonal sky, particles, ground art, gestures, and date selection.
```

Avoid requests such as “fix the scale” without naming what should become more
or less prominent.

### 6. Test behavior, not just appearance

Interaction prompts should name the actual input and the state that must not
change.

Successful calendar acceptance tests:

- A date tap selects the day and enables Confirm.
- A swipe beginning on blank calendar paper changes one month.
- One continuous wheel or trackpad gesture changes exactly one month.
- A new gesture can change the next month.
- The surrounding atlas page keeps the same scroll position.
- Rapid reverse navigation does not stack or flash animation layers.
- Reduced motion reaches the same settled state without decorative movement.

When reporting a bug, include:

```text
Input:
<mouse wheel, trackpad, touch drag, keyboard, or tap>

Expected:
<one observable state change>

Actual:
<what changes, flickers, scrolls, or stops responding>

Must preserve:
<working behavior that cannot regress>
```

### 7. Separate asset motion from page motion

For media-driven UI, assign one owner to each kind of movement:

- The GIF, WebP, or video owns only internal movement such as fire, a joystick
  tilt, facial motion, or exhaust.
- CSS or application state owns travel through the screen, masks, shakes,
  wipes, and page transitions.

This prevents doubled images and competing transforms.

Prompt pattern:

```text
Use the supplied animated asset as the only visible rocket. Its media frames
own the flame animation. CSS owns ascent and vibration. Do not layer a static
rocket under the animated one and do not animate page travel inside the media.
```

Always request:

- Editable originals in `source-assets/`.
- Optimized transparent runtime assets in `public/`.
- A reproducible conversion step when cropping or background removal is
  required.
- Visual inspection of transparent edges and first/final frames.

### 8. Write copy for the real product mode

Havoc serves friend groups **and** random matchmaking. Copy should not assume
the player already knows everyone.

Use:

```text
Write short, high-converting copy for a camera-driven party game that works
for friend groups and random matchmaking. Lead with the immediate payoff, not
the feature list. Keep one heading, one supporting sentence, and one dominant
CTA. Avoid claims that every player is already a friend.
```

Strong copy is:

- Direct rather than explanatory.
- Specific to play, reactions, highlights, progress, or wins.
- Short enough to preserve visual hierarchy inside a phone.
- Honest about required account or permission steps.

### 9. Refine one variable per follow-up

The cleanest iterations changed one dimension at a time:

1. Position.
2. Scale.
3. Timing.
4. Loop smoothness.
5. Edge cleanup.
6. Copy.

Do not combine a new art direction, new copy, new interaction model, and new
motion sequence into a single “polish” follow-up. If all are required, define
them as separately reviewable states.

### 10. Make the agent prove completion

End implementation prompts with evidence requirements:

```text
Before publishing:
- Run npm test.
- Review at 375px and landscape.
- Perform the real tap/swipe/wheel sequence.
- Confirm no horizontal overflow or outer-page scroll leak.
- Check browser warnings and errors.
- Capture the accepted state for the PR.
- Report branch, commit, PR, and deployment status.
```

## Copy-ready prompt templates

Replace bracketed text and delete sections that do not apply.

### Template A — new mobile screen

```text
Design and implement the [screen] for Havoc.

Read AGENTS.md and docs/agent-prompts/02-design-direction.md first. Inspect the
screens immediately before and after it.

Emotional job:
[What the player should understand or feel in one beat.]

Primary action:
[One dominant CTA.]

Required content:
- [Content]
- [Content]

Keep consistent:
- Existing phone scale, safe areas, type, outlines, shadows, and color roles.
- Emoji are expressive game content, not structural navigation.
- Copy works for friend groups and random matchmaking where relevant.

Do not:
- Add generic SaaS cards, competing CTAs, decorative gradients, or filler copy.
- Redesign adjacent screens.

Verify at 375px and landscape, exercise every control, check reduced motion,
run npm test, and publish a screenshot in the draft PR.
```

### Template B — surgical visual refinement

```text
Refine only [element] on [screen].

Current problem:
[Describe the visible position, size, hierarchy, crop, gap, or artifact.]

Change:
[One measurable correction.]

Keep exactly:
- [Working layout]
- [Existing behavior]
- [Asset, copy, timing, or surrounding elements]

Do not introduce:
- [Known regression]
- [Unrelated redesign]

Compare before and after at the same viewport. Test the surrounding
interaction, run npm test, and stage only the intended paths.
```

### Template C — motion sequence

```text
Implement this [duration] transition as one continuous cause-and-effect
sequence.

Trigger:
[Tap, confirmation, settled gesture, or automatic handoff.]

Timeline:
- [time]: [state/event]
- [time]: [state/event]
- [time]: [state/event]

Layer ownership:
- [Media asset] owns [internal motion].
- CSS/app state owns [travel, mask, shake, wipe, or page state].

Locked invariants:
- No unintended scale change.
- Framing and surrounding layout remain fixed unless explicitly timed above.

Terminal state:
[Exact final frame and next mounted screen.]

Do not:
- Duplicate animated layers.
- Leave fragments, gaps, flashes, shadows, or old-screen pixels.
- restart or visibly cut an animation loop.

Include a reduced-motion path. Audit the trigger, midpoint, terminal frame, and
next screen before publishing.
```

### Template D — replace an asset without changing behavior

```text
Replace [old asset] with the supplied [new asset].

Change only the artwork. Preserve the existing:
- dimensions and visual hierarchy;
- interaction and state machine;
- travel path, vibration, timing, mask, and handoff;
- accessibility behavior and reduced-motion path.

Use one visible instance of the new asset. Keep the editable original in
source-assets and generate an optimized runtime version in public. Remove the
background cleanly, preserve the full subject at every frame, and inspect
transparent edges. Verify the complete live sequence, not only a still image.
```

### Template E — gesture or scrolling fix

```text
Fix [gesture] on [screen].

Reproduction:
1. [Starting state]
2. [Exact input]
3. [Observed failure]

Expected:
- One gesture produces [one result].
- [Target region] owns the input.
- [Outer page/adjacent control] does not move or activate.
- A new gesture works after the first settles.

Preserve:
- Normal taps on [controls].
- Keyboard/accessibility alternative.
- Existing animation and selected state.

Test real pointer/touch input, momentum, reversal, rapid input, and page scroll
position. Do not declare completion from synthetic state changes alone.
```

### Template F — generated image or video

```text
Create [duration/format] using [reference or generated subject].

Preserve exactly:
- identity, clothing, lighting, background, camera distance, and framing;
- [other invariants].

Timeline:
- [time]: [action]
- [time]: [action]
- Final frame: [exact expression/composition]

Audio:
[Exact spoken words and exact silent periods.]

The only allowed camera movement is [movement and time range]. After that,
lock framing and scale.

Do not:
- add people, hands, text, logos, cuts, zoom, or camera shake;
- distort eyes, lips, teeth, jaw, hands, or the reference identity;
- begin the final-frame transition earlier than specified.

Keep the prompt below the generator’s character limit. If a start or end frame
is supplied, explicitly describe how and when the video must match it.
```

### Template G — copy refinement

```text
Rewrite only the [heading/supporting sentence/CTA] on [screen].

Product truth:
[Required account, friend + random modes, permission reason, or other fact.]

Desired response:
[What the player should understand or do.]

Constraints:
- Heading: [maximum length or line count].
- Support: one sentence.
- CTA: one direct action.
- Preserve layout, animation, and all other copy.
- Avoid vague hype, feature lists, and assumptions that players are friends.

Provide the strongest recommendation in context, then implement only the
approved copy.
```

### Template H — agent handoff

```text
Work on Issue #[number] using AGENTS.md.

Base commit: [sha]
Branch: agent/[owner]-[issue]-[outcome]
Owned screens: [screens]
Owned paths: [paths]
Dependencies: [issues/commits]
Explicit exclusions: [other active screens and paths]

Acceptance criteria:
- [observable result]
- [interaction result]
- npm test and phone-width visual audit pass

Do not modify another task’s paths. Post the exact branch, commit, PR, changed
paths, tests, and safe handoff base on the Issue. Keep the PR draft until Evan
or Arjun explicitly approves a merge.
```

## Frequent failure modes and the correction

| Failure | Why it happens | Prompt correction |
| --- | --- | --- |
| Output looks “vibecoded” | Style is requested without hierarchy or constraints | Name the established screen system, one emotional job, one CTA, and forbidden generic patterns |
| Asset appears twice | Static and animated layers both render | Assign one visible asset and separate media motion from CSS motion |
| Object starts or ends cropped | Prompt describes the body but not its full source canvas | Require the entire asset, including flame or shadow, below/above the frame at start and finish |
| Animation feels slow | “Faster” does not identify the dead beat | Give timestamps and shorten the specific pause |
| Letters or fragments fall too early | Events are timed from the wrong trigger | Define delay relative to the aggressive shake or impact event |
| Loop visibly snaps | First and last frames do not form a continuous phase | Request a one-time rise followed by a stable loop, or build a forward/reverse bridge |
| Page reveals black beneath a wipe | Mask and surface are not physically attached | State that the divider pushes the attached next-page surface continuously past the bottom edge |
| Calendar swipe is inconsistent | Momentum events are treated as separate gestures | Normalize deltas, group momentum, allow one result per gesture, then unlock after settling |
| Date taps stop working | Parent drag/click suppression captures buttons | Declare dates tap-only and start pointer capture only after a real drag threshold |
| Rapid navigation flickers | Transition components remount or stack | Keep one active transition layer and reverse/update its state instead of stacking players |
| Copy assumes existing friends | Product mode was underspecified | State that both friend parties and random matchmaking are core modes |
| Agent work overlaps | Ownership is described as a broad goal | Claim exact screens and paths in an Issue and use an isolated worktree |
| Generated media violates the ending | The final frame is not explicit | Describe the exact final frame and when the transition into it may begin |

## Review questions before saying “done”

Ask these in order:

1. Did the agent change only the requested variable?
2. Is every previously accepted invariant still true?
3. Does the screen have one obvious next action?
4. Does motion have a visible cause, a short response, and a clean terminal
   state?
5. Can a real user tap, swipe, scroll, reverse, and repeat the interaction
   without leaking input to the surrounding page?
6. Are source and runtime assets both preserved appropriately?
7. Were the exact phone layout, reduced-motion path, browser logs, and
   production build checked?
8. Did the agent publish a traceable Issue, branch, commit, PR, and handoff?

If any answer is “no,” the task is not ready to merge.
