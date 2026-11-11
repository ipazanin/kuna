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
  return [row.payee || row.description, formatAccountMoney(row.amount, account?.currency ?? EURO), dayLabel(row.date)].filter((part) => part !== '')
}

/** A row as a list asks about it beside its amount: its payee, day and account. */
export function rowNamed(row: Pick<Transaction, 'payee' | 'description' | 'date'>, account: Account | undefined): string {
  return [row.payee || row.description, dayLabel(row.date), account?.name ?? ''].filter((part) => part !== '').join(' · ')
}

/** The caption that names the row on the file a row looks like, and where that row came from. */
export function twinCaption(booked: Transaction, account: Account | undefined): string {
  return likeCaption(rowSource(booked.importKey), rowParts(booked, account))
}
