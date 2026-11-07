import { ACCOUNT_WRITES, newAccount } from '../../accounts/application/accountWrites'
import { setLimit } from '../../budgets/application/budgetWrites'
import { CATEGORY_WRITES, deleteInto, newCategory } from '../../categories/application/categoryWrites'
import { TRANSACTION_WRITES, newEntry, removeEntry, retypedEntry } from '../../entries/application/entryWrites'
import { fileRow, payeeCondition, writeRules } from '../../statements/application/statementWrites'
import type { RuleEdits } from '../../statements/application/statementWrites'
import { setSetting } from '../../workbook/application/settingWrites'
import type { Account, AccountBank, AccountKind } from '../../workbook/domain/account'
import type { Category } from '../../workbook/domain/category'
import type { SpendingBooks } from '../../workbook/domain/spendingBooks'
import type { SpendingRule, SpendingRuleCondition } from '../../workbook/domain/spendingRule'
import { COMPANY_OIB_KEY } from '../../workbook/domain/spendingSettings'
import { ACCOUNT_RECORDS, CATEGORY_RECORDS, RULE_RECORDS, TRANSACTION_RECORDS } from '../../workbook/domain/spendingKinds'
import type { Transaction } from '../../workbook/domain/transaction'
import { words } from '../words'
import type { AppAcceptance, AppProposer, AssistantOperation, CheckedProposal, ProposalStep } from '../../../../shared/app/assistantOperations'
import type { StrictSchema } from '../../../../shared/ai/domain/strictSchema'
import { parseCivilDate } from '../../../../shared/calendar/civilDate'
import { parseMonthKey } from '../../../../shared/calendar/monthKey'
import { accountMoneyFromAmount } from '../../../../shared/money/accountMoney'
import { currencyCodeOf } from '../../../../shared/money/currencyCode'
import { moneyFromAmount } from '../../../../shared/money/money'
import { canUndo } from '../../../../shared/storage/application/createWorkbookStore'
import type { WorkbookStore, WriteCheck } from '../../../../shared/storage/application/createWorkbookStore'
import { workOf } from '../../../../shared/storage/application/recordWrites'
import type { RuledChange } from '../../../../shared/storage/application/recordWrites'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import { WorkbookWriteRefused } from '../../../../shared/storage/application/workbookWriteRefused'
import { proposalGroupsOf } from './proposalLines'

const TEXT: StrictSchema = { type: 'string' }
const TEXT_OR_NULL: StrictSchema = { type: ['string', 'null'] }
const NUMBER: StrictSchema = { type: 'number' }
const NUMBER_OR_NULL: StrictSchema = { type: ['number', 'null'] }
const FLAG_OR_NULL: StrictSchema = { type: ['string', 'null'], description: '"yes", "no", or null to leave it.' }

function inputOf(properties: Readonly<Record<string, StrictSchema>>): StrictSchema {
  return { type: 'object', properties, required: Object.keys(properties), additionalProperties: false }
}

/** The most changes a card may hold. Larger ones go as several cards, so a person can still read them. */
const MOST_CHANGES = 200

/** Every change the chat can propose in Spending. Each calls the write functions the screens use. A setting that is not listed here cannot be proposed, whatever a model asks. */
export const SPENDING_OPERATIONS: readonly AssistantOperation[] = [
  {
    name: 'add-category',
    about: 'A new category in a group, or a new group with no parent. It goes one to a card, and a rule on the same card can file into it by its $ name.',
    input: inputOf({ name: TEXT, kind: { type: 'string', enum: ['spending', 'income'] }, parent: TEXT_OR_NULL }),
    refs: { parent: CATEGORY_RECORDS.name },
    creates: CATEGORY_RECORDS.name,
    alone: true,
    example: { name: 'Pets', kind: 'spending', parent: null },
  },
  {
    name: 'change-category',
    about: 'A new name, or hidden from the pickers or shown again. Null leaves a field as it is.',
    input: inputOf({ category: TEXT, name: TEXT_OR_NULL, hidden: FLAG_OR_NULL }),
    refs: { category: CATEGORY_RECORDS.name },
    creates: null,
    alone: false,
    example: { category: 'category', name: 'Renamed', hidden: null },
  },
  {
    name: 'delete-category',
    about: 'Deletes a category. Its entries, receipt lines and rules move to another, and its limits go.',
    input: inputOf({ category: TEXT, into: TEXT }),
    refs: { category: CATEGORY_RECORDS.name, into: CATEGORY_RECORDS.name },
    creates: null,
    alone: false,
    example: { category: 'category', into: 'category-other' },
  },
  {
    name: 'add-rule',
    about: "A rule that files rows into a category: as a row's payee or IBAN, by its ref, or by words in a payee's name. Rows follow at once, and the card shows them.",
    input: inputOf({ row: TEXT_OR_NULL, fragment: TEXT_OR_NULL, category: TEXT }),
    refs: { row: TRANSACTION_RECORDS.name, category: CATEGORY_RECORDS.name },
    creates: null,
    alone: false,
    example: { row: 'transaction', fragment: null, category: 'category' },
  },
  {
    name: 'change-rule',
    about: 'Fixes a rule: other words, another IBAN or another category. Null leaves a field as it is. Rows follow at once.',
    input: inputOf({ rule: TEXT, fragment: TEXT_OR_NULL, iban: TEXT_OR_NULL, category: TEXT_OR_NULL }),
    refs: { rule: RULE_RECORDS.name, category: CATEGORY_RECORDS.name },
    creates: null,
    alone: false,
    example: { rule: 'rule', fragment: 'Market', iban: null, category: null },
  },
  {
    name: 'delete-rule',
    about: 'Deletes a rule. The rows it filed follow the rules that are left.',
    input: inputOf({ rule: TEXT }),
    refs: { rule: RULE_RECORDS.name },
    creates: null,
    alone: false,
    example: { rule: 'rule' },
  },
  {
    name: 'set-limit',
    about: 'A monthly limit in euros on a spending category from a month on. Zero ends it.',
    input: inputOf({ category: TEXT, from: TEXT, amount: NUMBER }),
    refs: { category: CATEGORY_RECORDS.name },
    creates: null,
    alone: false,
    example: { category: 'category', from: '2026-11', amount: 150 },
  },
  {
    name: 'add-account',
    about: 'A new account in one currency. kind is bank, cash or savings. bank is otp, revolut, other or null.',
    input: inputOf({ name: TEXT, kind: { type: 'string', enum: ['bank', 'cash', 'savings'] }, bank: TEXT_OR_NULL, currency: TEXT, opening: NUMBER, openedOn: TEXT, iban: TEXT_OR_NULL }),
    refs: {},
    creates: ACCOUNT_RECORDS.name,
    alone: false,
    example: { name: 'Savings', kind: 'savings', bank: null, currency: 'EUR', opening: 100, openedOn: '2026-11-01', iban: null },
  },
  {
    name: 'change-account',
    about: 'A new name or IBAN, or closed or open again. Null leaves a field as it is.',
    input: inputOf({ account: TEXT, name: TEXT_OR_NULL, iban: TEXT_OR_NULL, closed: FLAG_OR_NULL }),
    refs: { account: ACCOUNT_RECORDS.name },
    creates: null,
    alone: false,
    example: { account: 'account', name: 'Renamed', iban: null, closed: null },
  },
  {
    name: 'add-entry',
    about: "A typed entry. Credits above zero, debits below, in the account's currency. category may be null to wait on To review.",
    input: inputOf({ account: TEXT, date: TEXT, amount: NUMBER, payee: TEXT, category: TEXT_OR_NULL, note: TEXT }),
    refs: { account: ACCOUNT_RECORDS.name, category: CATEGORY_RECORDS.name },
    creates: TRANSACTION_RECORDS.name,
    alone: false,
    example: { account: 'account', date: '2026-11-01', amount: -12.5, payee: 'A shop', category: 'category', note: '' },
  },
  {
    name: 'change-entry',
    about: 'Files a row under a category, or fixes its date, amount, payee or note. Null leaves a field as it is. A row keeps what the bank said.',
    input: inputOf({ entry: TEXT, category: TEXT_OR_NULL, date: TEXT_OR_NULL, amount: NUMBER_OR_NULL, payee: TEXT_OR_NULL, note: TEXT_OR_NULL }),
    refs: { entry: TRANSACTION_RECORDS.name, category: CATEGORY_RECORDS.name },
    creates: null,
    alone: false,
    example: { entry: 'transaction', category: 'category', date: null, amount: null, payee: null, note: 'Checked' },
  },
  {
    name: 'delete-entry',
    about: 'Deletes an entry, with its other leg and its receipt.',
    input: inputOf({ entry: TEXT }),
    refs: { entry: TRANSACTION_RECORDS.name },
    creates: null,
    alone: false,
    example: { entry: 'transaction' },
  },
  {
    name: 'set-setting',
    about: "A setting's value, for the keys listed here. Blank removes it.",
    input: inputOf({ key: { type: 'string', enum: [COMPANY_OIB_KEY] }, value: TEXT }),
    refs: {},
    creates: null,
    alone: false,
    example: { key: COMPANY_OIB_KEY, value: '12345678903' },
  },
]

/** Says why a step cannot be planned, in words the model can act on. */
class StepRefused extends Error {}

function dayOf(text: string): Transaction['date'] {
  const day = parseCivilDate(text)
  if (day === null) throw new StepRefused(`${text} does not read as a day such as 2026-10-31.`)
  return day
}

function flagOf(text: string | null, kept: boolean): boolean {
  return text === null ? kept : text === 'yes'
}

function found<R extends { readonly id: string }>(records: readonly R[], id: string, what: string): R {
  const record = records.find((candidate) => candidate.id === id)
  if (record === undefined) throw new StepRefused(`That ${what} is no longer in the file.`)
  return record
}

function conditionOf(fragment: string | null, iban: string | null, kept: SpendingRuleCondition): SpendingRuleCondition {
  if (iban !== null && iban.trim() !== '') return { column: 'counterparty_iban', iban: iban.replace(/\s+/g, '').toUpperCase() }
  if (fragment !== null && fragment.trim() !== '') return { column: 'counterparty_contains', fragment: fragment.trim() }
  return kept
}

/** Plans the steps into one write, in order. A `$` name stands for what an earlier step made, and the rules are re-run once, over all of them. */
function planned(unit: UnitOfWork, books: SpendingBooks, steps: readonly ProposalStep[]): void {
  let book = books.workbook
  const made = new Map<string, string>()
  const edits: { filing: NonNullable<RuleEdits['filing']>[number][]; fixing: NonNullable<RuleEdits['fixing']>[number][]; deleting: SpendingRule[] } = { filing: [], fixing: [], deleting: [] }
  const idOf = (value: unknown): string => {
    const text = String(value)
    return made.get(text) ?? text
  }
  const categoryOf = (value: unknown): Category => found(book.categories, idOf(value), 'category')
  const accountOf = (value: unknown): Account => found(book.accounts, idOf(value), 'account')

  for (const { operation, input, as } of steps) {
    // The chat checked the input against this operation's schema, so each field has the type the schema gives it.
    const field = input as Readonly<Record<string, never>>
    switch (operation) {
      case 'add-category': {
        const parent = field['parent'] === null ? null : categoryOf(field['parent']).id
        const siblings = book.categories.filter((category) => category.parent === parent)
        const category: Category = newCategory({ name: field['name'], kind: field['kind'], parent, order: Math.max(0, ...siblings.map((sibling) => sibling.order)) + 1, colour: '', hidden: false })
        unit.of(CATEGORY_WRITES).add(category)
        book = { ...book, categories: [...book.categories, category] }
        if (as !== null) made.set(as, category.id)
        break
      }
      case 'change-category': {
        const before = categoryOf(field['category'])
        unit.of(CATEGORY_WRITES).change(before, { ...before, name: (field['name'] as string | null)?.trim() ?? before.name, hidden: flagOf(field['hidden'], before.hidden) })
        break
      }
      case 'delete-category':
        deleteInto(unit, books.records, categoryOf(field['category']), categoryOf(field['into']))
        break
      case 'add-rule': {
        const row = field['row'] === null ? null : found(book.transactions, idOf(field['row']), 'row')
        const condition = row === null ? conditionOf(field['fragment'], null, { column: 'counterparty_contains', fragment: '' }) : payeeCondition(row)
        if (condition === null || (condition.column === 'counterparty_contains' && condition.fragment === ''))
          throw new StepRefused('A rule needs a row with a payee or an IBAN, or words to look for.')
        edits.filing.push({ condition, category: categoryOf(field['category']).id })
        break
      }
      case 'change-rule': {
        const rule = found(book.rules, idOf(field['rule']), 'rule')
        edits.fixing.push({ rule, condition: conditionOf(field['fragment'], field['iban'], rule.condition), category: field['category'] === null ? rule.category : categoryOf(field['category']).id })
        break
      }
      case 'delete-rule':
        edits.deleting.push(found(book.rules, idOf(field['rule']), 'rule'))
        break
      case 'set-limit': {
        const from = parseMonthKey(field['from'])
        if (from === null) throw new StepRefused('A month reads as 2026-10.')
        setLimit(unit, books.records, categoryOf(field['category']).id, from, moneyFromAmount(field['amount']))
        break
      }
      case 'add-account': {
        const currency = currencyCodeOf(field['currency'])
        if (currency === null) throw new StepRefused('That currency is not one Kuna knows.')
        const account = newAccount({
          name: field['name'],
          kind: field['kind'] as AccountKind,
          bank: field['bank'] as AccountBank | null,
          currency,
          opening: accountMoneyFromAmount(field['opening']),
          openedOn: dayOf(field['openedOn']),
          iban: (field['iban'] as string | null) ?? '',
          closed: false,
        })
        unit.of(ACCOUNT_WRITES).add(account)
        book = { ...book, accounts: [...book.accounts, account] }
        if (as !== null) made.set(as, account.id)
        break
      }
      case 'change-account': {
        const before = accountOf(field['account'])
        unit.of(ACCOUNT_WRITES).change(before, {
          ...before,
          name: (field['name'] as string | null)?.trim() ?? before.name,
          iban: (field['iban'] as string | null)?.trim() ?? before.iban,
          closed: flagOf(field['closed'], before.closed),
        })
        break
      }
      case 'add-entry': {
        const entry = newEntry({
          account: accountOf(field['account']).id,
          date: dayOf(field['date']),
          amount: accountMoneyFromAmount(field['amount']),
          payee: field['payee'],
          category: field['category'] === null ? null : categoryOf(field['category']).id,
          note: field['note'],
        })
        unit.of(TRANSACTION_WRITES).add(entry)
        book = { ...book, transactions: [...book.transactions, entry] }
        if (as !== null) made.set(as, entry.id)
        break
      }
      case 'change-entry': {
        const before = found(book.transactions, idOf(field['entry']), 'row')
        const onlyFiled = field['date'] === null && field['amount'] === null && field['payee'] === null && field['note'] === null
        const filedUnder = field['category'] === null ? null : categoryOf(field['category'])
        if (onlyFiled && filedUnder !== null) {
          fileRow(unit, before, filedUnder)
        } else {
          const typed: Transaction = {
            ...before,
            date: field['date'] === null ? before.date : dayOf(field['date']),
            amount: field['amount'] === null ? before.amount : accountMoneyFromAmount(field['amount']),
            payee: (field['payee'] as string | null) ?? before.payee,
            note: (field['note'] as string | null) ?? before.note,
            category: filedUnder?.id ?? before.category,
          }
          unit.of(TRANSACTION_WRITES).change(before, retypedEntry(before, typed))
        }
        break
      }
      case 'delete-entry':
        removeEntry(unit, books.records, found(book.transactions, idOf(field['entry']), 'row'))
        break
      case 'set-setting':
        setSetting(unit, book.readings.settings.facts, field['key'], field['value'])
        break
      default:
        throw new StepRefused('There is no such operation.')
    }
  }
  if (edits.filing.length + edits.fixing.length + edits.deleting.length > 0) writeRules(unit, book, edits)
}

/** What a proposal holds for Accept, which only this file reads. */
interface HeldWrite {
  readonly title: string
  readonly changes: readonly RuledChange[]
}

/** The changes the chat can propose and their dry run, over the app's own store, which `app.ts` hands in. */
export function spendingProposer(store: Pick<WorkbookStore<SpendingBooks>, 'state' | 'check'>): AppProposer {
  return {
    operations: SPENDING_OPERATIONS,
    async check(title, steps) {
      const { workbook, records } = store.state
      if (workbook === null || records === null) return { refused: ['The Spending file is not open on this device.'] }
      let check: WriteCheck
      try {
        check = await store.check(title, (unit) => planned(unit, { workbook, records }, steps))
      } catch (failure) {
        if (failure instanceof StepRefused) return { refused: [failure.message] }
        throw failure
      }
      if (check.status === 'refused') return { refused: [check.reason] }
      if (check.status === 'nothingToChange') return { refused: ['Nothing would change.'] }
      const { checked } = check
      if (checked.changes.length > MOST_CHANGES) return { refused: [`That is ${checked.changes.length} changes. A card holds ${MOST_CHANGES}, so propose fewer and then the rest.`] }
      const held: HeldWrite = { title, changes: checked.changes }
      return { title, count: checked.changes.length, groups: proposalGroupsOf(checked, workbook), held } satisfies CheckedProposal
    },
  }
}

/** Writes a proposal as it was checked, in one write with one Undo. A record changed since refuses this proposal alone, and the file's other writes go on. */
export function spendingAcceptance(store: Pick<WorkbookStore<SpendingBooks>, 'state' | 'write' | 'undo'>): AppAcceptance {
  const refusedBy = (failure: unknown): { readonly kind: 'refused'; readonly reason: string } => {
    if (failure instanceof WorkbookWriteRefused) return { kind: 'refused', reason: failure.message }
    throw failure
  }
  return {
    async accept(proposal) {
      const { title, changes } = proposal.held as HeldWrite
      try {
        const receipt = await store.write(title, workOf(changes))
        return {
          kind: 'done',
          async undo() {
            const write = store.state.writes.find((candidate) => candidate.receipt === receipt)
            if (write === undefined || !canUndo(write, store.state.writes)) return { kind: 'refused', reason: words.proposals.noUndo }
            try {
              await store.undo(write)
              return { kind: 'undone' }
            } catch (failure) {
              return refusedBy(failure)
            }
          },
        }
      } catch (failure) {
        return refusedBy(failure)
      }
    },
  }
}
