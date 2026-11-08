import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import type { MailReader } from '../../workbook/domain/mailReader'
import type { RecipeField, RecipeFields, Recipe, RowTest } from '../../../../shared/recipes/domain/recipe'

const DATE_FORMATS = ['yyyyMMdd;HHmmss', 'yyyyMMdd']

/** Notes on a trade that change nothing Kuna books. Any other code, such as Ca for cancelled or Co for corrected, makes the row a question. */
const PLAIN_NOTES: RowTest = { column: 'notes', partsWithin: ['IA', 'AFx', 'P'], separator: ';' }

/** The day of a row, which a section with no kinds reads too, so a question about one of its rows before the start day is left out. */
const DATED: RecipeField = { from: 'dateTime', as: 'date', formats: DATE_FORMATS }

const WHAT_EVERY_ROW_NAMES: RecipeFields = {
  key: { from: 'transactionID', as: 'text' },
  account: { from: 'accountId', as: 'text' },
  date: DATED,
  time: { from: 'dateTime', as: 'time', formats: DATE_FORMATS, blank: true },
  currency: { from: 'currency', as: 'currency' },
}

const WHAT_A_HOLDING_NAMES: RecipeFields = {
  isin: { from: 'isin', as: 'text' },
  symbol: { from: 'symbol', as: 'text' },
  name: { from: 'description', as: 'text', blank: true },
}

/**
 * IBKR's Activity Flex report in XML. Each section's rows are taken apart by type or asset category, and any row this
 * recipe has not seen goes to the person. Sections it has no kinds for are still required, so a report that stops
 * carrying corporate actions fails rather than leaves them out without a word. A section has the name IBKR's query gives
 * it, so a line about a missing section names what to tick there.
 */
export const IBKR_FLEX_RECIPE: Recipe = {
  id: 'ibkr-activity-flex',
  name: 'IBKR Activity Flex',
  mail: { senders: ['donotreply@interactivebrokers.com'], subject: '', contents: '' },
  file: { format: 'xml', root: 'FlexQueryResponse' },
  sections: [
    {
      name: 'Trades',
      rows: 'Trades/Trade',
      keep: [{ column: 'levelOfDetail', is: ['EXECUTION'] }],
      shown: ['dateTime', 'assetCategory', 'buySell', 'symbol', 'description', 'quantity', 'tradePrice', 'currency', 'netCash', 'notes', 'origTradeID'],
      fields: {
        ...WHAT_EVERY_ROW_NAMES,
        quantity: { from: 'quantity', as: 'decimal' },
        price: { from: 'tradePrice', as: 'decimal' },
        netCash: { from: 'netCash', as: 'decimal' },
        commission: { from: 'ibCommission', as: 'decimal', blank: true },
        commissionCurrency: { from: 'ibCommissionCurrency', as: 'currency', blank: true },
      },
      kinds: [
        { kind: 'BUY', when: [{ column: 'assetCategory', is: ['STK'] }, { column: 'buySell', is: ['BUY'] }, PLAIN_NOTES], fields: WHAT_A_HOLDING_NAMES },
        { kind: 'SELL', when: [{ column: 'assetCategory', is: ['STK'] }, { column: 'buySell', is: ['SELL'] }, PLAIN_NOTES], fields: WHAT_A_HOLDING_NAMES },
        {
          kind: 'FX',
          when: [{ column: 'assetCategory', is: ['CASH'] }, { column: 'buySell', is: ['BUY', 'SELL'] }, PLAIN_NOTES],
          // The symbol of a conversion names both currencies, such as EUR.USD, and its quantity is in the first.
          fields: { counterCurrency: { from: 'symbol', as: 'currency', part: { separator: '.', at: 0 } } },
        },
      ],
    },
    {
      name: 'Cash Transactions',
      rows: 'CashTransactions/CashTransaction',
      keep: [],
      shown: ['dateTime', 'type', 'symbol', 'description', 'amount', 'currency', 'actionID'],
      fields: { ...WHAT_EVERY_ROW_NAMES, amount: { from: 'amount', as: 'decimal' } },
      kinds: [
        {
          kind: 'DIVIDEND',
          when: [
            { column: 'type', is: ['Dividends'] },
            { column: 'amount', sign: 'above-zero' },
          ],
          fields: {
            ...WHAT_A_HOLDING_NAMES,
            actionId: { from: 'actionID', as: 'text' },
            exDate: { from: 'exDate', as: 'date', formats: DATE_FORMATS, blank: true },
            payDate: { from: 'settleDate', as: 'date', formats: DATE_FORMATS, blank: true },
            sourceCountry: { from: 'issuerCountryCode', as: 'text', blank: true },
            dividendType: { from: 'dividendType', as: 'text', blank: true },
          },
        },
        {
          kind: 'WITHHOLDING TAX',
          when: [
            { column: 'type', is: ['Withholding Tax'] },
            { column: 'amount', sign: 'below-zero' },
          ],
          fields: { actionId: { from: 'actionID', as: 'text', blank: true }, isin: { from: 'isin', as: 'text', blank: true } },
        },
        {
          kind: 'INTEREST',
          when: [
            { column: 'type', is: ['Broker Interest Received'] },
            { column: 'amount', sign: 'above-zero' },
          ],
          fields: {},
        },
        {
          kind: 'DEPOSIT',
          when: [
            { column: 'type', is: ['Deposits/Withdrawals'] },
            { column: 'amount', sign: 'above-zero' },
          ],
          fields: {},
        },
        {
          kind: 'WITHDRAWAL',
          when: [
            { column: 'type', is: ['Deposits/Withdrawals'] },
            { column: 'amount', sign: 'below-zero' },
          ],
          fields: {},
        },
        {
          kind: 'FEE',
          when: [
            { column: 'type', is: ['Other Fees'] },
            { column: 'amount', sign: 'below-zero' },
          ],
          fields: {},
        },
      ],
    },
    {
      name: 'Transaction Taxes',
      rows: 'TransactionTaxes/TransactionTax',
      keep: [],
      shown: ['dateTime', 'taxDescription', 'symbol', 'description', 'taxAmount', 'currency'],
      fields: { date: DATED },
      kinds: [],
    },
    {
      name: 'Corporate Actions',
      rows: 'CorporateActions/CorporateAction',
      keep: [],
      shown: ['dateTime', 'type', 'symbol', 'description', 'quantity', 'amount', 'currency'],
      fields: { date: DATED },
      kinds: [],
    },
    {
      name: 'Transfers',
      rows: 'Transfers/Transfer',
      keep: [],
      shown: ['date', 'type', 'direction', 'symbol', 'description', 'quantity', 'cashTransfer', 'currency'],
      fields: { date: { from: 'date', as: 'date', formats: DATE_FORMATS } },
      kinds: [],
    },
  ],
}

/** The recipes Kuna brings with it. */
export const BUILT_IN_RECIPES: readonly Recipe[] = [IBKR_FLEX_RECIPE]

/** The file's reader of IBKR's report, or null before one is saved. */
export function ibkrMailReader(book: InvestmentBook | null | undefined): MailReader | null {
  return book?.mailReaders.find((reader) => reader.recipe === IBKR_FLEX_RECIPE.id) ?? null
}
