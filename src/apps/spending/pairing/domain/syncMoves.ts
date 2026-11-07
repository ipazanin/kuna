import { namesNoStranger, ownIbansOf } from './transferPairs'
import type { TransferPair } from './transferPairs'
import type { Account } from '../../workbook/domain/account'
import type { Transaction } from '../../workbook/domain/transaction'
import { absAccountMoney } from '../../../../shared/money/accountMoney'
import { decimalOfAccountMoney, decimalOfText, magnitude, subtractDecimal, timesDecimal } from '../../../../shared/money/decimal'
import type { Decimal } from '../../../../shared/money/decimal'

/** What the move tests read of a row a bank sync brought. */
export type SyncLeg = Pick<Transaction, 'account' | 'date' | 'amount' | 'counterpartyIban'>

/** The share of the bought amount that the amount the rate gives may differ by, for the bank's rounding and a spread it keeps. */
const EXCHANGE_TOLERANCE = decimalOfText('0.01')!

/** The two legs' accounts, when both are yours at the same bank. */
function accountsAtOneBank(debit: SyncLeg, credit: SyncLeg, accounts: readonly Account[]): readonly [Account, Account] | null {
  const from = accounts.find((account) => account.id === debit.account)
  const to = accounts.find((account) => account.id === credit.account)
  if (from === undefined || to === undefined || from.id === to.id || from.bank === null || from.bank !== to.bank) return null
  return [from, to]
}

function legsOfOneMove(debit: SyncLeg, credit: SyncLeg, ownIbans: ReadonlySet<string>): boolean {
  return debit.amount < 0 && credit.amount > 0 && debit.date === credit.date && namesNoStranger(debit, ownIbans) && namesNoStranger(credit, ownIbans)
}

/** Whether `bought` is `sold` times the rate within the tolerance. */
function boughtAtRate(sold: Decimal, bought: Decimal, rate: Decimal): boolean {
  return magnitude(subtractDecimal(timesDecimal(sold, rate), bought)) <= timesDecimal(bought, EXCHANGE_TOLERANCE)
}

/**
 * Whether two synced rows are the legs of one exchange: on two of your accounts at one bank in two currencies, on the same
 * day, money out and money in, and the amounts follow the bank's rate within 1%. The rate is read either way round, since
 * which currency it counts in is a guess until the first real run.
 */
export function isExchange(debit: SyncLeg, credit: SyncLeg, rate: Decimal | null, accounts: readonly Account[]): boolean {
  const pair = accountsAtOneBank(debit, credit, accounts)
  if (pair === null || rate === null || pair[0].currency === pair[1].currency || !legsOfOneMove(debit, credit, ownIbansOf(accounts))) return false
  const sold = decimalOfAccountMoney(absAccountMoney(debit.amount))
  const bought = decimalOfAccountMoney(credit.amount)
  return boughtAtRate(sold, bought, rate) || boughtAtRate(bought, sold, rate)
}

/**
 * Whether two synced rows are the legs of one pocket move: the same amount out of one account and into a savings account of
 * the same bank and currency, on the same day. That a pocket comes as an account of its own is a guess until the first real run.
 */
export function isPocketMove(debit: SyncLeg, credit: SyncLeg, accounts: readonly Account[]): boolean {
  const pair = accountsAtOneBank(debit, credit, accounts)
  if (pair === null || !legsOfOneMove(debit, credit, ownIbansOf(accounts)) || debit.amount !== -credit.amount) return false
  const [from, to] = pair
  return from.currency === to.currency && (from.kind === 'savings') !== (to.kind === 'savings')
}

/** The pairs where each leg fits one other leg alone. Two candidates for one leg cannot be told apart, so neither pairs and both wait on review. */
function soleMatches<Leg extends SyncLeg>(legs: readonly Leg[], fits: (debit: Leg, credit: Leg) => boolean): readonly TransferPair<Leg>[] {
  const debits = legs.filter((leg) => leg.amount < 0)
  const credits = legs.filter((leg) => leg.amount > 0)
  return debits.flatMap((debit) => {
    const candidates = credits.filter((credit) => fits(debit, credit))
    const [credit] = candidates
    if (candidates.length !== 1 || credit === undefined || debits.filter((other) => fits(other, credit)).length !== 1) return []
    return [{ debit, credit }]
  })
}

export interface SyncMoves<Leg> {
  readonly exchanges: readonly TransferPair<Leg>[]
  readonly pocketMoves: readonly TransferPair<Leg>[]
}

/** The exchanges and pocket moves among the rows of one sync. An exchange is in two currencies and a pocket move in one, so no leg is on both. */
export function syncMoves<Leg extends SyncLeg>(legs: readonly Leg[], accounts: readonly Account[], exchangeRateOf: (leg: Leg) => Decimal | null): SyncMoves<Leg> {
  return {
    exchanges: soleMatches(legs, (debit, credit) => isExchange(debit, credit, exchangeRateOf(debit) ?? exchangeRateOf(credit), accounts)),
    pocketMoves: soleMatches(legs, (debit, credit) => isPocketMove(debit, credit, accounts)),
  }
}
