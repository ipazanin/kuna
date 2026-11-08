import type { ReceiptPorts } from '../../src/apps/spending/assistant/operations/receiptOperation'
import { spendingAcceptance, spendingProposer } from '../../src/apps/spending/assistant/operations/spendingOperations'
import { codecOfSpendingKind } from '../../src/apps/spending/workbook/application/spendingCodecs'
import type { Account } from '../../src/apps/spending/workbook/domain/account'
import type { Category } from '../../src/apps/spending/workbook/domain/category'
import type { Receipt } from '../../src/apps/spending/workbook/domain/receipt'
import type { SpendingBooks } from '../../src/apps/spending/workbook/domain/spendingBooks'
import { ACCOUNT_RECORDS, CATEGORY_RECORDS, RECEIPT_RECORDS, RULE_RECORDS, TRANSACTION_RECORDS } from '../../src/apps/spending/workbook/domain/spendingKinds'
import type { SpendingRule } from '../../src/apps/spending/workbook/domain/spendingRule'
import type { Transaction } from '../../src/apps/spending/workbook/domain/transaction'
import { NO_BANK_FACTS } from '../../src/apps/spending/workbook/domain/transaction'
import { spendingDocumentOf } from '../../src/apps/spending/workbook/infrastructure/spendingDocument'
import type { ChatReads } from '../../src/shared/ai/application/chatReads'
import type { ChatAttachment } from '../../src/shared/ai/domain/chatAttachments'
import { proposeChanges } from '../../src/shared/ai/application/chatProposals'
import { chatRefs } from '../../src/shared/ai/domain/chatRefs'
import type { CheckedProposal } from '../../src/shared/app/assistantOperations'
import { parseCivilDate } from '../../src/shared/calendar/civilDate'
import { accountMoneyFromAmount } from '../../src/shared/money/accountMoney'
import { currencyCodeOf } from '../../src/shared/money/currencyCode'
import { moneyFromAmount } from '../../src/shared/money/money'
import { newPseudonyms } from '../../src/shared/privacy/domain/pseudonyms'
import type { WorkbookStore } from '../../src/shared/storage/application/createWorkbookStore'
import { recordIdOf } from '../../src/shared/storage/domain/recordId'
import type { RecordKind } from '../../src/shared/storage/domain/recordKind'
import type { WorkbookDocument } from '../../src/shared/storage/infrastructure/documentFormat'
import { SPENDING, browserHarness } from './writeBack'

const on = (date: string) => parseCivilDate(date)!
const EUR = currencyCodeOf('EUR')!

function account(key: string, name: string, fields: Partial<Account> = {}): Account {
  return { id: recordIdOf(ACCOUNT_RECORDS, key), name, kind: 'bank', bank: 'otp', currency: EUR, opening: accountMoneyFromAmount(1000), openedOn: on('2026-01-01'), iban: '', closed: false, ...fields }
}

function category(key: string, name: string, kind: Category['kind'], parent: Category | null, order: number): Category {
  return { id: recordIdOf(CATEGORY_RECORDS, key), name, kind, parent: parent?.id ?? null, order, colour: '', hidden: false }
}

const CURRENT = account('account-current', 'Current', { iban: 'HR6523400091110000001' })
const SAVINGS = account('account-savings', 'Savings', { kind: 'savings', bank: null })
const DOLLARS = account('account-dollars', 'Dollars', { bank: 'other', currency: currencyCodeOf('USD')! })
const WALLET = account('account-wallet', 'Old wallet', { kind: 'cash', bank: null })
const REVOLUT = account('account-revolut', 'Revolut', { bank: 'revolut', opening: accountMoneyFromAmount(500) })

const FOOD = category('category-food', 'Food', 'spending', null, 1)
const GROCERIES = category('category-groceries', 'Groceries', 'spending', FOOD, 1)
const RESTAURANTS = category('category-restaurants', 'Restaurants', 'spending', FOOD, 2)
const RENT = category('category-rent', 'Rent', 'spending', null, 2)
const SALARY = category('category-salary', 'Salary', 'income', null, 1)
const TRANSFER = category('category-transfer', 'Between my accounts', 'transfer', null, 1)
const FOR_COMPANY = category('category-company', 'For the company', 'company', null, 1)

function row(key: string, date: string, amount: number, payee: string, fields: Partial<Transaction> = {}): Transaction {
  return {
    ...NO_BANK_FACTS,
    id: recordIdOf(TRANSACTION_RECORDS, key),
    account: CURRENT.id,
    date: on(date),
    amount: accountMoneyFromAmount(amount),
    payee,
    category: null,
    note: '',
    source: 'statement',
    pair: null,
    categorisedBy: null,
    ...fields,
  }
}

/** All made up: a typed row, a bank row with a receipt, a bank row near a typed one, two rows that may be one transfer, and a transfer a statement paired. */
const ROWS: readonly Transaction[] = [
  row('transaction-typed', '2026-10-12', -45.3, 'Corner market', { source: 'typed', category: GROCERIES.id, categorisedBy: 'person' }),
  row('transaction-receipt', '2026-10-14', -20, 'Bakery', { category: GROCERIES.id, categorisedBy: 'rule', importKey: 'made-up-2' }),
  row('transaction-pharmacy-typed', '2026-10-20', -30, 'Pharmacy', { source: 'typed', category: RENT.id, categorisedBy: 'person' }),
  row('transaction-pharmacy-bank', '2026-10-21', -31, 'PHARMACY 22', { importKey: 'made-up-4' }),
  row('transaction-out', '2026-10-25', -200, '', { importKey: 'made-up-5' }),
  row('transaction-in', '2026-10-25', 200, '', { account: SAVINGS.id, importKey: 'made-up-6' }),
  row('transaction-paired-out', '2026-10-28', -100, '', { importKey: 'made-up-7', category: TRANSFER.id, pair: recordIdOf(TRANSACTION_RECORDS, 'transaction-paired-in') }),
  row('transaction-paired-in', '2026-10-28', 100, '', { account: SAVINGS.id, importKey: 'made-up-8', category: TRANSFER.id, pair: recordIdOf(TRANSACTION_RECORDS, 'transaction-paired-out') }),
]

const RECEIPT: Receipt = {
  id: recordIdOf(RECEIPT_RECORDS, 'receipt-bakery'),
  transaction: recordIdOf(TRANSACTION_RECORDS, 'transaction-receipt'),
  merchant: 'Bakery d.o.o.',
  merchantOib: '12345678903',
  buyerOib: '',
  issuedOn: on('2026-10-14'),
  issuedTime: '08:10',
  total: moneyFromAmount(20),
  jir: 'made-up-jir',
  zki: 'made-up-zki',
  readBy: '',
  photo: '',
  latitude: '',
  longitude: '',
}

const RULE: SpendingRule = { id: recordIdOf(RULE_RECORDS, 'rule-corner'), order: 1, condition: { column: 'counterparty_contains', fragment: 'Corner' }, category: GROCERIES.id }

/** The record each operation's example names, by the name it gives it. */
export const EXAMPLE_RECORDS: Readonly<Record<string, string>> = {
  category: RENT.id,
  'category-other': GROCERIES.id,
  'category-child': RESTAURANTS.id,
  transaction: recordIdOf(TRANSACTION_RECORDS, 'transaction-typed'),
  'transaction-receipt': RECEIPT.transaction,
  'transaction-joinable': recordIdOf(TRANSACTION_RECORDS, 'transaction-pharmacy-bank'),
  'transaction-pairable': recordIdOf(TRANSACTION_RECORDS, 'transaction-out'),
  'transaction-paired': recordIdOf(TRANSACTION_RECORDS, 'transaction-paired-out'),
  account: CURRENT.id,
  'account-other': SAVINGS.id,
  'account-empty': WALLET.id,
  rule: RULE.id,
}

export const DESK_ACCOUNTS = { CURRENT, SAVINGS, DOLLARS, WALLET, REVOLUT }

function stored<R>(kind: RecordKind<R>, records: readonly R[]): WorkbookDocument['records'] {
  return { [kind.name]: records.map((record) => codecOfSpendingKind(kind).fieldsOf(record)) }
}

/** Receipt ports that read no QR code, keep a photo on a made-up Drive at once, and name a made-up model. */
export function receiptPorts(fields: Partial<ReceiptPorts> = {}): ReceiptPorts {
  return {
    qrTextOn: async () => null,
    keepsOnDrive: () => true,
    mayKeepNow: () => true,
    photos: async () => ({ keep: async () => 'made-up-drive-photo' }),
    reader: () => 'made-up-model',
    ...fields,
  }
}

/** A photo attached to the chat, of a few made-up bytes with no QR code and no place in them. */
export function attachedPhoto(id = 'a1'): ChatAttachment {
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9])
  return { id, kind: 'photo', name: 'receipt.jpg', bytes, original: new Blob([bytes], { type: 'image/jpeg' }), pages: 1, sent: { width: 1, height: 1 } }
}

/** A Spending file where every operation's example has what it needs, with the chat's refs and the cards it was shown. */
export interface SpendingDesk {
  readonly store: WorkbookStore<SpendingBooks>
  readonly reads: ChatReads
  readonly cards: CheckedProposal[]
  ref(kind: string, id: string): string
  propose(steps: readonly { readonly op: string; readonly input: unknown; readonly as?: string }[], attachments?: readonly ChatAttachment[]): ReturnType<typeof proposeChanges>
  accept(at?: number): ReturnType<ReturnType<typeof spendingAcceptance>['accept']>
}

export async function spendingDesk(used: Set<string>, receipts: ReceiptPorts = receiptPorts()): Promise<SpendingDesk> {
  const document = spendingDocumentOf('2026-11-07T09:00:00.000Z', {
    ...stored(ACCOUNT_RECORDS, [CURRENT, SAVINGS, DOLLARS, WALLET, REVOLUT]),
    ...stored(CATEGORY_RECORDS, [FOOD, GROCERIES, RESTAURANTS, RENT, SALARY, TRANSFER, FOR_COMPANY]),
    ...stored(TRANSACTION_RECORDS, ROWS),
    ...stored(RULE_RECORDS, [RULE]),
    ...stored(RECEIPT_RECORDS, [RECEIPT]),
  })
  const { store } = await browserHarness(used, document, SPENDING)
  const typed = store as unknown as WorkbookStore<SpendingBooks>
  const reads: ChatReads = { readers: new Map(), pseudonyms: newPseudonyms(), refs: chatRefs(), anonymising: () => true, persons: () => [], mayRead: async () => true }
  const cards: CheckedProposal[] = []
  const proposers = new Map([['spending', spendingProposer(typed, receipts)]])
  const acceptance = spendingAcceptance(typed, receipts)
  return {
    store: typed,
    reads,
    cards,
    ref: (kind, id) => reads.refs.recordRef({ app: 'spending', kind, id }),
    propose: (steps, attachments = []) =>
      proposeChanges(
        { app: 'spending', title: 'A title', steps: steps.map((step) => ({ op: step.op, input: JSON.stringify(step.input), as: step.as ?? null })) },
        proposers,
        reads,
        attachments,
        (_app, card) => cards.push(card),
      ),
    accept: (at = cards.length - 1) => acceptance.accept(cards[at]!),
  }
}
