import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { words } from '../src/apps/spending/assistant/words'
import { en as receiptWords } from '../src/apps/spending/receipts/domain/words'
import type { ReceiptPhotos } from '../src/apps/spending/receipts/application/receiptPhotos'
import { jpegWithMadeUpPlace, sampleFiscalQrText } from '../src/apps/spending/receipts/infrastructure/fake/sampleReceiptPhoto'
import type { ChatAttachment } from '../src/shared/ai/domain/chatAttachments'
import { parseCivilDate } from '../src/shared/calendar/civilDate'
import { DESK_ACCOUNTS, EXAMPLE_RECORDS, attachedPhoto, deskPorts, receiptPorts, spendingDesk } from './fixtures/spendingDesk'
import type { SpendingDesk } from './fixtures/spendingDesk'
import { forgetCaches } from './fixtures/writeBack'
import { ACCOUNT_WRITES } from '../src/apps/spending/accounts/application/accountWrites'
import { SETTING_WRITES } from '../src/apps/spending/workbook/application/settingWrites'
import { BANK_SYNC_DEPLOYMENT_KEY } from '../src/apps/spending/workbook/domain/spendingSettings'
import { setSetting } from '../src/shared/storage/application/settingWrites'
import { stepOf } from './fixtures/operationSteps'
import { SPENDING_OPERATIONS } from '../src/apps/spending/assistant/operations/spendingOperations'

const used = new Set<string>()
afterEach(async () => forgetCaches(used))

const bookOf = ({ store }: SpendingDesk) => store.state.workbook!
const categoryNamed = (desk: SpendingDesk, name: string) => bookOf(desk).categories.find((category) => category.name === name)!

/** The pharmacy's €31 bank row on Current, which has no receipt. */
const PHARMACY = EXAMPLE_RECORDS['transaction-joinable']!

function line(desk: SpendingDesk, printed: string, lineTotal: number, category = 'Rent', fields: Readonly<Record<string, unknown>> = {}) {
  return { printed, text: printed.toLowerCase(), kind: 'product', lineTotal, category: desk.ref('category', categoryNamed(desk, category).id), ...fields }
}

/** An add-receipt step of the pharmacy's €31, splitting its row unless told otherwise. */
function receipt(desk: SpendingDesk, fields: Readonly<Record<string, unknown>> = {}) {
  return stepOf(SPENDING_OPERATIONS, 'add-receipt', {
    photo: 'a1',
    paid: 'card',
    entry: desk.ref('transaction', PHARMACY),
    merchant: 'Pharmacy',
    markedR1: false,
    issuedOn: '2026-10-21',
    issuedAt: '09:15',
    lines: [line(desk, 'VITAMIN C', 20), line(desk, 'FLASTER', 11)],
    vat: [],
    total: 31,
    unreadable: [],
    keepPhoto: false,
    ...fields,
  })
}

/** A receipt of €7.77, which no payment on the desk may be. */
function unmatched(desk: SpendingDesk) {
  return { lines: [line(desk, 'VITAMIN C', 5), line(desk, 'FLASTER', 2.77)], total: 7.77 }
}

describe('a receipt from the chat', () => {
  it('splits the payment named into its lines in one write, with the model that read it, and one Undo takes it all back', async () => {
    const desk = await spendingDesk(used)
    const answer = await desk.propose([receipt(desk)], [attachedPhoto()])
    expect(answer.isError).toBe(false)
    const [card] = desk.cards
    expect(card!.outside).toEqual([])
    expect(card!.undoable).toBe(true)

    const result = await desk.accept()

    expect(result.kind).toBe('done')
    const held = bookOf(desk).receipts.find((candidate) => candidate.transaction === PHARMACY)!
    expect([held.merchant, held.readBy, held.photo, held.issuedTime]).toEqual(['Pharmacy', 'made-up-model', '', '09:15'])
    expect(
      bookOf(desk)
        .items.filter((candidate) => candidate.receipt === held.id)
        .map((candidate) => candidate.amount),
    ).toEqual([-2000, -1100])
    if (result.kind === 'done') expect((await result.undo!()).kind).toBe('undone')
    expect(bookOf(desk).receipts.some((candidate) => candidate.transaction === PHARMACY)).toBe(false)
    expect(
      bookOf(desk)
        .items.filter((candidate) => candidate.transaction === PHARMACY)
        .map((candidate) => candidate.receipt),
    ).toEqual([null])
  })

  it("takes the QR code's date and total over the read's, and warns on the card", async () => {
    const qrText = sampleFiscalQrText(parseCivilDate('2026-10-21')!, 3100)
    const desk = await spendingDesk(used, deskPorts(receiptPorts({ qrTextOn: async () => qrText })))

    await desk.propose([receipt(desk, { total: 30, issuedOn: '2026-10-20' })], [attachedPhoto()])
    await desk.accept()

    const held = bookOf(desk).receipts.find((candidate) => candidate.transaction === PHARMACY)!
    expect([held.total, held.issuedOn, held.issuedTime, held.jir]).toEqual([3100, '2026-10-21', '18:42', '1a2b3c4d-0000-4000-8000-1234567890ab'])
    const warned = desk.cards[0]!.groups.flatMap((group) => group.notes)
    expect(warned.map((shown) => shown.text)).toEqual([expect.stringContaining('The QR code says €31.00')])
  })

  it('keeps where the photo was taken, read from the photo as attached', async () => {
    const desk = await spendingDesk(used)
    const placed = jpegWithMadeUpPlace(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), { latitude: 43.5081, longitude: 16.4402 })
    const photo: ChatAttachment = { ...attachedPhoto(), original: new Blob([placed.slice()], { type: 'image/jpeg' }) }

    await desk.propose([receipt(desk)], [photo])
    await desk.accept()

    const held = bookOf(desk).receipts.find((candidate) => candidate.transaction === PHARMACY)!
    expect([held.latitude, held.longitude]).toEqual(['43.508100', '16.440200'])
  })

  it('makes a new entry on a euro account when no payment on the file may be this receipt', async () => {
    const desk = await spendingDesk(used)
    const before = bookOf(desk).transactions.length

    await desk.propose([receipt(desk, { ...unmatched(desk), entry: null, account: desk.ref('account', DESK_ACCOUNTS.CURRENT.id) })], [attachedPhoto()])
    await desk.accept()

    expect(bookOf(desk).transactions).toHaveLength(before + 1)
    expect(bookOf(desk).transactions.filter((row) => row.source === 'receipt')).toMatchObject([{ amount: -777, payee: 'Pharmacy', date: '2026-10-21' }])
  })

  it("makes no entry on an account the bank fills: the receipt waits there for the bank's row, as the card says", async () => {
    const desk = await spendingDesk(used)
    const current = bookOf(desk).accounts.find((account) => account.id === DESK_ACCOUNTS.CURRENT.id)!
    await desk.store.write('Linked', (unit) => {
      setSetting(unit, SETTING_WRITES, bookOf(desk).readings.settings.facts, BANK_SYNC_DEPLOYMENT_KEY, 'made-up-deployment')
      unit.of(ACCOUNT_WRITES).change(current, { ...current, rowsFrom: 'bank-link' })
    })
    const before = bookOf(desk).transactions

    await desk.propose([receipt(desk, { ...unmatched(desk), entry: null, account: desk.ref('account', DESK_ACCOUNTS.CURRENT.id) })], [attachedPhoto()])
    expect(desk.cards[0]!.groups.flatMap((group) => group.notes).map((note) => note.text)).toEqual([words.receipts.waits('Current')])
    expect((await desk.accept()).kind).toBe('done')

    expect(bookOf(desk).transactions).toEqual(before)
    const waiting = bookOf(desk).receipts.find((held) => held.account === DESK_ACCOUNTS.CURRENT.id)
    expect(waiting).toMatchObject({ transaction: null, total: 777 })
    expect(
      bookOf(desk)
        .items.filter((held) => held.receipt === waiting!.id)
        .map((held) => held.transaction),
    ).toEqual([null, null])
    expect(bookOf(desk).problems).toEqual([])
  })

  it('refuses a new entry while a payment on the file may be this receipt, so the model names that payment', async () => {
    const desk = await spendingDesk(used)

    const answer = await desk.propose([receipt(desk, { entry: null, account: desk.ref('account', DESK_ACCOUNTS.CURRENT.id) })], [attachedPhoto()])

    expect(answer.text).toContain('A payment on the file may be this receipt: −€31.00 on 21 Oct 2026.')
    expect(answer.text).toContain('name it in entry')
    expect(desk.cards).toEqual([])
  })

  it('takes an entry the person picked outside the match window, warns that its day and amount differ, and a Difference line makes it add up', async () => {
    const desk = await spendingDesk(used)
    const picked = EXAMPLE_RECORDS['transaction']!

    expect((await desk.propose([receipt(desk, { entry: desk.ref('transaction', picked) })], [attachedPhoto()])).isError).toBe(false)
    const warned = desk.cards[0]!.groups.flatMap((group) => group.notes)
    expect(warned.map((shown) => shown.text)).toEqual([`${words.receipts.otherDay('12 Oct 2026', '21 Oct 2026')}. ${words.receipts.otherAmount('€45.30', '€31.00')}.`])
    await desk.accept()

    expect(
      bookOf(desk)
        .items.filter((candidate) => candidate.transaction === picked)
        .map((candidate) => [candidate.note, candidate.amount]),
    ).toEqual([
      ['vitamin c', -2000],
      ['flaster', -1100],
      ['Difference', -1430],
    ])
  })

  it('replaces the parts of an entry split by hand in the same write, says on the card which go, and Undo brings them back', async () => {
    const desk = await spendingDesk(used)
    const split = EXAMPLE_RECORDS['transaction-split']!
    const handParts = bookOf(desk).items.filter((candidate) => candidate.transaction === split)

    await desk.propose(
      [receipt(desk, { entry: desk.ref('transaction', split), issuedOn: '2026-10-30', lines: [line(desk, 'VITAMIN C', 40), line(desk, 'FLASTER', 20)], total: 60 })],
      [attachedPhoto()],
    )
    const [card] = desk.cards
    expect(card!.groups.flatMap((group) => group.notes).map((shown) => shown.text)).toEqual([`${words.receipts.replacesSplit('Rent −€40.00 and Groceries −€20.00')}.`])
    expect(card!.groups.find((group) => group.verb === 'remove')?.lines.map((shown) => shown.label)).toEqual(['Rent', 'Groceries'])
    const result = await desk.accept()

    expect(
      bookOf(desk)
        .items.filter((candidate) => candidate.transaction === split)
        .map((candidate) => candidate.note),
    ).toEqual(['vitamin c', 'flaster'])
    if (result.kind === 'done') expect((await result.undo!()).kind).toBe('undone')
    expect(bookOf(desk).items.filter((candidate) => candidate.transaction === split)).toEqual(handParts)
  })

  it('makes a cash receipt with no cash payment on the file into a typed entry on the one cash account in euros, whatever a card payment says', async () => {
    const desk = await spendingDesk(used)

    expect((await desk.propose([receipt(desk, { paid: 'cash', entry: null })], [attachedPhoto()])).isError).toBe(false)
    await desk.accept()

    expect(bookOf(desk).transactions.filter((row) => row.account === DESK_ACCOUNTS.WALLET.id)).toMatchObject([{ source: 'typed', amount: -3100, payee: 'Pharmacy', date: '2026-10-21' }])
  })

  it('refuses cash on an entry off a cash account, and a card on one', async () => {
    const desk = await spendingDesk(used)

    expect((await desk.propose([receipt(desk, { paid: 'cash' })], [attachedPhoto()])).text).toContain('not on a cash account')
    expect((await desk.propose([receipt(desk, { ...unmatched(desk), entry: null, account: desk.ref('account', DESK_ACCOUNTS.WALLET.id) })], [attachedPhoto()])).text).toContain('not cash')
    expect(desk.cards).toEqual([])
  })

  it('asks which cash account takes a cash receipt among several, and with none asks how much cash there was and adds one with that opening first on the same card', async () => {
    const desk = await spendingDesk(used)
    const cash = (fields: Readonly<Record<string, unknown>> = {}) => receipt(desk, { paid: 'cash', entry: null, ...fields })
    const addCash = stepOf(SPENDING_OPERATIONS, 'add-account', { name: 'Purse', kind: 'cash', currency: 'EUR', opening: 50, openedOn: '2026-10-21', rowsFrom: 'by-hand' }, '$cash')

    await desk.propose([stepOf(SPENDING_OPERATIONS, 'change-account', { account: desk.ref('account', DESK_ACCOUNTS.WALLET.id), closed: 'yes' })], [])
    await desk.accept()
    expect((await desk.propose([cash()], [attachedPhoto()])).text).toContain('Ask the person how much cash they had before paying')
    expect((await desk.propose([addCash, cash({ account: '$cash' })], [attachedPhoto()])).isError).toBe(false)
    await desk.accept()
    const purse = bookOf(desk).accounts.find((account) => account.name === 'Purse')!
    expect(purse.opening).toBe(5000)
    expect(bookOf(desk).transactions.filter((row) => row.account === purse.id)).toMatchObject([{ source: 'typed', amount: -3100 }])

    await desk.propose([{ ...addCash, input: { ...addCash.input, name: 'Drawer' } }], [])
    await desk.accept()
    expect((await desk.propose([cash(unmatched(desk))], [attachedPhoto()])).text).toContain('ask the person which one')
  })

  it('refuses a dollar account, an entry that has a receipt, and a fiscal receipt already on the file', async () => {
    const desk = await spendingDesk(used)
    const refused = async (fields: Readonly<Record<string, unknown>>) => (await desk.propose([receipt(desk, fields)], [attachedPhoto()])).text

    expect(await refused({ ...unmatched(desk), entry: null, account: desk.ref('account', DESK_ACCOUNTS.DOLLARS.id) })).toContain('open euro account')
    expect(await refused({ entry: desk.ref('transaction', EXAMPLE_RECORDS['transaction-receipt']!) })).toContain('cannot take a receipt')
    expect(await refused({ jir: 'made-up-jir' })).toContain('already on the file')
    expect(desk.cards).toEqual([])
  })

  it('asks whose an R1 receipt is when no company OIB tells, and files every line under For the company on that answer', async () => {
    const desk = await spendingDesk(used)

    expect((await desk.propose([receipt(desk, { markedR1: true })], [attachedPhoto()])).text).toContain('Ask the person whether it is for the company')
    await desk.propose([receipt(desk, { markedR1: true, whose: 'company' })], [attachedPhoto()])
    await desk.accept()

    const company = categoryNamed(desk, 'For the company').id
    expect(
      bookOf(desk)
        .items.filter((candidate) => candidate.transaction === PHARMACY)
        .map((candidate) => candidate.category),
    ).toEqual([company, company])
  })

  it("files a buyer of Company's OIB under For the company, and without one keeps the lines as read and says on the entry where to set it", async () => {
    const withOib = await spendingDesk(used, deskPorts(receiptPorts({ companyOib: () => '11111111119' })))
    await withOib.propose([receipt(withOib, { buyerOib: '11111111119' })], [attachedPhoto()])
    expect(withOib.cards[0]!.groups.flatMap((group) => group.notes)).toEqual([])
    await withOib.accept()
    const company = categoryNamed(withOib, 'For the company').id
    expect(
      new Set(
        bookOf(withOib)
          .items.filter((candidate) => candidate.transaction === PHARMACY)
          .map((candidate) => candidate.category),
      ),
    ).toEqual(new Set([company]))

    const without = await spendingDesk(used)
    await without.propose([receipt(without, { buyerOib: '11111111119' })], [attachedPhoto()])
    const noted = without.cards[0]!.groups.flatMap((group) => group.notes.map((note) => ({ noun: group.noun.en.one, text: note.text, link: note.link?.label })))
    expect(noted).toEqual([{ noun: 'entry', text: receiptWords.noCompanyOib, link: receiptWords.setOibInCompany }])
  })

  it('refuses a line under a group, under For the company, and a new category on the same card, which goes on a card of its own first', async () => {
    const desk = await spendingDesk(used)
    const lines = (category: string) => ({ lines: [line(desk, 'VITAMIN C', 20), line(desk, 'FLASTER', 11, category)] })

    expect((await desk.propose([receipt(desk, lines('Food'))], [attachedPhoto()])).text).toContain('FLASTER')
    expect((await desk.propose([receipt(desk, lines('For the company'))], [attachedPhoto()])).text).toContain('FLASTER')
    const answer = await desk.propose([stepOf(SPENDING_OPERATIONS, 'add-category', { name: 'Pharmacy', kind: 'spending' }, '$pharmacy'), receipt(desk)], [attachedPhoto()])
    expect(answer.text).toContain('A new category goes on a card before the receipt')
  })

  it('reads a receipt only off a photo', async () => {
    const desk = await spendingDesk(used)
    const pdf: ChatAttachment = { ...attachedPhoto(), kind: 'pdf', sent: null }

    expect((await desk.propose([receipt(desk)], [pdf])).text).toContain('from a photo')
  })
})

describe("a receipt's photo kept on Drive", () => {
  it('is kept in the click before the write, under the id the receipt holds, and the card says it stays after Undo', async () => {
    const keep = vi.fn<ReceiptPhotos['keep']>(async () => 'kept-photo-id')
    const desk = await spendingDesk(used, deskPorts(receiptPorts({ photos: async () => ({ keep }) })))

    await desk.propose([receipt(desk, { keepPhoto: true })], [attachedPhoto()])
    expect(desk.cards[0]!.outside).toEqual([words.receipts.photoStays])
    expect(keep).not.toHaveBeenCalled()
    const result = await desk.accept()

    expect(keep).toHaveBeenCalledOnce()
    expect(keep.mock.calls[0]![1]).toBe('2026-10-21')
    expect(bookOf(desk).receipts.find((candidate) => candidate.transaction === PHARMACY)!.photo).toBe('kept-photo-id')
    if (result.kind === 'done') expect((await result.undo!()).kind).toBe('undone')
  })

  it('is refused with the books off Drive, or with no way to Drive on this device, before a card shows', async () => {
    const offDrive = await spendingDesk(used, deskPorts(receiptPorts({ keepsOnDrive: () => false })))
    expect((await offDrive.propose([receipt(offDrive, { keepPhoto: true })], [attachedPhoto()])).text).toContain('keepPhoto false')
    const noAccess = await spendingDesk(used, deskPorts(receiptPorts({ mayKeepNow: () => false })))
    expect((await noAccess.propose([receipt(noAccess, { keepPhoto: true })], [attachedPhoto()])).text).toContain('keepPhoto false')
  })

  it('is not kept again when the card is proposed again after a write refused once the photo was kept', async () => {
    const keep = vi.fn<ReceiptPhotos['keep']>(async () => 'kept-photo-id')
    let asked = 0
    // The check, the keep and the plan with the kept photo each ask for Drive. The third ask of the first Accept fails after the keep.
    const desk = await spendingDesk(used, deskPorts(receiptPorts({ photos: async () => ({ keep }), mayKeepNow: () => ++asked !== 3 })))
    const photo = attachedPhoto()

    await desk.propose([receipt(desk, { keepPhoto: true })], [photo])
    expect((await desk.accept()).kind).toBe('refused')
    await desk.propose([receipt(desk, { keepPhoto: true })], [photo])
    expect((await desk.accept()).kind).toBe('done')

    expect(keep).toHaveBeenCalledOnce()
    expect(bookOf(desk).receipts.find((candidate) => candidate.transaction === PHARMACY)!.photo).toBe('kept-photo-id')
  })

  it('refuses Accept and writes nothing when the way to Drive went after the card showed', async () => {
    let reachable = true
    const desk = await spendingDesk(used, deskPorts(receiptPorts({ mayKeepNow: () => reachable })))
    await desk.propose([receipt(desk, { keepPhoto: true })], [attachedPhoto()])
    reachable = false

    expect(await desk.accept()).toEqual({ kind: 'refused', reason: words.receipts.keepNoAccess })
    expect(bookOf(desk).receipts.some((candidate) => candidate.transaction === PHARMACY)).toBe(false)
  })
})
