import { rowSource } from '../domain/statementRows'
import type { Account } from '../../workbook/domain/account'
import type { Transaction } from '../../workbook/domain/transaction'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { EURO } from '../../../../shared/money/currencyCode'
import type { AccountMoney } from '../../../../shared/money/accountMoney'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import { formatAccountMoney } from '../../../../shared/money/moneyFormat'
import { likeCaption } from '../../../../shared/ai/presentation/copiedRowsWords'
import type { QuestionItem } from '../../../../shared/ui/QuestionList.vue'

/** A row `QuestionList` asks about, with its amount for the figure at the end of its words. */
export interface RowQuestion<Value extends string> extends QuestionItem<Value> {
  readonly amount: AccountMoney
  readonly currency: CurrencyCode
}

/** A row as a person tells it from others: its payee, amount and day. */
function rowParts(row: Pick<Transaction, 'payee' | 'description' | 'amount' | 'date'>, account: Account | undefined): string[] {
  return [rowTitle(row), formatAccountMoney(row.amount, account?.currency ?? EURO), dayLabel(row.date)].filter((part) => part !== '')
}

/** What names a row in a list: its payee, or its description when the bank gave no payee. */
export function rowTitle(row: Pick<Transaction, 'payee' | 'description'>): string {
  return row.payee || row.description
}

/** The line under a row's title in a list: its day and account. */
export function rowCaption(row: Pick<Transaction, 'date'>, account: Account | undefined): string {
  return [dayLabel(row.date), account?.name ?? ''].filter((part) => part !== '').join(' · ')
}

/** The caption that names the row on the file a row looks like, and where that row came from. */
export function twinCaption(booked: Transaction, account: Account | undefined): string {
  return likeCaption(rowSource(booked.importKey), rowParts(booked, account))
}
