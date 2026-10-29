---
paths:
  - 'src/**/*.vue'
  - 'src/shared/styles/**'
---

# Styling

- Read the [kuna-design skill](../../.agents/skills/kuna-design/SKILL.md) before changing anything that renders.
- Use a component from [components.md](../../.agents/skills/kuna-design/components.md) as it is. Compose before building, and build before styling a screen to get a look.
- Colours come from the tokens in `src/shared/styles/tokens.css`. Never use a Tailwind palette colour, `white`, `black`, a literal, `dark:` or `!`.
- Take type from the `type-*` roles, tones from `text-success`, `text-error` and `text-warning`, stacking from `z-control` and `z-top-bar`, and fades from `duration-fade`.
- A new token has a light and a dark value, and passes 4.5:1 for text or 3:1 for a mark on the surfaces it sits on.
- A scoped `<style>` block is for what a stylesheet must say, not for what a frame such as `AppCard`, `FormGrid` or `DashboardGrid` already does.
- Controls on a phone are at least 44 px. Check light and dark, and Croatian copy at 360 px.
- Never work around lint. Inline disables have no effect.
