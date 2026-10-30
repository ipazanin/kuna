const MONTHS_A_YEAR = 12

/** The deepest fall from a running peak to a later value, as a fraction below zero, or zero when the values never fell. Null for fewer than two values. */
export function largestFall(values: readonly number[]): number | null {
  if (values.length < 2) {
    return null
  }
  let peak = -Infinity
  let deepest = 0
  for (const reached of values) {
    peak = Math.max(peak, reached)
    deepest = peak > 0 ? Math.min(deepest, reached / peak - 1) : deepest
  }
  return deepest
}

/** The sample standard deviation (n − 1) of monthly returns, times √12. Null for fewer than two returns. */
export function yearlyVolatility(monthlyReturns: readonly number[]): number | null {
  if (monthlyReturns.length < 2) {
    return null
  }
  const mean = monthlyReturns.reduce((total, monthly) => total + monthly, 0) / monthlyReturns.length
  const squares = monthlyReturns.reduce((total, monthly) => total + (monthly - mean) ** 2, 0)
  return Math.sqrt(squares / (monthlyReturns.length - 1)) * Math.sqrt(MONTHS_A_YEAR)
}
