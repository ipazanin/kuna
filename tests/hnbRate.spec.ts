import { describe, expect, it } from 'vitest'

import { hnbRate } from '../src/apps/investments/tax/domain/hnbRate'
import { decimalText, inEuros } from '../src/shared/money/decimal'
import { USD, decimal, rateBookOf } from './fixtures/investments'
import { civil, euros } from './fixtures/ledger'

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

/** ECB rates of 29 Oct to 3 Nov 2026, as the ECB published them. HNB's lists applied 30 Oct to 4 Nov 2026 carry the same figures. */
const ECB_AUTUMN_2026 = rateBookOf(
  new Map([
    [
      USD,
      [
        ['2026-10-29', '1.1130'],
        ['2026-10-30', '1.1172'],
        ['2026-11-02', '1.1216'],
        ['2026-11-03', '1.1179'],
      ],
    ],
  ]),
)

describe("HNB's rate of a day", () => {
  it("gives a Monday Monday's own ECB rate, the list HNB publishes that afternoon", () => {
    expect(rateOn('2026-10-05')).toEqual(['1.21', null])
  })

  it("gives a Saturday Friday's rate", () => {
    expect(rateOn('2026-10-03')).toEqual(['1.2', null])
  })

  it("gives Good Friday and Easter Monday Thursday's rate, as TARGET is closed and HNB publishes no list", () => {
    expect([rateOn('2026-04-03'), rateOn('2026-04-06'), rateOn('2026-04-07')]).toEqual([
      ['1.152', null],
      ['1.152', null],
      ['1.153', null],
    ])
  })

  it('gives none for a day before the series starts', () => {
    expect(rateOn('2026-03-30')).toBeNull()
  })

  it("converts a $200.00 gain settling on 3 Nov 2026 at that day's 1.1179 to 178.91, not at the day before's 1.1216", () => {
    const rate = hnbRate(ECB_AUTUMN_2026, USD, civil('2026-11-03'))!

    // 200 ÷ 1.1179 is 178.906, so 178.91. The list HNB applied on 3 Nov, published on 2 Nov, would give 178.32.
    expect([decimalText(rate.unitsPerEuro), rate.estimatedFrom, inEuros(decimal('200'), rate.unitsPerEuro)]).toEqual(['1.1179', null, euros(178.91)])
  })

  it("marks Friday's rate as an estimate for Monday and Wednesday when the series ends on Friday", () => {
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
    expect(rateOn('2026-10-05', toFriday)).toEqual(['1.2', '2026-10-02'])
    expect(rateOn('2026-10-04', toFriday)).toEqual(['1.2', null])
  })

  it("takes Thursday's rate as final for Easter Monday when the series ends that Thursday, and as an estimate the Tuesday after", () => {
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

    expect(rateOn('2026-04-06', toThursday)).toEqual(['1.152', null])
    expect(rateOn('2026-04-07', toThursday)).toEqual(['1.152', '2026-04-02'])
  })
})
