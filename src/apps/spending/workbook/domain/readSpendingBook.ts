import { bankLinkWithoutIban, beforeStartDay } from './account'
import type { Account } from './account'
import { ibanKey } from './accountReading'
import type { Budget } from './budget'
import type { Category } from './category'
import { isFixedKind } from './category'
import type { TransactionItem } from './transactionItem'
import type { HeldBankRow } from './heldBankRow'
import type { Receipt } from './receipt'
import { ACCOUNT_RECORDS, BUDGET_RECORDS, CATEGORY_RECORDS, HELD_ROW_RECORDS, ITEM_RECORDS, RECEIPT_RECORDS, RULE_RECORDS, SETTING_RECORDS, TRANSACTION_RECORDS } from './spendingKinds'
import type { SpendingRule } from './spendingRule'
import {
  BANK_ACCOUNTS_KEEP_MINE_KEY,
  BANK_ACCOUNTS_NOT_IN_KUNA_KEY,
  BANK_SYNC_DEPLOYMENT_KEY,
  LINKABLE_BANKS,
  PERSON_PAYEES_KEY,
  bankFetchedKey,
  bankLinkKey,
  isBankAccountLine,
  linesOf,
  spendingSettingsOf,
  utcTimeOf,
} from './spendingSettings'
import type { SpendingSettings } from './spendingSettings'
import { rowKey } from './transaction'
import type { Transaction } from './transaction'
import { words } from './words'
import { limitRuns, runsOverlap } from '../../budgets/domain/budgetCarry'
import { accountMoneyOfEuros, negateAccountMoney, sumAccountMoney } from '../../../../shared/money/accountMoney'
import type { AccountMoney } from '../../../../shared/money/accountMoney'
import { restOfWhole } from '../../../../shared/money/partsOfWhole'
import { plainAmount } from '../../../../shared/money/money'
import type { RecordKind, RecordNoun } from '../../../../shared/storage/domain/recordKind'
import { problemOf, readEach } from '../../../../shared/storage/domain/recordsRead'
import type { Reading, RecordProblem, RecordsRead } from '../../../../shared/storage/domain/recordsRead'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { ANY_VALUE, readSettingRows } from '../../../../shared/storage/domain/settingRows'
import { words as recordWords } from '../../../../shared/storage/domain/words'
import type { SettingChecks, SettingRow, SettingValueCheck } from '../../../../shared/storage/domain/settingRows'
import { parseCivilDate } from '../../../../shared/calendar/civilDate'
import { sharedKeys } from '../../../../shared/storage/domain/sharedKeys'
import { listInWords } from '../../../../shared/text/listInWords'

function bankAccountLinesCheck(key: string): SettingValueCheck {
  return (value: string) => linesOf(value).flatMap((line) => (isBankAccountLine(line) ? [] : [words.settingNotABankAccount(key, line)]))
}

/** Each key Spending knows, a bank's link ending only on a day, and a bank's last fetch only at a UTC time. */
export const SPENDING_SETTING_CHECKS: SettingChecks = new Map<string, SettingValueCheck>([
  [BANK_SYNC_DEPLOYMENT_KEY, ANY_VALUE],
  [PERSON_PAYEES_KEY, ANY_VALUE],
  [BANK_ACCOUNTS_NOT_IN_KUNA_KEY, bankAccountLinesCheck(BANK_ACCOUNTS_NOT_IN_KUNA_KEY)],
  [BANK_ACCOUNTS_KEEP_MINE_KEY, bankAccountLinesCheck(BANK_ACCOUNTS_KEEP_MINE_KEY)],
  ...LINKABLE_BANKS.map(bankLinkKey).map((key) => [key, (value: string) => (parseCivilDate(value) === null ? [words.settingNotADay(key, value)] : [])] as const),
  ...LINKABLE_BANKS.map(bankFetchedKey).map((key) => [key, (value: string) => (utcTimeOf(value) === null ? [words.settingNotATime(key, value)] : [])] as const),
])

/** Keys Spending no longer reads that older files may still hold. Company's OIB is read from Company now. */
export const SPENDING_RETIRED_SETTING_KEYS: ReadonlySet<string> = new Set(['company_oib'])

/** What the Spending file holds of each kind. */
export interface SpendingRecords {
  readonly accounts: RecordsRead<Account>
  readonly categories: RecordsRead<Category>
  readonly transactions: RecordsRead<Transaction>
  readonly budgets: RecordsRead<Budget>
  readonly rules: RecordsRead<SpendingRule>
  readonly receipts: RecordsRead<Receipt>
  /** The items of transactions, kept as `line` records. */
  readonly items: RecordsRead<TransactionItem>
  readonly held: RecordsRead<HeldBankRow>
  readonly settings: RecordsRead<SettingRow>
}

/** The kind each part of the records holds. */
export const SPENDING_PARTS: { readonly [Part in keyof SpendingRecords]: RecordKind<SpendingRecords[Part]['records'][number]['record']> } = {
  accounts: ACCOUNT_RECORDS,
  categories: CATEGORY_RECORDS,
  transactions: TRANSACTION_RECORDS,
  budgets: BUDGET_RECORDS,
  rules: RULE_RECORDS,
  receipts: RECEIPT_RECORDS,
  items: ITEM_RECORDS,
  held: HELD_ROW_RECORDS,
  settings: SETTING_RECORDS,
}

/** The records of every Spending kind, as `of` gives each kind. */
export function spendingRecordsOf(of: <R>(kind: RecordKind<R>) => RecordsRead<R>): SpendingRecords {
  return {
    accounts: of(SPENDING_PARTS.accounts),
    categories: of(SPENDING_PARTS.categories),
    transactions: of(SPENDING_PARTS.transactions),
    budgets: of(SPENDING_PARTS.budgets),
    rules: of(SPENDING_PARTS.rules),
    receipts: of(SPENDING_PARTS.receipts),
    items: of(SPENDING_PARTS.items),
    held: of(SPENDING_PARTS.held),
    settings: of(SPENDING_PARTS.settings),
  }
}

/** Which records of each kind count, and why the rest do not or are doubted. */
export type SpendingReadings = { readonly [Part in keyof SpendingRecords]: Reading<SpendingRecords[Part]['records'][number]['record']> }

/** A record problem with the kind of the record it is about, by its name and by what a sentence calls it. */
export interface SpendingProblem extends RecordProblem {
  readonly kind: string
  readonly noun: RecordNoun
}

export interface SpendingBook {
  readonly accounts: readonly Account[]
  /** Groups and children, in the order of the file. */
  readonly categories: readonly Category[]
  /** Oldest first, and in the order of the file within a day. */
  readonly transactions: readonly Transaction[]
  readonly budgets: readonly Budget[]
  /** In the order they are tried. */
  readonly rules: readonly SpendingRule[]
  readonly receipts: readonly Receipt[]
  /** In the order of the file. */
  readonly items: readonly TransactionItem[]
  /** The bank rows the sync left out, waiting on To review, in the order of the file. */
  readonly held: readonly HeldBankRow[]
  readonly settings: SpendingSettings
  readonly readings: SpendingReadings
  /** Every kind's problems, in the order of the kinds. */
  readonly problems: readonly SpendingProblem[]
}

/** Records that count but are doubted: each keeps counting, with a problem that says why. */
function doubted<R>(reading: Reading<R>, read: RecordsRead<R>, reasonOf: (record: R) => string | null): Reading<R> {
  const problems = read.records.flatMap((stored) => {
    const reason = reading.facts.includes(stored.record) ? reasonOf(stored.record) : null
    return reason === null ? [] : [problemOf(stored, reason)]
  })
  return { facts: reading.facts, problems: [...reading.problems, ...problems] }
}

/** Accounts count, but one that shares its IBAN and currency with another, or takes its rows from a bank link with no IBAN, is doubted. */
function readAccounts(read: RecordsRead<Account>): Reading<Account> {
  const ibanOf = (account: Account): string | null => (account.iban === '' ? null : `${ibanKey(account.iban)} ${account.currency}`)
  return doubted(
    readEach(read, () => []),
    read,
    (account) => {
      if (bankLinkWithoutIban(account)) return words.bankLinkWithoutIban
      const key = ibanOf(account)
      const others = key === null ? [] : read.records.filter((stored) => stored.record !== account && ibanOf(stored.record) === key).map((stored) => stored.record.name.trim())
      return others.length === 0 ? null : words.ibanShared(listInWords(others), ibanKey(account.iban), account.currency)
    },
  )
}

function readCategories(read: RecordsRead<Category>): Reading<Category> {
  const byId = new Map(read.records.map((stored) => [stored.id, stored.record]))
  const fixedShared = sharedKeys(
    read.records.filter((stored) => isFixedKind(stored.record.kind)),
    (stored) => stored.record.kind,
  )
  const reading = readEach(read, ({ record: category }) => {
    if (category.parent === null) return []
    const parent = byId.get(category.parent)
    if (parent === undefined) return [words.noParent]
    if (parent.parent !== null) return [words.parentHasParent]
    return parent.kind === category.kind ? [] : [words.parentOfOtherKind]
  })
  return doubted(reading, read, (category) => (isFixedKind(category.kind) && fixedShared.has(category.kind) ? words.fixedShared(category.kind) : null))
}

/** Why a row of an account is not on it: the account is not in the file, or the row is from before the account's start day. */
function accountReason(accounts: ReadonlyMap<string, Account>, row: Pick<Transaction, 'account' | 'date'>): string | null {
  const account = accounts.get(row.account)
  if (account === undefined) return words.noAccount
  return beforeStartDay(account, row.date) ? words.beforeStartDay(account.openedOn) : null
}

function readTransactions(read: RecordsRead<Transaction>, accounts: ReadonlyMap<string, Account>, categories: ReadonlySet<string>): Reading<Transaction> {
  const byId = new Map(read.records.map((stored) => [stored.id, stored.record]))
  const sharingKey = sharedKeys(
    read.records.filter((stored) => stored.record.importKey !== ''),
    (stored) => rowKey(stored.record),
  )
  const reading = readEach(read, ({ record: transaction }) => {
    const onAccount = accountReason(accounts, transaction)
    if (onAccount !== null) return [onAccount]
    if (transaction.importKey !== '' && sharingKey.has(rowKey(transaction))) return [words.importKeyShared(transaction.importKey)]
    if (transaction.category !== null && !categories.has(transaction.category)) return [words.noCategory]
    if (transaction.pair === null) return []
    const other = byId.get(transaction.pair)
    if (other?.pair !== transaction.id) return [words.pairNotBack]
    return other.account === transaction.account ? [words.pairOnSameAccount] : []
  })
  return { ...reading, facts: [...reading.facts].sort((earlier, later) => earlier.date.localeCompare(later.date)) }
}

function readBudgets(read: RecordsRead<Budget>, categories: readonly Category[]): Reading<Budget> {
  const byId = new Map(categories.map((category) => [category.id, category]))
  const sharingMonth = sharedKeys(read.records, (stored) => `${stored.record.category} ${stored.record.from}`)
  const onSpending = read.records.map((stored) => stored.record).filter((budget) => byId.get(budget.category)?.kind === 'spending')
  const overlapsKin = (budget: Budget): boolean => {
    const category = byId.get(budget.category)!
    const kin = categories.filter((other) => other.id === category.parent || other.parent === category.id)
    const ownRuns = limitRuns(onSpending, category.id)
    return kin.some((other) => limitRuns(onSpending, other.id).some((theirs) => ownRuns.some((own) => runsOverlap(own, theirs))))
  }
  return readEach(read, ({ record: budget }) => {
    const category = byId.get(budget.category)
    if (category === undefined) return [words.noCategory]
    if (category.kind !== 'spending') return [words.notSpending]
    if (sharingMonth.has(`${budget.category} ${budget.from}`)) return [words.budgetSharesMonth(budget.from)]
    return overlapsKin(budget) ? [words.budgetOnGroupAndChild] : []
  })
}

/** Why a rule does not count: it names no category that counts, or it spots a withdrawal off Between my accounts or into an account that is not cash. */
function readRules(read: RecordsRead<SpendingRule>, categories: readonly Category[], accounts: readonly Account[]): Reading<SpendingRule> {
  const kindOf = new Map(categories.map((category) => [category.id, category.kind]))
  const cash = new Set(accounts.filter((account) => account.kind === 'cash').map((account) => account.id))
  const reading = readEach(read, ({ record: rule }) => {
    if (!kindOf.has(rule.category)) return [words.noCategory]
    if (rule.withdrawal === null) return []
    if (kindOf.get(rule.category) !== 'transfer') return [words.withdrawalNotTransfer]
    return rule.withdrawal.cashAccount === null || cash.has(rule.withdrawal.cashAccount) ? [] : [words.withdrawalNotCash]
  })
  return { ...reading, facts: [...reading.facts].sort((earlier, later) => earlier.order - later.order) }
}

function readReceipts(read: RecordsRead<Receipt>, transactions: ReadonlySet<string>, accounts: ReadonlyMap<string, Account>): Reading<Receipt> {
  const sharingRow = sharedKeys(
    read.records.filter((stored) => stored.record.transaction !== null),
    (stored) => stored.record.transaction ?? '',
  )
  const codes = read.records.flatMap(({ record }) => [record.jir, record.zki].filter((code) => code !== ''))
  const sharingCode = sharedKeys(codes, (code) => code)
  return readEach(read, ({ record: receipt }) => {
    if (receipt.transaction === null) {
      if (receipt.account === null || !accounts.has(receipt.account)) return [words.waitingOnNoAccount]
    } else {
      if (!transactions.has(receipt.transaction)) return [words.noEntry]
      if (sharingRow.has(receipt.transaction)) return [words.entryHasReceipt]
    }
    return sharingCode.has(receipt.jir) || sharingCode.has(receipt.zki) ? [words.fiscalCodeShared] : []
  })
}

/** What the parts of an entry add up to: the entry's amount, or for the lines of a receipt that waits, minus its total. */
function wholeOfParts(transactions: readonly Transaction[], receipts: readonly Receipt[]): ReadonlyMap<RecordId, AccountMoney> {
  return new Map<RecordId, AccountMoney>([
    ...transactions.map((row) => [row.id, row.amount] as const),
    ...receipts.flatMap((receipt) => (receipt.transaction === null ? [[receipt.id, negateAccountMoney(accountMoneyOfEuros(receipt.total))] as const] : [])),
  ])
}

function readItems(read: RecordsRead<TransactionItem>, transactions: readonly Transaction[], receipts: readonly Receipt[], categories: ReadonlySet<string>): Reading<TransactionItem> {
  const wholes = wholeOfParts(transactions, receipts)
  const receiptOf = new Map(receipts.map((receipt) => [receipt.id, receipt]))
  /** The entry the part is of, or the waiting receipt whose line it is, which its siblings share. */
  const wholeOf = (part: TransactionItem): RecordId | null => part.transaction ?? part.receipt
  const ownReason = (part: TransactionItem): string | null => {
    const whole = wholeOf(part)
    if (whole === null || !wholes.has(whole)) return part.transaction === null ? words.noReceipt : words.noEntry
    if (part.receipt !== null && receiptOf.get(part.receipt)?.transaction !== part.transaction) return words.noReceipt
    return part.category !== null && categories.has(part.category) ? null : words.noCategory
  }
  const amountsOf = new Map<RecordId | null, AccountMoney[]>()
  const brokenWholes = new Set<RecordId | null>()
  for (const { record: part } of read.records) {
    amountsOf.set(wholeOf(part), [...(amountsOf.get(wholeOf(part)) ?? []), part.amount])
    if (ownReason(part) !== null) brokenWholes.add(wholeOf(part))
  }
  return readEach(read, ({ record: part }) => {
    const own = ownReason(part)
    if (own !== null) return [own]
    // All or none, since parts left counting without their sibling would drop its money from every figure.
    if (brokenWholes.has(wholeOf(part))) return [words.siblingPartLeftOut]
    const amounts = amountsOf.get(wholeOf(part)) ?? []
    const whole = wholes.get(wholeOf(part)!)!
    return restOfWhole(whole, amounts) === 0 ? [] : [words.partsDoNotAddUp(plainAmount(sumAccountMoney(amounts)), plainAmount(whole))]
  })
}

/**
 * Why a bank row on hold does not count: it carries no import key, it names an account that does not count or is from before
 * that account's start day, or an entry or another held row of its account already has its import key. One whose look-alike
 * is gone still counts, and To review says so. The write of a held row reads the same.
 */
function readHeld(read: RecordsRead<HeldBankRow>, accounts: ReadonlyMap<string, Account>, transactions: readonly Transaction[]): Reading<HeldBankRow> {
  const booked = new Set(transactions.filter((row) => row.importKey !== '').map(rowKey))
  const sharingKey = sharedKeys(read.records, (stored) => rowKey(stored.record))
  return readEach(read, ({ record: held }) => {
    if (held.importKey === '') return [words.heldRowNoKey]
    const onAccount = accountReason(accounts, held)
    if (onAccount !== null) return [onAccount]
    if (booked.has(rowKey(held))) return [words.heldRowBooked(held.importKey)]
    return sharingKey.has(rowKey(held)) ? [words.heldRowShared(held.importKey)] : []
  })
}

/**
 * Reads the Spending file with the rules across records. A child names a group of its kind that counts, and each of the
 * three fixed kinds is one category. An entry names an account that counts, on or after its start day, and a category that counts, and its other leg names it
 * back from another account. A limit is on a spending category, one a month, and never on a group and its child in the
 * same months. A rule names a category that counts, and one that spots a withdrawal files into Between my accounts and names a cash account or none. A receipt names an entry that counts, which no other receipt names, or while it waits for the bank's row an account that counts, and no other receipt holds its JIR or ZKI. A part
 * of an entry names that entry, a category that counts and, when a receipt split it, that entry's receipt. A line of a waiting receipt names that receipt and no entry. The parts of an entry add up to its amount, and the lines of a waiting receipt to minus its total, and count all or none. Two accounts with one IBAN and currency, an account whose rows come from a bank link with no IBAN, and a second category of a fixed
 * kind, count but are doubted. Two entries of an account with one import key are refused, and so is a bank row on hold that
 * `readHeld` refuses.
 */
export function readSpendingBook(records: SpendingRecords): SpendingBook {
  const accounts = readAccounts(records.accounts)
  const categories = readCategories(records.categories)
  const categoryIds = new Set(categories.facts.map((category) => category.id))
  const accountsById = new Map(accounts.facts.map((account) => [account.id, account]))
  const transactions = readTransactions(records.transactions, accountsById, categoryIds)
  const budgets = readBudgets(records.budgets, categories.facts)
  const rules = readRules(records.rules, categories.facts, accounts.facts)
  const receipts = readReceipts(records.receipts, new Set(transactions.facts.map((row) => row.id)), accountsById)
  const items = readItems(records.items, transactions.facts, receipts.facts, categoryIds)
  const held = readHeld(records.held, accountsById, transactions.facts)
  const settings = readSettingRows(records.settings, SPENDING_SETTING_CHECKS, SPENDING_RETIRED_SETTING_KEYS, recordWords.settingUnknown)
  const readings: SpendingReadings = { accounts, categories, transactions, budgets, rules, receipts, items, held, settings }
  return {
    accounts: accounts.facts,
    categories: categories.facts,
    transactions: transactions.facts,
    budgets: budgets.facts,
    rules: rules.facts,
    receipts: receipts.facts,
    items: items.facts,
    held: held.facts,
    settings: spendingSettingsOf(settings.facts),
    readings,
    problems: (Object.keys(SPENDING_PARTS) as (keyof SpendingRecords)[]).flatMap((part) =>
      readings[part].problems.map((problem) => ({ kind: SPENDING_PARTS[part].name, noun: SPENDING_PARTS[part].noun, ...problem })),
    ),
  }
}
