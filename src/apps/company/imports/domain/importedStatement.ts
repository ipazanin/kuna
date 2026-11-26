import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { Money } from '../../../../shared/money/money'
import { absMoney, addMoney, subtractMoney } from '../../../../shared/money/money'
import type { TransactionSignals } from '../../workbook/domain/transactionSignals'
import { occurrenceKeys } from '../../../../shared/text/factKey'
import { cardDaysRefusal, givesPrintedBalances, statementTies } from '../../../../shared/money/statementTies'
import type { LookAlikes } from '../../../../shared/money/lookAlikeBookings'
import type { Transaction } from '../../workbook/domain/workbook'
import { TRANSCRIBED_PREFIX } from '../../workbook/domain/rowOrigin'

/** The bank's codes of a row whose file gives none. */
export const NO_SIGNALS: TransactionSignals = { purpose: '', txDomain: '', txFamily: '', txSubFamily: '', creditorReference: '', instructedCurrency: '' }

/** One booked entry of a statement, as the ledger will hold it. */
export interface ImportedRow {
  readonly date: CivilDate
  /** Credits positive. */
  readonly amount: Money
  /** The account's balance after the entry, or null when the file gives none and it is worked out on import. */
  readonly balance: Money | null
  readonly counterparty: string
  /** As the file gives it. */
  readonly counterpartyIban: string
  readonly description: string
  /** The bank's own reference, or a key worked out from the row when the file has none. Blank only when neither exists. */
  readonly reference: string
  readonly signals: TransactionSignals
  /** Why a person should look at the row, such as a reversal. */
  readonly reviewReasons: readonly string[]
}

/** Where a statement came from and which one it is. */
export type StatementSource =
  | { readonly kind: 'camt'; readonly iban: string; readonly sequence: number }
  | { readonly kind: 'table'; readonly recipe: string; readonly fileHash: string }
  | { readonly kind: 'transcribed'; readonly lookAlikes: LookAlikes; readonly part: number }

/** One statement read from a file: an account's entries in booking order, oldest first. */
export interface ImportedStatement {
  readonly fileName: string
  readonly source: StatementSource
  /** What the ledger's `statement` column says for its rows. */
  readonly label: string
  readonly account: string
  /** The balance before the first entry, or null when the file gives no balances. */
  readonly opening: Money | null
  readonly closing: Money | null
  readonly rows: readonly ImportedRow[]
  /** What the reader noticed that does not stop the import, each a sentence. */
  readonly notes: readonly string[]
}

/** An account a statement's IBAN names that the accounts tab lacks, which the person can add as the statement is imported. */
export interface NewAccountOffer {
  /** Normalised. */
  readonly iban: string
  /** The account's ISO 4217 code, as the statement states it. */
  readonly currency: string
}

/**
 * A statement read, or why the file's statement cannot be imported. A statement of an IBAN the
 * accounts tab lacks is read with a blank account and the account it offers to add.
 */
export type StatementReading =
  | { readonly statement: ImportedStatement }
  | { readonly statement: ImportedStatement; readonly newAccount: NewAccountOffer }
  | { readonly fileName: string; readonly label: string; readonly refusal: string }

/** Why a statement the AI copied is refused before its dry run: it gives one printed balance where it needs both or neither, its earlier parts are not on the ledger, its days reach into a part before it, or its entries do not tie its balances. */
export type TranscribedRefusal =
  | { readonly kind: 'one-balance' }
  | { readonly kind: 'parts-before-missing'; readonly label: string }
  | { readonly kind: 'day-reached'; readonly label: string; readonly part: number }
  | { readonly kind: 'does-not-tie'; readonly opening: Money; readonly rows: Money; readonly reached: Money; readonly closing: Money; readonly gap: Money }

export class TranscribedRefused extends Error {
  readonly refusal: TranscribedRefusal

  constructor(refusal: TranscribedRefusal) {
    super(refusal.kind)
    this.name = 'TranscribedRefused'
    this.refusal = refusal
  }
}

/** A file or statement the app will not read, with the reason in words a person can act on. */
export class StatementRefused extends Error {
  constructor(reason: string) {
    super(reason)
    this.name = 'StatementRefused'
  }
}

/**
 * References for entries read off a printed statement, in the statement's order: its account, day and amount, with the count
 * among equal entries before it. The counterparty stays out, as two reads of one page spell it differently. Reading the same
 * statement again gives the same references, so its entries are skipped.
 */
export function transcribedReferences(account: string, rows: readonly Pick<ImportedRow, 'date' | 'amount'>[]): string[] {
  return occurrenceKeys(rows.map((row) => [account, row.date, String(row.amount)])).map((key) => `${TRANSCRIBED_PREFIX}${key}`)
}

/** An entry as read off a printed statement. */
export type TranscribedRow = Pick<ImportedRow, 'date' | 'amount' | 'counterparty' | 'counterpartyIban' | 'description'>

/** A ledger row as a later part of a copied statement looks for its earlier parts. */
export type LedgerRowOfStatement = Pick<Transaction, 'account' | 'date' | 'statement' | 'reference'>

/**
 * One part of a statement the AI copied off a page, a file or the chat, its entries oldest first, with the rows the ledger already
 * holds. Part 1 may give the opening, and its entries then carry the balance each leaves from it. A statement in one part that gives
 * both balances is refused unless its entries lead to the closing, since nothing is filled in to close the gap. Its last part gives
 * the closing, and its entries carry the balances that lead to it, so the dry run refuses it unless they run on from where the
 * earlier parts left the ledger. A part after the first needs rows of the parts before it on the ledger, on days before its own.
 */
export function transcribedStatement(
  account: string,
  label: string,
  opening: Money | null,
  closing: Money | null,
  rows: readonly TranscribedRow[],
  lookAlikes: LookAlikes,
  part = 1,
  ledger: readonly LedgerRowOfStatement[] = [],
): ImportedStatement {
  if (!givesPrintedBalances(opening, closing, part)) throw new TranscribedRefused({ kind: 'one-balance' })
  const references = transcribedReferences(account, rows)
  const onCard = new Set(references)
  const earlierDays = ledger.filter((row) => row.account === account && row.statement === label && !onCard.has(row.reference)).map((row) => row.date)
  const refusal = cardDaysRefusal(
    earlierDays,
    rows.map((row) => row.date),
    part,
  )
  if (refusal?.kind === 'parts-before-missing') throw new TranscribedRefused({ kind: 'parts-before-missing', label })
  if (refusal?.kind === 'split') throw new TranscribedRefused({ kind: 'day-reached', label, part })
  if (part === 1 && opening !== null && closing !== null) {
    const tie = statementTies({ opening, amounts: rows.map((row) => row.amount), closing })
    if (tie.kind === 'off')
      throw new TranscribedRefused({ kind: 'does-not-tie', opening: tie.statement.opening, rows: tie.rows, reached: tie.reached, closing: tie.statement.closing, gap: absMoney(tie.gap) })
  }
  const balances = part === 1 ? balancesFrom(opening, rows) : balancesTo(closing, rows)
  const entries = rows.map((row, at): ImportedRow => ({ ...row, balance: balances[at]!, reference: references[at]!, signals: NO_SIGNALS, reviewReasons: [] }))
  return { fileName: label, source: { kind: 'transcribed', lookAlikes, part }, label, account, opening: part === 1 ? opening : null, closing, rows: entries, notes: [] }
}

/** The balance each entry leaves, running on from the opening, or null for each when there is none. */
function balancesFrom(opening: Money | null, rows: readonly Pick<ImportedRow, 'amount'>[]): (Money | null)[] {
  let balance = opening
  return rows.map((row) => {
    balance = balance === null ? null : addMoney(balance, row.amount)
    return balance
  })
}

/** The balance each entry leaves, running back from the closing the last entry leaves, or null for each when there is none. */
function balancesTo(closing: Money | null, rows: readonly Pick<ImportedRow, 'amount'>[]): (Money | null)[] {
  if (closing === null) return rows.map(() => null)
  const balances: Money[] = []
  let after = closing
  for (let at = rows.length - 1; at >= 0; at -= 1) {
    balances[at] = after
    after = subtractMoney(after, rows[at]!.amount)
  }
  return balances
}
