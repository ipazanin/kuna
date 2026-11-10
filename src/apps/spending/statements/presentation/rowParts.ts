import { rowSource } from '../domain/statementRows'
import type { Account } from '../../workbook/domain/account'
import type { Transaction } from '../../workbook/domain/transaction'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { EURO } from '../../../../shared/money/currencyCode'
import { formatAccountMoney } from '../../../../shared/money/moneyFormat'
import { likeCaption } from '../../../../shared/ai/presentation/copiedRowsWords'

/** A row as a person tells it from others: its payee, amount and day. */
export function rowParts(row: Pick<Transaction, 'payee' | 'description' | 'amount' | 'date'>, account: Account | undefined): string[] {
  return [row.payee || row.description, formatAccountMoney(row.amount, account?.currency ?? EURO), dayLabel(row.date)].filter((part) => part !== '')
}

/** The caption that names the row on the file a row looks like, and where that row came from. */
export function twinCaption(booked: Transaction, account: Account | undefined): string {
  return likeCaption(rowSource(booked.importKey), rowParts(booked, account))
}
