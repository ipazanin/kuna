import { addDays } from '../../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../../shared/calendar/civilDate'
import { weekdaysAfter } from '../../../tax/domain/workingDays'

/** Every value here is made up, in the shape of an Activity Flex report. Holdings use the fake portfolio's ISINs. */
const ACCOUNT = 'U0000001'

const TRADE_FIELDS = [
  'accountId',
  'transactionID',
  'tradeID',
  'origTradeID',
  'levelOfDetail',
  'assetCategory',
  'symbol',
  'description',
  'isin',
  'issuerCountryCode',
  'currency',
  'fxRateToBase',
  'dateTime',
  'tradeDate',
  'settleDateTarget',
  'buySell',
  'quantity',
  'tradePrice',
  'proceeds',
  'ibCommission',
  'ibCommissionCurrency',
  'taxes',
  'netCash',
  'notes',
]

const CASH_FIELDS = [
  'accountId',
  'transactionID',
  'actionID',
  'type',
  'dividendType',
  'assetCategory',
  'symbol',
  'description',
  'isin',
  'issuerCountryCode',
  'currency',
  'dateTime',
  'settleDate',
  'exDate',
  'amount',
]

type Fields = Readonly<Record<string, string>>

/** An element with every field its section gives, blank where the row has no value, as the report writes it. */
function element(name: string, fields: readonly string[], values: Fields): string {
  return `<${name} ${fields.map((field) => `${field}="${values[field] ?? ''}"`).join(' ')} />`
}

function trade(values: Fields): string {
  return element('Trade', TRADE_FIELDS, { accountId: ACCOUNT, levelOfDetail: 'EXECUTION', ...values })
}

function cash(values: Fields): string {
  return element('CashTransaction', CASH_FIELDS, { accountId: ACCOUNT, ...values })
}

function compact(day: CivilDate): string {
  return day.replaceAll('-', '')
}

/** The rows of a day, each with its transaction id, so overlapping reports repeat them exactly. */
function tradeRows(day: CivilDate): readonly string[] {
  const date = compact(day)
  const settles = compact(weekdaysAfter(day, 1))
  return [
    trade({
      transactionID: `90${date}01`,
      tradeID: `70${date}01`,
      assetCategory: 'STK',
      symbol: 'ABC',
      description: 'EXAMPLE TECH INC',
      isin: 'XX000000ABC1',
      issuerCountryCode: 'US',
      currency: 'USD',
      fxRateToBase: '0.9',
      dateTime: `${date};103015`,
      tradeDate: date,
      settleDateTarget: settles,
      buySell: 'BUY',
      quantity: '1.2345',
      tradePrice: '100.5',
      proceeds: '-124.06725',
      ibCommission: '-0.35',
      ibCommissionCurrency: 'USD',
      taxes: '0',
      netCash: '-124.41725',
      notes: 'IA;P',
    }),
    trade({
      transactionID: `90${date}99`,
      levelOfDetail: 'ORDER',
      assetCategory: 'STK',
      symbol: 'ABC',
      isin: 'XX000000ABC1',
      currency: 'USD',
      dateTime: `${date};103015`,
      buySell: 'BUY',
      quantity: '1.2345',
      tradePrice: '100.5',
      netCash: '-124.41725',
    }),
    trade({
      transactionID: `90${date}02`,
      tradeID: `70${date}02`,
      assetCategory: 'STK',
      symbol: 'ABC',
      description: 'EXAMPLE TECH INC',
      isin: 'XX000000ABC1',
      issuerCountryCode: 'US',
      currency: 'USD',
      dateTime: `${date};143000`,
      tradeDate: date,
      settleDateTarget: settles,
      buySell: 'SELL',
      quantity: '-0.5',
      tradePrice: '110',
      proceeds: '55',
      ibCommission: '-0.25',
      ibCommissionCurrency: 'EUR',
      netCash: '55',
      notes: '',
    }),
    trade({
      transactionID: `90${date}03`,
      tradeID: `70${date}03`,
      assetCategory: 'CASH',
      symbol: 'EUR.USD',
      description: 'EUR.USD',
      currency: 'USD',
      dateTime: `${date};090000`,
      buySell: 'BUY',
      quantity: '500',
      tradePrice: '1.1',
      proceeds: '-550',
      ibCommission: '-2',
      ibCommissionCurrency: 'USD',
      netCash: '-552',
      notes: 'AFx',
    }),
  ]
}

function cashRows(day: CivilDate): readonly string[] {
  const date = compact(day)
  const dividend = {
    actionID: `50${date}`,
    assetCategory: 'STK',
    symbol: 'DEF',
    description: 'EXAMPLE DIVIDEND CO (US000000DEF2) CASH DIVIDEND USD 0.30 PER SHARE',
    isin: 'US000000DEF2',
    issuerCountryCode: 'US',
    currency: 'USD',
    dateTime: date,
    settleDate: date,
    exDate: compact(addDays(day, -10)),
  }
  return [
    cash({ ...dividend, transactionID: `80${date}01`, type: 'Dividends', dividendType: 'Ordinary Dividend', amount: '30' }),
    cash({ ...dividend, transactionID: `80${date}02`, type: 'Withholding Tax', description: 'EXAMPLE DIVIDEND CO - US TAX', amount: '-4.5' }),
    cash({ transactionID: `80${date}03`, type: 'Broker Interest Received', description: 'USD CREDIT INTEREST', currency: 'USD', dateTime: date, settleDate: date, amount: '2.1' }),
    cash({ transactionID: `80${date}04`, type: 'Withholding Tax', description: 'WITHHOLDING ON CREDIT INTEREST', currency: 'USD', dateTime: date, settleDate: date, amount: '-0.21' }),
    cash({ transactionID: `80${date}05`, type: 'Deposits/Withdrawals', description: 'CASH RECEIPT', currency: 'EUR', dateTime: date, settleDate: date, amount: '1000' }),
    cash({ transactionID: `80${date}06`, type: 'Deposits/Withdrawals', description: 'DISBURSEMENT', currency: 'EUR', dateTime: date, settleDate: date, amount: '-200' }),
    cash({ transactionID: `80${date}07`, type: 'Other Fees', description: 'MARKET DATA FEE', currency: 'USD', dateTime: date, settleDate: date, amount: '-1.5' }),
    cash({ transactionID: `80${date}08`, type: 'Other Fees', description: 'MARKET DATA FEE REFUND', currency: 'USD', dateTime: date, settleDate: date, amount: '0.5' }),
  ]
}

/** Rows of the kinds no real report has shown yet, which have to stop and ask. */
function unseenRows(day: CivilDate): { readonly trades: readonly string[]; readonly cash: readonly string[]; readonly taxes: string; readonly actions: string; readonly transfers: string } {
  const date = compact(day)
  return {
    trades: [
      trade({
        transactionID: `91${date}01`,
        assetCategory: 'STK',
        symbol: 'ABC',
        description: 'EXAMPLE TECH INC',
        isin: 'XX000000ABC1',
        currency: 'USD',
        dateTime: `${date};110000`,
        buySell: 'BUY (Ca.)',
        quantity: '-1',
        tradePrice: '99',
        netCash: '99',
        notes: 'Ca',
        origTradeID: '7000000001',
      }),
      trade({
        transactionID: `91${date}02`,
        assetCategory: 'STK',
        symbol: 'ABC',
        description: 'EXAMPLE TECH INC',
        isin: 'XX000000ABC1',
        currency: 'USD',
        dateTime: `${date};110000`,
        buySell: 'BUY',
        quantity: '1',
        tradePrice: '98',
        netCash: '-98',
        notes: 'Co',
        origTradeID: '7000000001',
      }),
    ],
    cash: [
      cash({
        transactionID: `81${date}01`,
        type: 'Payment In Lieu Of Dividends',
        symbol: 'DEF',
        description: 'EXAMPLE DIVIDEND CO PAYMENT IN LIEU',
        isin: 'US000000DEF2',
        currency: 'USD',
        dateTime: date,
        amount: '3',
      }),
    ],
    taxes: `<TransactionTax accountId="${ACCOUNT}" transactionID="82${date}01" dateTime="${date}" symbol="ABC" description="EXAMPLE TECH INC" taxDescription="MADE-UP TAX" taxAmount="-0.5" currency="USD" />`,
    actions: `<CorporateAction accountId="${ACCOUNT}" transactionID="83${date}01" dateTime="${date};202500" type="FS" symbol="ABC" description="ABC SPLIT 2 FOR 1" quantity="10" amount="0" currency="USD" />`,
    transfers: `<Transfer accountId="${ACCOUNT}" transactionID="84${date}01" date="${date}" type="ACATS" direction="IN" symbol="DEF" description="EXAMPLE DIVIDEND CO" quantity="5" cashTransfer="0" currency="USD" />`,
  }
}

export type SampleFlexShape = 'plain' | 'unseen' | 'no-trades-section' | 'no-transaction-id'

/**
 * A made-up Activity Flex report over the days given, with every section the real one has, empty ones included.
 * `unseen` adds rows of kinds no real report has shown yet. The last two no longer fit the recipe.
 */
export function sampleFlexReport(days: readonly CivilDate[], shape: SampleFlexShape = 'plain'): string {
  const unseen = shape === 'unseen' && days[0] !== undefined ? unseenRows(days[0]) : null
  const trades = `<Trades>${[...days.flatMap(tradeRows), ...(unseen?.trades ?? [])].join('')}</Trades>`
  const statement = [
    shape === 'no-trades-section' ? '' : trades,
    `<TransactionTaxes>${unseen?.taxes ?? ''}</TransactionTaxes>`,
    `<CorporateActions>${unseen?.actions ?? ''}</CorporateActions>`,
    `<CashTransactions>${[...days.flatMap(cashRows), ...(unseen?.cash ?? [])].join('')}</CashTransactions>`,
    `<Transfers>${unseen?.transfers ?? ''}</Transfers>`,
  ].join('')
  const xml = `<?xml version="1.0" encoding="UTF-8"?><FlexQueryResponse queryName="Made up" type="AF"><FlexStatements count="1"><FlexStatement accountId="${ACCOUNT}" fromDate="${compact(days[0]!)}" toDate="${compact(days.at(-1)!)}" period="Last7CalendarDays" whenGenerated="20260101;010000">${statement}</FlexStatement></FlexStatements></FlexQueryResponse>`
  return shape === 'no-transaction-id' ? xml.replace(/ transactionID="[^"]*"/g, '') : xml
}
