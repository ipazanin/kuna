// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'

import type { PriceVendor } from '../src/apps/investments/prices/application/priceVendor'
import { testVendor } from '../src/apps/investments/prices/application/vendorTest'
import type { VendorTest } from '../src/apps/investments/prices/application/vendorTest'
import { fakeVendorFetch } from '../src/apps/investments/prices/infrastructure/fake/fakeVendorAnswers'
import { storeVendorKey, storedVendorKey } from '../src/apps/investments/prices/infrastructure/vendorKeys'
import { alphaVantage } from '../src/apps/investments/prices/infrastructure/vendors/alphaVantage'
import { ecb } from '../src/apps/investments/prices/infrastructure/vendors/ecb'
import { PRICE_VENDORS } from '../src/apps/investments/prices/infrastructure/vendors/priceVendors'
import { twelveData } from '../src/apps/investments/prices/infrastructure/vendors/twelveData'
import { keyEnding, useVendorKeys } from '../src/apps/investments/prices/presentation/useVendorKeys'
import { civil } from './fixtures/ledger'

const LONG_KEY = 'made-up-key-0123456789abcdef'

beforeEach(() => {
  localStorage.clear()
})

/** The card's key rows over this browser's storage, with each Test answered as `answer` says and noted. */
function cardKeys(answer: (vendor: PriceVendor, key: string | null) => VendorTest = () => ({ kind: 'works' })) {
  const tested: (readonly [string, string | null])[] = []
  const keys = useVendorKeys(PRICE_VENDORS, { read: storedVendorKey, write: storeVendorKey }, async (vendor, key) => {
    tested.push([vendor.id, key])
    return answer(vendor, key)
  })
  return { keys, tested }
}

describe('the keys of the Prices card', () => {
  it('keeps a typed key in this browser alone, trimmed, and shows only its last four characters', () => {
    const { keys } = cardKeys()
    expect(keys.save('twelvedata', `  ${LONG_KEY} `)).toBe(true)

    expect(storedVendorKey('twelvedata')).toBe(LONG_KEY)
    expect(keys.rows.twelvedata).toEqual({ kept: true, ending: 'cdef', test: null })
    expect(JSON.stringify(keys.rows)).not.toContain(LONG_KEY.slice(0, -4))
  })

  it('shows no part of a short key', () => {
    const { keys } = cardKeys()
    keys.save('alphavantage', 'SHORTKEY1')
    expect(keyEnding('SHORTKEY1')).toBeNull()
    expect(keys.rows.alphavantage).toEqual({ kept: true, ending: null, test: null })
  })

  it('keeps nothing from an empty field, and leaves a kept key as it was', () => {
    storeVendorKey('twelvedata', LONG_KEY)
    const { keys } = cardKeys()
    expect(keys.save('twelvedata', '   ')).toBe(false)
    expect(storedVendorKey('twelvedata')).toBe(LONG_KEY)
    expect(keys.rows.twelvedata?.kept).toBe(true)
  })

  it('shows a key another tab kept when the card opens, and forgets it on Remove', () => {
    storeVendorKey('alphavantage', LONG_KEY)
    const { keys } = cardKeys()
    expect(keys.rows.alphavantage).toEqual({ kept: true, ending: 'cdef', test: null })
    keys.forget('alphavantage')
    expect(storedVendorKey('alphavantage')).toBeNull()
    expect(Object.keys(localStorage)).toEqual([])
    expect(keys.rows.alphavantage).toEqual({ kept: false, ending: null, test: null })
  })

  it('tests with the key kept for the vendor, and with none for the ECB, showing the answer on the row', async () => {
    const { keys, tested } = cardKeys((vendor) => (vendor.id === 'alphavantage' ? { kind: 'failed', reason: 'refused' } : { kind: 'works' }))
    keys.save('twelvedata', LONG_KEY)
    keys.save('alphavantage', 'other-made-up-key-9876')

    const running = keys.test(twelveData)
    expect(keys.rows.twelvedata?.test).toBe('testing')
    await running
    await keys.test(alphaVantage)
    await keys.test(ecb)

    expect(tested).toEqual([
      ['twelvedata', LONG_KEY],
      ['alphavantage', 'other-made-up-key-9876'],
      ['ecb', null],
    ])
    expect(keys.rows.twelvedata?.test).toEqual({ kind: 'works' })
    expect(keys.rows.alphavantage?.test).toEqual({ kind: 'failed', reason: 'refused' })
    expect(keys.rows.ecb?.test).toEqual({ kind: 'works' })
  })
})

describe('the Test of a vendor', () => {
  const today = civil('2026-10-30')

  it('asks each vendor once for its test symbol, which the fake build answers', async () => {
    for (const vendor of PRICE_VENDORS) {
      const asked: string[] = []
      const result = await testVendor(
        vendor,
        (url) => {
          asked.push(url)
          return fakeVendorFetch(url)
        },
        vendor.needsKey ? LONG_KEY : null,
        today,
      )
      expect(result).toEqual({ kind: 'works' })
      expect(asked).toHaveLength(1)
      expect(asked[0]).toContain(encodeURIComponent(vendor.testSymbol))
    }
  })

  it('asks nothing of a vendor that needs a key while none is kept', async () => {
    const asked: string[] = []
    const result = await testVendor(
      twelveData,
      async (url) => {
        asked.push(url)
        return { status: 200, text: '' }
      },
      null,
      today,
    )
    expect(result).toEqual({ kind: 'failed', reason: 'no-key' })
    expect(asked).toEqual([])
  })

  it('says a key Twelve Data turns away was refused', async () => {
    const answer = { status: 401, text: JSON.stringify({ code: 401, message: '**apikey** parameter is incorrect or not specified.', status: 'error' }) }
    expect(await testVendor(twelveData, async () => answer, 'not-a-real-key-at-all', today)).toEqual({ kind: 'failed', reason: 'refused' })
  })
})

describe('the key field of the Prices card', () => {
  const card = readFileSync(join(import.meta.dirname, '..', 'src/apps/investments/prices/presentation/PricesCard.vue'), 'utf8')

  it('is a masked field that only the typed text fills, never the kept key', () => {
    const field = card.slice(card.indexOf('<UInput'), card.indexOf('/>', card.indexOf('<UInput')))
    expect(field).toContain('type="password"')
    expect(field).toContain('v-model="typed[row.vendor.id]"')
    expect(card).not.toMatch(/storedVendorKey\(/)
  })
})
