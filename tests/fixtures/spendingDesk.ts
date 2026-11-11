import { vi } from 'vitest'
import { FILE_OPEN } from './browserFile'

import type { ReceiptPorts } from '../../src/apps/spending/assistant/operations/receiptOperation'
import { spendingAcceptance, spendingProposer } from '../../src/apps/spending/assistant/operations/spendingOperations'
import type { SpendingPorts } from '../../src/apps/spending/assistant/operations/spendingOperations'
import type { BankSetup } from '../../src/apps/spending/bankSync/application/bankSync'
import { proposeAccount } from '../../src/apps/spending/bankSync/domain/bankAccountSetup'
import type { BankTransaction, LinkedAccount } from '../../src/apps/spending/bankSync/domain/bankAnswer'
import { forgetLastAccount, lastAccountId, rememberLastAccount, startingAccount } from '../../src/apps/spending/entries/infrastructure/lastAccount'
import { BANK_ACCOUNTS_NOT_IN_KUNA_KEY } from '../../src/apps/spending/workbook/domain/spendingSettings'
import { settingRow } from '../../src/shared/storage/domain/settingRows'
import { codecOfSpendingKind } from '../../src/apps/spending/workbook/application/spendingCodecs'
import type { Account } from '../../src/apps/spending/workbook/domain/account'
import type { Category } from '../../src/apps/spending/workbook/domain/category'
import type { EntryPart } from '../../src/apps/spending/workbook/domain/entryPart'
import type { Receipt } from '../../src/apps/spending/workbook/domain/receipt'
import type { SpendingBooks } from '../../src/apps/spending/workbook/domain/spendingBooks'
import { ACCOUNT_RECORDS, CATEGORY_RECORDS, PART_RECORDS, RECEIPT_RECORDS, RULE_RECORDS, SETTING_RECORDS, TRANSACTION_RECORDS } from '../../src/apps/spending/workbook/domain/spendingKinds'
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
  return {
    id: recordIdOf(ACCOUNT_RECORDS, key),
    name,
    kind: 'bank',
    bank: 'otp',
    currency: EUR,
    opening: accountMoneyFromAmount(1000),
    openedOn: on('2026-01-01'),
    rowsFrom: 'by-hand',
    iban: '',
    closed: false,
    ...fields,
  }
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

/** All made up: a typed row, a bank row with a receipt, a bank row near a typed one, two rows that may be one transfer, a transfer a statement paired, a typed row split by hand, cash taken out with no cash leg yet, and a Revolut payment a waiting receipt may be. */
const ROWS: readonly Transaction[] = [
  row('transaction-typed', '2026-10-12', -45.3, 'Corner market', { source: 'typed', category: GROCERIES.id, categorisedBy: 'person' }),
  row('transaction-receipt', '2026-10-14', -20, 'Bakery', { category: GROCERIES.id, categorisedBy: 'rule', importKey: 'made-up-2' }),
  row('transaction-pharmacy-typed', '2026-10-20', -30, 'Pharmacy', { source: 'typed', category: RENT.id, categorisedBy: 'person' }),
  row('transaction-pharmacy-bank', '2026-10-21', -31, 'PHARMACY 22', { importKey: 'made-up-4' }),
  row('transaction-out', '2026-10-25', -200, '', { importKey: 'made-up-5' }),
  row('transaction-in', '2026-10-25', 200, '', { account: SAVINGS.id, importKey: 'made-up-6' }),
  row('transaction-paired-out', '2026-10-28', -100, '', { importKey: 'made-up-7', category: TRANSFER.id, pair: recordIdOf(TRANSACTION_RECORDS, 'transaction-paired-in') }),
  row('transaction-paired-in', '2026-10-28', 100, '', { account: SAVINGS.id, importKey: 'made-up-8', category: TRANSFER.id, pair: recordIdOf(TRANSACTION_RECORDS, 'transaction-paired-out') }),
  row('transaction-split', '2026-10-30', -60, 'Hardware store', { source: 'typed', category: RENT.id, categorisedBy: 'person' }),
  row('transaction-withdrawal', '2026-10-29', -50, 'Cash at Ilica ATM', { account: REVOLUT.id, importKey: 'made-up-9', category: TRANSFER.id, cashWithdrawal: true }),
  row('transaction-waiting-match', '2026-10-27', -18, 'KIOSK TISAK', { account: REVOLUT.id, importKey: 'made-up-10', category: GROCERIES.id, categorisedBy: 'rule' }),
]

function handPart(key: string, amount: number, category: Category): EntryPart {
  return {
    id: recordIdOf(PART_RECORDS, key),
    transaction: recordIdOf(TRANSACTION_RECORDS, 'transaction-split'),
    receipt: null,
    printed: '',
    text: '',
    amount: accountMoneyFromAmount(amount),
    category: category.id,
  }
}

const HAND_PARTS: readonly EntryPart[] = [handPart('line-hardware-rent', -40, RENT), handPart('line-hardware-groceries', -20, GROCERIES)]

const RECEIPT: Receipt = {
  id: recordIdOf(RECEIPT_RECORDS, 'receipt-bakery'),
  transaction: recordIdOf(TRANSACTION_RECORDS, 'transaction-receipt'),
  account: null,
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

/** A receipt for a card payment on Revolut that waits for the bank's row, with its one line. */
const WAITING_RECEIPT: Receipt = {
  ...RECEIPT,
  id: recordIdOf(RECEIPT_RECORDS, 'receipt-waiting'),
  transaction: null,
  account: REVOLUT.id,
  merchant: 'Kiosk',
  merchantOib: '',
  issuedOn: on('2026-10-26'),
  total: moneyFromAmount(18),
  jir: '',
  zki: '',
}

const WAITING_LINE: EntryPart = {
  id: recordIdOf(PART_RECORDS, 'line-kiosk'),
  transaction: null,
  receipt: WAITING_RECEIPT.id,
  printed: 'NOVINE',
  text: 'novine',
  amount: accountMoneyFromAmount(-18),
  category: GROCERIES.id,
}

const RULE: SpendingRule = { id: recordIdOf(RULE_RECORDS, 'rule-corner'), order: 1, condition: { column: 'counterparty_contains', fragment: 'Corner' }, category: GROCERIES.id, withdrawal: null }

function linkedAccount(uid: string, iban: string, currency: string, described: Partial<LinkedAccount> = {}): LinkedAccount {
  return { uid, iban, currency, product: null, details: null, cashAccountType: null, usage: null, identificationHash: null, ...described }
}

const LEFT_OUT_IBAN = 'LT000000000000000007'

function poundRow(reference: string, bookedOn: string, amount: string, direction: BankTransaction['direction']): BankTransaction {
  const party = direction === 'CRDT' ? { debtorName: 'Pay from abroad', creditorName: null } : { debtorName: null, creditorName: 'Bookshop in London' }
  return { reference, amount, currency: 'GBP', direction, status: 'BOOK', bookedOn, valueOn: null, madeOn: null, creditorIban: null, debtorIban: null, remittance: [], exchangeRate: null, ...party }
}

/**
 * What the page holds after a made-up bank sync: a Revolut pound account Kuna does not keep, drafted with a row in September and one in October, the OTP
 * account Current kept by its IBAN that the bank calls savings, a Revolut account left out of Kuna, and a balance on Current
 * that the opening would fix.
 */
export function deskBankSetup(): BankSetup {
  const pounds = linkedAccount('uid-pounds', 'LT000000000000000009', 'GBP')
  return {
    linked: [
      { bank: 'revolut', account: pounds },
      { bank: 'otp', account: linkedAccount('uid-current', CURRENT.iban, 'EUR', { cashAccountType: 'SVGS' }) },
      { bank: 'revolut', account: linkedAccount('uid-left-out', LEFT_OUT_IBAN, 'EUR') },
    ],
    proposals: [
      proposeAccount(
        pounds,
        'revolut',
        currencyCodeOf('GBP')!,
        [poundRow('gbp-in', '2026-09-20', '100.00', 'CRDT'), poundRow('gbp-out', '2026-10-20', '25.00', 'DBIT')],
        [{ amount: '200.00', currency: 'GBP', type: 'ITAV' }],
        recordIdOf(ACCOUNT_RECORDS, 'account-pounds'),
        on('2026-11-07'),
        [],
      ),
    ],
    differences: [{ account: CURRENT, stated: accountMoneyFromAmount(900), worked: accountMoneyFromAmount(1000), pending: null, explained: false, fixedOpening: accountMoneyFromAmount(900) }],
    olderRows: [],
  }
}

/** The record each operation's example names, by the name it gives it. */
export const EXAMPLE_RECORDS: Readonly<Record<string, string>> = {
  category: RENT.id,
  'category-other': GROCERIES.id,
  'category-child': RESTAURANTS.id,
  transaction: recordIdOf(TRANSACTION_RECORDS, 'transaction-typed'),
  'transaction-receipt': recordIdOf(TRANSACTION_RECORDS, 'transaction-receipt'),
  'transaction-split': recordIdOf(TRANSACTION_RECORDS, 'transaction-split'),
  'transaction-joinable': recordIdOf(TRANSACTION_RECORDS, 'transaction-pharmacy-bank'),
  'transaction-pairable': recordIdOf(TRANSACTION_RECORDS, 'transaction-out'),
  'transaction-paired': recordIdOf(TRANSACTION_RECORDS, 'transaction-paired-out'),
  'transaction-withdrawal': recordIdOf(TRANSACTION_RECORDS, 'transaction-withdrawal'),
  'transaction-waiting-match': recordIdOf(TRANSACTION_RECORDS, 'transaction-waiting-match'),
  'receipt-waiting': WAITING_RECEIPT.id,
  account: CURRENT.id,
  'account-other': SAVINGS.id,
  'account-empty': WALLET.id,
  rule: RULE.id,
  'bank-account-missing': 'uid-pounds GBP',
  'bank-account-update': 'uid-current EUR',
  'bank-account-left-out': 'uid-left-out EUR',
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

/** The ports `app.ts` hands the operations, with the desk's bank set-up list and this browser's starting account kept in a made-up storage. */
export function deskPorts(receipts: ReceiptPorts = receiptPorts(), bankSetup: BankSetup | null = deskBankSetup()): SpendingPorts {
  const stored = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, text: string) => stored.set(key, text),
    removeItem: (key: string) => stored.delete(key),
  })
  return { receipts, device: { bankSetup: () => bankSetup, lastAccountId, startingAccount, rememberLastAccount, forgetLastAccount } }
}

/** A photo attached to the chat, of a few made-up bytes with no QR code and no place in them. */
export function attachedPhoto(id = 'a1'): ChatAttachment {
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9])
  return { id, kind: 'photo', name: 'receipt.jpg', bytes, original: new Blob([bytes], { type: 'image/jpeg' }), pages: 1, sent: { width: 1, height: 1 }, reading: { kind: 'whole' } }
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

export async function spendingDesk(used: Set<string>, ports: SpendingPorts = deskPorts()): Promise<SpendingDesk> {
  const document = spendingDocumentOf('2026-11-07T09:00:00.000Z', {
    ...stored(ACCOUNT_RECORDS, [CURRENT, SAVINGS, DOLLARS, WALLET, REVOLUT]),
    ...stored(CATEGORY_RECORDS, [FOOD, GROCERIES, RESTAURANTS, RENT, SALARY, TRANSFER, FOR_COMPANY]),
    ...stored(TRANSACTION_RECORDS, ROWS),
    ...stored(RULE_RECORDS, [RULE]),
    ...stored(RECEIPT_RECORDS, [RECEIPT, WAITING_RECEIPT]),
    ...stored(PART_RECORDS, [...HAND_PARTS, WAITING_LINE]),
    ...stored(SETTING_RECORDS, [settingRow(SETTING_RECORDS, BANK_ACCOUNTS_NOT_IN_KUNA_KEY, `${LEFT_OUT_IBAN} EUR`)]),
  })
  const { store } = await browserHarness(used, document, SPENDING)
  const typed = store as unknown as WorkbookStore<SpendingBooks>
  const reads: ChatReads = { readers: new Map(), pseudonyms: newPseudonyms(), refs: chatRefs(), anonymising: () => true, persons: () => [], mayRead: () => true }
  const cards: CheckedProposal[] = []
  const proposers = new Map([['spending', spendingProposer(typed, ports, FILE_OPEN)]])
  const acceptance = spendingAcceptance(typed, ports, FILE_OPEN)
  return {
    store: typed,
    reads,
    cards,
    ref: (kind, id) => reads.refs.recordRef({ app: 'spending', kind, id }),
    propose: (steps, attachments = []) =>
      proposeChanges(
        { app: 'spending', title: 'A title', steps: steps.map((step) => ({ op: step.op, input: JSON.stringify(step.input), as: step.as ?? null })), next: false },
        proposers,
        reads,
        attachments,
        (_app, card) => cards.push(card),
      ),
    accept: (at = cards.length - 1) => acceptance.accept(cards[at]!),
  }
}
