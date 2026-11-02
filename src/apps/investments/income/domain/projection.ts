import { dividedRounded, divideMoney, moneyFromAmount, moneyFromCents } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'

/** The yearly withdrawals shown, in basis points of the end value: 3.5% and 4%. */
const WITHDRAWAL_BASIS_POINTS = [350, 400] as const

const BASIS_POINTS = 10_000

export interface ProjectedYear {
  /** Years from now, zero for the value now. */
  readonly year: number
  readonly value: Money
}

/** What a share of the end value gives each year, and each month. */
export interface Withdrawal {
  /** A fraction, so 0.035 is 3.5%. */
  readonly rate: number
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
 * The value grown at a yearly rate, a fraction, compounded monthly at (1 + rate)^(1/12) − 1, with each month's saving
 * added at the month's end. Before tax and inflation.
 */
export function projection(value: Money, monthly: Money, yearlyRate: number, years: number): Projection {
  const monthlyRate = (1 + yearlyRate) ** (1 / 12) - 1
  const points: ProjectedYear[] = [{ year: 0, value }]
  let reached: number = value
  for (let year = 1; year <= years; year += 1) {
    for (let month = 0; month < 12; month += 1) {
      reached = reached * (1 + monthlyRate) + monthly
    }
    points.push({ year, value: moneyFromAmount(reached / 100) })
  }
  const end = points.at(-1)!.value
  return {
    years: points,
    end,
    withdrawals: WITHDRAWAL_BASIS_POINTS.map((basisPoints): Withdrawal => {
      const yearly = moneyFromCents(dividedRounded(end * basisPoints, BASIS_POINTS))
      return { rate: basisPoints / BASIS_POINTS, yearly, monthly: divideMoney(yearly, 12) }
    }),
  }
}
