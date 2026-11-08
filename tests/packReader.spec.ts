import { describe, expect, it } from 'vitest'

import { DEFAULT_FILTERS } from '../src/apps/company/filters/domain/filterState'
import { HR_DOO_ASSISTANT } from '../src/apps/company/packs/hr-doo/assistant/hrDooAssistant'
import { effectiveTaxRate } from '../src/apps/company/packs/hr-doo/domain/effectiveTaxRate'
import type { Employee } from '../src/apps/company/packs/hr-doo/domain/employees/employees'
import { forecastYear } from '../src/apps/company/packs/hr-doo/domain/forecast/forecastYear'
import * as hrDooKinds from '../src/apps/company/packs/hr-doo/domain/hrDooKinds'
import { HR_DOO, hrDooWorkbook } from '../src/apps/company/packs/hr-doo/domain/hrDooPart'
import type { HrDooWorkbook } from '../src/apps/company/packs/hr-doo/domain/hrDooPart'
import { isOwnerPayCost } from '../src/apps/company/packs/hr-doo/domain/packRoles'
import { taxByType } from '../src/apps/company/packs/hr-doo/domain/taxByType'
import { countedLedger } from '../src/apps/company/transactions/domain/countedLedger'
import { recordsOfKindIn } from '../src/apps/company/workbook/domain/readWorkbook'
import type { RecordKind } from '../src/shared/storage/domain/recordKind'
import { bookingOfAdvance } from '../src/apps/company/workbook/domain/workbook'
import { findRecords, readFigures } from '../src/shared/ai/application/chatReads'
import type { FindRecordsInput } from '../src/shared/ai/application/chatReads'
import type { ReportFigure } from '../src/shared/app/assistantReader'
import { civilDate, yearOf } from '../src/shared/calendar/civilDate'
import type { CivilDate } from '../src/shared/calendar/civilDate'
import type { CompanyBooks } from '../src/apps/company/workbook/domain/readWorkbook'
import { companyReadsOf, fakeCompanyBooks, readingOf } from './fixtures/companyChatBooks'
import { civil } from './fixtures/ledger'

/** The books with the pack's part changed, as a file edited by hand could hold it. */
function withPart(books: CompanyBooks, change: (part: HrDooWorkbook) => Partial<HrDooWorkbook>): CompanyBooks {
  const part = hrDooWorkbook(books.workbook)
  return { ...books, workbook: { ...books.workbook, packParts: { ...books.workbook.packParts, [HR_DOO.name]: { ...part, ...change(part) } } } }
}

/** The fake books with the company's registration day set, which the forecast starts its first tax period from. */
function registered(books: CompanyBooks, day: CivilDate | null): CompanyBooks {
  return withPart(books, ({ companyFacts }) => ({ companyFacts: { ...companyFacts, companyRegistered: day } }))
}

const BOOKS = registered(fakeCompanyBooks(), civil('2025-05-12'))
const PACK = HR_DOO_ASSISTANT.reader(readingOf(BOOKS))
const LEDGER = countedLedger(BOOKS.workbook, DEFAULT_FILTERS)!
const BOOKED = hrDooWorkbook(LEDGER.booked)
const AS_OF = LEDGER.window.newestDay
const YEAR = yearOf(AS_OF)

function amountLabelled(figures: readonly ReportFigure[], label: string): number | undefined {
  const figure = figures.find((candidate) => candidate.label === label)
  return figure !== undefined && 'cents' in figure ? figure.cents : undefined
}

function report(id: string) {
  return PACK.reports.find((candidate) => candidate.id === id)!
}

const ALL: FindRecordsInput = { app: 'company', kind: hrDooKinds.EMPLOYEE_RECORDS.name, query: null, from: null, to: null, about: null, only: null, limit: 200, cursor: null }

describe("what the chat reads of the d.o.o. pack's records", () => {
  it('reads each of the pack’s kinds, one row a record', () => {
    expect(PACK.kinds.map((readable) => readable.name).sort()).toEqual(
      Object.values(hrDooKinds)
        .map((recordKind) => recordKind.name)
        .sort(),
    )
    for (const recordKind of Object.values(hrDooKinds) as readonly RecordKind<unknown>[]) {
      const readable = PACK.kinds.find((candidate) => candidate.name === recordKind.name)!
      expect(readable.rows().length, recordKind.name).toBe(recordsOfKindIn(BOOKS.records, recordKind).records.length)
    }
    expect(PACK.kinds.find((readable) => readable.name === hrDooKinds.EMPLOYEE_RECORDS.name)!.rows().length).toBe(5)
  })

  it('keeps every employee’s record on the device while Anonymise is on, and reads them all with it off', async () => {
    const on = JSON.parse((await findRecords(ALL, companyReadsOf(BOOKS))).text)
    expect(on.total).toBe(0)
    expect(on.leftOutAboutEmployees).toBe(5)
    expect(JSON.stringify(on)).not.toMatch(/Primjer|Uzorak|Zagreb|2400/)
    const off = JSON.parse((await findRecords(ALL, companyReadsOf(BOOKS, { anonymising: () => false }))).text)
    expect(off.total).toBe(5)
    expect(off.records.map((record: { name: string }) => record.name)).toContain('Mia Primjer')
  })

  it("keeps each part of the director's pay scenarios on the device while Anonymise is on", async () => {
    const scenarios = { ...ALL, kind: hrDooKinds.SCENARIO_RECORDS.name }
    const all = recordsOfKindIn(BOOKS.records, hrDooKinds.SCENARIO_RECORDS).records.length
    expect(all).toBeGreaterThan(0)
    const on = JSON.parse((await findRecords(scenarios, companyReadsOf(BOOKS))).text)
    expect(on.total).toBe(0)
    expect(on.leftOutAboutEmployees).toBe(all)
    const off = JSON.parse((await findRecords(scenarios, companyReadsOf(BOOKS, { anonymising: () => false }))).text)
    expect(off.total).toBe(all)
  })

  it('keeps each part of a pay scenario on the device while Anonymise is on and no employee is the director', async () => {
    const noDirector = withPart(BOOKS, ({ employees }) => ({ employees: employees.map((employee): Employee => ({ ...employee, director: false })), director: null }))
    const scenarios = { ...ALL, kind: hrDooKinds.SCENARIO_RECORDS.name }
    const on = JSON.parse((await findRecords(scenarios, companyReadsOf(noDirector))).text)
    expect(on.total).toBe(0)
    expect(on.leftOutAboutEmployees).toBe(recordsOfKindIn(BOOKS.records, hrDooKinds.SCENARIO_RECORDS).records.length)
  })

  it('reads the pack’s settings keys by their value', () => {
    expect([...PACK.settingKeys].every((key) => key.startsWith('hr_'))).toBe(true)
  })
})

describe("the pack's reports", () => {
  it("gives the year's forecast as the Year screen works it out, and marks it as holding employees' pay", () => {
    const forecast = forecastYear(BOOKED, YEAR, AS_OF)
    const figures = report('forecast').figures(`${YEAR}-03`)
    expect(amountLabelled(figures, 'profit before tax')).toBe(forecast.profitBeforeTax.total.amount)
    expect(amountLabelled(figures, 'corporate tax')).toBe(forecast.liability.liability.amount)
    expect(amountLabelled(figures, 'cash at year end')).toBe(forecast.cashAtYearEnd.amount)
    expect(figures.find((figure) => figure.label === 'corporate tax rate')).toEqual({ label: 'corporate tax rate', basisPoints: forecast.liability.rate.basisPoints })
    expect(report('forecast').figures(null)).toEqual(figures)
    expect(report('forecast').employees).toBe(true)
  })

  it('gives no forecast for a year the Year screen does not offer, or before the company’s registration day is set', () => {
    expect(report('forecast').figures('1999-01')).toEqual([])
    expect(HR_DOO_ASSISTANT.reader(readingOf(registered(BOOKS, null))).reports[0]!.figures(null)).toEqual([])
  })

  it('gives no forecast for a year the accountant has closed, as the Year screen shows none, but still its taxes', () => {
    const closed = `${YEAR - 1}-06`
    expect(BOOKED.yearEndLines.some((line) => line.year === YEAR - 1)).toBe(true)
    expect(report('forecast').figures(closed)).toEqual([])
    expect(report('taxes').figures(closed)).not.toEqual([])
    const ended = HR_DOO_ASSISTANT.reader(readingOf(withPart(BOOKS, () => ({ yearEndLines: [] }))))
    expect(ended.reports.find((candidate) => candidate.id === 'forecast')!.figures(closed)).not.toEqual([])
  })

  it("gives the year's taxes as the Taxes tab counts them, but the taxes on pay", () => {
    const { window } = LEDGER
    const bookings = [...BOOKED.transactions, ...BOOKED.ownerAdvances.map(bookingOfAdvance)]
    const period = { preset: 'custom', range: { from: civilDate(YEAR, 1, 1), to: civilDate(YEAR, 12, 31) } } as const
    const pay = new Set(BOOKED.categories.filter(isOwnerPayCost).map((category) => category.slug))
    const types = taxByType(bookings, BOOKED.categories, period, window).types
    const payFree = types.filter((type) => !pay.has(type.category))
    expect(payFree.length).toBeGreaterThan(0)
    expect(payFree.length).toBeLessThan(types.length)
    const figures = report('taxes').figures(`${YEAR}-01`)
    expect(figures.slice(0, payFree.length).map((figure) => ('cents' in figure ? figure.cents : null))).toEqual(payFree.map((type) => type.total.amount))
    expect(figures).toHaveLength(payFree.length + 1)
    expect(amountLabelled(figures, 'client revenue')).toBe(effectiveTaxRate(bookings, BOOKED.categories, period, window).revenue.amount)
    expect(report('taxes').employees).toBeUndefined()
  })

  it('refuses a period that is not a month', async () => {
    expect((await readFigures('company', 'forecast', '2026-02-31', companyReadsOf(BOOKS))).isError).toBe(true)
  })
})
