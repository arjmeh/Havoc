# Screen ownership template

Parallel work should be divided by screens or systems, not by vague goals.

## Suggested split

| Owner | Screens |
| --- | --- |
| Agent A | Loading, Welcome, age gate, permissions, calibration |
| Agent B | Home, Daily Havoc, Friends, profile, settings |
| Agent C or later tasks | Join party, create party, lobby, live match, results, highlights, safety |

The current prototype keeps many screens in `app/page.tsx` and shared styling in
`app/globals.css`. Two agents must not edit those files concurrently. Choose one
of these approaches:

1. Work sequentially and hand off an exact base commit.
2. First complete a dedicated refactor that extracts screen components and
   screen-specific styles into independently owned files.

## Issue claim template

```text
Goal:
Design and implement <screens>.

Owner:
<person/agent>

Branch:
agent/<owner>-<issue>-<slug>

Intended paths:
- <path>

Acceptance criteria:
- Matches docs/agent-prompts/02-design-direction.md
- Preserves navigation into and out of the screen
- Phone-width layout has no clipping or horizontal overflow
- Reduced motion remains supported when animation changes
- npm test passes

Dependencies:
- Base commit <sha>
- Depends on / blocks Issue #<number>

Explicit exclusions:
- <screens and paths owned by other agents>
```

## Review rule

One agent may review another agent’s PR, but must not silently add unrelated
design changes to it. Put new ideas in a follow-up Issue.
