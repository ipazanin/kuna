import { describe, expect, it } from 'vitest'

import { fakeStaffOf } from '../src/apps/company/packs/hr-doo/infrastructure/fake/fakeStaff'
import { installedPack, shownPack } from '../src/apps/company/packs/packContribution'
import { publishedMoneyWithOwner } from '../src/apps/company/transactions/application/publishedMoneyWithOwner'
import { readDocument } from '../src/apps/company/workbook/infrastructure/companyDocument'
import { fakeWorkbookDocument } from '../src/apps/company/workbook/infrastructure/fake/fakeWorkbook'
import { companyTargetsFrom } from '../src/apps/spending/links/application/companyTargets'
import { sourceIn } from '../src/apps/spending/links/application/linkTargets'
import { linkStateOf } from '../src/apps/spending/links/domain/linkTarget'
import type { OwnerPaymentTarget } from '../src/apps/spending/links/domain/linkTarget'
import { choiceText, linkText, words } from '../src/apps/spending/links/presentation/words'
import { dayLabel } from '../src/shared/calendar/dayLabel'
import { moneyFromAmount } from '../src/shared/money/money'
import { civil } from './fixtures/ledger'

const SYNCED = '2026-10-16T08:00:00.000Z'
const workbook = readDocument({ id: 'fake', source: 'browser', title: 'Fake workbook', syncedAt: SYNCED }, fakeWorkbookDocument(SYNCED, 'browser', fakeStaffOf('one-employee'))).workbook

describe("Company's payments with the owner as other apps read them", () => {
  it('names each by its ledger row id and opens Transactions on its day', () => {
    const published = publishedMoneyWithOwner(workbook) ?? []
    const rowIds = installedPack()
      .moneyWithOwner(workbook)
      .map((payment) => payment.rowId)

    expect(published.map((payment) => payment.link)).toEqual(rowIds.map((key) => ({ app: 'company', kind: 'ledger-row', key, due: null })))
    expect(published[0]?.to).toEqual({ path: '/company/transactions', query: { p: `${published[0]?.day}..${published[0]?.day}` } })
  })

  it("files a net salary as salary, and a trip's per diems and kilometres as travel allowances apart from its costs paid back", () => {
    const published = publishedMoneyWithOwner(workbook) ?? []

    expect(published.find((payment) => payment.day === civil('2026-07-12') && payment.parts[0]?.kind === 'salary')).toBeDefined()
    expect(published.find((payment) => payment.day === civil('2026-03-20'))?.parts.map((part) => part.kind)).toEqual(['travel-allowance', 'travel-allowance', 'cost-refund'])
  })

  it('tells tax-free pay a trip pays from a results bonus or a gift, and knows none without the pack', () => {
    expect(installedPack().paysForTrip('foreign-per-diem')).toBe(true)
    expect(installedPack().paysForTrip('private-car-business-travel')).toBe(true)
    expect(installedPack().paysForTrip('results-bonus')).toBe(false)
    expect(installedPack().paysForTrip('occasional-gift')).toBe(false)
    expect(shownPack({ ownerPayModule: false }).paysForTrip('foreign-per-diem')).toBe(false)
  })

  it('publishes none while the owner-pay switch is off, so Spending reads it as not set up rather than as no payments', () => {
    expect(publishedMoneyWithOwner({ ...workbook, settings: { ...workbook.settings, ownerPayModule: false } })).toBeNull()
  })
})

describe("Spending's reading of the payments", () => {
  const payments = publishedMoneyWithOwner(workbook) ?? []

  it('turns each into a record a row can link to, under the app that published it', () => {
    const [company] = companyTargetsFrom([{ app: 'company', payments }])
    const targets = company?.targets

    expect(company?.app).toBe('company')
    expect(Array.isArray(targets) && targets.every((target) => target.kind === 'owner-payment')).toBe(true)
    expect(Array.isArray(targets) && targets.length).toBe(payments.length)
  })

  it('keeps each app wait, failure and not set up, which a link to it then reads as', () => {
    const link = { app: 'company', kind: 'ledger-row', key: 'row', due: null }
    const read = companyTargetsFrom([
      { app: 'opening', payments: 'opening' },
      { app: 'failed', payments: 'failed' },
      { app: 'none', payments: null },
    ]).map((app) => linkStateOf(link, app.targets).state)

    expect(read).toEqual(['opening', 'failed', 'not-set-up'])
  })

  it('names a payment by its kinds of money, which way it went and its day', () => {
    const day = civil('2026-11-10')
    const payment = (direction: OwnerPaymentTarget['direction'], parts: OwnerPaymentTarget['parts']): OwnerPaymentTarget => ({
      kind: 'owner-payment',
      link: { app: 'company', kind: 'ledger-row', key: 'row', due: null },
      day,
      amount: moneyFromAmount(1500),
      direction,
      ownerIban: 'HR1210010051863000160',
      parts,
    })
    const toYou = payment('to-owner', [
      { kind: 'salary', amount: moneyFromAmount(1200) },
      { kind: 'travel-allowance', amount: moneyFromAmount(300) },
    ])
    const fromYou = payment('from-owner', [{ kind: 'rent', amount: moneyFromAmount(1500) }])

    expect(choiceText(toYou)).toBe(`Salary and travel allowances from Company, paid ${dayLabel(day)}`)
    expect(choiceText(fromYou)).toBe(`Rent to Company, paid ${dayLabel(day)}`)
  })

  it("says a link it cannot show in Company's words, and a link to an app it does not know in Loans'", () => {
    const apps = [{ app: 'company', targets: 'opening' as const, source: 'company' as const }]

    expect(linkText({ state: 'opening' }, sourceIn(apps, 'company'))).toBe(words.company.opening)
    expect(linkText({ state: 'gone' }, sourceIn(apps, 'loans'))).toBe(words.gone)
  })
})
