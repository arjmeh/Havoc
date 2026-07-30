# Havoc interactive app prototype

An interactive, responsive mobile-first Havoc prototype built with standard
Next.js and ready for Vercel. The production route renders the app itself;
the former presentation atlas is available only in local development with
`?review=1`.

## Requirements

- Node.js 22
- npm

## Run locally

```bash
npm ci
npm run dev
```

Open `http://localhost:3000` for the app. During local development only,
`http://localhost:3000/?review=1` opens the internal screen atlas.

## Validate

```bash
npm test
```

This runs TypeScript validation and a production Next.js build.

## Production

```bash
npm run build
npm start
```

For Git-connected deployment instructions, see
[`DEPLOY_TO_VERCEL.md`](./DEPLOY_TO_VERCEL.md).

## Main editing files

- `app/page.tsx` — app routing, shared screens, and production presentation
- `app/calibration-lab.tsx` — cinematic live-media calibration
- `app/identity-onboarding.tsx` and `app/friends-onboarding.tsx` — social setup
- `app/globals.css` — design tokens, responsive layout, and motion
- `app/layout.tsx` — page metadata and social preview configuration
- `public/` — favicon and social preview assets

## Runtime

This edition uses standard `next dev`, `next build`, and `next start` commands.
It contains no OpenAI Sites, vinext, Wrangler, Cloudflare Worker, D1, or R2
runtime dependencies.

## Collaboration handoff

- [`AGENTS.md`](./AGENTS.md) — required GitHub issue, branch, worktree, and PR workflow
- [`docs/agent-prompts/`](./docs/agent-prompts/) — reusable prompts for Evan’s and Arjun’s agents
- [`source-assets/`](./source-assets/) — original PRD, visual references, GIFs, and MP4 files
- [`EDITING.md`](./EDITING.md) — project editing guide
- [`DEPLOY_TO_VERCEL.md`](./DEPLOY_TO_VERCEL.md) — deployment instructions

Runtime-ready optimized assets stay in [`public/`](./public/). Preserve the
original files in `source-assets/` so future agents can regenerate or revise
the optimized versions without downloading files from chat history.
