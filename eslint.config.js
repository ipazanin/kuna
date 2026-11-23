import { globSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'eslint/config'
import prettier from 'eslint-config-prettier/flat'
import betterTailwindcss from 'eslint-plugin-better-tailwindcss'
import { getDefaultSelectors } from 'eslint-plugin-better-tailwindcss/defaults'
import vue from 'eslint-plugin-vue'
import typescript from 'typescript-eslint'

import { kunaPlugin, variants } from './scripts/eslint/kunaPlugin.mjs'

const root = fileURLToPath(new URL('.', import.meta.url))
const tailwindTheme = readFileSync(fileURLToPath(import.meta.resolve('tailwindcss/theme.css')), 'utf8')
const paletteHues = [...new Set([...tailwindTheme.matchAll(/--color-([a-z]+)-\d+\s*:/g)].map(([, hue]) => hue))].join('|')
const paletteVariable = String.raw`--(?:color-(?:${paletteHues})|ui-color-[a-z]+)-\d`
const colourUtilities = String.raw`bg|text|border(?:-[xytrblse])?|outline|ring(?:-offset)?|inset-ring|divide|fill|stroke|from|via|to|shadow|inset-shadow|drop-shadow|decoration|accent|caret|placeholder`

// Tailwind reads an arbitrary value in a colour utility as a colour unless it is a number or names another type.
const nonColourType = String.raw`(?:length|percentage|number|integer|ratio|url|image|position|bg-size|line-width|family-name|absolute-size|relative-size|angle|vector):`
const sizeLiteral = String.raw`(?:[\d.]|(?:calc|min|max|clamp|url)\()`

const utility = (pattern) => `${variants}(?:${pattern})!?$`

const restrictedClasses = [
  {
    pattern: utility(String.raw`(?:${colourUtilities})-(?:(?:${paletteHues})-\d+|white|black)(?:/.+)?`),
    message: '"$0": colours come from the tokens in src/shared/styles/tokens.css, never from the Tailwind palette, white or black.',
  },
  {
    pattern: String.raw`^(?:.*:)?dark:.*$`,
    message: '"$0": every token already has a dark value in tokens.css, so do not use dark:.',
  },
  {
    pattern: String.raw`^(?:.*:)?!.*$|^.*!$`,
    message: '"$0": do not use the ! important modifier.',
  },
  {
    pattern: String.raw`^.*(?:\[(?:#|(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix)\(|color:#|var\(${paletteVariable})|\((?:color:)?${paletteVariable}).*$`,
    message: '"$0": colours come from the tokens, never from a literal or a palette variable.',
  },
  {
    pattern: utility(String.raw`(?:${colourUtilities})-(?:\((?!${nonColourType})[^)]*\)|\[(?!${nonColourType})(?:(?!${sizeLiteral})|(?=[^\]]*(?:var\(|--)))[^\]]*\])(?:/.+)?`),
    message:
      '"$0": a colour comes from a token utility such as text-muted or ring-inverted, or a Nuxt UI tone, never an arbitrary value. A size or width in a colour utility names its type, such as text-(length:--size).',
  },
  {
    // The variant pattern would read the colon of a type such as (color:--x) as the end of a variant.
    pattern: String.raw`^(?:.*:)?!?-?(?:${colourUtilities})-\(color:[^)]*\)(?:/.+)?!?$`,
    message: '"$0": a colour comes from a token utility such as text-muted or ring-inverted, or a Nuxt UI tone, never an arbitrary value.',
  },
  {
    pattern: utility(String.raw`\[(?:color|background(?:-color)?|border(?:-[a-z]+)*-color|outline-color|text-decoration-color|caret-color|accent-color|fill|stroke|box-shadow):[^\]]*\]`),
    message: '"$0": a colour comes from a token utility or a Nuxt UI tone, never an arbitrary property.',
  },
  {
    pattern: utility(String.raw`(?:${colourUtilities})-(?:positive|negative)-soft(?:/.+)?`),
    message: '"$0": the soft depth colours an amount of money in or out, through MoneyText\'s tone flow, never a class.',
  },
  {
    pattern: utility(String.raw`text-dimmed`),
    message: '"$0": dimmed ink is the same colour as muted ink, so use text-muted.',
  },
  {
    pattern: utility(String.raw`max-w-\[[\d.]+ch\]`),
    message: '"$0": running text takes the one reading width, max-w-prose.',
  },
  {
    pattern: utility(String.raw`z-[\d\[(].*`),
    message: '"$0": stack with a named layer, not a number.',
  },
  {
    pattern: utility(String.raw`(?:duration|animation-duration)-[\d\[(].*`),
    message: '"$0": use a named duration, not a number.',
  },
]

// A page's grid answers to the room the shell's content area has, which the chat's dock takes from, and not to the window.
// `sm:` stays allowed: it is the phone step, the fields of FormGrid follow it, and every layout from it up has the room.
const windowGridClasses = {
  pattern: String.raw`^(?:\S*:)?(?:md|lg|xl|2xl):(?:\S*:)?(?:grid-cols|col-span|grid-flow|auto-cols)-.*$`,
  message: '"$0": a page\'s grid follows its container, such as @4xl:grid-cols-2, because the chat\'s dock narrows a page without narrowing the window.',
}
// A page and a shared component answer to the room they get, the content area or a dialog, both containers, for every class.
const windowClasses = {
  pattern: String.raw`^(?:\S*:)?(?:max-)?(?:md|lg|xl|2xl):.*$`,
  message: '"$0": a page or a shared component follows its container, such as @2xl:flex-row, because the sidebar and the chat\'s dock narrow a page without narrowing the window.',
}
const pageFiles = ['src/apps/**/*.{ts,vue}', 'src/shared/ui/**/*.{ts,vue}', 'src/shared/**/presentation/**/*.{ts,vue}']

// Cut text shows its full text on hover, focus and a long press, which only CutText does, so the classes that cut stay inside it.
const cutTextMessage = '"$0": text that may be cut goes through CutText in src/shared/ui, which shows the full text on hover, on focus and on a long press.'
const cutLineClasses = { pattern: utility(String.raw`truncate|line-clamp-.+`), message: cutTextMessage }
const cutEllipsisClasses = { pattern: utility(String.raw`text-ellipsis`), message: cutTextMessage }
const cutTextHome = ['src/shared/ui/CutText.vue']
// A field shows all of its value once it takes focus, so its ellipsis needs nothing more.
const cutInputs = [
  'src/apps/company/settings/presentation/CategoriesEditor.vue',
  'src/apps/company/settings/presentation/GeneralSettingsForm.vue',
  'src/apps/loans/scenarios/presentation/OfferTermsFields.vue',
]
// A select's open list shows every choice in full, so its trigger may cut the one picked.
const cutSelectTriggers = [
  'src/apps/company/transactions/presentation/CategoryPicker.vue',
  'src/apps/company/workbook/presentation/PaymentsSelect.vue',
  'src/apps/spending/statements/presentation/RuleDialog.vue',
]

// Tailwind only knows the classes of its entry point, so a class a stylesheet declares is known where that stylesheet
// applies: app.css and a :deep() or :slotted() selector everywhere, the rest of a scoped style block in its own
// component. The browser checks find charts by chart-body, which no stylesheet declares.
const stylesheetClasses = (css) => {
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@import[^;]*;/g, '')
  return [...rules.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map(([, name]) => name)
}
const scopedStyles = globSync('src/**/*.vue', { cwd: root })
  .map((file) => ({ file, css: [...readFileSync(join(root, file), 'utf8').matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(([, css]) => css).join('\n') }))
  .filter(({ css }) => css !== '')
const reachingClasses = scopedStyles.flatMap(({ css }) => [...css.matchAll(/:(?:deep|slotted)\(([^)]*)\)/g)].flatMap(([, selector]) => stylesheetClasses(selector)))
const classesEverywhere = [...stylesheetClasses(readFileSync(join(root, 'src/shared/styles/app.css'), 'utf8')), ...reachingClasses, 'chart-body']
const unknownClasses = (known) => ['error', { ignore: [...new Set(known)].map((name) => `^${name}$`) }]
const scopedClassConfigs = scopedStyles.map(({ file, css }) => ({
  files: [file],
  rules: { 'better-tailwindcss/no-unknown-classes': unknownClasses([...classesEverywhere, ...stylesheetClasses(css)]) },
}))

// A class string in a script is only read as classes where better-tailwindcss looks, so any string that spells a colour
// utility with an arbitrary colour is refused wherever it sits. The Nuxt UI colour names are closed by theme.colors in vite.config.ts.
const arbitraryColourUtility = String.raw`(?:^|[\s:\]])!?-?(?:${colourUtilities})-(?:\(--|\(color:|\[(?:color:|#|var\(|(?:rgba?|hsla?|oklch|oklab|color-mix)\())`
const arbitraryColourMessage = 'A colour comes from a token utility such as text-muted or ring-inverted, or a Nuxt UI tone, never an arbitrary value.'
const scriptColourStrings = [
  { selector: `Literal[value=/${arbitraryColourUtility}/]`, message: arbitraryColourMessage },
  { selector: `TemplateElement[value.raw=/${arbitraryColourUtility}/]`, message: arbitraryColourMessage },
]

const formattingMessage = 'Format numbers and dates with the helpers in src/shared/money, src/shared/calendar and src/shared/text.'
const formattingMethods = ['toFixed', 'toLocaleString', 'toLocaleDateString', 'toLocaleTimeString', 'toLocaleUpperCase', 'toLocaleLowerCase']
const templateFormatting = [
  { selector: "MemberExpression > Identifier.object[name='Intl']", message: formattingMessage },
  { selector: `MemberExpression > Identifier.property[name=/^(?:${formattingMethods.join('|')})$/]`, message: formattingMessage },
]

const domainCode = { files: ['src/**/domain/**/*.{ts,vue}', 'src/apps/**/ruleset/**/*.{ts,vue}'], ignores: ['src/apps/**/ruleset/presentation/**'] }

/**
 * The rules scripts/lint-baseline.json exempts files from, each with the files it covers and the files it never
 * covers. A listed file breaks the rule today and may until it changes, and a test fails once it no longer needs its place.
 */
const baselineRules = {
  styleBlocks: {
    files: ['src/**/*.vue'],
    ignores: [],
    rules: { 'vue/no-restricted-block': ['error', { element: 'style', message: 'A look belongs in a shared component, a token or app.css, not in a style block.' }] },
  },
  nativeTables: {
    files: ['src/**/*.vue'],
    ignores: ['src/shared/ui/FigureTable.vue'],
    rules: { 'vue/no-restricted-html-elements': ['error', { element: ['table'], message: 'A table of figures sits in FigureTable.' }] },
  },
  formatting: {
    files: ['src/**/*.{ts,vue}'],
    ignores: ['src/shared/money/**', 'src/shared/calendar/**', 'src/shared/text/**'],
    rules: {
      'no-restricted-globals': ['error', { name: 'Intl', message: formattingMessage }],
      'no-restricted-properties': ['error', ...formattingMethods.map((property) => ({ property, message: formattingMessage }))],
      'vue/no-restricted-syntax': ['error', ...templateFormatting],
    },
  },
  moneyCasts: {
    files: ['src/**/*.{ts,vue}'],
    ignores: ['src/shared/money/**'],
    rules: { 'kuna/money-casts': 'error' },
  },
  moneyScale: {
    files: ['src/**/*.{ts,vue}'],
    ignores: ['src/shared/money/**', 'src/shared/charts/**', 'src/**/infrastructure/fake/**', 'src/apps/loans/bankLoans/domain/yearlyRate.ts'],
    rules: { 'kuna/money-scale': 'error' },
  },
  longFiles: {
    files: ['src/**/*.vue', 'src/**/domain/**/*.ts'],
    ignores: [],
    rules: { 'max-lines': ['error', { max: 600, skipBlankLines: false, skipComments: false }] },
  },
  domainRounding: {
    ...domainCode,
    rules: { 'kuna/domain-rounding': 'error' },
  },
  domainWords: {
    ...domainCode,
    rules: { 'kuna/domain-words': 'error' },
  },
}

/** Kuna's lint config, with the files each baseline rule exempts, keyed as in scripts/lint-baseline.json. */
export function kunaConfig(exempt) {
  return defineConfig(
    {
      name: 'kuna/ignores',
      ignores: ['dist', 'dist-fake', 'visual-check', 'coverage', 'spike.local', '.claude/worktrees', 'src/apps/company/packs/hr-doo/ruleset/rules/generatedLocalRates.ts'],
    },
    typescript.configs.recommended,
    vue.configs['flat/recommended'],
    {
      name: 'kuna/vue-typescript',
      files: ['**/*.vue'],
      languageOptions: { parserOptions: { parser: typescript.parser } },
    },
    {
      name: 'kuna/base',
      linterOptions: { noInlineConfig: true },
      rules: {
        // The Vue processor would otherwise honour template disable comments, which noInlineConfig does not reach.
        'vue/comment-directive': 'off',
        // Optional props declared with TypeScript types already default to undefined.
        'vue/require-default-prop': 'off',
        // A computed that switches over every member of a union returns on every path, which only TypeScript can see.
        'vue/return-in-computed-property': 'off',
        // Destructuring a key out to keep the rest is how a query or record drops one field.
        '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true }],
      },
    },
    {
      name: 'kuna/design',
      files: ['src/**/*.{ts,vue}'],
      plugins: { 'better-tailwindcss': betterTailwindcss },
      settings: {
        'better-tailwindcss': {
          entryPoint: join(root, 'src/shared/styles/app.css'),
          selectors: [
            ...getDefaultSelectors(),
            { kind: 'attribute', name: '^v-bind:ui$', match: [{ type: 'objectValues' }] },
            { kind: 'callee', name: '^h$', match: [{ type: 'objectValues', path: '^class$' }] },
            { kind: 'variable', name: '^(?:LAYOUTS|WIDTHS)$', match: [{ type: 'objectValues' }] },
          ],
        },
      },
      rules: {
        'better-tailwindcss/no-unknown-classes': unknownClasses(classesEverywhere),
        'better-tailwindcss/no-conflicting-classes': 'error',
        'better-tailwindcss/no-duplicate-classes': 'error',
        'better-tailwindcss/no-restricted-classes': ['error', { restrict: [...restrictedClasses, windowGridClasses, cutLineClasses, cutEllipsisClasses] }],
        'no-restricted-syntax': ['error', ...scriptColourStrings],
      },
    },
    {
      name: 'kuna/window-classes',
      files: pageFiles,
      rules: { 'better-tailwindcss/no-restricted-classes': ['error', { restrict: [...restrictedClasses, windowClasses, cutLineClasses, cutEllipsisClasses] }] },
    },
    { name: 'kuna/cut-text-home', files: cutTextHome, rules: { 'better-tailwindcss/no-restricted-classes': ['error', { restrict: [...restrictedClasses, windowClasses] }] } },
    { name: 'kuna/cut-inputs', files: cutInputs, rules: { 'better-tailwindcss/no-restricted-classes': ['error', { restrict: [...restrictedClasses, windowClasses, cutLineClasses] }] } },
    {
      name: 'kuna/cut-select-triggers',
      files: cutSelectTriggers,
      rules: { 'better-tailwindcss/no-restricted-classes': ['error', { restrict: [...restrictedClasses, windowClasses, cutEllipsisClasses] }] },
    },
    ...scopedClassConfigs,
    { name: 'kuna/plugin', plugins: { kuna: kunaPlugin } },
    { name: 'kuna/domain-classes', ...domainCode, rules: { 'kuna/domain-classes': 'error' } },
    { name: 'kuna/assistant-operations', files: ['src/apps/**/assistant/operations/**/*.ts'], rules: { 'kuna/proposal-work': 'error', 'kuna/card-reasons': 'error' } },
    { name: 'kuna/window-queries', files: ['src/**/*.{ts,vue}'], rules: { 'kuna/window-queries': 'error' } },
    { name: 'kuna/device-storage', files: ['src/**/*.{ts,vue}'], ignores: ['src/shared/device/deviceChoice.ts'], rules: { 'kuna/device-storage': 'error' } },
    { name: 'kuna/worded-refusals', files: ['src/apps/spending/*/application/*Writes.ts'], rules: { 'kuna/worded-refusals': 'error' } },
    { name: 'kuna/choice-buttons', files: ['src/apps/**/*.vue'], rules: { 'kuna/choice-buttons': 'error' } },
    { name: 'kuna/day-fields', files: ['src/**/*.vue'], rules: { 'kuna/day-fields': 'error', 'kuna/day-field-labels': 'error' } },
    { name: 'kuna/link-rows', files: ['src/apps/**/*.vue'], rules: { 'kuna/link-rows': 'error' } },
    { name: 'kuna/optional-selects', files: ['src/**/*.vue'], ignores: ['src/shared/ui/OptionalSelect.vue'], rules: { 'kuna/optional-selects': 'error' } },
    { name: 'kuna/record-rows', files: ['src/apps/**/*.vue'], rules: { 'kuna/record-rows': 'error' } },
    { name: 'kuna/move-buttons', files: ['src/**/*.vue'], ignores: ['src/shared/ui/MoveButtons.vue'], rules: { 'kuna/move-buttons': 'error' } },
    { name: 'kuna/all-links', files: ['src/**/*.vue'], rules: { 'kuna/all-links': 'error' } },
    { name: 'kuna/note-lines', files: ['src/**/*.vue'], ignores: ['src/shared/ui/NoteLine.vue'], rules: { 'kuna/note-lines': 'error' } },
    { name: 'kuna/money-tone-colours', files: ['src/**/*.vue'], rules: { 'kuna/money-tone-colours': 'error' } },
    { name: 'kuna/type-roles', files: ['src/**/*.vue'], ignores: ['src/shared/ui/**'], rules: { 'kuna/type-roles': ['error', { sizes: true }] } },
    { name: 'kuna/type-roles-shared-ui', files: ['src/shared/ui/**/*.vue'], rules: { 'kuna/type-roles': 'error' } },
    { name: 'kuna/shoot-at', files: ['scripts/**/*.mjs'], rules: { 'kuna/shoot-at': 'error' } },
    { name: 'kuna/book-casts', files: ['tests/**/*.ts'], rules: { 'kuna/book-casts': 'error' } },
    { name: 'kuna/date-parameters', files: ['src/**/words.ts'], rules: { 'kuna/date-parameters': 'error' } },
    ...Object.entries(baselineRules).map(([list, { files, ignores, rules }]) => ({ name: `kuna/baseline-${list}`, files, ignores: [...ignores, ...exempt[list]], rules })),
    prettier,
  )
}

export default kunaConfig(JSON.parse(readFileSync(join(root, 'scripts/lint-baseline.json'), 'utf8')))
