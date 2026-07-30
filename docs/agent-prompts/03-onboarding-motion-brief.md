# Onboarding motion brief

This document records the accepted behavior for the loading, Welcome, and
rocket handoff sequence.

## Splash screen

```text
Start on a clean white screen with the approved controller-and-fire artwork,
HAVOC wordmark, tagline, and Tap to start.

On tap:
- Fade Tap to start immediately.
- Vibrate the controller slowly, then progressively faster and more aggressive.
- Do not grow or scale the controller.
- Keep the flame alive and moving with only minimal size change.
- Begin the HAVOC crumble roughly 0.7 seconds after the aggressive shake starts.
- Let individual letter pieces fall, then shatter the controller/fire mark.
- Blend the explosion into a completely sealed black frame with no remaining
  fragments, shadows, or gaps.
- Automatically continue to Welcome after the black hold.

Reduced motion should use a short fade to black and continue without shake,
crumble, or explosion.
```

## Welcome screen

```text
Use a cinematic black upper stage with the animated joystick, concise required
account copy, and a diagonal coral divider into a warm cream action surface.

Heading: Set up your account.
Supporting copy: You’ll need an account to continue—and to keep your progress,
highlights, and wins.

Primary action: Get started with a static rocket cue.
Secondary action: I already have an account.

Keep the joystick supportive rather than dominant. Preserve the neo-brutalist
lime CTA and subordinate underlined login action.
```

## Rocket page transition

```text
When Get started is pressed:
- Lock both actions and briefly shake the complete screen.
- Start the entire rocket below the phone.
- Use the supplied animated flame frames while CSS owns the rocket’s page
  movement.
- Bring the rocket nose into contact with the existing coral divider.
- Keep the contact beat very short, then let the rocket physically push that
  exact divider upward.
- The attached cream surface must cover the old screen continuously and remain
  beyond the bottom edge so black never reopens.
- Escalate rocket vibration during ascent without scaling it.
- Let the rocket break through and exit completely above the phone.
- Only then mount the account-method screen.
- Keep the complete flame tip visible; no source-canvas or phone-edge cutoff.

Reduced motion should hide the rocket and crossfade the cream surface in about
200ms.
```

## Runtime assets

- Splash intro: `public/havoc-controller-fire-intro-v6.gif`
- Splash loop: `public/havoc-controller-fire-loop-v8.gif`
- Splash shatter: `public/havoc-controller-fire-shatter.png`
- Welcome joystick: `public/havoc-joystick-transparent.webp`
- Rocket animation: `public/havoc-rocket-flame-launch.webp`
- Editable originals: `source-assets/motion/`
