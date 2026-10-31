import type { ListedTransaction } from '../domain/listedTransactions'
import { tradeTotal } from '../../holdings/domain/lots'
import { QUANTITY_PLACES } from '../../holdings/presentation/holdingText'
import { words as recordWords } from '../../workbook/domain/words'
import { words } from './words'
import { EURO } from '../../../../shared/money/currencyCode'
import { DECIMAL_ZERO, subtractDecimal } from '../../../../shared/money/decimal'
import type { Decimal } from '../../../../shared/money/decimal'
import { formatCurrencyAmount, formatQuantity, formatUnitPrice } from '../../../../shared/money/moneyFormat'
import type { Money } from '../../../../shared/money/money'

/** A listed record in words: what it was, what about, and what it moved. */
export interface TransactionLine {
  readonly kind: string
  /** The holding, the account, or the currencies and accounts it moved between. */
  readonly subject: string
  /** The one account it moved in, blank for a transfer, whose subject names both, and for a record of no account. */
  readonly account: string
  /** The units and price of a trade with its fee, the tax withheld from income or the amounts of an exchange. */
  readonly terms: string
  /** Null for a record that moved no money. */
  readonly euros: Money | null
  /** Whether the euros came into or went out of the accounts, rather than moved between the user's own. */
  readonly flows: boolean
  /** What moved that is not money, such as units or a split's ratio, or a hand price. */
  readonly moved: string
  /** A foreign amount and the rate it was converted at. */
  readonly foreign: string
}

function units(quantity: Decimal): string {
  return words.lines.units(formatQuantity(quantity, QUANTITY_PLACES))
}

export function transactionLine(entry: ListedTransaction): TransactionLine {
  const none = { account: '', terms: '', moved: '', foreign: '' }
  switch (entry.kind) {
    case 'trade': {
      const trade = entry.record
      const { currency } = entry.instrument
      const fee = trade.fees === null || trade.fees === DECIMAL_ZERO ? [] : [words.lines.fee(formatCurrencyAmount(trade.fees, currency))]
      return {
        ...none,
        kind: recordWords.sides[trade.side],
        subject: entry.instrument.name,
        account: entry.account.name,
        terms: [words.lines.unitsAtPrice(units(trade.quantity), formatUnitPrice(trade.price, currency)), ...fee].join(', '),
        euros: entry.euros,
        flows: true,
        foreign: trade.rate === null ? '' : words.lines.atRate(formatCurrencyAmount(tradeTotal(trade, entry.instrument.quoted), currency), formatQuantity(trade.rate, QUANTITY_PLACES)),
      }
    }
    case 'income': {
      const payment = entry.record
      return {
        ...none,
        kind: recordWords.incomeKinds[payment.kind],
        subject: entry.instrument?.name ?? entry.account.name,
        account: entry.account.name,
        terms: payment.withheld === DECIMAL_ZERO ? '' : words.lines.withheld(formatCurrencyAmount(payment.withheld, payment.currency)),
        euros: entry.euros,
        flows: true,
        foreign:
          payment.rate === null ? '' : words.lines.atRate(formatCurrencyAmount(subtractDecimal(payment.gross, payment.withheld), payment.currency), formatQuantity(payment.rate, QUANTITY_PLACES)),
      }
    }
    case 'cash-movement': {
      const movement = entry.record
      return {
        ...none,
        kind: recordWords.movementKinds[movement.kind],
        subject: entry.account.name,
        account: entry.account.name,
        euros: entry.euros,
        flows: true,
        foreign: movement.rate === null ? '' : words.lines.atRate(formatCurrencyAmount(movement.amount, movement.currency), formatQuantity(movement.rate, QUANTITY_PLACES)),
      }
    }
    case 'exchange': {
      const exchange = entry.record
      return {
        ...none,
        kind: words.lines.exchange,
        subject: words.lines.exchanged(exchange.soldCurrency, exchange.boughtCurrency),
        account: entry.account.name,
        terms: words.lines.exchanged(formatCurrencyAmount(exchange.sold, exchange.soldCurrency), formatCurrencyAmount(exchange.bought, exchange.boughtCurrency)),
        euros: entry.euros,
        flows: false,
      }
    }
    case 'transfer': {
      const { moved } = entry.record
      return {
        ...none,
        kind: words.lines.transfer,
        subject: [entry.instrument?.name, words.lines.moved(entry.from.name, entry.to.name)].filter((part) => part !== undefined).join(', '),
        euros: entry.euros,
        flows: false,
        moved: moved.kind === 'units' ? units(moved.quantity) : '',
        foreign: moved.kind === 'cash' && moved.currency !== EURO ? formatCurrencyAmount(moved.amount, moved.currency) : '',
      }
    }
    case 'split':
      return { ...none, kind: words.lines.split, subject: entry.instrument.name, euros: null, flows: false, moved: words.lines.ratio(entry.record.newUnits, entry.record.oldUnits) }
    case 'spin-off':
      return {
        ...none,
        kind: words.lines.spinOff,
        subject: words.lines.spunOff(entry.received.name, entry.instrument.name),
        euros: null,
        flows: false,
        moved: units(entry.record.quantity),
      }
    case 'price':
      return {
        ...none,
        kind: words.lines.price,
        subject: entry.instrument.name,
        terms: entry.record.note,
        euros: null,
        flows: false,
        moved: formatUnitPrice(entry.record.price, entry.instrument.currency),
      }
  }
}
