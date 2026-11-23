import type { Label } from '../../../../shared/categorising/domain/labels'
import type { Account } from './account'
import { readAccounts } from './accountReading'
import { withDerivedSources } from '../../accounts/domain/derivedSources'
import type { Budget } from './budget'
import { readBudgets } from './budgetReading'
import type { Category } from './category'
import { readCategories } from './categoryReading'
import { readEvents } from './eventReading'
import { readLabels } from './labelReading'
import { readPayees } from './payeeReading'
import { readSharedCosts, withMembers } from './sharedCostReading'
import type { SharedCostProblem } from './sharedCostReading'
import type { SharedCost } from './sharedCost'
import { readShortcutParts, readShortcuts, withParts } from './shortcutReading'
import type { ShortcutPartReasons } from './shortcutReading'
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
import { OLD_LINK_SETTING_KEYS, bankLinksOf, oldLinkEndKey, oldLinksCount } from './bankLinkReading'
import { OLD_BANK_KEYS } from '../../../../shared/bank-sync/domain/bankLink'
import type { BankLink } from '../../../../shared/bank-sync/domain/bankLink'
import { readReceipts } from './receiptReading'
import {
  ACCOUNT_RECORDS,
  BANK_LINK_RECORDS,
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
  SHARED_COST_RECORDS,
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
  PERSON_PAYEES_KEY,
  instalmentPutOffOf,
  isBankAccountLine,
  linesOf,
  spendingSettingsOf,
  utcTimeOf,
} from './spendingSettings'
import type { SpendingSettings } from './spendingSettings'
import type { StoredRow, Transaction } from './transaction'
import { readDropped, readHeld, readTransactions } from './transactionReading'
import { payeeReason, words } from './words'
import { oldMarksCount } from '../../payees/domain/payeeDirectory'
import type { MemberProblem } from '../../sharedCosts/domain/sharedCostMembers'
import type { RecordKind, RecordNoun } from '../../../../shared/storage/domain/recordKind'
import { doubted, readEach } from '../../../../shared/storage/domain/recordsRead'
import type { Reading, RecordProblem, RecordsRead } from '../../../../shared/storage/domain/recordsRead'
import { ANY_VALUE, readSettingRows } from '../../../../shared/storage/domain/settingRows'
import { words as recordWords } from '../../../../shared/storage/domain/words'
import type { SettingChecks, SettingRow, SettingValueCheck } from '../../../../shared/storage/domain/settingRows'
import { parseCivilDate } from '../../../../shared/calendar/civilDate'

function oldLinkCheck(key: string): SettingValueCheck {
  if (Object.values(OLD_BANK_KEYS).some((oldKey) => oldLinkEndKey(oldKey) === key)) return (value) => (parseCivilDate(value) === null ? [words.settingNotADay(key, value)] : [])
  return (value) => (utcTimeOf(value) === null ? [words.settingNotATime(key, value)] : [])
}

function bankAccountLinesCheck(key: string): SettingValueCheck {
  return (value: string) => linesOf(value).flatMap((line) => (isBankAccountLine(line) ? [] : [words.settingNotABankAccount(key, line)]))
}

/** Each key Spending knows, and of a book from before bank-link records a bank's link ending only on a day and a bank's last fetch only at a UTC time. */
export const SPENDING_SETTING_CHECKS: SettingChecks = new Map<string, SettingValueCheck>([
  [BANK_SYNC_APPLICATION_KEY, ANY_VALUE],
  [BANK_ACCOUNTS_NOT_IN_KUNA_KEY, bankAccountLinesCheck(BANK_ACCOUNTS_NOT_IN_KUNA_KEY)],
  [BANK_ACCOUNTS_KEEP_MINE_KEY, bankAccountLinesCheck(BANK_ACCOUNTS_KEEP_MINE_KEY)],
  [INSTALMENTS_PUT_OFF_KEY, (value: string) => linesOf(value).flatMap((line) => (instalmentPutOffOf(line) === null ? [words.settingNotAPutOff(INSTALMENTS_PUT_OFF_KEY, line)] : []))],
  [COMPANY_ROLES_PUT_OFF_KEY, (value: string) => (parseCivilDate(value) === null ? [words.settingNotADay(COMPANY_ROLES_PUT_OFF_KEY, value)] : [])],
  [COMPANY_PAYMENTS_PUT_OFF_KEY, (value: string) => (parseCivilDate(value) === null ? [words.settingNotADay(COMPANY_PAYMENTS_PUT_OFF_KEY, value)] : [])],
  ...OLD_LINK_SETTING_KEYS.map((key) => [key, oldLinkCheck(key)] as const),
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
  readonly bankLinks: RecordsRead<BankLink>
  readonly sharedCosts: RecordsRead<SharedCost>
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
  bankLinks: BANK_LINK_RECORDS,
  sharedCosts: SHARED_COST_RECORDS,
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
    bankLinks: of(SPENDING_PARTS.bankLinks),
    sharedCosts: of(SPENDING_PARTS.sharedCosts),
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
  /** The bank approvals the book keeps, or in a book from before bank-link records those its old settings hold. */
  readonly bankLinks: readonly BankLink[]
  /** The shared costs, each counting its rows' money on its own day, in the order of the file. */
  readonly sharedCosts: readonly SharedCost[]
  readonly settings: SpendingSettings
  /** The accounts a file from before periods keeps, with the periods worked out from their rows, which the next write of their rows stores. */
  readonly sourcesWorkedOut: readonly Account[]
  /** The rows, lines and items as the file stores them, which a write of rows starts from. */
  readonly stored: Pick<SpendingRecords, 'transactions' | 'lines' | 'items'>
  readonly readings: SpendingReadings
  /** Every kind's problems, in the order of the kinds. */
  readonly problems: readonly SpendingProblem[]
}

const SHORTCUT_PART_REASONS: ShortcutPartReasons = {
  problems: {
    zero: words.amountIsZero,
    'mixed-ways': words.shortcutMixedWays,
    'unknown-category': words.noCategory,
    'between-accounts': words.shortcutBetweenAccounts,
    'shared-cost': words.sharedCostCategoryAlone,
    'unknown-label': words.shortcutNoLabel,
  },
  noShortcut: words.noShortcut,
  leftOut: words.shortcutPartLeftOut,
  withoutPart: words.shortcutWithoutPart,
}

const SHARED_COST_REASONS: { readonly [Problem in SharedCostProblem]: string } = {
  'no-category': words.noCategory,
  'not-spending-or-income': words.sharedCostNotSpendingOrIncome,
  'unknown-label': words.shortcutNoLabel,
  'unknown-event': words.sharedCostNoEvent,
}

const MEMBER_REASONS: { readonly [Problem in MemberProblem]: string } = {
  'no-row': words.memberNoRow,
  'not-filed-in': words.memberNotFiledIn,
  linked: words.memberLinked,
  unknown: words.memberNoSharedCost,
  'without-shared-cost': words.sharedCostCategoryAlone,
}

/**
 * The settings, of which the old marks of payees as people are doubted once payees count, since the payees say it now, and
 * the old link settings once a bank-link record counts.
 */
function readSettings(read: RecordsRead<SettingRow>, payees: readonly Payee[], links: readonly BankLink[]): Reading<SettingRow> {
  const reading = readSettingRows(read, SPENDING_SETTING_CHECKS, SPENDING_RETIRED_SETTING_KEYS, recordWords.settingUnknown)
  const ofPayees = oldMarksCount(payees) ? reading : doubted(reading, read, (row) => (row.key === PERSON_PAYEES_KEY ? words.personPayeesMoved : null))
  return oldLinksCount(links) ? ofPayees : doubted(ofPayees, read, (row) => (OLD_LINK_SETTING_KEYS.includes(row.key) ? words.oldBankLinkMoved : null))
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
 * `readHeld` refuses. A payee keeps a name, and no other payee holds any of its names once folded or any of its IBANs. A shared cost
 * that names a category, a label or an event that is not a spending or income one the file holds counts but is doubted, and so is an item
 * that breaks the rule of a member of one.
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
  const labels = readLabels(records.labels, words.labelNameShared)
  const rules = readRules(records.rules, categories.facts, accounts.facts, labels.facts)
  const events = readEvents(records.events, { blank: words.eventNameBlank, 'ends-before': words.eventEndsBefore })
  const ownShortcuts = readShortcuts(records.shortcuts, accountsById, words.noAccount)
  const shortcutParts = readShortcutParts(records.shortcutParts, ownShortcuts.facts, { categories: categories.facts, labels: labels.facts }, SHORTCUT_PART_REASONS)
  const shortcuts = withParts(ownShortcuts, records.shortcuts, shortcutParts.facts, SHORTCUT_PART_REASONS)
  const sharedCosts = readSharedCosts(records.sharedCosts, { categories: categories.facts, labels: labels.facts, events: events.facts }, SHARED_COST_REASONS)
  const items = withMembers(
    withKnownNames(
      readParts(records.items, rows.facts, receipts.facts, categoryIds, beforeItems),
      records.items,
      new Set(labels.facts.map((label) => label.id)),
      new Set(events.facts.map((event) => event.id)),
    ),
    records.items,
    { sharedCosts: sharedCosts.facts, categories: categories.facts },
    MEMBER_REASONS,
  )
  const transactions = beforeItems ? rows : withItems(rows, records.transactions, items, records.items)
  const held = readHeld(records.held, accountsById, transactions.facts)
  const dropped = readDropped(records.dropped, accountsById)
  const recipes = readEach(records.recipes, () => [])
  const payees = readPayees(records.payees, payeeReason)
  const bankLinks = readEach(records.bankLinks, () => [])
  const settings = readSettings(records.settings, payees.facts, bankLinks.facts)
  const readings: SpendingReadings = {
    accounts,
    categories,
    labels,
    events,
    transactions,
    budgets,
    rules,
    shortcuts,
    shortcutParts,
    receipts,
    lines,
    items,
    held,
    dropped,
    recipes,
    payees,
    bankLinks,
    sharedCosts,
    settings,
  }
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
    bankLinks: bankLinksOf(bankLinks.facts, settings.facts),
    sharedCosts: sharedCosts.facts,
    settings: spendingSettingsOf(settings.facts),
    sourcesWorkedOut: accounts.facts.filter((account) => worked.ids.has(account.id)),
    stored: { transactions: records.transactions, lines: records.lines, items: records.items },
    readings,
    problems: (Object.keys(SPENDING_PARTS) as (keyof SpendingRecords)[]).flatMap((part) =>
      readings[part].problems.map((problem) => ({ kind: SPENDING_PARTS[part].name, noun: SPENDING_PARTS[part].noun, ...problem })),
    ),
  }
}
