# Havoc agent collaboration rules

GitHub Issues and Pull Requests are the authoritative coordination channel.
Every coding agent must follow this workflow unless the user explicitly
overrides it.

## Before editing

1. Confirm the repository, default branch, current branch, and working tree.
2. Fetch the latest remote state.
3. Read the assigned Issue, active Pull Requests, and recent comments for the
   requested area.
4. Do not begin if another active Issue or PR claims the same task or paths.
   Coordinate through GitHub comments first.
5. Every task needs one Issue with a goal, acceptance criteria, owner, intended
   paths, and dependencies.
6. Claim the Issue by posting the agent owner, planned branch, intended paths,
   and dependencies.

## Branches and worktrees

- Never implement directly on `main` or another protected/default branch.
- Start from the latest default branch.
- Name branches:

  ```text
  agent/<owner>-<issue-number>-<short-task-slug>
  ```

- Use lowercase kebab-case and describe the actual outcome.
- Use a separate Git worktree for every concurrent agent on the same computer.
- Never let two agents edit the same working tree.

## Scope and validation

- Work only within the Issue's accepted scope and claimed paths.
- Preserve unrelated changes and never stage or discard them.
- Do not modify paths claimed by another active task without coordination.
- Keep changes small and independently reviewable.
- Run `npm test` before publishing. It must complete TypeScript validation and
  the production Next.js build.

## Commit, push, and PR

1. Inspect the complete diff before staging.
2. Stage only files belonging to the Issue.
3. Use a concise commit:

   ```text
   <type>(<area>): <outcome>
   ```

4. Push the task branch to `origin` with upstream tracking.
5. Always open or update a Pull Request before ending the task.
6. Use a descriptive PR title:

   ```text
   [<Area>] <Action and outcome> (#<issue-number>)
   ```

7. Open the PR as a draft by default. Never merge without explicit human
   authorization.
8. Include `Closes #<issue-number>`, what changed, why, affected files,
   screenshots for visual work, validation results, limitations, and
   dependencies.
9. If incomplete or blocked, still push safe work and update the draft PR with
   the blocker. Never present it as complete.
10. Post the branch, PR, validation results, remaining work, and coordination
    needs on the Issue.

## Non-negotiable rules

- Never push directly to the default branch.
- Never force-push a shared branch.
- Never merge without explicit human authorization.
- Never silently take over another active task or claimed path.
- Never stage unrelated changes.
- Always report the exact branch, commit, PR, and validation result.
