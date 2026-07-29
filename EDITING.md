# Editing the Havoc prototype

This is the editable source for the interactive Havoc app-layout prototype.

## Run it locally

Install Node.js 22, then run:

```bash
npm ci
npm run dev
```

Open the local URL printed in the terminal.

## Main files

- `app/page.tsx` — screens, copy, navigation, and interactions
- `app/globals.css` — colors, typography, layout, motion, and responsive styles
- `public/` — image and icon assets

## Verify changes

```bash
npm test
```

`npm test` runs TypeScript validation and the same production Next.js build
used by Vercel.

The original design direction is emoji-first Gen Z neo-brutalism: controlled
chaos, tactile outlines and shadows, warm social screens, dark live-gameplay
screens, and emoji used as expressive content rather than unlabeled controls.
