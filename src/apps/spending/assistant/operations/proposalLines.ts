import type { Account } from '../../workbook/domain/account'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import { ACCOUNT_RECORDS, BUDGET_RECORDS, CATEGORY_RECORDS, RULE_RECORDS, TRANSACTION_RECORDS } from '../../workbook/domain/spendingKinds'
import { words } from '../words'
import type { ProposalField, ProposalGroup, ProposalLine } from '../../../../shared/app/assistantOperations'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { monthLabel } from '../../../../shared/calendar/monthLabel'
import { EURO } from '../../../../shared/money/currencyCode'
import { DEFAULT_MONEY_FORMAT, formatAccountMoney, formatMoney } from '../../../../shared/money/moneyFormat'
import type { CheckedWrite } from '../../../../shared/storage/application/recordWrites'
import type { RecordKind, RecordNoun } from '../../../../shared/storage/domain/recordKind'

/** The fields Kuna keeps by itself, which no operation sets, so a card leaves them off. */
export const KEPT_BY_KUNA: ReadonlySet<string> = new Set(['id', 'order', 'colour', 'categorisedBy', 'source', 'importKey', 'statement', 'movedAt', 'pocket', 'pair', 'description'])

/** The fields that say where money or mail goes, which the owner lets a model fill with a warning on the field. */
const WARNS: ReadonlySet<string> = new Set(['iban', 'counterpartyIban', 'value'])

type StoredRecord = Readonly<Record<string, unknown>>

function fieldName(field: string): string {
  return (words.proposals.fields as Readonly<Record<string, string>>)[field] ?? field
}

/** Whether the record is of the kind, so its fields read with their types. */
function isKind<R>(kind: RecordKind<unknown>, of: RecordKind<R>, record: StoredRecord): record is StoredRecord & R {
  return kind.name === of.name && typeof record === 'object'
}

/** The currency of an account a record is on, or of the account itself. */
function currencyOf(record: StoredRecord, book: SpendingBook): Account['currency'] | null {
  return book.accounts.find((account) => account.id === record['account'] || account.id === record['id'])?.currency ?? null
}

/** A value as a person reads it on screen: an account's amount in its own currency, a limit in euros, a day and a month in words, a name for a record it points at, and a rule's words. */
function shownValue(kind: RecordKind<unknown>, field: string, record: StoredRecord, book: SpendingBook, namesOf: ReadonlyMap<unknown, string>): string | null {
  const value = record[field]
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'boolean') return value ? words.proposals.yes : words.proposals.no
  if (isKind(kind, RULE_RECORDS, record) && field === 'condition') {
    return record.condition.column === 'counterparty_iban' ? words.proposals.ibanRule(record.condition.iban) : record.condition.fragment
  }
  if (isKind(kind, TRANSACTION_RECORDS, record) && field === 'amount') {
    const currency = currencyOf(record, book)
    return currency === null ? null : formatAccountMoney(record.amount, currency)
  }
  if (isKind(kind, ACCOUNT_RECORDS, record) && field === 'opening') return formatAccountMoney(record.opening, record.currency)
  if (isKind(kind, BUDGET_RECORDS, record) && field === 'amount') return formatMoney(record.amount, 'negative', { ...DEFAULT_MONEY_FORMAT, currency: EURO })
  if (isKind(kind, BUDGET_RECORDS, record) && field === 'from') return monthLabel(record.from)
  if (isKind(kind, TRANSACTION_RECORDS, record) && field === 'date') return dayLabel(record.date)
  if (isKind(kind, ACCOUNT_RECORDS, record) && field === 'openedOn') return dayLabel(record.openedOn)
  return namesOf.get(value) ?? String(value)
}

/** What the record is called on screen: an entry by its payee or else its category, a rule by the payee or IBAN it files, a limit by its category, and others by their name. */
function labelOf(kind: RecordKind<unknown>, record: StoredRecord, fallback: string, namesOf: ReadonlyMap<unknown, string>): string {
  if (isKind(kind, TRANSACTION_RECORDS, record)) return record.payee !== '' ? record.payee : (namesOf.get(record.category) ?? fallback)
  if (isKind(kind, RULE_RECORDS, record)) return record.condition.column === 'counterparty_iban' ? words.proposals.ibanRule(record.condition.iban) : record.condition.fragment
  if (isKind(kind, BUDGET_RECORDS, record)) return namesOf.get(record.category) ?? fallback
  if (isKind(kind, ACCOUNT_RECORDS, record) || isKind(kind, CATEGORY_RECORDS, record)) return record.name
  return fallback
}

function lineOf(kind: RecordKind<unknown>, fallback: string, before: StoredRecord | null, after: StoredRecord | null, book: SpendingBook, namesOf: ReadonlyMap<unknown, string>): ProposalLine {
  const names = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])].filter((field) => !KEPT_BY_KUNA.has(field))
  const altered = before !== null && after !== null ? names.filter((field) => JSON.stringify(before[field]) !== JSON.stringify(after[field])) : after !== null ? names : []
  const fields = altered.flatMap((field): ProposalField[] => {
    const was = before === null ? null : shownValue(kind, field, before, book, namesOf)
    const will = after === null ? null : shownValue(kind, field, after, book, namesOf)
    const warns = WARNS.has(field) || (field === 'condition' && after !== null && isKind(kind, RULE_RECORDS, after) && after.condition.column === 'counterparty_iban')
    return was === null && will === null ? [] : [{ name: fieldName(field), before: was, after: will, warns }]
  })
  const shown = after ?? before
  return { label: shown === null ? fallback : labelOf(kind, shown, fallback, namesOf), fields: [...fields.filter((field) => field.warns), ...fields.filter((field) => !field.warns)] }
}

/** What a checked write does, grouped by verb and kind in the order it does it, in Kuna's words and never the model's. */
export function proposalGroupsOf(checked: CheckedWrite, book: SpendingBook): readonly ProposalGroup[] {
  const namesOf = new Map<unknown, string>([...book.categories, ...book.accounts].map((record) => [record.id, record.name]))
  checked.changes.forEach(({ change }) => {
    if (change.verb === 'add' && 'name' in (change.after as object) && 'id' in (change.after as object)) namesOf.set((change.after as { id: string }).id, (change.after as { name: string }).name)
  })
  const groups = new Map<string, { verb: ProposalGroup['verb']; noun: RecordNoun; lines: ProposalLine[] }>()
  checked.changes.forEach(({ change }, at) => {
    if (change.verb === 'repair' || change.verb === 'discard') return
    const key = `${change.verb}/${change.kind.name}`
    const group = groups.get(key) ?? { verb: change.verb, noun: change.kind.noun, lines: [] }
    groups.set(key, group)
    const fallback = checked.written[at]?.label ?? checked.found[at]?.label ?? ''
    const before = change.verb === 'add' ? null : (change.before as StoredRecord)
    const after = change.verb === 'remove' ? null : (change.after as StoredRecord)
    group.lines.push(lineOf(change.kind, fallback, before, after, book, namesOf))
  })
  return [...groups.values()]
}
