---
name: kuna-design
description: Load before any change that renders something in Kuna, such as a screen, dialog, component, gallery specimen, style or visible copy. Holds the decision order, the token file map, the lint rules and the component catalogue.
---

# Kuna design

Every screen in every app should look as if one person built it on one day. Screens arrange shared components, components carry the looks, and lint stops the rest.

- [components.md](components.md) lists every component in `src/shared/ui`, its props and which app uses it.
- [patterns.md](patterns.md) says what Kuna already does for cards, tiles, tabs, charts, dialogs, forms and phones.

## Decision order

1. Find a component in [components.md](components.md) that does the job and use it as it is.
2. Otherwise compose existing components with layout classes and the `type-*` roles.
3. Otherwise extend a component with a prop. Do not add a second component for the same job.
4. Otherwise add a component to `src/shared/ui` in the same change, with its gallery specimen and its catalogue row.
5. Never style a screen to get a look. A missing look belongs in a component or a token.

A component starts in the app that needs it and moves to `src/shared/ui` when a second app does. Never copy one into a second app.

## Rules

- Colours come from `tokens.css`. No Tailwind palette colour, `white`, `black`, literal, palette variable or `dark:` in a class. Every token already has a dark value.
- Tones are Nuxt UI's: `text-success`, `text-error`, `text-warning`, `text-info`. Money in and out is not a tone. See `MoneyText` in [components.md](components.md).
- Text roles are `type-page-title`, `type-card-title`, `type-body`, `type-label`, `type-caption` and `type-figure`. Figures that lead a hero use `text-figure-lg` or `text-figure-xl`.
- Stack with `z-control` and `z-top-bar`, and fade with `duration-fade`. No numeric `z-*` or `duration-*`.
- Colour is never the only cue. A status also has an icon or a word.
- Every control a thumb can reach is at least 44 px below 640 px. The rule is in `app.css`, so do not undo it with a height class.
- Every visible string goes through the app's text, with Croatian beside English. Check Croatian at 360 px.
- No scoped `<style>` for what a frame does. A style block is for what a stylesheet must say, such as a `:deep()` rule.
- A new token has a light and a dark value, and a text pair passes 4.5:1. A mark passes 3:1.
- Never work around lint. Inline disables have no effect (`noInlineConfig`). Change the design, not the rule.

## Token file map

Read values in these files. Never copy one into a component, a screen or a doc.

| File in `src/shared/styles/` | Holds                                                                                                                                                                                                                                                                                                                                      |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `tokens.css`                 | Every colour, in `:root` and `.dark`. Surfaces, borders, ink steps, accent, the four tones, elevations, chart values, `--series-*`, `--bucket-*`, `--pay-*`, `--loan-*`, `--ageing-*`. Also the `@theme` scales: figure sizes, radii, widths, `3xl` breakpoint, `z-control`, `z-top-bar`, `duration-fade`. Also the Nuxt UI colour mapping |
| `app.css`                    | Type roles as `@utility`, base body and focus styles, `.data-table`, the 44 px phone rule, `.phone-sheet`, `.phone-drawer`, `.top-bar-action` and reduced motion                                                                                                                                                                           |

Chart values stay plain hex or rgba, because a canvas cannot resolve `var()`. `src/shared/charts/chartTokens.ts` reads them with `getComputedStyle`.

Nuxt UI theme overrides live in `vite.config.ts` under `ui`, such as the modal and table slots.

## Lint rules

`npm run lint` runs `eslint.config.js` with `--max-warnings 0`. Class strings are checked in `class`, `:class`, `ui` bindings and `h()` calls.

| Rule                               | Catches                                                                                                                |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `no-restricted-classes`            | Palette colours, `white` and `black`, colour literals, palette variables, `dark:`, `!`, numeric `z-*` and `duration-*` |
| `no-unknown-classes`               | A misspelt or removed class. A class a stylesheet declares is known where that stylesheet applies                      |
| `no-conflicting-classes`           | Two classes that set the same property                                                                                 |
| `no-duplicate-classes`             | The same class twice                                                                                                   |
| `vue` and `typescript` recommended | Vue and TypeScript mistakes. Unused variables fail unless they are rest siblings                                       |
| `noInlineConfig`                   | Any `eslint-disable` comment                                                                                           |

Prettier owns layout: no semicolons, single quotes, 200 columns. Run `npm run format`.

## Adding a component

1. Check [components.md](components.md) and [patterns.md](patterns.md). Extend before adding.
2. Create `src/shared/ui/<Name>.vue` with `<script setup lang="ts">`, typed props through `defineProps`, `withDefaults` for defaults and `defineModel` for two-way values. The file name is the tag.
3. Give it one root element so the caller's `class` falls through. Import Nuxt UI parts by path, such as `@nuxt/ui/components/Button.vue`.
4. Take words and colour tokens as props. Name no app, bucket or business term inside it.
5. Add its specimen to `src/shell/gallery/GalleryScreen.vue` with a kebab-case section id, showing every state through its props. A specimen with app-specific data goes in that app's gallery, which arrives through `AppContribution.gallery`.
6. Add its row to [components.md](components.md). `tests/designCatalogue.spec.ts` fails without the row or the specimen.

## Check your work

1. `npm run format`, `npm run lint`, `npm run typecheck` and `npx vitest run`. `npm run check` runs them together.
2. `npm run build` and `npm run build:fake` after a change to styles or the gallery.
3. `npm run check:visual -- --only <screen> --widths 360,768,1440,1920` and `npm run check:touch -- --only <flow>` for the screens you changed. Never run the full suites locally, CI does.
4. Open the gallery at `#/gallery` in a fake build, in light and dark (`?theme=dark`) and Croatian (`?lang=hr`). Tab through the changed screen and check the focus ring.
5. Run the `design-reviewer` agent on the diff before handing back.

## References

- Rules: [kuna-styling](../../../.claude/rules/kuna-styling.md) and [kuna-components](../../../.claude/rules/kuna-components.md).
- Reviewer: [design-reviewer](../../../.claude/agents/design-reviewer.md).
- README sections "Cards", "Wide screens" and "Dialogs and forms".
