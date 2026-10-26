import type { DocumentTab } from '../../src/packs/hr-doo/domain/accountant/accountantDocument'
import type { StatementCell } from '../../src/features/imports/domain/tabularStatement'
import { localRates } from '../../src/packs/hr-doo/domain/payroll/incomeTax'
import { payrollMonth } from '../../src/packs/hr-doo/domain/payroll/payrollMonth'
import { ruleValue } from '../../src/packs/hr-doo/ruleset/ruleset'
import type { TracedFigure } from '../../src/packs/hr-doo/ruleset/tracedFigure'
import { serialFromCivilDate, weekdaysBetween } from '../../src/shared/calendar/civilDate'
import { firstDayOf, lastDayOf, parseMonthKey } from '../../src/shared/calendar/monthKey'
import type { MonthKey } from '../../src/shared/calendar/monthKey'
import { amountOf, sumMoney } from '../../src/shared/money/money'
import { civil, euros } from './ledger'

type Row = (StatementCell | undefined)[]

export function month(text: string): MonthKey {
  const key = parseMonthKey(text)
  if (key === null) {
    throw new Error(`${text} is not a month`)
  }
  return key
}

/** Euros added in cents, so a fixture's totals are what a spreadsheet's SUM shows. */
function total(amounts: readonly number[]): number {
  return amountOf(sumMoney(amounts.map(euros)))
}

export interface SaleLine {
  readonly number: string
  readonly issued: string
  readonly amount: number
}

export interface PurchaseLine {
  readonly base: number
  readonly vat: number
}

export interface VatReturnSpec {
  readonly sales: readonly SaleLine[]
  /** Sales in Croatia with their VAT. Leave out for a return without the tab. */
  readonly localSales?: readonly PurchaseLine[]
  readonly local: readonly PurchaseLine[]
  /** Leave out for a return without the EU goods tab. */
  readonly euGoods?: readonly PurchaseLine[]
  /** Leave out for a return without the EU services tab. */
  readonly eu?: readonly PurchaseLine[]
  /** Leave out for a return without the third-country services tab. */
  readonly thirdCountry?: readonly PurchaseLine[]
  /** Words the third-country services as the older returns do: `Primljene usluge - TZ` on the summary and `Porezni broj` on their tab. */
  readonly olderThirdCountryWording?: boolean
  /** Negative, as the return states an overpayment. */
  readonly broughtForward: number
  /** `R.b.` as text such as `1.`, or as a number. */
  readonly lineNumbers?: 'text' | 'number'
}

const PURCHASE_HEADER: Row = ['R.b.', 'Broj računa', 'Datum', 'Dobavljač', 'PDV ID broj', 'Osnovica', 'PDV', 'Ukupno', 'Check']
const SALES_HEADER: Row = ['R.b.', 'Broj računa', 'Datum', 'Kupac', 'PDV ID broj', 'Osnovica', 'PDV', 'Ukupno', 'Check']

/**
 * The tabs of a made-up VAT return, laid out as the accountant's files are. `Rekapitulacija` takes
 * 10 rows, one more with sales in Croatia and two more for each reverse-charged tab.
 */
export function vatReturnTabs(spec: VatReturnSpec): DocumentTab[] {
  const lineNumber = (index: number): StatementCell => (spec.lineNumbers === 'number' ? index + 1 : `${index + 1}.`)
  const salesTotal = total(spec.sales.map((sale) => sale.amount))
  const salesTab: DocumentTab = {
    name: 'Treće zemlje usluge I',
    grid: [
      ['R.b.', 'Broj računa', 'Datum', 'Kupac', 'Porezni broj', 'Iznos'],
      ...spec.sales.map((sale, index): Row => [lineNumber(index), sale.number, serialFromCivilDate(civil(sale.issued)), 'Example Client Ltd', 1234567, sale.amount]),
      [],
      [undefined, undefined, undefined, undefined, undefined, 'Iznos'],
      [undefined, undefined, undefined, undefined, 'I.5.', salesTotal],
    ],
  }
  const detailTab = (name: string, code: string, lines: readonly PurchaseLine[], header = PURCHASE_HEADER, party = 'Example Supplier'): { tab: DocumentTab; base: number; vat: number } => {
    const base = total(lines.map((line) => line.base))
    const vat = total(lines.map((line) => line.vat))
    const rows = lines.map((line, index): Row => [lineNumber(index), `R-${index + 1}`, serialFromCivilDate(civil('2026-03-05')), party, 'HR00000000000', line.base, line.vat, total([line.base, line.vat]), 0])
    return {
      tab: {
        name,
        grid: [
          header,
          ...rows,
          [],
          [undefined, undefined, undefined, undefined, undefined, 'Osnovica', 'PDV'],
          [undefined, undefined, undefined, undefined, code, base, vat, total([base, vat])],
          [undefined, undefined, undefined, undefined, undefined, undefined, 0],
        ],
      },
      base,
      vat,
    }
  }
  const localSales = spec.localSales === undefined ? null : detailTab('Lokalni I', 'II.3.', spec.localSales, SALES_HEADER, 'Example Buyer')
  const local = detailTab('Lokalni U', 'III.3.', spec.local)
  const euGoods = spec.euGoods === undefined ? null : detailTab('Dobra EU', 'II.7./III.7.', spec.euGoods)
  const eu = spec.eu === undefined ? null : detailTab('EU usluge U', 'II.10./III.10.', spec.eu)
  const thirdHeader = spec.olderThirdCountryWording === true ? PURCHASE_HEADER.map((header) => (header === 'PDV ID broj' ? 'Porezni broj' : header)) : PURCHASE_HEADER
  const third = spec.thirdCountry === undefined ? null : detailTab('Treće zemlje usluge U', 'II.13./III.13.', spec.thirdCountry, thirdHeader)
  const thirdLabel = spec.olderThirdCountryWording === true ? 'Primljene usluge - TZ' : 'Treće zemlje - usluge'

  const reverseCharged = [euGoods, eu, third].filter((detail) => detail !== null)
  const reverseChargedLines = (): Row[] => [
    ...(euGoods === null ? [] : [['Stjecanje dobra iz EU', euGoods.base, euGoods.vat]]),
    ...(eu === null ? [] : [['EU - usluge', eu.base, eu.vat]]),
    ...(third === null ? [] : [[thirdLabel, third.base, third.vat]]),
  ]
  const outputVat = total([localSales?.vat ?? 0, ...reverseCharged.map((detail) => detail.vat)])
  const inputVat = total([local.vat, ...reverseCharged.map((detail) => detail.vat)])
  const difference = total([outputVat, -inputVat])
  const summary: Row[] = [
    ['Vrsta isporuke', 'Osnovica', 'PDV'],
    ['Izlazne isporuke'],
    ['Obavljene usluge u TZ', salesTotal],
    ...(localSales === null ? [] : [['Lokalne isporuke', localSales.base, localSales.vat]]),
    ...reverseChargedLines(),
    ['Ukupno', total([salesTotal, localSales?.base ?? 0, ...reverseCharged.map((detail) => detail.base)]), outputVat],
    ['Ulazne isporuke'],
    ['Lokalne isporuke', local.base, local.vat],
    ...reverseChargedLines(),
    ['Ukupno', total([local.base, ...reverseCharged.map((detail) => detail.base)]), inputVat],
    ['Razlika PDV-a', undefined, difference],
    ['Pretplata iz prethodnih razdoblja', undefined, spec.broughtForward],
    ['Pretplata za prijenos u buduća razdoblja', undefined, total([difference, spec.broughtForward])],
  ]
  return [
    { name: 'Rekapitulacija', grid: summary },
    { name: 'Izlazni>>', grid: [] },
    ...(localSales === null ? [] : [localSales.tab]),
    salesTab,
    { name: 'Ulazni>>', grid: [] },
    local.tab,
    ...(euGoods === null ? [] : [euGoods.tab]),
    ...(eu === null ? [] : [eu.tab]),
    ...(third === null ? [] : [third.tab]),
  ]
}

/** A copy of the tabs with one cell set, by tab name, row and column from 1 as a spreadsheet numbers them. */
export function withCell(tabs: readonly DocumentTab[], tabName: string, row: number, column: number, cell: StatementCell | undefined): DocumentTab[] {
  return tabs.map((tab) => {
    if (tab.name !== tabName) return tab
    const grid = tab.grid.map((cells) => [...cells])
    while (grid.length < row) grid.push([])
    grid[row - 1]![column - 1] = cell
    return { ...tab, grid }
  })
}

export interface PaymentLine {
  readonly label: string
  readonly amount: number
}

export interface SalarySpec {
  readonly worked: string
  readonly paid: string
  /** The agreed monthly gross in euros above the director floor, or the floor itself. */
  readonly agreed: number | 'director-minimum'
  /** Tax-free payments, which the engine counts by the ruleset's key. */
  readonly nontaxable?: readonly (PaymentLine & { readonly payment: string })[]
  /** Rent and refunds of costs, which are not pay. */
  readonly outside?: readonly PaymentLine[]
  /** Days worked of the month's working days, for a part month. */
  readonly daysWorked?: number
  /** The 2025-06 layout's range down to row 1000, with blank rows below the last line. */
  readonly blankRowsBelow?: number
  /** The name the tab is titled after, Ana Primjer unless given. */
  readonly employee?: string
  /** In pillar II unless false. */
  readonly pensionPillarTwo?: boolean
  /** A director, whose salary has the floor, unless false. */
  readonly director?: boolean
  readonly dependants?: number
}

function grossNote(spec: SalarySpec): string | undefined {
  const notes = [spec.agreed === 'director-minimum' ? 'Minimalna osnovica za direktora' : null, spec.daysWorked === undefined ? null : `nije puni mjesec, ${spec.daysWorked} dana`]
  const written = notes.filter((note) => note !== null).join(', ')
  return written === '' ? undefined : written
}

/**
 * A made-up salary workbook for an employee living in Zagreb, by default in pillar II and without
 * dependants, whose every line is the payroll engine's own figure, laid out as the accountant's files are.
 */
export function salaryTabs(spec: SalarySpec): DocumentTab[] {
  const worked = month(spec.worked)
  const paidOn = civil(spec.paid)
  const workingDays = weekdaysBetween(firstDayOf(worked), lastDayOf(worked))
  const nontaxable = spec.nontaxable ?? []
  const outside = spec.outside ?? []
  const payroll = payrollMonth(
    {
      workedMonth: worked,
      paidOn,
      agreedMonthlyGross: euros(spec.agreed === 'director-minimum' ? 0 : spec.agreed),
      daysWorked: spec.daysWorked ?? workingDays,
      workingDaysInMonth: workingDays,
      nontaxablePayments: nontaxable.map((line) => ({ payment: line.payment, amount: euros(line.amount) })),
      basis: 'plan',
    },
    { residenceCity: 'Zagreb', pensionPillarTwo: spec.pensionPillarTwo ?? true, director: spec.director ?? true, dependants: spec.dependants ?? 0, birthYear: null },
  )
  const lowerRate = localRates('Zagreb', paidOn, ruleValue).lowerRate
  const outsideTotal = total(outside.map((line) => line.amount))
  const [year, monthNumber] = spec.worked.split('-').map(Number)
  const [paidYear, paidMonth, paidDay] = spec.paid.split('-').map(Number)
  const amount = (figure: TracedFigure) => amountOf(figure.amount)
  const employee = spec.employee ?? 'Ana Primjer'
  return [
    {
      name: `Obračun plaće_${employee}`,
      grid: [
        [`Plaća ${monthNumber}/${String(year).slice(2)} - datum isplate ${paidDay}.${paidMonth}.${paidYear}`],
        ['Stavka', 'Iznos', 'Napomena'],
        ['Bruto plaća II', amount(payroll.employerCost)],
        ['Zdravstveno osiguranje', amount(payroll.health)],
        ['Bruto plaća I', amount(payroll.gross), grossNote(spec)],
        ['Mirovinsko (I. stup)', amount(payroll.pensionPillarOne), 'Uz olakšicu za niske plaće'],
        ['Mirovinsko (II. stup)', amount(payroll.pensionPillarTwo)],
        ['Dohodak', amount(payroll.income)],
        ['Osobni odbitak', amount(payroll.personalAllowance)],
        ['Oporezivi dio dohotka', amount(payroll.taxableIncome)],
        ['Porez na dohodak', amount(payroll.incomeTax), `Grad Zagreb - ${(lowerRate / 100).toFixed(2).replace('.', ',')}%`],
        ['Neto plaća', amount(payroll.net)],
        ['Neoporezive isplate'],
        ...[...nontaxable, ...outside].map((line): Row => [line.label, line.amount]),
        [],
        ['Ukupni trošak', total([amount(payroll.totalCompanyCost), outsideTotal])],
        ['  - Država', amount(payroll.stateTake), 'Doprinosi i porez'],
        [`- ${employee}`, total([amount(payroll.paidToEmployee), outsideTotal]), 'Na račun'],
        ...Array.from({ length: spec.blankRowsBelow ?? 0 }, (): Row => []),
      ],
    },
  ]
}
