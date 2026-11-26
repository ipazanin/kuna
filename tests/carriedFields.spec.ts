import { describe, expect, it } from 'vitest'

import { retypedEntry, transferOver, unsplitItem } from '../src/apps/spending/entries/application/entryWrites'
import { companyLinkedEntry } from '../src/apps/spending/links/domain/companyPaymentFiling'
import { splitIntoParts } from '../src/apps/spending/links/domain/instalmentParts'
import { linkedEntry } from '../src/apps/spending/links/domain/linkFiling'
import type { LinkTarget, OwnerPaymentTarget } from '../src/apps/spending/links/domain/linkTarget'
import { receiptSplit, rowPlace } from '../src/apps/spending/receipts/domain/receiptSplit'
import type { ReceiptDraft } from '../src/apps/spending/receipts/domain/receiptSplit'
import { carriedFields } from '../src/apps/spending/workbook/domain/carriedChoices'
import type { CarriedFields } from '../src/apps/spending/workbook/domain/carriedChoices'
import { BY_DAYS } from '../src/apps/spending/workbook/domain/event'
import { refiledItems, transferLegItems, wholeItemOf } from '../src/apps/spending/workbook/domain/rowItems'
import { EVENT_RECORDS, ITEM_RECORDS, LABEL_RECORDS, SHARED_COST_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import type { TransactionItem } from '../src/apps/spending/workbook/domain/transactionItem'
import { parseCivilDate } from '../src/shared/calendar/civilDate'
import { accountMoneyFromAmount } from '../src/shared/money/accountMoney'
import { EURO } from '../src/shared/money/currencyCode'
import { moneyFromAmount } from '../src/shared/money/money'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { CATEGORIES, OTP, category, row, wholeItems } from './fixtures/spending'

const TRIP = recordIdOf(LABEL_RECORDS, 'made-up-trip')
const GARDEN = recordIdOf(LABEL_RECORDS, 'made-up-garden')
const WEEKEND = recordIdOf(EVENT_RECORDS, 'made-up-weekend')
const EATING_OUT = category('Food/Eating out')
const GIFTS = category('Family and gifts/Gifts')
const BETWEEN = category('Between my accounts')
const NOTES = { interest: 'Interest', difference: 'Difference' }
const PLACE = { currency: EURO, categories: CATEGORIES, language: 'en', notes: NOTES, receipt: false } as const
const LINK = { app: 'loans', kind: 'extra-payment', key: 'made-up-extra', due: null }

/** 100.00 out at a bistro, split by hand: 30.00 under a rule's Trip label going by its day, and 70.00 labelled Garden in the weekend, both for Ana. */
const dinner = row(OTP, '2026-11-14', -100, 'Food/Eating out', { payee: 'Harbour bistro' })
const [whole] = wholeItems([dinner])
const small: TransactionItem = { ...whole!, amount: accountMoneyFromAmount(-30), labels: [TRIP], ruleLabels: [TRIP], event: BY_DAYS, payee: 'Ana' }
const large: TransactionItem = { ...whole!, id: recordIdOf(ITEM_RECORDS, 'made-up-large'), amount: accountMoneyFromAmount(-70), category: GIFTS.id, labels: [GARDEN], event: WEEKEND, payee: 'Ana' }
const split = { row: dinner, items: [small, large] }

const CARRIED: CarriedFields = { labels: [TRIP, GARDEN], ruleLabels: [TRIP], event: WEEKEND, payee: 'Ana' }

function carriedOf({ labels, ruleLabels, event, payee }: TransactionItem): CarriedFields {
  return { labels, ruleLabels, event, payee }
}

describe('what parts rebuilt from other parts carry', () => {
  it('carries every label, a rule label still a rule label, the event of the largest and the payee all of them counted under', () => {
    expect(carriedFields(split.items)).toEqual(CARRIED)
  })

  it('blanks the payee when the parts count under different payees', () => {
    expect(carriedFields([small, { ...large, payee: 'Marko' }]).payee).toBe('')
  })

  it('carries them onto the one item a split row stands for again', () => {
    expect(carriedOf(unsplitItem(dinner, split.items))).toEqual(CARRIED)
  })

  it('carries them onto every part a link splits an entry into', () => {
    const parts = splitIntoParts(
      split,
      [
        [accountMoneyFromAmount(-60), EATING_OUT.id, '', LINK],
        [accountMoneyFromAmount(-40), GIFTS.id, '', LINK],
      ],
      () => 'made-up-part',
    )

    expect(parts.items.map(carriedOf)).toEqual([CARRIED, CARRIED])
  })

  it('carries them onto every part a payment from your company files a row in', () => {
    const salary = row(OTP, '2026-11-10', 100, 'Income/Other income')
    const [first] = wholeItems([salary])
    const items = [
      { ...small, id: first!.id, transaction: salary.id, amount: accountMoneyFromAmount(30) },
      { ...large, transaction: salary.id, amount: accountMoneyFromAmount(70) },
    ]
    const payment: OwnerPaymentTarget = {
      kind: 'owner-payment',
      link: { app: 'company', kind: 'ledger-row', key: 'made-up-payment', due: null },
      day: parseCivilDate('2026-11-10')!,
      amount: moneyFromAmount(100),
      direction: 'to-owner',
      ownerIban: OTP.iban,
      parts: [
        { kind: 'salary', amount: moneyFromAmount(60) },
        { kind: 'rent', amount: moneyFromAmount(40) },
      ],
    }
    const linked = companyLinkedEntry({ row: salary, items }, payment, PLACE, () => 'made-up-part')

    expect(linked.entry.items.map(carriedOf)).toEqual([CARRIED, CARRIED])
  })

  it("carries them onto the one item a link to a movement joins a split entry into, the event and payee not only the first part's", () => {
    const movement: LinkTarget = { kind: 'extra-payment', link: LINK, loanName: 'Home loan', day: parseCivilDate('2026-11-14')!, amount: moneyFromAmount(100) }

    expect(linkedEntry(split, movement, PLACE).entry.items.map(carriedOf)).toEqual([CARRIED])
    expect(linkedEntry({ row: dinner, items: [small, { ...large, payee: 'Marko' }] }, movement, PLACE).entry.items.map((item) => item.payee)).toEqual([''])
  })

  it("carries onto a receipt's Difference line the payee all of the row counted under, as each line starts with it", () => {
    const draft: ReceiptDraft = {
      merchant: 'Harbour bistro',
      merchantOib: '',
      buyerOib: '',
      issuedOn: dinner.date,
      issuedTime: '20:15',
      total: moneyFromAmount(100),
      jir: '',
      zki: '',
      readBy: '',
      photo: '',
      latitude: '',
      longitude: '',
    }
    const lines = receiptSplit(draft, rowPlace(dinner, split.items), [{ printed: 'Fish', note: '', amount: accountMoneyFromAmount(-90), category: EATING_OUT.id }], () => 'made-up-line').lines

    expect(lines.map((line) => [line.amount, line.payee])).toEqual([
      [accountMoneyFromAmount(-90), 'Ana'],
      [accountMoneyFromAmount(-10), 'Ana'],
    ])
  })
})

describe('writes that keep a part and change some of its fields', () => {
  const held = { ...whole!, labels: [TRIP, GARDEN], ruleLabels: [TRIP], event: WEEKEND, payee: 'Ana', sharedCost: recordIdOf(SHARED_COST_RECORDS, 'made-up-shared') }

  it('keeps every carried field when a row is filed under another category, and takes it out of its shared cost', () => {
    expect(refiledItems([held], GIFTS.id)).toEqual([{ ...held, category: GIFTS.id, sharedCost: null }])
  })

  it("keeps every carried field but the payee on a transfer's leg, which counts under no payee of its own", () => {
    expect(transferLegItems([held], BETWEEN.id)).toEqual([{ ...held, category: BETWEEN.id, payee: '', sharedCost: null }])
  })

  it("keeps the row's labels, event and rule labels when it becomes a transfer's leg, and no payee", () => {
    const before = { row: dinner, items: [{ ...held, sharedCost: null }] }
    const leg = (amount: number) => {
      const legRow = { ...dinner, amount: accountMoneyFromAmount(amount) }
      return { row: legRow, items: [wholeItemOf(legRow, { category: BETWEEN.id, note: '', link: null, labels: [] })] }
    }
    const { kept } = transferOver(before, [leg(-100), leg(100)])

    expect(kept.items.map(carriedOf)).toEqual([{ labels: [TRIP, GARDEN], ruleLabels: [TRIP], event: WEEKEND, payee: '' }])
  })

  it('takes the labels, event and payee typed over a part and keeps its rule labels, since typing puts none on', () => {
    const typed = { row: dinner, items: [wholeItemOf(dinner, { category: EATING_OUT.id, note: '', link: null, labels: [GARDEN], event: BY_DAYS, countsUnder: 'Marko' })] }

    expect(retypedEntry({ row: dinner, items: [held] }, typed).items.map(carriedOf)).toEqual([{ labels: [GARDEN], ruleLabels: [TRIP], event: BY_DAYS, payee: 'Marko' }])
  })
})
