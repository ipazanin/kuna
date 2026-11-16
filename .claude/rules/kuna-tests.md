---
paths:
  - 'tests/**'
---

# Tests

- Build a book with a typed fixture: `spendingBook` in `fixtures/spending.ts`, `exampleStudio` or `steadyStudio` for a Company book with the HR d.o.o. pack, `emptyCompany` for one with empty lists, and the builders in `fixtures/loans.ts` and `fixtures/investments.ts`. Pass only the fields the test is about.
- Never cast a book or a part of one. Check a literal with `satisfies` when no fixture fits. Lint refuses the cast (`kuna/book-casts`).
- A test that writes a file writes it under a folder from `mkdtemp` in `os.tmpdir()` and removes that folder after. It never writes into the repository or a fixed path.
- No path of one machine, such as `/Users/` or `/private/tmp`, in a test or in `src/`. `tests/machinePaths.spec.ts` fails on one.
- The test name says what the code does. A comment may work out a figure the test expects.
- Read the `kuna-domain` skill before a spec of a figure, and keep `npm run check:figures` identical in a refactor.
