---
paths:
  - 'src/apps/**/domain/**'
  - 'src/apps/**/ruleset/**'
---

# Domain code

- A model is an immutable record with pure functions in the same feature folder. No classes, except an `Error` subclass, and no services around bags of fields (`kuna/domain-classes`).
- A figure on a screen comes from `domain`. `presentation` formats it and holds no rule. `tests/importBoundaries.spec.ts` keeps `figure-digest.mjs` off `presentation`, and its list of exceptions only shrinks.
- `Math.round` stays out of domain code (`kuna/domain-rounding`). Use `src/shared/money`.
- Domain code builds no screen sentences. It returns facts and presentation words them (`kuna/domain-words`, whose list of exceptions only shrinks).
- An invariant has one function, called from the reader and from the write. The file is the transaction.
- Name it in the business's language. A published type is not the internal type.
- Read the `kuna-domain` skill before adding a type, a brand or a shared module.
