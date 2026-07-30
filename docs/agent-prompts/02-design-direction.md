# Havoc design direction

## Product promise

Havoc turns a friend group or a random matchmaking queue into fast,
camera-driven party games. The product must work for people who already know
each other and people who want to find a match.

## Established visual language

- Style: playful neo-brutalism with cinematic dark onboarding.
- Core surfaces: near-black upper stage and warm cream content surface.
- Primary action: acid lime with a heavy black border and hard shadow.
- Transition accent: coral-red diagonal divider.
- Supporting accents: violet, cyan, blue, and yellow only when they communicate
  game identity or state.
- Typography: compact, bold, high-contrast sans serif with tight display
  tracking and restrained body copy.
- Corners: large rounded phone-safe cards and controls.
- Emoji: expressive prompts, players, reactions, and game content. Use vector
  icons or text labels for structural controls.
- Motion: physical cause and effect, spatial continuity, fast feedback, and no
  decorative movement without a product purpose.

## Current key colors

```css
--ink: #0b0911;
--paper: #f6f1e8;
--lime: #c7ff32;
--violet: #7c3aed;
--coral: #ff5d6c;
--cyan: #2ee7d1;
--yellow: #ffd338;
```

## Reusable design prompt

```text
Design or refine this Havoc mobile screen using the established playful
neo-brutalist system. Preserve the near-black/cream split, acid-lime primary
action, coral transition accent, heavy black outlines, compact bold type, and
large rounded mobile-safe controls. Emoji should act as expressive game
content, not generic navigation chrome.

Give the screen one emotional job and one dominant next action. Copy must be
short, direct, and specific to camera-driven social games. Account for both
friend parties and random matchmaking where relevant. Respect phone safe
areas, 44px touch targets, reduced motion, and readable contrast.

Inspect adjacent screens before editing so layout, scale, motion, and wording
remain consistent. Run npm test and provide a phone-width screenshot in the PR.
```

## Avoid

- Generic SaaS cards or dashboard styling.
- Oversized marketing-page headlines inside the phone.
- Random gradients, glows, or emoji with no interaction meaning.
- Multiple competing CTAs.
- Movement that scales the controller or rocket unintentionally.
- Separate animated layers that duplicate the same physical movement.
