import type { StatementCell } from '../../../../features/imports/domain/tabularStatement'
import { civilDateFromSerial } from '../../../../shared/calendar/civilDate'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import { ZERO, addMoney, subtractMoney, sumMoney } from '../../../../shared/money/money'
import { amountCell, labelText, gridRow, isBlankRow, readingOf, refuse } from './accountantDocument'
import type { DocumentReading, DocumentTab } from './accountantDocument'
import type { VatAmounts, VatReturn, VatSale } from './vatReturn'

const SUMMARY_TAB = 'Rekapitulacija'
const SUMMARY_HEADERS = ['Vrsta isporuke', 'Osnovica', 'PDV']
/** Empty tabs that only separate the sales tabs from the purchase tabs. */
const SEPARATOR_TABS = ['Izlazni>>', 'Ulazni>>']

interface DetailShape {
  readonly name: string
  /** The form code the total row carries in column E. */
  readonly code: string
  readonly headers: readonly string[]
}

const PURCHASE_HEADERS = ['R.b.', 'Broj računa', 'Datum', 'Dobavljač', 'PDV ID broj', 'Osnovica', 'PDV', 'Ukupno']
const SALES_OUTSIDE_EU: DetailShape = { name: 'Treće zemlje usluge I', code: 'I.5.', headers: ['R.b.', 'Broj računa', 'Datum', 'Kupac', 'Porezni broj', 'Iznos'] }
const LOCAL_PURCHASES: DetailShape = { name: 'Lokalni U', code: 'III.3.', headers: PURCHASE_HEADERS }
const EU_SERVICES: DetailShape = { name: 'EU usluge U', code: 'II.10./III.10.', headers: PURCHASE_HEADERS }
const THIRD_COUNTRY_SERVICES: DetailShape = { name: 'Treće zemlje usluge U', code: 'II.13./III.13.', headers: PURCHASE_HEADERS }
const DETAIL_TABS = [SALES_OUTSIDE_EU, LOCAL_PURCHASES, EU_SERVICES, THIRD_COUNTRY_SERVICES]

/** The words a detail tab repeats above its total row. */
const REPEATED_HEADERS = new Set(['Osnovica', 'PDV', 'Iznos', 'Ukupno'])

const COLUMN = { lineNumber: 0, invoiceNumber: 1, date: 2, code: 4, base: 5, vat: 6 } as const

type SummarySection = 'output' | 'input' | 'closing'
type SummaryLine = 'salesOutsideEu' | 'euServices' | 'thirdCountryServices' | 'localPurchases' | 'total' | 'difference' | 'broughtForward' | 'carriedForward'

const SECTION_HEADINGS: Readonly<Record<string, SummarySection>> = { 'Izlazne isporuke': 'output', 'Ulazne isporuke': 'input' }
const SECTION_NAMES: Readonly<Record<SummarySection, string>> = { output: 'Izlazne isporuke', input: 'Ulazne isporuke', closing: 'the closing lines' }
const SUMMARY_LABELS: Readonly<Record<SummarySection, Readonly<Record<string, SummaryLine>>>> = {
  output: { 'Obavljene usluge u TZ': 'salesOutsideEu', 'EU - usluge': 'euServices', 'Treće zemlje - usluge': 'thirdCountryServices', Ukupno: 'total' },
  input: { 'Lokalne isporuke': 'localPurchases', 'EU - usluge': 'euServices', 'Treće zemlje - usluge': 'thirdCountryServices', Ukupno: 'total' },
  closing: {
    'Razlika PDV-a': 'difference',
    'Pretplata iz prethodnih razdoblja': 'broughtForward',
    'Pretplata za prijenos u buduća razdoblja': 'carriedForward',
  },
}

interface SummaryEntry {
  readonly label: string
  readonly row: number
  readonly amounts: VatAmounts
}

type Summary = Readonly<Record<SummarySection, ReadonlyMap<SummaryLine, SummaryEntry>>>

interface DetailTotal {
  readonly name: string
  readonly amounts: VatAmounts
}

/**
 * A VAT return from its tabs. `Rekapitulacija` is read by its labels inside its two sections, each
 * detail tab by its header and the form code on its total row, and every summary line must equal
 * the detail tab it stands for. A tab this reader does not know is refused, so a new kind of
 * supply fails loudly instead of leaving the return short.
 */
export function readVatReturn(period: MonthKey, tabs: readonly DocumentTab[]): DocumentReading<VatReturn> {
  return readingOf(() => vatReturnOf(period, tabs))
}

function vatReturnOf(period: MonthKey, tabs: readonly DocumentTab[]): VatReturn {
  const byName = new Map(tabs.map((tab) => [labelText(tab.name), tab] as const))
  for (const [name, tab] of byName) {
    if (SEPARATOR_TABS.includes(name)) {
      if (!tab.grid.every((row) => isBlankRow(row))) refuse(name, null, 'a separator tab holds cells')
    } else if (name !== SUMMARY_TAB && !DETAIL_TABS.some((shape) => shape.name === name)) {
      refuse(name, null, 'a tab this reader does not know')
    }
  }
  const required = (name: string): DocumentTab => byName.get(name) ?? refuse(null, null, `no ${name} tab`)

  const salesTab = required(SALES_OUTSIDE_EU.name)
  const salesTotalRow = totalRowOf(salesTab, SALES_OUTSIDE_EU)
  const sales = lineRows(salesTab, salesTotalRow).map((rowIndex) => saleOf(salesTab, rowIndex))
  const salesTotal = amountCell(salesTab.name, salesTotalRow, gridRow(salesTab.grid, salesTotalRow)[COLUMN.base], 'Iznos on the total row')
  if (sumMoney(sales.map((sale) => sale.amount)) !== salesTotal) refuse(salesTab.name, salesTotalRow + 1, 'the lines do not add up to the total row')

  const local = purchaseTotal(required(LOCAL_PURCHASES.name), LOCAL_PURCHASES)
  const euTab = byName.get(EU_SERVICES.name)
  const eu = euTab === undefined ? null : purchaseTotal(euTab, EU_SERVICES)
  const thirdTab = byName.get(THIRD_COUNTRY_SERVICES.name)
  const third = thirdTab === undefined ? null : purchaseTotal(thirdTab, THIRD_COUNTRY_SERVICES)

  const summary = summaryOf(required(SUMMARY_TAB))
  const line = (section: SummarySection, key: SummaryLine): SummaryEntry | null => summary[section].get(key) ?? null
  const requiredLine = (section: SummarySection, key: SummaryLine): SummaryEntry => {
    const found = line(section, key)
    if (found !== null) return found
    const label = Object.entries(SUMMARY_LABELS[section]).find(([, candidate]) => candidate === key)?.[0] ?? key
    return refuse(SUMMARY_TAB, null, `no ${label} line in ${SECTION_NAMES[section]}`)
  }

  agrees(requiredLine('output', 'salesOutsideEu'), { name: SALES_OUTSIDE_EU.name, amounts: { base: salesTotal, vat: ZERO } }, 'base')
  agrees(requiredLine('input', 'localPurchases'), local)
  for (const [key, detail, shape] of [
    ['euServices', eu, EU_SERVICES],
    ['thirdCountryServices', third, THIRD_COUNTRY_SERVICES],
  ] as const) {
    for (const section of ['output', 'input'] as const) {
      const entry = line(section, key)
      if (entry === null && detail !== null) refuse(SUMMARY_TAB, null, `${SECTION_NAMES[section]} has no line for the ${shape.name} tab`)
      if (entry !== null && detail === null) refuse(SUMMARY_TAB, entry.row, `${entry.label} has no ${shape.name} tab behind it`)
      if (entry !== null && detail !== null) agrees(entry, detail)
    }
  }

  const outputTotal = sectionTotal(summary, 'output', requiredLine('output', 'total'))
  const inputTotal = sectionTotal(summary, 'input', requiredLine('input', 'total'))
  const difference = requiredLine('closing', 'difference')
  if (difference.amounts.vat !== subtractMoney(outputTotal.vat, inputTotal.vat)) {
    refuse(SUMMARY_TAB, difference.row, `${difference.label} is not the output VAT less the input VAT`)
  }
  const broughtForward = requiredLine('closing', 'broughtForward')
  const carriedForward = requiredLine('closing', 'carriedForward')
  if (carriedForward.amounts.vat !== addMoney(difference.amounts.vat, broughtForward.amounts.vat)) {
    refuse(SUMMARY_TAB, carriedForward.row, `${carriedForward.label} is not the difference with the overpayment brought forward`)
  }

  return {
    period,
    salesOutsideEu: sales,
    localPurchases: local.amounts,
    euServices: eu?.amounts ?? { base: ZERO, vat: ZERO },
    thirdCountryServices: third?.amounts ?? { base: ZERO, vat: ZERO },
    outputVat: outputTotal.vat,
    inputVat: inputTotal.vat,
    difference: difference.amounts.vat,
    broughtForward: broughtForward.amounts.vat,
    carriedForward: carriedForward.amounts.vat,
  }
}

function summaryOf(tab: DocumentTab): Summary {
  checkHeaders(tab, SUMMARY_HEADERS)
  const summary: Record<SummarySection, Map<SummaryLine, SummaryEntry>> = { output: new Map(), input: new Map(), closing: new Map() }
  let section: SummarySection | null = null
  for (let rowIndex = 1; rowIndex < tab.grid.length; rowIndex += 1) {
    const cells = gridRow(tab.grid, rowIndex)
    if (isBlankRow(cells)) continue
    const row = rowIndex + 1
    const label = labelText(cells[0])
    const heading = SECTION_HEADINGS[label]
    if (heading !== undefined) {
      if (section !== (heading === 'output' ? null : 'output')) refuse(tab.name, row, `${label} is out of order`)
      section = heading
      continue
    }
    if (SUMMARY_LABELS.closing[label] !== undefined) {
      if (section !== 'input' && section !== 'closing') refuse(tab.name, row, `${label} comes before Ulazne isporuke`)
      section = 'closing'
    }
    if (section === null) refuse(tab.name, row, `${label === '' ? 'a line without a label' : label} comes before Izlazne isporuke`)
    const key = SUMMARY_LABELS[section][label]
    if (key === undefined) refuse(tab.name, row, label === '' ? 'a line without a label' : `${label} is not a line of ${SECTION_NAMES[section]}`)
    if (summary[section].has(key)) refuse(tab.name, row, `${label} is in ${SECTION_NAMES[section]} twice`)
    summary[section].set(key, {
      label,
      row,
      amounts: {
        base: amountCell(tab.name, rowIndex, cells[1], `the base of ${label}`, ZERO),
        vat: amountCell(tab.name, rowIndex, cells[2], `the VAT of ${label}`, ZERO),
      },
    })
  }
  return summary
}

/** The section's Ukupno, refused unless it adds up the section's lines. */
function sectionTotal(summary: Summary, section: 'output' | 'input', total: SummaryEntry): VatAmounts {
  const lines = [...summary[section].entries()].filter(([key]) => key !== 'total').map(([, entry]) => entry.amounts)
  const base = sumMoney(lines.map((amounts) => amounts.base))
  const vat = sumMoney(lines.map((amounts) => amounts.vat))
  if (total.amounts.base !== base || total.amounts.vat !== vat) refuse(SUMMARY_TAB, total.row, `Ukupno in ${SECTION_NAMES[section]} does not add up its lines`)
  return total.amounts
}

function agrees(entry: SummaryEntry, detail: DetailTotal, compared: 'base' | 'both' = 'both'): void {
  if (entry.amounts.base !== detail.amounts.base) refuse(SUMMARY_TAB, entry.row, `the base of ${entry.label} differs from the total of ${detail.name}`)
  if (compared === 'both' && entry.amounts.vat !== detail.amounts.vat) refuse(SUMMARY_TAB, entry.row, `the VAT of ${entry.label} differs from the total of ${detail.name}`)
}

function purchaseTotal(tab: DocumentTab, shape: DetailShape): DetailTotal {
  const totalRow = totalRowOf(tab, shape)
  const lines = lineRows(tab, totalRow).map((rowIndex) => purchaseAmounts(tab, rowIndex, 'on the line'))
  const total = purchaseAmounts(tab, totalRow, 'on the total row')
  if (sumMoney(lines.map((amounts) => amounts.base)) !== total.base || sumMoney(lines.map((amounts) => amounts.vat)) !== total.vat) {
    refuse(tab.name, totalRow + 1, 'the lines do not add up to the total row')
  }
  return { name: tab.name, amounts: total }
}

function purchaseAmounts(tab: DocumentTab, rowIndex: number, where: string): VatAmounts {
  const cells = gridRow(tab.grid, rowIndex)
  return {
    base: amountCell(tab.name, rowIndex, cells[COLUMN.base], `Osnovica ${where}`),
    vat: amountCell(tab.name, rowIndex, cells[COLUMN.vat], `PDV ${where}`),
  }
}

function saleOf(tab: DocumentTab, rowIndex: number): VatSale {
  const cells = gridRow(tab.grid, rowIndex)
  const invoiceNumber = labelText(cells[COLUMN.invoiceNumber])
  if (invoiceNumber === '') refuse(tab.name, rowIndex + 1, 'a line without Broj računa')
  const date = cells[COLUMN.date]
  if (typeof date !== 'number') return refuse(tab.name, rowIndex + 1, 'Datum is not a date')
  return { invoiceNumber, issued: civilDateFromSerial(date), amount: amountCell(tab.name, rowIndex, cells[COLUMN.base], 'Iznos') }
}

/** The row index of the total, found by the form code in column E, after the header and checking it. */
function totalRowOf(tab: DocumentTab, shape: DetailShape): number {
  checkHeaders(tab, shape.headers)
  const rowIndex = tab.grid.findIndex((cells, index) => index > 0 && labelText(cells[COLUMN.code]) === shape.code)
  return rowIndex < 0 ? refuse(tab.name, null, `no total row with ${shape.code} in column E`) : rowIndex
}

/**
 * The row indexes of the lines above the total row: each starts with its number, as text such as
 * `1.` or as a number. Blank rows and the headers repeated above the total are passed over.
 */
function lineRows(tab: DocumentTab, totalRow: number): number[] {
  const lines: number[] = []
  for (let rowIndex = 1; rowIndex < totalRow; rowIndex += 1) {
    const cells = gridRow(tab.grid, rowIndex)
    if (isLineNumber(cells[COLUMN.lineNumber])) {
      lines.push(rowIndex)
    } else if (!cells.every((cell) => labelText(cell) === '' || REPEATED_HEADERS.has(labelText(cell)))) {
      refuse(tab.name, rowIndex + 1, 'a row that is neither a line nor the total')
    }
  }
  return lines
}

function isLineNumber(cell: StatementCell | undefined): boolean {
  return typeof cell === 'number' ? Number.isInteger(cell) && cell > 0 : /^\d+\.?$/.test(labelText(cell))
}

function checkHeaders(tab: DocumentTab, headers: readonly string[]): void {
  const found = gridRow(tab.grid, 0).map(labelText)
  if (headers.some((header, column) => found[column] !== header)) refuse(tab.name, 1, `the header is not ${headers.join(', ')}`)
}
