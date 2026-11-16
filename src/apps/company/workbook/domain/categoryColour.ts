import { swatchOf } from '../../../../shared/charts/swatches'
import type { Swatch } from '../../../../shared/charts/swatches'

/**
 * What a category is drawn in: a swatch of the palette or an own colour, or its bucket's colour when the tab leaves the
 * colour blank or holds one that is no swatch, such as a pale tint. The colour as stored is kept, so a save that leaves the colour
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

/** Whether a save may write the colour: blank, which is the bucket's colour, a swatch of the palette or an own colour that shows in the light theme. */
export function isCategoryColour(stored: string): boolean {
  return stored.trim() === '' || swatchOf(stored) !== null
}
