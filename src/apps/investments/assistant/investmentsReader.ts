import { HOLDING_ROUTE } from '../holdings/presentation/holdingLinks'
import type { PortfolioSources } from '../holdings/domain/holding'
import { portfolioFigures } from '../holdings/domain/portfolioFigures'
import { incomeByYear } from '../income/domain/incomeHistory'
import { recordsOn } from '../performance/domain/portfolioPerformance'
import { foreignIncomeYear } from '../tax/domain/foreignIncome'
import type { IncomeTax } from '../tax/domain/foreignIncome'
import { capitalGainsYear, taxYearsOf } from '../tax/domain/taxYear'
import type { CashMovement } from '../workbook/domain/cashMovement'
import type { CheckSetting } from '../workbook/domain/checkSetting'
import type { Exchange } from '../workbook/domain/exchange'
import type { FundMixLine } from '../workbook/domain/fundMix'
import type { HandPrice } from '../workbook/domain/handPrice'
import type { Income } from '../workbook/domain/income'
import type { Instrument, Quoting } from '../workbook/domain/instrument'
import type { InvestmentAccount } from '../workbook/domain/investmentAccount'
import type { InvestmentBook } from '../workbook/domain/investmentBook'
import {
  CASH_MOVEMENT_RECORDS,
  CHECK_RECORDS,
  EXCHANGE_RECORDS,
  FUND_MIX_RECORDS,
  INCOME_RECORDS,
  INSTRUMENT_RECORDS,
  INVESTMENT_ACCOUNT_RECORDS,
  PRICE_RECORDS,
  SETTING_RECORDS,
  SPIN_OFF_RECORDS,
  SPLIT_RECORDS,
  TARGET_RECORDS,
  TRADE_RECORDS,
  TRANSFER_RECORDS,
} from '../workbook/domain/investmentKinds'
import type { MixGroup } from '../workbook/domain/mixGroup'
import type { SpinOff } from '../workbook/domain/spinOff'
import type { Split } from '../workbook/domain/split'
import type { Target } from '../workbook/domain/target'
import type { Trade } from '../workbook/domain/trade'
import type { Transfer } from '../workbook/domain/transfer'
import { readableKind } from '../../../shared/app/assistantReader'
import type { AppReader, ReportFigure } from '../../../shared/app/assistantReader'
import { parseCivilDate, yearOf } from '../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../shared/calendar/civilDate'
import { parseMonthKey, yearOfMonth } from '../../../shared/calendar/monthKey'
import { EURO } from '../../../shared/money/currencyCode'
import type { CurrencyCode } from '../../../shared/money/currencyCode'
import { DECIMAL_ZERO, decimalText } from '../../../shared/money/decimal'
import type { Decimal } from '../../../shared/money/decimal'
import type { Money } from '../../../shared/money/money'
import { nearestBasisPoints, pointsOfShare } from '../../../shared/money/percent'
import type { Share } from '../../../shared/money/percent'
import type { FieldDocs } from '../../../shared/privacy/domain/exposure'
import type { SettingRow } from '../../../shared/storage/domain/settingRows'
import { words } from './words'

/** What the reader reads from, which `app.ts` hands in over the app's own store and prices, so this folder holds no store. */
export interface InvestmentsReading {
  status(): ReturnType<AppReader['status']>
  book(): InvestmentBook | null
  /** The book with its prices and rates, on today's day in Zagreb, or null while either is being read. */
  sources(): PortfolioSources | null
  /** Whether the owner told Kuna the file holds every buy, which the Tax screen waits for before it shows a figure. */
  taxShown(): boolean
}

/** A decimal as the file stores it, with its currency, so `12.5 USD` reads the same in every language. */
function amountIn(value: Decimal, currency: string): string {
  return `${decimalText(value)} ${currency}`
}

function decimalOrNull(value: Decimal | null): string | null {
  return value === null ? null : decimalText(value)
}

/** Units of the currency per euro, as the record keeps it. */
function rateIn(rate: Decimal | null, currency: string): string | null {
  return rate === null ? null : `${decimalText(rate)} ${currency} per EUR`
}

function quotingText(quoted: Quoting): string {
  switch (quoted.kind) {
    case 'unit':
      return 'per unit'
    case 'gram':
      return 'per gram, closes per troy ounce'
    case 'percent':
      return `in percent of the nominal, coupon ${decimalText(quoted.coupon)}% a year, matures ${quoted.maturity}`
  }
}

/** The fields of every kind, which read an instrument's currency and an account's name from the book on screen. */
function fieldsOf(book: () => InvestmentBook | null) {
  const currencyOf = (instrument: string | null): string => book()?.instruments.find((candidate) => candidate.id === instrument)?.currency ?? EURO
  const accountName = (account: string): string => book()?.accounts.find((candidate) => candidate.id === account)?.name ?? ''
  const sliceText = (slice: MixGroup): string => `${slice.mix}: ${slice.mix === 'account' ? accountName(slice.group) : slice.group}`

  const account: FieldDocs<InvestmentAccount> = {
    id: { exposure: 'ref', to: INVESTMENT_ACCOUNT_RECORDS.name, meaning: 'The account at a broker.' },
    name: { exposure: 'plain', meaning: 'The name the owner gave it.' },
    note: { exposure: 'free-text', meaning: "The owner's note." },
  }
  const instrument: FieldDocs<Instrument> = {
    id: { exposure: 'ref', to: INSTRUMENT_RECORDS.name, meaning: 'The instrument, a holding once any of it is held.' },
    name: { exposure: 'plain', meaning: 'Its name.' },
    type: { exposure: 'plain', meaning: 'share, fund, bond, gold, crypto, or null until typed.' },
    class: { exposure: 'plain', meaning: 'What it holds: stocks, bonds, money-market, crypto or gold.' },
    isin: { exposure: 'plain', meaning: "The security's ISIN, or null." },
    symbol: { exposure: 'plain', meaning: 'Its ticker.' },
    exchange: { exposure: 'plain', meaning: 'The market identifier code of its listing, such as XETR, or null.' },
    currency: { exposure: 'plain', meaning: 'Its quote currency, which its trades, hand prices and dividends are in.' },
    quoted: { exposure: 'plain', meaning: 'How its price reads.', read: (record) => quotingText(record.quoted) },
    prices: { exposure: 'plain', meaning: 'Where its daily closes come from: twelvedata, alphavantage, or manual for prices typed by hand.' },
    sourceSymbol: { exposure: 'plain', meaning: 'Its symbol at the price vendor.' },
    benchmark: { exposure: 'plain', meaning: 'Performance compares the portfolio with it.' },
    sector: { exposure: 'plain', meaning: 'A GICS sector typed by hand, or null.' },
    country: { exposure: 'plain', meaning: 'A country code or a region typed by hand, or null.' },
    ter: { exposure: 'plain', meaning: "A fund's yearly cost in percent, so 0.2 is 0.20% a year.", read: (record) => decimalOrNull(record.ter) },
    distribution: { exposure: 'plain', meaning: "A fund's dividends: accumulating or distributing, or null." },
    note: { exposure: 'free-text', meaning: "The owner's note." },
  }
  const trade: FieldDocs<Trade> = {
    id: { exposure: 'ref', to: TRADE_RECORDS.name, meaning: 'The trade.' },
    account: { exposure: 'ref', to: INVESTMENT_ACCOUNT_RECORDS.name, meaning: 'The account it was in.' },
    instrument: { exposure: 'ref', to: INSTRUMENT_RECORDS.name, meaning: 'What was bought or sold.' },
    side: { exposure: 'plain', meaning: 'buy or sell.' },
    date: { exposure: 'plain', meaning: 'The trade day.' },
    quantity: { exposure: 'plain', meaning: 'Units, grams or a bond nominal, above zero.', read: (record) => decimalText(record.quantity) },
    price: { exposure: 'plain', meaning: 'The price per unit in the quote currency, or in percent for a bond.', read: (record) => amountIn(record.price, currencyOf(record.instrument)) },
    fees: { exposure: 'plain', meaning: 'The broker fees, or null when not entered.', read: (record) => (record.fees === null ? null : amountIn(record.fees, currencyOf(record.instrument))) },
    rate: { exposure: 'plain', meaning: 'The rate the trade converts to euros at, or null for euros.', read: (record) => rateIn(record.rate, currencyOf(record.instrument)) },
    accrued: {
      exposure: 'plain',
      meaning: "A bond's accrued interest paid or received, or null.",
      read: (record) => (record.accrued === null ? null : amountIn(record.accrued, currencyOf(record.instrument))),
    },
    importKey: { exposure: 'never', meaning: 'What names the imported rows it came from.' },
    note: { exposure: 'free-text', meaning: "The owner's note." },
  }
  const income: FieldDocs<Income> = {
    id: { exposure: 'ref', to: INCOME_RECORDS.name, meaning: 'The payment.' },
    account: { exposure: 'ref', to: INVESTMENT_ACCOUNT_RECORDS.name, meaning: 'The account it was paid into.' },
    kind: { exposure: 'plain', meaning: 'dividend, coupon, interest, lending, referral or other.' },
    instrument: { exposure: 'ref', to: INSTRUMENT_RECORDS.name, meaning: 'What paid it, which a dividend and a coupon name.' },
    date: { exposure: 'plain', meaning: 'The day it was paid.' },
    currency: { exposure: 'plain', meaning: 'Its currency.' },
    gross: { exposure: 'plain', meaning: 'Before the tax withheld. Below zero for a reversal.', read: (record) => amountIn(record.gross, record.currency) },
    withheld: { exposure: 'plain', meaning: 'The tax withheld at source.', read: (record) => amountIn(record.withheld, record.currency) },
    rate: { exposure: 'plain', meaning: 'The rate it converts to euros at, or null for euros.', read: (record) => rateIn(record.rate, record.currency) },
    importKey: { exposure: 'never', meaning: 'What names the imported rows it came from.' },
    note: { exposure: 'free-text', meaning: "The owner's note, or the broker's words for an imported one." },
    dividend: {
      exposure: 'plain',
      meaning: "What a broker's report said of a dividend: ex-date, pay date, source country and type.",
      read: (record) => (record.dividend === undefined ? null : JSON.stringify(record.dividend)),
    },
  }
  const cashMovement: FieldDocs<CashMovement> = {
    id: { exposure: 'ref', to: CASH_MOVEMENT_RECORDS.name, meaning: 'The cash movement.' },
    account: { exposure: 'ref', to: INVESTMENT_ACCOUNT_RECORDS.name, meaning: 'The account.' },
    kind: { exposure: 'plain', meaning: 'deposit, withdrawal, fee or fee-refund.' },
    date: { exposure: 'plain', meaning: 'The day.' },
    currency: { exposure: 'plain', meaning: 'Its currency.' },
    amount: { exposure: 'plain', meaning: 'Above zero. The kind gives its direction.', read: (record) => amountIn(record.amount, record.currency) },
    rate: { exposure: 'plain', meaning: 'The rate it converts to euros at, or null for euros.', read: (record) => rateIn(record.rate, record.currency) },
    importKey: { exposure: 'never', meaning: 'What names the imported rows it came from.' },
    note: { exposure: 'free-text', meaning: "The owner's note." },
  }
  const exchange: FieldDocs<Exchange> = {
    id: { exposure: 'ref', to: EXCHANGE_RECORDS.name, meaning: 'The exchange.' },
    account: { exposure: 'ref', to: INVESTMENT_ACCOUNT_RECORDS.name, meaning: 'The account.' },
    date: { exposure: 'plain', meaning: 'The day.' },
    sold: { exposure: 'plain', meaning: 'What was sold, after fees.', read: (record) => amountIn(record.sold, record.soldCurrency) },
    soldCurrency: { exposure: 'plain', meaning: 'The currency sold.' },
    bought: { exposure: 'plain', meaning: 'What was bought, after fees.', read: (record) => amountIn(record.bought, record.boughtCurrency) },
    boughtCurrency: { exposure: 'plain', meaning: 'The currency bought.' },
    fees: {
      exposure: 'plain',
      meaning: 'What the exchange charged, already inside the amounts, or null.',
      read: (record) => (record.fees === null ? null : amountIn(record.fees.amount, record.fees.currency)),
    },
    importKey: { exposure: 'never', meaning: 'What names the imported rows it came from.' },
    note: { exposure: 'free-text', meaning: "The owner's note." },
  }
  const transfer: FieldDocs<Transfer> = {
    id: { exposure: 'ref', to: TRANSFER_RECORDS.name, meaning: 'The transfer.' },
    from: { exposure: 'ref', to: INVESTMENT_ACCOUNT_RECORDS.name, meaning: 'The account it left.' },
    to: { exposure: 'ref', to: INVESTMENT_ACCOUNT_RECORDS.name, meaning: 'The account it reached.' },
    date: { exposure: 'plain', meaning: 'The day.' },
    moved: {
      exposure: 'plain',
      meaning: 'Units of an instrument, by its name, or cash in a currency.',
      read: ({ moved }) =>
        moved.kind === 'units'
          ? `${decimalText(moved.quantity)} units of ${book()?.instruments.find((candidate) => candidate.id === moved.instrument)?.name ?? ''}`
          : amountIn(moved.amount, moved.currency),
    },
    importKey: { exposure: 'never', meaning: 'What names the imported rows it came from.' },
    note: { exposure: 'free-text', meaning: "The owner's note." },
  }
  const split: FieldDocs<Split> = {
    id: { exposure: 'ref', to: SPLIT_RECORDS.name, meaning: 'The split.' },
    instrument: { exposure: 'ref', to: INSTRUMENT_RECORDS.name, meaning: 'What split.' },
    date: { exposure: 'plain', meaning: 'The day.' },
    newUnits: { exposure: 'plain', meaning: 'The units after, for every oldUnits before.' },
    oldUnits: { exposure: 'plain', meaning: 'The units before.' },
    importKey: { exposure: 'never', meaning: 'What names the imported rows it came from.' },
    note: { exposure: 'free-text', meaning: "The owner's note." },
  }
  const spinOff: FieldDocs<SpinOff> = {
    id: { exposure: 'ref', to: SPIN_OFF_RECORDS.name, meaning: 'The spin-off.' },
    instrument: { exposure: 'ref', to: INSTRUMENT_RECORDS.name, meaning: 'The parent held.' },
    received: { exposure: 'ref', to: INSTRUMENT_RECORDS.name, meaning: 'The instrument received.' },
    date: { exposure: 'plain', meaning: 'The day.' },
    quantity: { exposure: 'plain', meaning: 'The units received.', read: (record) => decimalText(record.quantity) },
    costShare: { exposure: 'plain', meaning: "The fraction of the parent's cost that moves to them, from 0 to 1.", read: (record) => decimalText(record.costShare) },
    importKey: { exposure: 'never', meaning: 'What names the imported rows it came from.' },
    note: { exposure: 'free-text', meaning: "The owner's note." },
  }
  const price: FieldDocs<HandPrice> = {
    id: { exposure: 'ref', to: PRICE_RECORDS.name, meaning: 'The price.' },
    instrument: { exposure: 'ref', to: INSTRUMENT_RECORDS.name, meaning: 'The instrument.' },
    date: { exposure: 'plain', meaning: 'The day it closed at it.' },
    price: { exposure: 'plain', meaning: 'The close in the quote currency.', read: (record) => amountIn(record.price, currencyOf(record.instrument)) },
    note: { exposure: 'free-text', meaning: "The owner's note." },
  }
  const fundMix: FieldDocs<FundMixLine> = {
    id: { exposure: 'ref', to: FUND_MIX_RECORDS.name, meaning: 'The line.' },
    instrument: { exposure: 'ref', to: INSTRUMENT_RECORDS.name, meaning: 'The fund.' },
    slice: { exposure: 'plain', meaning: 'Its mix and group, such as sector: financials or country: US.', read: (record) => sliceText(record.slice) },
    percent: { exposure: 'plain', meaning: 'Its percent of the fund, so 62.5 is 62.5%.', read: (record) => decimalText(record.percent) },
  }
  const target: FieldDocs<Target> = {
    id: { exposure: 'ref', to: TARGET_RECORDS.name, meaning: 'The target.' },
    slice: { exposure: 'plain', meaning: 'Its mix and group, an account by its name.', read: (record) => sliceText(record.slice) },
    percent: { exposure: 'plain', meaning: 'The percent of the value it should hold.', read: (record) => decimalText(record.percent) },
  }
  const check: FieldDocs<CheckSetting> = {
    id: { exposure: 'ref', to: CHECK_RECORDS.name, meaning: 'The changed check.' },
    check: { exposure: 'plain', meaning: 'holding, currency, sector, country, account, cash, costs or target-gap.' },
    threshold: { exposure: 'plain', meaning: 'Its threshold in percent, the target gap in points, or null for the default.', read: (record) => decimalOrNull(record.threshold) },
    off: { exposure: 'plain', meaning: 'Switched off.' },
  }
  const setting: FieldDocs<SettingRow> = {
    id: { exposure: 'ref', to: SETTING_RECORDS.name, meaning: 'The setting.' },
    key: { exposure: 'plain', meaning: 'Its key.' },
    value: { exposure: 'plain', meaning: "Its value. surtax_city_2023 is a code of Porezna's 2023 surtax table." },
  }
  return { account, instrument, trade, income, cashMovement, exchange, transfer, split, spinOff, price, fundMix, target, check, setting, currencyOf }
}

function euros(label: string, cents: Money): ReportFigure {
  return { label, of: 'app', cents, currency: EURO }
}

function basisPoints(label: string, share: Share | null): ReportFigure[] {
  return share === null ? [] : [{ label, basisPoints: nearestBasisPoints(pointsOfShare(share)) }]
}

/** The sources of a day: today's for null, the records up to a past day for that day, and none for a day after the figures' own. */
function sourcesOn(sources: PortfolioSources, period: string | null): PortfolioSources | null {
  if (period === null) return sources
  const day = parseCivilDate(period)
  if (day === null) throw new RangeError('Not a day.')
  if (day > sources.today) return null
  return day === sources.today ? sources : { ...sources, book: recordsOn(sources.book, day), today: day }
}

function yearOfPeriod(period: string | null, today: CivilDate): number {
  if (period === null) return yearOf(today)
  const month = parseMonthKey(period)
  if (month === null) throw new RangeError('Not a month.')
  return yearOfMonth(month)
}

function portfolioReport(sources: PortfolioSources, period: string | null): readonly ReportFigure[] {
  const day = sourcesOn(sources, period)
  if (day === null) return []
  const figures = portfolioFigures(day)
  return [
    euros('value', figures.value),
    euros('put in, deposits less withdrawals', figures.putIn),
    euros('cost of what is held', figures.cost),
    euros('unrealised gain', figures.unrealised),
    euros('realised gain', figures.realised),
    euros('income received after tax withheld', figures.income.received),
    euros('tax withheld from income', figures.income.withheld),
    euros('account fees less refunds', figures.accountFees),
    euros('currency gain on cash', figures.currencyOnCash),
    euros('total gain', figures.totalGain),
    ...basisPoints('total gain over what was put in', figures.totalGainShare),
    ...basisPoints('money-weighted return a year', figures.yearlyReturn.kind === 'rate' ? figures.yearlyReturn.rate : null),
    euros('trading and exchange fees, already inside costs and proceeds', figures.feesPaid),
    { label: 'holdings left out of the value for having no price or no rate', count: figures.unpriced.length },
    { label: 'cash balances left out of the value for having no rate', count: figures.unratedCash.length },
  ]
}

function holdingsReport(sources: PortfolioSources, period: string | null): readonly ReportFigure[] {
  const day = sourcesOn(sources, period)
  if (day === null) return []
  const figures = portfolioFigures(day)
  const accounts = new Map(day.book.accounts.map((account) => [account.id, account.name]))
  const held = figures.holdings.flatMap(({ instrument: { name }, valuation, cost, unrealised, realised, income, weight, quantity }) =>
    quantity <= DECIMAL_ZERO
      ? []
      : [
          ...(valuation === null ? [] : [euros(`${name}: value`, valuation.value)]),
          euros(`${name}: cost`, cost),
          ...(unrealised === null ? [] : [euros(`${name}: unrealised gain`, unrealised)]),
          euros(`${name}: realised gain`, realised),
          euros(`${name}: income received`, income),
          ...basisPoints(`${name}: weight in the value`, weight),
        ],
  )
  const cash = figures.cash.flatMap((balance) => (balance.value === null ? [] : [euros(`${accounts.get(balance.account) ?? ''}: cash in ${balance.currency}`, balance.value)]))
  return [...held, ...cash]
}

function incomeReport(sources: PortfolioSources, period: string | null): readonly ReportFigure[] {
  const year = yearOfPeriod(period, sources.today)
  const of = incomeByYear(sources.book, sources.today).find((entry) => entry.year === year)
  if (of === undefined) return []
  return [
    ...of.groups.flatMap(({ group, gross, withheld, received }) => [euros(`${group}: gross`, gross), euros(`${group}: withheld`, withheld), euros(`${group}: received`, received)]),
    euros('all income: gross', of.total.gross),
    euros('all income: withheld', of.total.withheld),
    euros('all income: received', of.total.received),
  ]
}

function incomeTax(label: string, tax: IncomeTax): readonly ReportFigure[] {
  return [
    euros(`${label}: gross`, tax.gross),
    euros(`${label}: withheld abroad`, tax.withheld),
    euros(`${label}: Croatian tax`, tax.croatian),
    euros(`${label}: credit for tax withheld abroad`, tax.credit),
    euros(`${label}: left to pay`, tax.leftToPay),
  ]
}

function taxReport(sources: PortfolioSources, period: string | null, shown: boolean): readonly ReportFigure[] {
  const year = yearOfPeriod(period, sources.today)
  if (!shown || !taxYearsOf(sources.book, sources.today).includes(year)) return []
  const gains = capitalGainsYear(sources.book, sources.rates, year)
  const foreign = foreignIncomeYear(sources.book, sources.rates, year)
  return [
    euros('gains on lots held under two years', gains.taxableGains),
    euros('losses on lots held under two years', gains.losses),
    euros('losses offset against the gains', gains.lossesOffset),
    euros('tax base', gains.base),
    euros('capital gains tax', gains.tax),
    ...(gains.surtax.kind === 'due' ? [euros('surtax', gains.surtax.amount)] : []),
    euros('gains on lots held two years or more, tax-free', gains.taxFreeGains),
    { label: 'sales left out for having no HNB rate', count: gains.leftOut },
    ...incomeTax('income on the INO-DOH', foreign.inoDoh),
    ...incomeTax('income on 30-day JOPPDs', foreign.joppd),
    { label: 'payments left out for having no HNB rate', count: foreign.leftOut },
  ]
}

/** What the chat can read of Investments: every kind but the mail reader, with every field classified, and the figures the screens show, from the same functions. Nothing here writes. */
export function investmentsReader(reading: InvestmentsReading): AppReader {
  const fields = fieldsOf(() => reading.book())
  const rows = <R>(of: (book: InvestmentBook) => readonly R[]): readonly R[] => {
    const book = reading.book()
    return book === null ? [] : of(book)
  }
  const report = (figures: (sources: PortfolioSources, period: string | null) => readonly ReportFigure[]) => (period: string | null) => {
    const sources = reading.sources()
    return sources === null ? [] : figures(sources, period)
  }
  const euro = (): CurrencyCode => EURO
  return {
    status: () => reading.status(),
    kinds: [
      readableKind({ kind: INVESTMENT_ACCOUNT_RECORDS, about: words.reads.account, fields: fields.account, dated: null, rows: () => rows((book) => book.accounts), currencyOf: euro }),
      readableKind({
        kind: INSTRUMENT_RECORDS,
        about: words.reads.instrument,
        fields: fields.instrument,
        dated: null,
        rows: () => rows((book) => book.instruments),
        currencyOf: (record) => record.currency,
        page: HOLDING_ROUTE,
      }),
      readableKind({
        kind: TRADE_RECORDS,
        about: words.reads.trade,
        fields: fields.trade,
        dated: 'date',
        rows: () => rows((book) => book.trades),
        currencyOf: (record) => fields.currencyOf(record.instrument),
      }),
      readableKind({ kind: INCOME_RECORDS, about: words.reads.income, fields: fields.income, dated: 'date', rows: () => rows((book) => book.income), currencyOf: (record) => record.currency }),
      readableKind({
        kind: CASH_MOVEMENT_RECORDS,
        about: words.reads.cashMovement,
        fields: fields.cashMovement,
        dated: 'date',
        rows: () => rows((book) => book.cashMovements),
        currencyOf: (record) => record.currency,
      }),
      readableKind({
        kind: EXCHANGE_RECORDS,
        about: words.reads.exchange,
        fields: fields.exchange,
        dated: 'date',
        rows: () => rows((book) => book.exchanges),
        currencyOf: (record) => record.soldCurrency,
      }),
      readableKind({ kind: TRANSFER_RECORDS, about: words.reads.transfer, fields: fields.transfer, dated: 'date', rows: () => rows((book) => book.transfers), currencyOf: euro }),
      readableKind({ kind: SPLIT_RECORDS, about: words.reads.split, fields: fields.split, dated: 'date', rows: () => rows((book) => book.splits), currencyOf: euro }),
      readableKind({ kind: SPIN_OFF_RECORDS, about: words.reads.spinOff, fields: fields.spinOff, dated: 'date', rows: () => rows((book) => book.spinOffs), currencyOf: euro }),
      readableKind({
        kind: PRICE_RECORDS,
        about: words.reads.price,
        fields: fields.price,
        dated: 'date',
        rows: () => rows((book) => book.prices),
        currencyOf: (record) => fields.currencyOf(record.instrument),
      }),
      readableKind({ kind: FUND_MIX_RECORDS, about: words.reads.fundMix, fields: fields.fundMix, dated: null, rows: () => rows((book) => book.fundMixes), currencyOf: euro }),
      readableKind({ kind: TARGET_RECORDS, about: words.reads.target, fields: fields.target, dated: null, rows: () => rows((book) => book.targets), currencyOf: euro }),
      readableKind({ kind: CHECK_RECORDS, about: words.reads.check, fields: fields.check, dated: null, rows: () => rows((book) => book.checks), currencyOf: euro }),
      readableKind({ kind: SETTING_RECORDS, about: words.reads.setting, fields: fields.setting, dated: null, rows: () => rows((book) => book.settings), currencyOf: euro }),
    ],
    reports: [
      { id: 'portfolio', title: words.reports.portfolio.title, about: words.reports.portfolio.about, period: 'day', figures: report(portfolioReport) },
      { id: 'holdings', title: words.reports.holdings.title, about: words.reports.holdings.about, period: 'day', figures: report(holdingsReport) },
      { id: 'income', title: words.reports.income.title, about: words.reports.income.about, period: 'month', figures: report(incomeReport) },
      { id: 'tax', title: words.reports.tax.title, about: words.reports.tax.about, period: 'month', figures: report((sources, period) => taxReport(sources, period, reading.taxShown())) },
    ],
  }
}
