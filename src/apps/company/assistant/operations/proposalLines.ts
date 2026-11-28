import { settingName } from './settingNames'
import { classOf, rolesBesideClass } from '../../categories/domain/categoryClasses'
import { words as cardWords } from '../../../../shared/app/words'
import { WARNED_SETTING_KEYS } from './settingsOperations'
import { INVOICING_KINDS, invoicingDescriber } from './invoicingLines'
import { words } from './words'
import { namingBooks } from './namingBooks'
import type { PackOperations } from '../companyAssistant'
import { ownerShareText } from '../../owner-share/domain/ownerShare'
import { classSharesDay, installedPack } from '../../packs/packContribution'
import { vatTreatmentLabel } from '../../categories/presentation/words'
import { sourcesInWords } from '../../settings/presentation/sourcesInWords'
import { TABLE_RECIPE_FIELDS } from '../../imports/domain/tableRecipes'
import { words as importWords } from '../../imports/presentation/words'
import { statementInWords } from '../../imports/presentation/statementInWords'
import { recipeInWords } from '../../../../shared/recipes/presentation/recipeInWords'
import { placementWords } from '../../rules/presentation/placementWords'
import { words as ruleFormWords } from '../../rules/presentation/words'
import { readRules, ruleLabelIdsIn } from '../../rules/domain/readRules'
import type { RuleLabelIds, RuleTabRow } from '../../rules/domain/readRules'
import { conditionInWords } from '../../rules/domain/ruleSummary'
import {
  ACCOUNT_RECORDS,
  CATEGORY_RECORDS,
  DISMISSAL_RECORDS,
  HELD_STATEMENT_RECORDS,
  ITEM_RECORDS,
  LABEL_RECORDS,
  LEDGER_RECORDS,
  RECIPE_RECORDS,
  RULE_RECORDS,
  SETTING_RECORDS,
  SPLIT_PART_RECORDS,
} from '../../workbook/domain/coreKinds'
import { displayName, displayNamesOf } from '../../workbook/domain/displayName'
import type { DisplayNames } from '../../workbook/domain/displayName'
import { isHumanConfirmed } from '../../workbook/domain/needsReview'
import { invoiceNumberOf } from '../../workbook/domain/invoicesReading'
import { moneyFormatOf } from '../../settings/domain/settings'
import { isDefinedBucket } from '../../workbook/domain/bucket'
import type { Workbook } from '../../workbook/domain/workbook'
import type { CompanyBooks } from '../../workbook/domain/readWorkbook'
import { storesItems } from '../../workbook/domain/rowItems'
import type { CardNote, ProposalField, ProposalGroup, ProposalLine } from '../../../../shared/app/assistantOperations'
import { fieldNameIn, proposalGroups, withNotes } from '../../../../shared/app/proposalGroups'
import type { CardField, ProposalDescriber, ProposedRecord } from '../../../../shared/app/proposalGroups'
import type { Label } from '../../../../shared/categorising/domain/labels'
import type { SavedRecipe } from '../../../../shared/recipes/domain/savedRecipe'
import type { SettingRow } from '../../../../shared/storage/domain/settingRows'
import type { AccountRecord } from '../../workbook/domain/accountsReading'
import type { CategoryRecord } from '../../workbook/domain/categoriesReading'
import type { Dismissal } from '../../workbook/domain/dismissals'
import type { HeldStatement } from '../../workbook/domain/heldStatements'
import type { LedgerEntry } from '../../workbook/domain/ledgerReading'
import type { ItemRecord, SplitTabRow } from '../../workbook/domain/splitsReading'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import type { Money } from '../../../../shared/money/money'
import type { CheckedWrite } from '../../../../shared/storage/application/recordWrites'
import type { RecordKind } from '../../../../shared/storage/domain/recordKind'
import { inTryingOrder } from '../../../../shared/categorising/domain/ruleOrder'
import type { Rule } from '../../rules/domain/rule'
import { cellText } from '../../../../shared/text/cellText'

const KEPT_FIELDS = ['id', 'rowId', 'signals', 'reviewReasons', 'reference', 'statement', 'balance', 'key', 'row', 'ownerPart', 'mailId'] as const

/** The fields Kuna keeps by itself, which no operation sets, so a card leaves them off. */
export const KEPT_BY_KUNA: ReadonlySet<string> = new Set(KEPT_FIELDS)

/** The fields that say where money goes, which a card warns on. */
const WARNS: ReadonlySet<string> = new Set(['iban', 'counterpartyIban'])

/** The records the chat writes that the core card reads, whose fields it names, with the tax class a category's roles read as. */
type CardRecord = CategoryRecord | Dismissal | LedgerEntry | SplitTabRow | ItemRecord | SettingRow | RuleTabRow | Label | SavedRecipe | AccountRecord | HeldStatement

const FIELD_NAMES: Readonly<Record<CardField<CardRecord, (typeof KEPT_FIELDS)[number]> | 'taxClass', string>> = words.fields

/** A field's name on the card. */
export function fieldName(field: string): string {
  return fieldNameIn(FIELD_NAMES, field)
}

/** Whether the record is of the kind, so its fields read with their types. */
function isKind<R>(kind: RecordKind<unknown>, of: RecordKind<R>, record: ProposedRecord): record is ProposedRecord & R {
  return kind.name === of.name && typeof record === 'object'
}

/** Who filed a row, in Kuna's words, never the review label it holds. */
function filedBy(flaggedBy: string): string | null {
  if (flaggedBy === '') return null
  if (flaggedBy === 'rule' || flaggedBy === 'ai') return words.filedBy[flaggedBy]
  return words.filedBy.person
}

/** A rule as the card says it: what it looks for, where it files, the labels it puts on, and whether it is off or leaves rows waiting. Its name is the line's label. */
function ruleInWords(row: RuleTabRow, workbook: Workbook, ruleLabels: RuleLabelIds, names: DisplayNames): string | null {
  const [rule] = readRules([row], new Set(workbook.categories.map((category) => category.slug)), ruleLabels).rules
  if (rule === undefined) return null
  const conditions = rule.conditions.map(conditionInWords).join(', ')
  const labels = (rule.labels ?? []).map((id) => workbook.labels.find((label) => label.id === id)?.name ?? '')
  return [
    words.rule(conditions, names.category(rule.category)),
    ...(labels.length === 0 ? [] : [words.ruleLabels(labels)]),
    ...(rule.enabled ? [] : [words.ruleOff]),
    ...(rule.confidence === 'review' ? [words.ruleReview] : []),
  ].join(', ')
}

/**
 * A value as a person reads it on screen: money in the books' format, days in words, categories and accounts by their names, a category's bucket, VAT and tax class as the
 * categories editor names them, where an account's rows come in from as the accounts editor says it, and a recipe in plain words.
 */
function shownValue(kind: RecordKind<unknown>, field: string, record: ProposedRecord, workbook: Workbook, ruleLabels: RuleLabelIds, names: DisplayNames): string | null {
  const value = record[field]
  if (value === null || value === undefined || value === '') return null
  if (isKind(kind, RULE_RECORDS, record) && field === 'fields') return ruleInWords(record, workbook, ruleLabels, names)
  const money = (amount: Money) => formatMoney(amount, 'negative', moneyFormatOf(workbook.settings))
  if (isKind(kind, LEDGER_RECORDS, record) && field === 'amount') return money(record.amount)
  if ((isKind(kind, SPLIT_PART_RECORDS, record) || isKind(kind, ITEM_RECORDS, record)) && field === 'amount') return money(record.amount)
  if (isKind(kind, LEDGER_RECORDS, record) && field === 'date') return dayLabel(record.date)
  if (isKind(kind, DISMISSAL_RECORDS, record) && field === 'dismissedOn') return record.dismissedOn === null ? null : dayLabel(record.dismissedOn)
  if (isKind(kind, HELD_STATEMENT_RECORDS, record) && field === 'mailedOn') return dayLabel(record.mailedOn)
  if (isKind(kind, HELD_STATEMENT_RECORDS, record) && field === 'passedOverOn') return record.passedOverOn === null ? null : dayLabel(record.passedOverOn)
  if (isKind(kind, LEDGER_RECORDS, record) && field === 'flaggedBy') return filedBy(record.flaggedBy)
  if ((isKind(kind, LEDGER_RECORDS, record) || isKind(kind, SPLIT_PART_RECORDS, record) || isKind(kind, ITEM_RECORDS, record) || isKind(kind, CATEGORY_RECORDS, record)) && field === 'ownerShare') {
    const share = ownerShareText(record.ownerShare)
    return share === null ? null : `${share} %`
  }
  if (isKind(kind, ITEM_RECORDS, record) && field === 'invoice')
    return record.invoice === null ? null : (workbook.invoices.find((invoice) => invoice.id === record.invoice)?.number ?? invoiceNumberOf(record.invoice))
  if (isKind(kind, ITEM_RECORDS, record) && field === 'labels')
    return record.labels.length === 0 ? null : record.labels.map((id) => workbook.labels.find((label) => label.id === id)?.name ?? id).join(', ')
  if (field === 'category' && !isKind(kind, CATEGORY_RECORDS, record)) return names.category(String(value))
  if (field === 'account' && !isKind(kind, ACCOUNT_RECORDS, record)) return names.account(String(value))
  if (isKind(kind, CATEGORY_RECORDS, record) && field === 'colour') return record.colour.swatch?.name ?? words.bucketColour
  if (isKind(kind, CATEGORY_RECORDS, record) && field === 'family') return displayName(record.family) === bucketName(record.bucket, workbook) ? null : displayName(record.family)
  if (isKind(kind, DISMISSAL_RECORDS, record) && field === 'kind') return words.suggestion[record.kind]
  if (isKind(kind, CATEGORY_RECORDS, record) && field === 'bucket') return bucketName(record.bucket, workbook)
  if (isKind(kind, CATEGORY_RECORDS, record) && field === 'vat') return vatTreatmentLabel(record.vat)
  if (isKind(kind, CATEGORY_RECORDS, record) && field === 'taxClass') return installedPack().categoryClassHelp(String(value), classSharesDay(workbook))?.name ?? String(value)
  if (isKind(kind, CATEGORY_RECORDS, record) && field === 'roles') return record.roles.length === 0 ? null : record.roles.join(', ')
  if (isKind(kind, ACCOUNT_RECORDS, record) && field === 'sources') return record.sources === null ? null : sourcesInWords(record.sources)
  if (isKind(kind, RECIPE_RECORDS, record) && field === 'recipe') return recipeInWords(record, TABLE_RECIPE_FIELDS, importWords.recipe)
  if (Array.isArray(value)) return value.length === 0 ? null : value.join(', ')
  if (typeof value === 'boolean') return value ? cardWords.yes : cardWords.no
  return String(value)
}

/** A bucket by the name the books give it, as the filters show it, or as stored for one Kuna does not know. */
function bucketName(bucket: string, workbook: Workbook): string {
  return isDefinedBucket(bucket) ? workbook.settings.bucketLabels[bucket] : bucket
}

/**
 * What the record is called on screen: a row by its counterparty or else its category, a held statement by its number and day, a part of books from before items by its
 * category, an item by its row's counterparty and day and its category, a setting by its form's name, a rule by its id, and others by their name.
 */
function labelOf(kind: RecordKind<unknown>, record: ProposedRecord, fallback: string, workbook: Workbook, names: DisplayNames, packSettingNames: Readonly<Record<string, string>>): string {
  if (isKind(kind, LEDGER_RECORDS, record)) return record.counterparty !== '' ? record.counterparty : names.category(record.category)
  if (isKind(kind, SPLIT_PART_RECORDS, record)) return names.category(record.category)
  if (isKind(kind, ITEM_RECORDS, record)) {
    const row = workbook.transactions.find((transaction) => transaction.rowId === record.row)
    return [row?.counterparty ?? '', row === undefined ? '' : dayLabel(row.date), names.category(record.category)].filter((part) => part !== '').join(' · ')
  }
  if (isKind(kind, LABEL_RECORDS, record)) return record.name
  if (isKind(kind, CATEGORY_RECORDS, record)) return displayName(record.slug, record.label)
  if (isKind(kind, ACCOUNT_RECORDS, record)) return displayName(record.slug, record.label)
  if (isKind(kind, SETTING_RECORDS, record)) return settingName(record.key, packSettingNames)
  if (isKind(kind, DISMISSAL_RECORDS, record)) return words.suggestion[record.kind]
  if (isKind(kind, HELD_STATEMENT_RECORDS, record)) return statementInWords(record.label)
  if (isKind(kind, RULE_RECORDS, record)) return String(record.fields['rule'] ?? fallback)
  return fallback
}

/** A category as the card reads it: its tax class on a line of its own, then the roles that carry no class. */
function categoryReading(kind: RecordKind<unknown>, record: ProposedRecord): ProposedRecord {
  if (!isKind(kind, CATEGORY_RECORDS, record)) return record
  const classes = installedPack().workbook?.categoryClasses ?? []
  const taxClass = classOf(record.roles, classes)?.role ?? ''
  const others = rolesBesideClass(record.roles, classes)
  return Object.fromEntries(
    Object.entries(record).flatMap(([field, value]) =>
      field === 'roles'
        ? [
            ['taxClass', taxClass],
            ['roles', others],
          ]
        : [[field, value]],
    ),
  )
}

/** Whether a field says where money or mail goes, or changes how every amount reads, as the record will hold it. */
function warns(kind: RecordKind<unknown>, field: string, after: ProposedRecord | null): boolean {
  if (WARNS.has(field)) return true
  if (after !== null && isKind(kind, SETTING_RECORDS, after) && field === 'value') return WARNED_SETTING_KEYS.has(after.key.trim().toLowerCase())
  if (after !== null && isKind(kind, RULE_RECORDS, after) && field === 'fields') return String(after.fields['counterparty_iban'] ?? '') !== ''
  return false
}

/** Whether the change files a row a person confirmed under another category. In books with an items tab the category sits on the row's item. */
function movesConfirmed(kind: RecordKind<unknown>, before: ProposedRecord, after: ProposedRecord, workbook: Workbook): boolean {
  if (before['category'] === '' || before['category'] === after['category']) return false
  if (isKind(kind, LEDGER_RECORDS, before)) return isHumanConfirmed(before)
  if (!isKind(kind, ITEM_RECORDS, before)) return false
  const row = workbook.transactions.find((transaction) => transaction.rowId === before.row)
  return row !== undefined && isHumanConfirmed(row)
}

/** Where a rule is tried among the rules, with the rule tried next by its name now. */
function placementOf(rules: readonly Pick<Rule, 'id' | 'order'>[], id: string, nameNow: (id: string) => string): string {
  const ordered = inTryingOrder(rules)
  const at = ordered.findIndex((rule) => rule.id.toLowerCase() === id.toLowerCase())
  const next = ordered[at + 1]
  return placementWords(next === undefined ? null : nameNow(next.id), at === 0)
}

/**
 * Each rule a step moves, by its name after the change in lower case, with where it is tried before and after. The order number
 * stays off the card, so a move reads by the rule it now comes before. `moved` holds the rules' names before the change.
 */
function movedRules(checked: CheckedWrite, rules: readonly Rule[], moved: ReadonlySet<string>): ReadonlyMap<string, ProposalField> {
  const fieldsOf = (record: unknown) => (record as RuleTabRow).fields
  const idOf = (record: unknown) => cellText(fieldsOf(record).rule)
  const ruleChanges = checked.changes.map(({ change }) => change).filter((change) => change.kind.name === RULE_RECORDS.name)
  const after = new Map(rules.map((rule): [string, Pick<Rule, 'id' | 'order'>] => [rule.id.toLowerCase(), rule]))
  const renamed = new Map<string, string>()
  for (const change of ruleChanges) {
    if (change.verb === 'change' || change.verb === 'remove') after.delete(idOf(change.before).toLowerCase())
    if (change.verb === 'change' || change.verb === 'add') after.set(idOf(change.after).toLowerCase(), { id: idOf(change.after), order: Number(cellText(fieldsOf(change.after).order)) })
    if (change.verb === 'change') renamed.set(idOf(change.before).toLowerCase(), idOf(change.after))
  }
  const placements = new Map<string, ProposalField>()
  for (const change of ruleChanges) {
    if (change.verb !== 'change' || !moved.has(idOf(change.before).toLowerCase())) continue
    const was = placementOf(rules, idOf(change.before), (id) => renamed.get(id.toLowerCase()) ?? id)
    const will = placementOf([...after.values()], idOf(change.after), (id) => id)
    if (was === will) continue
    placements.set(idOf(change.after).toLowerCase(), { name: ruleFormWords.form.tried, before: was, after: will, warns: false })
  }
  return placements
}

/** A category's label is its name on screen, or its short name in words, so an add or a removal leaves both off its line. */
const NAMED_IN_LABEL: ReadonlySet<string> = new Set(['slug', 'label'])

/** The fields a record's label names on the card, which an add or a removal leaves off its line. */
export function fieldsInLabel(kind: RecordKind<unknown>): ReadonlySet<string> {
  return kind.name === CATEGORY_RECORDS.name ? NAMED_IN_LABEL : new Set()
}

/**
 * What a checked write does, grouped by verb and kind in the order it does it, in Kuna's words, with the card's notes on the group of their kind.
 * Each kind reads through its own screens' describer. `after` is the books as the card's steps leave them, which names what the card adds.
 */
export function proposalGroupsOf(
  checked: CheckedWrite,
  books: CompanyBooks,
  after: Workbook,
  notes: readonly CardNote[],
  pack: PackOperations | null,
  moved: ReadonlySet<string>,
): readonly ProposalGroup[] {
  const { workbook } = books
  const named = namingBooks(workbook, after, pack?.withRemovedRecords ?? null)
  const names = displayNamesOf(named)
  const ruleLabels = ruleLabelIdsIn(named.labels, storesItems(books.records))
  const packs = pack?.describer(named) ?? null
  const placements = movedRules(checked, workbook.rules, moved)
  const core: ProposalDescriber = {
    keptByKuna: KEPT_BY_KUNA,
    fieldName,
    shown: (kind, field, record) => shownValue(kind, field, record, named, ruleLabels, names),
    label: (kind, record, fallback) => labelOf(kind, record, fallback, named, names, packs?.settingNames ?? {}),
    reading: categoryReading,
    inLabel: fieldsInLabel,
    warns,
    movesConfirmed: (kind, before, after) => movesConfirmed(kind, before, after, workbook),
    checked: (kind, record, line): ProposalLine => {
      if (!isKind(kind, RULE_RECORDS, record)) return line
      const moved = placements.get(cellText(record.fields.rule).toLowerCase())
      const said = line.fields.filter((field) => field.before !== field.after)
      return { ...line, fields: moved === undefined ? said : [...said, moved] }
    },
  }
  const invoicing = invoicingDescriber(named)
  // A rule renumbered to make room for a move keeps its place among the rules, so it shows nothing and stays off the card.
  const groups = proposalGroups(checked, (kind) => (packs?.kinds.has(kind.name) === true ? packs : INVOICING_KINDS.has(kind.name) ? invoicing : core)).map((group) =>
    group.noun === RULE_RECORDS.noun ? { ...group, lines: group.lines.filter((line) => line.fields.length > 0 || line.warning !== null).map((line) => ({ ...line, identifier: true })) } : group,
  )
  return withNotes(groups, notes)
}
