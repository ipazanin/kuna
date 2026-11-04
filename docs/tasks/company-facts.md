---
status: idea
feature: company
summary: The company app publishes owner facts, such as the owner loan, for the personal apps to read live.
---

# Company facts for the personal apps

The hub decision is that personal apps read company facts live and never copy them. The company app would publish owner payments, the owner loan book and net owed in `src/apps/company/facts.ts`. Loans then shows the owner's loan from the company read-only, and Kuna's Overview can show net owed.

A reader goes through one translation file of its own, as Assets reads Loans' published bank loans. The boundary spec lists each published file with its one reader.

## Open

Everything, from which facts to publish to where Loans shows them.

## Docs

- [Hub design](../architecture/hub.md), H5 in its roadmap
- [Module map](../architecture/modules.md)
