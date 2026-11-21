import { labelNameProblem } from '../../../../shared/categorising/domain/labels'
import type { Label } from '../../../../shared/categorising/domain/labels'
import type { Account } from './account'
import { readAccounts } from './accountReading'
import { withDerivedSources } from '../../accounts/domain/derivedSources'
import type { Budget } from './budget'
import { readBudgets } from './budgetReading'
import type { Category } from './category'
import { readCategories } from './categoryReading'
import type { TransactionItem } from './transactionItem'
import { itemsBeforeItems, readParts, withItems, withKnownNames } from './transactionItemReading'
import { isBeforeItems } from './beforeItems'
import type { StoredLine } from './beforeItems'
import type { HeldBankRow } from './heldBankRow'
import type { DroppedRow } from './droppedRow'
import type { SavedRecipe } from './savedRecipe'
import type { Payee } from './payee'
import type { SpendingEvent } from './event'
import type { Receipt } from './receipt'
import { readReceipts } from './receiptReading'
import {
  ACCOUNT_RECORDS,
  BUDGET_RECORDS,
  CATEGORY_RECORDS,
  EVENT_RECORDS,
  HELD_ROW_RECORDS,
  DROPPED_ROW_RECORDS,
  RECIPE_RECORDS,
  ITEM_RECORDS,
  PAYEE_RECORDS,
  LABEL_RECORDS,
  LINE_RECORDS,
  RECEIPT_RECORDS,
  RULE_RECORDS,
  SETTING_RECORDS,
  SHORTCUT_PART_RECORDS,
  SHORTCUT_RECORDS,
  TRANSACTION_RECORDS,
} from './spendingKinds'
import type { SpendingRule } from './spendingRule'
import { readRules } from './ruleReading'
import type { Shortcut, ShortcutPart } from './shortcut'
import {
  BANK_ACCOUNTS_KEEP_MINE_KEY,
  BANK_ACCOUNTS_NOT_IN_KUNA_KEY,
  BANK_SYNC_APPLICATION_KEY,
  INSTALMENTS_PUT_OFF_KEY,
  COMPANY_ROLES_PUT_OFF_KEY,
  COMPANY_PAYMENTS_PUT_OFF_KEY,
  LINKABLE_BANKS,
  PERSON_PAYEES_KEY,
  bankFetchedKey,
  bankLinkKey,
  instalmentPutOffOf,
  isBankAccountLine,
  linesOf,
  spendingSettingsOf,
  utcTimeOf,
} from './spendingSettings'
import type { SpendingSettings } from './spendingSettings'
import type { StoredRow, Transaction } from './transaction'
import { readDropped, readHeld, readTransactions } from './transactionReading'
import { words } from './words'
import { eventProblem } from '../../events/domain/events'
import { shortcutPartProblem } from '../../shortcuts/domain/shortcuts'
import { payeeProblem } from '../../payees/domain/payeeDetails'
import { oldMarksCount } from '../../payees/domain/payeeDirectory'
import type { PayeeProblem } from '../../payees/domain/payeeDetails'
import type { RecordKind, RecordNoun } from '../../../../shared/storage/domain/recordKind'
import { doubted, problemOf, readEach } from '../../../../shared/storage/domain/recordsRead'
import type { Reading, RecordProblem, RecordsRead } from '../../../../shared/storage/domain/recordsRead'
import { ANY_VALUE, readSettingRows } from '../../../../shared/storage/domain/settingRows'
import { words as recordWords } from '../../../../shared/storage/domain/words'
import type { SettingChecks, SettingRow, SettingValueCheck } from '../../../../shared/storage/domain/settingRows'
import { parseCivilDate } from '../../../../shared/calendar/civilDate'

function bankAccountLinesCheck(key: string): SettingValueCheck {
  return (value: string) => linesOf(value).flatMap((line) => (isBankAccountLine(line) ? [] : [words.settingNotABankAccount(key, line)]))
}

/** Each key Spending knows, a bank's link ending only on a day, and a bank's last fetch only at a UTC time. */
export const SPENDING_SETTING_CHECKS: SettingChecks = new Map<string, SettingValueCheck>([
  [BANK_SYNC_APPLICATION_KEY, ANY_VALUE],
  [BANK_ACCOUNTS_NOT_IN_KUNA_KEY, bankAccountLinesCheck(BANK_ACCOUNTS_NOT_IN_KUNA_KEY)],
  [BANK_ACCOUNTS_KEEP_MINE_KEY, bankAccountLinesCheck(BANK_ACCOUNTS_KEEP_MINE_KEY)],
  [INSTALMENTS_PUT_OFF_KEY, (value: string) => linesOf(value).flatMap((line) => (instalmentPutOffOf(line) === null ? [words.settingNotAPutOff(INSTALMENTS_PUT_OFF_KEY, line)] : []))],
  [COMPANY_ROLES_PUT_OFF_KEY, (value: string) => (parseCivilDate(value) === null ? [words.settingNotADay(COMPANY_ROLES_PUT_OFF_KEY, value)] : [])],
  [COMPANY_PAYMENTS_PUT_OFF_KEY, (value: string) => (parseCivilDate(value) === null ? [words.settingNotADay(COMPANY_PAYMENTS_PUT_OFF_KEY, value)] : [])],
  ...LINKABLE_BANKS.map(bankLinkKey).map((key) => [key, (value: string) => (parseCivilDate(value) === null ? [words.settingNotADay(key, value)] : [])] as const),
  ...LINKABLE_BANKS.map(bankFetchedKey).map((key) => [key, (value: string) => (utcTimeOf(value) === null ? [words.settingNotATime(key, value)] : [])] as const),
])

/**
 * Keys Spending no longer reads that older files may still hold. Company's OIB is read from Company now, the bank sync script is
 * built in, and the payees marked as people are read only until the first payee write moves them onto payees.
 */
export const SPENDING_RETIRED_SETTING_KEYS: ReadonlySet<string> = new Set(['company_oib', 'bank_sync_deployment', PERSON_PAYEES_KEY])

/** What the Spending file holds of each kind. */
export interface SpendingRecords {
  readonly accounts: RecordsRead<Account>
  readonly categories: RecordsRead<Category>
  readonly labels: RecordsRead<Label>
  readonly events: RecordsRead<SpendingEvent>
  readonly transactions: RecordsRead<StoredRow>
  readonly budgets: RecordsRead<Budget>
  readonly rules: RecordsRead<SpendingRule>
  readonly shortcuts: RecordsRead<Shortcut>
  readonly shortcutParts: RecordsRead<ShortcutPart>
  readonly receipts: RecordsRead<Receipt>
  /** The parts of entries as a file from before items keeps them. */
  readonly lines: RecordsRead<StoredLine>
  /** The items of transactions, every row's in a file moved to items. */
  readonly items: RecordsRead<TransactionItem>
  readonly held: RecordsRead<HeldBankRow>
  readonly dropped: RecordsRead<DroppedRow>
  readonly recipes: RecordsRead<SavedRecipe>
  readonly payees: RecordsRead<Payee>
  readonly settings: RecordsRead<SettingRow>
}

/** The kind each part of the records holds. */
export const SPENDING_PARTS: { readonly [Part in keyof SpendingRecords]: RecordKind<SpendingRecords[Part]['records'][number]['record']> } = {
  accounts: ACCOUNT_RECORDS,
  categories: CATEGORY_RECORDS,
  labels: LABEL_RECORDS,
  events: EVENT_RECORDS,
  transactions: TRANSACTION_RECORDS,
  budgets: BUDGET_RECORDS,
  rules: RULE_RECORDS,
  shortcuts: SHORTCUT_RECORDS,
  shortcutParts: SHORTCUT_PART_RECORDS,
  receipts: RECEIPT_RECORDS,
  lines: LINE_RECORDS,
  items: ITEM_RECORDS,
  held: HELD_ROW_RECORDS,
  dropped: DROPPED_ROW_RECORDS,
  recipes: RECIPE_RECORDS,
  payees: PAYEE_RECORDS,
  settings: SETTING_RECORDS,
}

/** The records of every Spending kind, as `of` gives each kind. */
export function spendingRecordsOf(of: <R>(kind: RecordKind<R>) => RecordsRead<R>): SpendingRecords {
  return {
    accounts: of(SPENDING_PARTS.accounts),
    categories: of(SPENDING_PARTS.categories),
    labels: of(SPENDING_PARTS.labels),
    events: of(SPENDING_PARTS.events),
    transactions: of(SPENDING_PARTS.transactions),
    budgets: of(SPENDING_PARTS.budgets),
    rules: of(SPENDING_PARTS.rules),
    shortcuts: of(SPENDING_PARTS.shortcuts),
    shortcutParts: of(SPENDING_PARTS.shortcutParts),
    receipts: of(SPENDING_PARTS.receipts),
    lines: of(SPENDING_PARTS.lines),
    items: of(SPENDING_PARTS.items),
    held: of(SPENDING_PARTS.held),
    dropped: of(SPENDING_PARTS.dropped),
    recipes: of(SPENDING_PARTS.recipes),
    payees: of(SPENDING_PARTS.payees),
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
  /** In the order of the file. */
  readonly labels: readonly Label[]
  /** In the order of the file. */
  readonly events: readonly SpendingEvent[]
  /** Oldest first, and in the order of the file within a day. */
  readonly transactions: readonly Transaction[]
  readonly budgets: readonly Budget[]
  /** In the order they are tried. */
  readonly rules: readonly SpendingRule[]
  /** In the order they show. */
  readonly shortcuts: readonly Shortcut[]
  /** In the order of the file. */
  readonly shortcutParts: readonly ShortcutPart[]
  readonly receipts: readonly Receipt[]
  /** Every row's items and the lines of receipts that wait for the bank's row, in the order of the file. A file from before items has them made from its rows and lines. */
  readonly items: readonly TransactionItem[]
  /** The bank rows the sync left out, waiting on To review, in the order of the file. */
  readonly held: readonly HeldBankRow[]
  /** The payments the bank dropped that you had filed, waiting on To review until you press OK, in the order of the file. */
  readonly dropped: readonly DroppedRow[]
  /** The recipes kept for a bank's statement files, in the order of the file. */
  readonly recipes: readonly SavedRecipe[]
  /** The payees you keep details of, in the order of the file. */
  readonly payees: readonly Payee[]
  readonly settings: SpendingSettings
  /** The accounts a file from before periods keeps, with the periods worked out from their rows, which the next write of their rows stores. */
  readonly sourcesWorkedOut: readonly Account[]
  /** The rows, lines and items as the file stores them, which a write of rows starts from. */
  readonly stored: Pick<SpendingRecords, 'transactions' | 'lines' | 'items'>
  readonly readings: SpendingReadings
  /** Every kind's problems, in the order of the kinds. */
  readonly problems: readonly SpendingProblem[]
}

/** Labels count, but one whose name another label has once folded is doubted, since the two read as one. */
function readLabels(read: RecordsRead<Label>): Reading<Label> {
  const labels = read.records.map((stored) => stored.record)
  return doubted(
    readEach(read, () => []),
    read,
    (label) => (labelNameProblem(label.name, labels, label.id) === 'taken' ? words.labelNameShared(label.name) : null),
  )
}

/** Events count when their name is not blank and their last day is not before their first. Names may repeat. */
function readEvents(read: RecordsRead<SpendingEvent>): Reading<SpendingEvent> {
  return readEach(read, ({ record: event }) => {
    const problem = eventProblem(event.name, event.days)
    if (problem === null) return []
    return [problem === 'blank' ? words.eventNameBlank : words.eventEndsBefore]
  })
}

/** Why a shortcut does not count: it names no account in the file. */
function readShortcuts(read: RecordsRead<Shortcut>, accounts: ReadonlyMap<string, Account>): Reading<Shortcut> {
  return readEach(read, ({ record: shortcut }) => (accounts.has(shortcut.account) ? [] : [words.noAccount]))
}

const SHORTCUT_PART_REASONS = {
  zero: words.amountIsZero,
  'mixed-ways': words.shortcutMixedWays,
  'unknown-category': words.noCategory,
  'between-accounts': words.shortcutBetweenAccounts,
  'unknown-label': words.shortcutNoLabel,
} as const

/** The parts of shortcuts as `shortcutPartProblem` says, each of a shortcut that counts, all of a shortcut's or none. */
function readShortcutParts(read: RecordsRead<ShortcutPart>, shortcuts: readonly Shortcut[], categories: readonly Category[], labels: readonly Label[]): Reading<ShortcutPart> {
  const counted = new Set(shortcuts.map((shortcut) => shortcut.id))
  const siblingsOf = (part: ShortcutPart): readonly ShortcutPart[] => read.records.map((stored) => stored.record).filter((other) => other.shortcut === part.shortcut && other !== part)
  const ownReason = (part: ShortcutPart): string | null => {
    if (!counted.has(part.shortcut)) return words.noShortcut
    const problem = shortcutPartProblem(part, siblingsOf(part), { categories, labels })
    return problem === null ? null : SHORTCUT_PART_REASONS[problem]
  }
  const broken = new Set(read.records.filter((stored) => ownReason(stored.record) !== null).map((stored) => stored.record.shortcut))
  return readEach(read, ({ record: part }) => {
    const own = ownReason(part)
    if (own !== null) return [own]
    return broken.has(part.shortcut) ? [words.shortcutPartLeftOut] : []
  })
}

/** The shortcuts with a part that counts, in order, and those without as left out. */
function withParts(reading: Reading<Shortcut>, read: RecordsRead<Shortcut>, parts: readonly ShortcutPart[]): Reading<Shortcut> {
  const held = new Set(parts.map((part) => part.shortcut))
  const left = read.records.filter((stored) => reading.facts.includes(stored.record) && !held.has(stored.record.id))
  return {
    facts: reading.facts.filter((shortcut) => held.has(shortcut.id)).sort((earlier, later) => earlier.order - later.order),
    problems: [...reading.problems, ...left.map((stored) => problemOf(stored, words.shortcutWithoutPart))],
  }
}

/** A payee's problem in the words of the file's problems. */
function payeeReason(problem: PayeeProblem): string {
  switch (problem.kind) {
    case 'no-name':
      return words.payeeNoName
    case 'name-taken':
      return words.payeeNameTaken(problem.name, problem.holder)
    case 'not-an-iban':
      return words.payeeNotAnIban(problem.iban)
    case 'iban-taken':
      return words.payeeIbanTaken(problem.iban, problem.holder)
    case 'not-an-oib':
      return words.payeeNotAnOib(problem.taxId)
  }
}

/** Payees count as `payeeProblem` says, each against every other stored payee, so two that share a name or an IBAN both stay out. */
function readPayees(read: RecordsRead<Payee>): Reading<Payee> {
  const payees = read.records.map((stored) => stored.record)
  return readEach(read, ({ record: payee }) => {
    const problem = payeeProblem(payee, payees)
    return problem === null ? [] : [payeeReason(problem)]
  })
}

/** The settings, of which the old marks of payees as people are doubted once payees count, since the payees say it now. */
function readSettings(read: RecordsRead<SettingRow>, payees: readonly Payee[]): Reading<SettingRow> {
  const reading = readSettingRows(read, SPENDING_SETTING_CHECKS, SPENDING_RETIRED_SETTING_KEYS, recordWords.settingUnknown)
  return oldMarksCount(payees) ? reading : doubted(reading, read, (row) => (row.key === PERSON_PAYEES_KEY ? words.personPayeesMoved : null))
}

/**
 * Reads the Spending file with the rules across records. A child names a group of its kind that counts, and each of the
 * three fixed kinds is one category. An entry names an account that counts, on or after its start day, and its other leg names it
 * back from another account. It has at least one item, which says what its money is. A limit is on a spending category, one a month, and never on a group and its child in the
 * same months. A rule names a category that counts, and one that spots a withdrawal files into Between my accounts and names a cash account or none. A shortcut names an account that counts and has parts, which `shortcutPartProblem` reads and which count all or none. A receipt names an entry that counts, which no other receipt names, or while it waits for the bank's row an account that counts, and no other receipt holds its JIR or ZKI. A part
 * of an entry names that entry, a category that counts and, when a receipt split it, that entry's receipt. A line of a waiting receipt names that receipt and no entry. The parts of an entry add up to its amount, and the lines of a waiting receipt to minus its total, and count all or none. Only the one item of an entry waiting on To review has no category, and a transfer's leg has one item.
 * A file from before items keeps an entry's category, note and link on the entry while it is not split, which then names a category that counts, and its
 * parts as lines, and is read as the items they make. Two accounts with one IBAN and currency, an account whose rows come from a bank link with no IBAN, a second category of a fixed
 * kind, a label named as another is once folded and an item that names a label or an event the file lacks count but are doubted. Two entries of an account with one import key are refused, and so is a bank row on hold that
 * `readHeld` refuses. A payee keeps a name, and no other payee holds any of its names once folded or any of its IBANs.
 */
export function readSpendingBook(records: SpendingRecords): SpendingBook {
  const beforeItems = isBeforeItems(records)
  const worked = withDerivedSources(records.accounts, records.transactions)
  const accounts = readAccounts(worked.read)
  const categories = readCategories(records.categories)
  const categoryIds = new Set(categories.facts.map((category) => category.id))
  const accountsById = new Map(accounts.facts.map((account) => [account.id, account]))
  const rows = readTransactions(records.transactions, accountsById, categoryIds, beforeItems)
  const budgets = readBudgets(records.budgets, categories.facts)
  const receipts = readReceipts(records.receipts, new Set(rows.facts.map((row) => row.id)), accountsById)
  const lines = beforeItems ? readParts(records.lines, rows.facts, receipts.facts, categoryIds, true) : readEach(records.lines, () => [words.lineAfterMove])
  const labels = readLabels(records.labels)
  const rules = readRules(records.rules, categories.facts, accounts.facts, labels.facts)
  const events = readEvents(records.events)
  const ownShortcuts = readShortcuts(records.shortcuts, accountsById)
  const shortcutParts = readShortcutParts(records.shortcutParts, ownShortcuts.facts, categories.facts, labels.facts)
  const shortcuts = withParts(ownShortcuts, records.shortcuts, shortcutParts.facts)
  const items = withKnownNames(
    readParts(records.items, rows.facts, receipts.facts, categoryIds, beforeItems),
    records.items,
    new Set(labels.facts.map((label) => label.id)),
    new Set(events.facts.map((event) => event.id)),
  )
  const transactions = beforeItems ? rows : withItems(rows, records.transactions, items, records.items)
  const held = readHeld(records.held, accountsById, transactions.facts)
  const dropped = readDropped(records.dropped, accountsById)
  const recipes = readEach(records.recipes, () => [])
  const payees = readPayees(records.payees)
  const settings = readSettings(records.settings, payees.facts)
  const readings: SpendingReadings = { accounts, categories, labels, events, transactions, budgets, rules, shortcuts, shortcutParts, receipts, lines, items, held, dropped, recipes, payees, settings }
  return {
    accounts: accounts.facts,
    categories: categories.facts,
    labels: labels.facts,
    events: events.facts,
    transactions: transactions.facts,
    budgets: budgets.facts,
    rules: rules.facts,
    shortcuts: shortcuts.facts,
    shortcutParts: shortcutParts.facts,
    receipts: receipts.facts,
    items: beforeItems ? itemsBeforeItems(records.transactions, transactions.facts, lines.facts) : items.facts,
    held: held.facts,
    dropped: dropped.facts,
    recipes: recipes.facts,
    payees: payees.facts,
    settings: spendingSettingsOf(settings.facts),
    sourcesWorkedOut: accounts.facts.filter((account) => worked.ids.has(account.id)),
    stored: { transactions: records.transactions, lines: records.lines, items: records.items },
    readings,
    problems: (Object.keys(SPENDING_PARTS) as (keyof SpendingRecords)[]).flatMap((part) =>
      readings[part].problems.map((problem) => ({ kind: SPENDING_PARTS[part].name, noun: SPENDING_PARTS[part].noun, ...problem })),
    ),
  }
}
