---
status: idea
feature: platform
summary: The Node scripts print one ExperimentalWarning on Node 26.
---

# Node 26 script warning

Kuna runs on the current Node LTS again, with Node's own Web Storage turned off in the unit tests. The Node scripts still print one ExperimentalWarning on Node 26. It is log noise only. The repo also has no `.nvmrc`.

## Open

Whether to silence the warning, wait for the dependency that causes it, or leave it.
