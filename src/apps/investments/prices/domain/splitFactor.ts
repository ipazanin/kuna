/** The most units either side of a split, such as the 100 of a 1 for 100 reverse split. */
const MOST_UNITS = 100
/** The smaller side of a split is at most this, so a price adjustment such as 1.0460 is not read as 91 for 87. */
const MOST_SMALLER_SIDE = 10
/** A factor is given to four places, so a ratio such as 1 for 3 is 0.3333. */
const TOLERANCE = 0.0001

/** A split factor of new units per old as the smallest whole numbers it is, or null for a factor that is no such ratio. */
export function splitRatioOf(factor: number): { readonly newUnits: number; readonly oldUnits: number } | null {
  if (!(factor > 0)) {
    return null
  }
  for (let oldUnits = 1; oldUnits <= MOST_UNITS; oldUnits += 1) {
    const newUnits = Math.round(factor * oldUnits)
    if (newUnits >= 1 && newUnits <= MOST_UNITS && Math.min(newUnits, oldUnits) <= MOST_SMALLER_SIDE && Math.abs(newUnits / oldUnits - factor) <= TOLERANCE) {
      return newUnits === oldUnits ? null : { newUnits, oldUnits }
    }
  }
  return null
}
