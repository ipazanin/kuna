---
paths:
  - 'src/shared/ui/**'
---

# Shared components

- Read the [kuna-design skill](../../.agents/skills/kuna-design/SKILL.md) and its [catalogue](../../.agents/skills/kuna-design/components.md) first. Extend a listed component before adding a second one for the same job.
- A component moves here when a second app needs it. It takes no import from `src/apps/` or `src/shell/`.
- A new component lands with its gallery specimen and its catalogue row. `tests/designCatalogue.spec.ts` fails without them.
- Type the props, give each prop a doc comment only when its meaning is not in its name, and let the caller's `class` fall through to one root element.
- Nothing in a shared component names an app, a bucket or a business term. The caller passes the words and the colour token.
