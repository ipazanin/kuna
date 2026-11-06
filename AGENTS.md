# Working on Kuna

Work is tracked in [GitHub issues](https://github.com/ipazanin/kuna/issues), delivered straight to `main` with the issue number in each commit. The `github` skill says how.

Kuna is a modular monolith. The [module map](docs/architecture/modules.md) says what each module owns and what it may import, and `tests/importBoundaries.spec.ts` enforces it.

## Leave the code better than you found it

A new feature is not a licence to add code beside the old. When new code touches older code, improve what it touches in the same change.

- Before adding code, read what is there and ask where it belongs. Reorganise first if it has no good home.
- Fix the architecture and design you run into, in old code as in new. Existing code that breaks a rule is no precedent.
- Follow SOLID and domain-driven design: business rules in the domain, one reason to change per module, dependencies pointing inward, types and names from the business language.
- Keep one owner for each rule. When a second copy appears, merge them if both change for the same reason.
- Delete what a change leaves unused in that same change.
- Stay in proportion. Refactor what the work touches, and name a larger problem in the plan or as a task rather than rewriting it unasked.
- A refactor moves no figure. `npm run check:figures` stays identical, or the change says which groups move and why.
