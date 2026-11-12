import { globSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'eslint/config'
import prettier from 'eslint-config-prettier/flat'
import betterTailwindcss from 'eslint-plugin-better-tailwindcss'
import { getDefaultSelectors } from 'eslint-plugin-better-tailwindcss/defaults'
import vue from 'eslint-plugin-vue'
import typescript from 'typescript-eslint'

import { DATE_PARAMETER, DATE_WORDS } from './scripts/support/dateParameters.mjs'

const root = fileURLToPath(new URL('.', import.meta.url))
const tailwindTheme = readFileSync(fileURLToPath(import.meta.resolve('tailwindcss/theme.css')), 'utf8')
const paletteHues = [...new Set([...tailwindTheme.matchAll(/--color-([a-z]+)-\d+\s*:/g)].map(([, hue]) => hue))].join('|')
const paletteVariable = String.raw`--(?:color-(?:${paletteHues})|ui-color-[a-z]+)-\d`
const colourUtilities = String.raw`bg|text|border(?:-[xytrblse])?|outline|ring(?:-offset)?|inset-ring|divide|fill|stroke|from|via|to|shadow|inset-shadow|drop-shadow|decoration|accent|caret|placeholder`

// Tailwind reads an arbitrary value in a colour utility as a colour unless it is a number or names another type.
const nonColourType = String.raw`(?:length|percentage|number|integer|ratio|url|image|position|bg-size|line-width|family-name|absolute-size|relative-size|angle|vector):`
const sizeLiteral = String.raw`(?:[\d.]|(?:calc|min|max|clamp|url)\()`

// Consumes the variants of a class, including arbitrary ones such as `[&_svg]:`, plus a leading ! or minus sign. The
// capture inside a lookahead cannot backtrack, so the pattern after it only ever sees the bare utility.
const variants = String.raw`^(?=((?:(?:[^:\[\]]|\[(?:[^\[\]]|\[[^\[\]]*\])*\])+:)*!?-?))\1`
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
    pattern: utility(String.raw`text-dimmed`),
    message: '"$0": dimmed ink is the same colour as muted ink, so use text-muted.',
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

/**
 * A rule that refuses what a selector finds, in a script and in a component's template. Each has an id of its own, since
 * flat config replaces no-restricted-syntax rather than merging it, and a baseline list exempts a file from one rule id.
 */
const refusedSyntax = (selectors, message) => ({
  meta: { type: 'problem', schema: [] },
  create(context) {
    const visitors = { [selectors.join(', ')]: (node) => context.report({ node, message }) }
    return context.sourceCode.parserServices.defineTemplateBodyVisitor?.(visitors, visitors) ?? visitors
  },
})

const castedBrand = String.raw`[typeName.name=/^(?:Money|AccountMoney|Percent|Share|Decimal)$/]`
const castedAs = (cast) => [`${cast} > TSTypeReference.typeAnnotation${castedBrand}`, `${cast} > *.typeAnnotation TSTypeReference${castedBrand}`]

// esquery's regular expressions only read strings, so these read a literal's raw text rather than its value.
const scaleLiteral = String.raw`/^(?:100|10_?000)n?$/`
const scaleConstant = String.raw`/^10_?000n?$/`

/** The text colours of tokens.css, which a figure with a tone takes from the tone instead. */
const textColour = /(?:^|\s)text-(?:highlighted|toned|muted|dimmed|default|inverted|error|success|warning|info|primary)(?:\s|$)/

/** A MoneyText or AccountMoneyText with a tone and a text colour in its class, where the class would override the tone. */
const moneyToneColours = {
  meta: { type: 'problem', schema: [] },
  create(context) {
    const visitors = {
      VElement(element) {
        if (!/^(?:Account)?MoneyText$/.test(element.rawName)) return
        const attributes = element.startTag.attributes
        const toned = attributes.some((attribute) => (attribute.directive ? attribute.key.argument?.name : attribute.key.name) === 'tone')
        const coloured = attributes.find((attribute) => !attribute.directive && attribute.key.name === 'class' && textColour.test(attribute.value?.value ?? ''))
        if (toned && coloured !== undefined) {
          context.report({ node: coloured, message: 'A figure with a tone takes its colour from the tone. Drop the text colour, or drop the tone and say why the figure has no tone.' })
        }
      },
    }
    return context.sourceCode.parserServices.defineTemplateBodyVisitor?.(visitors, {}) ?? {}
  },
}

/** A type a worded date comes as: text, maybe missing, or no type at all where the builder's type gives it. */
const isTextType = (annotation) =>
  annotation === undefined ||
  annotation.type === 'TSStringKeyword' ||
  (annotation.type === 'TSUnionType' && annotation.types.every((member) => ['TSStringKeyword', 'TSNullKeyword', 'TSUndefinedKeyword'].includes(member.type)))

/**
 * A words builder's parameter whose name says it takes a date as text, but which tests/croatianSentences.spec.ts would not
 * try with a worded date. A typed date needs no name, since the spec tries every parameter with one.
 */
const dateParameters = {
  meta: { type: 'problem', schema: [] },
  create(context) {
    const check = (builder) => {
      for (const parameter of builder.params) {
        const named = parameter.type === 'AssignmentPattern' ? parameter.left : parameter
        if (named.type !== 'Identifier' || DATE_PARAMETER.test(named.name) || /(?:Number|Count)$/.test(named.name) || !isTextType(named.typeAnnotation?.typeAnnotation)) continue
        if (named.name.split(/(?=[A-Z])/).some((word) => DATE_WORDS.has(word.toLowerCase()))) {
          context.report({
            node: named,
            message: `"${named.name}" takes a worded date, so name it as the Croatian sentences spec looks for one, such as day, month, period or dueDay. A day of the month or a count ends in Number or Count.`,
          })
        }
      }
    }
    return { ArrowFunctionExpression: check, FunctionExpression: check, FunctionDeclaration: check }
  },
}

/**
 * A check's flow that scrolls an element into view and then shoots, with at most a wait or an inspection between. shootAt does
 * both and fails when the element is still off screen, so a shot always shows what it is named for.
 */
const shootAt = {
  meta: { type: 'problem', schema: [] },
  create(context) {
    const calledName = (statement) => {
      const expression = statement.type === 'ExpressionStatement' ? statement.expression : null
      const call = expression?.type === 'AwaitExpression' ? expression.argument : expression
      const callee = call?.type === 'ChainExpression' ? call.expression.callee : call?.type === 'CallExpression' ? call.callee : null
      return callee?.type === 'Identifier' ? callee.name : null
    }
    const check = (block) => {
      block.body.forEach((statement, at) => {
        if (statement.type !== 'ExpressionStatement' || !context.sourceCode.getText(statement).includes('scrollIntoView')) return
        const next = block.body.slice(at + 1).find((later) => !['delay', 'inspect'].includes(calledName(later)))
        if (next !== undefined && calledName(next) === 'shoot') {
          context.report({ node: statement, message: 'Scroll to what a shot is taken for with shootAt from scripts/support/editorFlows.mjs, which fails when it is still off screen.' })
        }
      })
    }
    return { BlockStatement: check, Program: check }
  },
}

/** The icons of the four tones, as `TONE_ICONS` in src/shared/ui/toneText.ts names them. */
const toneIcons = new Set(['i-lucide-triangle-alert', 'i-lucide-circle-alert', 'i-lucide-circle-check', 'i-lucide-info'])
const wordTags = new Set(['span', 'strong', 'em', 'b', 'a', 'DrillLink'])

/** Whether an expression names a tone's icon, as a string or through TONE_ICONS. */
function namesToneIcon(node) {
  if (node === null || typeof node !== 'object') return false
  if (node.type === 'Literal' && toneIcons.has(node.value)) return true
  if (node.type === 'Identifier' && node.name === 'TONE_ICONS') return true
  return Object.entries(node).some(([key, child]) => key !== 'parent' && (Array.isArray(child) ? child.some(namesToneIcon) : namesToneIcon(child)))
}

/** A UIcon of a tone with words after it, which is a NoteLine. A mark beside a figure with only a screen reader's words after it stays. */
const noteLines = {
  meta: { type: 'problem', schema: [] },
  create(context) {
    const visitors = {
      VElement(element) {
        if (element.rawName !== 'UIcon') return
        const name = element.startTag.attributes.find((attribute) => (attribute.directive ? attribute.key.argument?.name : attribute.key.name) === 'name')
        if (name === undefined || !(name.directive ? namesToneIcon(name.value?.expression ?? null) : toneIcons.has(name.value?.value))) return
        const siblings = element.parent.children
        const next = siblings.slice(siblings.indexOf(element) + 1).find((node) => !(node.type === 'VText' && node.value.trim() === ''))
        if (next === undefined) return
        const spoken =
          next.type === 'VElement' &&
          next.startTag.attributes.some((attribute) => !attribute.directive && attribute.key.name === 'class' && /(?:^|\s)sr-only(?:\s|$)/.test(attribute.value?.value ?? ''))
        const words = next.type === 'VText' || next.type === 'VExpressionContainer' || (next.type === 'VElement' && wordTags.has(next.rawName) && !spoken)
        if (words) {
          context.report({
            node: element,
            message:
              "An icon of a tone before words is a NoteLine, which keeps the icon, its size and its gap alike everywhere. Only a mark with no words beside it, such as ComparedFigure's, draws the icon itself.",
          })
        }
      },
    }
    return context.sourceCode.parserServices.defineTemplateBodyVisitor?.(visitors, {}) ?? {}
  },
}

const kunaPlugin = {
  rules: {
    'shoot-at': shootAt,
    'date-parameters': dateParameters,
    'money-tone-colours': moneyToneColours,
    'money-casts': refusedSyntax(
      [...castedAs('TSAsExpression'), ...castedAs('TSTypeAssertion')],
      'Make Money, AccountMoney, Percent, Share and Decimal with the functions in src/shared/money. A cast skips the check that keeps the brand true.',
    ),
    'money-scale': refusedSyntax(
      [
        `BinaryExpression[operator=/^[*\\/]$/][right.raw=${scaleLiteral}]`,
        `BinaryExpression[operator=/^[*\\/]$/][left.raw=${scaleLiteral}]`,
        `AssignmentExpression[operator=/^[*\\/]=$/][right.raw=${scaleLiteral}]`,
        `VariableDeclarator[init.raw=${scaleConstant}]:not([id.name=/DURATION|TIMEOUT|_MS$/])`,
      ],
      'Scale money and percentages with the functions in src/shared/money, such as moneyAt, shareOfPercent or amountOf, not by hand with 100 or 10,000.',
    ),
    'domain-rounding': refusedSyntax(
      ["CallExpression[callee.object.name='Math'][callee.property.name='round']"],
      'Domain code rounds through src/shared/money, half away from zero. Math.round rounds a tie up on both signs.',
    ),
    'domain-words': refusedSyntax(
      ['ImportDeclaration[source.value=/(?:^|\\/)words$/]'],
      'Domain code returns facts and presentation words them. Move the sentence to a words file beside the screen that shows it.',
    ),
    'window-queries': refusedSyntax(
      [
        "CallExpression[callee.name='useMediaQuery'] > Literal.arguments[value=/width/]",
        "CallExpression[callee.name='useMediaQuery'] > TemplateLiteral.arguments > TemplateElement[value.raw=/width/]",
      ],
      "A page follows the room the shell gives it, through roomAtLeast in src/shared/layout/pageRoom.ts, since the sidebar and the chat's dock narrow a page without narrowing the window.",
    ),
    'choice-buttons': refusedSyntax(
      ["VAttribute[directive=false][key.name='aria-pressed']", "VAttribute[directive=true][key.argument.name='aria-pressed']"],
      'A row of buttons that picks one of a few choices is a ChoiceButtons, which keeps them looking and behaving alike. A setting that is on or off is a USwitch.',
    ),
    'day-fields': refusedSyntax(
      ["VAttribute[directive=false][key.name='type'][value.value='date']"],
      "A day is typed in a DayField, which shows it in the app's language. A native date field shows it in the browser's.",
    ),
    'day-field-labels': refusedSyntax(
      ["VElement[name='label'] VElement[rawName='DayField']"],
      'A DayField names itself with aria-label or a UFormField. A label around it sends a tap on the day to its calendar button.',
    ),
    'device-storage': refusedSyntax(
      ["Identifier[name='localStorage']"],
      'A choice kept on this device goes through src/shared/device/deviceChoice.ts, which gives the default where a private window denies the storage.',
    ),
    'note-lines': noteLines,
    'card-reasons': refusedSyntax(
      ["Property[key.name='reason'] > Literal.value[value=/[A-Za-z]/]", "Property[key.name='reason'] > TemplateLiteral.value > TemplateElement[value.raw=/[A-Za-z]/]"],
      "A card's reason is read by the person, so it comes from the app's words in both languages, never a sentence typed beside the operation.",
    ),
    'proposal-work': refusedSyntax(
      ['FunctionDeclaration[id.name=/Work$/] > BlockStatement > :not(ReturnStatement)'],
      "An app's proposal work only returns its work. Its plan hands the card what the card reads, so two checks at once never share a value kept beside them.",
    ),
    'domain-classes': refusedSyntax(
      ['ClassDeclaration:not([superClass.name=/Error$/])', 'ClassExpression:not([superClass.name=/Error$/])'],
      'A domain model is an immutable record with pure functions beside it. check:figures reads object shapes, so a class can hide a figure from it. Only an Error subclass stays.',
    ),
  },
}

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
        'better-tailwindcss/no-restricted-classes': ['error', { restrict: [...restrictedClasses, windowGridClasses] }],
        'no-restricted-syntax': ['error', ...scriptColourStrings],
      },
    },
    { name: 'kuna/window-classes', files: pageFiles, rules: { 'better-tailwindcss/no-restricted-classes': ['error', { restrict: [...restrictedClasses, windowClasses] }] } },
    ...scopedClassConfigs,
    { name: 'kuna/plugin', plugins: { kuna: kunaPlugin } },
    { name: 'kuna/domain-classes', ...domainCode, rules: { 'kuna/domain-classes': 'error' } },
    { name: 'kuna/assistant-operations', files: ['src/apps/**/assistant/operations/**/*.ts'], rules: { 'kuna/proposal-work': 'error', 'kuna/card-reasons': 'error' } },
    { name: 'kuna/window-queries', files: ['src/**/*.{ts,vue}'], rules: { 'kuna/window-queries': 'error' } },
    { name: 'kuna/device-storage', files: ['src/**/*.{ts,vue}'], ignores: ['src/shared/device/deviceChoice.ts'], rules: { 'kuna/device-storage': 'error' } },
    { name: 'kuna/choice-buttons', files: ['src/apps/**/*.vue'], rules: { 'kuna/choice-buttons': 'error' } },
    { name: 'kuna/day-fields', files: ['src/**/*.vue'], rules: { 'kuna/day-fields': 'error', 'kuna/day-field-labels': 'error' } },
    { name: 'kuna/note-lines', files: ['src/**/*.vue'], ignores: ['src/shared/ui/NoteLine.vue'], rules: { 'kuna/note-lines': 'error' } },
    { name: 'kuna/money-tone-colours', files: ['src/**/*.vue'], rules: { 'kuna/money-tone-colours': 'error' } },
    { name: 'kuna/shoot-at', files: ['scripts/**/*.mjs'], rules: { 'kuna/shoot-at': 'error' } },
    { name: 'kuna/date-parameters', files: ['src/**/words.ts'], rules: { 'kuna/date-parameters': 'error' } },
    ...Object.entries(baselineRules).map(([list, { files, ignores, rules }]) => ({ name: `kuna/baseline-${list}`, files, ignores: [...ignores, ...exempt[list]], rules })),
    prettier,
  )
}

export default kunaConfig(JSON.parse(readFileSync(join(root, 'scripts/lint-baseline.json'), 'utf8')))
