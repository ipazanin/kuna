import { words as accountWords } from '../../accounts/presentation/words'
import { words as categoryWords } from '../../categories/presentation/words'
import type { StatementDryRun } from '../../statements/domain/statementDryRun'
import type { Account } from '../../workbook/domain/account'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import { ACCOUNT_RECORDS, BUDGET_RECORDS, CATEGORY_RECORDS, LINE_RECORDS, RECEIPT_RECORDS, RULE_RECORDS, TRANSACTION_RECORDS } from '../../workbook/domain/spendingKinds'
import { words } from '../words'
import type { CardStatement, CopiedRows } from './statementImport'
import type { CardNote, ProposalGroup, ProposalNote } from '../../../../shared/app/assistantOperations'
import { proposalGroups, withNotes } from '../../../../shared/app/proposalGroups'
import type { ProposalDescriber, ProposedRecord } from '../../../../shared/app/proposalGroups'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { swatchOf } from '../../../../shared/charts/swatches'
import { monthLabel } from '../../../../shared/calendar/monthLabel'
import { EURO } from '../../../../shared/money/currencyCode'
import { DEFAULT_MONEY_FORMAT, formatAccountMoney, formatMoney } from '../../../../shared/money/moneyFormat'
import type { CheckedWrite } from '../../../../shared/storage/application/recordWrites'
import type { RecordKind } from '../../../../shared/storage/domain/recordKind'
import { copiedStatementRowsWarning } from '../../../../shared/ai/presentation/copiedRowsWords'
import { plural } from '../../../../shared/text/translation'

/** The fields Kuna keeps by itself, which no operation sets, so a card leaves them off. */
export const KEPT_BY_KUNA: ReadonlySet<string> = new Set(['id', 'categorisedBy', 'source', 'importKey', 'statement', 'movedAt', 'pocket', 'pair', 'description', 'transaction', 'receipt'])

/** The fields that say where money or mail goes, which the owner lets a model fill with a warning on the field. */
const WARNS: ReadonlySet<string> = new Set(['iban', 'counterpartyIban', 'value'])

function fieldName(field: string): string {
  return (words.proposals.fields as Readonly<Record<string, string>>)[field] ?? field
}

/** Whether the record is of the kind, so its fields read with their types. */
function isKind<R>(kind: RecordKind<unknown>, of: RecordKind<R>, record: ProposedRecord): record is ProposedRecord & R {
  return kind.name === of.name && typeof record === 'object'
}

/** The currency of an account a record is on, or of the account itself. */
function currencyOf(record: ProposedRecord, book: SpendingBook): Account['currency'] | null {
  return book.accounts.find((account) => account.id === record['account'] || account.id === record['id'])?.currency ?? null
}

/**
 * A value as a person reads it on screen: an account's amount in its own currency, a limit in euros, a day and a month in
 * words, a name for a record it points at, a category's swatch, an account's type and bank, and a rule's words. A place
 * among siblings or in the order rules are tried reads as its number.
 */
function shownValue(kind: RecordKind<unknown>, field: string, record: ProposedRecord, book: SpendingBook, namesOf: ReadonlyMap<unknown, string>): string | null {
  const value = record[field]
  if (value === null || value === undefined || value === '') return null
  if (isKind(kind, CATEGORY_RECORDS, record) && field === 'colour') return swatchOf(record.colour)?.name ?? null
  if (isKind(kind, CATEGORY_RECORDS, record) && field === 'kind') return categoryWords.kinds[record.kind]
  if (isKind(kind, ACCOUNT_RECORDS, record) && field === 'kind') return accountWords.kinds[record.kind]
  if (isKind(kind, ACCOUNT_RECORDS, record) && field === 'bank') return record.bank === null ? null : accountWords.banks[record.bank]
  if (typeof value === 'boolean') return value ? words.proposals.yes : words.proposals.no
  if (isKind(kind, RULE_RECORDS, record) && field === 'condition') {
    return record.condition.column === 'counterparty_iban' ? words.proposals.ibanRule(record.condition.iban) : record.condition.fragment
  }
  if (isKind(kind, TRANSACTION_RECORDS, record) && field === 'amount') {
    const currency = currencyOf(record, book)
    return currency === null ? null : formatAccountMoney(record.amount, currency)
  }
  if (isKind(kind, ACCOUNT_RECORDS, record) && field === 'opening') return formatAccountMoney(record.opening, record.currency)
  if (isKind(kind, LINE_RECORDS, record) && field === 'amount') return formatAccountMoney(record.amount, EURO)
  if (isKind(kind, RECEIPT_RECORDS, record) && field === 'total') return formatMoney(record.total, 'negative', { ...DEFAULT_MONEY_FORMAT, currency: EURO })
  if (isKind(kind, RECEIPT_RECORDS, record) && field === 'issuedOn') return dayLabel(record.issuedOn)
  if (isKind(kind, BUDGET_RECORDS, record) && field === 'amount') return formatMoney(record.amount, 'negative', { ...DEFAULT_MONEY_FORMAT, currency: EURO })
  if (isKind(kind, BUDGET_RECORDS, record) && field === 'from') return monthLabel(record.from)
  if (isKind(kind, TRANSACTION_RECORDS, record) && field === 'date') return dayLabel(record.date)
  if (isKind(kind, ACCOUNT_RECORDS, record) && field === 'openedOn') return dayLabel(record.openedOn)
  return namesOf.get(value) ?? String(value)
}

/** What the record is called on screen: an entry by its payee or else its category, a rule by the payee or IBAN it files, a limit by its category, and others by their name. */
function labelOf(kind: RecordKind<unknown>, record: ProposedRecord, fallback: string, namesOf: ReadonlyMap<unknown, string>): string {
  if (isKind(kind, TRANSACTION_RECORDS, record)) return record.payee !== '' ? record.payee : (namesOf.get(record.category) ?? fallback)
  if (isKind(kind, RULE_RECORDS, record)) return record.condition.column === 'counterparty_iban' ? words.proposals.ibanRule(record.condition.iban) : record.condition.fragment
  if (isKind(kind, BUDGET_RECORDS, record)) return namesOf.get(record.category) ?? fallback
  if (isKind(kind, RECEIPT_RECORDS, record)) return record.merchant !== '' ? record.merchant : fallback
  if (isKind(kind, LINE_RECORDS, record)) return record.text !== '' ? record.text : record.printed !== '' ? record.printed : fallback
  if (isKind(kind, ACCOUNT_RECORDS, record) || isKind(kind, CATEGORY_RECORDS, record)) return record.name
  return fallback
}

/** What a card's import leaves out of its statement or cannot vouch for: the rows its dry run skips for their day, whether the file's reader left out more or noted its balance, and the rows the AI copied. */
export interface StatementLeftOut {
  readonly label: string
  readonly rows: number
  readonly fileNotes: boolean
  readonly copied: CopiedRows | null
}

/** What the import leaves out, from its statement and its dry run. A row already on the file is not left out, since it is there. */
export function statementLeftOut({ statement, copied }: CardStatement, run: Pick<StatementDryRun, 'lines'>): StatementLeftOut {
  return {
    label: statement.label,
    rows: run.lines.filter((line) => line.outcome === 'before-opening' || line.outcome === 'other-source').length,
    fileNotes: statement.notes.length > 0,
    copied,
  }
}

/** A warning on the statement, since the card shows only what the import writes. Null when it leaves nothing out and nothing was copied. */
function leftOutNote({ label, rows, fileNotes, copied }: StatementLeftOut): ProposalNote | null {
  const warnings = [
    ...(copied === null ? [] : [copiedStatementRowsWarning(copied.count, copied.file, copied.tied)]),
    ...(rows === 0 ? [] : [plural(words.proposals.rowsLeftOut(rows), rows)]),
    ...(fileNotes ? [words.proposals.fileNotes] : []),
  ]
  return warnings.length === 0 ? null : { label, text: warnings.join(' '), tone: 'warning' }
}

/** What a card warns on beyond its changes: what its import leaves out, and each receipt whose read failed a check or that may be a payment already on the file. */
export interface CardWarnings {
  readonly leftOut: StatementLeftOut | null
  readonly receipts: readonly ProposalNote[]
}

/** What a checked write does, grouped by verb and kind in the order it does it, in Kuna's words and never the model's. An import that leaves rows out warns on its group of entries, and a receipt on its group of receipts. */
export function proposalGroupsOf(checked: CheckedWrite, book: SpendingBook, { leftOut, receipts }: CardWarnings = { leftOut: null, receipts: [] }): readonly ProposalGroup[] {
  const namesOf = new Map<unknown, string>([...book.categories, ...book.accounts].map((record) => [record.id, record.name]))
  checked.changes.forEach(({ change }) => {
    if (change.verb === 'add' && 'name' in (change.after as object) && 'id' in (change.after as object)) namesOf.set((change.after as { id: string }).id, (change.after as { name: string }).name)
  })
  const describer: ProposalDescriber = {
    keptByKuna: KEPT_BY_KUNA,
    fieldName,
    shown: (kind, field, record) => shownValue(kind, field, record, book, namesOf),
    label: (kind, record, fallback) => labelOf(kind, record, fallback, namesOf),
    warns: (kind, field, after) => WARNS.has(field) || (field === 'condition' && after !== null && isKind(kind, RULE_RECORDS, after) && after.condition.column === 'counterparty_iban'),
  }
  const note = leftOut === null ? null : leftOutNote(leftOut)
  const notes: CardNote[] = [...(note === null ? [] : [{ noun: TRANSACTION_RECORDS.noun, note }]), ...receipts.map((receipt) => ({ noun: RECEIPT_RECORDS.noun, note: receipt }))]
  return withNotes(
    proposalGroups(checked, () => describer),
    notes,
  )
}
