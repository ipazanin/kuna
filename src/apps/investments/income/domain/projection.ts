import { divideMoney, moneyFromFractionalCents } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { moneyAt, percentFromBasisPoints, shareOfPercent } from '../../../../shared/money/percent'
import type { Share } from '../../../../shared/money/percent'

/** The yearly withdrawals shown, of the end value: 3.5% and 4%. */
const WITHDRAWAL_RATES = [percentFromBasisPoints(350), percentFromBasisPoints(400)] as const

export interface ProjectedYear {
  /** Years from now, zero for the value now. */
  readonly year: number
  readonly value: Money
}

/** What a share of the end value gives each year, and each month. */
export interface Withdrawal {
  readonly rate: Share
  readonly yearly: Money
  readonly monthly: Money
}

export interface Projection {
  /** The value now, then at the end of each year. */
  readonly years: readonly ProjectedYear[]
  readonly end: Money
  readonly withdrawals: readonly Withdrawal[]
}

/**
 * The value grown at a yearly return, compounded monthly at (1 + return)^(1/12) − 1, with each month's saving added
 * at the month's end. Before tax and inflation.
 */
export function projection(value: Money, monthly: Money, yearlyReturn: Share, years: number): Projection {
  const monthlyRate = (1 + yearlyReturn) ** (1 / 12) - 1
  const points: ProjectedYear[] = [{ year: 0, value }]
  let reachedCents: number = value
  for (let year = 1; year <= years; year += 1) {
    for (let month = 0; month < 12; month += 1) {
      reachedCents = reachedCents * (1 + monthlyRate) + monthly
    }
    points.push({ year, value: moneyFromFractionalCents(reachedCents) })
  }
  const end = points.at(-1)!.value
  return {
    years: points,
    end,
    withdrawals: WITHDRAWAL_RATES.map((rate): Withdrawal => {
      const yearly = moneyAt(end, rate)
      return { rate: shareOfPercent(rate), yearly, monthly: divideMoney(yearly, 12) }
    }),
  }
}
