# Shared GitHub workflow prompt

Copy this prompt into both agents:

```text
Use the repository’s AGENTS.md workflow for every Havoc task.

GitHub Issues and Pull Requests are the communication layer between agents:
- One Issue per independently reviewable task.
- Claim the Issue before editing with owner, branch, paths, dependencies, and
  acceptance criteria.
- Use a separate worktree and branch for each concurrent task.
- Never let two active tasks claim the same screen or file.
- If both tasks need app/page.tsx or app/globals.css, coordinate first and make
  the work sequential, or complete a dedicated screen-extraction refactor
  before parallel feature work.
- Post handoff commits and changed paths in the Issue so the other agent can
  branch from or cherry-pick the exact commit.
- Keep PRs draft until a human confirms the design.
- Run npm test before every push.
- Never force-push, push directly to main, or merge without explicit human
  authorization.

At the beginning of your response, state the Issue, branch, worktree, and paths
you are claiming. At the end, report the exact commit, PR, checks, and any
coordination needed.
```

## Recommended branch and commit names

```text
Branch: agent/<owner>-<issue-number>-<short-outcome>
Commit: <type>(<area>): <outcome>
PR: [<Area>] <Action and outcome> (#<issue-number>)
```

## Handoff message template

```text
Task complete and pushed.

Issue: #<number>
Branch: <branch>
Commit: <sha>
PR: <url>
Changed paths:
- <path>

Validation:
- npm test
- <visual or interaction checks>

Safe base for the next task: <sha>
Do not modify concurrently:
- <paths still owned by this task>
```
