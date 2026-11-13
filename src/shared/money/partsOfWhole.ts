/** A part of a whole as it is given: an amount signed as the whole is, or the rest once the amounts are placed. */
export type GivenPart<Cents extends number> = Cents | 'rest'

/**
 * Why parts cannot be placed in a whole: not exactly one part takes the rest, a part or the whole is zero, an amount is
 * signed against the whole, or the amounts reach or pass the whole and leave the rest nothing.
 */
export type PartsRefusal = 'one-rest' | 'zero-part' | 'wrong-sign' | 'over'

export type PlacedParts<Cents extends number> = { readonly parts: readonly Cents[] } | { readonly refused: PartsRefusal }

/**
 * What is left of the whole once the amounts are taken out, of either sign. A transaction's parts add up to their whole when
 * this leaves nothing, and no other code works that out.
 */
export function restOfWhole<Cents extends number>(whole: Cents, amounts: readonly Cents[]): Cents {
  let rest: number = whole
  for (const amount of amounts) rest -= amount
  return (rest + 0) as Cents
}

/**
 * The whole in parts, each signed as the whole is, in the order given, with the rest worked out in whole cents so the parts
 * add up to the whole. No rounding happens, since every part but the rest is an amount already.
 */
export function partsOfWhole<Cents extends number>(whole: Cents, given: readonly GivenPart<Cents>[]): PlacedParts<Cents> {
  const amounts = given.filter((part): part is Cents => part !== 'rest')
  if (given.length - amounts.length !== 1) return { refused: 'one-rest' }
  if (whole === 0 || amounts.some((amount) => amount === 0)) return { refused: 'zero-part' }
  if (amounts.some((amount) => Math.sign(amount) !== Math.sign(whole))) return { refused: 'wrong-sign' }
  const rest = restOfWhole(whole, amounts)
  if (Math.sign(rest) !== Math.sign(whole)) return { refused: 'over' }
  return { parts: given.map((part) => (part === 'rest' ? rest : part)) }
}
