import { describe, expect, it } from 'vitest'

import { companyAssistant } from '../src/apps/company/assistant/companyAssistant'
import { latestBalances } from '../src/apps/company/cash/domain/balances'
import { HR_DOO_ASSISTANT } from '../src/apps/company/packs/hr-doo/assistant/hrDooAssistant'
import { monthPeriod } from '../src/apps/company/filters/domain/drillTarget'
import { DEFAULT_FILTERS, transactionsInPeriod } from '../src/apps/company/filters/domain/filterState'
import { amountsOwed } from '../src/apps/company/receivables/domain/ageing'
import { receivablesOf } from '../src/apps/company/receivables/domain/invoiceMatching'
import { lineLabel } from '../src/apps/company/settings/domain/profitAndLossLabels'
import { countedLedger } from '../src/apps/company/transactions/domain/countedLedger'
import { bucketTotals } from '../src/apps/company/workbook/domain/bucketTotals'
import * as coreKinds from '../src/apps/company/workbook/domain/coreKinds'
import { displayNamesOf } from '../src/apps/company/workbook/domain/displayName'
import { needsReview } from '../src/apps/company/workbook/domain/needsReview'
import { wholeItemId } from '../src/apps/company/workbook/domain/splits'
import { newestBookingOf } from '../src/apps/company/workbook/domain/workbook'
import type { Workbook } from '../src/apps/company/workbook/domain/workbook'
import type { CompanyBooks } from '../src/apps/company/workbook/domain/readWorkbook'
import { findRecords, getRecord, readFigures } from '../src/shared/ai/application/chatReads'
import type { FindRecordsInput } from '../src/shared/ai/application/chatReads'
import type { ReportFigure } from '../src/shared/app/assistantReader'
import { addMonths, monthOf } from '../src/shared/calendar/monthKey'
import { addMoney } from '../src/shared/money/money'
import type { Money } from '../src/shared/money/money'
import { companyReaderOf, companyReadsOf, fakeCompanyBooks, readingOf, withSettings } from './fixtures/companyChatBooks'
import { vatOnPrivateShare } from '../src/apps/company/packs/hr-doo/domain/vat/vatSplit'

const BOOKS = fakeCompanyBooks()
const READER = companyReaderOf(BOOKS)
const NEWEST = newestBookingOf(BOOKS.workbook.transactions)!
const MONTH = monthOf(NEWEST)

function kind(name: string) {
  return READER.kinds.find((candidate) => candidate.name === name)!
}

function report(id: string) {
  return READER.reports.find((candidate) => candidate.id === id)!
}

function amountLabelled(figures: readonly ReportFigure[], label: string): number | undefined {
  const figure = figures.find((candidate) => candidate.label === label)
  return figure !== undefined && 'cents' in figure ? figure.cents : undefined
}

const ALL: FindRecordsInput = {
  app: 'company',
  kind: coreKinds.LEDGER_RECORDS.name,
  query: null,
  from: null,
  to: null,
  refs: [],
  filters: [],
  sort: [],
  fields: [],
  only: null,
  limit: 200,
  cursor: null,
}

describe("what the chat reads of the company's books", () => {
  it('reads every core kind the books keep but dismissals, and the splits tab of books from before items as their items, then the pack’s kinds', () => {
    const core = Object.values(coreKinds)
      .map((recordKind) => recordKind.name)
      .filter((name) => name !== coreKinds.DISMISSAL_RECORDS.name && name !== coreKinds.SPLIT_PART_RECORDS.name)
    expect([...READER.kinds.map((readable) => readable.name).slice(0, core.length)].sort()).toEqual([...core].sort())
    expect(READER.kinds.slice(core.length).every((readable) => readable.name.startsWith('hr-doo.'))).toBe(true)
  })

  it('reads every part of every row by its id, with the row it is part of, so an operation can name the part it keeps', () => {
    const parts = kind(coreKinds.ITEM_RECORDS.name).rows()
    const rowOf = (fields: (typeof parts)[number]['fields']) => fields.flatMap((field) => (field.name === 'row' && field.exposure === 'ref' ? [field.id] : []))[0]
    const read = parts.map((row) => [row.id, rowOf(row.fields)])
    const split = BOOKS.workbook.splits.flatMap((held) => held.parts.map((part) => [part.id, held.row.id]))
    expect(split.length).toBeGreaterThan(0)
    expect(read).toEqual(expect.arrayContaining(split))
    const whole = BOOKS.workbook.transactions.find((row) => row.rowId !== null && !BOOKS.workbook.splits.some((held) => held.row.id === row.id))!
    expect(read).toContainEqual([wholeItemId(whole), whole.id])
    expect(read).toHaveLength(BOOKS.workbook.transactions.length - BOOKS.workbook.splits.length + split.length)
  })

  it('classes every field it hands over, and hands over no field it classes as never', () => {
    for (const readable of READER.kinds) {
      const classed = new Set(readable.fields.map((field) => field.name))
      const handed = readable.rows().flatMap((row) => row.fields.map((field) => field.name))
      expect(
        handed.filter((name) => !classed.has(name)),
        readable.name,
      ).toEqual([])
      const never = readable.fields.filter((field) => field.exposure === 'never').map((field) => field.name)
      expect(
        handed.filter((name) => never.includes(name)),
        readable.name,
      ).toEqual([])
    }
    expect(kind(coreKinds.CLIENT_RECORDS.name).fields.find((field) => field.name === 'invoiceMail')?.exposure).toBe('never')
  })

  it('says who filed a row as person, rule or no-rule, so the review label never leaves', () => {
    const labelled = { ...BOOKS, workbook: { ...BOOKS.workbook, transactions: BOOKS.workbook.transactions.map((row, index) => (index === 0 ? { ...row, flaggedBy: 'Ivo Ivić' } : row)) } }
    const rows = companyReaderOf(labelled).kinds[0]!.rows()
    const filedBy = new Set(rows.flatMap((row) => row.fields.filter((field) => field.name === 'filedBy').map((field) => ('value' in field ? field.value : null))))
    expect([...filedBy].every((value) => ['person', 'rule', 'no-rule', ''].includes(String(value)))).toBe(true)
    expect(filedBy).toContain('no-rule')
    expect(JSON.stringify(rows)).not.toContain('Ivo Ivić')
  })

  it('tells the chat a row the categoriser left as ai waits because no rule filed it, and that no AI filed it', () => {
    const meaning = kind(coreKinds.LEDGER_RECORDS.name).fields.find((field) => field.name === 'filedBy')!.meaning

    expect(meaning).toContain('no-rule when no rule settled it')
    expect(meaning).toContain('No AI filed it')
  })

  it('holds the rows waiting on To review in its waiting set', () => {
    const waiting = kind(coreKinds.LEDGER_RECORDS.name).sets!.find((set) => set.name === 'waiting')!
    expect([...waiting.ids()].sort()).toEqual(
      BOOKS.workbook.transactions
        .filter(needsReview)
        .map((row) => row.id)
        .sort(),
    )
  })

  it('reads a closed list of settings, never the payees kept under an alias, a folder, mail, the invoice IBAN or the review label', () => {
    const books = withSettings(BOOKS, [
      { key: 'person_payees', value: 'Ana Horvat' },
      { key: 'review_label', value: 'Ivo Ivić' },
      { key: 'invoice_iban', value: 'HR1210010051863000160' },
      { key: 'invoice_mail', value: 'owner@example.com' },
      { key: 'invoice_folder_id', value: 'folder-1' },
      { key: 'statements_folder', value: 'folder-2' },
      { key: 'statements_mail_from', value: 'bank@example.com' },
      { key: 'company_name', value: 'Example Studio' },
      { key: 'hr_cit_return', value: 'pd' },
    ])
    const keys = companyReaderOf(books)
      .kinds.find((readable) => readable.name === coreKinds.SETTING_RECORDS.name)!
      .rows()
      .map((row) => row.id)
    expect(keys).toContain('company_name')
    expect(keys).toContain('hr_cit_return')
    expect(keys).toContain('owner_pay_module')
    for (const unread of ['person_payees', 'review_label', 'invoice_iban', 'invoice_mail', 'invoice_folder_id', 'statements_folder', 'statements_mail_from', 'mail_since', 'template_version']) {
      expect(keys).not.toContain(unread)
    }
  })

  it('reads a switch as written, and the card settlement IBANs and the company’s VAT id each as an identifier', () => {
    const books = withSettings(BOOKS, [{ key: 'card_settlement_ibans', value: 'HR1210010051863000160, HR2124020061100000000' }])
    const settings = companyReaderOf(books)
      .kinds.find((readable) => readable.name === coreKinds.SETTING_RECORDS.name)!
      .rows()
    const fieldsOf = (key: string) =>
      Object.fromEntries(
        settings
          .filter((row) => row.id === key)
          .at(-1)!
          .fields.flatMap((field) => ('value' in field ? [[field.name, field.value]] : [])),
      )
    expect(fieldsOf('owner_pay_module')).toEqual({ key: 'owner_pay_module', value: '', switch: 'TRUE', identifiers: [] })
    expect(fieldsOf('card_settlement_ibans')).toEqual({ key: 'card_settlement_ibans', value: '', switch: '', identifiers: ['HR1210010051863000160', 'HR2124020061100000000'] })
    expect(fieldsOf('invoice_oib').identifiers).toEqual(['00000000001'])
  })

  it('gives a category, an account and a client its short name as its id, so a row’s ref and the record’s are one', () => {
    expect(
      kind(coreKinds.CATEGORY_RECORDS.name)
        .rows()
        .map((row) => row.id),
    ).toEqual(BOOKS.workbook.categories.map((category) => category.slug))
    const filed = kind(coreKinds.LEDGER_RECORDS.name)
      .rows()
      .flatMap((row) => row.fields.filter((field) => field.name === 'category'))
    expect(filed.every((field) => field.exposure === 'ref' && field.to === coreKinds.CATEGORY_RECORDS.name)).toBe(true)
    expect(new Set(filed.map((field) => ('id' in field ? field.id : null)))).toEqual(new Set(BOOKS.workbook.transactions.map((row) => row.category)))
    expect(
      kind(coreKinds.ACCOUNT_RECORDS.name)
        .rows()
        .map((row) => row.id),
    ).toEqual(BOOKS.workbook.accounts.map((account) => account.slug))
    expect(
      kind(coreKinds.CLIENT_RECORDS.name)
        .rows()
        .map((row) => row.id),
    ).toEqual(BOOKS.workbook.clients.map((client) => client.slug))
  })
})

describe("the company's places", () => {
  it('lets a link fill a record parameter only from a ref of a kind the chat reads, or of a rule a build-up cites', () => {
    const places = companyAssistant(HR_DOO_ASSISTANT, readingOf(BOOKS), () => []).places
    const read = new Set([...READER.kinds.map((readable) => readable.name), ...(READER.traceRules?.ruleKind === undefined ? [] : [READER.traceRules.ruleKind])])
    const kinds = places.flatMap((place) => Object.values(place.params ?? {}).flatMap((param) => (typeof param === 'string' ? [] : [param.kind])))
    expect(kinds.length).toBeGreaterThan(0)
    expect(kinds.filter((name) => !read.has(name))).toEqual([])
  })

  it('declares every tab of every screen once', () => {
    const routes = companyAssistant(HR_DOO_ASSISTANT, readingOf(BOOKS), () => []).places.map((place) => place.route)
    expect(new Set(routes).size).toBe(routes.length)
    expect(routes.filter((route) => route.startsWith('/company/year?'))).toHaveLength(7)
    expect(routes.filter((route) => route.startsWith('/company/settings?'))).toHaveLength(7)
  })
})

describe('what a read leaves on the device', () => {
  it('leaves out every ledger row paying an employee while Anonymise is on, and reads them with it off', async () => {
    const on = JSON.parse((await findRecords(ALL, companyReadsOf(BOOKS))).text)
    const off = JSON.parse((await findRecords(ALL, companyReadsOf(BOOKS, { anonymising: () => false }))).text)
    expect(on.leftOutAboutEmployees).toBeGreaterThan(0)
    expect(off.leftOutAboutEmployees).toBeUndefined()
    expect(on.total + on.leftOutAboutEmployees).toBe(off.total)
    for (const name of ['Mia Primjer', 'Tomo Uzorak', 'XX00FAKE0000000000000201']) expect(JSON.stringify(on)).not.toContain(name)
  })

  it('sends an account’s IBAN as a token while Anonymise is on', async () => {
    const answer = await findRecords({ ...ALL, kind: coreKinds.ACCOUNT_RECORDS.name }, companyReadsOf(BOOKS))
    const ibans = BOOKS.workbook.accounts.map((account) => account.iban).filter((iban) => iban !== '')
    expect(ibans.length).toBeGreaterThan(0)
    for (const iban of ibans) expect(answer.text).not.toContain(iban)
  })

  it("keeps the reports of employees' pay on the device while Anonymise is on, and reads them with it off", async () => {
    for (const id of ['profit', 'forecast']) {
      const on = await readFigures('company', id, null, companyReadsOf(BOOKS))
      expect(on.isError, id).toBe(true)
      expect(on.text).toContain('turn Anonymise off')
      expect((await readFigures('company', id, null, companyReadsOf(BOOKS, { anonymising: () => false }))).isError, id).toBe(false)
    }
    expect((await readFigures('company', 'month', null, companyReadsOf(BOOKS))).isError).toBe(false)
  })

  it('opens one record by the ref a search handed out', async () => {
    const reads = companyReadsOf(BOOKS, { anonymising: () => false })
    const found = JSON.parse((await findRecords({ ...ALL, kind: coreKinds.CATEGORY_RECORDS.name, limit: 1 }, reads)).text)
    const record = await getRecord('company', found.records[0].ref, reads)
    expect(record.isError).toBe(false)
  })
})

/** Whether a category's figures hold pay: the owner-pay bucket, and the taxes owed because someone was paid. */
function isPayCategory(category: Workbook['categories'][number]): boolean {
  return category.bucket === 'owner-pay' || category.roles.includes('owner-pay-tax')
}

/** The books with every row and advance of a pay category at twice its amount, as if everyone were paid twice as much. */
function payDoubled(books: CompanyBooks): CompanyBooks {
  const pay = new Set(books.workbook.categories.filter(isPayCategory).map((category) => category.slug))
  const doubled = <Row extends { readonly category: string; readonly amount: Money }>(row: Row): Row => (pay.has(row.category) ? { ...row, amount: addMoney(row.amount, row.amount) } : row)
  const workbook = { ...books.workbook, transactions: books.workbook.transactions.map(doubled), ownerAdvances: books.workbook.ownerAdvances.map(doubled) }
  return { ...books, workbook }
}

describe('the reports the chat reads', () => {
  const ledger = countedLedger(BOOKS.workbook, DEFAULT_FILTERS, vatOnPrivateShare)!
  const { booked, window } = ledger
  const totals = bucketTotals(transactionsInPeriod(ledger.profitAndLossRows, monthPeriod(MONTH), window))
  const settings = BOOKS.workbook.settings

  it("gives a month's income and operating cost as profit and loss counts them, and the rows waiting", () => {
    const figures = report('month').figures(MONTH)
    expect(amountLabelled(figures, lineLabel(settings, 'income'))).toBe(totals.income)
    expect(amountLabelled(figures, lineLabel(settings, 'operating'))).toBe(totals.operating)
    expect(figures.find((figure) => 'count' in figure)).toEqual({ label: 'rows waiting on To review, of any month', count: BOOKS.workbook.transactions.filter(needsReview).length })
    expect(report('month').figures(null)).toEqual(figures)
  })

  it('keeps the taxes, owner pay and what they complete to a report marked as holding employees’ pay', () => {
    const month = report('month').figures(MONTH)
    const profit = report('profit').figures(MONTH)
    for (const line of ['taxes', 'ownerPay', 'cost', 'net', 'ownerEarns'] as const) {
      expect(amountLabelled(month, lineLabel(settings, line))).toBeUndefined()
      expect(amountLabelled(profit, lineLabel(settings, line))).toBe(totals[line])
    }
    expect(amountLabelled(report('profit').figures(addMonths(MONTH, -1)), displayNamesOf(BOOKS.workbook).category('payroll-tax'))).toBeGreaterThan(0)
    expect(report('profit').employees).toBe(true)
    expect(READER.reports.filter((candidate) => candidate.employees === true).map((candidate) => candidate.id)).toEqual(['profit', 'forecast'])
  })

  it('holds no figure of pay or the taxes on it in a report not marked as holding employees’ pay', () => {
    const doubled = companyReaderOf(payDoubled(BOOKS))
    const unmarked = READER.reports.filter((candidate) => candidate.employees !== true)
    expect(doubled.reports.find((candidate) => candidate.id === 'profit')!.figures(addMonths(MONTH, -1))).not.toEqual(report('profit').figures(addMonths(MONTH, -1)))
    const names = displayNamesOf(BOOKS.workbook)
    const payNames = BOOKS.workbook.categories.filter(isPayCategory).map((category) => names.category(category.slug))
    expect(payNames).toEqual(expect.arrayContaining(['Payroll contributions', 'Payroll tax']))
    expect(unmarked.map((candidate) => candidate.id)).toEqual(['month', 'categories', 'balances', 'receivables', 'taxes'])
    for (const unmarkedReport of unmarked) {
      const periods = unmarkedReport.period === 'day' ? [null, NEWEST] : [null, MONTH, addMonths(MONTH, -1), addMonths(MONTH, -2)]
      for (const period of periods) {
        const figures = unmarkedReport.figures(period)
        expect(
          figures.filter((figure) => payNames.some((name) => figure.label.startsWith(name))),
          unmarkedReport.id,
        ).toEqual([])
        // A balance is the cash after every payment, pay among them, so only the reports of a category or a line are compared.
        if (unmarkedReport.id !== 'balances') expect(doubled.reports.find((candidate) => candidate.id === unmarkedReport.id)!.figures(period), `${unmarkedReport.id} ${period}`).toEqual(figures)
      }
    }
  })

  it("gives each account's balance on a day as Overview counts it", () => {
    const balances = latestBalances(ledger.workbook.transactions)
    const figures = report('balances').figures(NEWEST)
    expect(amountLabelled(figures, 'all accounts')).toBe(balances.cashOnHand.amount)
    expect(figures).toHaveLength(balances.accounts.length + 1)
  })

  it('gives what clients owe on the day as Invoicing counts it', () => {
    const matched = receivablesOf(booked.transactions, booked.categories, booked.invoices, booked.clients).clients.flatMap((client) => client.invoices)
    const owed = amountsOwed(matched, NEWEST)
    const figures = report('receivables').figures(NEWEST)
    expect(amountLabelled(figures, 'still owed')).toBe(owed.outstanding)
    expect(amountLabelled(figures, 'overdue')).toBe(owed.overdue)
  })

  it('refuses a period that does not read as one', async () => {
    const reads = companyReadsOf(BOOKS)
    expect((await readFigures('company', 'month', '2026-13', reads)).isError).toBe(true)
    expect((await readFigures('company', 'balances', '2026-02-30', reads)).isError).toBe(true)
  })
})
