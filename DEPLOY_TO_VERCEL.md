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
open **Settings → Deployment Protection** and set the project protection scope
to **None**. This is a settings change, not a paid feature. Standard Protection
still protects generated preview and branch aliases—including the stable alias
above—so a successful build alone does not make that URL public.

This setting requires access to the `arjmehs-projects/havoc` Vercel project. A
GitHub collaborator who is not also a Vercel project member cannot change it.
The Vercel owner or a member with Deployment Protection permission must make
the change. A Vercel shareable link is a useful temporary review fallback, but
it appends a secret query parameter and therefore does not make the exact base
URL anonymously public.

After changing the setting, verify in a signed-out or incognito browser that
the exact URL returns the Havoc app instead of redirecting to
`vercel.com/sso-api`.

References:

- [Vercel Deployment Protection](https://vercel.com/docs/deployment-protection)
- [Vercel protection bypass methods](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection)

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
