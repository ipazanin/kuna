import { describe, expect, it } from 'vitest'

import { emptyRatesFile, encodeRatesFile } from '../src/shared/rates/domain/ratesFile'
import type { RatesFile } from '../src/shared/rates/domain/ratesFile'
import { mergeRates } from '../src/shared/rates/domain/ratesMerge'

const EMPTY = emptyRatesFile()

function typed(currency: string, rows: RatesFile['hand'][string]): RatesFile {
  return { ...EMPTY, hand: { [currency]: rows } }
}

describe('merging two copies of the rates file', () => {
  it('keeps a rate typed on each of two devices', () => {
    const phone = typed('ARS', [['2023-12-29', '893.50', '2026-11-07T09:12:00.000Z']])
    const laptop = typed('ARS', [['2024-03-01', '850.00', '2026-11-07T10:00:00.000Z']])

    expect(mergeRates(phone, laptop).hand.ARS).toEqual([
      ['2023-12-29', '893.50', '2026-11-07T09:12:00.000Z'],
      ['2024-03-01', '850.00', '2026-11-07T10:00:00.000Z'],
    ])
  })

  it('lets a removal beat an older typed rate of the same day, and a newer rate beat the removal', () => {
    const rate = typed('ARS', [['2024-02-01', '900.00', '2026-11-07T09:00:00.000Z']])
    const removal = typed('ARS', [['2024-02-01', null, '2026-11-07T09:15:00.000Z']])
    const again = typed('ARS', [['2024-02-01', '905.00', '2026-11-07T09:30:00.000Z']])

    expect(mergeRates(rate, removal).hand.ARS).toEqual([['2024-02-01', null, '2026-11-07T09:15:00.000Z']])
    expect(mergeRates(again, removal).hand.ARS).toEqual([['2024-02-01', '905.00', '2026-11-07T09:30:00.000Z']])
  })

  it('takes the ECB rows of both, the later check winning a shared day, from the earlier start', () => {
    const older: RatesFile = { ...EMPTY, ecb: { USD: { from: '2015-01-01', checked: '2026-11-05', rows: [['2026-11-05', '1.1200']] } } }
    const newer: RatesFile = {
      ...EMPTY,
      ecb: {
        USD: {
          from: '2020-01-01',
          checked: '2026-11-06',
          rows: [
            ['2026-11-05', '1.1224'],
            ['2026-11-06', '1.1165'],
          ],
        },
      },
    }

    expect(mergeRates(older, newer).ecb.USD).toEqual({
      from: '2015-01-01',
      checked: '2026-11-06',
      rows: [
        ['2026-11-05', '1.1224'],
        ['2026-11-06', '1.1165'],
      ],
    })
  })

  it('gives the same file whichever copy comes first', () => {
    const first: RatesFile = {
      writtenAt: '2026-11-07T08:00:00.000Z',
      wanted: { ARS: '2024-01-01' },
      ecb: { USD: { from: '2015-01-01', checked: '2026-11-06', rows: [['2026-11-06', '1.1165']] } },
      twelveData: {},
      hand: { BAM: [['2026-11-02', '1.95583', '2026-11-07T09:00:00.000Z']] },
    }
    const second: RatesFile = {
      writtenAt: '2026-11-07T09:00:00.000Z',
      wanted: { ARS: '2023-06-01', VES: '2025-01-01' },
      ecb: { USD: { from: '2015-01-01', checked: '2026-11-06', rows: [['2026-11-06', '1.1166']] } },
      twelveData: {},
      hand: { BAM: [['2026-11-02', '1.95580', '2026-11-07T09:00:00.000Z']] },
    }

    expect(encodeRatesFile(mergeRates(first, second))).toBe(encodeRatesFile(mergeRates(second, first)))
    expect(mergeRates(first, second).wanted).toEqual({ ARS: '2023-06-01', VES: '2025-01-01' })
  })
})
