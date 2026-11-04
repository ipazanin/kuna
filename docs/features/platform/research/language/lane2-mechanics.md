# Language lane 2: how to build the translation layer

Compares vue-i18n with a typed in-app dictionary for Kuna's English and Croatian UI, with measured Intl output, Nuxt UI locale wiring and runtime switching in the PWA.

## Recommendation

Build a small typed dictionary in the app. Do not add vue-i18n.

- English is the source object. Croatian is typed against it, so a missing key, an extra key or a wrong parameter type fails `vue-tsc`. This was checked with the repo's own `tsc` (see "Type-checked keys").
- Plurals go through `Intl.PluralRules`, which already gets Croatian right, decimals included. vue-i18n's default plural rule gets Croatian wrong and needs a hand-written rule anyway.
- vue-i18n's `t()` accepts any string as a key and types interpolation values as `Record<string, unknown>`. Its type safety is weaker than a plain object.
- CSP is not the deciding factor. vue-i18n v11 has no `new Function` or `eval` in any build.
- Zero new dependencies and no Vite plugin, which suits one maintainer.

The rough work this implies is at the end, under "Work this implies".

## What is in the repo today

- No i18n package is installed. `node_modules` has no `vue-i18n`, `@intlify/*` or `@formatjs/*`.
- `@nuxt/ui` 4.12.0 is installed and ships `dist/runtime/locale/hr.js`. `src/shell/App.vue` already wraps everything in `UApp` (passes only `:toaster`).
- About 20 module-level `Intl` formatters hard-code `'en-GB'` (for example `src/shared/calendar/dayLabel.ts`, `monthLabel.ts`, `syncAge.ts`, `SyncStatus.vue`, `InvoicesPanel.vue`, `periodInWords.ts`). `naturalOrder.ts` uses `Intl.Collator('en')`. `moneyFormat.ts` uses `Intl.DisplayNames('en')` for the currency name.
- Money already has its own reactive locale: `setMoneyFormat()` with a per-locale formatter cache, driven by the workbook's `numberLocale` setting. That setting's help text says "Dates and text stay in English", which the language wave makes false.
- `src/shared/theme/theme.ts` is the pattern to copy for a language choice: stored per device under `kuna.theme`, pinned for one visit by `?theme=`, applied before mount.
- `src/shared/routing/browserTitle.ts` writes `document.title` from screen titles that are static strings in the route registry.
- `index.html` has `<html lang="en">`, a hash-pinned inline theme script and an English `aria-label="Opening Kuna"` on the splash. `public/manifest.webmanifest` has `"lang": "en"`.
- The service worker (`scripts/service-worker.js`, written by `scripts/pwa.ts`) precaches every built file under one release hash.

## Option A: vue-i18n v11

Current versions from the npm registry: `vue-i18n` 11.4.16 (latest, 2026-10-18), `12.0.0-alpha.7` on `next`, `@intlify/unplugin-vue-i18n` 11.2.8 (peer `vite ^6 || ^7 || ^8`).

**CSP.** Older builds compiled messages with `new Function`. In v9.2.2 `compileToFunction` runs `const msg = new Function(\`return ${code}\`)()`([source](https://raw.githubusercontent.com/intlify/vue-i18n/v9.2.2/packages/core-base/src/compile.ts)). From v9.3 the docs say "the CSP issue can be worked around by JIT compilation", and from v10 "JIT compilation is enabled by default" ([optimization guide](https://vue-i18n.intlify.dev/guide/advanced/optimization.html)). I downloaded the 11.4.16 tarballs of`vue-i18n`and`@intlify/core-base`to a scratch folder and grepped every`dist`file: zero matches for`new Function`or`eval(`. `compile()`in`core-base.mjs`builds an AST with`baseCompile(..., { jit: true })`and composes the message with`format(ast)`. So the full build runs under `script-src`without`'unsafe-eval'`.

**Runtime-only build and the plugin.** The runtime-only build (`vue-i18n.runtime.esm-bundler.js`) needs every message "pre-compile[d] to Message functions or AST resources" ([optimization guide](https://vue-i18n.intlify.dev/guide/advanced/optimization.html)). `@intlify/unplugin-vue-i18n` precompiles JSON, YAML, JS and TS resources matched by `include`, aliases to the runtime-only build in production (`runtimeOnly` default `true`), tree-shakes the legacy API (`compositionOnly`), and can drop the message compiler (`dropMessageCompiler`). It also exposes all locales through the virtual module `@intlify/unplugin-vue-i18n/messages` ([plugin README](https://github.com/intlify/bundle-tools/tree/main/packages/unplugin-vue-i18n)). In v11 the plugin is about size and speed, not CSP.

**API status.** Legacy API mode and `v-t` are deprecated in v11 and "will be removed entirely in v12". `tc`/`$tc` are gone ([v11 breaking changes](https://vue-i18n.intlify.dev/guide/migration/breaking11.html)). Composition API with `useI18n` and `legacy: false` is the only forward path.

**Size.** Bundlephobia API, minified and gzipped: `vue-i18n@11.4.16` 65.7 KB / 21.4 KB, `petite-vue-i18n@11.4.16` 47.3 KB / 15.9 KB. That includes the message compiler. The runtime-only build is smaller, but I did not measure it.

**Type safety.** `createI18n<[MessageSchema], 'en-US' | 'ja-JP'>` makes a whole missing locale a type error ([TypeScript guide](https://vue-i18n.intlify.dev/guide/advanced/typescript.html)). The guide does not say a missing key inside a locale fails. In the 11.4.16 `vue-i18n.d.ts` the composer's `t` is `<Key extends string>(key: Key | ResourceKeys | number, named: NamedValue): string`, and `NamedValue<T = {}> = T & Record<string, unknown>` (`core-base.d.ts`). Any string is accepted as a key, because `Key extends string` swallows typos. `ResourceKeys` gives editor completion only. Parameters are not checked.

**Plurals.** Forms are pipe-separated and "selected by the logic of the choice rule for each language". Slavic languages need a custom `pluralRules` function `(choice, choicesLength, orgRule)` ([pluralization guide](https://vue-i18n.intlify.dev/guide/essentials/pluralization.html)). The guide never mentions `Intl.PluralRules`. The built-in `pluralDefault` in `core-base.mjs` is pure arithmetic: with 2 forms it picks index 0 for 1 and 1 otherwise, and with 3 forms `Math.min(choice, 2)`. For Croatian `21 računa` would come out wrong (21 is `one`). A custom rule would wrap `Intl.PluralRules('hr').select()` and map the category to a form index, which leaves message authors counting pipe positions.

**Lazy loading.** Supported through `setLocaleMessage` after a dynamic import. Not needed here (see "Lazy loading").

## Option B: typed dictionary in the app

English is a plain object. Strings are strings, interpolation is a function with typed parameters, a plural is a function returning the forms each language needs. Croatian is declared as `Translation<typeof en, CroatianForms>`.

```ts
interface EnglishForms {
  readonly one: string
  readonly other: string
}
interface CroatianForms {
  readonly one: string
  readonly few: string
  readonly other: string
}

type Translation<T, F> = {
  readonly [K in keyof T]: T[K] extends string
    ? string
    : T[K] extends (...args: infer A) => EnglishForms
      ? (...args: A) => F
      : T[K] extends (...args: infer A) => string
        ? (...args: A) => string
        : Translation<T[K], F>
}
```

A `plural(forms, count, locale)` helper picks `forms[new Intl.PluralRules(locale).select(count)] ?? forms.other`, with one cached `PluralRules` per locale. Access is ordinary property access through a reactive ref, such as `text.value.invoices.paidOn(day)`, so `vue-tsc` checks templates too.

## Comparison

|                              | vue-i18n v11                                                   | Typed dictionary                              |
| ---------------------------- | -------------------------------------------------------------- | --------------------------------------------- |
| Wrong key                    | Accepted (`Key extends string`), completion only               | `vue-tsc` error                               |
| Missing Croatian key         | Only a missing whole locale is documented as an error          | `vue-tsc` error                               |
| Wrong or missing parameter   | Not checked (`Record<string, unknown>`)                        | `vue-tsc` error                               |
| Missing Croatian plural form | Not checked, forms are pipe positions                          | `vue-tsc` error (`few` required)              |
| Plural rule for `hr`         | Hand-written `pluralRules`                                     | `Intl.PluralRules`, no code                   |
| CSP                          | Fine in v11, no `new Function`                                 | Fine, no runtime compiler                     |
| Bundle                       | 15.9 to 21.4 KB gzip (full builds), plus messages              | Messages only                                 |
| Lazy locale                  | `setLocaleMessage` after `import()`                            | `import()` of the Croatian module             |
| Tooling                      | New dependency, Vite plugin, flags                             | None                                          |
| Formatting                   | `n()`/`d()` wrap `Intl`                                        | Call `Intl` directly, as the app already does |
| One-person upkeep            | Learn message syntax, plugin options, version churn toward v12 | TypeScript only                               |

What the dictionary gives up: ICU-style message syntax and translator tooling (Crowdin and similar read JSON). Neither matters for two languages written by the developer.

## Croatian plurals

CLDR cardinal rules for `hr` ([CLDR plural rules chart](https://www.unicode.org/cldr/charts/latest/supplemental/language_plural_rules.html)):

| Category | Rule                                                                                   | Examples                                     |
| -------- | -------------------------------------------------------------------------------------- | -------------------------------------------- |
| one      | `v = 0 and i % 10 = 1 and i % 100 != 11 or f % 10 = 1 and f % 100 != 11`               | 1, 21, 31, 101, 0.1, 1.1 ("1 sat")           |
| few      | `v = 0 and i % 10 = 2..4 and i % 100 != 12..14 or f % 10 = 2..4 and f % 100 != 12..14` | 2 to 4, 22 to 24, 0.2 to 0.4, 1.2 ("2 sata") |
| other    | everything else                                                                        | 0, 5 to 19, 100, 0.5, 1.5, 1.0 ("5 sati")    |

Croatian has no `many`. That category belongs to Russian, Ukrainian and Polish. The brief's "one/few/many/other" is wrong for `hr`. Ordinals have only `other`.

`Intl.PluralRules('hr')` in Node 24.21 (ICU 78.3, CLDR 48.0), headless Chrome 156 and headless Firefox 159 gives the same results:

| n   | 1   | 2   | 5     | 11    | 21  | 22  | 25    | 1.5   | 0.1 | 2.3 |
| --- | --- | --- | ----- | ----- | --- | --- | ----- | ----- | --- | --- |
| hr  | one | few | other | other | one | few | other | other | one | few |

Categories reported: `one, few, other`. The visible fraction digits matter: `1` is `one`, but with `minimumFractionDigits: 1` the same value is `other`, because `v` becomes 1. So `1,00 eura`, not `1,00 euro`, which is what Intl's own currency names do. Pass the same digit options to `PluralRules` as to the `NumberFormat` that prints the number. `Intl.PluralRules` is Baseline widely available since September 2019 ([MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/PluralRules/select)).

## Intl output, en-GB versus hr-HR

Measured in Node 24.21, and the hr-HR rows checked again in headless Chrome 156 and Firefox 159 with identical results. Date 2026-10-28 14:05 UTC.

| Options                                                   | en-GB                               | hr-HR                                |
| --------------------------------------------------------- | ----------------------------------- | ------------------------------------ |
| `dateStyle: 'long'`                                       | 28 October 2026                     | 28. listopada 2026.                  |
| `dateStyle: 'medium'`                                     | 28 Oct 2026                         | 28. lis 2026.                        |
| `dateStyle: 'short'`                                      | 28/10/2026                          | 28. 10. 2026.                        |
| `dateStyle: 'full'`                                       | Wednesday, 28 October 2026          | srijeda, 28. listopada 2026.         |
| day + short month (as in `dayLabel.ts`)                   | 28 Oct                              | 28. lis                              |
| `month: 'long'`                                           | October                             | listopad                             |
| `month: 'long', year`                                     | October 2026                        | listopad 2026.                       |
| `month: 'short', year: '2-digit'` (as in `monthLabel.ts`) | Oct 26                              | lis 26.                              |
| `weekday: 'long'` / `'short'`                             | Wednesday / Wed                     | srijeda / sri                        |
| `dateStyle: 'full', timeStyle: 'short'`                   | Wednesday, 28 October 2026 at 14:05 | srijeda, 28. listopada 2026. u 14:05 |
| `formatRange` 1 to 28 Oct, long                           | 1 – 28 October 2026                 | 01. – 28. listopada 2026.            |
| `formatRange` Oct to Dec, month + year                    | October – December 2026             | listopad 2026. – prosinac 2026.      |

Intl picks the case itself. With a day it uses the genitive (`listopada`, and `studenoga` for November), and with a bare month it uses the nominative (`listopad`). Do not build Croatian dates by concatenating a month name.

| Number                      | en-GB               | hr-HR                    |
| --------------------------- | ------------------- | ------------------------ |
| EUR 1234567.89              | €1,234,567.89       | 1.234.567,89 €           |
| EUR −1234.5                 | -€1,234.50 (hyphen) | −1.234,50 € (U+2212)     |
| EUR whole 1234              | €1,234              | 1.234 €                  |
| EUR compact 1234567 / 12345 | €1.2m / €12.3k      | 1,2 mil. € / 12,3 tis. € |
| percent 0.256               | 25.6%               | 25,6 %                   |
| 1234.5                      | 1,234.5             | 1.234,5                  |

In Croatian the euro sign goes after the number, separated by a no-break space, with `.` grouping and `,` decimals. Four-digit numbers are grouped (`1.234`). The compact Croatian labels are wider than the English ones, which matters for chart axes. `Intl.DisplayNames('hr', {type: 'currency'}).of('EUR')` is `euro`, lowercase, nominative. `Intl.RelativeTimeFormat('hr')` gives `jučer`, `prije 2 dana`, `prije 21 dan`. `Intl.ListFormat('hr')` gives `A, B i C`. `Intl.Collator('hr')` sorts `c č ć d dž đ`, where `'en'` sorts `c ć č d đ dž`.

What Intl does not cover in Croatian:

- Locative and other cases of a month: "u listopadu", "od listopada do prosinca". `formatRange` gives nominatives ("listopad 2026. – prosinac 2026."), so a phrase like "from October to December" is a dictionary function with its own month table.
- Declension of a currency name in running text, such as "po zarađenom euru" or "svakog eura". `moneyFormat.ts` builds "every euro earned" from `DisplayNames` with an English lowercasing rule. In Croatian that sentence has to be written per language.
- Gender and number agreement of adjectives and participles with the noun: "plaćen račun", "plaćena faktura", "plaćeno 3 računa". Plural categories pick the noun form, but the surrounding words still depend on gender.
- The year's trailing dot ("2026.") ends a sentence too. A message must not add a second full stop after a formatted date.
- Leading zero quirk: `formatRange` with `day: 'numeric'` printed "01." in hr-HR. Single dates did not.

## Nuxt UI locale

- `UApp` takes `locale` and provides it under `Symbol.for('nuxt-ui.locale-context')` (`localeContextInjectionKey` in `composables/useLocale.js`). It also forwards `locale.code` and `dir` to reka-ui's `ConfigProvider` (`components/App.vue`).
- Components call `useLocale()`, which injects that ref and falls back to English. `t(path, params)` looks up `messages.<path>` and replaces `{name}` tokens (`utils/locale.js`). `useLocale` is wrapped in `createSharedComposable` on the client. Reactivity holds, because the injected value is a getter ref over `UApp`'s prop.
- None of this needs the Nuxt module. The app already imports `@nuxt/ui/components/App.vue` and installs `@nuxt/ui/vue-plugin`. Import the locales from `@nuxt/ui/locale` (package export `./locale`) and bind `<UApp :locale="language === 'hr' ? hr : en_gb">`. The docs show the same for plain Vue: `<UApp :locale="locales[locale]">`, and "import only the locales you support" ([Nuxt UI i18n for Vue](https://ui.nuxt.com/docs/getting-started/integrations/i18n/vue)).
- `hr.js` has `code: 'hr'` and `name: 'Hrvatski'`. `en_gb.js` reuses English messages with `code: 'en-GB'`. The `code` drives date formats in Calendar, InputDate and InputTime, which Kuna does not use.
- What it covers in the components Kuna uses: `modal.close`, `slideover.close`, `alert.close`, `toast.close`, `toaster.label`, `toaster.viewport`, `selectMenu.noData`, `selectMenu.noMatch`, `selectMenu.search`, `selectMenu.create`, `table.noData` and `fileUpload.removeFile`. That is mostly screen-reader text and empty states. Anything Kuna passes as a prop or slot (placeholders, button labels) stays Kuna's job.
- `extendLocale(hr, { messages: { ... } })` from `@nuxt/ui/composables` overrides single strings if the terminology lane wants other wording.
- The docs set `<html lang>` with `useHead` from `@unhead/vue`. Kuna does not use unhead, and a direct `document.documentElement.lang = ...` in the language module is enough.
- ECharts ships no Croatian locale (`node_modules/echarts/i18n` has CS, PL, RU, SI and others, but no HR). Kuna passes its own `aria.label.description` and draws no time axes, so ECharts' built-in strings do not show.

## Switching language at runtime

- **Reactive locale.** One module shaped like `theme.ts`: a `shallowRef<'en' | 'hr'>`, read from `localStorage` (`kuna.language`), pinned for one visit by `?lang=`, and defaulting from `navigator.languages` (first `hr*` wins, otherwise English). It exposes the active dictionary and the Intl locale tag (`en-GB` or `hr-HR`).
- **Formatters.** The module-level `new Intl.DateTimeFormat('en-GB', ...)` constants must become lookups keyed by the active locale, the way `moneyFormat.ts` caches by key, or a switch will not repaint them. Money keeps its own `numberLocale`. Whether dates follow the UI language or the number locale is a UX decision for the other lane.
- **Module-level strings.** Screen titles in the route registry, settings field notes in `settings.ts` and domain helpers such as `periodInWords.ts` hold English at import time. They have to become functions of the dictionary, or keys resolved in presentation. This is the main refactor risk, more than the components.
- **`<html lang>`.** Set it in the language module on start and on every change. It drives screen-reader pronunciation and `:lang()` CSS ([MDN lang](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/lang)). Leave `index.html` at `lang="en"`: editing the inline script would change its CSP hash, and only the splash label is visible before mount.
- **Document title.** `browserTitle.ts` must re-run `show()` when the language changes. A watcher on the language ref that calls `nameScreen` again with the translated title is enough.
- **Manifest.** The name "Kuna" is the same in both languages, so one static manifest works. Only `description` differs. The spec defines `*_localized` members chosen from "the user's localization settings", meaning the browser's languages, not the in-app choice ([W3C manifest](https://w3c.github.io/manifest/)). Chrome's blog says Chrome and Edge 148 ship `name_localized` and siblings ([Chrome blog](https://developer.chrome.com/blog/manifest-localization)). The web-features explorer still lists no support anywhere ([web-features](https://web-platform-dx.github.io/web-features-explorer/features/manifest-localization)). A `description_localized: { "hr": "..." }` is harmless and optional. Keep `"lang": "en"`.
- **Service worker.** Every built file, including a lazily imported Croatian chunk, is in the precache list, so switching works offline. A new translation ships as a new release behind the existing update prompt. The choice lives in `localStorage`, so the worker needs no change.
- **Headless checks.** Measured with the repo's `puppeteer-core` and headless Chrome 156:
  - `--lang=hr` alone left `navigator.language` at `en-US`.
  - `--accept-lang=hr-HR,hr` set `navigator.language` to `hr-HR` and `navigator.languages` to `["hr-HR","hr"]`. The default Intl locale stayed `en-US`.
  - CDP `Emulation.setLocaleOverride({ locale: 'hr_HR' })` (experimental, "Overrides default host system locale", from the installed `devtools-protocol` JSON) changed the default Intl locale to `hr-HR` but not `navigator.language`.

  The plainest pin is `?lang=hr` in the visited URL, mirroring `?theme=`. It works the same in Chrome, Firefox and Puppeteer without flags. Because Kuna always passes an explicit locale to Intl, the browser's default locale never matters. Use `--accept-lang` only in a check that tests the first-visit default.

## Lazy loading

English must be in the entry chunk because it is the fallback and the type source. Croatian can be a dynamic `import()` awaited in `start()` before mount, since `main.ts` already awaits the app modules. For a few hundred strings the Croatian module will be tens of KB unminified, so a static import of both is simpler. Split only if the Croatian chunk grows past what the entry chunk can carry.

## Type-checked keys

Checked with the repo's TypeScript 6.0 (`node_modules/.bin/tsc --strict`) on a scratch file:

| Mistake in Croatian                                                | Result                                                                                                                |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Key missing                                                        | TS2741 "Property 'paidOn' is missing"                                                                                 |
| Parameter typed `number` where English has `string`                | TS2322                                                                                                                |
| Key English lacks, in a nested object literal                      | TS2353 excess property                                                                                                |
| Plural without `few`                                               | TS2741 "Property 'few' is missing in type ... CroatianForms"                                                          |
| Misspelt plural category (`fwe`) inside an arrow's returned object | Not caught. TypeScript does not run excess-property checks on that return. Harmless, because `few` is still required. |
| Call site `paidOn(3)` or `text.settings.titel`                     | TS2345 / TS2551                                                                                                       |

CI check for keys present in one language only: the type already fails the build. A vitest that flattens both objects and lists keys present on one side still earns its place, because a spread or an `as` cast silently bypasses the excess-property check. The same test can call each Croatian plural with 1, 2, 5, 21 and 1.5 to catch a form that interpolates the wrong count. Unused English keys are not caught by either. A grep-based script could list them later if dead strings pile up.

## Work this implies

1. Language module (`src/shared/language/`): choice, `?lang=` pin, storage, `<html lang>`, Intl tag, `plural()` helper, `Translation` type. About as large as `theme.ts`.
2. `UApp :locale` binding with `en_gb` and `hr` from `@nuxt/ui/locale`.
3. Make the roughly 20 hard-coded `'en-GB'` formatters, the `'en'` collator and the `'en'` currency name locale-aware.
4. Move module-level English (route titles, settings notes, domain wording such as `periodInWords.ts`, validation messages) behind dictionary functions. The string-inventory lane sizes this.
5. Extract component strings into per-feature `en.ts` and `hr.ts` next to the feature, assembled into one dictionary per language. This is the bulk of the work and scales with the inventory.
6. Re-run `nameScreen` on language change. Fix the "Dates and text stay in English" help text.
7. Vitest key-parity and plural test. Add `?lang=hr` visits to the visual check, mainly for wider compact labels and longer button text.

Open boundary for other lanes: generated invoice PDFs and exported workbooks are documents, not UI. Their language may need its own setting rather than following the screen.
