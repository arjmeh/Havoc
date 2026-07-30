# Deploy Havoc to Vercel

The project is configured as a standard Next.js application. It does not
require a database or custom build settings. Live Vapi voice is optional and
must use only an existing Vapi balance.

The shared preview branch is:

```text
agent/evan-3-havoc-splash-screen
```

Its stable public alias is:

```text
https://havoc-git-agent-evan-3-havoc-splash-screen-arjmehs-projects.vercel.app/
```

## Validate before deployment

From the repository root:

```bash
npm ci
npm test
```

Both TypeScript validation and the production build must pass.

## Import the repository

1. Sign in to [Vercel](https://vercel.com).
2. Select **Add New… → Project**.
3. Import `arjmeh/Havoc`.
4. Keep these settings:
   - **Framework Preset:** Next.js
   - **Root Directory:** `./`
   - **Build Command:** automatic (`next build`)
   - **Output Directory:** automatic
   - **Install Command:** automatic
   - **Environment Variables:** none required for the complete local fallback
5. Select **Deploy**.

Vercel deploys the production branch, normally `main`, to production. Other
branches and Pull Requests receive preview deployments.

## Public access

The stable branch alias must be anonymously accessible. In the Vercel project,
disable Deployment Protection for this preview without enabling a paid
feature. Verify in a signed-out or incognito browser that the URL returns the
Havoc app instead of redirecting to `vercel.com/sso-api`.

Never enable a paid plan, paid trial, automatic credit purchase, or paid
deployment feature for this prototype.

## Repository ownership

Because `arjmeh/Havoc` is owned by another personal GitHub account, the owner
may need to import it into Vercel and add collaborators to the Vercel project.
Alternatively, transfer the repository to a shared GitHub organization or
deploy a fork owned by the deploying account.

## Troubleshooting

Open the failed deployment's **Build Logs** and confirm:

- Vercel detected **Next.js**.
- The root directory contains `package.json`.
- The build runs `next build`.
- Node.js is set to version 22.
- The deployed branch contains the updated `package-lock.json`.

Reproduce the deployment checks locally with:

```bash
npm ci
npm test
```
