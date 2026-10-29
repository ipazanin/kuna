/** The relative luminance of a colour written as #rrggbb, as WCAG 2 defines it. */
function luminance(hex: string): number {
  const [red, green, blue] = [1, 3, 5].map((start) => {
    const channel = parseInt(hex.slice(start, start + 2), 16) / 255
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * (red ?? 0) + 0.7152 * (green ?? 0) + 0.0722 * (blue ?? 0)
}

/** The WCAG 2 contrast ratio of two colours written as #rrggbb, such as 4.5 for 4.5:1. Null when either is written another way. */
export function contrastRatio(foreground: string, background: string): number | null {
  if (![foreground, background].every((colour) => /^#[0-9a-f]{6}$/i.test(colour))) return null
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((first, second) => second - first)
  return ((lighter ?? 0) + 0.05) / ((darker ?? 0) + 0.05)
}
