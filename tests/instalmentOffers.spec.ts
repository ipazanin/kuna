import { describe, expect, it } from 'vitest'

import { loanTargetsOf } from '../src/apps/loans/facts'
import { fakeLoansDocument } from '../src/apps/loans/workbook/infrastructure/fake/fakeLoans'
import { LOANS_DOCUMENT } from '../src/apps/loans/workbook/infrastructure/loansDocument'
import { loanTargetsFrom } from '../src/apps/spending/links/application/loanRecords'
import { linkStateOf } from '../src/apps/spending/links/domain/linkTarget'
import { extraPaymentOffers, instalmentOffers, pastInstalments } from '../src/apps/spending/links/domain/instalmentOffers'
import type { InstalmentTarget } from '../src/apps/spending/links/domain/linkTarget'
import { instalmentPutOffOf, instalmentsPutOffText, spendingSettingsOf } from '../src/apps/spending/workbook/domain/spendingSettings'
import type { StoredRow } from '../src/apps/spending/workbook/domain/transaction'
import { fakeSpendingDocument } from '../src/apps/spending/workbook/infrastructure/fake/fakeSpending'
import { fakeHomeLoanShare, latestFakeHomeLoanDue } from '../src/apps/spending/workbook/infrastructure/fake/fakeHomeLoan'
import { FAKE_HOME_LOAN, fakeOverruledLate } from '../src/shared/storage/infrastructure/fake/fakeLoanKeys'
import { statementPaymentsFrom } from '../src/apps/loans/bankLoans/application/statementPayments'
import { instalmentStandings } from '../src/apps/loans/bankLoans/domain/instalmentPayments'
import { rowLinksOf } from '../src/apps/spending/facts'
import { decidingRule } from '../src/apps/spending/statements/domain/spendingCategorisation'
import { revolutStatement } from '../src/apps/spending/statements/domain/revolutStatement'
import { statementDryRun } from '../src/apps/spending/statements/domain/statementDryRun'
import { SAMPLE_LOAN_FILE_NAME, sampleLoanCsv } from '../src/apps/spending/statements/infrastructure/fake/sampleRevolutFiles'
import { monthOf } from '../src/shared/calendar/monthKey'
import { readFirstSheet } from '../src/shared/xlsx/sheetGrids'
import { SPENDING_DOCUMENT } from '../src/apps/spending/workbook/infrastructure/spendingDocument'
import { accountMoneyFromAmount } from '../src/shared/money/accountMoney'
import { moneyFromAmount } from '../src/shared/money/money'
import { settingRow } from '../src/shared/storage/domain/settingRows'
import { SETTING_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import { civil } from './fixtures/ledger'
import { OTP, REVOLUT_USD, category, row, spendingBook } from './fixtures/spending'

const LOAN = '3f6c1e2a-0000-4000-8000-000000000001'
const OTHER_LOAN = '3f6c1e2a-0000-4000-8000-000000000002'
const DAY = civil('2026-11-25')

/** A made-up instalment of Car loan from Example Bank, 612.20 of your share, due on the day given. */
function due(date: string, fields: Partial<InstalmentTarget> = {}): InstalmentTarget {
  return {
    kind: 'instalment',
    interim: false,
    link: { app: 'loans', kind: 'bank-loan', key: fields.link?.key ?? LOAN, due: civil(date) },
    loanName: 'Car loan',
    lender: 'Example Bank',
    number: 14,
    count: 84,
    due: civil(date),
    yourShare: moneyFromAmount(612.2),
    interest: moneyFromAmount(110),
    principal: moneyFromAmount(502.2),
    ...fields,
  }
}

const paid = (date: string, amount: number, fields: Partial<StoredRow> = {}) => row(OTP, date, amount, null, { source: 'statement', payee: 'Card payment', ...fields })

const offered = (rows: readonly StoredRow[], targets: readonly InstalmentTarget[]) =>
  instalmentOffers(spendingBook(rows), targets, DAY).map((offer) => [offer.target.due, offer.row.date, offer.suggested, offer.difference])

describe('the rows Kuna offers as paying an instalment', () => {
  it("suggests a row of exactly the plan's share from 3 days before to 7 days after the due date, the nearest of several, and only offers one further off", () => {
    expect(offered([paid('2026-11-12', -612.2), paid('2026-11-17', -612.2), paid('2026-11-20', -612.2)], [due('2026-11-15')])).toEqual([
      [civil('2026-11-15'), civil('2026-11-17'), true, accountMoneyFromAmount(0)],
    ])
    expect(offered([paid('2026-11-11', -612.2), paid('2026-11-24', -612.2)], [due('2026-11-15')])).toEqual([[civil('2026-11-15'), civil('2026-11-11'), false, accountMoneyFromAmount(0)]])
  })

  it('only offers a near amount, and suggests it when the payee names the lender or the row went to an IBAN a row linked to the loan went to', () => {
    const near = paid('2026-11-16', -614.6)
    expect(offered([near], [due('2026-11-15')])).toEqual([[civil('2026-11-15'), civil('2026-11-16'), false, accountMoneyFromAmount(-2.4)]])
    expect(offered([{ ...near, payee: 'EXAMPLE BANK d.d.' }], [due('2026-11-15')])).toEqual([[civil('2026-11-15'), civil('2026-11-16'), true, accountMoneyFromAmount(-2.4)]])
    expect(offered([{ ...near, payee: 'Example Bank' }], [due('2026-11-15', { lender: '' })])).toEqual([[civil('2026-11-15'), civil('2026-11-16'), false, accountMoneyFromAmount(-2.4)]])

    const iban = 'HR12 3456 7890 1234 5678 9'
    const linked = paid('2026-10-15', -612.2, { counterpartyIban: 'HR1234567890123456789', link: { app: 'loans', kind: 'bank-loan', key: LOAN, due: civil('2026-10-15') } })
    expect(offered([linked, { ...near, counterpartyIban: iban }], [due('2026-10-15'), due('2026-11-15', { lender: '' })])).toEqual([
      [civil('2026-11-15'), civil('2026-11-16'), true, accountMoneyFromAmount(-2.4)],
    ])
    expect(offered([linked, { ...near, counterpartyIban: iban }], [due('2026-11-15', { lender: '', link: { app: 'loans', kind: 'bank-loan', key: OTHER_LOAN, due: civil('2026-11-15') } })])).toEqual([
      [civil('2026-11-15'), civil('2026-11-16'), false, accountMoneyFromAmount(-2.4)],
    ])
  })

  it('gives each row one instalment and each instalment one row, exact matches first', () => {
    const rows = [paid('2026-10-16', -612.2), paid('2026-11-14', -612.2), paid('2026-11-15', -620)]
    expect(offered(rows, [due('2026-10-15'), due('2026-11-15')])).toEqual([
      [civil('2026-10-15'), civil('2026-10-16'), true, accountMoneyFromAmount(0)],
      [civil('2026-11-15'), civil('2026-11-14'), true, accountMoneyFromAmount(0)],
    ])
  })

  it('leaves out an instalment not due by the day or linked already, and a row that is money in, linked, on an account not in euros, a transfer or a leg of one', () => {
    const between = category('Between my accounts').id
    const rows = [
      paid('2026-11-15', 612.2),
      paid('2026-11-15', -612.2, { link: { app: 'loans', kind: 'bank-loan', key: LOAN, due: civil('2026-10-15') } }),
      row(REVOLUT_USD, '2026-11-15', -612.2, null, { source: 'statement' }),
      paid('2026-11-15', -612.2, { category: between }),
      paid('2026-11-15', -612.2, { pair: paid('2026-11-15', 612.2).id }),
    ]
    expect(offered(rows, [due('2026-11-15'), due('2026-11-30')])).toEqual([])
    expect(offered([paid('2026-10-15', -612.2), rows[1]!], [due('2026-10-15')])).toEqual([])
  })
})

describe("a loan's past instalments on To review", () => {
  const filed = (date: string) => paid(date, -612.2, { category: category('Money and fees/Loan interest').id })

  it('gathers the suggested rows filed already per loan, leaving the waiting ones to their rows and what Not now put off', () => {
    const rows = [filed('2026-08-15'), filed('2026-09-15'), paid('2026-10-15', -612.2), filed('2026-11-15')]
    const book = spendingBook(rows)
    const offers = instalmentOffers(
      book,
      ['2026-08-15', '2026-09-15', '2026-10-15', '2026-11-15'].map((date) => due(date)),
      DAY,
    )
    const cards = (putOff: Parameters<typeof pastInstalments>[2]) => pastInstalments(book, offers, putOff).map((card) => [card.loanName, card.offers.map((offer) => offer.row.date)])

    expect(cards([])).toEqual([['Car loan', [civil('2026-08-15'), civil('2026-09-15'), civil('2026-11-15')]]])
    expect(cards([{ loan: LOAN, through: civil('2026-09-15') }])).toEqual([['Car loan', [civil('2026-11-15')]]])
    expect(cards([{ loan: LOAN, through: civil('2026-11-15') }])).toEqual([])
    expect(cards([{ loan: OTHER_LOAN, through: civil('2026-11-15') }])).toHaveLength(1)
  })

  it('reads and writes what Not now put off one loan per line, leaving out a line of another shape', () => {
    const putOff = [
      { loan: LOAN, through: civil('2026-09-15') },
      { loan: OTHER_LOAN, through: civil('2026-11-15') },
    ]
    const text = instalmentsPutOffText(putOff)
    expect(text).toBe(`${LOAN} 2026-09-15\n${OTHER_LOAN} 2026-11-15`)
    expect(spendingSettingsOf([settingRow(SETTING_RECORDS, 'loan_instalments_not_now', `${text}\nsoon`)]).instalmentsPutOff).toEqual(putOff)
    expect([instalmentPutOffOf(`${LOAN} 2026-02-30`), instalmentPutOffOf(LOAN)]).toEqual([null, null])
  })
})

describe('the fake books', () => {
  it.each(['2026-11-04', '2027-03-31', '2027-06-01', '2028-06-01'])("offer the statements set's waiting row and a filed row as the home loan's instalments on %s", (date) => {
    const day = civil(date)
    const meta = { id: 'offers', source: 'browser' as const, title: 'offers', syncedAt: '2026-11-04T09:00:00.000Z', lastExportedAt: null, unexportedSince: null }
    const spending = SPENDING_DOCUMENT.read({ meta, revision: '1', document: fakeSpendingDocument(meta.syncedAt, 'statements', day) }).workbook
    const loans = LOANS_DOCUMENT.read({ meta, revision: '1', document: fakeLoansDocument(meta.syncedAt) }).workbook
    const offers = instalmentOffers(spending, loanTargetsFrom(loanTargetsOf(loans)), day)

    expect(offers.map((offer) => [offer.row.payee, offer.target.loanName, offer.suggested])).toEqual([
      ['Example Bank', 'Home loan', true],
      ['Example Bank', 'Home loan', true],
    ])
    expect(pastInstalments(spending, offers, []).map((card) => card.offers.length)).toEqual([1])
  })

  it("link Spending's sample rows to records the fake Loans file has, the extra payment among them, but for last month's instalment, which Loans does not have", () => {
    const day = civil('2026-11-15')
    const meta = { id: 'links', source: 'browser' as const, title: 'links', syncedAt: '2026-11-04T09:00:00.000Z', lastExportedAt: null, unexportedSince: null }
    const spending = SPENDING_DOCUMENT.read({ meta, revision: '1', document: fakeSpendingDocument(meta.syncedAt, 'sample', day) }).workbook
    const loans = LOANS_DOCUMENT.read({ meta, revision: '1', document: fakeLoansDocument(meta.syncedAt) }).workbook
    const targets = loanTargetsFrom(loanTargetsOf(loans))
    const links = spending.items.flatMap((item) => (item.link === null ? [] : [item.link]))

    expect(links.map((link) => [link.kind, linkStateOf(link, targets).state])).toEqual([
      ['bank-loan', 'there'],
      ['bank-loan', 'gone'],
      ['movement', 'there'],
      ['extra-payment', 'there'],
    ])
  })

  it("have Spending's linked row overrule the late-instalment record the fake Loans file holds for the same instalment, on the same day", () => {
    const day = civil('2026-11-04')
    const meta = { id: 'late', source: 'browser' as const, title: 'late', syncedAt: '2026-11-04T09:00:00.000Z', lastExportedAt: null, unexportedSince: null }
    const spending = SPENDING_DOCUMENT.read({ meta, revision: '1', document: fakeSpendingDocument(meta.syncedAt, 'sample', day) }).workbook
    const loans = LOANS_DOCUMENT.read({ meta, revision: '1', document: fakeLoansDocument(meta.syncedAt) }).workbook
    const home = loans.bankLoans.find((entry) => entry.loan.name === 'Home loan')!
    const { due } = fakeOverruledLate(day)

    expect(instalmentStandings(home, statementPaymentsFrom([{ app: 'spending', links: rowLinksOf(spending) }], 'loans'), day).get(due)).toMatchObject({
      standing: 'seen',
      overruled: { due },
    })
  })

  it("offer the statements set's early repayment, which the home loan's rule filed whole, as an extra payment of the home loan", () => {
    const day = civil('2026-11-04')
    const meta = { id: 'extra', source: 'browser' as const, title: 'extra', syncedAt: '2026-11-04T09:00:00.000Z', lastExportedAt: null, unexportedSince: null }
    const spending = SPENDING_DOCUMENT.read({ meta, revision: '1', document: fakeSpendingDocument(meta.syncedAt, 'statements', day) }).workbook
    const loans = LOANS_DOCUMENT.read({ meta, revision: '1', document: fakeLoansDocument(meta.syncedAt) }).workbook
    const ruleOf = decidingRule(spending.rules, spending)
    const offers = extraPaymentOffers(spending, loanTargetsFrom(loanTargetsOf(loans)), (row) => ruleOf(row)?.link ?? null)

    expect(offers.map(({ row, instalment }) => [row.payee, row.amount, instalment.loanName])).toEqual([['Example Bank', accountMoneyFromAmount(-5000), 'Home loan']])
  })

  it("give Spending's fake rows your share of the home loan's plan in every month", () => {
    const meta = { id: 'shares', source: 'browser' as const, title: 'shares', syncedAt: '2026-11-04T09:00:00.000Z', lastExportedAt: null, unexportedSince: null }
    const loans = LOANS_DOCUMENT.read({ meta, revision: '1', document: fakeLoansDocument(meta.syncedAt) }).workbook
    const instalments = loanTargetsOf(loans).instalments.filter(
      (instalment) => instalment.loan === FAKE_HOME_LOAN && instalment.kind === 'instalment' && instalment.due >= civil('2025-06-01') && instalment.due < civil('2031-01-01'),
    )

    expect(instalments).toHaveLength(67)
    for (const { due, yourShare } of instalments) expect([due, moneyFromAmount(fakeHomeLoanShare(monthOf(due)))]).toEqual([due, yourShare])
  })

  it.each(['2026-11-04', '2026-11-25', '2027-06-01', '2028-06-01'])("bring the sample loan export in on %s linked to the home loan's latest instalment and split by it", async (date) => {
    const day = civil(date)
    const meta = { id: 'import', source: 'browser' as const, title: 'import', syncedAt: '2026-11-04T09:00:00.000Z', lastExportedAt: null, unexportedSince: null }
    const spending = SPENDING_DOCUMENT.read({ meta, revision: '1', document: fakeSpendingDocument(meta.syncedAt, 'statements', day) }).workbook
    const loans = LOANS_DOCUMENT.read({ meta, revision: '1', document: fakeLoansDocument(meta.syncedAt) }).workbook
    const reading = revolutStatement(await readFirstSheet(sampleLoanCsv(day)), SAMPLE_LOAN_FILE_NAME, spending)
    if (!('statement' in reading)) throw new Error(reading.refusal)

    const run = statementDryRun(spending, reading.statement, day, {
      targets: loanTargetsFrom(loanTargetsOf(loans)),
      language: 'en',
      notes: { interest: 'Interest', difference: 'Difference from the plan' },
    })

    expect(run.lines.map((line) => (line.outcome === 'new' ? line.pays?.target.due : line.outcome))).toEqual([latestFakeHomeLoanDue(day)])
    expect(run.items.map((part) => part.note)).toEqual(['Interest', ''])
  })
})
