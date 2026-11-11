import { beforeStartDay } from './account'
import type { Account } from './account'
import { ibanKey } from './accountReading'
import type { Budget } from './budget'
import type { Category } from './category'
import { isFixedKind } from './category'
import type { EntryPart } from './entryPart'
import type { HeldBankRow } from './heldBankRow'
import type { Receipt } from './receipt'
import { ACCOUNT_RECORDS, BUDGET_RECORDS, CATEGORY_RECORDS, HELD_ROW_RECORDS, PART_RECORDS, RECEIPT_RECORDS, RULE_RECORDS, SETTING_RECORDS, TRANSACTION_RECORDS } from './spendingKinds'
import type { SpendingRule } from './spendingRule'
import { SPENDING_SETTING_CHECKS, spendingSettingsOf } from './spendingSettings'
import type { SpendingSettings } from './spendingSettings'
import { rowKey } from './transaction'
import type { Transaction } from './transaction'
import { words } from './words'
import { limitRuns, runsOverlap } from '../../budgets/domain/budgetCarry'
import { sumAccountMoney } from '../../../../shared/money/accountMoney'
import type { AccountMoney } from '../../../../shared/money/accountMoney'
import { plainAmount } from '../../../../shared/money/money'
import type { RecordKind, RecordNoun } from '../../../../shared/storage/domain/recordKind'
import { problemOf, readEach } from '../../../../shared/storage/domain/recordsRead'
import type { Reading, RecordProblem, RecordsRead } from '../../../../shared/storage/domain/recordsRead'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { readSettingRows } from '../../../../shared/storage/domain/settingRows'
import type { SettingRow } from '../../../../shared/storage/domain/settingRows'
import { sharedKeys } from '../../../../shared/storage/domain/sharedKeys'
import { listInWords } from '../../../../shared/text/listInWords'

/** What the Spending file holds of each kind. */
export interface SpendingRecords {
  readonly accounts: RecordsRead<Account>
  readonly categories: RecordsRead<Category>
  readonly transactions: RecordsRead<Transaction>
  readonly budgets: RecordsRead<Budget>
  readonly rules: RecordsRead<SpendingRule>
  readonly receipts: RecordsRead<Receipt>
  /** The parts entries are split into, kept as `line` records. */
  readonly lines: RecordsRead<EntryPart>
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
  lines: PART_RECORDS,
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
    lines: of(SPENDING_PARTS.lines),
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
  readonly lines: readonly EntryPart[]
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
      if (account.rowsFrom === 'bank-link' && account.iban === '') return words.bankLinkWithoutIban
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

function readReceipts(read: RecordsRead<Receipt>, transactions: ReadonlySet<string>): Reading<Receipt> {
  const sharingRow = sharedKeys(read.records, (stored) => stored.record.transaction)
  const codes = read.records.flatMap(({ record }) => [record.jir, record.zki].filter((code) => code !== ''))
  const sharingCode = sharedKeys(codes, (code) => code)
  return readEach(read, ({ record: receipt }) => {
    if (!transactions.has(receipt.transaction)) return [words.noEntry]
    if (sharingRow.has(receipt.transaction)) return [words.entryHasReceipt]
    return sharingCode.has(receipt.jir) || sharingCode.has(receipt.zki) ? [words.fiscalCodeShared] : []
  })
}

function readParts(read: RecordsRead<EntryPart>, transactions: readonly Transaction[], receipts: readonly Receipt[], categories: ReadonlySet<string>): Reading<EntryPart> {
  const rows = new Map(transactions.map((row) => [row.id, row]))
  const receiptOf = new Map(receipts.map((receipt) => [receipt.id, receipt]))
  const ownReason = (part: EntryPart): string | null => {
    if (!rows.has(part.transaction)) return words.noEntry
    if (part.receipt !== null && receiptOf.get(part.receipt)?.transaction !== part.transaction) return words.noReceipt
    return categories.has(part.category) ? null : words.noCategory
  }
  const sums = new Map<RecordId, AccountMoney[]>()
  const brokenRows = new Set<RecordId>()
  for (const { record: part } of read.records) {
    sums.set(part.transaction, [...(sums.get(part.transaction) ?? []), part.amount])
    if (ownReason(part) !== null) brokenRows.add(part.transaction)
  }
  return readEach(read, ({ record: part }) => {
    const own = ownReason(part)
    if (own !== null) return [own]
    // All or none, since parts left counting without their sibling would drop its money from every figure.
    if (brokenRows.has(part.transaction)) return [words.siblingPartLeftOut]
    const sum = sumAccountMoney(sums.get(part.transaction) ?? [])
    const amount = rows.get(part.transaction)?.amount
    return sum === amount ? [] : [words.partsDoNotAddUp(plainAmount(sum), plainAmount(amount ?? sum))]
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
 * same months. A rule names a category that counts, and one that spots a withdrawal files into Between my accounts and names a cash account or none. A receipt names an entry that counts, which no other receipt names, and no other receipt holds its JIR or ZKI. A part
 * of an entry names that entry, a category that counts and, when a receipt split it, that entry's receipt. The parts of an entry add up to its amount and count all or none. Two accounts with one IBAN and currency, an account whose rows come from a bank link with no IBAN, and a second category of a fixed
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
  const receipts = readReceipts(records.receipts, new Set(transactions.facts.map((row) => row.id)))
  const lines = readParts(records.lines, transactions.facts, receipts.facts, categoryIds)
  const held = readHeld(records.held, accountsById, transactions.facts)
  const settings = readSettingRows(records.settings, SPENDING_SETTING_CHECKS)
  const readings: SpendingReadings = { accounts, categories, transactions, budgets, rules, receipts, lines, held, settings }
  return {
    accounts: accounts.facts,
    categories: categories.facts,
    transactions: transactions.facts,
    budgets: budgets.facts,
    rules: rules.facts,
    receipts: receipts.facts,
    lines: lines.facts,
    held: held.facts,
    settings: spendingSettingsOf(settings.facts),
    readings,
    problems: (Object.keys(SPENDING_PARTS) as (keyof SpendingRecords)[]).flatMap((part) =>
      readings[part].problems.map((problem) => ({ kind: SPENDING_PARTS[part].name, noun: SPENDING_PARTS[part].noun, ...problem })),
    ),
  }
}
