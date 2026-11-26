import { relative } from 'node:path'

import { DATE_PARAMETER, DATE_WORDS } from '../support/dateParameters.mjs'

// Consumes the variants of a class, including arbitrary ones such as `[&_svg]:`, plus a leading ! or minus sign. The
// capture inside a lookahead cannot backtrack, so the pattern after it only ever sees the bare utility.
export const variants = String.raw`^(?=((?:(?:[^:\[\]]|\[(?:[^\[\]]|\[[^\[\]]*\])*\])+:)*!?-?))\1`

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

const linkIcon = 'VElement[rawName=/^(?:RouterLink|router-link)$/] VElement[rawName=/^(?:UIcon|u-icon)$/]'

const castedBrand = String.raw`[typeName.name=/^(?:Money|AccountMoney|Percent|Share|Decimal)$/]`
const castedAs = (cast) => [`${cast} > TSTypeReference.typeAnnotation${castedBrand}`, `${cast} > *.typeAnnotation TSTypeReference${castedBrand}`]

// A test that casts a literal to a book, or anything to a book through unknown, wherever the book sits in the type. A store
// typed with a book and a null placeholder for one stay allowed, since neither builds a book.
const castThroughUnknown = "TSAsExpression[expression.type='TSAsExpression'][expression.typeAnnotation.type='TSUnknownKeyword']:not([expression.expression.raw='null'])"
const castOfLiteral = 'TSAsExpression[expression.type=/^(?:ObjectExpression|ArrayExpression)$/]'
const bookType = String.raw`TSTypeReference[typeName.name=/(?:Book|Books|Workbook)$/]`
const outsideStore = String.raw`:not(TSTypeReference[typeName.name=/Store$/] ${bookType})`
const castToBook = [castThroughUnknown, castOfLiteral].flatMap((cast) => [`${cast} > ${bookType}.typeAnnotation`, `${cast} > .typeAnnotation ${bookType}${outsideStore}`])

// esquery's regular expressions only read strings, so these read a literal's raw text rather than its value.
const scaleLiteral = String.raw`/^(?:100|10_?000)n?$/`
const scaleConstant = String.raw`/^10_?000n?$/`

/** The text colours of tokens.css, which a figure with a tone takes from the tone instead. */
const textColour = /(?:^|\s)text-(?:highlighted|toned|muted|dimmed|default|inverted|error|success|warning|info|primary)(?:\s|$)/

/** The colours of the two depths and the warning tone, which no amount takes from a class, toned or not. */
const toneColour = /(?:^|\s)text-(?:error|success|warning|positive-soft|negative-soft)(?:\s|$)/

/** Every string a bound class names, in a literal, a template, an array or an object's keys. */
function boundClassStrings(node) {
  if (node === null || typeof node !== 'object') return []
  if (node.type === 'Literal') return typeof node.value === 'string' ? [node.value] : []
  if (node.type === 'TemplateElement') return [node.value.raw]
  if (node.type === 'Property' && node.key.type === 'Identifier' && !node.computed) return [node.key.name, ...boundClassStrings(node.value)]
  return Object.entries(node).flatMap(([key, child]) => (key === 'parent' ? [] : Array.isArray(child) ? child.flatMap(boundClassStrings) : boundClassStrings(child)))
}

/**
 * A MoneyText or AccountMoneyText coloured by a class: red, green, amber or a soft depth on any of them, and any text colour
 * on one with a tone, where the class would override the tone. It reads the plain class and the strings of a bound one.
 */
const moneyToneColours = {
  meta: { type: 'problem', schema: [] },
  create(context) {
    const visitors = {
      VElement(element) {
        if (!/^(?:Account)?MoneyText$/.test(element.rawName)) return
        const attributes = element.startTag.attributes
        const toned = attributes.some((attribute) => (attribute.directive ? attribute.key.argument?.name : attribute.key.name) === 'tone')
        for (const attribute of attributes) {
          const plain = !attribute.directive && attribute.key.name === 'class'
          const bound = attribute.directive && attribute.key.name.name === 'bind' && attribute.key.argument?.name === 'class'
          if (!plain && !bound) continue
          const classes = plain ? [attribute.value?.value ?? ''] : boundClassStrings(attribute.value?.expression ?? null)
          if (classes.some((names) => toneColour.test(names))) {
            context.report({
              node: attribute,
              message: "An amount takes red or green from MoneyText's tone by the kind of figure it is, never from a class: outcome, flow, balance or move.",
            })
          } else if (toned && classes.some((names) => textColour.test(names))) {
            context.report({ node: attribute, message: 'A figure with a tone takes its colour from the tone. Drop the text colour, or drop the tone and say why the figure has no tone.' })
          }
        }
      },
    }
    return context.sourceCode.parserServices.defineTemplateBodyVisitor?.(visitors, {}) ?? {}
  },
}

const selectOrPicker = /^(?:\w*Select(?:Menu)?|\w+Picker|u-select(?:-menu)?)$/
const wideMinWidth = /^min-w-(?:(?:4\d|[5-9]\d|\d{3,})|xs|sm|md|lg|[2-7]?xl)$/

/**
 * A select or picker with a min-w of 10rem or more on every width. A phone row is narrower than that beside a label, so the
 * floor sits behind sm: and the phone takes min-w-0, as ScenarioPicker's base select does.
 */
const pickerMinWidths = {
  meta: { type: 'problem', schema: [] },
  create(context) {
    const visitors = {
      VElement(element) {
        if (!selectOrPicker.test(element.rawName)) return
        for (const attribute of element.startTag.attributes) {
          const plain = !attribute.directive && attribute.key.name === 'class'
          const bound = attribute.directive && attribute.key.name.name === 'bind' && attribute.key.argument?.name === 'class'
          if (!plain && !bound) continue
          const classes = plain ? [attribute.value?.value ?? ''] : boundClassStrings(attribute.value?.expression ?? null)
          if (classes.some((names) => utilitiesOf(names).some(({ name, varied }) => !varied && wideMinWidth.test(name)))) {
            context.report({ node: attribute, message: 'A select or picker keeps its min width from sm: up and takes min-w-0 on a phone, such as min-w-0 sm:min-w-48, so it fits a phone row.' })
          }
        }
      },
    }
    return context.sourceCode.parserServices.defineTemplateBodyVisitor?.(visitors, {}) ?? {}
  },
}

const plainSelect = /^(?:USelect|USelectMenu|u-select|u-select-menu)$/
const formField = /^(?:UFormField|u-form-field)$/
const notSetKey = /^(?:notSet|none|no[A-Z]\w*)$/

/** The attribute of an element by its name, written plain or bound. */
function attributeOf(element, name) {
  return element.startTag.attributes.find((attribute) => (attribute.directive ? attribute.key.name.name === 'bind' && attribute.key.argument?.name === name : attribute.key.name === name))
}

/** The v-model or :model-value a select is bound by. */
const modelOf = (element) =>
  element.startTag.attributes.find(
    (attribute) => attribute.directive && (attribute.key.name.name === 'model' ? attribute.key.argument === null : ['modelValue', 'model-value'].includes(attribute.key.argument?.name)),
  )

/** The nearest UFormField around an element, which shows the field's error when the select itself has none. */
function enclosingFormField(element) {
  for (let parent = element.parent; parent !== null && parent !== undefined; parent = parent.parent) {
    if (parent.type === 'VElement' && formField.test(parent.rawName)) return parent
  }
  return null
}

/** The first choice of a list of items, or of its first group. */
function firstChoice(list) {
  const first = list.elements[0]
  return first?.type === 'ArrayExpression' ? firstChoice(first) : first
}

/** The value of a plain property of an object literal. */
const propertyOf = (object, name) => object.properties.find((property) => property.type === 'Property' && !property.computed && property.key.name === name)?.value

/** Whether a select shows an error itself, through error, a bound colour or highlight, or through the UFormField around it. */
function showsError(element) {
  if (['error', 'color', 'highlight'].some((name) => attributeOf(element, name)?.directive)) return true
  const field = enclosingFormField(element)
  return field !== null && attributeOf(field, 'error') !== undefined
}

/**
 * A select whose field may stay empty, written without OptionalSelect: a plain select with a clear button, a single bound select
 * with a placeholder and no error to show, or a list whose first choice is a hand-made Not set row. Each keeps its first pick
 * for good, since only OptionalSelect gives the cross and the row for empty together. A deliberate one sits in `allowed`, by
 * file and by its data-testid, its v-model or its row's words, with the reason it may stay.
 */
const optionalSelects = {
  meta: { type: 'problem', schema: [{ type: 'object', properties: { allowed: { type: 'object' } }, additionalProperties: false }] },
  create(context) {
    const file = relative(context.cwd, context.filename)
    const allowed = context.options[0]?.allowed?.[file] ?? {}
    const report = (node, name, message) => {
      if (name === null || allowed[name] === undefined)
        context.report({ node, message: name === null ? message : `${message} If it is deliberate, allow "${name}" in eslint.config.js with its reason.` })
    }
    const nameOf = (element) => {
      const testid = attributeOf(element, 'data-testid')
      if (testid !== undefined && !testid.directive) return testid.value?.value ?? ''
      return context.sourceCode.getText(modelOf(element).value.expression)
    }
    const templateVisitors = {
      VElement(element) {
        if (!plainSelect.test(element.rawName)) return
        const clear = attributeOf(element, 'clear')
        if (clear !== undefined) {
          report(clear, null, 'A select whose field may stay empty is an OptionalSelect, which gives it the cross and the row for empty together.')
          return
        }
        if (attributeOf(element, 'placeholder') === undefined || attributeOf(element, 'multiple') !== undefined || modelOf(element) === undefined) return
        if (showsError(element)) return
        report(
          element.startTag,
          nameOf(element),
          'A select with a placeholder and no error to show lets its field stay empty, but has no way back to empty once picked. Make it an OptionalSelect, or show an error while it is empty.',
        )
      },
    }
    const rowVisitors = {
      ArrayExpression(list) {
        if (list.parent?.type === 'ArrayExpression' && list.parent.elements[0] === list) return
        const first = firstChoice(list)
        if (first?.type !== 'ObjectExpression' || propertyOf(first, 'value') === undefined) return
        const label = propertyOf(first, 'label')
        const key = label?.type === 'MemberExpression' ? label.property.name : label?.type === 'Identifier' ? label.name : null
        if (key === null || key === undefined || !notSetKey.test(key)) return
        report(
          first,
          context.sourceCode.getText(label),
          'A list that starts with a row for empty is an OptionalSelect, which gives the row and the cross together and clears the field to blank, never to a stand-in value.',
        )
      },
    }
    return context.sourceCode.parserServices.defineTemplateBodyVisitor?.({ ...templateVisitors, ...rowVisitors }, rowVisitors) ?? rowVisitors
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
const isCard = (node) => node?.type === 'VElement' && /^(?:AppCard|app-card)$/.test(node.rawName)
const emptyTest = /\.(?:length|size)\s*===\s*0\b|!\s*[\w$.?]+\.(?:length|size)\b/
const someTest = /\.(?:length|size)\s*>\s*0\b/

/** A line in a card body, or in a div or template of it that only picks between the line and what replaces it, that shows while a list is empty, as its own condition or as the v-else of a list shown while it has rows. */
const emptyLines = {
  meta: { type: 'problem', schema: [] },
  create(context) {
    const branchOf = (element) => element.startTag.attributes.find((attribute) => attribute.directive && ['if', 'else-if', 'else'].includes(attribute.key.name.name))?.key.name.name
    const holdsOneChoice = (wrapper) => {
      const branches = wrapper.children.filter((node) => node.type === 'VElement').map(branchOf)
      return branches.every((branch) => branch !== undefined) && branches.filter((branch) => branch === 'if').length === 1
    }
    const inCardBody = (element) => isCard(element.parent) || (/^(?:div|template)$/.test(element.parent?.name ?? '') && isCard(element.parent.parent) && holdsOneChoice(element.parent))
    const conditionText = (element, names) => {
      const condition = element.startTag.attributes.find((attribute) => attribute.directive && names.includes(attribute.key.name.name))
      return condition?.value?.expression ? context.sourceCode.getText(condition.value.expression) : null
    }
    const previousElement = (element) => {
      const siblings = element.parent.children
      return siblings.slice(0, siblings.indexOf(element)).findLast((node) => node.type === 'VElement')
    }
    const visitors = {
      "VElement[name='p']"(element) {
        if (!inCardBody(element)) return
        const own = conditionText(element, ['if', 'else-if'])
        const afterList = element.startTag.attributes.some((attribute) => attribute.directive && attribute.key.name.name === 'else') ? previousElement(element) : undefined
        const listTest = afterList === undefined ? null : conditionText(afterList, ['if'])
        if ((own !== null && emptyTest.test(own)) || (listTest !== null && someTest.test(listTest))) {
          context.report({
            node: element.startTag,
            message: "An empty list in a card shows its one quiet line through EmptyState with line, so every card's empty line sits at the card's body padding.",
          })
        }
      },
    }
    return context.sourceCode.parserServices.defineTemplateBodyVisitor?.(visitors, {}) ?? {}
  },
}

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

/** The value an attribute of a template element is given, written plain or bound to a string, or undefined for one it lacks or binds otherwise. */
function attributeValue(element, name) {
  for (const attribute of element.startTag.attributes) {
    if (!attribute.directive && attribute.key.rawName === name) return attribute.value?.value ?? ''
    if (attribute.directive && attribute.key.name.name === 'bind' && attribute.key.argument?.rawName === name) {
      const expression = attribute.value?.expression
      return expression?.type === 'Literal' && typeof expression.value === 'string' ? expression.value : null
    }
  }
  return undefined
}

/** A link UButton with an arrow, which is a card's All link and stays neutral beside the card's words. */
const allLinks = {
  meta: { type: 'problem', schema: [] },
  create(context) {
    const visitors = {
      VElement(element) {
        if (!/^(?:UButton|u-button)$/.test(element.rawName) || attributeValue(element, 'variant') !== 'link') return
        const arrowed = ['icon', 'trailing-icon', 'trailingIcon', 'leading-icon', 'leadingIcon'].some((name) => attributeValue(element, name) === 'i-lucide-arrow-right')
        if (arrowed && attributeValue(element, 'color') !== 'neutral') {
          context.report({ node: element, message: 'A link with an arrow, such as a card\'s All link, is color="neutral", so it reads as a way on rather than an action in the accent.' })
        }
      },
    }
    return context.sourceCode.parserServices.defineTemplateBodyVisitor?.(visitors, {}) ?? {}
  },
}

const typeSizes = new Set(['text-xs', 'text-sm'])
const typeInks = new Set(['text-muted', 'text-toned', 'text-highlighted', 'text-default', 'text-dimmed'])
const rawSize = /^text-(?:xs|sm|base|lg|[2-9]?xl|title|figure-[a-z]+)$/
const typeRolesMessage =
  'Text takes its size and ink from a type-* role, such as type-caption or type-aside, never from text-xs or text-sm with a colour, and a role never takes a size or an ink beside it.'
const typeSizeMessage = 'Text takes its size from a type-* role, such as type-caption or type-body, or from its parent. text-xs and text-sm stay inside the components of src/shared/ui.'

/** The utilities of a class string, each without its variants or important mark, and whether it had a variant. */
const utilitiesOf = (names) =>
  names
    .split(/\s+/)
    .filter(Boolean)
    .map((name) => {
      const bare = name.replace(new RegExp(variants), '')
      return { name: bare.replace(/^!|!$/g, ''), varied: bare !== name }
    })

/**
 * Text that sets its size and ink by hand beside the roles, or a role with a size or an ink beside it. It reads an element's
 * class and bound class together, so a size in one and an ink in the other is one pair, and each string of a ui binding
 * or an h() class on its own. An ink behind a variant, such as group-hover:text-toned, changes a role's ink and stays. With
 * sizes set, a size alone is refused too.
 */
const typeRoles = {
  meta: { type: 'problem', schema: [{ type: 'object', properties: { sizes: { type: 'boolean' } }, additionalProperties: false }] },
  create(context) {
    const sizes = context.options[0]?.sizes === true
    const check = (node, strings) => {
      const utilities = strings.flatMap(utilitiesOf)
      const sized = utilities.some(({ name }) => typeSizes.has(name))
      const inked = utilities.some(({ name, varied }) => typeInks.has(name) && !varied)
      const role = utilities.some(({ name }) => name.startsWith('type-'))
      if ((sized && inked) || (role && (inked || utilities.some(({ name }) => rawSize.test(name))))) context.report({ node, message: typeRolesMessage })
      else if (sizes && sized) context.report({ node, message: typeSizeMessage })
    }
    const attributeName = (attribute) => (attribute.directive ? (attribute.key.name.name === 'bind' ? attribute.key.argument?.name : undefined) : attribute.key.name)
    const template = {
      VElement(element) {
        const classes = element.startTag.attributes.filter((attribute) => attributeName(attribute) === 'class')
        if (classes.length > 0)
          check(
            classes[0],
            classes.flatMap((attribute) => (attribute.directive ? boundClassStrings(attribute.value?.expression ?? null) : [attribute.value?.value ?? ''])),
          )
        for (const attribute of element.startTag.attributes.filter((candidate) => candidate.directive && attributeName(candidate) === 'ui')) {
          for (const names of boundClassStrings(attribute.value?.expression ?? null)) check(attribute, [names])
        }
      },
    }
    const script = {
      "CallExpression[callee.name='h'] > ObjectExpression > Property[key.name='class']"(property) {
        check(property, boundClassStrings(property.value))
      },
    }
    return context.sourceCode.parserServices.defineTemplateBodyVisitor?.(template, script) ?? script
  },
}

export const kunaPlugin = {
  rules: {
    'type-roles': typeRoles,
    'shoot-at': shootAt,
    'date-parameters': dateParameters,
    'money-tone-colours': moneyToneColours,
    'picker-min-widths': pickerMinWidths,
    'money-casts': refusedSyntax(
      [...castedAs('TSAsExpression'), ...castedAs('TSTypeAssertion')],
      'Make Money, AccountMoney, Percent, Share and Decimal with the functions in src/shared/money. A cast skips the check that keeps the brand true.',
    ),
    'book-casts': refusedSyntax(
      castToBook,
      'Build a book with a typed fixture, such as spendingBook or exampleStudio, or check it with satisfies. A cast hides a field the book no longer has or still lacks.',
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
    'worded-refusals': refusedSyntax(
      ["ThrowStatement > NewExpression[callee.name='Error'] > Literal.arguments", "ThrowStatement > NewExpression[callee.name='Error'] > TemplateLiteral.arguments"],
      "A refused write reaches the person as the error's message, so it reads from the module's domain words in the person's language, never from a sentence written here.",
    ),
    'device-storage': refusedSyntax(
      ["Identifier[name='localStorage']"],
      'A choice kept on this device goes through src/shared/device/deviceChoice.ts, which gives the default where a private window denies the storage.',
    ),
    'note-lines': noteLines,
    'all-links': allLinks,
    'move-buttons': refusedSyntax(
      [
        "VElement[rawName=/^(?:UButton|u-button)$/] > VStartTag > VAttribute[directive=false][key.name='icon'][value.value=/^i-lucide-arrow-(?:up|down)$/]",
        "VElement[rawName=/^(?:UButton|u-button)$/] > VStartTag > VAttribute[directive=true][key.argument.name='icon'] > VExpressionContainer Literal[value=/^i-lucide-arrow-(?:up|down)$/]",
      ],
      'A pair of buttons that moves a row up or down is a MoveButtons, which keeps both at 44 px and alike in every list.',
    ),
    'handover-alerts': refusedSyntax(
      [
        "VElement[rawName=/^(?:UAlert|u-alert)$/] > VStartTag > VAttribute[directive=false][key.name='data-testid'][value.value=/-handover$/]",
        "VElement[rawName=/^(?:UAlert|u-alert)$/] > VStartTag > VAttribute[directive=true][key.argument.name='data-testid'] > VExpressionContainer Literal[value=/-handover$/]",
      ],
      'A warning of the rows a source handover takes out is a SourceHandoverAlert, so it looks and lists its rows alike in every app.',
    ),
    'link-rows': refusedSyntax(
      [
        `${linkIcon} > VStartTag > VAttribute[directive=false][key.name='name'][value.value='i-lucide-chevron-right']`,
        `${linkIcon} > VStartTag > VAttribute[directive=true][key.argument.name='name'] > VExpressionContainer > Literal[value='i-lucide-chevron-right']`,
        "VElement[name='li'] > VElement[rawName=/^(?:RouterLink|router-link)$/]",
      ],
      "A row of a list that opens a page is a ListRow with to, which draws its arrow on the title's line.",
    ),
    'empty-lines': emptyLines,
    'optional-selects': optionalSelects,
    'record-rows': refusedSyntax(
      ["VElement[name='tr'] VElement[name='th']:has(VAttribute[directive=false][key.name='scope'][value.value='row']) VElement[rawName=/^(?:DrillLink|drill-link|RouterLink|router-link)$/]"],
      "A table row that stands for a record is a RecordRow, which opens the record from anywhere on the row. A link in a row's heading cell names the row's record.",
    ),
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
