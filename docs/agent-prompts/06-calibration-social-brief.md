# Calibration, identity, and friends handoff

This brief records the accepted post-permissions experience and the prompt
patterns that produced the strongest Havoc work. It is implementation guidance,
not a raw transcript.

## Product goal

Turn device setup into a surprising, playable first encounter with Havoc.
Camera, microphone, motion, and orientation checks should feel like one
continuous joke with physical cause and effect—not a settings checklist.

The complete onboarding route is:

```text
Splash → Welcome → account → age → birthday → permissions → Calibration Lab
→ username/avatar → friends/invite → Home
```

Production and mobile previews render only the app. The internal screen atlas,
page selector, and previous/next controls are development-only behind
`?review=1`.

## Reusable Calibration Lab implementation prompt

```text
Build the Havoc Calibration Lab as a deterministic, mobile-first interactive
sequence. Preserve the established cream, black, lime, violet, cyan, and coral
neo-brutalist system. The media chamber is the stage; its border must hug the
container exactly and become an audio waveform for both user and agent speech.

Use the live front camera and microphone when permission is granted. Keep a
privacy-safe bundled demo and local browser-speech fallback so the complete
experience remains playable when media, speech recognition, Vapi, or sensors
are unavailable. Vapi is an optional enhancement configured only with public
environment variables and existing credits. Never commit a key or purchase,
upgrade, trial, or auto-recharge anything.

Sequence:
1. The flask waits inside the chamber. On tap the energetic guide asks,
   “Hey—can you hear me?”
2. Once voice is detected, the flask exits, the live camera replaces it, and
   the guide says, “Oh, there you are. Let’s do a ridiculously quick
   calibration.”
3. Ask for the first thing that comes to mind. Render a live transcript and
   celebrate with “Heck yeah. Havoc can hear you.”
4. Ask the player to open their mouth, then cue “Wider. Wiiider! Perfect.”
   Freeze the captured frame.
5. Warn about one movement test. Fire a visible freeze beam from the gun’s
   front/muzzle, freeze the portrait into a cube, and drop it with believable
   weight. Let the surrounding letters fall completely away while the cube
   remains.
6. Ask the player to crack the cube by shaking. Physical motion, alternating
   swipe/wheel/keys, and an accessible tap fallback must all work without
   scrolling the document. Escalate the guide’s encouragement for several
   seconds.
7. When it refuses to break, drop many ice cubes into the chamber so the phone
   is revealed to be a glass. Ask, “Zoom out for me, would ya?” Use contained
   pinch, wheel, drag, keyboard, and accessible controls to reveal this glass
   among many colored glasses on a large red table.
8. The flask returns, says “Let’s get a drink,” and visibly pours polished
   purple liquid into the player’s glass. Liquid must have a continuous stream,
   volume, contact, pooling, highlights, and natural gravity—not a flat mask.
9. Return smoothly to the phone/glass view. Ask the player to flip the phone
   upside down and drink the secret juice. Physical orientation and desktop
   fallbacks drain liquid and ice naturally.
10. Seal to a fragment-free black frame while the guide lands the joke:
    “Okay, all done. Drinking yourself… pretty weird.”

Use one authoritative phase machine, idempotent cleanup, reduced-motion
alternatives, and deterministic development inputs. Stop camera/microphone
tracks, speech, Vapi listeners, sensors, animation frames, and GPU resources
before leaving the screen. Run the production build and audit the complete
sequence at 300px, 375×812, and landscape.
```

## Voice and sensor rules

- Energetic, playful delivery; Godfrey New V2 or the closest available voice
  when an existing Vapi assistant is configured.
- Browser speech synthesis, speech recognition, microphone energy, captions,
  and phase timing are the zero-cost authoritative fallback.
- Start Safari motion/orientation permission requests synchronously inside the
  initial tap. Do not place an `await` before those requests.
- Camera/microphone require HTTPS outside localhost.
- Every physical gesture needs a desktop and accessible equivalent.
- Gesture controls are contained: they must prevent document scrolling only
  while the active interaction owns that input.
- Never infer expression identity or emotion. For the prototype, “open mouth”
  is a simple interaction gate and the captured frame stays local.

## Identity screen prompt

```text
Create a single-focus Havoc identity screen after calibration. Let the player
choose a 3–16 character lowercase username and an expressive emoji avatar.
Show a short fake availability check and the exact positive state “This
username is available.” Keep the avatar pencil obvious.

The picker should cover the full Unicode face-expression catalog in original
Havoc-styled artwork. Standard avatars are selectable. A small intentional set
of exclusive variants is blurred inside its own circle and has a crisp lock
overlay; locked artwork must never become selectable. Preserve focus trapping,
focus return, keyboard use, session persistence, 44px targets, safe areas, and
reduced motion.
```

## Friends screen prompt

```text
Follow identity with “Havoc is better with friends.” Use the supplied muted,
looping transparent three-emoji animation as the page icon, with a static
reduced-motion poster. Offer two clear routes: search for friends now, or enter
an invite code with the honest prototype reward message “You’ll both be
rewarded.”

Search, add, invite success, skip, and Continue must work locally even though
there is no backend. Keep one dominant action per state and continue to Home.
```

## Prompt patterns that produced accepted results

1. **State the physical rule.** “The rocket nose pushes the existing divider”
   is more actionable than “make the transition cool.”
2. **Lock invariants explicitly.** Call out what must not scale, move, flicker,
   duplicate, clip, or remain on the final frame.
3. **Describe time as cause and effect.** Say what triggers each beat, what
   overlaps, and what must finish before the next page appears.
4. **Name the exact assets.** Separate internal media animation from CSS page
   movement and preserve editable sources.
5. **Give a terminal frame.** Specify the exact visual state that must remain
   after motion ends.
6. **Provide real fallback behavior.** Do not describe unsupported hardware as
   unavailable; define touch, wheel, keyboard, synthetic, and reduced-motion
   equivalents.
7. **Define proof, not taste.** Require phone sizes, interaction steps, overflow
   checks, console checks, and `npm test`.
8. **Use direct copy.** Preserve approved lines verbatim and keep helper copy
   short enough to fit the phone.
9. **Keep scope visible.** State which screen, files, and downstream handoff the
   task owns so parallel agents do not silently overlap.
10. **Reject almost-right behavior.** Fix cropped flames, off-by-one gesture
    steps, loop seams, stray fragments, detached borders, and page scrolling
    before calling the work complete.

## Acceptance checklist

- The complete route reaches Home without the development atlas.
- No side page buttons or debug controls appear in production/mobile.
- Camera/mic denial still produces a fully playable local sequence.
- Live media and sensors stop when Calibration exits.
- User and agent audio visibly animate the chamber border.
- Freeze beam originates at the muzzle/front.
- Letters leave the frame while the frozen cube remains.
- Shake, zoom, and drink gestures do not scroll the page.
- Safari motion is requested from the initial user gesture; desktop fallbacks
  are visible and reliable.
- Purple liquid visibly pours, pools, and drains.
- Black handoff has no fragment, shadow, or one-frame flash.
- Username availability, avatar locks, search, invite, skip, and Home handoff
  work locally.
- All primary controls are at least 44px, safe-area aware, keyboard reachable,
  contrast-safe, and reduced-motion compatible.
- `npm test` and phone/landscape browser QA pass with no console errors.
- Runtime assets are in `public/`; editable originals and provenance stay in
  `source-assets/` or `docs/`.
