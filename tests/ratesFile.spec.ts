import { describe, expect, it } from 'vitest'

import { decodeRatesFile, emptyRatesFile, encodeRatesFile, sameRates } from '../src/shared/rates/domain/ratesFile'
import type { RatesFile } from '../src/shared/rates/domain/ratesFile'

const FILE: RatesFile = {
  writtenAt: '2026-11-07T08:00:00.000Z',
  wanted: { ARS: '2024-01-01' },
  ecb: {
    USD: {
      from: '2015-01-01',
      checked: '2026-11-06',
      rows: [
        ['2026-11-05', '1.1224'],
        ['2026-11-06', '1.1165'],
      ],
    },
  },
  twelveData: { ARS: { from: '2024-01-01', checked: '2026-11-06', rows: [['2026-11-05', '1719.67']] } },
  hand: {
    ARS: [
      ['2023-12-29', '893.50', '2026-11-07T09:12:00.000Z'],
      ['2024-02-01', null, '2026-11-07T09:15:00.000Z'],
    ],
  },
}

function decoded(text: string): RatesFile {
  const read = decodeRatesFile(text)
  if (read.kind !== 'read') throw new Error(`Refused: ${read.reason}`)
  return read.file
}

describe('the rates file', () => {
  it('reads back what it wrote, a removal among the typed rates', () => {
    expect(decoded(encodeRatesFile(FILE))).toEqual(FILE)
    expect(decoded(encodeRatesFile(FILE)).hand.ARS?.[1]).toEqual(['2024-02-01', null, '2026-11-07T09:15:00.000Z'])
  })

  it('writes one line per series, sorted by key', () => {
    const lines = encodeRatesFile(FILE).split('\n')

    expect(lines.filter((line) => line.startsWith('    "')).map((line) => line.slice(4, line.indexOf('": ') + 2))).toEqual(['"ecb:USD":', '"hand:ARS":', '"twelvedata:ARS":'])
  })

  it('refuses a file of a newer version, one that is not JSON, and one of another format', () => {
    expect(decodeRatesFile(encodeRatesFile(FILE).replace('"version": 1', '"version": 2'))).toEqual({ kind: 'refused', reason: 'newer' })
    expect(decodeRatesFile('{')).toEqual({ kind: 'refused', reason: 'not-json' })
    expect(decodeRatesFile('{"format": "kuna-prices", "version": 3}')).toEqual({ kind: 'refused', reason: 'not-rates' })
  })

  it('refuses rows out of order, a rate of zero and a series whose currency differs from its key', () => {
    const text = encodeRatesFile(FILE)

    expect(decodeRatesFile(text.replace('["2026-11-05","1.1224"],["2026-11-06","1.1165"]', '["2026-11-06","1.1165"],["2026-11-05","1.1224"]'))).toEqual({ kind: 'refused', reason: 'not-in-shape' })
    expect(decodeRatesFile(text.replace('"1.1224"', '"0.0000"'))).toEqual({ kind: 'refused', reason: 'not-in-shape' })
    expect(decodeRatesFile(text.replace('"currency":"USD"', '"currency":"GBP"'))).toEqual({ kind: 'refused', reason: 'not-in-shape' })
  })

  it('reads 0.8 as a rate of eight tenths of a unit per euro, never as a percent', () => {
    const file = decoded(encodeRatesFile({ ...emptyRatesFile(), ecb: { GBP: { from: '2026-01-01', checked: '2026-01-02', rows: [['2026-01-02', '0.8']] } } }))

    expect(file.ecb.GBP?.rows).toEqual([['2026-01-02', '0.8']])
  })

  it('counts two files as the same whenever each was written', () => {
    expect(sameRates(FILE, { ...FILE, writtenAt: null })).toBe(true)
    expect(sameRates(FILE, { ...FILE, wanted: {} })).toBe(false)
  })
})
