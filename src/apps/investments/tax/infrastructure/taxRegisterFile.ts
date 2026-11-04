import type { CellObject } from 'xlsx'

import { foreignIncomeYear } from '../domain/foreignIncome'
import type { ForeignIncomeYear, ForeignPayment, IncomeRoute } from '../domain/foreignIncome'
import type { DayRate } from '../domain/hnbRate'
import { capitalGainsYear, taxSales } from '../domain/taxYear'
import type { CapitalGainsYear, LineStatus, TaxSale } from '../domain/taxYear'
import { tradeTotal } from '../../holdings/domain/lots'
import type { Instrument } from '../../workbook/domain/instrument'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import { hr as croatianWords } from '../../workbook/domain/words'
import type { RateBook } from '../../prices/domain/rateBook'
import { civilDate, serialFromCivilDate } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { DECIMAL_ZERO, addDecimal, decimalText, subtractDecimal, sumDecimal } from '../../../../shared/money/decimal'
import type { Decimal } from '../../../../shared/money/decimal'
import { ZERO, amountOf } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { sheetJs } from '../../../../shared/xlsx/sheetGrids'

const DAY_FORMAT = 'd.m.yyyy.'
const EURO_FORMAT = '#,##0.00'

/** A text, a number shown as typed, a formatted number, or a blank. */
type Cell = string | number | CellObject | undefined

const LEDGER_HEADERS = [
  'R.br.',
  'Finan. imovina',
  'Datum',
  'Opis trans.',
  'Iznos po jedinici',
  'Količina',
  'Ukupna vrijednost',
  'Nabavna vrijednost otuđene imovine',
  'Troškovi',
  'Dobitak/gubitak (neto)',
  'Valuta',
  'Datum namire',
  'Tečaj HNB-a',
  'Dobitak/gubitak (EUR)',
]

const SALES_HEADERS = [
  'Datum prodaje',
  'Datum namire',
  'Finan. imovina',
  'Količina',
  'Datum kupnje',
  'Dana u posjedu',
  'Nabavna vrijednost',
  'Prodajna vrijednost',
  'Troškovi',
  'Dobitak/gubitak (neto)',
  'Valuta',
  'Tečaj HNB-a',
  'Dobitak/gubitak (EUR)',
  'Status',
]

const BUY = 'Kupnja'
const SALE = 'Prodaja'
const SPLIT = 'Podjela'
const SPIN_OFF = 'Izdvajanje'

const STATUSES: Readonly<Record<LineStatus, string>> = {
  taxable: 'Oporezivo',
  'tax-free': 'Bez poreza',
  loss: 'Gubitak',
  'old-loss': 'Stari gubitak, ne odbija se',
}

const ROUTES: Readonly<Record<IncomeRoute, string>> = {
  'ino-doh': 'INO-DOH',
  joppd: 'JOPPD u 30 dana',
  referral: 'Nagrada za preporuku',
  'booked-net': 'Knjiženo neto',
  none: 'Nema vlastitog poreza',
}

const YES = 'Da'
const NO = 'Ne'
const CITY_SURTAX = 'Stopa prireza vašeg grada na 14.1'
const SALES_BY_SETTLEMENT = 'Po datumu namire, ZPDoh čl. 11. st. 3.'

export function taxRegisterFileName(year: number): string {
  return `kuna-porez-${year}.xlsx`
}

function dayCell(day: CivilDate): CellObject {
  return { t: 'n', v: serialFromCivilDate(day), z: DAY_FORMAT }
}

function eurosCell(money: Money | null): Cell {
  return money === null ? undefined : { t: 'n', v: amountOf(money), z: EURO_FORMAT }
}

/** Read from the decimal's exact text, so the cell holds the nearest number to it and no float sum has moved it. */
function decimalCell(amount: Decimal): number {
  return Number(decimalText(amount))
}

/** Blank for euros and for a day with no rate. */
function rateCell(rate: DayRate): Cell {
  return rate.kind === 'hnb' ? decimalCell(rate.rate.unitsPerEuro) : undefined
}

interface LedgerEntry {
  readonly date: CivilDate
  /** Same-day order as the lots walk them: splits, spin-offs, buys, then sales. */
  readonly rank: number
  readonly order: number
  /** Every cell after R.br. */
  readonly cells: readonly Cell[]
}

/** Every buy, sale, split and spin-off of the instrument, in the order its lots took them. */
function ledgerOf(book: InvestmentBook, instrument: Instrument, sales: ReadonlyMap<RecordId, TaxSale>, names: ReadonlyMap<RecordId, string>): LedgerEntry[] {
  const trades = book.trades.flatMap((trade, order): LedgerEntry[] => {
    if (trade.instrument !== instrument.id) {
      return []
    }
    const fees = trade.fees ?? DECIMAL_ZERO
    const total = tradeTotal(trade, instrument.quoted)
    const worth = trade.side === 'buy' ? subtractDecimal(total, fees) : addDecimal(total, fees)
    const sale = trade.side === 'sell' ? sales.get(trade.id) : undefined
    return [
      {
        date: trade.date,
        rank: trade.side === 'buy' ? 3 : 5,
        order,
        cells: [
          instrument.name,
          dayCell(trade.date),
          trade.side === 'buy' ? BUY : SALE,
          decimalCell(trade.price),
          decimalCell(trade.quantity),
          decimalCell(worth),
          sale === undefined ? undefined : decimalCell(sumDecimal(sale.lines.map((line) => line.realised.costInCurrency))),
          decimalCell(fees),
          sale === undefined ? undefined : decimalCell(sale.gainInCurrency),
          instrument.currency,
          sale === undefined ? undefined : dayCell(sale.settles),
          sale === undefined ? undefined : rateCell(sale.rate),
          eurosCell(sale?.gain ?? null),
        ],
      },
    ]
  })
  const splits = book.splits.flatMap((split, order): LedgerEntry[] =>
    split.instrument === instrument.id ? [{ date: split.date, rank: 0, order, cells: [instrument.name, dayCell(split.date), `${SPLIT} ${split.newUnits}:${split.oldUnits}`] }] : [],
  )
  const spinOffs = book.spinOffs.flatMap((spinOff, order): LedgerEntry[] => {
    if (spinOff.instrument === instrument.id) {
      return [{ date: spinOff.date, rank: 1, order, cells: [instrument.name, dayCell(spinOff.date), `${SPIN_OFF} (${names.get(spinOff.received) ?? ''})`] }]
    }
    if (spinOff.received === instrument.id) {
      return [{ date: spinOff.date, rank: 1, order, cells: [instrument.name, dayCell(spinOff.date), `${SPIN_OFF} (${names.get(spinOff.instrument) ?? ''})`, undefined, decimalCell(spinOff.quantity)] }]
    }
    return []
  })
  return [...trades, ...splits, ...spinOffs].sort((earlier, later) => earlier.date.localeCompare(later.date) || earlier.rank - later.rank || earlier.order - later.order)
}

/** The full history of each instrument sold in the year, in the order of its first sale that year. */
function ledgerRows(book: InvestmentBook, rates: RateBook, gains: CapitalGainsYear): Cell[][] {
  const sales = new Map(taxSales(book, rates).map((sale) => [sale.trade.id, sale]))
  const names = new Map(book.instruments.map((instrument) => [instrument.id, instrument.name]))
  const sold = [...new Map(gains.sales.map((sale) => [sale.instrument.id, sale.instrument])).values()]
  return sold.flatMap((instrument) => ledgerOf(book, instrument, sales, names)).map((entry, index) => [index + 1, ...entry.cells])
}

function salesRows(gains: CapitalGainsYear): Cell[][] {
  return gains.sales.flatMap((sale) =>
    sale.lines.map((line) => [
      dayCell(sale.trade.date),
      dayCell(sale.settles),
      sale.instrument.name,
      decimalCell(line.realised.quantity),
      dayCell(line.realised.opened),
      line.realised.daysHeld,
      decimalCell(line.realised.costInCurrency),
      decimalCell(line.realised.proceedsInCurrency),
      decimalCell(line.realised.feesInCurrency),
      decimalCell(line.gainInCurrency),
      sale.instrument.currency,
      rateCell(sale.rate),
      eurosCell(line.gain),
      STATUSES[line.status],
    ]),
  )
}

function incomeHeaders(incomeRate: number): string[] {
  return [
    'Datum isplate',
    'Isplatitelj',
    'Država',
    'Vrsta',
    'Bruto',
    'Porez plaćen u inozemstvu',
    'Valuta',
    'Tečaj HNB-a',
    'Bruto (EUR)',
    'Porez plaćen u inozemstvu (EUR)',
    `Porez u RH ${incomeRate}% (EUR)`,
    'Priznati porez (EUR)',
    'Za uplatu (EUR)',
    'Način',
  ]
}

function incomeRow(entry: ForeignPayment): Cell[] {
  const { payment, tax } = entry
  return [
    dayCell(payment.date),
    entry.instrument?.name ?? entry.account?.name ?? '',
    entry.country ?? undefined,
    croatianWords.incomeKinds[entry.kind],
    decimalCell(payment.gross),
    decimalCell(payment.withheld),
    payment.currency,
    rateCell(entry.rate),
    eurosCell(tax?.gross ?? null),
    eurosCell(tax?.withheld ?? null),
    eurosCell(tax?.croatian ?? null),
    eurosCell(tax?.credit ?? null),
    eurosCell(tax?.leftToPay ?? null),
    ROUTES[entry.route],
  ]
}

function summaryRows(gains: CapitalGainsYear, income: ForeignIncomeYear): Cell[][] {
  return [
    ['Godina', gains.year],
    ['Prodaje se računaju u godinu', SALES_BY_SETTLEMENT],
    ['Oznaka izvješća', gains.reportMark],
    ['6.1 Oznaka stjecatelja/osiguranika', '1001'],
    ['6.2 Oznaka primitka/obveze doprinosa', '1006'],
    ['Razdoblje od', dayCell(civilDate(gains.year, 1, 1))],
    ['Razdoblje do', dayCell(civilDate(gains.year, 12, 31))],
    ['11 Primitak', eurosCell(gains.taxableGains)],
    ['13.1 Izdatak', eurosCell(gains.lossesOffset)],
    ['13.3 Dohodak', eurosCell(gains.base)],
    ['13.5 Porezna osnovica', eurosCell(gains.base)],
    [`14.1 Porez na dohodak ${gains.rules.rules.gainsRate}%`, eurosCell(gains.tax)],
    ['14.2 Prirez', gains.rules.rules.surtax ? CITY_SURTAX : eurosCell(ZERO)],
    ['Primitak s oznakom 02, imovina dulje od dvije godine', eurosCell(gains.taxFreeGains)],
    ['Gubitak na imovini dulje od dvije godine, ne odbija se', eurosCell(gains.oldLosses)],
    ['Rok za JOPPD i uplatu poreza', dayCell(gains.due)],
    ['INO-DOH bruto', eurosCell(income.inoDoh.gross)],
    ['INO-DOH porez plaćen u inozemstvu', eurosCell(income.inoDoh.withheld)],
    [`INO-DOH porez u RH ${income.rules.rules.incomeRate}%`, eurosCell(income.inoDoh.croatian)],
    ['INO-DOH priznati porez', eurosCell(income.inoDoh.credit)],
    ['INO-DOH za uplatu', eurosCell(income.inoDoh.leftToPay)],
    ['Rok za INO-DOH', dayCell(income.inoDohDue.due)],
    ['INO-DOH predati najkasnije', dayCell(income.inoDohDue.fileBy)],
    ['Rok za INO-IZJAVU', income.inoIzjavaDue === null ? undefined : dayCell(income.inoIzjavaDue)],
    ['Tečaj procijenjen', gains.estimated || income.estimated ? YES : NO],
    ['Nije uračunato jer nema tečaja HNB-a (prodaje i isplate)', gains.leftOut + income.leftOut],
  ]
}

/**
 * The year's capital gains and foreign income as xlsx bytes for the tax office, with Croatian headers whatever the
 * language on screen. Euros are worked out at HNB's rates by the tax domain. SheetJS loads only now.
 */
export async function taxRegisterFile(book: InvestmentBook, rates: RateBook, year: number): Promise<Uint8Array<ArrayBuffer>> {
  const XLSX = await sheetJs()
  const gains = capitalGainsYear(book, rates, year)
  const income = foreignIncomeYear(book, rates, year)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([LEDGER_HEADERS, ...ledgerRows(book, rates, gains)]), 'Evidencija')
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([SALES_HEADERS, ...salesRows(gains)]), `Prodaje ${year}`)
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([incomeHeaders(income.rules.rules.incomeRate), ...income.payments.map(incomeRow)]), `Inozemni dohodak ${year}`)
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(summaryRows(gains, income)), 'Sažetak')
  return new Uint8Array(XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer)
}
