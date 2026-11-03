import { describe, expect, it } from 'vitest'

import { hnbRate } from '../src/apps/investments/tax/domain/hnbRate'
import { decimalText } from '../src/shared/money/decimal'
import { USD, rateBookOf } from './fixtures/investments'
import { civil } from './fixtures/ledger'

/** Made-up ECB rates, with none on Good Friday 3 Apr or Easter Monday 6 Apr 2026, as TARGET is closed. */
const RATES = rateBookOf(
  new Map([
    [
      USD,
      [
        ['2026-03-31', '1.1500'],
        ['2026-04-01', '1.1510'],
        ['2026-04-02', '1.1520'],
        ['2026-04-07', '1.1530'],
        ['2026-10-01', '1.1990'],
        ['2026-10-02', '1.2000'],
        ['2026-10-05', '1.2100'],
        ['2026-10-06', '1.2110'],
      ],
    ],
  ]),
)

function rateOn(day: string, rates = RATES): [string, string | null] | null {
  const rate = hnbRate(rates, USD, civil(day))
  return rate === null ? null : [decimalText(rate.unitsPerEuro), rate.estimatedFrom]
}

describe("HNB's rate of a day", () => {
  it("gives a Monday Friday's ECB rate, not Monday's own", () => {
    expect(rateOn('2026-10-05')).toEqual(['1.2', null])
  })

  it("gives a Saturday Friday's rate", () => {
    expect(rateOn('2026-10-03')).toEqual(['1.2', null])
  })

  it("gives the Tuesday after Easter Thursday's rate, past Good Friday and Easter Monday", () => {
    expect(rateOn('2026-04-07')).toEqual(['1.152', null])
  })

  it('gives none for a day before the series starts', () => {
    expect(rateOn('2026-03-31')).toBeNull()
  })

  it("marks Friday's rate as an estimate for a Wednesday when the series ends on Friday", () => {
    const toFriday = rateBookOf(
      new Map([
        [
          USD,
          [
            ['2026-10-01', '1.1990'],
            ['2026-10-02', '1.2000'],
          ],
        ],
      ]),
    )

    expect(rateOn('2026-10-07', toFriday)).toEqual(['1.2', '2026-10-02'])
    expect(rateOn('2026-10-05', toFriday)).toEqual(['1.2', null])
  })

  it("takes Thursday's rate as final for the Tuesday after Easter when the series ends that Thursday, and as an estimate a day later", () => {
    const toThursday = rateBookOf(
      new Map([
        [
          USD,
          [
            ['2026-04-01', '1.1510'],
            ['2026-04-02', '1.1520'],
          ],
        ],
      ]),
    )

    expect(rateOn('2026-04-07', toThursday)).toEqual(['1.152', null])
    expect(rateOn('2026-04-08', toThursday)).toEqual(['1.152', '2026-04-02'])
  })
})
