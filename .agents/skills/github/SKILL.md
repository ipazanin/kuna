---
name: github
description: Track Kuna's work in GitHub issues and deliver it straight to main with the issue number in each commit. Use when work needs an issue, a commit, a push or a status change.
---

# GitHub workflow

Kuna has one developer, so there is no pull request step. Work is an issue, its commits go to `main` with its number, and it closes once its CI is green. Issues are the only list of open work. Plans and research stay under `docs/features` and the issue links to them.

The repo is public, so an issue holds no personal data: no names, IBANs, OIBs, amounts or file contents from real books.

## An issue

- Search before creating, including closed issues: `gh issue list --state all --search "<words>"`.
- Write the outcome in plain words, what is decided, what is open and links to its docs. Link docs by full URL, so links work on GitHub.
- Label each with one `app:<feature>` (`app:company`, `app:spending`, `app:architecture`, and so on) and one status: `idea`, `waiting`, `planned` or `building`. Done issues are closed and carry no status label.
- Move the status label when the work moves: `gh issue edit <n> --remove-label planned --add-label building`.
- Let a large issue's plan list its stages. One issue can take many commits.

## Delivering

1. Work on `main`, or in a temporary worktree for parallel items, as the plan says.
2. Check the work: `npm run check`, both builds, `npm run check:figures` against main, and the targeted visual and touch runs. CI runs the full suites.
3. Put the issue number at the end of the commit subject, in Kuna's plain-sentence style: `Spending reads a Revolut export (#45)`. Several issues list each number. Never use `closes` or `fixes`, since an issue must stay open until CI is green. No AI trailers.
4. Push to `origin/main`. Never force-push.
5. Watch the run: `gh run watch <id> --exit-status`. Read a failure before retrying it.
6. Once CI is green and the deploy is done, close the issue if its work is complete: `gh issue close <n> --reason completed`. A stage that leaves work open keeps the issue open, with a comment saying where it stands only if that is useful.

## Proposals

Agents propose out-of-scope improvements as `AGENTS.md` says, and an issue is created only after the owner's yes. Label each one `tech-debt` with its `app:` label and a status.

## Asking and telling

Commits and pushes on Kuna have standing approval once checked. Decisions that are the owner's are asked as pickers, and the answer goes in the plan. A commit that belongs to no issue, such as a typo in a doc, needs none.
