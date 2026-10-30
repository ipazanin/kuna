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
- No new `<style>` block, and no colour in an arbitrary value such as `text-(--ink)`. A look belongs in a component such as `AppCard`, `FormGrid` or `DashboardGrid`, a token or `app.css`.
- A Nuxt UI `color` is `primary`, `neutral`, `error`, `warning`, `info` or `success`. `npm run typecheck` rejects any other.
- A table of figures sits in `FigureTable`. Format money, numbers and dates with the helpers in `src/shared/money`, `src/shared/calendar` and `src/shared/text`.
- `scripts/lint-baseline.json` lists the files that may keep a style block, a native table, or `Intl`, `toLocale*` or `toFixed` today. Take a file off its list when you fix it. Only the owner adds one.
- Controls on a phone are at least 44 px. Check light and dark, and Croatian copy at 360 px.
- Never work around lint. Inline disables have no effect.
