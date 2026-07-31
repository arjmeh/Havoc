# Prompt history and accepted decisions

This is a concise history of the briefs used to reach the current design. It is
not a raw chat transcript.

## Product UI

- Replace the original dense dark UI sheet with an engaging, emoji-oriented
  interactive app prototype based on the PRD.
- Cover the main app pages rather than only a six-screen concept.
- Keep every screen visually related and Vercel-compatible.
- Support friend groups and random matchmaking.

## Collaboration

- Split work by important pages so both owners can work simultaneously.
- Use the same design direction and scale across every screen.
- Coordinate through Issues and PRs with named branches and task titles.
- Avoid token-locking systems; use simple screen ownership and handoff commits.

## Logo and splash

- Build the mark from the approved controller and Apple-style fire references.
- Fire comes only from the top of the controller in the static logo.
- Use a wider, shorter flame shaped to the controller.
- Splash begins white and displays the controller/fire mark, HAVOC, tagline,
  and Tap to start.
- Tap begins an accelerating no-scale vibration, animated flame, delayed HAVOC
  crumble, shatter, and full black takeover.
- Remove every fragment before the black terminal frame.

## Welcome and account

- Automatically move from the black splash frame into Welcome.
- Use the supplied animated joystick at a restrained scale.
- Make account creation a required gate while keeping the existing-account
  path.
- Final copy: Set up your account. You’ll need an account to continue—and to
  keep your progress, highlights, and wins.
- Use the black upper stage, coral diagonal divider, cream action surface, and
  lime neo-brutalist Get started CTA.

## Rocket handoff

- Get started shakes the screen and launches the supplied rocket from below.
- The rocket nose contacts and pushes the existing divider rather than dragging
  an unrelated line.
- The cream surface covers the old screen and cannot expose black at the bottom.
- The impact pause is brief.
- The rocket vibrates, keeps animated exhaust, and exits fully above the phone.
- The complete flame tip must remain visible.
- The account-method screen appears only after the wipe is complete.

## Source and implementation decisions

- Original media is archived in `source-assets/`.
- Optimized transparent runtime media lives in `public/`.
- CSS controls page movement; media assets control only their internal motion.
- Reduced motion removes shake, crumble, rocket travel, and unnecessary loops.
- `npm test` and a phone-width visual review are required before publishing.

## Live calibration

- Replace the prerecorded-only concept with a real front-camera and microphone
  path while preserving a complete local fallback.
- Use an energetic guide, live transcript, open-mouth interaction, freeze gun,
  frozen portrait cube, physical shake, glass reveal, table zoom-out, purple
  pour, orientation/drink interaction, and black handoff as one continuous
  joke.
- User and guide audio animate a waveform border that precisely follows the
  media chamber.
- Safari motion permission starts inside the initiating tap. Desktop users get
  contained wheel, swipe, keyboard, and tap alternatives.
- Vapi may use only an existing balance. No purchase, plan change, trial, or
  automatic recharge is allowed.

## Identity and friends

- After calibration, let the player choose a fake-available username and an
  original Havoc-styled face avatar.
- Cover the broad Unicode face-expression set. Blur and lock a small group of
  exclusive variants.
- Follow with “Havoc is better with friends,” a muted three-emoji animation,
  local friend search, invite-code reward copy, skip, and Home handoff.

## Production presentation

- Mobile and production previews show only the app.
- The page atlas, side page buttons, device frame, and global previous/next
  controls are local development tools available only with `?review=1`.
- The stable Vercel branch alias must be anonymously accessible and must never
  require Vercel login.
