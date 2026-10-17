import { parseCivilDate } from '../../src/shared/calendar/civilDate'
import type { CivilDate } from '../../src/shared/calendar/civilDate'
import { anchorWindow } from '../../src/shared/calendar/ledgerWindow'
import type { LedgerWindow } from '../../src/shared/calendar/ledgerWindow'
import { moneyFromAmount, moneyFromCents } from '../../src/shared/money/money'
import type { Money } from '../../src/shared/money/money'
import type { Bucket } from '../../src/features/workbook/domain/bucket'
import type { Transaction, TransactionSignals } from '../../src/features/workbook/domain/workbook'

/** Buckets and families of the categories the specs use, as the Sheet's seed defines them. */
const SEED: Readonly<Record<string, { readonly family: string; readonly bucket: Bucket }>> = {
  revenue: { family: 'income', bucket: 'income' },
  'grant-income': { family: 'income', bucket: 'income' },
  'tax-refund': { family: 'income', bucket: 'income' },
  'client-refund': { family: 'income', bucket: 'income' },
  'payroll-contributions': { family: 'taxes', bucket: 'taxes' },
  'payroll-tax': { family: 'taxes', bucket: 'taxes' },
  'salary-net': { family: 'owner', bucket: 'owner-pay' },
  'owner-loan-out': { family: 'owner', bucket: 'owner-pay' },
  'owner-loan-repaid': { family: 'owner', bucket: 'owner-pay' },
  'reimbursement-to-owner': { family: 'owner', bucket: 'financing' },
  equipment: { family: 'operating', bucket: 'operating' },
  accounting: { family: 'operating', bucket: 'operating' },
  'ai-services': { family: 'operating', bucket: 'operating' },
  travel: { family: 'operating', bucket: 'operating' },
  'internal-transfer': { family: 'neutral', bucket: 'neutral' },
  'share-capital': { family: 'neutral', bucket: 'neutral' },
}

export const NO_SIGNALS: TransactionSignals = {
  purpose: '',
  txDomain: '',
  txFamily: '',
  txSubFamily: '',
  creditorReference: '',
  instructedCurrency: '',
}

export interface RowSpec {
  readonly date: string
  /** Euros, credits positive. */
  readonly amount: number
  readonly category?: string
  readonly account?: string
  readonly counterparty?: string
  readonly iban?: string
  readonly description?: string
  /** Euros. Defaults to the account's running balance. */
  readonly balance?: number
  readonly flaggedBy?: string
  readonly reviewReasons?: readonly string[]
}

/**
 * Transactions in booking order, oldest first, given as the specs read best. Sequence follows the
 * order given, family and bucket follow the seed, and balances run per account from zero unless
 * stated. Returned newest first, as the workbook holds them.
 */
export function ledger(rows: readonly RowSpec[]): Transaction[] {
  const running = new Map<string, number>()
  return rows
    .map((row, position): Transaction => {
      const account = row.account ?? 'main'
      const amount = moneyFromAmount(row.amount)
      const balance = row.balance === undefined ? (running.get(account) ?? 0) + amount : moneyFromAmount(row.balance)
      running.set(account, balance)
      const category = row.category ?? 'ai-services'
      const seeded = SEED[category]
      return {
        account,
        date: civil(row.date),
        sequence: position + 1,
        statement: `${row.date}-statement-001`,
        counterparty: row.counterparty ?? 'Somebody',
        counterpartyIban: row.iban ?? '',
        description: row.description ?? '',
        amount,
        balance: moneyFromCents(balance),
        category,
        family: seeded?.family ?? 'unclassified',
        bucket: seeded?.bucket ?? 'unclassified',
        flaggedBy: row.flaggedBy ?? 'rule',
        reference: `REF-${position + 1}`,
        signals: NO_SIGNALS,
        reviewReasons: row.reviewReasons ?? [],
        sheetRow: rows.length - position + 1,
      }
    })
    .reverse()
}

export function civil(text: string): CivilDate {
  const date = parseCivilDate(text)
  if (date === null) {
    throw new Error(`${text} is not a date`)
  }
  return date
}

/** A window as the whole ledger would anchor it, from its earliest and newest days. */
export function windowOf(earliest: string, newest: string): LedgerWindow {
  return anchorWindow(civil(earliest), civil(newest))
}

export function euros(amount: number): Money {
  return moneyFromAmount(amount)
}
