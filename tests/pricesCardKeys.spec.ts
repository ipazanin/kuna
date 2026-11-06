// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'

import type { PriceVendor } from '../src/apps/investments/prices/application/priceVendor'
import { testVendor } from '../src/apps/investments/prices/application/vendorTest'
import type { VendorTest } from '../src/apps/investments/prices/application/vendorTest'
import { fakeVendorFetch } from '../src/apps/investments/prices/infrastructure/fake/fakeVendorAnswers'
import { keepSecretChanges, storeSecret, storedSecretChanges, storedSecret } from '../src/shared/secrets/infrastructure/browserSecrets'
import { alphaVantage } from '../src/apps/investments/prices/infrastructure/vendors/alphaVantage'
import { ecb } from '../src/apps/investments/prices/infrastructure/vendors/ecb'
import { finnhub } from '../src/apps/investments/prices/infrastructure/vendors/finnhub'
import { PRICE_VENDORS } from '../src/apps/investments/prices/infrastructure/vendors/priceVendors'
import { twelveData } from '../src/apps/investments/prices/infrastructure/vendors/twelveData'
import { PAGE_SECRET_STORE } from '../src/shared/secrets/presentation/pageSecrets'
import { keyEnding, useSecretRows } from '../src/shared/secrets/presentation/useSecretRows'
import * as prices from '../src/apps/investments/prices/presentation/words'
import * as assist from '../src/shared/ai/presentation/words'
import { civil } from './fixtures/ledger'

const LONG_KEY = 'made-up-key-0123456789abcdef'
const SAVED_AT = '2026-10-30T10:00:00.000Z'

beforeEach(() => {
  localStorage.clear()
})

/** The card's key rows over this browser's storage, with each Test answered as `answer` says and noted. */
function cardKeys(answer: (vendor: PriceVendor, key: string | null) => VendorTest = () => ({ kind: 'works' })) {
  const tested: (readonly [string, string | null])[] = []
  const keys = useSecretRows(PRICE_VENDORS, PAGE_SECRET_STORE, async (vendor, key) => {
    tested.push([vendor.id, key])
    return answer(vendor, key)
  })
  return { keys, tested }
}

describe('the keys of the Prices card', () => {
  it('keeps a typed key in this browser alone, trimmed, and shows only its last four characters', () => {
    const { keys } = cardKeys()
    expect(keys.save('twelvedata', `  ${LONG_KEY} `)).toBe(true)

    expect(storedSecret('twelvedata')).toBe(LONG_KEY)
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
    storeSecret('twelvedata', LONG_KEY, SAVED_AT)
    const { keys } = cardKeys()
    expect(keys.save('twelvedata', '   ')).toBe(false)
    expect(storedSecret('twelvedata')).toBe(LONG_KEY)
    expect(keys.rows.twelvedata?.kept).toBe(true)
  })

  it('shows a key another tab kept when the card opens, and forgets it on Remove, noting when', () => {
    storeSecret('alphavantage', LONG_KEY, SAVED_AT)
    const { keys } = cardKeys()
    expect(keys.rows.alphavantage).toEqual({ kept: true, ending: 'cdef', test: null })
    keys.forget('alphavantage')
    expect(storedSecret('alphavantage')).toBeNull()
    expect(Object.keys(localStorage)).toEqual(['kuna.secret-changed.alphavantage'])
    expect(storedSecretChanges().alphavantage?.changedAt).not.toBe(SAVED_AT)
    expect(keys.rows.alphavantage).toEqual({ kept: false, ending: null, test: null })
  })

  it('puts a removed key back on Undo, and leaves a key saved since then as it is', () => {
    storeSecret('twelvedata', LONG_KEY, SAVED_AT)
    const { keys } = cardKeys()
    keys.forget('twelvedata')()
    expect(storedSecret('twelvedata')).toBe(LONG_KEY)
    expect(keys.rows.twelvedata).toEqual({ kept: true, ending: 'cdef', test: null })

    const undo = keys.forget('twelvedata')
    keys.save('twelvedata', 'made-up-twelve-data-key-8642')
    undo()
    expect(storedSecret('twelvedata')).toBe('made-up-twelve-data-key-8642')
  })

  it('shows a key a sync took from another browser once the rows are read again, keeping the last Test', async () => {
    const { keys } = cardKeys()
    await keys.test(ecb)
    keepSecretChanges({ twelvedata: { key: LONG_KEY, changedAt: SAVED_AT } })
    expect(keys.rows.twelvedata?.kept).toBe(false)
    keys.reread()
    expect(keys.rows.twelvedata).toEqual({ kept: true, ending: 'cdef', test: null })
    expect(keys.rows.ecb?.test).toEqual({ kind: 'works' })
  })

  it('drops the last Test of a key a sync replaced or removed, which it never tested', async () => {
    const { keys } = cardKeys()
    keys.save('twelvedata', LONG_KEY)
    keys.save('finnhub', 'made-up-finnhub-key-5521')
    await keys.test(twelveData)
    await keys.test(finnhub)
    keepSecretChanges({ twelvedata: { key: 'made-up-twelve-data-key-8642', changedAt: SAVED_AT }, finnhub: { key: null, changedAt: SAVED_AT } })
    keys.reread()
    expect(keys.rows.twelvedata).toEqual({ kept: true, ending: '8642', test: null })
    expect(keys.rows.finnhub).toEqual({ kept: false, ending: null, test: null })
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

describe('what the keys cards say of where a key goes', () => {
  const read = (file: string) => readFileSync(join(import.meta.dirname, '..', file), 'utf8')

  it('follows whether any app has a file on Drive on the Prices card, not the Investments file alone', () => {
    const card = read('src/apps/investments/prices/presentation/PriceVendorsCard.vue')
    expect(card).toContain('someOnDrive.value ? words.card.subtitleOnDrive : words.card.subtitle')
    expect(card).not.toContain('useInvestmentsBooks')
  })

  it("says a sync saves the key on the assistant's card only while some app's file is on Drive, which Kuna settings tells", () => {
    expect(read('src/shared/ai/presentation/AiAssistCard.vue')).toContain('v-if="onDrive"')
    expect(read('src/shell/settings/SettingsScreen.vue')).toContain(':on-drive="someOnDrive"')
  })

  it('no longer promises a key never goes into a file while it could', () => {
    for (const dictionary of [prices.en, prices.hr]) {
      expect(dictionary.card.subtitle).not.toMatch(/never|nikad/)
      expect(dictionary.card.subtitle).toMatch(/Drive/)
    }
    expect(assist.en.card.synced).toMatch(/Google account/)
    expect(assist.hr.card.synced).toMatch(/Google račun/)
  })
})

describe('the key field of the Prices settings', () => {
  const card = readFileSync(join(import.meta.dirname, '..', 'src/apps/investments/prices/presentation/PriceVendorsCard.vue'), 'utf8')

  it('is a masked field that only the typed text fills, never the kept key', () => {
    const field = card.slice(card.indexOf('<UInput'), card.indexOf('/>', card.indexOf('<UInput')))
    expect(field).toContain('type="password"')
    expect(field).toContain('v-model="typed[row.vendor.id]"')
    expect(card).not.toMatch(/storedSecret\(/)
  })
})
