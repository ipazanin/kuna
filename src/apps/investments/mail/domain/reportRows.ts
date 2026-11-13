import type { WorkbookRows } from '../../imports/domain/importDryRun'
import { WORKBOOK_TYPES } from '../../imports/domain/portfolioWorkbook'
import type { WorkbookRow, WorkbookType } from '../../imports/domain/portfolioWorkbook'
import { reportRowKey } from '../../imports/domain/reportKey'
import type { MailReader } from '../../workbook/domain/mailReader'
import { words } from './words'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import { DECIMAL_ZERO, addDecimal, magnitude, negateDecimal, roundedDecimal, subtractDecimal } from '../../../../shared/money/decimal'
import type { Decimal } from '../../../../shared/money/decimal'
import type { Recipe } from '../../../../shared/recipes/domain/recipe'
import type { AskedRow, RecipeRow, RecipeRun } from '../../../../shared/recipes/domain/runRecipe'

/** A recipe's run over one file, under the file's name. */
export interface ReportFile {
  readonly fileName: string
  readonly run: Extract<RecipeRun, { kind: 'read' }>
}

const CENT_PLACES = 2

function cents(amount: Decimal | null | undefined): Decimal | null {
  return amount === null || amount === undefined ? null : roundedDecimal(amount, CENT_PLACES)
}

type UnnumberedRow = Omit<WorkbookRow, 'fileRow'>

function rowOf(recipe: Recipe, row: RecipeRow, fileName: string, type: WorkbookType, date: CivilDate): UnnumberedRow {
  const amount = cents(row.decimals.amount)
  return {
    date,
    time: row.texts.time ?? '',
    broker: words.broker,
    account: row.texts.account ?? '',
    type,
    yahooSymbol: '',
    brokerSymbol: row.texts.symbol ?? '',
    isin: (row.texts.isin ?? '').toUpperCase(),
    quantity: row.decimals.quantity ?? null,
    price: row.decimals.price ?? null,
    currency: row.currencies.currency ?? null,
    gross: type === 'DIVIDEND' || type === 'INTEREST' ? amount : null,
    commission: null,
    netCash: cents(row.decimals.netCash) ?? (type === 'DIVIDEND' || type === 'INTEREST' ? null : amount),
    counterCurrency: null,
    counterAmount: null,
    revolutRate: null,
    note: '',
    sourceFile: fileName,
    spinOffFrom: '',
    costShare: null,
    costShareUnclear: null,
    costShareText: '',
    key: reportRowKey(recipe.id, row.texts.account ?? '', row.texts.key ?? ''),
    name: row.texts.name ?? '',
    actionId: row.texts.actionId ?? null,
    commissionCurrency: null,
    dividend:
      type === 'DIVIDEND'
        ? { exDate: row.dates.exDate ?? null, payDate: row.dates.payDate ?? null, sourceCountry: row.texts.sourceCountry ?? null, dividendType: row.texts.dividendType ?? null }
        : null,
    settles: row.dates.settles ?? null,
  }
}

/** A commission charged in a currency the row's amounts are not in, as its own fee, since neither its trade nor its exchange can hold it. */
function commissionFee(trade: UnnumberedRow, commission: Decimal, currency: CurrencyCode): UnnumberedRow {
  return {
    ...trade,
    type: 'FEE',
    isin: '',
    brokerSymbol: '',
    name: '',
    quantity: null,
    price: null,
    currency,
    netCash: negateDecimal(commission),
    note: words.commissionOf(trade.brokerSymbol),
    key: `${trade.key}-commission`,
  }
}

/** A buy or a sale: a commission in its own currency is inside its net cash, and one in another is a fee of its own. */
function tradeRows(row: RecipeRow, base: UnnumberedRow): UnnumberedRow[] {
  const commission = cents(magnitude(row.decimals.commission ?? DECIMAL_ZERO))!
  const currency = row.currencies.commissionCurrency ?? base.currency
  if (commission === DECIMAL_ZERO || currency === base.currency || currency === null) {
    return [{ ...base, commission: commission === DECIMAL_ZERO ? null : commission }]
  }
  return [base, commissionFee(base, commission, currency)]
}

/**
 * A conversion's net cash is the leg in the row's currency, and its quantity the leg in the other. A commission in the row's
 * currency is inside its net cash, one in the other currency comes off that leg, and one in a third is a fee of its own.
 */
function exchangeRows(row: RecipeRow, base: UnnumberedRow): UnnumberedRow[] {
  const quantity = row.decimals.quantity!
  const counterCurrency = row.currencies.counterCurrency ?? null
  const commission = cents(magnitude(row.decimals.commission ?? DECIMAL_ZERO))!
  const currency = row.currencies.commissionCurrency ?? base.currency
  const counterBooked =
    commission !== DECIMAL_ZERO && currency === counterCurrency ? (quantity > DECIMAL_ZERO ? subtractDecimal(quantity, commission) : addDecimal(magnitude(quantity), commission)) : magnitude(quantity)
  const exchange = { ...base, quantity: null, price: null, counterCurrency, counterAmount: cents(magnitude(counterBooked)) }
  if (commission === DECIMAL_ZERO) return [exchange]
  if (currency === base.currency || currency === counterCurrency) return [{ ...exchange, commission, commissionCurrency: currency }]
  return currency === null ? [exchange] : [exchange, commissionFee(exchange, commission, currency)]
}

function rowsOf(recipe: Recipe, row: RecipeRow, fileName: string): UnnumberedRow[] {
  const type = WORKBOOK_TYPES.find((known) => known === row.kind)
  const date = row.dates.date
  if (type === undefined || date === null || date === undefined) {
    throw new Error(words.recipeKindUnknown(recipe.name, row.kind))
  }
  const base = rowOf(recipe, row, fileName, type, date)
  if (type === 'BUY' || type === 'SELL') return tradeRows(row, base)
  return type === 'FX' ? exchangeRows(row, base) : [base]
}

/** Whether a row asked about is dated before the day. One whose date cannot be read is asked about all the same. */
function askedBefore(row: AskedRow, since: CivilDate): boolean {
  const date = row.dates.date
  return date !== null && date !== undefined && date < since
}

/** Where the rows of a report came from: the mail, from the earliest start day of the accounts it fills, or a file the person uploaded. */
export type ReportSource = { readonly kind: 'mailed'; readonly since: CivilDate | null } | { readonly kind: 'uploaded' }

/**
 * The rows every file of a rolling report gives, for the dry run, which leaves out a mailed report's rows of each account
 * before its start day. Files overlap, so a row is kept once by its key, as the newest file writes it. A row a later file
 * writes differently is asked about, since one of the two is wrong and the report does not say which. A question names no
 * account, so a mailed one dated before the earliest start day is left out, and so is a question the person said to stop
 * asking. Each file's asked rows come with it, and the amounts are rounded to the cent, without listing each as rounded,
 * since a broker's fractions of a cent are the usual thing.
 */
export function reportRows(recipe: Recipe, files: readonly ReportFile[], reader: Pick<MailReader, 'leftOut'>, source: ReportSource): WorkbookRows {
  const rows = new Map<string, UnnumberedRow>()
  const factsOf = new Map<string, string>()
  const changed = new Map<string, string>()
  const asked = new Map<string, AskedRow>()
  for (const { fileName, run } of files) {
    for (const row of run.rows) {
      for (const made of rowsOf(recipe, row, fileName)) {
        const facts = factsOf.get(made.key)
        if (facts !== undefined && facts !== row.facts) changed.set(made.key, row.section)
        factsOf.set(made.key, row.facts)
        rows.set(made.key, made)
      }
    }
    run.asked.forEach((row) => asked.set(row.key, row))
  }
  const since = source.kind === 'mailed' ? source.since : null
  const askedInPeriod = [...asked.values()].filter((row) => since === null || !askedBefore(row, since))
  const changedRows = [...rows.values()].flatMap((row): AskedRow[] => {
    const section = changed.get(row.key)
    return section === undefined
      ? []
      : [
          {
            key: row.key,
            section,
            shown: [
              ['date', row.date],
              ['symbol', row.brokerSymbol],
            ],
            dates: { date: row.date },
            why: { kind: 'changed' },
          },
        ]
  })
  return {
    rows: [...rows.values()].filter((row) => !changed.has(row.key)).map((row, index) => ({ ...row, fileRow: index + 1 })),
    skipped: [],
    rounded: [],
    report: {
      mailed: source.kind === 'mailed',
      asked: [...askedInPeriod, ...changedRows].filter((row) => !reader.leftOut.includes(row.key)),
      beforeStart: asked.size - askedInPeriod.length,
      byHand: 0,
    },
  }
}

/**
 * The rows of one report the person uploaded, which counts as by hand. No start day applies, so every row not already in
 * Kuna counts, and only the questions the person said to stop asking are left out.
 */
export function uploadedReportRows(recipe: Recipe, file: ReportFile, reader: Pick<MailReader, 'leftOut'> | null): WorkbookRows {
  return reportRows(recipe, [file], { leftOut: reader?.leftOut ?? [] }, { kind: 'uploaded' })
}
