# Working on Kuna

Work is tracked in [GitHub issues](https://github.com/ipazanin/kuna/issues), delivered straight to `main` with the issue number in each commit. The `github` skill says how.

Kuna is a modular monolith. The [module map](docs/architecture/modules.md) says what each module owns and what it may import, and `tests/importBoundaries.spec.ts` enforces it.

Money, percentages and domain models have rules in `.claude/rules/kuna-money.md` and `.claude/rules/kuna-domain.md`, and the `kuna-domain` skill holds the reasoning. Read it before adding a value type, a brand or a shared module.

## Leave the code better than you found it

A new feature is not a licence to add code beside the old. When new code touches older code, improve what it touches in the same change.

- Before adding code, read what is there and ask where it belongs. Reorganise first if it has no good home.
- Fix the architecture and design you run into, in old code as in new. Existing code that breaks a rule is no precedent.
- Follow SOLID and domain-driven design: business rules in the domain, one reason to change per module, dependencies pointing inward, types and names from the business language.
- Keep one owner for each rule. When a second copy appears, merge them if both change for the same reason.
- Delete what a change leaves unused in that same change.
- Stay in proportion. Refactor what the work touches, and name a larger problem in the plan or as a task rather than rewriting it unasked.
- A refactor moves no figure. `npm run check:figures` stays identical, or the change says which groups move and why.

## Propose what is out of scope

When you see something worth improving that the work at hand should not take on, propose an issue instead of expanding the scope or leaving it in a report. This covers an implementation you are not happy with, tech debt, missing tests, and a bad or missing rule or skill.

- Give what is wrong with file and line, one concrete failure or cost, the fix in a sentence or two, a rough size, and whether a mechanical check could stop it coming back.
- Search open and closed issues first. Nothing is created without the owner's yes.
- A subagent lists proposals at the end of its report, apart from findings to fix now. The lead brings them to the owner at the end of a chunk as pickers: create, drop or merge into an existing issue.
- Approved ones get the `tech-debt` label. A rule problem is fixed in the rule or skill and, where possible, in a lint or boundary check.
- Every task and every workflow also takes one open `tech-debt` issue, preferably one that touches the same files, and delivers it in the same chunk.

## Review what a person sees

A change to anything a person sees gets a design review before it is pushed. That covers screens, components, styles, tokens and layout. A word change alone does not need it, unless it may no longer fit.

- Run the `design-reviewer` agent on the diff, with the `frontend-design` skill as well as `kuna-design`, and give it screenshots at 360, 640, 1024 and 1440 px, both languages and both themes, with the before where one exists. A builder that cannot start agents says so, and the lead runs it.
- Give the reviewer a port, a scratch copy of the owner's books and a scratch folder too, so it runs `npm run dev:real` and looks at the changed screens on real books. Real screenshots never leave the scratch folder.
- Fix what it finds, or bring it to the owner. What is out of scope becomes a proposal.
- Use the existing component library, colours and tokens first. A change may extend them or propose new ones, stating what it replaces or why nothing fits, with at least two uses or a clear second one coming. Removing or merging is a good outcome.

## Parallel work

- Run at most four worktrees in parallel.
- Give hard work to a stronger agent: domain models, money, law and architecture. Give mechanical work, such as renames, moves and copy changes, to a lighter one.
