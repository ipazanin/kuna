/** A colour written as #rrggbb, its channels from 0 to 1 in linear light. */
function linearOf(hex: string): readonly [number, number, number] {
  const [red = 0, green = 0, blue = 0] = [1, 3, 5].map((start) => {
    const channel = parseInt(hex.slice(start, start + 2), 16) / 255
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return [red, green, blue]
}

/** Whether a colour is written as #rrggbb, the one way a file and a token hold it. */
export function isHexColour(colour: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(colour)
}

/** The relative luminance of a colour written as #rrggbb, as WCAG 2 defines it. */
function luminance(hex: string): number {
  const [red, green, blue] = linearOf(hex)
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

/** The WCAG 2 contrast ratio of two colours written as #rrggbb, such as 4.5 for 4.5:1. Null when either is written another way. */
export function contrastRatio(foreground: string, background: string): number | null {
  if (![foreground, background].every(isHexColour)) return null
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((first, second) => second - first)
  return ((lighter ?? 0) + 0.05) / ((darker ?? 0) + 0.05)
}

/** A colour in OKLCH: its lightness from 0 to 1, its chroma, and its hue in degrees. */
export interface Oklch {
  readonly lightness: number
  readonly chroma: number
  readonly hue: number
}

/** Machado, Oliveira and Fernandes (2009) at full severity on linear sRGB, for the two common red-green colour blindnesses. */
const RED_GREEN_BLINDNESS: readonly (readonly (readonly [number, number, number])[])[] = [
  [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
]

function oklabOf(hex: string, seen?: readonly (readonly [number, number, number])[]): readonly [number, number, number] {
  const linear = linearOf(hex)
  const [red, green, blue] = seen === undefined ? linear : seen.map((row) => Math.min(1, Math.max(0, row[0] * linear[0] + row[1] * linear[1] + row[2] * linear[2])))
  const [long, medium, short] = [
    0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue,
    0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue,
    0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue,
  ].map(Math.cbrt) as [number, number, number]
  return [
    0.2104542553 * long + 0.793617785 * medium - 0.0040720468 * short,
    1.9779984951 * long - 2.428592205 * medium + 0.4505937099 * short,
    0.0259040371 * long + 0.7827717662 * medium - 0.808675766 * short,
  ]
}

export function oklchOf(hex: string): Oklch {
  const [lightness, a, b] = oklabOf(hex)
  return { lightness, chroma: Math.hypot(a, b), hue: ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360 }
}

/**
 * The colour at an OKLCH point as #rrggbb, or null when it lies outside what a screen shows. A tiny overshoot from
 * rounding still counts as inside.
 */
export function hexOfOklch({ lightness, chroma, hue }: Oklch): string | null {
  const a = chroma * Math.cos((hue * Math.PI) / 180)
  const b = chroma * Math.sin((hue * Math.PI) / 180)
  const long = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const medium = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const short = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3
  const linear = [
    4.0767416621 * long - 3.3077115913 * medium + 0.2309699292 * short,
    -1.2684380046 * long + 2.6097574011 * medium - 0.3413193965 * short,
    -0.0041960863 * long - 0.7034186147 * medium + 1.707614701 * short,
  ]
  if (linear.some((channel) => channel < -0.0001 || channel > 1.0001)) return null
  return `#${linear
    .map((channel) => {
      const clamped = Math.min(1, Math.max(0, channel))
      const encoded = clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055
      return Math.round(encoded * 255)
        .toString(16)
        .padStart(2, '0')
    })
    .join('')}`
}

/** The colour at an OKLCH point with as much of its chroma as a screen shows, at the same lightness and hue. */
export function hexWithinGamut(point: Oklch): string {
  for (let chroma = point.chroma; chroma > 0; chroma -= 0.002) {
    const hex = hexOfOklch({ ...point, chroma })
    if (hex !== null) return hex
  }
  return hexOfOklch({ ...point, chroma: 0 }) ?? '#808080'
}

/** How far apart two points in OKLab sit. */
function apart(first: readonly [number, number, number], second: readonly [number, number, number]): number {
  return Math.hypot(first[0] - second[0], first[1] - second[1], first[2] - second[2])
}

/** How far apart two colours look, as distance in OKLab. The palette check quotes it a hundred times larger. */
export function colourDistance(one: string, other: string): number {
  return apart(oklabOf(one), oklabOf(other))
}

/** How far apart two colours look to a reader with protanopia or deuteranopia, whichever sees them closer, in OKLab as `colourDistance`. */
export function colourBlindDistance(one: string, other: string): number {
  return Math.min(...RED_GREEN_BLINDNESS.map((seen) => apart(oklabOf(one, seen), oklabOf(other, seen))))
}
