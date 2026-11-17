import { describe, expect, it } from 'vitest'

import { emptyPricesFile } from '../src/apps/investments/prices/domain/pricesFile'
import type { PricesFile } from '../src/apps/investments/prices/domain/pricesFile'
import { pricesFileBook } from '../src/apps/investments/prices/domain/pricesFileBooks'
import { quotedPriceBook } from '../src/apps/investments/prices/domain/todaysQuotes'
import type { TodaysQuote } from '../src/apps/investments/prices/domain/todaysQuotes'
import { decimal, instrument } from './fixtures/investments'
import { civil } from './fixtures/ledger'

const SHARE = instrument('abc')
const BY_HAND = instrument('fund', { prices: 'manual', sourceSymbol: '' })

function storedThrough(days: readonly string[]): PricesFile {
  return { ...emptyPricesFile(), series: { 'twelvedata:ABC': { currency: 'EUR', from: days[0]!, closes: days.map((day): [string, string] => [day, '100.00']), checked: null } } }
}

function quote(day: string, price: string): TodaysQuote {
  return { series: 'twelvedata:ABC', day: civil(day), price: decimal(price), at: `${day}T15:40:00.000Z`, marketOpen: true }
}

describe('quotedPriceBook', () => {
  it('values today at a quote of a day after the newest stored close, marked as a quote', () => {
    const book = quotedPriceBook(pricesFileBook(storedThrough(['2026-11-12', '2026-11-13']), []), [quote('2026-11-16', '104.20')])

    expect(book.closeOnOrBefore(SHARE, civil('2026-11-16'))).toEqual({
      date: civil('2026-11-16'),
      price: decimal('104.20'),
      byHand: false,
      quote: { at: '2026-11-16T15:40:00.000Z', marketOpen: true },
    })
    expect(book.closeOnOrBefore(SHARE, civil('2026-11-15'))?.date).toBe(civil('2026-11-13'))
    expect(book.closesBetween(SHARE, civil('2026-11-13'), civil('2026-11-16')).map((close) => [close.date, close.quote === undefined])).toEqual([
      [civil('2026-11-13'), true],
      [civil('2026-11-16'), false],
    ])
  })

  it('lets a stored close of the quote’s day win', () => {
    const book = quotedPriceBook(pricesFileBook(storedThrough(['2026-11-13', '2026-11-16']), []), [quote('2026-11-16', '104.20')])

    expect(book.closeOnOrBefore(SHARE, civil('2026-11-16'))).toEqual({ date: civil('2026-11-16'), price: decimal('100.00'), byHand: false })
  })

  it('changes nothing for a morning click, whose quote is the close already stored', () => {
    const stored = pricesFileBook(storedThrough(['2026-11-12', '2026-11-13']), [])
    const book = quotedPriceBook(stored, [quote('2026-11-13', '100.00')])

    expect(book.closeOnOrBefore(SHARE, civil('2026-11-16'))).toEqual(stored.closeOnOrBefore(SHARE, civil('2026-11-16')))
    expect(book.closesBetween(SHARE, civil('2026-11-01'), civil('2026-11-16'))).toEqual(stored.closesBetween(SHARE, civil('2026-11-01'), civil('2026-11-16')))
  })

  it('leaves an instrument priced by hand and one with no quote at their stored prices', () => {
    const stored = pricesFileBook(storedThrough(['2026-11-13']), [])
    const book = quotedPriceBook(stored, [{ ...quote('2026-11-16', '104.20'), series: 'twelvedata:DEF' }])

    expect(book.closeOnOrBefore(SHARE, civil('2026-11-16'))?.date).toBe(civil('2026-11-13'))
    expect(book.closeOnOrBefore(BY_HAND, civil('2026-11-16'))).toBeNull()
  })
})
