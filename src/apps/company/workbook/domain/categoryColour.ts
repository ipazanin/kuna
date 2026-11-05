import { swatchOf } from '../../../../shared/charts/swatches'
import type { Swatch } from '../../../../shared/charts/swatches'

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

/** Whether a save may write the colour: blank, which is the bucket's colour, or a swatch. */
export function isPaletteColour(stored: string): boolean {
  return stored.trim() === '' || swatchOf(stored) !== null
}
