import { writeTransaction } from '../../transactions/application/transactionWrites'
import { withImportFacts } from '../../transactions/domain/listedTransactions'
import type { TransactionKind, TransactionRecord } from '../../transactions/domain/listedTransactions'
import { matchingDeposit } from '../../transactions/domain/matchingDeposit'
import { ecbRateText, keyOf, rateCurrency, textsOf, transactionDraft } from '../../transactions/domain/transactionDraft'
import type { Happening, TransactionTexts } from '../../transactions/domain/transactionDraft'
import { transactionErrors, words as transactionWords } from '../../transactions/presentation/words'
import { CASH_MOVEMENT_KINDS } from '../../workbook/domain/cashMovement'
import { INCOME_KINDS } from '../../workbook/domain/income'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import {
  CASH_MOVEMENT_RECORDS,
  EXCHANGE_RECORDS,
  INCOME_RECORDS,
  INSTRUMENT_RECORDS,
  INVESTMENT_ACCOUNT_RECORDS,
  PRICE_RECORDS,
  SPIN_OFF_RECORDS,
  SPLIT_RECORDS,
  TRADE_RECORDS,
  TRANSFER_RECORDS,
} from '../../workbook/domain/investmentKinds'
import { TRADE_SIDES } from '../../workbook/domain/trade'
import { FLAG_OR_NULL, NUMBER, NUMBER_OR_NULL, TEXT, TEXT_OR_NULL, choiceOf, dayOf, found, inputOf } from '../../../../shared/app/operationInput'
import type { StrictSchema } from '../../../../shared/ai/domain/strictSchema'
import type { AssistantOperation } from '../../../../shared/app/assistantOperations'
import { StepRefused } from '../../../../shared/app/proposedWrites'
import { today } from '../../../../shared/calendar/civilDate'
import { amountShown } from '../../../../shared/money/amountTyping'
import { decimalShown, decimalText } from '../../../../shared/money/decimal'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import { newRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import { DECIMAL, DECIMAL_OR_NULL, decimalOf, unchanged } from './investmentSteps'
import type { CardBooks, InvestmentSteps, StepWritten } from './investmentSteps'

/**
 * How a step's field fills one of the transaction dialog's fields: a ref of an account or an instrument, a day, a
 * decimal or a money amount as the model writes them, a whole number, a currency code, a yes or no, plain text, or one of
 * a list, which for a trade's side and a cash movement's kind is what happened.
 */
type Shape = { readonly is: 'account' | 'instrument' | 'day' | 'decimal' | 'amount' | 'whole' | 'currency' | 'flag' | 'text' } | { readonly is: 'choice'; readonly choices: readonly string[] }

interface FormField {
  readonly name: string
  readonly text: keyof TransactionTexts
  readonly shape: Shape
  /** A new record may leave it null, which keeps the dialog's start: blank, or the ECB's rate of the day for a rate. */
  readonly optional?: true
  readonly about?: string
}

/** One kind the transaction dialog writes, with the fields its happening shows and an add that the spec runs through the checks. */
interface TransactionForm {
  readonly kind: TransactionKind
  readonly noun: string
  /** What happened, or null when a choice field says. */
  readonly happened: Happening | null
  readonly fields: readonly FormField[]
  readonly adds: string
  /** Its write rules count the units each later sale and transfer leaves, so a delete that leaves one short is refused. */
  readonly countedOn?: true
  readonly example: Readonly<Record<string, unknown>>
  held(book: InvestmentBook): readonly TransactionRecord[]
}

const ACCOUNT: Shape = { is: 'account' }
const INSTRUMENT: Shape = { is: 'instrument' }
const DAY: Shape = { is: 'day' }
const DECIMAL_SHAPE: Shape = { is: 'decimal' }
const AMOUNT: Shape = { is: 'amount' }
const CURRENCY: Shape = { is: 'currency' }
const NOTE: FormField = { name: 'note', text: 'note', shape: { is: 'text' } }
const RATE: FormField = {
  name: 'rate',
  text: 'rate',
  shape: DECIMAL_SHAPE,
  optional: true,
  about: "Units of the currency per euro. A new record given null takes the ECB rate of its day. A change keeps the rate unless given, so give the new day's rate when the date or currency changes.",
}

const as = <K extends TransactionKind>(kind: K, records: readonly Extract<TransactionRecord, { readonly kind: K }>['record'][]): TransactionRecord[] =>
  records.map((record) => ({ kind, record }) as TransactionRecord)

const TRADE_FIELDS: readonly FormField[] = [
  { name: 'account', text: 'account', shape: ACCOUNT },
  { name: 'instrument', text: 'instrument', shape: INSTRUMENT },
  { name: 'date', text: 'date', shape: DAY },
  { name: 'quantity', text: 'quantity', shape: DECIMAL_SHAPE, about: 'Units, grams or a bond nominal, above zero.' },
  { name: 'price', text: 'price', shape: DECIMAL_SHAPE, about: 'Per unit in the quote currency, in percent for a bond.' },
  { name: 'fees', text: 'fees', shape: AMOUNT, optional: true, about: 'The broker fees in the quote currency, or null when not known.' },
  RATE,
  NOTE,
]

const FORMS: readonly TransactionForm[] = [
  {
    kind: 'trade',
    noun: 'trade',
    happened: null,
    fields: [{ name: 'side', text: 'happened', shape: { is: 'choice', choices: TRADE_SIDES } }, ...TRADE_FIELDS],
    adds: 'A buy or a sale of units in an account, in the quote currency. A sale beyond what the account holds that day is refused.',
    countedOn: true,
    example: { side: 'buy', account: 'account', instrument: 'instrument', date: '2026-10-12', quantity: '2', price: '150', fees: '1', rate: null, note: '' },
    held: (book) => as('trade', book.trades),
  },
  {
    kind: 'income',
    noun: 'income',
    happened: 'income',
    fields: [
      { name: 'kind', text: 'incomeKind', shape: { is: 'choice', choices: INCOME_KINDS } },
      { name: 'account', text: 'account', shape: ACCOUNT },
      { name: 'instrument', text: 'instrument', shape: INSTRUMENT, optional: true, about: 'What paid it, which a dividend and a coupon need.' },
      { name: 'date', text: 'date', shape: DAY },
      { name: 'currency', text: 'currency', shape: CURRENCY },
      { name: 'gross', text: 'amount', shape: AMOUNT, about: 'Before tax, above zero.' },
      { name: 'withheld', text: 'withheld', shape: AMOUNT, optional: true, about: 'The tax withheld at source, or null for none.' },
      { name: 'reverses', text: 'reverses', shape: { is: 'flag' }, optional: true, about: 'yes for a reversal of an earlier payment, which the note names.' },
      RATE,
      NOTE,
    ],
    adds: 'A dividend, coupon, interest or other income paid into an account, with the tax withheld.',
    example: { kind: 'dividend', account: 'account', instrument: 'instrument', date: '2026-10-15', currency: 'USD', gross: '3.2', withheld: '0.48', reverses: null, rate: null, note: '' },
    held: (book) => as('income', book.income),
  },
  {
    kind: 'cash-movement',
    noun: 'cash-movement',
    happened: null,
    fields: [
      { name: 'kind', text: 'happened', shape: { is: 'choice', choices: CASH_MOVEMENT_KINDS } },
      { name: 'account', text: 'account', shape: ACCOUNT },
      { name: 'date', text: 'date', shape: DAY },
      { name: 'currency', text: 'currency', shape: CURRENCY },
      { name: 'amount', text: 'amount', shape: AMOUNT, about: 'Above zero. The kind gives its direction.' },
      RATE,
      NOTE,
    ],
    adds: 'A deposit, withdrawal, fee or fee refund of an account.',
    example: { kind: 'deposit', account: 'account', date: '2026-10-01', currency: 'EUR', amount: '500', rate: null, note: '' },
    held: (book) => as('cash-movement', book.cashMovements),
  },
  {
    kind: 'exchange',
    noun: 'exchange',
    happened: 'exchange',
    fields: [
      { name: 'account', text: 'account', shape: ACCOUNT },
      { name: 'date', text: 'date', shape: DAY },
      { name: 'sold', text: 'amount', shape: AMOUNT, about: 'What was sold, after fees.' },
      { name: 'soldCurrency', text: 'currency', shape: CURRENCY },
      { name: 'bought', text: 'bought', shape: AMOUNT, about: 'What was bought, after fees.' },
      { name: 'boughtCurrency', text: 'boughtCurrency', shape: CURRENCY },
      { name: 'fees', text: 'fees', shape: AMOUNT, optional: true, about: 'What it charged, already inside the amounts, or null.' },
      { name: 'feeCurrency', text: 'feeCurrency', shape: CURRENCY, optional: true },
      NOTE,
    ],
    adds: 'Cash of one currency changed into another in an account.',
    example: { account: 'account', date: '2026-10-02', sold: '200', soldCurrency: 'EUR', bought: '216', boughtCurrency: 'USD', fees: null, feeCurrency: null, note: '' },
    held: (book) => as('exchange', book.exchanges),
  },
  {
    kind: 'transfer',
    noun: 'transfer',
    happened: 'transfer',
    fields: [
      { name: 'from', text: 'account', shape: ACCOUNT },
      { name: 'to', text: 'toAccount', shape: ACCOUNT },
      { name: 'date', text: 'date', shape: DAY },
      { name: 'instrument', text: 'instrument', shape: INSTRUMENT, optional: true, about: 'For units: what moved. Null for cash.' },
      { name: 'quantity', text: 'quantity', shape: DECIMAL_SHAPE, optional: true, about: 'For units: how many.' },
      { name: 'currency', text: 'currency', shape: CURRENCY, optional: true, about: 'For cash: its currency.' },
      { name: 'amount', text: 'amount', shape: AMOUNT, optional: true, about: 'For cash: how much.' },
      NOTE,
    ],
    adds: 'Units or cash moved between two of the accounts, which closes no lot. More units than the account holds that day are refused.',
    countedOn: true,
    example: { from: 'account', to: 'account-other', date: '2026-10-20', instrument: 'instrument', quantity: '1', currency: null, amount: null, note: '' },
    held: (book) => as('transfer', book.transfers),
  },
  {
    kind: 'split',
    noun: 'split',
    happened: 'split',
    fields: [
      { name: 'instrument', text: 'instrument', shape: INSTRUMENT },
      { name: 'date', text: 'date', shape: DAY },
      { name: 'newUnits', text: 'newUnits', shape: { is: 'whole' }, about: 'Units after, for every oldUnits before, so 10 and 1 is 10-for-1.' },
      { name: 'oldUnits', text: 'oldUnits', shape: { is: 'whole' } },
      NOTE,
    ],
    adds: "A split of an instrument's units.",
    countedOn: true,
    example: { instrument: 'instrument', date: '2026-10-25', newUnits: 2, oldUnits: 1, note: '' },
    held: (book) => as('split', book.splits),
  },
  {
    kind: 'spin-off',
    noun: 'spin-off',
    happened: 'spin-off',
    fields: [
      { name: 'instrument', text: 'instrument', shape: INSTRUMENT, about: 'The parent held.' },
      { name: 'received', text: 'received', shape: INSTRUMENT, about: 'The instrument received, quoted in the parent’s currency.' },
      { name: 'date', text: 'date', shape: DAY },
      { name: 'quantity', text: 'quantity', shape: DECIMAL_SHAPE, about: 'The units received.' },
      { name: 'costShare', text: 'costShare', shape: DECIMAL_SHAPE, about: "The percent of the parent's cost that moves to them, from 0 to 100." },
      NOTE,
    ],
    adds: 'Units of a new instrument received for holding another.',
    countedOn: true,
    example: { instrument: 'instrument', received: 'instrument-spun', date: '2026-10-26', quantity: '1', costShare: '10', note: '' },
    held: (book) => as('spin-off', book.spinOffs),
  },
  {
    kind: 'price',
    noun: 'price',
    happened: 'price',
    fields: [
      { name: 'instrument', text: 'instrument', shape: INSTRUMENT },
      { name: 'date', text: 'date', shape: DAY },
      { name: 'price', text: 'price', shape: DECIMAL_SHAPE, about: 'The close in the quote currency.' },
      NOTE,
    ],
    adds: "A close typed by hand, such as a fund's price from its statement.",
    example: { instrument: 'instrument-fund', date: '2026-10-30', price: '10.42', note: '' },
    held: (book) => as('price', book.prices),
  },
]

const DECIMAL_NULL: StrictSchema = { type: ['string', 'null'], description: 'An exact decimal with a point and no grouping, such as 12.5, or null.' }

function schemaOf(field: FormField, nullable: boolean): StrictSchema {
  const described = (schema: StrictSchema): StrictSchema =>
    field.about === undefined ? schema : { ...schema, description: [schema.description, field.about].filter((part) => part !== undefined).join(' ') }
  const { shape } = field
  switch (shape.is) {
    case 'choice':
      return described(nullable ? { type: ['string', 'null'], enum: [...shape.choices, null], description: 'Null leaves it.' } : { type: 'string', enum: shape.choices })
    case 'decimal':
    case 'amount':
      return described(nullable ? (field.optional === true ? DECIMAL_OR_NULL : DECIMAL_NULL) : DECIMAL)
    case 'whole':
      return described(nullable ? NUMBER_OR_NULL : NUMBER)
    case 'flag':
      return described(FLAG_OR_NULL)
    case 'currency':
      return described({ type: nullable ? ['string', 'null'] : 'string', description: nullable ? 'A currency code such as USD, or null to leave it.' : 'A currency code such as USD.' })
    default:
      return described(nullable ? TEXT_OR_NULL : TEXT)
  }
}

/** A record's ref field, the same name on every change and delete. */
const RECORD = 'record'

const RECORD_KINDS: Readonly<Record<TransactionKind, string>> = {
  trade: TRADE_RECORDS.name,
  income: INCOME_RECORDS.name,
  'cash-movement': CASH_MOVEMENT_RECORDS.name,
  exchange: EXCHANGE_RECORDS.name,
  transfer: TRANSFER_RECORDS.name,
  split: SPLIT_RECORDS.name,
  'spin-off': SPIN_OFF_RECORDS.name,
  price: PRICE_RECORDS.name,
}

function refsOf(fields: readonly FormField[]): Record<string, string> {
  return Object.fromEntries(
    fields.flatMap((field) => (field.shape.is === 'account' ? [[field.name, INVESTMENT_ACCOUNT_RECORDS.name]] : field.shape.is === 'instrument' ? [[field.name, INSTRUMENT_RECORDS.name]] : [])),
  )
}

function operationsOf(form: TransactionForm): AssistantOperation[] {
  const recordRef = { [RECORD]: RECORD_KINDS[form.kind] }
  return [
    {
      name: `add-${form.noun}`,
      about: `${form.adds} A field that may be null takes the dialog's start, the ECB rate of the day for a rate.`,
      input: inputOf(Object.fromEntries(form.fields.map((field) => [field.name, schemaOf(field, field.optional === true)]))),
      refs: refsOf(form.fields),
      creates: null,
      alone: false,
      example: form.example,
    },
    {
      name: `change-${form.noun}`,
      about: `Changes a ${form.noun} as its dialog does. Null leaves a field as it is, and "" clears one that may be blank.`,
      input: inputOf({ [RECORD]: TEXT, ...Object.fromEntries(form.fields.map((field) => [field.name, schemaOf(field, true)])) }),
      refs: { ...refsOf(form.fields), ...recordRef },
      creates: null,
      alone: false,
      example: { [RECORD]: form.noun, ...Object.fromEntries(form.fields.map((field) => [field.name, null])), note: 'Checked' },
    },
    {
      name: `delete-${form.noun}`,
      about: form.countedOn === true ? `Deletes a ${form.noun}. One that a later sale or transfer counts on is refused.` : `Deletes a ${form.noun}.`,
      input: inputOf({ [RECORD]: TEXT }),
      refs: recordRef,
      creates: null,
      alone: false,
      example: { [RECORD]: form.noun },
    },
  ]
}

/** What a step's value puts in the dialog's field, or null when the step leaves the field as it is. */
function textOf(card: CardBooks, field: FormField, value: unknown): string | boolean | null {
  if (value === null) return null
  const { shape } = field
  switch (shape.is) {
    case 'account':
      return value === '' ? '' : found(card.book.accounts, card.idOf(value), 'account').id
    case 'instrument':
      return value === '' ? '' : found(card.book.instruments, card.idOf(value), 'instrument').id
    case 'day':
      return dayOf(String(value))
    case 'decimal':
      return value === '' ? '' : decimalShown(decimalOf(String(value), field.name))
    case 'amount':
      return value === '' ? '' : amountShown(decimalText(decimalOf(String(value), field.name)))
    case 'whole':
      return String(value)
    case 'flag':
      return choiceOf(['yes', 'no'], String(value), field.name) === 'yes'
    case 'choice':
      return choiceOf(shape.choices, String(value), field.name)
    default:
      return String(value)
  }
}

/**
 * The record the dialog would save from the step's fields, laid over the record changed or over a new one's start, or
 * a refusal naming each field the dialog would mark. A new record's rate left null is the ECB's of its day, as the dialog fills it.
 */
function drafted(card: CardBooks, form: TransactionForm, before: TransactionRecord | null, input: Readonly<Record<string, unknown>>): TransactionRecord {
  const start = textsOf(before, { happened: form.happened ?? 'buy', instrument: null, today: today() }, card.book)
  const texts: TransactionTexts = { ...start, ...(form.happened === null ? {} : { happened: form.happened }) }
  const written = texts as unknown as Record<keyof TransactionTexts, string | boolean>
  for (const field of form.fields) {
    const text = textOf(card, field, input[field.name])
    if (text !== null) written[field.text] = text
  }
  if (form.kind === 'transfer') texts.moves = movesOf(input, start.moves)
  if (before === null && input['rate'] === null && form.fields.includes(RATE)) texts.rate = ecbRateText(card.rates, rateCurrency(texts, card.book), texts.date)
  const draft = transactionDraft(texts, card.book, before === null ? newRecordId() : keyOf(before))
  if (draft.record === null) {
    const names = new Map(form.fields.map((field) => [field.text, field.name]))
    throw new StepRefused(
      Object.entries(transactionErrors(draft.faults))
        .map(([text, error]) => `${names.get(text as keyof TransactionTexts) ?? text}: ${error}`)
        .join(' '),
    )
  }
  return draft.record
}

/** A transfer moves units when the step names an instrument or a quantity, and cash when it names a currency or an amount. */
function movesOf(input: Readonly<Record<string, unknown>>, kept: TransactionTexts['moves']): TransactionTexts['moves'] {
  const named = (field: string): boolean => input[field] !== null && input[field] !== ''
  if (named('instrument') || named('quantity')) return 'units'
  if (named('currency') || named('amount')) return 'cash'
  return kept
}

const ADD_HOLDING: AssistantOperation = {
  name: 'add-holding',
  about:
    'Something already held when the owner starts with Kuna: a buy, and the deposit that paid for it in its currency at its rate, so the cash stays where it was. Both go in one write with one Undo.',
  input: inputOf(Object.fromEntries(TRADE_FIELDS.map((field) => [field.name, schemaOf(field, field.optional === true)]))),
  refs: refsOf(TRADE_FIELDS),
  creates: null,
  alone: false,
  example: { account: 'account', instrument: 'instrument-fund', date: '2025-03-03', quantity: '10', price: '9.5', fees: null, rate: null, note: '' },
}

const TRADE_FORM = FORMS[0]!
const BY_NAME = new Map(FORMS.flatMap((form) => operationsOf(form).map((operation) => [operation.name, form] as const)))

/** Every kind the transaction dialog writes, added, changed and deleted through its own fields, checks and `writeTransaction`, and a holding already held as the overview adds it. */
export const TRANSACTION_STEPS: InvestmentSteps = {
  operations: [...FORMS.flatMap(operationsOf), ADD_HOLDING],
  write(unit: UnitOfWork, card: CardBooks, { operation, input }): StepWritten {
    if (operation === ADD_HOLDING.name) {
      const record = drafted(card, TRADE_FORM, null, { ...input, side: 'buy' })
      if (record.kind !== 'trade') throw new StepRefused('That is not a buy.')
      const instrument = found(card.book.instruments, record.record.instrument, 'instrument')
      const deposit = matchingDeposit(record.record, instrument, recordIdOf(CASH_MOVEMENT_RECORDS, newRecordId()), transactionWords.dialog.alreadyHeldNote)
      writeTransaction(unit, null, record)
      writeTransaction(unit, null, { kind: 'cash-movement', record: deposit })
      return unchanged(card)
    }
    const form = BY_NAME.get(operation)!
    if (operation.startsWith('add-')) {
      writeTransaction(unit, null, drafted(card, form, null, input))
      return unchanged(card)
    }
    const id = card.idOf(input[RECORD])
    const before = form.held(card.book).find((entry) => entry.record.id === id)
    if (before === undefined) throw new StepRefused(`That ${form.noun} is no longer in the file.`)
    writeTransaction(unit, before, operation.startsWith('change-') ? withImportFacts(before, drafted(card, form, before, input)) : null)
    return unchanged(card)
  },
}
