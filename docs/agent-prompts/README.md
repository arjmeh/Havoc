# Havoc agent prompt pack

These prompts let Evan’s and Arjun’s coding agents work in the same repository
without silently overwriting each other. They are normalized from the briefs
used to build the current prototype and intentionally exclude account details
and unrelated chat.

## Start every agent task with this prompt

```text
You are working on the Havoc Next.js prototype in this repository.

Before editing:
1. Read AGENTS.md, README.md, EDITING.md, and the relevant file in
   docs/agent-prompts.
2. Fetch origin and inspect the current branch, open Issues, active PRs, and
   recent comments.
3. Create or claim one GitHub Issue with a concrete goal, acceptance criteria,
   owner, intended paths, and dependencies.
4. Use a separate worktree and an agent/<owner>-<issue>-<task> branch.
5. Do not edit files or screens claimed by another active task. Coordinate in
   the Issue before touching shared paths.

While working:
- Preserve the established Havoc design language in
  docs/agent-prompts/02-design-direction.md.
- Treat emoji as expressive game content, not generic structural navigation.
- Respect reduced motion and keep every primary tap target at least 44px.
- Keep source media in source-assets and optimized runtime media in public.
- Make the smallest complete change that satisfies the Issue.

Before finishing:
1. Run npm test.
2. Visually verify the changed screen at phone width.
3. Inspect and stage only intended files.
4. Commit with <type>(<area>): <outcome>.
5. Push the branch and open or update a draft PR with screenshots.
6. Post the branch, commit, validation, and remaining work on the Issue.
7. Never merge unless Evan or Arjun explicitly authorizes the merge.
```

## Prompt files

- [`01-shared-github-workflow.md`](./01-shared-github-workflow.md)
- [`02-design-direction.md`](./02-design-direction.md)
- [`03-onboarding-motion-brief.md`](./03-onboarding-motion-brief.md)
- [`04-screen-ownership-template.md`](./04-screen-ownership-template.md)
- [`05-prompt-history.md`](./05-prompt-history.md)

Use only the prompt relevant to the current task. The GitHub Issue and PR remain
the authoritative live coordination record.
