import { settingName } from './settingNames'
import { WARNED_SETTING_KEYS } from './settingsOperations'
import { INVOICING_KINDS, invoicingDescriber } from './invoicingLines'
import { words } from './words'
import type { PackOperations } from '../companyAssistant'
import { ownerShareText } from '../../owner-share/domain/ownerShare'
import { classSharesDay, installedPack } from '../../packs/packContribution'
import { vatTreatmentLabel } from '../../settings/presentation/vatTreatmentLabel'
import { words as settingsWords } from '../../settings/presentation/words'
import { readRules } from '../../rules/domain/readRules'
import type { RuleTabRow } from '../../rules/domain/readRules'
import { conditionInWords } from '../../rules/domain/ruleSummary'
import { ACCOUNT_RECORDS, CATEGORY_RECORDS, DISMISSAL_RECORDS, LEDGER_RECORDS, RULE_RECORDS, SETTING_RECORDS, SPLIT_PART_RECORDS } from '../../workbook/domain/coreKinds'
import { displayName, displayNamesOf } from '../../workbook/domain/displayName'
import type { DisplayNames } from '../../workbook/domain/displayName'
import { isHumanConfirmed } from '../../workbook/domain/needsReview'
import { moneyFormatOf } from '../../settings/domain/settings'
import type { Workbook } from '../../workbook/domain/workbook'
import type { CardNote, ProposalGroup } from '../../../../shared/app/assistantOperations'
import { proposalGroups, withNotes } from '../../../../shared/app/proposalGroups'
import type { ProposalDescriber, ProposedRecord } from '../../../../shared/app/proposalGroups'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import type { Money } from '../../../../shared/money/money'
import type { CheckedWrite } from '../../../../shared/storage/application/recordWrites'
import type { RecordKind } from '../../../../shared/storage/domain/recordKind'

/** The fields Kuna keeps by itself, which no operation sets, so a card leaves them off. */
export const KEPT_BY_KUNA: ReadonlySet<string> = new Set(['id', 'rowId', 'signals', 'reviewReasons', 'reference', 'statement', 'balance', 'key'])

/** The fields that say where money goes, which a card warns on. */
const WARNS: ReadonlySet<string> = new Set(['iban', 'counterpartyIban'])

function fieldName(field: string): string {
  return (words.fields as Readonly<Record<string, string>>)[field] ?? field
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

/** A rule as the card says it: what it looks for, where it files, and whether it is off or leaves rows waiting. Its name is the line's label. */
function ruleInWords(row: RuleTabRow, workbook: Workbook, names: DisplayNames): string | null {
  const [rule] = readRules([row], new Set(workbook.categories.map((category) => category.slug))).rules
  if (rule === undefined) return null
  const conditions = rule.conditions.map(conditionInWords).join(', ')
  return [words.rule(conditions, names.category(rule.category)), ...(rule.enabled ? [] : [words.ruleOff]), ...(rule.confidence === 'review' ? [words.ruleReview] : [])].join(', ')
}

/** A value as a person reads it on screen: money in the books' format, days in words, categories and accounts by their names, and a category's bucket, VAT and tax class as the categories editor names them. */
function shownValue(kind: RecordKind<unknown>, field: string, record: ProposedRecord, workbook: Workbook, names: DisplayNames): string | null {
  const value = record[field]
  if (value === null || value === undefined || value === '') return null
  if (isKind(kind, RULE_RECORDS, record) && field === 'fields') return ruleInWords(record, workbook, names)
  const money = (amount: Money) => formatMoney(amount, 'negative', moneyFormatOf(workbook.settings))
  if (isKind(kind, LEDGER_RECORDS, record) && field === 'amount') return money(record.amount)
  if (isKind(kind, SPLIT_PART_RECORDS, record) && field === 'amount') return money(record.amount)
  if (isKind(kind, LEDGER_RECORDS, record) && field === 'date') return dayLabel(record.date)
  if (isKind(kind, DISMISSAL_RECORDS, record) && field === 'dismissedOn') return record.dismissedOn === null ? null : dayLabel(record.dismissedOn)
  if (isKind(kind, LEDGER_RECORDS, record) && field === 'flaggedBy') return filedBy(record.flaggedBy)
  if ((isKind(kind, LEDGER_RECORDS, record) || isKind(kind, SPLIT_PART_RECORDS, record) || isKind(kind, CATEGORY_RECORDS, record)) && field === 'ownerShare') {
    const share = ownerShareText(record.ownerShare)
    return share === null ? null : `${share} %`
  }
  if (field === 'category' && !isKind(kind, CATEGORY_RECORDS, record)) return names.category(String(value))
  if (field === 'account' && !isKind(kind, ACCOUNT_RECORDS, record)) return names.account(String(value))
  if (isKind(kind, CATEGORY_RECORDS, record) && field === 'colour') return record.colour.swatch?.name ?? words.bucketColour
  if (isKind(kind, DISMISSAL_RECORDS, record) && field === 'kind') return words.suggestion[record.kind]
  if (isKind(kind, CATEGORY_RECORDS, record) && field === 'bucket') return settingsWords.categories.bucketChoice(record.bucket)
  if (isKind(kind, CATEGORY_RECORDS, record) && field === 'vat') return vatTreatmentLabel(record.vat)
  if (isKind(kind, CATEGORY_RECORDS, record) && field === 'roles')
    return record.roles.length === 0 ? null : record.roles.map((role) => installedPack().categoryClassHelp(role, classSharesDay(workbook))?.name ?? role).join(', ')
  if (Array.isArray(value)) return value.length === 0 ? null : value.join(', ')
  return String(value)
}

/** What the record is called on screen: a row by its counterparty or else its category, a part by its category, a setting by its form's name, a rule by its id, and others by their name. */
function labelOf(kind: RecordKind<unknown>, record: ProposedRecord, fallback: string, names: DisplayNames, packSettingNames: Readonly<Record<string, string>>): string {
  if (isKind(kind, LEDGER_RECORDS, record)) return record.counterparty !== '' ? record.counterparty : names.category(record.category)
  if (isKind(kind, SPLIT_PART_RECORDS, record)) return names.category(record.category)
  if (isKind(kind, CATEGORY_RECORDS, record)) return displayName(record.slug, record.label)
  if (isKind(kind, ACCOUNT_RECORDS, record)) return displayName(record.slug, record.label)
  if (isKind(kind, SETTING_RECORDS, record)) return settingName(record.key, packSettingNames)
  if (isKind(kind, DISMISSAL_RECORDS, record)) return words.suggestion[record.kind]
  if (isKind(kind, RULE_RECORDS, record)) return String(record.fields['rule'] ?? fallback)
  return fallback
}

/** Whether a field says where money or mail goes, or changes how every amount reads, as the record will hold it. */
function warns(kind: RecordKind<unknown>, field: string, after: ProposedRecord | null): boolean {
  if (WARNS.has(field)) return true
  if (after !== null && isKind(kind, SETTING_RECORDS, after) && field === 'value') return WARNED_SETTING_KEYS.has(after.key.trim().toLowerCase())
  if (after !== null && isKind(kind, RULE_RECORDS, after) && field === 'fields') return String(after.fields['counterparty_iban'] ?? '') !== ''
  return false
}

/** Whether the change files a row a person confirmed under another category. */
function movesConfirmed(kind: RecordKind<unknown>, before: ProposedRecord, after: ProposedRecord): boolean {
  return isKind(kind, LEDGER_RECORDS, before) && isKind(kind, LEDGER_RECORDS, after) && isHumanConfirmed(before) && before.category !== '' && before.category !== after.category
}

/** What a checked write does, grouped by verb and kind in the order it does it, in Kuna's words, with the card's notes on the group of their kind. Each kind reads through its own screens' describer. */
export function proposalGroupsOf(checked: CheckedWrite, workbook: Workbook, notes: readonly CardNote[], pack: PackOperations | null): readonly ProposalGroup[] {
  const names = displayNamesOf(workbook)
  const packs = pack?.describer(workbook) ?? null
  const core: ProposalDescriber = {
    keptByKuna: KEPT_BY_KUNA,
    fieldName,
    shown: (kind, field, record) => shownValue(kind, field, record, workbook, names),
    label: (kind, record, fallback) => labelOf(kind, record, fallback, names, packs?.settingNames ?? {}),
    warns,
    movesConfirmed,
  }
  const invoicing = invoicingDescriber(workbook)
  const groups = proposalGroups(checked, (kind) => (packs?.kinds.has(kind.name) === true ? packs : INVOICING_KINDS.has(kind.name) ? invoicing : core))
  return withNotes(groups, notes)
}
