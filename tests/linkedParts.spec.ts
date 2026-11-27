import { describe, expect, it } from 'vitest'

import { companyLinkedEntry } from '../src/apps/spending/links/domain/companyPaymentFiling'
import { splitByInstalment } from '../src/apps/spending/links/domain/instalmentParts'
import type { OwnerPaymentTarget } from '../src/apps/spending/links/domain/linkTarget'
import { BY_DAYS } from '../src/apps/spending/workbook/domain/event'
import { ITEM_RECORDS, LABEL_RECORDS, SHARED_COST_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import type { TransactionItem } from '../src/apps/spending/workbook/domain/transactionItem'
import { parseCivilDate } from '../src/shared/calendar/civilDate'
import { accountMoneyFromAmount } from '../src/shared/money/accountMoney'
import { EURO } from '../src/shared/money/currencyCode'
import { moneyFromAmount } from '../src/shared/money/money'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { CATEGORIES, OTP, category, row, wholeItems } from './fixtures/spending'

const TRIP = recordIdOf(LABEL_RECORDS, 'made-up-trip')
const GROCERIES = category('Food/Groceries')
const SALARY = category('Income/Salary')
const PRINCIPAL = CATEGORIES.find((held) => held.kind === 'repayment')!
const NOTES = { interest: 'Interest', difference: 'Difference' }
const PLACE = { currency: EURO, categories: CATEGORIES, language: 'en', notes: NOTES, receipt: false } as const
const INSTALMENT_LINK = { app: 'loans', kind: 'bank-loan', key: 'made-up-loan', due: parseCivilDate('2026-11-20') }
const PAYMENT_LINK = { app: 'company', kind: 'ledger-row', key: 'made-up-payment', due: null }
const SECOND = recordIdOf(ITEM_RECORDS, 'made-up-part')

function payment(parts: OwnerPaymentTarget['parts']): OwnerPaymentTarget {
  return { kind: 'owner-payment', link: PAYMENT_LINK, day: parseCivilDate('2026-11-10')!, amount: moneyFromAmount(2_000), direction: 'to-owner', ownerIban: OTP.iban, parts }
}

describe('the parts a link splits an entry into', () => {
  const spend = row(OTP, '2026-11-20', -650, 'Food/Groceries', { payee: 'Example Bank' })
  const [whole] = wholeItems([spend])
  const held: TransactionItem = { ...whole!, labels: [TRIP], ruleLabels: [TRIP], payee: 'Ana', sharedCost: recordIdOf(SHARED_COST_RECORDS, 'made-up-shared') }
  const instalmentPart = (fields: Pick<TransactionItem, 'id' | 'amount' | 'category' | 'note'>): TransactionItem => ({
    ...fields,
    transaction: spend.id,
    receipt: null,
    printed: '',
    link: INSTALMENT_LINK,
    labels: [TRIP],
    ruleLabels: [TRIP],
    event: BY_DAYS,
    payee: 'Ana',
    sharedCost: null,
    splitByLink: true,
  })

  it("splits an instalment's entry into its interest, principal and difference, each saying the link split it off, filed by you", () => {
    const split = { split: true, category: GROCERIES.id, interest: accountMoneyFromAmount(-250), principal: accountMoneyFromAmount(-400), difference: accountMoneyFromAmount(-5) } as const
    const linked = splitByInstalment({ row: spend, items: [held] }, INSTALMENT_LINK, split, PRINCIPAL.id, NOTES, () => 'made-up-part')

    expect(linked).toEqual({
      row: { ...spend, categorisedBy: 'person' },
      items: [
        instalmentPart({ id: held.id, amount: accountMoneyFromAmount(-250), category: GROCERIES.id, note: 'Interest' }),
        instalmentPart({ id: SECOND, amount: accountMoneyFromAmount(-400), category: PRINCIPAL.id, note: '' }),
        instalmentPart({ id: SECOND, amount: accountMoneyFromAmount(-5), category: GROCERIES.id, note: 'Difference' }),
      ],
    })
  })

  it("leaves out an instalment's parts of nothing, and the one part left still says the link split it off", () => {
    const split = { split: true, category: GROCERIES.id, interest: accountMoneyFromAmount(0), principal: accountMoneyFromAmount(-650), difference: accountMoneyFromAmount(0) } as const
    const linked = splitByInstalment({ row: spend, items: [held] }, INSTALMENT_LINK, split, PRINCIPAL.id, NOTES, () => 'made-up-part')

    expect(linked.items).toEqual([instalmentPart({ id: held.id, amount: accountMoneyFromAmount(-650), category: PRINCIPAL.id, note: '' })])
  })

  const salary = row(OTP, '2026-11-10', 2_050, 'Income/Other income')
  const [salaryItem] = wholeItems([salary])
  const paid: TransactionItem = { ...salaryItem!, labels: [TRIP], ruleLabels: [], payee: 'Ana' }
  const companyPart = (fields: Pick<TransactionItem, 'id' | 'amount' | 'category' | 'note' | 'splitByLink'>): TransactionItem => ({
    ...fields,
    transaction: salary.id,
    receipt: null,
    printed: '',
    link: PAYMENT_LINK,
    labels: [TRIP],
    ruleLabels: [],
    event: BY_DAYS,
    payee: 'Ana',
    sharedCost: null,
  })

  it('splits a payment from your company into its parts and the difference, each saying the link split it off, filed by you', () => {
    const linked = companyLinkedEntry({ row: salary, items: [paid] }, payment([{ kind: 'salary', amount: moneyFromAmount(2_000) }]), PLACE, () => 'made-up-part')

    expect(linked).toEqual({
      entry: {
        row: { ...salary, categorisedBy: 'person' },
        items: [
          companyPart({ id: paid.id, amount: accountMoneyFromAmount(2_000), category: SALARY.id, note: '', splitByLink: true }),
          companyPart({ id: SECOND, amount: accountMoneyFromAmount(50), category: paid.category, note: 'Difference', splitByLink: true }),
        ],
      },
      interest: null,
      added: [],
    })
  })

  it('files a row a payment from your company covers in one part whole, so it does not say the link split it', () => {
    const exact = { row: { ...salary, amount: accountMoneyFromAmount(2_000) }, items: [{ ...paid, amount: accountMoneyFromAmount(2_000) }] }
    const linked = companyLinkedEntry(exact, payment([{ kind: 'salary', amount: moneyFromAmount(2_000) }]), PLACE, () => 'made-up-part')

    expect(linked.entry.items).toEqual([companyPart({ id: paid.id, amount: accountMoneyFromAmount(2_000), category: SALARY.id, note: '', splitByLink: false })])
  })

  it("keeps a company payment's part of nothing, as the link note named every part", () => {
    const exact = { row: { ...salary, amount: accountMoneyFromAmount(2_000) }, items: [{ ...paid, amount: accountMoneyFromAmount(2_000) }] }
    const parts = [
      { kind: 'salary', amount: moneyFromAmount(2_000) },
      { kind: 'rent', amount: moneyFromAmount(0) },
    ] as const
    const linked = companyLinkedEntry(exact, payment(parts), PLACE, () => 'made-up-part')

    expect(linked.entry.items.map((item) => [item.amount, item.splitByLink])).toEqual([
      [accountMoneyFromAmount(2_000), true],
      [accountMoneyFromAmount(0), true],
    ])
  })
})
