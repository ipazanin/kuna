---
status: done
feature: platform
summary: The company app became the first app inside a thin shell, with the shared kernel and the boundary rules.
---

# Hub shell

About 500 files moved into `src/shell`, `src/shared` and `src/apps/company`, with the hr-doo pack inside the company app. Apps plug into the shell through `AppContribution` in `src/shared/app`, routes gained `/company`, and Settings became a shell screen. `check:figures` was committed first, and every figure stayed identical.

## Docs

- [H1 build plan](../features/platform/hub-shell-plan.md)
- [Hub design](../architecture/hub.md)
