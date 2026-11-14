---
name: drive-feature
description: Drive a Kuna issue from plan to deploy with Opus agents and workflows, with the owner asked only for decisions. Use when asked to drive, build or finish a feature or a batch of issues on your own.
---

# Drive a feature

The lead keeps decisions, Git, integration and review. Agents research, build and review in narrow lanes. The owner is asked only for business decisions and for what `AGENTS.md` and the owner's rules reserve. The `github` skill says how an issue and a commit look.

## Ledger

Keep the drive's state in the project memory file `drive-ledger.md`: each issue and stage, its worktree, its base SHA, what is done and the next step. Update it after every step that changes state. A session that dies leaves the next one a ledger and committed lane branches, not uncommitted worktrees.

## Steps

1. **Research.** Up to four read-only agents in disjoint lanes, such as domain, screens, chat and law (with the `law-research` skill). Check their key claims yourself.
2. **Plan.** Run `.claude/workflows/plan-feature.js` with the issue numbers. Each plan goes into its issue body with stages, the files each stage touches and the clashes with other open work. Bring every owner decision of the batch as one picker per decision, each with a concrete euro example and a recommendation. Record the answers on the issues.
3. **Waves.** Run `.claude/workflows/build-wave.js` with up to four lanes and a read-only scratch copy of the real books, so the design review runs on them too. Push main first and create each lane's worktree yourself at the pushed SHA, so no agent builds on a stale base. Lanes that touch the same files go in different waves. Every wave carries at least one open `tech-debt` issue as a lane of its own, picked from those that touch the wave's files, or the oldest one when none does. Each lane builds, takes screenshots when something visible changes, gets reviewed (`design-reviewer` for anything a person sees, a correctness reviewer always, a domain reviewer for money, law and models) and fixed in the same run.
4. **Commit the lanes.** Commit each finished lane on its own branch at once, so a dead session loses nothing.
5. **Integrate.** Bring lanes onto main one at a time in a fixed order, with conflicts resolved by the lead. Then run once on main: `npm run check`, both builds, `npm run check:figures` against the previous main, and every visual and touch flow of a screen the wave changed. Shared budgets, such as the chat's instructions, are checked here, since two lanes can each fit alone.
6. **Real data.** Copy the owner's Kuna files from Google Drive into the session scratchpad and run the figure digest on the copies. Only the groups a commit names may move. Never write to the real files, and keep real figures out of issues and commits.
7. **Push and deploy.** Push to `origin/main` and watch the run with `gh run watch <id> --exit-status`. Do not push again while a run is red, since each push cancels the one before. Fix forward with a new commit. Close each issue whose work is complete once the deploy is green.
8. **Clean up.** Remove each lane's worktree and delete its branch once it is on main. Bring the batch's out-of-scope proposals to the owner as one picker: create, drop or merge into an existing issue.

## Stop and ask

- A change to an aggregate boundary, root identity, table ownership or which record owns a collection.
- A lint rule loosened, an exemption added or a file added to `scripts/lint-baseline.json`.
- A tax or law reading that `docs/law` and its sources do not settle.
- A destructive Git or file operation, or anything that would touch the owner's real files.
