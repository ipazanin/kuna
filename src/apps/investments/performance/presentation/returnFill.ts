/** The share a tint steps up at, a month's and a year's: up to the first is the faintest step, past the second the strongest. */
const STEPS = { month: [0.02, 0.05], year: [0.1, 0.25] } as const
const GAIN_FILLS = ['bg-gain-1', 'bg-gain-2', 'bg-gain-3'] as const
const LOSS_FILLS = ['bg-loss-1', 'bg-loss-2', 'bg-loss-3'] as const

export type ReturnSpan = keyof typeof STEPS

/** The tint of a cell under a month's or a year's return, by how far it rose or fell. A return that shows as zero has none. */
export function returnFill(share: number, span: ReturnSpan): string | null {
  if (Math.round(share * 10000) === 0) {
    return null
  }
  const [small, large] = STEPS[span]
  const step = Math.abs(share) <= small ? 0 : Math.abs(share) <= large ? 1 : 2
  return share > 0 ? GAIN_FILLS[step] : LOSS_FILLS[step]
}
