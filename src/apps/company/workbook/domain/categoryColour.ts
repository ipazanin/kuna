import { words } from './words'

/** One colour a category may wear: a chart slot or the recessive grey, each with a light and a dark step. */
export interface Swatch {
  /** Its name in plain words, such as "Dark green". */
  readonly name: string
  /** The light step, which the categories tab stores. */
  readonly hex: string
  /** The chart's categorical slot, 1 to 8, or null for the recessive grey. */
  readonly slot: number | null
}

/** The nine swatches in the order the picker offers them: the eight chart slots, then the grey. */
export const SWATCHES: readonly Swatch[] = [
  { name: words.swatches.green, hex: '#1baf7a', slot: 1 },
  { name: words.swatches.orange, hex: '#eb6834', slot: 2 },
  { name: words.swatches.blue, hex: '#2a78d6', slot: 3 },
  { name: words.swatches.amber, hex: '#eda100', slot: 4 },
  { name: words.swatches.pink, hex: '#e87ba4', slot: 5 },
  { name: words.swatches.darkGreen, hex: '#008300', slot: 6 },
  { name: words.swatches.violet, hex: '#6250d6', slot: 7 },
  { name: words.swatches.red, hex: '#e34948', slot: 8 },
  { name: words.swatches.grey, hex: '#a3adb9', slot: null },
]

/**
 * What a category is drawn in: a swatch, or its bucket's colour when the tab leaves the colour blank
 * or holds one outside the palette. The colour as stored is kept, so a save that leaves the colour
 * alone writes nothing back.
 */
export interface CategoryColour {
  /** Null for the bucket's colour. */
  readonly swatch: Swatch | null
  readonly stored: string
}

export function categoryColourOf(stored: string): CategoryColour {
  return { swatch: swatchOf(stored), stored }
}

export const BUCKET_COLOUR: CategoryColour = categoryColourOf('')

/** The swatch a stored colour names, matched without regard to case, or null. */
export function swatchOf(stored: string): Swatch | null {
  const hex = stored.trim().toLowerCase()
  return SWATCHES.find((swatch) => swatch.hex === hex) ?? null
}

/** Whether a save may write the colour: blank, which is the bucket's colour, or a swatch. */
export function isPaletteColour(stored: string): boolean {
  return stored.trim() === '' || swatchOf(stored) !== null
}
