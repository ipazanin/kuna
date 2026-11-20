import { accountIntakes } from '../../imports/domain/accountIntake'
import type { ReportQuestion } from '../../imports/domain/importDryRun'
import type { Happening, TransactionTexts } from '../../transactions/domain/transactionDraft'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import { amountShown } from '../../../../shared/money/amountTyping'
import { currencyCodeOf } from '../../../../shared/money/currencyCode'
import { DECIMAL_ZERO, decimalOfText, decimalShown, decimalText, magnitude } from '../../../../shared/money/decimal'
import type { Decimal } from '../../../../shared/money/decimal'
import type { AskedRow } from '../../../../shared/recipes/domain/runRecipe'
import { fold } from '../../../../shared/text/fold'

/** Where the form of a booked question starts: what happened and the fields its row fills, the rest left as a new record leaves them. */
export interface AskedRowStart {
  readonly happened: Happening
  readonly texts: Partial<TransactionTexts>
}

/** The one account the mail fills, which a question of its report names nothing else of, or blank when it fills none or several. */
function mailedAccount(book: InvestmentBook): string {
  const intakes = accountIntakes(book)
  const mailed = book.accounts.filter((account) => intakes.get(account.id)?.rowsFrom === 'mail')
  return mailed.length === 1 ? mailed[0]!.id : ''
}

/**
 * A question of IBKR's report as the start of a form. A trade gives a buy or a sale with its holding, units and price, a cash
 * transaction income or a cash movement by its type with its amount and currency, a transaction tax a fee, a transfer the
 * units it moved, and a corporate action a split on its day with nothing else filled. Each carries the row's day.
 * A trade that reverses one, such as a cancelled buy whose units go out, is no new buy or sale, so it starts no form.
 */
export function askedRowStart(question: Pick<AskedRow, 'section' | 'shown' | 'dates'>, book: InvestmentBook): AskedRowStart | null {
  const shown = new Map(question.shown)
  const number = (column: string): Decimal | null => decimalOfText(shown.get(column) ?? '')
  const amountOf = (column: string): string => {
    const amount = number(column)
    return amount === null ? '' : amountShown(decimalText(magnitude(amount)))
  }
  const unitsOf = (column: string): string => {
    const units = number(column)
    return units === null ? '' : decimalShown(magnitude(units))
  }
  const symbol = fold(shown.get('symbol') ?? '')
  const instrument = symbol === '' ? undefined : book.instruments.find((candidate) => fold(candidate.symbol) === symbol)
  const currency = currencyCodeOf(shown.get('currency') ?? '')
  const account = mailedAccount(book)
  const base: Partial<TransactionTexts> = {
    date: question.dates['date'] ?? '',
    account,
    ...(instrument === undefined ? {} : { instrument: instrument.id }),
    ...(currency === null ? {} : { currency }),
  }
  switch (question.section) {
    case 'Trades': {
      const happened = (shown.get('buySell') ?? '').startsWith('SELL') ? 'sell' : 'buy'
      const units = number('quantity')
      if (units !== null && (happened === 'buy' ? units < DECIMAL_ZERO : units > DECIMAL_ZERO)) return null
      return { happened, texts: { ...base, quantity: unitsOf('quantity'), price: unitsOf('tradePrice') } }
    }
    case 'Cash Transactions': {
      const type = shown.get('type') ?? ''
      const paidIn = (number('amount') ?? DECIMAL_ZERO) > DECIMAL_ZERO
      const texts = { ...base, amount: amountOf('amount') }
      if (type.includes('Dividend')) return { happened: 'income', texts: { ...texts, incomeKind: 'dividend' } }
      if (type.includes('Interest')) return { happened: 'income', texts: { ...texts, incomeKind: 'interest' } }
      if (type.includes('Fee')) return { happened: paidIn ? 'fee-refund' : 'fee', texts }
      return { happened: paidIn ? 'deposit' : 'withdrawal', texts }
    }
    case 'Transaction Taxes':
      return { happened: 'fee', texts: { ...base, amount: amountOf('taxAmount') } }
    case 'Transfers': {
      const into = (shown.get('direction') ?? '').toUpperCase() === 'IN'
      return { happened: 'transfer', texts: { ...base, moves: 'units', quantity: unitsOf('quantity'), account: into ? '' : account, toAccount: into ? account : '' } }
    }
    case 'Corporate Actions':
      return { happened: 'split', texts: { date: base.date ?? '', ...(instrument === undefined ? {} : { instrument: instrument.id }) } }
    default:
      return { happened: 'buy', texts: { date: base.date ?? '', account } }
  }
}

/** The form Book opens for a question that still waits, or null where only Hold back and Leave out are offered: a changed row a record holds, or a cancelled trade. */
export function bookingStart(question: ReportQuestion, book: InvestmentBook): AskedRowStart | null {
  return question.booking === null ? null : askedRowStart(question, book)
}
