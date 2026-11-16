import { colourBlindDistance, colourDistance, contrastRatio, hexWithinGamut, isHexColour, oklchOf } from './colour'
import { words } from './words'

/** One colour a category may wear: a chart slot, the recessive grey or an own colour, each with a light and a dark step. */
export interface Swatch {
  /** Its name in plain words, such as "Dark green". */
  readonly name: string
  /** The light step, which a file stores. */
  readonly hex: string
  /** The chart's categorical slot, 1 to 12, or null for the recessive grey and for an own colour. */
  readonly slot: number | null
  /** Whether it is a colour picked outside the palette, whose dark step is worked out from its light one. */
  readonly own: boolean
}

function paletteSwatch(name: string, hex: string, slot: number | null): Swatch {
  return { name, hex, slot, own: false }
}

/** The thirteen swatches in the order the picker offers them: the twelve chart slots, then the grey. */
export const SWATCHES: readonly Swatch[] = [
  paletteSwatch(words.swatches.green, '#1c9b5e', 1),
  paletteSwatch(words.swatches.orange, '#dd5e1a', 2),
  paletteSwatch(words.swatches.blue, '#2a78d6', 3),
  paletteSwatch(words.swatches.ochre, '#b77610', 4),
  paletteSwatch(words.swatches.pink, '#c96292', 5),
  paletteSwatch(words.swatches.darkGreen, '#008300', 6),
  paletteSwatch(words.swatches.violet, '#6250d6', 7),
  paletteSwatch(words.swatches.red, '#ec5061', 8),
  paletteSwatch(words.swatches.teal, '#0f9b89', 9),
  paletteSwatch(words.swatches.plum, '#8e5bab', 10),
  paletteSwatch(words.swatches.olive, '#908126', 11),
  paletteSwatch(words.swatches.petrol, '#0f86ad', 12),
  paletteSwatch(words.swatches.grey, '#a3adb9', null),
]

/** How many categorical slots the palette holds, `--series-1` to `--series-12`. */
export const CHART_SLOTS = SWATCHES.filter((swatch) => swatch.slot !== null).length

/** Other light steps of five slots that a file may hold, each naming its slot. */
const STORED_LIGHTER: Readonly<Record<string, string>> = {
  '#1baf7a': '#1c9b5e',
  '#eb6834': '#dd5e1a',
  '#eda100': '#b77610',
  '#e87ba4': '#c96292',
  '#e34948': '#ec5061',
}

/** The palette's swatch a stored colour names, matched without regard to case, or null. */
export function paletteSwatchOf(stored: string): Swatch | null {
  const typed = stored.trim().toLowerCase()
  const hex = STORED_LIGHTER[typed] ?? typed
  return SWATCHES.find((swatch) => swatch.hex === hex) ?? null
}

/** A colour picked outside the palette, by its light step. */
export function ownSwatch(hex: string): Swatch {
  const light = hex.trim().toLowerCase()
  return { name: words.ownColour(light), hex: light, slot: null, own: true }
}

/**
 * The swatch a stored colour names: one of the palette's, an own colour written as #rrggbb that passes 3:1 in the light theme,
 * or null for anything else, such as a pale tint a spreadsheet's cell carries.
 */
export function swatchOf(stored: string): Swatch | null {
  const typed = stored.trim()
  return paletteSwatchOf(typed) ?? (isHexColour(typed) && passesInLight(typed.toLowerCase()) ? ownSwatch(typed) : null)
}

/** The token a swatch paints with: its chart slot's, the recessive grey's or its own. The theme picks the light or the dark step. */
export function swatchToken(swatch: Swatch): string {
  if (swatch.own) return `--own-colour-${swatch.hex.slice(1)}`
  return swatch.slot === null ? '--chart-deemphasis' : `--series-${swatch.slot}`
}

/** The least contrast a colour keeps as a mark, WCAG 2's 3:1. */
const MARK_CONTRAST = 3
/** The light theme's page, card and popover, `--surface-page`, `--surface-raised` and `--surface-elevated`, which a light step passes on. */
export const LIGHT_SURFACES: readonly string[] = ['#eef1f4', '#ffffff', '#f4f6f8']
/** The dark theme's page, card and popover, `--surface-page`, `--surface-raised` and `--surface-elevated`, which a dark step passes on. */
export const DARK_SURFACES: readonly string[] = ['#0d1219', '#131a23', '#1a2330']
/** How much lightness one step of a search moves. */
const LIGHTNESS_STEP = 0.005

function passesOn(hex: string, surfaces: readonly string[]): boolean {
  return surfaces.every((surface) => (contrastRatio(hex, surface) ?? 0) >= MARK_CONTRAST)
}

/**
 * Whether a light step keeps 3:1 on the light page, card and popover, the least a mark needs to be seen. A swatch sits
 * beside its category's name on all three, and the page, the darkest, is the one that decides.
 */
export function passesInLight(hex: string): boolean {
  return passesOn(hex, LIGHT_SURFACES)
}

/** The darkest a light step may need to go, below which every hue passes. */
const DARKEST = 0.2

/** The colour nearest to one that fails in the light theme and still passes: the same hue and chroma, darkened until it does. */
export function nearestPassing(hex: string): string {
  const look = oklchOf(hex)
  for (let lightness = look.lightness; lightness > DARKEST; lightness -= LIGHTNESS_STEP) {
    const candidate = hexWithinGamut({ ...look, lightness })
    if (passesInLight(candidate)) return candidate
  }
  return hexWithinGamut({ ...look, lightness: DARKEST })
}

/**
 * The dark step of an own colour: the same hue and chroma in OKLCH, as the soft money tones keep their full tone's
 * hue, at the light step's lightness or lighter until it passes 3:1 on the dark page, card and popover. Chroma gives way
 * only where a screen cannot show it.
 */
export function darkStepOf(hex: string): string {
  const look = oklchOf(hex)
  for (let lightness = look.lightness; lightness < 1; lightness += LIGHTNESS_STEP) {
    const candidate = hexWithinGamut({ ...look, lightness })
    if (passesOn(candidate, DARK_SURFACES)) return candidate
  }
  return hexWithinGamut({ ...look, lightness: 1 })
}

/**
 * How close two colours may sit in OKLab before they read as one: 10 in the palette check's measure in normal vision,
 * and 3 for a reader with protanopia or deuteranopia. Neighbours in the palette sit further apart, while some slots
 * further apart in its order, such as Green and Teal, do not.
 */
const TOO_CLOSE = 0.1
const TOO_CLOSE_COLOUR_BLIND = 0.03

/** Whether two light steps sit so close that a chart's reader, with common colour blindness too, would take one for the other. */
export function looksAlike(one: string, other: string): boolean {
  return colourDistance(one, other) < TOO_CLOSE || colourBlindDistance(one, other) < TOO_CLOSE_COLOUR_BLIND
}

/**
 * The chart slots a swatch keeps from categories that take the next free one: its own slot, or for an own colour every
 * slot that looks like it, so a blank category never lands beside it in a colour a reader would take for it.
 */
export function slotsTakenBy(swatch: Swatch): readonly number[] {
  if (!swatch.own) return swatch.slot === null ? [] : [swatch.slot]
  return SWATCHES.flatMap((slotted) => (slotted.slot !== null && looksAlike(slotted.hex, swatch.hex) ? [slotted.slot] : []))
}
