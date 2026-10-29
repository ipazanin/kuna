import { moneyFromCents, subtractMoney } from './money'
import type { Money } from './money'

/** Above this many candidates, trying every set of two or more takes too long. */
const MOST_TRIED = 16

/** What one payment puts on one open row, by the row's position. */
export interface RowShare {
  readonly index: number
  readonly applied: Money
}

/**
 * The smallest set of candidates whose amounts add up to the amount, in the candidates' order. On a
 * tie it takes the set that reaches least far down the list. Null when no set does, or when it
 * takes two or more and there are too many candidates to try.
 */
export function fewestMakingUp<Candidate>(candidates: readonly Candidate[], amountOf: (candidate: Candidate) => Money, amount: Money): Candidate[] | null {
  const single = candidates.find((candidate) => amountOf(candidate) === amount)
  if (single !== undefined) {
    return [single]
  }
  if (candidates.length > MOST_TRIED) {
    return null
  }
  const amounts = candidates.map(amountOf)
  let best: number | null = null
  for (let mask = 1; mask < 1 << candidates.length; mask += 1) {
    const total = moneyFromCents(amounts.reduce<number>((sum, candidateAmount, index) => ((mask >> index) & 1 ? sum + candidateAmount : sum), 0))
    if (total === amount && (best === null || bitCount(mask) < bitCount(best))) {
      best = mask
    }
  }
  return best === null ? null : candidates.filter((_, index) => ((best >> index) & 1) === 1)
}

/** The fewest open rows a payment may match whose open amounts add up to it exactly, each in full. Null when no set does. */
function closedExactly(open: readonly Money[], amount: Money, mayMatch: (index: number) => boolean): RowShare[] | null {
  const matchable = open.flatMap((left, index) => (left > 0 && left <= amount && mayMatch(index) ? [index] : []))
  return fewestMakingUp(matchable, (index) => open[index]!, amount)?.map((index) => ({ index, applied: open[index]! })) ?? null
}

/**
 * Where a payment goes among rows given oldest first, from what is still open on each. It takes
 * the fewest rows it may match whose open amounts add up to it exactly. Failing that, it fills the
 * open rows it may reach, oldest first, until it runs out. What it cannot place has no share.
 */
export function settleOpenRows(open: readonly Money[], amount: Money, mayMatch: (index: number) => boolean, mayReach: (index: number) => boolean): RowShare[] {
  const exact = closedExactly(open, amount, mayMatch)
  if (exact !== null) {
    return exact
  }
  const shares: RowShare[] = []
  let left = amount
  for (let index = 0; index < open.length && left > 0; index += 1) {
    const rowOpen = open[index]!
    if (rowOpen > 0 && mayReach(index)) {
      const applied = (left < rowOpen ? left : rowOpen) as Money
      shares.push({ index, applied })
      left = subtractMoney(left, applied)
    }
  }
  return shares
}

/**
 * Where each of several payments, given oldest first, goes among rows given oldest first. Each
 * payment in turn first closes the rows it equals exactly, as `closedExactly` finds them. The
 * payments left then go in turn as `settleOpenRows` places them, reaching any open row. So a
 * payment that only part fills rows never takes a row that a later payment equals exactly.
 */
export function settlePayments(rows: readonly Money[], payments: readonly Money[], mayMatch: (payment: number, row: number) => boolean): RowShare[][] {
  const open = [...rows]
  const take = (shares: RowShare[]) => {
    for (const { index, applied } of shares) {
      open[index] = subtractMoney(open[index]!, applied)
    }
    return shares
  }
  const exact = payments.map((amount, payment) => take(closedExactly(open, amount, (row) => mayMatch(payment, row)) ?? []))
  return payments.map((amount, payment) => {
    const closed = exact[payment]!
    return closed.length > 0
      ? closed
      : take(
          settleOpenRows(
            open,
            amount,
            (row) => mayMatch(payment, row),
            () => true,
          ),
        )
  })
}

function bitCount(mask: number): number {
  let count = 0
  for (let rest = mask; rest > 0; rest >>= 1) {
    count += rest & 1
  }
  return count
}
