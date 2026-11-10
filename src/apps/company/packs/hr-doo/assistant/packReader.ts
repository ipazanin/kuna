import type { CompanyReading, PackReader } from '../../../assistant/companyReader'
import { DEFAULT_FILTERS } from '../../../filters/domain/filterState'
import { ownerShareText } from '../../../owner-share/domain/ownerShare'
import { countedLedger } from '../../../transactions/domain/countedLedger'
import { CATEGORY_RECORDS } from '../../../workbook/domain/coreKinds'
import { displayNamesOf } from '../../../workbook/domain/displayName'
import { recordsOfKindIn } from '../../../workbook/domain/readWorkbook'
import { bookingOfAdvance } from '../../../workbook/domain/workbook'
import type { Workbook } from '../../../workbook/domain/workbook'
import type { Asset } from '../domain/assets/assets'
import { COMPANY_FACT_SETTINGS } from '../domain/companyFacts'
import { dividendCapacity } from '../domain/dividend/dividendCapacity'
import { effectiveTaxRate } from '../domain/effectiveTaxRate'
import type { Employee } from '../domain/employees/employees'
import { forecastYear } from '../domain/forecast/forecastYear'
import type { PlanLine } from '../domain/forecast/plan'
import type { Grant, GrantClawback } from '../domain/grants/grants'
import { ASSET_RECORDS, EMPLOYEE_RECORDS, GRANT_RECORDS, OWNER_ADVANCE_RECORDS, PLAN_RECORDS, SCENARIO_RECORDS, YEAR_END_RECORDS } from '../domain/hrDooKinds'
import { hrDooWorkbook } from '../domain/hrDooPart'
import type { HrDooWorkbook } from '../domain/hrDooPart'
import type { OwnerAdvanceEntry } from '../domain/ownerAdvancesReading'
import type { ScenarioRow } from '../domain/scenarios/scenariosReading'
import { taxByType } from '../domain/taxByType'
import { isOwnerPayCost } from '../domain/packRoles'
import { yearOptions } from '../domain/yearChoice'
import type { YearOption } from '../domain/yearChoice'
import type { YearEndLine } from '../domain/yearEnd/yearEnd'
import type { TracedFigure } from '../ruleset/tracedFigure'
import { readableKind } from '../../../../../shared/app/assistantReader'
import type { ReportFigure } from '../../../../../shared/app/assistantReader'
import { civilDate, yearOf } from '../../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../../shared/calendar/civilDate'
import type { LedgerWindow } from '../../../../../shared/calendar/ledgerWindow'
import { parseMonthKey, yearOfMonth } from '../../../../../shared/calendar/monthKey'
import type { CurrencyCode } from '../../../../../shared/money/currencyCode'
import { EURO, currencyCodeOf } from '../../../../../shared/money/currencyCode'
import { ZERO, plainAmount } from '../../../../../shared/money/money'
import type { Money } from '../../../../../shared/money/money'
import { writtenPercent } from '../../../../../shared/money/percent'
import type { FieldDocs } from '../../../../../shared/privacy/domain/exposure'
import { HR_DOO_TRACE_RULES } from './buildUpRead'
import { tripKinds } from './tripReads'
import { words } from './words'

/** A plan row as the chat reads it, whichever kind of row it is, its amount zero on a row that holds none. */
interface PlanLineView {
  readonly id: string
  readonly year: number
  readonly month: number | null
  readonly item: string
  readonly category: string
  readonly amount: Money
  readonly date: string
  readonly group: string
  readonly scenario: string
  readonly from: string
  readonly note: string
}

/** A scenario part as the chat reads it, with the people it may pay, so the row stays home with their records. */
interface ScenarioComponentView {
  readonly id: string
  readonly scenario: string
  readonly label: string
  readonly year: number
  readonly component: string
  readonly item: string
  readonly amount: Money
  readonly holds: string
  readonly from: string
  readonly to: string
  readonly pays: readonly string[]
}

interface YearEndLineView {
  readonly id: string
  readonly year: number
  readonly statement: string
  readonly line: string
  readonly label: string
  readonly amount: Money
  readonly value: string
  readonly categories: string
  readonly aop: string
  readonly source: string
  readonly note: string
}

interface GrantView {
  readonly id: string
  readonly received: string
  readonly amount: Money
  readonly fixedPart: Money
  readonly variablePart: Money
  readonly period: string
  readonly release: string
  readonly clawbackFirstYear: string
  readonly clawbackSecondYear: string
  readonly employmentRequiredUntil: string
  readonly note: string
}

/** An employee as the chat reads it, by the name the screens give, which keeps the record home while Anonymise is on. */
interface EmployeeView {
  readonly id: string
  readonly name: string
  readonly ibans: readonly string[]
  readonly agreedGross: Money
  readonly from: string
  readonly to: string
  readonly director: boolean
  readonly residenceCity: string
  readonly pensionPillarTwo: boolean
  readonly dependants: number
  readonly birthYear: number | null
}

const OWNER_ADVANCE_FIELDS: FieldDocs<OwnerAdvanceEntry> = {
  id: { exposure: 'ref', to: OWNER_ADVANCE_RECORDS.name, meaning: 'The advance.' },
  date: { exposure: 'plain', meaning: 'The day the owner paid.' },
  amount: { exposure: 'plain', amount: 'app', sign: 'zero-or-more', meaning: 'What the owner paid, above zero.' },
  description: { exposure: 'free-text', meaning: 'What it was for.' },
  category: { exposure: 'ref', to: CATEGORY_RECORDS.name, meaning: 'The cost category it counts in.' },
  ownerShare: { exposure: 'plain', meaning: "The owner's private share of it in percent, or empty for none.", read: (advance) => ownerShareText(advance.ownerShare) ?? '' },
  ownerPart: { exposure: 'never', meaning: 'Set only on a part the screens make.' },
}

const PLAN_FIELDS: FieldDocs<PlanLineView> = {
  id: { exposure: 'ref', to: PLAN_RECORDS.name, meaning: 'The plan row.' },
  year: { exposure: 'plain', meaning: 'The year it plans.' },
  month: { exposure: 'plain', meaning: 'The month, 1 to 12, or empty for every month of the year.' },
  item: { exposure: 'plain', meaning: 'amount, dividend, purchase or owner-pay-scenario.' },
  category: { exposure: 'ref', to: CATEGORY_RECORDS.name, meaning: 'The category an amount row plans.' },
  amount: { exposure: 'plain', amount: 'app', sign: 'zero-or-more', meaning: 'The monthly amount, the dividend or the net cost of the purchase, read positive. Zero on a scenario row.' },
  date: { exposure: 'plain', meaning: 'The day of a purchase.' },
  group: { exposure: 'plain', meaning: "A purchase's asset group." },
  scenario: { exposure: 'plain', meaning: 'The owner pay scenario a scenario row picks.' },
  from: { exposure: 'plain', meaning: 'The day the scenario takes over, or empty for 1 January.' },
  note: { exposure: 'free-text', meaning: "The owner's note." },
}

const SCENARIO_FIELDS: FieldDocs<ScenarioComponentView> = {
  id: { exposure: 'ref', to: SCENARIO_RECORDS.name, meaning: 'The scenario part.' },
  scenario: { exposure: 'plain', meaning: "The scenario's short name." },
  label: { exposure: 'free-text', meaning: "The scenario's name." },
  year: { exposure: 'plain', meaning: 'The year it plans.' },
  component: { exposure: 'plain', meaning: 'salary_gross, nontaxable, rent_monthly, dividend or director_basis.' },
  item: { exposure: 'plain', meaning: 'The tax-free item of a nontaxable part.' },
  amount: { exposure: 'plain', amount: 'app', sign: 'zero-or-more', meaning: 'The monthly gross, item, rent or dividend. Zero when holds names a word instead.' },
  holds: { exposure: 'plain', meaning: "floor for the director's floor salary, max for the largest dividend, the director's basis, or empty when amount holds it." },
  from: { exposure: 'plain', meaning: 'The first day it holds, or empty for the start of the year.' },
  to: { exposure: 'plain', meaning: 'The last day it holds, or empty for the end of the year.' },
  pays: { exposure: 'party', meaning: 'The director whose pay it plans, or every employee while none is the director.' },
}

const YEAR_END_FIELDS: FieldDocs<YearEndLineView> = {
  id: { exposure: 'ref', to: YEAR_END_RECORDS.name, meaning: 'The line.' },
  year: { exposure: 'plain', meaning: 'The year the accountant closed.' },
  statement: { exposure: 'plain', meaning: 'Which statement or form it is from.' },
  line: { exposure: 'plain', meaning: "The line's id, or the account number on a konto row." },
  label: { exposure: 'free-text', meaning: 'As the package prints it.' },
  amount: { exposure: 'plain', amount: 'app', sign: 'either', meaning: 'Its amount on a money line, else zero.' },
  value: { exposure: 'plain', meaning: 'Its day, rate or count on a line that holds one.' },
  categories: { exposure: 'plain', meaning: 'The categories a konto row stands for.' },
  aop: { exposure: 'plain', meaning: 'Its AOP number.' },
  source: { exposure: 'free-text', meaning: 'The file it was read from.' },
  note: { exposure: 'free-text', meaning: "The owner's note." },
}

const ASSET_FIELDS: FieldDocs<Asset> = {
  id: { exposure: 'ref', to: ASSET_RECORDS.name, meaning: 'The asset.' },
  name: { exposure: 'free-text', meaning: 'As written.' },
  bought: { exposure: 'plain', meaning: 'The day it was bought.' },
  inUse: { exposure: 'plain', meaning: 'The day it was put in use.' },
  costNet: { exposure: 'plain', amount: 'app', sign: 'zero-or-more', meaning: 'Its cost without the VAT deducted.' },
  group: { exposure: 'plain', meaning: 'Its depreciation group.' },
  doubledRate: { exposure: 'plain', meaning: "The accountant doubles its group's depreciation rate." },
  disposed: { exposure: 'plain', meaning: 'The day it was disposed of, or empty while it is held.' },
  fundedBy: { exposure: 'ref', to: GRANT_RECORDS.name, meaning: 'The grant that paid for it.' },
  ledgerReference: { exposure: 'free-text', meaning: 'What finds the purchase on the ledger, such as its bank reference.' },
  note: { exposure: 'free-text', meaning: "The owner's note." },
}

const GRANT_FIELDS: FieldDocs<GrantView> = {
  id: { exposure: 'ref', to: GRANT_RECORDS.name, meaning: 'The grant, by its short name.' },
  received: { exposure: 'plain', meaning: 'The day it was received.' },
  amount: { exposure: 'plain', amount: 'app', sign: 'zero-or-more', meaning: 'What was received.' },
  fixedPart: { exposure: 'plain', amount: 'app', sign: 'zero-or-more', meaning: 'The part counted as income when received. Zero with the variable part when the tab gives neither.' },
  variablePart: { exposure: 'plain', amount: 'app', sign: 'zero-or-more', meaning: 'The part counted with the depreciation of the assets it paid for.' },
  period: { exposure: 'plain', meaning: 'The days it covers, or empty.' },
  release: { exposure: 'plain', meaning: 'How it counts as income: fixed-then-assets or straight-line.' },
  clawbackFirstYear: { exposure: 'plain', meaning: 'What can be claimed back if the terms break in the first year: whole, an amount, or empty.' },
  clawbackSecondYear: { exposure: 'plain', meaning: 'The same in the second year.' },
  employmentRequiredUntil: { exposure: 'plain', meaning: "The day until which it requires the owner's employment, or empty." },
  note: { exposure: 'free-text', meaning: "The owner's note." },
}

const EMPLOYEE_FIELDS: FieldDocs<EmployeeView> = {
  id: { exposure: 'ref', to: EMPLOYEE_RECORDS.name, meaning: 'The employee, by their short name.' },
  name: { exposure: 'party', meaning: 'Their name.' },
  ibans: { exposure: 'identifier', meaning: 'The accounts their salary is paid into.' },
  agreedGross: { exposure: 'plain', amount: 'app', sign: 'zero-or-more', meaning: 'The full-time monthly gross of the contract, or zero when the tab gives none.' },
  from: { exposure: 'plain', meaning: 'The first day of the employment.' },
  to: { exposure: 'plain', meaning: 'The last day, or empty while it lasts.' },
  director: { exposure: 'plain', meaning: 'A member who is the director, paid at least the director floor.' },
  residenceCity: { exposure: 'plain', meaning: 'The city of residence, which sets the income tax rates.' },
  pensionPillarTwo: { exposure: 'plain', meaning: 'In the second pension pillar.' },
  dependants: { exposure: 'plain', meaning: 'Dependants on the tax card.' },
  birthYear: { exposure: 'plain', meaning: 'The year of birth, which the annual settlement reads.' },
}

function planLineOf(line: PlanLine): PlanLineView {
  const timing = { id: line.id, year: line.year, month: line.month, note: line.note }
  const none = { item: line.kind, category: '', amount: ZERO, date: '', group: '', scenario: '', from: '' }
  if (line.kind === 'amount') {
    return line.item === 'dividend' ? { ...timing, ...none, item: 'dividend', amount: line.amount } : { ...timing, ...none, category: line.item, amount: line.amount }
  }
  if (line.kind === 'purchase') return { ...timing, ...none, amount: line.amount, date: line.date, group: line.group }
  return { ...timing, ...none, scenario: line.scenario, from: line.from ?? '' }
}

function scenarioComponentOf(row: ScenarioRow, paid: readonly Employee[]): ScenarioComponentView {
  const part = row.component
  const amountOrWord = (held: Money | string) => (typeof held === 'string' ? { amount: ZERO, holds: held } : { amount: held, holds: '' })
  const shown =
    part.component === 'salary_gross'
      ? amountOrWord(part.gross)
      : part.component === 'dividend'
        ? amountOrWord(part.amount)
        : part.component === 'director_basis'
          ? { amount: ZERO, holds: part.basis }
          : { amount: part.amount, holds: '' }
  return {
    id: part.id,
    scenario: row.slug,
    label: row.label,
    year: row.year,
    component: part.component,
    item: part.component === 'nontaxable' ? part.item : '',
    ...shown,
    from: part.from ?? '',
    to: part.to ?? '',
    pays: paid.map((employee) => employee.name || employee.slug),
  }
}

function yearEndLineOf(line: YearEndLine): YearEndLineView {
  const { figure } = line
  return {
    id: line.id,
    year: line.year,
    statement: line.statement,
    line: line.line,
    label: line.label,
    amount: figure.kind === 'money' ? figure.amount : ZERO,
    value: figure.kind === 'date' ? figure.date : figure.kind === 'rate' ? `${writtenPercent(figure.basisPoints)}%` : figure.kind === 'count' ? String(figure.count) : '',
    categories: line.categories.join(', '),
    aop: line.aop,
    source: line.source,
    note: line.note,
  }
}

function clawbackText(clawback: GrantClawback | null): string {
  return clawback === null ? '' : clawback === 'whole' ? 'whole' : plainAmount(clawback)
}

function grantOf(grant: Grant): GrantView {
  return {
    id: grant.slug,
    received: grant.received,
    amount: grant.amount,
    fixedPart: grant.parts?.fixed ?? ZERO,
    variablePart: grant.parts?.variable ?? ZERO,
    period: grant.period === null ? '' : `${grant.period.from} to ${grant.period.to}`,
    release: grant.release,
    clawbackFirstYear: clawbackText(grant.clawbackFirstYear),
    clawbackSecondYear: clawbackText(grant.clawbackSecondYear),
    employmentRequiredUntil: grant.employmentRequiredUntil ?? '',
    note: grant.note,
  }
}

function employeeOf(employee: Employee): EmployeeView {
  return {
    id: employee.slug,
    name: employee.name || employee.slug,
    ibans: employee.ibans,
    agreedGross: employee.agreedGross ?? ZERO,
    from: employee.from,
    to: employee.to ?? '',
    director: employee.director,
    residenceCity: employee.residenceCity,
    pensionPillarTwo: employee.pensionPillarTwo,
    dependants: employee.dependants,
    birthYear: employee.birthYear,
  }
}

/** The books as the Year screen counts them: the workbook as booked with the pack's part, the ledger's window, and the newest booking, which is the day the forecast is seen on. */
interface YearBooks {
  readonly books: HrDooWorkbook
  readonly window: LedgerWindow
  readonly asOf: CivilDate
  readonly currency: CurrencyCode
}

function yearBooksOf(workbook: Workbook): YearBooks | null {
  const ledger = countedLedger(workbook, DEFAULT_FILTERS)
  return ledger === null ? null : { books: hrDooWorkbook(ledger.booked), window: ledger.window, asOf: ledger.window.newestDay, currency: currencyCodeOf(workbook.settings.currency) ?? EURO }
}

/** How the Year screen offers the year a month names, or the newest booking's year, or null for a year it does not offer. */
function yearOptionOf({ books, window, asOf }: YearBooks, period: string | null): YearOption | null {
  const month = period === null ? null : parseMonthKey(period)
  if (period !== null && month === null) throw new RangeError('Not a month.')
  const year = month === null ? yearOf(asOf) : yearOfMonth(month)
  const accountantYears = [...new Set(books.yearEndLines.map((line) => line.year))]
  return yearOptions(accountantYears, yearOfMonth(window.firstMonth), yearOf(asOf)).find((option) => option.year === year) ?? null
}

function amountOf(label: string, figure: TracedFigure | null, currency: CurrencyCode): ReportFigure[] {
  return figure === null ? [] : [{ label, of: 'app', cents: figure.amount, currency }]
}

/** The forecast of a year the Year screen forecasts, which is any it offers but a closed one. */
function forecastReport(yearBooks: YearBooks, period: string | null): readonly ReportFigure[] {
  const option = yearOptionOf(yearBooks, period)
  const { books, asOf, currency } = yearBooks
  if (option === null || option.view === 'closed' || books.companyFacts.companyRegistered === null) return []
  const { year } = option
  const forecast = forecastYear(books, year, asOf)
  const { liability } = forecast
  return [
    ...amountOf('revenue', forecast.revenue.total, currency),
    ...forecast.lines.flatMap((line) => amountOf(`${line.line}: ${line.forecast.label}`, line.forecast.total, currency)),
    ...amountOf('profit before tax', forecast.profitBeforeTax.total, currency),
    { label: 'corporate tax rate', basisPoints: liability.rate.basisPoints },
    ...amountOf('corporate tax', liability.liability, currency),
    ...amountOf('corporate tax advances paid', forecast.cit.advancesPaid, currency),
    ...amountOf('corporate tax advances still to come', forecast.cit.advancesToCome, currency),
    ...amountOf('corporate tax monthly advance for the next period', liability.monthlyAdvance, currency),
    ...amountOf('profit after tax', forecast.profitAfterTax, currency),
    ...amountOf('can be paid out as a dividend', dividendCapacity(year, forecast, books).distributable, currency),
    ...amountOf('revenue still to be received at year end', forecast.receivableAtYearEnd, currency),
    ...amountOf('VAT the state owes the company, on the day of the forecast', forecast.vatPosition, currency),
    ...amountOf('cash at year end', forecast.cashAtYearEnd, currency),
  ]
}

/**
 * Each tax category of a year as the Taxes tab counts it, but the taxes on pay, and the client revenue the tab sets them
 * against. Net taxes and their rate hold the taxes on pay, so they stay out.
 */
function taxesReport(yearBooks: YearBooks, period: string | null): readonly ReportFigure[] {
  const option = yearOptionOf(yearBooks, period)
  const { books, window, currency } = yearBooks
  if (option === null) return []
  const { year } = option
  const bookings = [...books.transactions, ...books.ownerAdvances.map(bookingOfAdvance)]
  const yearPeriod = { preset: 'custom', range: { from: civilDate(year, 1, 1), to: civilDate(year, 12, 31) } } as const
  const names = displayNamesOf(books)
  const payFree = new Set(books.categories.filter((category) => !isOwnerPayCost(category)).map((category) => category.slug))
  return [
    ...taxByType(bookings, books.categories, yearPeriod, window)
      .types.filter((type) => payFree.has(type.category))
      .map((type): ReportFigure => ({ label: names.category(type.category), of: 'app', cents: type.total.amount, currency })),
    { label: 'client revenue', of: 'app', cents: effectiveTaxRate(bookings, books.categories, yearPeriod, window).revenue.amount, currency },
  ]
}

/**
 * What the chat reads of the Croatian d.o.o. pack: its ten kinds with every field classified, the year's forecast and
 * taxes from the Year screen's own functions, and the ruleset behind its build-ups. An employee's record, and each part
 * of a pay scenario, names the person, so the shared read keeps it on the device while Anonymise is on.
 */
export function hrDooReader(reading: CompanyReading): PackReader {
  const recordsOf = <R>(kind: Parameters<typeof recordsOfKindIn<R>>[1]): readonly R[] => {
    const records = reading.records()
    return records === null ? [] : recordsOfKindIn(records, kind).records.map(({ record }) => record)
  }
  const paid = (): readonly Employee[] => {
    const workbook = reading.workbook()
    if (workbook === null) return []
    const { director, employees } = hrDooWorkbook(workbook)
    return director === null ? employees : [director]
  }
  const currency = () => {
    const workbook = reading.workbook()
    return workbook === null ? EURO : (currencyCodeOf(workbook.settings.currency) ?? EURO)
  }
  const report = (figures: (books: YearBooks, period: string | null) => readonly ReportFigure[]) => (period: string | null) => {
    const workbook = reading.workbook()
    const books = workbook === null ? null : yearBooksOf(workbook)
    return books === null ? [] : figures(books, period)
  }
  return {
    kinds: [
      readableKind({ kind: OWNER_ADVANCE_RECORDS, about: words.reads.ownerAdvance, fields: OWNER_ADVANCE_FIELDS, dated: 'date', rows: () => recordsOf(OWNER_ADVANCE_RECORDS), currencyOf: currency }),
      readableKind({ kind: PLAN_RECORDS, about: words.reads.planLine, fields: PLAN_FIELDS, dated: null, rows: () => recordsOf(PLAN_RECORDS).map(planLineOf), currencyOf: currency }),
      readableKind({
        kind: SCENARIO_RECORDS,
        about: words.reads.scenarioComponent,
        fields: SCENARIO_FIELDS,
        dated: null,
        rows: () => {
          const people = paid()
          return recordsOf(SCENARIO_RECORDS).map((row) => scenarioComponentOf(row, people))
        },
        currencyOf: currency,
      }),
      readableKind({ kind: YEAR_END_RECORDS, about: words.reads.yearEndLine, fields: YEAR_END_FIELDS, dated: null, rows: () => recordsOf(YEAR_END_RECORDS).map(yearEndLineOf), currencyOf: currency }),
      readableKind({ kind: ASSET_RECORDS, about: words.reads.asset, fields: ASSET_FIELDS, dated: 'bought', rows: () => recordsOf(ASSET_RECORDS), currencyOf: currency }),
      readableKind({ kind: GRANT_RECORDS, about: words.reads.grant, fields: GRANT_FIELDS, dated: 'received', rows: () => recordsOf(GRANT_RECORDS).map(grantOf), currencyOf: currency }),
      readableKind({ kind: EMPLOYEE_RECORDS, about: words.reads.employee, fields: EMPLOYEE_FIELDS, dated: null, rows: () => recordsOf(EMPLOYEE_RECORDS).map(employeeOf), currencyOf: currency }),
      ...tripKinds(reading, currency),
    ],
    settingKeys: new Set(COMPANY_FACT_SETTINGS.definitions.map(({ key }) => key)),
    reports: [
      { id: 'forecast', title: words.reports.forecast.title, about: words.reports.forecast.about, period: 'month', employees: true, figures: report(forecastReport) },
      { id: 'taxes', title: words.reports.taxes.title, about: words.reports.taxes.about, period: 'month', figures: report(taxesReport) },
    ],
    traceRules: HR_DOO_TRACE_RULES,
    ownerPayCost: isOwnerPayCost,
  }
}
