import { describe, expect, it } from 'vitest'

import { NEW_ENTRY, heldReceiptOf, placeOf, receiptAccounts, receiptMatches, splittableRows } from '../src/apps/spending/receipts/domain/receiptMatch'
import type { ReceiptFacts } from '../src/apps/spending/receipts/domain/receiptMatch'
import { rowsTakingReceipt } from '../src/apps/spending/statements/domain/reviewQueue'
import { RECEIPT_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import type { Receipt } from '../src/apps/spending/workbook/domain/receipt'
import type { Transaction } from '../src/apps/spending/workbook/domain/transaction'
import { MADE_UP_MERCHANT_OIB } from '../src/apps/spending/assistant/infrastructure/fake/fakeReceiptsChat'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { civil, euros } from './fixtures/ledger'
import { ACCOUNTS, CASH, CATEGORIES, OTP, REVOLUT_EUR, REVOLUT_USD, row, spendingBook, wholeItems } from './fixtures/spending'

const ISSUED = civil('2026-11-03')

function matchesOf(rows: readonly Transaction[], merchant = '', total = 23.49, receipts: readonly Receipt[] = [], facts: Partial<ReceiptFacts> = {}) {
  return receiptMatches(
    { merchant, merchantOib: '', issuedOn: ISSUED, total: euros(total), latitude: '', longitude: '', ...facts },
    { accounts: ACCOUNTS, categories: CATEGORIES, transactions: rows, receipts, items: wholeItems(rows) },
    null,
  )
}

function rowsOf(matches: ReturnType<typeof matchesOf>) {
  return matches.kind === 'none' ? [] : matches.candidates.map((candidate) => candidate.row)
}

describe('which rows a receipt may split', () => {
  it('offers one candidate ready', () => {
    const card = row(OTP, '2026-11-04', -23.49, null, { payee: 'Corner market' })

    expect(matchesOf([card])).toEqual({ kind: 'ready', candidates: [{ row: card, difference: euros(0) }] })
  })

  it('asks for a pick of two equal payments, the nearest day first', () => {
    const later = row(OTP, '2026-11-08', -23.49, null)
    const sooner = row(REVOLUT_EUR, '2026-11-04', -23.49, null)
    const matches = matchesOf([later, sooner])

    expect(matches.kind).toBe('pick')
    expect(rowsOf(matches)).toEqual([sooner, later])
  })

  it("takes the one whose text holds the merchant's words as clear, whatever its day", () => {
    const nearer = row(OTP, '2026-11-03', -23.49, null, { payee: 'Bookshop' })
    const named = row(REVOLUT_EUR, '2026-11-06', -23.49, null, { description: 'POS KONZUM PJ 0412' })
    const matches = matchesOf([nearer, named], 'Konzum d.d.')

    expect(matches.kind).toBe('ready')
    expect(rowsOf(matches)).toEqual([named, nearer])
  })

  it('folds accents in the merchant and the row alike, and leaves out the bits of a company form', () => {
    const named = row(OTP, '2026-11-04', -23.49, null, { payee: 'SLASTICARNA' })
    const other = row(OTP, '2026-11-04', -23.49, null, { payee: 'D.O.O. Other' })

    expect(rowsOf(matchesOf([other, named], 'Slastičarna d.o.o.'))[0]).toBe(named)
  })

  it('stays inside the window of 3 days before the receipt to 7 after', () => {
    expect(matchesOf([row(OTP, '2026-10-31', -23.49, null)]).kind).toBe('ready')
    expect(matchesOf([row(OTP, '2026-11-10', -23.49, null)]).kind).toBe('ready')
  })

  it('offers an equal amount further off, and an amount within a tenth, only as a pick with its difference', () => {
    const further = row(OTP, '2026-11-15', -23.49, null)
    const tip = row(OTP, '2026-11-04', -25, null)
    const matches = matchesOf([further, tip])

    expect(matches.kind).toBe('pick')
    expect(matches).toMatchObject({
      candidates: [
        { row: tip, difference: euros(-1.51) },
        { row: further, difference: euros(0) },
      ],
    })
  })

  it('leaves the near ones out while an equal amount is in the window', () => {
    const exact = row(OTP, '2026-11-04', -23.49, null)

    expect(rowsOf(matchesOf([exact, row(OTP, '2026-11-04', -25, null)]))).toEqual([exact])
  })

  it('makes none of a far amount, money in, or a far day', () => {
    expect(matchesOf([row(OTP, '2026-11-04', -40, null), row(OTP, '2026-11-04', 23.49, 'Income/Salary'), row(OTP, '2026-12-01', -23.49, null)])).toEqual({ kind: 'none' })
  })

  it('never offers a transfer, in any of the ways a row can be one', () => {
    const leg = row(OTP, '2026-11-04', -23.49, 'Between my accounts')
    const paired = row(OTP, '2026-11-04', -23.49, null, { pair: row(REVOLUT_EUR, '2026-11-04', 23.49, null).id })
    const exchange = row(OTP, '2026-11-04', -23.49, null, { movedAt: '2026-11-04 09:30:00' })
    const toOwnIban = row(OTP, '2026-11-04', -23.49, null, { counterpartyIban: REVOLUT_EUR.iban })

    expect(matchesOf([leg, paired, exchange, toOwnIban])).toEqual({ kind: 'none' })
  })

  it('never offers a row with a receipt', () => {
    const card = row(OTP, '2026-11-04', -23.49, null)
    const receipt: Receipt = {
      id: recordIdOf(RECEIPT_RECORDS, '5e000000-0000-4000-8000-000000006001'),
      transaction: card.id,
      account: null,
      merchant: '',
      merchantOib: '',
      buyerOib: '',
      issuedOn: ISSUED,
      issuedTime: '',
      total: euros(23.49),
      jir: '',
      zki: '',
      readBy: '',
      photo: '',
      latitude: '',
      longitude: '',
    }

    expect(matchesOf([card], '', 23.49, [receipt])).toEqual({ kind: 'none' })
  })

  it('never offers a row on an account in another currency, since a fiscal total is in euros', () => {
    expect(matchesOf([row(REVOLUT_USD, '2026-11-04', -23.49, null)])).toEqual({ kind: 'none' })
  })

  it('offers a typed cash row', () => {
    expect(matchesOf([row(CASH, '2026-11-03', -23.49, 'Food/Eating out')]).kind).toBe('ready')
  })

  it('offers no cash row of the amount two days earlier paid to someone else, neither in the window nor as a near one', () => {
    expect(matchesOf([row(CASH, '2026-11-01', -23.49, 'Food/Eating out', { payee: 'A person' })], 'Cafe Example')).toEqual({ kind: 'none' })
  })

  it('offers the cash row of the receipt day whatever its payee', () => {
    const typed = row(CASH, '2026-11-03', -23.49, 'Food/Eating out', { payee: 'A person' })

    expect(rowsOf(matchesOf([typed], 'Cafe Example'))).toEqual([typed])
  })

  it("offers a cash row a day off when its payee holds the merchant's words", () => {
    const typed = row(CASH, '2026-11-02', -23.49, 'Food/Eating out', { payee: 'Example' })

    expect(matchesOf([typed], 'Cafe Example d.o.o.')).toEqual({ kind: 'ready', candidates: [{ row: typed, difference: euros(0) }] })
  })

  it("still offers a card's row from 3 days before the receipt to 7 after, whoever the bank names", () => {
    const before = row(OTP, '2026-10-31', -23.49, null, { payee: 'A person' })
    const after = row(REVOLUT_EUR, '2026-11-10', -23.49, null, { payee: 'A person' })

    expect(rowsOf(matchesOf([before, after], 'Cafe Example'))).toEqual([before, after])
  })

  it('never lets a company form or a piece of a word win the match', () => {
    const konzum = row(OTP, '2026-11-04', -23.49, null, { payee: 'KONZUM DOO' })
    const bakery = row(OTP, '2026-11-04', -23.49, null, { payee: 'PEK 12' })

    expect(matchesOf([konzum, bakery], 'Pekara Dora DOO').kind).toBe('pick')
    expect(matchesOf([row(OTP, '2026-11-04', -23.49, null, { payee: 'SUPERKONZUMA' }), bakery], 'Konzum').kind).toBe('pick')
  })

  it('asks about a lone payment when a known merchant is not in its text', () => {
    const parking = row(OTP, '2026-11-09', -23.49, 'Transport/Parking and tolls', { payee: 'PARKING ZAGREB' })

    expect(matchesOf([parking], 'Pekara').kind).toBe('pick')
    expect(matchesOf([parking], 'Parking Zagreb').kind).toBe('ready')
    expect(matchesOf([parking]).kind).toBe('ready')
  })
})

let heldPlace = 0

/** A receipt already on its row, of a merchant and an OIB, taken at a place when one is given. */
function heldOn(on: Transaction, merchant: string, merchantOib = '', place: Pick<Receipt, 'latitude' | 'longitude'> = { latitude: '', longitude: '' }): Receipt {
  heldPlace += 1
  return {
    id: recordIdOf(RECEIPT_RECORDS, `5e000000-0000-4000-8000-0000000071${String(heldPlace).padStart(2, '0')}`),
    transaction: on.id,
    account: null,
    merchant,
    merchantOib,
    buyerOib: '',
    issuedOn: civil('2026-10-02'),
    issuedTime: '',
    total: euros(2.4),
    jir: '',
    zki: '',
    readBy: '',
    photo: '',
    ...place,
  }
}

const PERO_OIB = MADE_UP_MERCHANT_OIB
const MOJITO_SQUARE = { latitude: '45.813000', longitude: '15.977000' }
// About 30 m north of the square: 0.00027 degrees of latitude is 30 m.
const BESIDE_MOJITO = { latitude: '45.813270', longitude: '15.977000' }

describe("the bank's name for a merchant", () => {
  const earlier = row(OTP, '2026-10-02', -2.4, 'Food/Eating out', { source: 'statement', payee: 'CAFFE BAR MOJITO', importKey: 'otp-1' })
  const mojito = row(OTP, '2026-11-04', -2.4, null, { source: 'statement', payee: 'CAFFE BAR MOJITO', importKey: 'otp-2' })
  const other = row(OTP, '2026-11-03', -2.4, null, { source: 'statement', payee: 'KIOSK TISAK', importKey: 'otp-3' })

  it("makes the row the bank names that way ready out of two equal payments, by the merchant's OIB", () => {
    const matches = matchesOf([earlier, other, mojito], 'Obrt Pero', 2.4, [heldOn(earlier, 'Obrt Pero d.o.o.', PERO_OIB)], { merchantOib: PERO_OIB })

    expect(matches.kind).toBe('ready')
    expect(rowsOf(matches)).toEqual([mojito, other])
  })

  it('does the same by name when neither receipt has an OIB', () => {
    expect(matchesOf([earlier, other, mojito], 'Obrt  pero', 2.4, [heldOn(earlier, 'OBRT PERO')])).toMatchObject({ kind: 'ready', candidates: [{ row: mojito }, { row: other }] })
  })

  it('learns nothing from a row no bank brought', () => {
    const typed = row(OTP, '2026-10-02', -2.4, 'Food/Eating out', { payee: 'CAFFE BAR MOJITO' })

    expect(matchesOf([typed, other, mojito], 'Obrt Pero', 2.4, [heldOn(typed, 'Obrt Pero')]).kind).toBe('pick')
  })

  it("learns nothing new from a bank's row under the merchant's own name, and never from a description every card payment shares", () => {
    const own = row(OTP, '2026-10-02', -2.4, 'Food/Eating out', { source: 'statement', payee: 'Obrt Pero', description: 'KARTICNO PLACANJE', importKey: 'otp-4' })
    const lone = row(OTP, '2026-11-04', -2.4, null, { source: 'statement', payee: 'KIOSK TISAK', description: 'KARTICNO PLACANJE', importKey: 'otp-5' })
    const shared = row(OTP, '2026-10-02', -2.4, 'Food/Eating out', { source: 'statement', payee: '', description: 'KARTICNO PLACANJE', importKey: 'otp-6' })

    expect(matchesOf([own, lone], 'Obrt Pero', 2.4, [heldOn(own, 'Obrt Pero')]).kind).toBe('pick')
    expect(matchesOf([shared, lone], '', 2.4, [heldOn(shared, '')]).kind).toBe('ready')
    expect(matchesOf([shared, lone], 'Obrt Pero', 2.4, [heldOn(shared, 'Obrt Pero')]).kind).toBe('pick')
  })

  it('reads whole payees, never their words, so one card text does not name another shop', () => {
    const bakery = row(OTP, '2026-10-02', -2.4, 'Food/Groceries', { source: 'statement', payee: 'POS KUPNJA PEKARA ZAGREB', importKey: 'otp-7' })
    const konzum = row(OTP, '2026-11-04', -2.4, null, { source: 'statement', payee: 'POS KUPNJA KONZUM ZAGREB', importKey: 'otp-8' })

    expect(matchesOf([bakery, konzum], 'Mlinar', 2.4, [heldOn(bakery, 'Mlinar')]).kind).toBe('pick')
  })

  it('makes a receipt with no name ready on the row of the one payee the receipts taken near it went on', () => {
    const held = [heldOn(earlier, 'Obrt Pero', '', MOJITO_SQUARE)]

    expect(matchesOf([earlier, other, mojito], '', 2.4, held, BESIDE_MOJITO)).toMatchObject({ kind: 'ready', candidates: [{ row: mojito }, { row: other }] })
    expect(matchesOf([earlier, other, mojito], '', 2.4, held).kind).toBe('pick')
  })

  it('takes no name from receipts near it that went on rows of two payees', () => {
    const kiosk = row(OTP, '2026-10-05', -2.4, 'Food/Eating out', { source: 'statement', payee: 'KIOSK TISAK', importKey: 'otp-9' })
    const held = [heldOn(earlier, 'Obrt Pero', '', MOJITO_SQUARE), heldOn(kiosk, 'Tisak', '', BESIDE_MOJITO)]

    expect(matchesOf([earlier, kiosk, other, mojito], '', 2.4, held, BESIDE_MOJITO).kind).toBe('pick')
  })

  it('asks about a lone payment to another payee when the receipts taken near it say the bank names the shop otherwise', () => {
    const held = [heldOn(earlier, 'Obrt Pero', '', MOJITO_SQUARE)]

    expect(matchesOf([earlier, other], '', 2.4, held, BESIDE_MOJITO).kind).toBe('pick')
    expect(matchesOf([earlier, other], '', 2.4, held).kind).toBe('ready')
  })

  it('takes nothing from a receipt taken further than 100 m away', () => {
    const held = [heldOn(earlier, 'Obrt Pero', '', { latitude: '45.815000', longitude: '15.977000' })]

    expect(matchesOf([earlier, other, mojito], '', 2.4, held, MOJITO_SQUARE).kind).toBe('pick')
  })
})

describe('the rows that can take a receipt', () => {
  it('are payments out, never money in', () => {
    const spend = row(OTP, '2026-11-04', -23.49, null)
    const salary = row(OTP, '2026-11-04', 1200, 'Income/Salary')

    expect(splittableRows({ accounts: ACCOUNTS, categories: CATEGORIES, transactions: [spend, salary], receipts: [], items: wholeItems([spend, salary]) })).toEqual([spend])
  })

  it('leave out a payment To review asks about as maybe a transfer, until that is answered', () => {
    const topUp = row(OTP, '2026-11-04', -60, null, { source: 'statement', payee: 'Card top-up' })
    const toppedUp = row(REVOLUT_EUR, '2026-11-04', 60, null, { source: 'statement', payee: 'Top-up by card' })
    const spend = row(OTP, '2026-11-04', -23.49, null, { source: 'statement', payee: 'Corner market' })
    expect([...rowsTakingReceipt(spendingBook([topUp, toppedUp, spend]), ISSUED)]).toEqual([spend.id])
    expect([...rowsTakingReceipt(spendingBook([topUp, spend]), ISSUED)]).toEqual([topUp.id, spend.id])
  })
})

describe('where a receipt goes', () => {
  const first = row(OTP, '2026-11-04', -23.49, null)
  const second = row(REVOLUT_EUR, '2026-11-04', -23.49, null)
  const asked = matchesOf([first, second])
  const ready = matchesOf([first])

  it('takes the ready one, waits for a pick, and makes a new entry when nothing matches', () => {
    expect([placeOf(ready, null), placeOf(asked, null), placeOf({ kind: 'none' }, null), placeOf(null, null)]).toEqual([first.id, '', NEW_ENTRY, ''])
  })

  it('keeps your pick when the matching runs again, whatever it now calls ready', () => {
    const named = { ...second, payee: 'Konzum' }
    const after = matchesOf([first, named], 'Konzum')

    expect(after.kind).toBe('ready')
    expect(placeOf(after, first.id)).toBe(first.id)
    expect(placeOf(ready, NEW_ENTRY)).toBe(NEW_ENTRY)
  })

  it('drops a pick that is no longer on offer', () => {
    expect(placeOf(ready, second.id)).toBe(first.id)
    expect(placeOf(asked, 'gone')).toBe('')
  })
})

describe('the accounts a receipt can go on', () => {
  it('are the open euro ones', () => {
    expect(receiptAccounts([...ACCOUNTS, { ...OTP, closed: true, id: REVOLUT_USD.id }]).map((account) => account.name)).toEqual(['OTP current', 'Revolut EUR', 'Cash'])
  })
})

describe('a fiscal receipt already on the file', () => {
  const receipt = (jir: string, zki: string): Receipt => ({
    id: recordIdOf(RECEIPT_RECORDS, '5e000000-0000-4000-8000-000000006002'),
    transaction: row(OTP, '2026-11-04', -1, null).id,
    account: null,
    merchant: '',
    merchantOib: '',
    buyerOib: '',
    issuedOn: ISSUED,
    issuedTime: '',
    total: euros(1),
    jir,
    zki,
    readBy: '',
    photo: '',
    latitude: '',
    longitude: '',
  })

  it('is found by its JIR or its ZKI', () => {
    expect(heldReceiptOf({ jir: 'J', zki: '' }, [receipt('J', '')])).not.toBeNull()
    expect(heldReceiptOf({ jir: '', zki: 'Z' }, [receipt('', 'Z')])).not.toBeNull()
  })

  it('is not found by a blank code', () => {
    expect(heldReceiptOf({ jir: '', zki: '' }, [receipt('', '')])).toBeNull()
    expect(heldReceiptOf({ jir: 'J', zki: '' }, [receipt('K', '')])).toBeNull()
  })
})
