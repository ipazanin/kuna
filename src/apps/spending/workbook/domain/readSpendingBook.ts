import type { Account } from './account'
import { ibanKey } from './accountReading'
import type { Budget } from './budget'
import type { Category } from './category'
import { isFixedKind } from './category'
import { ACCOUNT_RECORDS, BUDGET_RECORDS, CATEGORY_RECORDS, RULE_RECORDS, SETTING_RECORDS, TRANSACTION_RECORDS } from './spendingKinds'
import type { SpendingRule } from './spendingRule'
import { readSettingRows, spendingSettingsOf } from './spendingSettings'
import type { SettingRow, SpendingSettings } from './spendingSettings'
import type { Transaction } from './transaction'
import { words } from './words'
import { limitRuns, runsOverlap } from '../../budgets/domain/budgetCarry'
import type { RecordKind, RecordNoun } from '../../../../shared/storage/domain/recordKind'
import { problemOf, readEach } from '../../../../shared/storage/domain/recordsRead'
import type { Reading, RecordProblem, RecordsRead } from '../../../../shared/storage/domain/recordsRead'
import { sharedKeys } from '../../../../shared/storage/domain/sharedKeys'

/** What the Spending file holds of each kind. */
export interface SpendingRecords {
  readonly accounts: RecordsRead<Account>
  readonly categories: RecordsRead<Category>
  readonly transactions: RecordsRead<Transaction>
  readonly budgets: RecordsRead<Budget>
  readonly rules: RecordsRead<SpendingRule>
  readonly settings: RecordsRead<SettingRow>
}

/** The kind each part of the records holds. */
export const SPENDING_PARTS: { readonly [Part in keyof SpendingRecords]: RecordKind<SpendingRecords[Part]['records'][number]['record']> } = {
  accounts: ACCOUNT_RECORDS,
  categories: CATEGORY_RECORDS,
  transactions: TRANSACTION_RECORDS,
  budgets: BUDGET_RECORDS,
  rules: RULE_RECORDS,
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

function readAccounts(read: RecordsRead<Account>): Reading<Account> {
  const ibanOf = (account: Account): string | null => (account.iban === '' ? null : `${ibanKey(account.iban)} ${account.currency}`)
  const shared = sharedKeys(
    read.records.flatMap((stored) => {
      const key = ibanOf(stored.record)
      return key === null ? [] : [key]
    }),
    (key) => key,
  )
  return doubted(
    readEach(read, () => []),
    read,
    (account) => {
      const key = ibanOf(account)
      return key !== null && shared.has(key) ? words.ibanShared(account.iban, account.currency) : null
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

function readTransactions(read: RecordsRead<Transaction>, accounts: ReadonlySet<string>, categories: ReadonlySet<string>): Reading<Transaction> {
  const byId = new Map(read.records.map((stored) => [stored.id, stored.record]))
  const keyOf = (transaction: Transaction): string => `${transaction.account} ${transaction.importKey}`
  const sharingKey = sharedKeys(
    read.records.filter((stored) => stored.record.importKey !== ''),
    (stored) => keyOf(stored.record),
  )
  const reading = readEach(read, ({ record: transaction }) => {
    if (!accounts.has(transaction.account)) return [words.noAccount]
    if (transaction.importKey !== '' && sharingKey.has(keyOf(transaction))) return [words.importKeyShared(transaction.importKey)]
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

function readRules(read: RecordsRead<SpendingRule>, categories: ReadonlySet<string>): Reading<SpendingRule> {
  const reading = readEach(read, ({ record: rule }) => (categories.has(rule.category) ? [] : [words.noCategory]))
  return { ...reading, facts: [...reading.facts].sort((earlier, later) => earlier.order - later.order) }
}

/**
 * Reads the Spending file with the rules across records. A child names a group of its kind that counts, and each of the
 * three fixed kinds is one category. An entry names an account and a category that count, and its other leg names it
 * back from another account. A limit is on a spending category, one a month, and never on a group and its child in the
 * same months. A rule names a category that counts. Two accounts with one IBAN and currency, and a second category of a fixed
 * kind, count but are doubted. Two entries of an account with one import key are refused.
 */
export function readSpendingBook(records: SpendingRecords): SpendingBook {
  const accounts = readAccounts(records.accounts)
  const categories = readCategories(records.categories)
  const categoryIds = new Set(categories.facts.map((category) => category.id))
  const transactions = readTransactions(records.transactions, new Set(accounts.facts.map((account) => account.id)), categoryIds)
  const budgets = readBudgets(records.budgets, categories.facts)
  const rules = readRules(records.rules, categoryIds)
  const settings = readSettingRows(records.settings)
  const readings: SpendingReadings = { accounts, categories, transactions, budgets, rules, settings }
  return {
    accounts: accounts.facts,
    categories: categories.facts,
    transactions: transactions.facts,
    budgets: budgets.facts,
    rules: rules.facts,
    settings: spendingSettingsOf(settings.facts),
    readings,
    problems: (Object.keys(SPENDING_PARTS) as (keyof SpendingRecords)[]).flatMap((part) =>
      readings[part].problems.map((problem) => ({ kind: SPENDING_PARTS[part].name, noun: SPENDING_PARTS[part].noun, ...problem })),
    ),
  }
}
