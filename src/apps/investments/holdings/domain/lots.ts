import { tradeWorth } from './quoting'
import type { Income } from '../../workbook/domain/income'
import type { Quoting } from '../../workbook/domain/instrument'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import type { SpinOff } from '../../workbook/domain/spinOff'
import type { Split } from '../../workbook/domain/split'
import type { Trade } from '../../workbook/domain/trade'
import type { Transfer, TransferredUnits } from '../../workbook/domain/transfer'
import { addDays, daysBetween } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { dayMonthsLater } from '../../../../shared/calendar/monthKey'
import { DECIMAL_ZERO, addDecimal, decimalOfMoney, decimalParts, inEuros, moneyParts, negateDecimal, scaledDecimal, subtractDecimal, sumDecimal, timesDecimal } from '../../../../shared/money/decimal'
import type { Decimal } from '../../../../shared/money/decimal'
import { ZERO, addMoney, subtractMoney, sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** Units of an instrument acquired on one day at one cost, which FIFO closes oldest first. */
export interface Lot {
  /** The buy's day, or for units received in a spin-off the parent lot's. */
  readonly opened: CivilDate
  readonly quantity: Decimal
  /** In euros, fees included. */
  readonly cost: Money
  /** In the instrument's quote currency, fees included. */
  readonly costInCurrency: Decimal
  /** The accrued interest a bond's buy paid, in the quote currency, which stays inside the cost until the next coupon pays it back. */
  readonly accrued: Decimal
  /** The same accrued interest in euros, as the buy paid it. */
  readonly accruedCost: Money
  readonly taxFreeFrom: CivilDate
}

/** The part of a sale that closed one lot. */
export interface RealisedLine {
  readonly opened: CivilDate
  readonly quantity: Decimal
  readonly cost: Money
  /** The lot's share of the sale's price × quantity, in euros. */
  readonly proceeds: Money
  /** The lot's share of the sale's fees, in euros. */
  readonly fees: Money
  readonly gain: Money
  readonly daysHeld: number
  readonly taxFree: boolean
}

export interface ClosedSale {
  readonly trade: Trade
  readonly lines: readonly RealisedLine[]
}

/** One instrument's FIFO queue, kept across every account. */
export interface InstrumentLots {
  readonly open: readonly Lot[]
  readonly sales: readonly ClosedSale[]
  /** Sales and unit transfers beyond what their account held on their day. They move nothing. */
  readonly refused: readonly (Trade | Transfer)[]
  /** Splits that left an open lot with no units, as a reverse split of a sliver of a unit can. The write rules refuse them. */
  readonly emptied: readonly Split[]
  /** The units each account holds, from its trades and transfers. They add up to the open lots. */
  readonly units: ReadonlyMap<RecordId, Decimal>
  /** The euros of each coupon that paid back accrued interest bought with the bond, which come off the cost and are no income. */
  readonly paidBack: ReadonlyMap<RecordId, Money>
}

export interface SalePart {
  readonly quantity: Decimal
  readonly gain: Money
}

/** A sale's units and gain from lots past two years, and from the rest. */
export interface SaleTaxSplit {
  readonly taxFree: SalePart
  readonly taxable: SalePart
}

/** The day after the second anniversary of the day a lot was opened. The anniversary of 29 February is 28 February. */
export function taxFreeFrom(opened: CivilDate): CivilDate {
  return addDays(dayMonthsLater(opened, 24), 1)
}

/** Whether a lot is past two years on the day, so selling it then is free of tax. */
export function lotIsTaxFree(lot: Lot, day: CivilDate): boolean {
  return day >= lot.taxFreeFrom
}

/** How many of the open units are past two years on a day, and when the next lot gets there. */
export interface TaxFreeUnits {
  readonly taxFree: Decimal
  readonly held: Decimal
  /** Null when every open lot is past two years already. */
  readonly next: CivilDate | null
}

export function taxFreeUnits(lots: readonly Lot[], day: CivilDate): TaxFreeUnits {
  const waiting = lots.filter((lot) => !lotIsTaxFree(lot, day)).map((lot) => lot.taxFreeFrom)
  return {
    taxFree: sumDecimal(lots.filter((lot) => lotIsTaxFree(lot, day)).map((lot) => lot.quantity)),
    held: sumDecimal(lots.map((lot) => lot.quantity)),
    next: waiting.reduce<CivilDate | null>((first, date) => (first === null || date < first ? date : first), null),
  }
}

/** What a trade moves in its currency: a buy's worth + fees, a sale's worth − fees, each with the accrued interest of a bond. */
export function tradeTotal(trade: Trade, quoting: Quoting): Decimal {
  const worth = addDecimal(tradeWorth(quoting, trade.quantity, trade.price), trade.accrued ?? DECIMAL_ZERO)
  const fees = trade.fees ?? DECIMAL_ZERO
  return trade.side === 'buy' ? addDecimal(worth, fees) : subtractDecimal(worth, fees)
}

export function taxSplitOf(sale: ClosedSale): SaleTaxSplit {
  const partOf = (taxFree: boolean): SalePart => {
    const lines = sale.lines.filter((line) => line.taxFree === taxFree)
    return { quantity: sumDecimal(lines.map((line) => line.quantity)), gain: sumMoney(lines.map((line) => line.gain)) }
  }
  return { taxFree: partOf(true), taxable: partOf(false) }
}

interface Queue {
  readonly quoting: Quoting
  open: Lot[]
  readonly sales: ClosedSale[]
  readonly refused: (Trade | Transfer)[]
  readonly emptied: Split[]
  readonly units: Map<RecordId, Decimal>
  readonly paidBack: Map<RecordId, Money>
}

interface Step {
  readonly date: CivilDate
  readonly rank: number
  readonly order: number
  readonly apply: () => void
}

/**
 * Every instrument's lots, from its trades, splits, spin-offs and coupons and the unit transfers between accounts,
 * walked in date order. On one day splits come first, then spin-offs, coupons, buys, transfers and sales, each in the
 * file's order, so a coupon pays back only what was bought before its day.
 */
export function investmentLots(book: InvestmentBook): ReadonlyMap<RecordId, InstrumentLots> {
  const queues = new Map<RecordId, Queue>()
  const quotingOf = new Map(book.instruments.map((instrument) => [instrument.id, instrument.quoted]))
  const queueOf = (instrument: RecordId): Queue => {
    const known = queues.get(instrument)
    if (known !== undefined) {
      return known
    }
    const queue: Queue = { quoting: quotingOf.get(instrument) ?? { kind: 'unit' }, open: [], sales: [], refused: [], emptied: [], units: new Map(), paidBack: new Map() }
    queues.set(instrument, queue)
    return queue
  }
  book.instruments.forEach((instrument) => queueOf(instrument.id))

  const steps: Step[] = [
    ...book.splits.map((split, order) => ({ date: split.date, rank: 0, order, apply: () => applySplit(queueOf(split.instrument), split) })),
    ...book.spinOffs.map((spinOff, order) => ({ date: spinOff.date, rank: 1, order, apply: () => applySpinOff(queueOf(spinOff.instrument), queueOf(spinOff.received), spinOff) })),
    ...book.income.flatMap((payment, order) => {
      const instrument = payment.instrument
      return payment.kind === 'coupon' && instrument !== null ? [{ date: payment.date, rank: 2, order, apply: () => applyCoupon(queueOf(instrument), payment) }] : []
    }),
    ...book.trades.map((trade, order) => ({
      date: trade.date,
      rank: trade.side === 'buy' ? 3 : 5,
      order,
      apply: () => (trade.side === 'buy' ? applyBuy(queueOf(trade.instrument), trade) : applySale(queueOf(trade.instrument), trade)),
    })),
    ...book.transfers.flatMap((transfer, order) => {
      const moved = transfer.moved
      return moved.kind === 'units' ? [{ date: transfer.date, rank: 4, order, apply: () => applyTransfer(queueOf(moved.instrument), transfer, moved) }] : []
    }),
  ]
  steps.sort((earlier, later) => earlier.date.localeCompare(later.date) || earlier.rank - later.rank || earlier.order - later.order).forEach((step) => step.apply())

  return queues
}

function applyBuy(queue: Queue, trade: Trade): void {
  const total = tradeTotal(trade, queue.quoting)
  const accrued = trade.accrued ?? DECIMAL_ZERO
  queue.open.push({
    opened: trade.date,
    quantity: trade.quantity,
    cost: inEuros(total, trade.rate),
    costInCurrency: total,
    accrued,
    accruedCost: inEuros(accrued, trade.rate),
    taxFreeFrom: taxFreeFrom(trade.date),
  })
  moveUnits(queue.units, trade.account, trade.quantity)
}

/** A payment after its tax withheld, in euros, without the part of a coupon that paid back accrued interest bought with the bond. */
export function receivedInEuros(payment: Income, paidBack: ReadonlyMap<RecordId, Money>): Money {
  return subtractMoney(inEuros(subtractDecimal(payment.gross, payment.withheld), payment.rate), paidBack.get(payment.id) ?? ZERO)
}

/** Takes the accrued interest each open lot paid off its cost, as the euros it was paid at, and keeps that as the coupon's payback. */
function applyCoupon(queue: Queue, coupon: Income): void {
  if (queue.open.every((lot) => lot.accrued === DECIMAL_ZERO)) {
    return
  }
  queue.paidBack.set(coupon.id, sumMoney(queue.open.map((lot) => lot.accruedCost)))
  queue.open = queue.open.map((lot) => ({
    ...lot,
    cost: subtractMoney(lot.cost, lot.accruedCost),
    costInCurrency: subtractDecimal(lot.costInCurrency, lot.accrued),
    accrued: DECIMAL_ZERO,
    accruedCost: ZERO,
  }))
}

/**
 * Closes the oldest lots first, whichever account bought them. The sale's proceeds and fees, each in euros, are split
 * across them by quantity. Since the accounts' units add up to the open lots, a sale within its account's units is
 * within the lots too.
 */
function applySale(queue: Queue, trade: Trade): void {
  if (trade.quantity > unitsOf(queue.units, trade.account)) {
    queue.refused.push(trade)
    return
  }
  const takes: { readonly lot: Lot; readonly quantity: Decimal }[] = []
  let left = trade.quantity
  for (const lot of queue.open) {
    if (left === DECIMAL_ZERO) {
      break
    }
    const quantity = lot.quantity < left ? lot.quantity : left
    takes.push({ lot, quantity })
    left = subtractDecimal(left, quantity)
  }

  const fees = inEuros(trade.fees ?? DECIMAL_ZERO, trade.rate)
  const weights = takes.map((take) => take.quantity)
  const proceeds = moneyParts(addMoney(inEuros(tradeTotal(trade, queue.quoting), trade.rate), fees), weights)
  const feeShares = moneyParts(fees, weights)
  const kept: Lot[] = []
  const lines = takes.map(({ lot, quantity }, index): RealisedLine => {
    const keptQuantity = subtractDecimal(lot.quantity, quantity)
    const [cost = ZERO, keptCost = ZERO] = moneyParts(lot.cost, [quantity, keptQuantity])
    const [, keptInCurrency = DECIMAL_ZERO] = decimalParts(lot.costInCurrency, [quantity, keptQuantity])
    const [, keptAccrued = DECIMAL_ZERO] = decimalParts(lot.accrued, [quantity, keptQuantity])
    const [, keptAccruedCost = ZERO] = moneyParts(lot.accruedCost, [quantity, keptQuantity])
    if (keptQuantity > DECIMAL_ZERO) {
      kept.push({ ...lot, quantity: keptQuantity, cost: keptCost, costInCurrency: keptInCurrency, accrued: keptAccrued, accruedCost: keptAccruedCost })
    }
    const lineProceeds = proceeds[index]!
    const lineFees = feeShares[index]!
    return {
      opened: lot.opened,
      quantity,
      cost,
      proceeds: lineProceeds,
      fees: lineFees,
      gain: subtractMoney(subtractMoney(lineProceeds, lineFees), cost),
      daysHeld: daysBetween(lot.opened, trade.date),
      taxFree: lotIsTaxFree(lot, trade.date),
    }
  })
  queue.open = [...kept, ...queue.open.slice(takes.length)]
  queue.sales.push({ trade, lines })
  moveUnits(queue.units, trade.account, negateDecimal(trade.quantity))
}

/**
 * Multiplies the open units by new ÷ old and leaves the cost alone. The total is scaled once and shared out to the lots
 * and to the accounts in proportion, so a 1-for-3 split of three lots of 100 still adds up to exactly 100.
 */
function applySplit(queue: Queue, split: Split): void {
  const quantities = queue.open.map((lot) => lot.quantity)
  const scaled = scaledDecimal(sumDecimal(quantities), BigInt(split.newUnits), BigInt(split.oldUnits))
  const lotQuantities = decimalParts(scaled, quantities)
  if (lotQuantities.some((quantity) => quantity === DECIMAL_ZERO)) {
    queue.emptied.push(split)
  }
  queue.open = queue.open.map((lot, index) => ({ ...lot, quantity: lotQuantities[index]! }))
  const accounts = [...queue.units]
  const accountUnits = decimalParts(
    scaled,
    accounts.map(([, units]) => units),
  )
  accounts.forEach(([account], index) => queue.units.set(account, accountUnits[index]!))
}

/**
 * Opens one lot of the received instrument per open parent lot, with the parent lot's day, its share of the units
 * received and its share of the cost that moves, which leaves the parent lot. Each account holding the parent receives
 * units in proportion to what it holds. The cost in the quote currency moves as it is, so the received instrument has
 * to quote in its parent's currency, which reading the book checks.
 */
function applySpinOff(parent: Queue, received: Queue, spinOff: SpinOff): void {
  const lots = parent.open
  if (lots.length === 0) {
    return
  }
  const quantities = decimalParts(
    spinOff.quantity,
    lots.map((lot) => lot.quantity),
  )
  const movedCost = inEuros(timesDecimal(decimalOfMoney(sumMoney(lots.map((lot) => lot.cost))), spinOff.costShare), null)
  const costs = moneyParts(
    movedCost,
    lots.map((lot) => BigInt(lot.cost)),
  )
  const movedInCurrency = timesDecimal(sumDecimal(lots.map((lot) => lot.costInCurrency)), spinOff.costShare)
  const inCurrency = decimalParts(
    movedInCurrency,
    lots.map((lot) => lot.costInCurrency),
  )

  const receivedLots = lots
    .map((lot, index) => ({
      opened: lot.opened,
      quantity: quantities[index]!,
      cost: costs[index]!,
      costInCurrency: inCurrency[index]!,
      accrued: DECIMAL_ZERO,
      accruedCost: ZERO,
      taxFreeFrom: lot.taxFreeFrom,
    }))
    .filter((lot) => lot.quantity > DECIMAL_ZERO)
  received.open = [...received.open, ...receivedLots].sort((earlier, later) => earlier.opened.localeCompare(later.opened))
  parent.open = lots.map((lot, index) => ({ ...lot, cost: subtractMoney(lot.cost, costs[index]!), costInCurrency: subtractDecimal(lot.costInCurrency, inCurrency[index]!) }))

  const holders = [...parent.units].filter(([, units]) => units > DECIMAL_ZERO)
  const shares = decimalParts(
    spinOff.quantity,
    holders.map(([, units]) => units),
  )
  holders.forEach(([account], index) => moveUnits(received.units, account, shares[index]!))
}

/** Moves units between accounts and leaves the lots, their days and their costs as they are. */
function applyTransfer(queue: Queue, transfer: Transfer, moved: TransferredUnits): void {
  if (moved.quantity > unitsOf(queue.units, transfer.from)) {
    queue.refused.push(transfer)
    return
  }
  moveUnits(queue.units, transfer.from, negateDecimal(moved.quantity))
  moveUnits(queue.units, transfer.to, moved.quantity)
}

function unitsOf(units: ReadonlyMap<RecordId, Decimal>, account: RecordId): Decimal {
  return units.get(account) ?? DECIMAL_ZERO
}

function moveUnits(units: Map<RecordId, Decimal>, account: RecordId, change: Decimal): void {
  units.set(account, addDecimal(unitsOf(units, account), change))
}
