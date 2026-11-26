import { sameMoney, typedRowsOf } from '../../pairing/domain/sameMoney'
import { ruleLinkWaits, ruleLinking } from '../../links/domain/linkFiling'
import type { RuleLinks } from '../../links/domain/linkFiling'
import type { Category } from '../../workbook/domain/category'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import { rowLinkText } from '../../workbook/domain/rowLink'
import { foldedTextMatches, rulePattern } from '../../workbook/domain/spendingRule'
import type { SpendingRule, SpendingRuleCondition } from '../../workbook/domain/spendingRule'
import { refiledItems, rowItemsOf, waitsOnReview } from '../../workbook/domain/rowItems'
import type { Transaction } from '../../workbook/domain/transaction'
import type { TransactionItem } from '../../workbook/domain/transactionItem'
import { inTryingOrder } from '../../../../shared/categorising/domain/ruleOrder'
import { foldedTextHolds } from '../../../../shared/categorising/domain/textTest'
import { transactionFacts } from '../../../../shared/categorising/domain/transactionFacts'
import type { CategorisableRow, TransactionFacts } from '../../../../shared/categorising/domain/transactionFacts'
import { dayOfMonth } from '../../../../shared/calendar/civilDate'
import { absAccountMoney } from '../../../../shared/money/accountMoney'
import { EURO } from '../../../../shared/money/currencyCode'
import { moneyFromCents } from '../../../../shared/money/money'
import { newRecordId } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { foldRuleText, normaliseIban } from '../../../../shared/text/fold'

/** What the rules know of the owner besides the row. */
export interface SpendingCategorisationContext {
  /** The accounts' own IBANs, normalised. */
  readonly ownIbans: ReadonlySet<string>
  /** Each account's currency. An account not listed counts in `defaultCurrency`. */
  readonly accountCurrencies: ReadonlyMap<string, string>
  readonly defaultCurrency: string
}

/** The accounts' IBANs as own and each account's currency. */
export function spendingCategorisationContext(book: Pick<SpendingBook, 'accounts'>): SpendingCategorisationContext {
  return {
    ownIbans: new Set(book.accounts.flatMap((account) => (account.iban === '' ? [] : [normaliseIban(account.iban)]))),
    accountCurrencies: new Map(book.accounts.map((account) => [account.id, account.currency])),
    defaultCurrency: EURO,
  }
}

/** What the rules read of a row. */
export type RuledRow = Pick<Transaction, 'account' | 'date' | 'amount' | 'payee' | 'counterpartyIban' | 'description'>

/** What the rules know of a row, worked out once for every rule. */
interface RowFacts {
  readonly row: RuledRow
  readonly facts: TransactionFacts
  readonly currency: string
}

/** A condition as a test of a row, its values folded or compiled once. */
function testOf(condition: SpendingRuleCondition): (row: RowFacts) => boolean {
  const holds = conditionTestOf(condition)
  return condition.not ? (row) => !holds(row) : holds
}

function textTestOf(test: 'is' | 'contains' | 'starts_with' | 'matches', values: readonly string[], read: (facts: TransactionFacts) => string): (row: RowFacts) => boolean {
  if (test === 'matches') {
    const patterns = values.flatMap((value) => rulePattern(value) ?? [])
    return ({ facts }) => patterns.some((pattern) => foldedTextMatches(read(facts), pattern))
  }
  const folded = values.map(foldRuleText)
  return ({ facts }) => folded.some((value) => foldedTextHolds(test, read(facts), value))
}

function conditionTestOf(condition: SpendingRuleCondition): (row: RowFacts) => boolean {
  switch (condition.test) {
    case 'payee_is':
      return textTestOf('is', condition.values, (facts) => facts.counterparty)
    case 'payee_contains':
      return textTestOf('contains', condition.values, (facts) => facts.counterparty)
    case 'payee_starts_with':
      return textTestOf('starts_with', condition.values, (facts) => facts.counterparty)
    case 'payee_matches':
      return textTestOf('matches', condition.values, (facts) => facts.counterparty)
    case 'description_contains':
      return textTestOf('contains', condition.values, (facts) => facts.description)
    case 'description_starts_with':
      return textTestOf('starts_with', condition.values, (facts) => facts.description)
    case 'description_matches':
      return textTestOf('matches', condition.values, (facts) => facts.description)
    case 'iban_is': {
      const ibans = new Set(condition.values.map(normaliseIban))
      return ({ facts }) => facts.hasCounterpartyIban && ibans.has(facts.counterpartyIban)
    }
    case 'iban_none':
      return ({ facts }) => !facts.hasCounterpartyIban
    case 'money_in':
      return ({ facts }) => facts.isCredit
    case 'money_out':
      return ({ facts }) => !facts.isCredit
    case 'amount_at_least': {
      const { amount } = condition
      return ({ row }) => absAccountMoney(row.amount) >= amount
    }
    case 'amount_at_most': {
      const { amount } = condition
      return ({ row }) => absAccountMoney(row.amount) <= amount
    }
    case 'accounts': {
      const accounts = new Set<string>(condition.accounts)
      return ({ row }) => accounts.has(row.account)
    }
    case 'days': {
      const { from, to } = condition.days
      return ({ row }) => dayOfMonth(row.date) >= from && dayOfMonth(row.date) <= to
    }
    case 'currencies': {
      const currencies = new Set<string>(condition.currencies)
      return ({ currency }) => currencies.has(currency)
    }
  }
}

/** The rules that decide a row: the one that files its category and the one whose labels it takes, each null when none holds. */
export interface RulesOutcome {
  readonly filing: SpendingRule | null
  readonly labelling: SpendingRule | null
}

/**
 * The rules that hold for a row, in the order they are tried, up to and with the first that has Stop here. Every condition of a
 * rule must hold. A rule into an income category also holds only for money in, so a later purchase from that payee waits on
 * review, and one that spots a withdrawal only for money out.
 */
export function holdingRules(rules: readonly SpendingRule[], book: Pick<SpendingBook, 'accounts' | 'categories'>): (row: RuledRow) => readonly SpendingRule[] {
  const context = spendingCategorisationContext(book)
  const incomeCategories = new Set(book.categories.filter((category) => category.kind === 'income').map((category) => category.id))
  const tried = inTryingOrder(rules).map((rule) => {
    const tests = rule.conditions.map(testOf)
    const onlyIn = rule.category !== null && incomeCategories.has(rule.category)
    const onlyOut = rule.withdrawal !== null
    return { rule, holds: (row: RowFacts) => (!onlyIn || row.facts.isCredit) && (!onlyOut || !row.facts.isCredit) && tests.every((test) => test(row)) }
  })
  if (tried.length === 0) return () => []
  return (row) => {
    const categorisable: CategorisableRow = {
      amount: moneyFromCents(row.amount),
      counterparty: row.payee,
      counterpartyIban: row.counterpartyIban,
      description: row.description,
    }
    const facts: RowFacts = { row, facts: transactionFacts(categorisable), currency: context.accountCurrencies.get(row.account) ?? context.defaultCurrency }
    const holding: SpendingRule[] = []
    for (const { rule, holds } of tried) {
      if (!holds(facts)) continue
      holding.push(rule)
      if (rule.stop) break
    }
    return holding
  }
}

/** Tries the rules on a row: the first that holds and files decides the category, and the first that holds and labels decides the labels. */
export function rulesOutcome(rules: readonly SpendingRule[], book: Pick<SpendingBook, 'accounts' | 'categories'>): (row: RuledRow) => RulesOutcome {
  const holdingOf = holdingRules(rules, book)
  return (row) => {
    const holding = holdingOf(row)
    return { filing: holding.find((rule) => rule.category !== null) ?? null, labelling: holding.find((rule) => rule.labels.length > 0) ?? null }
  }
}

/** Finds the rule that files a row: the first of a set that holds and files, or null. */
export function decidingRule(rules: readonly SpendingRule[], book: Pick<SpendingBook, 'accounts' | 'categories'>): (row: RuledRow) => SpendingRule | null {
  const outcomeOf = rulesOutcome(rules, book)
  return (row) => outcomeOf(row).filing
}

/** Decides rows by a set of rules: the category of the first rule that holds and files, or null. */
export function ruleVerdicts(rules: readonly SpendingRule[], book: Pick<SpendingBook, 'accounts' | 'categories'>): (row: RuledRow) => RecordId | null {
  const ruleOf = decidingRule(rules, book)
  return (row) => ruleOf(row)?.category ?? null
}

/** Whether the row's one item stands as a rule files it: under its category, and linked when the rule's rows pay a loan. */
function filedAs(item: TransactionItem, rule: SpendingRule): boolean {
  return item.category === rule.category && (rule.link === null || item.link !== null)
}

/** Whether two rules file a row the same way, the same category and the same loan, or neither files it. */
function sameFiling(one: SpendingRule | null, other: SpendingRule | null): boolean {
  const filingOf = (rule: SpendingRule | null): string => (rule === null ? '' : `${rule.category ?? ''} ${rule.link === null ? '' : rowLinkText(rule.link)}`)
  return filingOf(one) === filingOf(other)
}

function sameLabels(one: readonly RecordId[], other: readonly RecordId[]): boolean {
  return one.length === other.length && one.every((label) => other.includes(label))
}

/**
 * The item with the labels the rules now give it. A label a rule put on that they no longer give comes off, and each they give
 * goes on. A label put on by hand stays, and so does one the rules give that the item already carried by hand.
 */
export function withRuleLabels(item: TransactionItem, given: readonly RecordId[]): TransactionItem {
  const taken = item.ruleLabels.filter((label) => !given.includes(label) && item.labels.includes(label))
  const kept = item.labels.filter((label) => !taken.includes(label))
  const added = given.filter((label) => !kept.includes(label))
  if (taken.length === 0 && added.length === 0) return item
  return { ...item, labels: [...kept, ...added], ruleLabels: [...item.ruleLabels.filter((label) => given.includes(label) && kept.includes(label)), ...added] }
}

/** One row on the file a write changes, with every item it then has, or without them when they stay as they are. */
export interface RowChange {
  readonly before: Transaction
  readonly after: Transaction
  readonly items?: readonly TransactionItem[]
}

/** What a set of rules does to the file: the rows it changes, and the categories the links of those rows need that the file lacks. */
export interface RulesRerun {
  readonly changes: readonly RowChange[]
  readonly categories: readonly Category[]
}

/** What a rule change reads besides the rules. */
export interface RerunChoices {
  /** The loan instalments a rule whose rows pay a loan links them to, or null while Loans cannot be read. */
  readonly links?: RuleLinks | null
  /**
   * The rules the person applies to the rows already in the book as they save them. Each reaches every row it decides that does not
   * stand as it files and labels, so a row it skipped before, kept for new rows only or while Loans could not be read, follows it now.
   */
  readonly applying?: ReadonlySet<RecordId>
  readonly newKey?: () => string
}

/**
 * What changing the rules from the book's own to `rules` does to the file. A row's filing and its labels move apart: each moves
 * only when the change moves what the rules give it, or when a rule being applied gives it what it lacks. So a rule kept for new
 * rows only never reaches the rows it skipped through a later write, and a second rule that holds for the same row moves only its
 * own part. A row of one item a rule filed, or one waiting on review, follows the rules' filing, back to waiting when none files it
 * any more. Rows like those and rows you filed take the labels the rules give, and lose those a rule put on that they no longer
 * give, while a label put on by hand stays. A row you filed keeps its category, and so does each part of a split row, which takes
 * the labels as a whole row does. A row the file reader or the pairing filed and a row To review offers as the same money as a typed
 * row stay as they are. A row a rule whose rows pay a loan files is
 * linked to the instalment it pays as `ruleLinking` says, and while Loans cannot be read its filing stays, so a waiting instalment
 * never counts whole under the rule's category. A row a rule naming an asset files is linked to it whole, whether or not Assets can be read.
 */
export function rulesRerun(
  book: Pick<SpendingBook, 'accounts' | 'categories' | 'transactions' | 'items' | 'rules'>,
  rules: readonly SpendingRule[],
  { links = null, applying = new Set(), newKey = newRecordId }: RerunChoices = {},
): RulesRerun {
  const standingOf = rulesOutcome(book.rules, book)
  const outcomeOf = rulesOutcome(rules, book)
  const itemsOf = rowItemsOf(book)
  const { matches, near } = sameMoney(
    typedRowsOf(book),
    book.transactions.filter((row) => row.source === 'statement' && waitsOnReview(itemsOf(row))),
  )
  const offered = new Set([...matches, ...near].map(({ bank }) => bank))
  const currencies = new Map(book.accounts.map((account) => [account.id, account.currency]))
  const linked = new Set(book.items.flatMap((item) => (item.link === null ? [] : [rowLinkText(item.link)])))
  const appliedTo = (rule: SpendingRule | null): rule is SpendingRule => rule !== null && applying.has(rule.id)
  let categories = book.categories
  const changes = book.transactions.flatMap((before): RowChange[] => {
    const items = itemsOf(before)
    const [item] = items
    if (item === undefined || offered.has(before)) return []
    const followsFiling = before.categorisedBy === 'rule' || (waitsOnReview(items) && before.categorisedBy === null)
    if (!followsFiling && before.categorisedBy !== 'person') return []
    const standing = standingOf(before)
    const { filing: rule, labelling } = outcomeOf(before)
    const given = labelling?.labels ?? []
    const labelsMoved = !sameLabels(standing.labelling?.labels ?? [], given)
    const labelledPart = (part: TransactionItem): TransactionItem => (labelsMoved || (appliedTo(labelling) && given.some((label) => !part.labels.includes(label))) ? withRuleLabels(part, given) : part)
    if (items.length > 1) {
      const parts = items.map(labelledPart)
      return parts.every((part, at) => part === items[at]) ? [] : [{ before, after: before, items: parts }]
    }
    const labelled = labelledPart(item)
    const filingMoves = followsFiling && (!sameFiling(standing.filing, rule) || (appliedTo(rule) && !filedAs(item, rule)))
    const ruleLink = filingMoves && rule?.link != null && item.link === null ? rule.link : null
    const refiles = filingMoves && (ruleLink === null || !ruleLinkWaits(ruleLink, links))
    const category = refiles ? (rule?.category ?? null) : item.category
    const after = refiles ? { ...before, categorisedBy: category === null ? null : ('rule' as const) } : before
    const filed = refiledItems([labelled], category)
    if (ruleLink !== null && links !== null && refiles && category !== null) {
      const place = { currency: currencies.get(before.account) ?? EURO, categories, language: links.language, notes: links.notes }
      const paying = ruleLinking({ row: after, items: filed }, ruleLink, links, linked, place, newKey)
      if (paying !== null) {
        if (paying.target?.kind === 'instalment') linked.add(rowLinkText(paying.target.link))
        categories = [...categories, ...paying.added]
        return [{ before, after: paying.entry.row, items: paying.entry.items }]
      }
    }
    return category === item.category && after.categorisedBy === before.categorisedBy && labelled === item ? [] : [{ before, after, items: filed }]
  })
  return { changes, categories: categories.slice(book.categories.length) }
}
