import { categoryOf, fieldsOf, flagOf, rowOf } from './companyCard'
import type { CompanyCard, CompanyOperationSet } from './companyCard'
import { words } from './words'
import { RULE_CONDITION_FIELDS, RULE_CONDITION_INPUTS, conditionsFromInput } from '../ruleConditionFields'
import { writeOwnerShare } from '../../owner-share/application/ownerShareWrites'
import { typedOwnerShare } from '../../owner-share/domain/ownerShare'
import type { ShareTarget } from '../../owner-share/domain/ownerShare'
import { installedPack } from '../../packs/packContribution'
import { DISMISSAL_WRITES, dismissalOfGroup } from '../../rules/application/dismissalWrites'
import { writeRuleSave, writeRulesChange } from '../../rules/application/ruleWrites'
import { categorisationContextOf } from '../../rules/domain/categorisationContext'
import { withoutDismissed } from '../../rules/domain/dismissedSuggestions'
import { ruleNameOf } from '../../rules/domain/proposeRule'
import { readRules } from '../../rules/domain/readRules'
import { ruleAgainst, ruleCoverage } from '../../rules/domain/ruleCoverage'
import { blankDraft, draftChange, draftForRow, draftOfRule } from '../../rules/domain/ruleDraft'
import type { DraftCondition, RuleDraft } from '../../rules/domain/ruleDraft'
import { previewRulesChange } from '../../rules/domain/rulesChangePreview'
import type { RulesTabChange } from '../../rules/domain/rulesTabChange'
import { treatPayeeAsPerson } from '../../settings/application/settingWrites'
import { fileRows } from '../../transactions/application/fileRows'
import { words as transactionWords } from '../../transactions/presentation/words'
import { writeSplit } from '../../transactions/application/splitWrites'
import type { SplitPartDraft } from '../../transactions/application/splitWrites'
import { fitsPairSide, pairSidesWith } from '../../transactions/domain/pairSides'
import { confirmation, confirmedRowsRefiledBy, recategorisation } from '../../transactions/domain/verdictChanges'
import type { RowVerdict } from '../../transactions/domain/verdictChanges'
import { CATEGORY_RECORDS, LEDGER_RECORDS, RULE_RECORDS } from '../../workbook/domain/coreKinds'
import { displayNamesOf } from '../../workbook/domain/displayName'
import { needsReview } from '../../workbook/domain/needsReview'
import type { SplitTabRow } from '../../workbook/domain/splitsReading'
import type { Transaction } from '../../workbook/domain/workbook'
import type { AssistantOperation, ProposalStep } from '../../../../shared/app/assistantOperations'
import { FLAG_OR_NULL, NUMBER, NUMBER_OR_NULL, TEXT, TEXT_OR_NULL, inputOf } from '../../../../shared/app/operationInput'
import { StepRefused } from '../../../../shared/app/proposedWrites'
import { today } from '../../../../shared/calendar/civilDate'
import type { Rule, RuleConfidence } from '../../../../shared/categorising/domain/rule'
import { moneyParts } from '../../../../shared/money/decimal'
import { absMoney, moneyFromAmount, negateMoney, sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { NO_RECORDS, recordWithId, recordsOf } from '../../../../shared/storage/domain/recordsRead'

const ROW = LEDGER_RECORDS.name
const CATEGORY = CATEGORY_RECORDS.name
const RULE = RULE_RECORDS.name

const CONFIDENCE_OR_NULL = { type: ['string', 'null'], description: 'rule files the row, review files it and leaves it waiting on To review, or null to leave it.' } as const

const RULE_NAME = {
  type: ['string', 'null'],
  description: 'A short name in lower case with hyphens, such as donations-red-cross, or null for Kuna to name it from the category and the payee.',
} as const

const RULE_FIELDS = {
  ...RULE_CONDITION_INPUTS,
  confidence: CONFIDENCE_OR_NULL,
  note: TEXT_OR_NULL,
}

/** Every condition left as it is, for the examples. */
const CONDITIONS_LEFT = Object.fromEntries(RULE_CONDITION_FIELDS.map((field) => [field.name, null]))

const OPERATIONS: readonly AssistantOperation[] = [
  {
    name: 'file-row',
    about:
      'Files a ledger row under a category, or with category null confirms the category it has, as To review does. A person files it, so the row leaves To review. A category for money in never files money out, and the other way round.',
    input: inputOf({ row: TEXT, category: TEXT_OR_NULL }),
    refs: { row: ROW, category: CATEGORY },
    creates: null,
    alone: false,
    example: { row: 'ledger-row-waiting', category: 'category' },
  },
  {
    name: 'add-rule',
    about: [
      'A rule as Settings, Category rules makes it. From a row, by its ref, it looks for what the rule editor drafts from that row. Otherwise it looks for the conditions given.',
      'The rows waiting on To review that it settles are filed in the same change, and so are rows a person confirmed that it now files elsewhere, each warned on the card. Rows a rule filed, and rows another rule decides, keep their category, and the card warns on each the rules now disagree with.',
      'on no adds it switched off, and null adds it on. before is the rule it is tried just before, or null for after every rule. With name null Kuna names it from the category and the payee or account holder.',
      'Every condition must hold. A rule looks for something beyond the direction, such as words, an IBAN, a bank code or a card purchase.',
    ].join(' '),
    input: inputOf({ row: TEXT_OR_NULL, category: TEXT, name: RULE_NAME, on: FLAG_OR_NULL, before: TEXT_OR_NULL, ...RULE_FIELDS }),
    refs: { row: ROW, category: CATEGORY, before: RULE },
    spellings: ['payeeWords'],
    creates: RULE,
    alone: false,
    example: { row: null, category: 'category', name: null, on: null, before: null, ...CONDITIONS_LEFT, payeeWords: 'MARKET', direction: 'out', confidence: 'rule', note: null },
  },
  {
    name: 'change-rule',
    about:
      'Changes a rule: its name, what it looks for, its category, on or off, whether it settles rows or leaves them waiting, and where it is tried, before another rule or last. Null leaves a field as it is. Waiting rows it now settles are filed in the same change.',
    input: inputOf({
      rule: TEXT,
      name: { ...RULE_NAME, description: 'A new short name in lower case with hyphens, or null to keep it.' },
      category: TEXT_OR_NULL,
      on: FLAG_OR_NULL,
      before: TEXT_OR_NULL,
      last: FLAG_OR_NULL,
      ...RULE_FIELDS,
    }),
    refs: { rule: RULE, category: CATEGORY, before: RULE },
    spellings: ['payeeWords'],
    creates: null,
    alone: false,
    example: { rule: 'rule', name: null, category: null, on: 'no', before: null, last: null, ...CONDITIONS_LEFT, confidence: null, note: null },
  },
  {
    name: 'delete-rule',
    about: 'Deletes a rule. Rows it filed keep their category.',
    input: inputOf({ rule: TEXT }),
    refs: { rule: RULE },
    creates: null,
    alone: false,
    example: { rule: 'rule' },
  },
  {
    name: 'dismiss-suggestion',
    about:
      "Hides the suggestion on Settings, Category rules that holds this row: confirmed rows no rule files, or confirmed rows a rule files elsewhere. It stays hidden as the counterparty's new rows join it.",
    input: inputOf({ row: TEXT }),
    refs: { row: ROW },
    creates: null,
    alone: false,
    example: { row: 'ledger-row-confirmed' },
  },
  {
    name: 'restore-suggestion',
    about: 'Shows again a dismissed suggestion that holds this row.',
    input: inputOf({ row: TEXT }),
    refs: { row: ROW },
    creates: null,
    alone: false,
    example: { row: 'ledger-row-dismissed' },
  },
  {
    name: 'split-row',
    about: [
      "Splits a ledger row into parts in categories, or changes its split, as the row's Split does. by amount: each part's amount, above zero, and together the whole row.",
      'by share: each part a whole number such as 70 and 30, and Kuna works out the amounts so no cent is lost. A row a pack keeps whole cannot be split.',
    ].join(' '),
    input: inputOf({
      row: TEXT,
      by: { type: 'string', enum: ['amount', 'share'] },
      parts: { type: 'array', items: inputOf({ amount: NUMBER, category: TEXT, note: TEXT }) },
    }),
    refs: { row: ROW, 'parts.category': CATEGORY },
    creates: null,
    alone: false,
    example: {
      row: 'ledger-row',
      by: 'share',
      parts: [
        { amount: 70, category: 'category', note: '' },
        { amount: 30, category: 'category-other', note: 'Private part' },
      ],
    },
  },
  {
    name: 'delete-split',
    about: 'Takes the split off a row, which then counts whole in its own category again.',
    input: inputOf({ row: TEXT }),
    refs: { row: ROW },
    creates: null,
    alone: false,
    example: { row: 'ledger-row-split' },
  },
  {
    name: 'set-owner-share',
    about:
      "Sets the owner's private share of a payment in percent, from 0 to 100, or clears it with null. part is a split row's part by its place, larger first from 1, or null for a row that is not split. Only while owner pay is on, on operating cost, and on a row no longer waiting. An owner advance's share goes through change-owner-advance.",
    input: inputOf({ row: TEXT, part: { type: ['number', 'null'], description: 'The part by its place, larger first from 1, or null.' }, share: NUMBER_OR_NULL }),
    refs: { row: ROW },
    creates: null,
    alone: false,
    example: { row: 'ledger-row', part: null, share: 40 },
  },
  {
    name: 'flag-person',
    about: "Flags a row's counterparty as a person, so the chat sends the name under an alias from then on. Only a person takes a flag off, on To review.",
    input: inputOf({ row: TEXT }),
    refs: { row: ROW },
    creates: null,
    alone: false,
    example: { row: 'ledger-row' },
  },
]

/** The rows the pack's paired roles keep to one side, with core's. */
function pairSides() {
  return pairSidesWith(installedPack().workbook?.pairSides ?? {})
}

function fileRow(card: CompanyCard, step: ProposalStep): void {
  const field = fieldsOf(step)
  const row = rowOf(card, field['row'])
  const { settings } = card.workbook
  let verdict: RowVerdict | null
  if (field['category'] === null) {
    verdict = confirmation(row, settings)
    if (verdict === null) throw new StepRefused('That row has no category to confirm. Name one.')
  } else {
    const category = categoryOf(card, field['category'])
    if (!fitsPairSide(category.roles, row.amount, pairSides()))
      throw new StepRefused(`${category.slug} takes money ${row.amount > 0 ? 'out' : 'in'}, and this row is money ${row.amount > 0 ? 'in' : 'out'}.`)
    verdict = recategorisation(row, category.slug, settings)
    const against = ruleAgainst(row, category.slug, card.workbook.rules, categorisationContextOf(card.workbook))
    if (against !== null) {
      const names = displayNamesOf(card.workbook)
      const warning = `${transactionWords.changeDialog.ruleAgainst.before} ${against.ruleId} ${transactionWords.changeDialog.ruleAgainst.after(names.category(against.category), names.category(category.slug))}`
      card.note({ noun: LEDGER_RECORDS.noun, note: { label: row.counterparty || names.category(row.category), text: warning, tone: 'warning' } })
    }
  }
  fileRows(card.unit, card.records().ledger, [verdict], card.workbook.categories)
}

function confidenceOf(text: string | null, kept: RuleConfidence): RuleConfidence {
  if (text === null) return kept
  if (text !== 'rule' && text !== 'review') throw new StepRefused('confidence is rule, review or null.')
  return text
}

/** The rule a `before` field names, by its id, or null for none. */
function ruleIdOf(card: CompanyCard, value: unknown): string | null {
  if (value === null) return null
  const id = card.idOf(value).toLowerCase()
  const rule = card.workbook.rules.find((candidate) => candidate.id.toLowerCase() === id)
  if (rule === undefined) throw new StepRefused('That rule is no longer in the books.')
  return rule.id
}

/**
 * Writes a change of the rules as the rule editor saves it, after its checks and its back-test. In the same write it files the rows
 * still waiting that the rule settles, and re-files the rows a person confirmed that the rule now files elsewhere, each of which the
 * card warns on. A row another rule now decides, or a rule-filed row whose verdict changes, keeps its category with a warning.
 */
function writeRules(card: CompanyCard, change: RulesTabChange, settledBy: string | null): void {
  const { workbook } = card
  const rows = recordsOf(card.records().rules)
  const defined = new Set(workbook.categories.map((category) => category.slug))
  const context = categorisationContextOf(workbook)
  const preview = previewRulesChange(rows, change, defined, readRules(rows, defined).rules, workbook.transactions, context)
  if (preview.refusals.length > 0) throw new StepRefused(preview.refusals.join(' '))
  const refiled = settledBy === null ? [] : confirmedRowsRefiledBy(settledBy, preview.backtest.humanConflicts)
  if (settledBy === null) {
    writeRulesChange(card.unit, change)
  } else {
    writeRuleSave(card.unit, workbook, card.records(), change, settledBy, refiled)
  }
  const names = displayNamesOf(workbook)
  const label = (row: Transaction) => row.counterparty || names.category(row.category)
  for (const { transaction, after } of preview.backtest.humanConflicts.filter(({ transaction }) => !refiled.some((verdict) => verdict.id === transaction.id))) {
    card.note({ noun: LEDGER_RECORDS.noun, note: { label: label(transaction), text: words.ruleDisagrees(names.category(after.category)), tone: 'warning' } })
  }
  for (const { transaction, after } of preview.backtest.brokenAgreements) {
    card.note({ noun: LEDGER_RECORDS.noun, note: { label: label(transaction), text: words.ruleBreaksAgreement(names.category(after.category)), tone: 'warning' } })
  }
}

function addRule(card: CompanyCard, step: ProposalStep): void {
  const field = fieldsOf(step)
  const { workbook } = card
  const rules = readRules(recordsOf(card.records().rules), new Set(workbook.categories.map((category) => category.slug))).rules
  const category = categoryOf(card, field['category'])
  const row = field['row'] === null ? null : rowOf(card, field['row'])
  const start = row === null ? blankDraft(rules) : draftForRow({ ...row, category: category.slug }, workbook, categorisationContextOf(workbook), installedPack().workbook?.directionPairedRoles ?? [])
  const payeeWords = field['payeeWords'] as string | readonly string[] | null
  const holder = (Array.isArray(payeeWords) ? payeeWords[0] : payeeWords) || (row?.counterparty ?? '')
  const draft: RuleDraft = {
    ...start,
    id: ruleNameFrom(field['name'], rules, null) ?? ruleNameOf(category.slug, holder, rules),
    enabled: flagOf(field['on']) ?? true,
    category: category.slug,
    conditions: conditionsFromInput(start.conditions, field),
    confidence: confidenceOf(field['confidence'], start.confidence),
    note: (field['note'] as string | null) ?? start.note,
    before: field['before'] === null ? start.before : ruleIdOf(card, field['before']),
  }
  if (!looksForSomething(draft.conditions)) throw new StepRefused('A rule needs a row to draft from, or something to look for beyond the direction.')
  writeRules(card, draftChange(draft, rules, recordsOf(card.records().rules), null), draft.enabled ? draft.id : null)
  card.made(step.as, draft.id)
}

/** Whether a rule tests more than the direction, since a rule on the direction alone would file every row one way. */
function looksForSomething(conditions: readonly DraftCondition[]): boolean {
  return conditions.some((condition) => condition.column !== 'direction')
}

/** The name a step gives a rule, trimmed, or null when it gives none. A name another rule has is refused. */
function ruleNameFrom(value: unknown, rules: readonly Rule[], renamed: string | null): string | null {
  const name = typeof value === 'string' ? value.trim() : ''
  if (name === '') return null
  if (rules.some((rule) => rule.id.toLowerCase() === name.toLowerCase() && rule.id !== renamed))
    throw new StepRefused(`A rule is already named ${name}. Give another name, or null for Kuna to name it.`)
  return name
}

/** The rule a field names as the rule editor opens it, among the rules as the card's earlier steps left them. */
function openedRule(card: CompanyCard, value: unknown) {
  const rows = recordsOf(card.records().rules)
  const rules = readRules(rows, new Set(card.workbook.categories.map((category) => category.slug))).rules
  const id = card.idOf(value).toLowerCase()
  const rule = rules.find((candidate) => candidate.id.toLowerCase() === id)
  const opened = rule === undefined ? null : draftOfRule(rule, rows, rules)
  if (rule === undefined || opened === null) throw new StepRefused('That rule is no longer in the books.')
  return { rows, rules, id: rule.id, opened }
}

function changeRule(card: CompanyCard, step: ProposalStep): void {
  const field = fieldsOf(step)
  const { rows, rules, id, opened } = openedRule(card, field['rule'])
  const last = flagOf(field['last'])
  if (last === true && field['before'] !== null) throw new StepRefused('A rule is tried before another rule or last, not both.')
  const on = flagOf(field['on'])
  const draft: RuleDraft = {
    ...opened.draft,
    category: field['category'] === null ? opened.draft.category : categoryOf(card, field['category']).slug,
    enabled: on ?? opened.draft.enabled,
    conditions: conditionsFromInput(opened.draft.conditions, field),
    confidence: confidenceOf(field['confidence'], opened.draft.confidence),
    id: ruleNameFrom(field['name'], rules, id) ?? opened.draft.id,
    note: (field['note'] as string | null) ?? opened.draft.note,
    before: last === true ? null : field['before'] === null ? opened.draft.before : ruleIdOf(card, field['before']),
  }
  if (!looksForSomething(draft.conditions)) throw new StepRefused('A rule needs something to look for beyond the direction.')
  if (draft.before !== opened.draft.before) card.movesRule(id)
  writeRules(card, draftChange(draft, rules, rows, opened.edited), draft.enabled ? draft.id : null)
}

function deleteRule(card: CompanyCard, step: ProposalStep): void {
  const { opened } = openedRule(card, fieldsOf(step)['rule'])
  writeRules(card, { appended: null, edited: [], removed: opened.edited.expected }, null)
}

/** The suggestions of Settings, Category rules as it shows them, and those dismissed. */
function suggestionsOf(card: CompanyCard) {
  const { workbook } = card
  return withoutDismissed(ruleCoverage(workbook.transactions, workbook.rules, categorisationContextOf(workbook)), workbook.dismissals)
}

function holds(rows: readonly Transaction[], row: Transaction): boolean {
  return rows.some((candidate) => candidate.id === row.id)
}

function dismissSuggestion(card: CompanyCard, step: ProposalStep): void {
  const row = rowOf(card, fieldsOf(step)['row'])
  const { coverage } = suggestionsOf(card)
  const notCovered = coverage.notCovered.find((group) => holds(group.rows, row))
  const exception = coverage.exceptions.find((group) => holds(group.rows, row))
  const dismissal = notCovered !== undefined ? dismissalOfGroup('not-covered', notCovered, today()) : exception !== undefined ? dismissalOfGroup('exception', exception, today()) : null
  if (dismissal === null) throw new StepRefused('No suggestion on Category rules holds that row.')
  card.unit.of(DISMISSAL_WRITES).add(dismissal)
}

function restoreSuggestion(card: CompanyCard, step: ProposalStep): void {
  const row = rowOf(card, fieldsOf(step)['row'])
  const found = suggestionsOf(card).dismissed.find((entry) => entry.group !== null && holds(entry.group.rows, row))
  const stored = found === undefined ? null : recordWithId(card.records().dismissed, found.dismissal.id)
  if (stored === null) throw new StepRefused('No dismissed suggestion holds that row.')
  card.unit.of(DISMISSAL_WRITES).remove(stored.record)
}

/** The row's split parts as stored, larger first as the split shows them, or none for a row not split. */
function storedParts(card: CompanyCard, row: Transaction): readonly SplitTabRow[] {
  const split = card.workbook.splits.find((candidate) => candidate.row.id === row.id)
  if (split === undefined) return []
  const splits = card.records().splits
  return split.parts.map((part) => {
    const stored = recordWithId(splits, part.id)
    if (stored === null) throw new StepRefused("That row's split changed since it was read.")
    return stored.record
  })
}

/** The parts' amounts with the row's sign: as given, adding up to the row, or the row by the given shares with no cent lost. */
function partAmounts(row: Transaction, by: string, given: readonly number[]): readonly Money[] {
  const whole = absMoney(row.amount)
  let amounts: readonly Money[]
  if (by === 'share') {
    if (given.some((share) => !Number.isInteger(share) || share <= 0)) throw new StepRefused('Each share is a whole number above zero.')
    amounts = moneyParts(
      whole,
      given.map((share) => BigInt(share)),
    )
  } else {
    amounts = given.map((amount) => moneyFromAmount(amount))
    if (amounts.some((amount) => amount <= 0)) throw new StepRefused('Each part has an amount above zero.')
    if (sumMoney(amounts) !== whole) throw new StepRefused('The parts add up to the whole row, no more and no less.')
  }
  if (amounts.some((amount) => amount === 0)) throw new StepRefused('Each part has an amount above zero.')
  return row.amount < 0 ? amounts.map(negateMoney) : amounts
}

function splitRow(card: CompanyCard, step: ProposalStep): void {
  const field = fieldsOf(step)
  const row = rowOf(card, field['row'])
  const parts = field['parts'] as readonly { readonly amount: number; readonly category: string; readonly note: string }[]
  if (parts.length < 2) throw new StepRefused('A split has at least two parts.')
  const current = storedParts(card, row)
  const amounts = partAmounts(
    row,
    field['by'],
    parts.map((part) => part.amount),
  )
  const drafts = parts.map((part, at): SplitPartDraft => ({ amount: amounts[at]!, category: categoryOf(card, part.category).slug, note: part.note, opened: current[at] ?? null }))
  writeSplit(card.unit, row, current, drafts, card.workbook.categories)
}

function deleteSplit(card: CompanyCard, step: ProposalStep): void {
  const row = rowOf(card, fieldsOf(step)['row'])
  const current = storedParts(card, row)
  if (current.length === 0) throw new StepRefused('That row is not split.')
  writeSplit(card.unit, row, current, [], card.workbook.categories)
}

/** Where the share of a row or of its part sits, as Transactions sets it: only on operating cost, and on a row no longer waiting. */
function shareTargetOf(card: CompanyCard, row: Transaction, part: number | null): ShareTarget {
  if (!card.workbook.settings.ownerPayModule) throw new StepRefused('Owner shares show only while owner pay is on, on Settings, General.')
  const split = card.workbook.splits.find((candidate) => candidate.row.id === row.id)
  if (split === undefined) {
    if (part !== null) throw new StepRefused('That row is not split, so part is null.')
    if (row.bucket !== 'operating') throw new StepRefused('An owner share sits only on operating cost.')
    if (needsReview(row)) throw new StepRefused('That row still waits on To review, which files it with its category’s share.')
    return { holder: 'ledger', id: row.id }
  }
  const held = part === null ? undefined : split.parts[part - 1]
  if (held === undefined) throw new StepRefused(`That row is split in ${split.parts.length} parts, so part is 1 to ${split.parts.length}.`)
  if (held.bucket !== 'operating') throw new StepRefused('An owner share sits only on operating cost.')
  return { holder: 'split-part', id: held.id }
}

function setOwnerShare(card: CompanyCard, step: ProposalStep): void {
  const field = fieldsOf(step)
  const share = field['share'] === null ? null : typedOwnerShare(String(field['share']))
  if (share === undefined) throw new StepRefused('A share is a whole number from 0 to 100.')
  writeOwnerShare(card.unit, card.records(), shareTargetOf(card, rowOf(card, field['row']), field['part']), share)
}

function flagPerson(card: CompanyCard, step: ProposalStep): void {
  const counterparty = rowOf(card, fieldsOf(step)['row']).counterparty.trim()
  if (counterparty === '') throw new StepRefused('That row has no counterparty to flag.')
  treatPayeeAsPerson(card.unit, card.records().settings ?? NO_RECORDS, counterparty, true)
}

const PLANS: Readonly<Record<string, (card: CompanyCard, step: ProposalStep) => void>> = {
  'file-row': fileRow,
  'add-rule': addRule,
  'change-rule': changeRule,
  'delete-rule': deleteRule,
  'dismiss-suggestion': dismissSuggestion,
  'restore-suggestion': restoreSuggestion,
  'split-row': splitRow,
  'delete-split': deleteSplit,
  'set-owner-share': setOwnerShare,
  'flag-person': flagPerson,
}

/** What the chat can do to the ledger, its rules and the suggestions beside them, each through the screens' own write functions. */
export const LEDGER_OPERATIONS: CompanyOperationSet = {
  operations: OPERATIONS,
  planStep: (card, step) => PLANS[step.operation]!(card, step),
}
