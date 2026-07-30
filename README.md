# Havoc interactive prototype

An interactive, responsive 21-screen product prototype for Havoc, built with
standard Next.js and ready for Vercel.

## Requirements

- Node.js 22
- npm

## Run locally

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`.

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

- `app/page.tsx` — screens, navigation, state, copy, and interactions
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
