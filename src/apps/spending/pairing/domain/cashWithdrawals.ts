import { legsOfPair } from './transferPairs'
import type { Account } from '../../workbook/domain/account'
import { TRANSACTION_RECORDS } from '../../workbook/domain/spendingKinds'
import type { SpendingRule } from '../../workbook/domain/spendingRule'
import { NO_BANK_FACTS } from '../../workbook/domain/transaction'
import type { Transaction } from '../../workbook/domain/transaction'
import { negateAccountMoney } from '../../../../shared/money/accountMoney'
import { newRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/**
 * Whether a row is cash taken out that has no cash leg yet: money out of an account that is not cash, on no pair, which the
 * bank's own row type marks as a withdrawal or the rule that decides it spots as one.
 */
export function isWithdrawal(row: Pick<Transaction, 'account' | 'amount' | 'pair' | 'cashWithdrawal'>, rule: Pick<SpendingRule, 'withdrawal'> | null, accounts: readonly Account[]): boolean {
  const own = accounts.find((account) => account.id === row.account)
  return row.amount < 0 && row.pair === null && own !== undefined && own.kind !== 'cash' && (row.cashWithdrawal || (rule?.withdrawal ?? null) !== null)
}

/**
 * The open cash accounts a withdrawal off the row may go to: the one its rule names when that keeps the row's currency, else
 * each cash account of that currency, and only those open by the row's day, as no entry comes before its account opened.
 * Only one of them is a cash leg Kuna can propose by itself.
 */
export function cashAccountsFor(row: Pick<Transaction, 'account' | 'date'>, named: RecordId | null, accounts: readonly Account[]): readonly Account[] {
  const currency = accounts.find((account) => account.id === row.account)?.currency
  const fitting = accounts.filter((account) => account.kind === 'cash' && !account.closed && account.currency === currency && account.openedOn <= row.date)
  const namedAccount = fitting.find((account) => account.id === named)
  return namedAccount === undefined ? fitting : [namedAccount]
}

/** The withdrawal and its cash leg as a pair: the same money into the cash account on the same day, both under Between my accounts. */
export function withCashLeg(debit: Transaction, cash: Pick<Account, 'id'>, transfer: RecordId, newKey: () => string = newRecordId): readonly [Transaction, Transaction] {
  const leg: Transaction = {
    ...NO_BANK_FACTS,
    id: recordIdOf(TRANSACTION_RECORDS, newKey()),
    account: cash.id,
    date: debit.date,
    amount: negateAccountMoney(debit.amount),
    payee: debit.payee,
    category: transfer,
    note: '',
    source: 'typed',
    pair: null,
    categorisedBy: null,
  }
  return legsOfPair(debit, leg, transfer)
}

/** Whether a row is a cash leg Kuna made for a withdrawal, which no bank brought and no person typed. */
export function isMadeCashLeg(row: Pick<Transaction, 'source' | 'importKey' | 'categorisedBy' | 'pair'>): boolean {
  return row.source === 'typed' && row.importKey === '' && row.categorisedBy === null && row.pair !== null
}
