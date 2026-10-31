import { describe, expect, it } from 'vitest'

import { fetchPrices } from '../src/apps/investments/prices/application/priceFetch'
import type { PriceFetchPorts } from '../src/apps/investments/prices/application/pricesPorts'
import { readClosesCsv } from '../src/apps/investments/prices/domain/closesCsv'
import { closesImportLine, holdingsNamedBy, withImportedCloses } from '../src/apps/investments/prices/domain/closesImport'
import { decodePricesFile, emptyPricesFile, encodePricesFile } from '../src/apps/investments/prices/domain/pricesFile'
import type { CloseRow, PricesFile } from '../src/apps/investments/prices/domain/pricesFile'
import { alphaVantage } from '../src/apps/investments/prices/infrastructure/vendors/alphaVantage'
import { BROKER, USD, book, cashMovement, instrument, trade } from './fixtures/investments'

const ETF = instrument('etf', { name: 'Made-up World ETF', symbol: 'MWE', prices: 'alphavantage', sourceSymbol: 'MWE.DEX' })
const SOLD = instrument('sold', { name: 'Made-up Chips', symbol: 'MCH', currency: USD, sourceSymbol: 'MCH' })
const BY_HAND = instrument('fund', { name: 'Made-up Fund', symbol: 'MWE', prices: 'manual', sourceSymbol: '' })

const RECORDS = book({
  accounts: [BROKER],
  instruments: [ETF, SOLD, BY_HAND],
  cashMovements: [cashMovement('deposit', BROKER, '2026-01-02', '5000')],
  trades: [
    trade('buy', BROKER, ETF, '2026-01-05', '10', '100', '0'),
    trade('buy', BROKER, SOLD, '2026-01-05', '2', '50', '0', '1.1'),
    trade('sell', BROKER, SOLD, '2026-02-02', '2', '55', '0', '1.1'),
  ],
})

function closes(text: string): readonly CloseRow[] {
  const read = readClosesCsv(text)
  if (read.kind !== 'read') throw new Error(read.refusal.kind)
  return read.closes
}

describe('matching a file of closes to a holding by its name', () => {
  it("takes the symbol or the price source's symbol, held or sold, ignoring case, and never a holding priced by hand", () => {
    expect(holdingsNamedBy('mwe.dex.csv', RECORDS.instruments)).toEqual([ETF])
    expect(holdingsNamedBy('MWE.csv', RECORDS.instruments)).toEqual([ETF])
    expect(holdingsNamedBy('MCH.CSV', RECORDS.instruments)).toEqual([SOLD])
    expect(holdingsNamedBy('NOPE.csv', RECORDS.instruments)).toEqual([])
  })
})

describe('the dry run and the write of a file of closes', () => {
  const stored: PricesFile = {
    ...emptyPricesFile(),
    series: {
      'alphavantage:MWE.DEX': {
        currency: 'EUR',
        from: '2026-01-05',
        checked: '2026-03-03',
        closes: [
          ['2026-01-30', '101'],
          ['2026-02-27', '104'],
          ['2026-03-02', '105'],
        ],
      },
    },
  }

  it('counts the days it adds and those it takes the place of, and names a gap before the first buy', () => {
    const line = closesImportLine(stored, RECORDS, ETF, closes('Date,Close\n2026-01-08,100.5\n2026-01-30,101.2\n2026-02-02,101.4\n'))
    expect([line.first, line.last, line.added, line.replaced, line.gapFrom]).toEqual(['2026-01-08', '2026-02-02', 2, 1, '2026-01-05'])
    expect(closesImportLine(stored, RECORDS, ETF, closes('Date,Close\n2026-01-02,99\n')).gapFrom).toBeNull()
  })

  it("puts the file's closes into the holding's own series by day, in place of those already there, and keeps the others", () => {
    const line = closesImportLine(stored, RECORDS, ETF, closes('Date,Close\n2026-01-02,99\n2026-01-30,101.2\n'))
    const written = withImportedCloses(stored, [line]).series['alphavantage:MWE.DEX']!
    expect(written.closes).toEqual([
      ['2026-01-02', '99'],
      ['2026-01-30', '101.2'],
      ['2026-02-27', '104'],
      ['2026-03-02', '105'],
    ])
    expect([written.from, written.checked, written.currency]).toEqual(['2026-01-02', '2026-03-03', 'EUR'])
  })

  it("starts a series the file is the first to fill in the holding's quote currency", () => {
    const line = closesImportLine(emptyPricesFile(), RECORDS, SOLD, closes('Date,Close\n2026-01-02,49\n2026-02-02,55\n'))
    expect(withImportedCloses(emptyPricesFile(), [line]).series['twelvedata:MCH']).toEqual({
      currency: 'USD',
      from: '2026-01-02',
      checked: null,
      closes: [
        ['2026-01-02', '49'],
        ['2026-02-02', '55'],
      ],
    })
  })

  it('leaves the fetch to ask the vendor only for the days after the last imported close, never for the history the file covers', async () => {
    const daily = Array.from({ length: 40 }, (_, place) => {
      const day = new Date(Date.UTC(2026, 0, 2 + place)).toISOString().slice(0, 10)
      return `${day},${100 + place}`
    })
    const line = closesImportLine(emptyPricesFile(), RECORDS, ETF, closes(['Date,Close', ...daily].join('\n')))
    let text = encodePricesFile(withImportedCloses(emptyPricesFile(), [line]))
    const asked: string[] = []
    const ports: PriceFetchPorts = {
      async fetch(url) {
        asked.push(url)
        const days = { '2026-02-09': '138.0000', '2026-02-10': '139.0000', '2026-02-11': '139.5000', '2026-02-12': '140.0000' }
        return { status: 200, text: JSON.stringify({ 'Time Series (Daily)': Object.fromEntries(Object.entries(days).map(([day, close]) => [day, { '4. close': close }])) }) }
      },
      pause: async () => {},
      key: () => 'MADEUPKEY01',
      investments: () => book({ ...RECORDS, instruments: [ETF], trades: [RECORDS.trades[0]!] }),
      readPrices: async () => text,
      async writePrices(written) {
        text = written
      },
      progress: () => {},
    }
    await fetchPrices(ports, [alphaVantage], { at: '2026-02-13T07:00:00.000Z', day: '2026-02-13' })

    // One request for the daily closes, which reach back to the last imported close of 10 Feb, and none for the history before it.
    expect(asked.map((url) => new URL(url).searchParams.get('function'))).toEqual(['TIME_SERIES_DAILY'])
    const read = decodePricesFile(text)
    expect(read.kind === 'read' ? read.file.series['alphavantage:MWE.DEX']!.closes.at(-1) : null).toEqual(['2026-02-12', '140.0000'])
  })
})
