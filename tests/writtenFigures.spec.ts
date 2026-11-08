import { describe, expect, it } from 'vitest'

import { figuresIn, holdsStrayFigure } from '../src/shared/ai/domain/writtenFigures'

/** What Kuna returned: 4,224.00, 500.00 by its size and a cap of 1,000.00, in cents, and rates of 12% and 25% in basis points. */
const AMOUNTS: ReadonlySet<number> = new Set([422400, 50000, 100000])
const RATES: ReadonlySet<number> = new Set([1200, 2500])

const stray = (text: string, amounts = AMOUNTS) => holdsStrayFigure(text, amounts, RATES)

describe('the figures an answer writes', () => {
  it('passes €4,224.00 and 4.224,00 € when Kuna returned that amount, and an amount below zero by its size', () => {
    for (const text of ['It comes to €4,224.00.', 'Iznosi 4.224,00 €.', 'It comes to 4224.00 EUR.', 'Less 500.00 paid earlier.', 'A cap of 1,000.00.']) {
      expect(stray(text), text).toBe(false)
    }
  })

  it('flags €4,300.00, which Kuna never returned', () => {
    expect(stray('Paid later it would be €4,300.00.')).toBe(true)
  })

  it('passes 12% when Kuna returned 1,200 basis points, and flags 13%', () => {
    expect(stray('The rate is 12%.')).toBe(false)
    expect(stray('Stopa je 12 %.')).toBe(false)
    expect(stray('The rate is 13%.')).toBe(true)
  })

  it('leaves years, days, dates and counts alone', () => {
    expect(figuresIn('In 2026, by 30.10.2026. or 2026-10-30, for 12 months and 3 employees.')).toEqual([])
  })

  it.each(['4300 euros', '4300 euro', '4300 Eura', '4300 eure', '4300 eurima', 'EUR 4300', '4300 kn', '4300 USD', 'CHF 4300', '13 posto', '13 posto.', '13 percent', '13 per cent'])(
    'flags the invented %s',
    (text) => {
      expect(stray(`Ukupno ${text} za to.`)).toBe(true)
    },
  )

  it.each(['4224 euros', 'EUR 4224', '4224 Eura', '12 posto', '12 percent'])('passes %s, which Kuna returned', (text) => {
    expect(stray(text)).toBe(false)
  })

  it('reads no currency in an ordinary lower-case word beside a count', () => {
    expect(figuresIn('in all 12 months, try 3 times')).toEqual([])
  })

  it('reads a day and a month as neither an amount nor a figure, unless a currency says so', () => {
    expect(figuresIn('do 31.12. treba platiti, a rok je 15.01.')).toEqual([])
    expect(figuresIn('It comes to 15.01 EUR.')).toEqual([{ kind: 'amount', cents: [1501] }])
    expect(stray('It comes to 45.50.')).toBe(true)
  })

  it('reads a space or a no-break space as a thousands separator', () => {
    for (const text of ['4 224,00 €', '4 224,00 €', '4 224.00 EUR']) {
      expect(stray(text), text).toBe(false)
    }
    expect(stray('9 224,00 €', new Set([22400]))).toBe(true)
  })

  it('reads nothing in a figure ref', () => {
    expect(figuresIn('See [f3] and [f12] for it.')).toEqual([])
  })
})
