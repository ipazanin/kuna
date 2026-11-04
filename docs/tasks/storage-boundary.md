---
status: done
feature: platform
summary: Repositories per record kind, one unit of work per write, record ids and the pack seam.
---

# Storage boundary

Writes go through a repository per record kind and a unit of work that saves them all or none. Each kind has one type, records are named by their label rather than a row number, and storage order is no longer a business fact. The hr-doo pack reaches the company app through one typed contribution.

## Docs

- [Storage boundary plan](../features/platform/storage-boundary-plan.md)
