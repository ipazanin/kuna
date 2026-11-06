const NUMBER_TEXT = /^(-?)(\d+)(?:\.(\d+))?(?:e([+-]\d+))?$/

/**
 * A number as whole steps of `places` decimal places, rounded half away from zero. It is read from the shortest text
 * that gives the number back, so 1.005 is 1.01 to two places. Null for a number that is not finite.
 */
export function stepsOfNumber(value: number, places: number): bigint | null {
  const match = NUMBER_TEXT.exec(String(value))
  if (match === null) {
    return null
  }
  const fraction = match[3] ?? ''
  const digits = BigInt(`${match[2]}${fraction}`)
  const shift = places - fraction.length + Number(match[4] ?? '0')
  const steps = shift >= 0 ? digits * 10n ** BigInt(shift) : dividedHalfAwayFromZero(digits, 10n ** BigInt(-shift))
  return match[1] === '-' ? -steps : steps
}

export function dividedHalfAwayFromZero(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) {
    throw new RangeError(`Cannot divide by ${denominator}.`)
  }
  const magnitude = numerator < 0n ? -numerator : numerator
  const quotient = (2n * magnitude + denominator) / (2n * denominator)
  return numerator < 0n ? -quotient : quotient
}
