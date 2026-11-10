import { FLAG_OR_NULL, NUMBER, NUMBER_OR_NULL, TEXT, TEXT_OR_NULL, choiceOf, dayOf, found, inputOf } from '../../../../shared/app/operationInput'
import { acceptingBrowserFileCards, withBrowserFileCards } from '../../../../shared/app/browserFileCards'
import type { BrowserFile } from '../../../../shared/app/browserFileCards'
import { BANK_SETUP_OPERATIONS, isBankSetupStep, planBankSetup } from './bankSetupOperations'
import { proposalGroupsOf, statementLeftOut } from './proposalLines'
import type { CardWarnings } from './proposalLines'
import { ADD_RECEIPT, keptPhotos, receiptsOutside, withPhotosRead, writeReceiptStep } from './receiptOperation'
import type { KeptPhotos, ReceiptPorts } from './receiptOperation'
import { REVIEW_OPERATIONS, writeReviewStep } from './reviewPairs'
import { IMPORT_STATEMENT, importedStatement, withSheetsRead } from './statementImport'
import type { CardStatement } from './statementImport'
import { SET_STARTING_ACCOUNT, acceptStartingAccount, setsStartingAccount, startingAccountCheck } from './startingAccountOperation'
import type { LastAccountPorts } from './startingAccountOperation'
import type { BankSetup } from '../../bankSync/application/bankSync'
import { ACCOUNT_WRITES, keptAccount, newAccount } from '../../accounts/application/accountWrites'
import { setLimit } from '../../budgets/application/budgetWrites'
import { CATEGORY_WRITES, deleteInto, newCategory } from '../../categories/application/categoryWrites'
import { lastOrder, siblingsUnder, swappedPlaces } from '../../categories/domain/categoryPlaces'
import { TRANSACTION_WRITES, newEntry, newTransfer, removeEntry, writeEntry, writeTransfer } from '../../entries/application/entryWrites'
import { removeReceiptOf } from '../../receipts/application/receiptRecords'
import { fileRow, importWithRules, payeeCondition, writeRules } from '../../statements/application/statementWrites'
import type { RuleEdits } from '../../statements/application/statementWrites'
import { SETTING_WRITES, treatPayeeAsPerson } from '../../workbook/application/settingWrites'
import { ACCOUNT_BANKS, ACCOUNT_KINDS } from '../../workbook/domain/account'
import type { Account, AccountBank, AccountKind } from '../../workbook/domain/account'
import type { Category } from '../../workbook/domain/category'
import { isFixedKind } from '../../workbook/domain/category'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import type { SpendingBooks } from '../../workbook/domain/spendingBooks'
import type { SpendingRule, SpendingRuleCondition } from '../../workbook/domain/spendingRule'
import { COMPANY_OIB_KEY } from '../../workbook/domain/spendingSettings'
import { ACCOUNT_RECORDS, CATEGORY_RECORDS, RULE_RECORDS, TRANSACTION_RECORDS } from '../../workbook/domain/spendingKinds'
import type { Transaction } from '../../workbook/domain/transaction'
import type { AppAcceptance, AppProposer, AssistantOperation, ProposalNote, ProposalStep } from '../../../../shared/app/assistantOperations'
import { StepRefused, proposedWrites, refuseBesideImport } from '../../../../shared/app/proposedWrites'
import { lookAlikesForTheModel } from '../../../../shared/ai/presentation/copiedRowsWords'
import type { OpenBooks, ProposalWork } from '../../../../shared/app/proposedWrites'
import { today } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { parseMonthKey } from '../../../../shared/calendar/monthKey'
import { SWATCHES, swatchOf } from '../../../../shared/charts/swatches'
import { absAccountMoney, accountMoneyFromAmount, negateAccountMoney } from '../../../../shared/money/accountMoney'
import type { AccountMoney } from '../../../../shared/money/accountMoney'
import { currencyCodeOf } from '../../../../shared/money/currencyCode'
import { moneyFromAmount } from '../../../../shared/money/money'
import type { WorkbookStore } from '../../../../shared/storage/application/createWorkbookStore'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import { setSetting } from '../../../../shared/storage/application/settingWrites'
import type { StrictSchema } from '../../../../shared/ai/domain/strictSchema'

const COLOUR_OR_NULL: StrictSchema = {
  type: ['string', 'null'],
  description: `A swatch by its code, ${SWATCHES.map((swatch) => `${swatch.hex} ${swatch.name}`).join(', ')}, or "" for its group's colour, or null to leave it.`,
}

/** Every change the chat can propose in Spending. Each calls the write functions the screens use. A setting that is not listed here cannot be proposed, whatever a model asks. */
export const SPENDING_OPERATIONS: readonly AssistantOperation[] = [
  {
    name: 'add-category',
    about: 'A new category in a group, or a new group with no parent. It goes one to a card, and a rule on the same card can file into it by its $ name.',
    input: inputOf({ name: TEXT, kind: { type: 'string', enum: ['spending', 'income'] }, parent: TEXT_OR_NULL, colour: COLOUR_OR_NULL, hidden: FLAG_OR_NULL }),
    refs: { parent: CATEGORY_RECORDS.name },
    creates: CATEGORY_RECORDS.name,
    alone: true,
    example: { name: 'Pets', kind: 'spending', parent: null, colour: null, hidden: null },
  },
  {
    name: 'change-category',
    about:
      'A new name, another group of the same kind for a category in a group, a colour, or hidden from the pickers or shown again. A group stays a group, and a fixed category such as Between my accounts takes only a name. Null leaves a field as it is.',
    input: inputOf({ category: TEXT, name: TEXT_OR_NULL, group: TEXT_OR_NULL, colour: COLOUR_OR_NULL, hidden: FLAG_OR_NULL }),
    refs: { category: CATEGORY_RECORDS.name, group: CATEGORY_RECORDS.name },
    creates: null,
    alone: false,
    example: { category: 'category-child', name: 'Renamed', group: 'category', colour: SWATCHES[0]!.hex, hidden: 'yes' },
  },
  {
    name: 'move-category',
    about: 'Moves a category one place up or down among the categories of its group, or a group among the groups of its kind.',
    input: inputOf({ category: TEXT, direction: { type: 'string', enum: ['up', 'down'] } }),
    refs: { category: CATEGORY_RECORDS.name },
    creates: null,
    alone: false,
    example: { category: 'category', direction: 'up' },
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
    about:
      "A rule that files rows into a category: as a row's payee or IBAN, by its ref, by words in a payee's name, or by the other side's IBAN. An alias of a person as the words covers every way they were written. Rows follow at once, and the card shows them. A rule never re-files a row a person filed.",
    input: inputOf({ row: TEXT_OR_NULL, fragment: TEXT_OR_NULL, iban: TEXT_OR_NULL, category: TEXT }),
    refs: { row: TRANSACTION_RECORDS.name, category: CATEGORY_RECORDS.name },
    spellings: ['fragment'],
    creates: null,
    alone: false,
    example: { row: 'transaction', fragment: null, iban: null, category: 'category' },
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
    about: 'A new account in one currency. kind is bank, cash or savings. bank is otp, revolut, other or null. Cash has no bank and no IBAN.',
    input: inputOf({ name: TEXT, kind: { type: 'string', enum: [...ACCOUNT_KINDS] }, bank: TEXT_OR_NULL, currency: TEXT, opening: NUMBER, openedOn: TEXT, iban: TEXT_OR_NULL }),
    refs: {},
    creates: ACCOUNT_RECORDS.name,
    alone: false,
    example: { name: 'Savings', kind: 'savings', bank: null, currency: 'EUR', opening: 100, openedOn: '2026-11-01', iban: null },
  },
  {
    name: 'change-account',
    about: 'A new name, type, bank, currency, opening balance, opening day or IBAN, or closed or open again. An account with entries keeps its currency. Null leaves a field as it is.',
    input: inputOf({
      account: TEXT,
      name: TEXT_OR_NULL,
      kind: { type: ['string', 'null'], description: `${ACCOUNT_KINDS.join(', ')}, or null to leave it.` },
      bank: { type: ['string', 'null'], description: `${ACCOUNT_BANKS.join(', ')}, none for no bank, or null to leave it.` },
      currency: TEXT_OR_NULL,
      opening: NUMBER_OR_NULL,
      openedOn: TEXT_OR_NULL,
      iban: TEXT_OR_NULL,
      closed: FLAG_OR_NULL,
    }),
    refs: { account: ACCOUNT_RECORDS.name },
    creates: null,
    alone: false,
    example: { account: 'account', name: 'Renamed', kind: null, bank: null, currency: null, opening: 250, openedOn: null, iban: null, closed: 'yes' },
  },
  {
    name: 'delete-account',
    about: 'Deletes an account no entry is on. One with entries is closed instead.',
    input: inputOf({ account: TEXT }),
    refs: { account: ACCOUNT_RECORDS.name },
    creates: null,
    alone: false,
    example: { account: 'account-empty' },
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
    about:
      "Files a row under a category, or fixes its account, kind, date, amount, payee or note. kind is out or in, and sets the amount's sign. A row a statement brought keeps its account and what the bank said. A transfer's leg given a kind or another category becomes a plain entry, and its other leg goes. Otherwise a leg takes a new account, date or amount only through change-transfer. Null leaves a field as it is.",
    input: inputOf({
      entry: TEXT,
      account: TEXT_OR_NULL,
      kind: { type: ['string', 'null'], description: 'out, in, or null to leave it.' },
      category: TEXT_OR_NULL,
      date: TEXT_OR_NULL,
      amount: NUMBER_OR_NULL,
      payee: TEXT_OR_NULL,
      note: TEXT_OR_NULL,
    }),
    refs: { entry: TRANSACTION_RECORDS.name, account: ACCOUNT_RECORDS.name, category: CATEGORY_RECORDS.name },
    creates: null,
    alone: false,
    example: { entry: 'transaction', account: null, kind: null, category: 'category', date: null, amount: null, payee: null, note: 'Checked' },
  },
  {
    name: 'add-transfer',
    about:
      "Money moved between two of your accounts, as two legs under Between my accounts that name each other. amount is what left from, above zero. toAmount is what reached to in its own currency, and is needed only when the two accounts' currencies differ.",
    input: inputOf({ from: TEXT, to: TEXT, date: TEXT, amount: NUMBER, toAmount: NUMBER_OR_NULL, payee: TEXT, note: TEXT }),
    refs: { from: ACCOUNT_RECORDS.name, to: ACCOUNT_RECORDS.name },
    creates: null,
    alone: false,
    example: { from: 'account', to: 'account-other', date: '2026-11-02', amount: 50, toAmount: null, payee: '', note: '' },
  },
  {
    name: 'change-transfer',
    about:
      'Makes an entry a transfer between two of your accounts, or changes a transfer through either leg. The entry stays the leg its money already is, so an entry that is no transfer yet needs the account on its other side. Amounts are above zero as in add-transfer. Null leaves a field as it is.',
    input: inputOf({ entry: TEXT, from: TEXT_OR_NULL, to: TEXT_OR_NULL, date: TEXT_OR_NULL, amount: NUMBER_OR_NULL, toAmount: NUMBER_OR_NULL, payee: TEXT_OR_NULL, note: TEXT_OR_NULL }),
    refs: { entry: TRANSACTION_RECORDS.name, from: ACCOUNT_RECORDS.name, to: ACCOUNT_RECORDS.name },
    creates: null,
    alone: false,
    example: { entry: 'transaction', from: null, to: 'account-other', date: null, amount: null, toAmount: null, payee: null, note: null },
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
    name: 'remove-receipt',
    about: 'Takes the receipt off an entry, with the lines it split the entry into, and keeps the entry. The photo stays where it was kept.',
    input: inputOf({ entry: TEXT }),
    refs: { entry: TRANSACTION_RECORDS.name },
    creates: null,
    alone: false,
    example: { entry: 'transaction-receipt' },
  },
  ADD_RECEIPT,
  {
    name: 'flag-person',
    about: "Flags an entry's payee as a person, so the chat sends the name under an alias from then on. Only a person takes a flag off, on the entry's dialog.",
    input: inputOf({ entry: TEXT }),
    refs: { entry: TRANSACTION_RECORDS.name },
    creates: null,
    alone: false,
    example: { entry: 'transaction' },
  },
  ...REVIEW_OPERATIONS,
  IMPORT_STATEMENT,
  ...BANK_SETUP_OPERATIONS,
  SET_STARTING_ACCOUNT,
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

function flagOf(text: string | null, kept: boolean): boolean {
  return text === null ? kept : text === 'yes'
}

function conditionOf(fragment: string | null, iban: string | null, kept: SpendingRuleCondition): SpendingRuleCondition {
  if (iban !== null && iban.trim() !== '') return { column: 'counterparty_iban', iban: iban.replace(/\s+/g, '').toUpperCase() }
  if (fragment !== null && fragment.trim() !== '') return { column: 'counterparty_contains', fragment: fragment.trim() }
  return kept
}

/** An amount above zero, as a transfer's legs are typed. */
function positiveOf(amount: number): AccountMoney {
  const money = accountMoneyFromAmount(amount)
  if (money <= 0) throw new StepRefused('A transfer amount is above zero.')
  return money
}

/** The swatch a step names, blank for the group's colour, or the colour kept. */
function colourOf(text: string | null, kept: string): string {
  if (text === null) return kept
  if (text.trim() === '') return ''
  const swatch = swatchOf(text)
  if (swatch === null) throw new StepRefused(`colour is a swatch code, ${SWATCHES.map((choice) => choice.hex).join(', ')}, or "".`)
  return swatch.hex
}

/** A category with its changes, last among its new siblings when it moves to another group, as the category dialog writes it. */
function changedCategory(book: SpendingBook, before: Category, field: Readonly<Record<string, never>>, groupOf: (value: unknown) => Category): Category {
  const name = (field['name'] as string | null)?.trim() ?? before.name
  if (isFixedKind(before.kind)) {
    if (field['group'] !== null || field['colour'] !== null || field['hidden'] !== null) throw new StepRefused('A fixed category takes only a name.')
    return { ...before, name }
  }
  let { parent, order } = before
  if (field['group'] !== null) {
    const group = groupOf(field['group'])
    if (before.parent === null) throw new StepRefused('A group stays a group, so it takes no other group.')
    if (group.parent !== null || group.kind !== before.kind) throw new StepRefused('group is a group of the same kind.')
    if (group.id !== before.parent) {
      parent = group.id
      order = lastOrder(siblingsUnder(book.categories, group.id, before.kind).filter((sibling) => sibling.id !== before.id))
    }
  }
  return { ...before, name, parent, order, colour: colourOf(field['colour'], before.colour), hidden: flagOf(field['hidden'], before.hidden) }
}

/** A day on which both accounts were open, as the entry dialog asks. */
function openedBy(day: CivilDate, accounts: readonly Account[]): CivilDate {
  if (accounts.some((account) => day < account.openedOn)) throw new StepRefused('That day is before the account opened.')
  return day
}

/** The two legs of a transfer the step asks for, with the amount that reached the other account when its currency differs. */
function transferLegs(
  book: SpendingBook,
  from: Account,
  to: Account,
  day: CivilDate,
  amount: AccountMoney,
  arrived: AccountMoney | null,
  entry: Pick<Transaction, 'payee' | 'note'>,
): readonly [Transaction, Transaction] {
  const transfer = book.categories.find((category) => category.kind === 'transfer')
  if (transfer === undefined) throw new StepRefused('The file has no Between my accounts category to file a transfer under.')
  if (from.id === to.id) throw new StepRefused('A transfer moves money between two different accounts.')
  if (from.currency !== to.currency && arrived === null) throw new StepRefused("The two accounts' currencies differ, so toAmount says what reached the other one.")
  return newTransfer(
    { account: from.id, amount },
    { account: to.id, amount: from.currency === to.currency ? amount : arrived! },
    { date: openedBy(day, [from, to]), payee: entry.payee, note: entry.note, category: transfer.id },
  )
}

/** A transfer's legs from either one, the money-out leg first, or null for a plain entry. */
function legsOf(book: SpendingBook, row: Transaction): readonly [Transaction, Transaction] | null {
  const other = row.pair === null ? undefined : book.transactions.find((candidate) => candidate.id === row.pair)
  if (other === undefined) return null
  return row.amount < 0 ? [row, other] : [other, row]
}

const IMPORTING: ReadonlySet<string> = new Set([IMPORT_STATEMENT.name])

/** The rule steps an import card may hold, since the rules on its card file its new rows. */
const FILING_IMPORTED_ROWS: ReadonlySet<string> = new Set(['add-rule', 'change-rule', 'delete-rule'])

/**
 * Plans the steps into one write, in order. A `$` name stands for what an earlier step made, and the rules are re-run once,
 * over all of them, and file a statement's new rows. `kept` holds the Drive id of each receipt photo Accept kept. Gives what
 * the card warns on: what the import leaves out of its statement, and each receipt's checks that failed.
 */
function planned(unit: UnitOfWork, books: OpenBooks<SpendingBooks>, steps: readonly ProposalStep[], ports: SpendingPorts, kept: KeptPhotos | undefined): CardWarnings {
  refuseBesideImport(steps, IMPORTING, FILING_IMPORTED_ROWS)
  if (steps.some(isBankSetupStep)) {
    planBankSetup(unit, books.workbook, steps, ports.device.bankSetup())
    return { leftOut: null, receipts: [] }
  }
  if (steps.some((step) => step.operation === ADD_RECEIPT.name) && steps.some((step) => step.operation === 'add-category'))
    throw new StepRefused('A new category goes on a card before the receipt, and the receipt card files into it once that card is accepted.')
  let book = books.workbook
  const made = new Map<string, string>()
  const edits: { filing: NonNullable<RuleEdits['filing']>[number][]; fixing: NonNullable<RuleEdits['fixing']>[number][]; deleting: SpendingRule[] } = { filing: [], fixing: [], deleting: [] }
  let imported: CardStatement | null = null
  const receiptWarnings: ProposalNote[] = []
  const idOf = (value: unknown): string => {
    const text = String(value)
    return made.get(text) ?? text
  }
  const categoryOf = (value: unknown): Category => found(book.categories, idOf(value), 'category')
  const accountOf = (value: unknown): Account => found(book.accounts, idOf(value), 'account')
  const rowOf = (value: unknown): Transaction => found(book.transactions, idOf(value), 'row')

  for (const [at, { operation, input, as }] of steps.entries()) {
    // The chat checked the input against this operation's schema, so each field has the type the schema gives it.
    const field = input as Readonly<Record<string, never>>
    switch (operation) {
      case 'add-category': {
        const parent = field['parent'] === null ? null : categoryOf(field['parent']).id
        const kind = field['kind'] as Category['kind']
        const category: Category = newCategory({
          name: field['name'],
          kind,
          parent,
          order: lastOrder(siblingsUnder(book.categories, parent, kind)),
          colour: colourOf(field['colour'], ''),
          hidden: flagOf(field['hidden'], false),
        })
        unit.of(CATEGORY_WRITES).add(category)
        book = { ...book, categories: [...book.categories, category] }
        if (as !== null) made.set(as, category.id)
        break
      }
      case 'change-category': {
        const before = categoryOf(field['category'])
        unit.of(CATEGORY_WRITES).change(before, changedCategory(book, before, field, categoryOf))
        break
      }
      case 'move-category': {
        const category = categoryOf(field['category'])
        const siblings = siblingsUnder(book.categories, category.parent, category.kind)
        const changes = swappedPlaces(siblings, siblings.indexOf(category), field['direction'] === 'up' ? -1 : 1)
        if (changes.length === 0) throw new StepRefused(`That category is already ${field['direction'] === 'up' ? 'first' : 'last'} where it is.`)
        changes.forEach(([before, after]) => unit.of(CATEGORY_WRITES).change(before, after))
        break
      }
      case 'delete-category':
        deleteInto(unit, books.records, categoryOf(field['category']), categoryOf(field['into']))
        break
      case 'add-rule': {
        const row = field['row'] === null ? null : rowOf(field['row'])
        const fragments: readonly (string | null)[] = Array.isArray(field['fragment']) ? field['fragment'] : [field['fragment']]
        const iban = field['iban'] as string | null
        const conditions =
          row !== null
            ? [payeeCondition(row)]
            : iban !== null && iban.trim() !== ''
              ? [conditionOf(null, iban, { column: 'counterparty_contains', fragment: '' })]
              : fragments.map((fragment) => conditionOf(fragment, null, { column: 'counterparty_contains', fragment: '' }))
        const category = categoryOf(field['category']).id
        for (const condition of conditions) {
          if (condition === null || (condition.column === 'counterparty_contains' && condition.fragment === ''))
            throw new StepRefused('A rule needs a row with a payee or an IBAN, words to look for, or an IBAN.')
          edits.filing.push({ condition, category })
        }
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
        if (currency === null) throw new StepRefused('That currency is not one Kuna knows. Write its three-letter ISO code, such as EUR or USD.')
        const account = newAccount({
          name: field['name'],
          kind: field['kind'] as AccountKind,
          bank: choiceOf(ACCOUNT_BANKS, field['bank'], 'bank'),
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
        const currency = field['currency'] === null ? before.currency : currencyCodeOf(field['currency'])
        if (currency === null) throw new StepRefused('That currency is not one Kuna knows. Write its three-letter ISO code, such as EUR or USD.')
        const bank: AccountBank | 'none' | null = choiceOf([...ACCOUNT_BANKS, 'none'], field['bank'], 'bank')
        unit.of(ACCOUNT_WRITES).change(
          before,
          keptAccount({
            ...before,
            name: (field['name'] as string | null) ?? before.name,
            kind: choiceOf(ACCOUNT_KINDS, field['kind'], 'kind') ?? before.kind,
            bank: bank === null ? before.bank : bank === 'none' ? null : bank,
            currency,
            opening: field['opening'] === null ? before.opening : accountMoneyFromAmount(field['opening']),
            openedOn: field['openedOn'] === null ? before.openedOn : dayOf(field['openedOn']),
            iban: (field['iban'] as string | null) ?? before.iban,
            closed: flagOf(field['closed'], before.closed),
          }),
        )
        break
      }
      case 'delete-account':
        unit.of(ACCOUNT_WRITES).remove(accountOf(field['account']))
        break
      case 'add-entry': {
        const account = accountOf(field['account'])
        const entry = newEntry({
          account: account.id,
          date: openedBy(dayOf(field['date']), [account]),
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
        const before = rowOf(field['entry'])
        const kind = choiceOf(['out', 'in'], field['kind'], 'kind')
        const filedUnder = field['category'] === null ? null : categoryOf(field['category'])
        const onlyFiled = [field['account'], field['kind'], field['date'], field['amount'], field['payee'], field['note']].every((value) => value === null)
        const legs = legsOf(book, before)
        const plain = legs !== null && (kind !== null || (filedUnder !== null && filedUnder.kind !== 'transfer'))
        if (onlyFiled && filedUnder !== null && legs === null) {
          fileRow(unit, before, filedUnder)
          break
        }
        const amount = field['amount'] === null ? before.amount : accountMoneyFromAmount(field['amount'])
        const account = accountOf(field['account'] ?? before.account)
        const date = field['date'] === null ? before.date : dayOf(field['date'])
        const typed: Transaction = {
          ...before,
          account: account.id,
          date,
          amount: kind === null ? amount : kind === 'out' ? negateAccountMoney(absAccountMoney(amount)) : absAccountMoney(amount),
          payee: (field['payee'] as string | null) ?? before.payee,
          note: (field['note'] as string | null) ?? before.note,
          category: filedUnder?.id ?? before.category,
          pair: plain ? null : before.pair,
        }
        if (legs !== null && !plain && (typed.account !== before.account || typed.date !== before.date || typed.amount !== before.amount))
          throw new StepRefused("That entry is a transfer's leg, so its account, date or amount change through change-transfer, which keeps both legs in step.")
        if (field['account'] !== null || field['date'] !== null) openedBy(date, [account])
        writeEntry(unit, before, typed, plain ? (legs.find((leg) => leg !== before) ?? null) : null)
        break
      }
      case 'add-transfer': {
        const from = accountOf(field['from'])
        const to = accountOf(field['to'])
        const arrived = field['toAmount'] === null ? null : positiveOf(field['toAmount'])
        writeTransfer(unit, null, null, transferLegs(book, from, to, dayOf(field['date']), positiveOf(field['amount']), arrived, { payee: field['payee'], note: field['note'] }))
        break
      }
      case 'change-transfer': {
        const before = rowOf(field['entry'])
        const legs = legsOf(book, before)
        const isOut = legs !== null || before.amount < 0
        const keptFrom = legs?.[0].account ?? (isOut ? before.account : null)
        const keptTo = legs?.[1].account ?? (isOut ? null : before.account)
        const fromId = field['from'] === null ? keptFrom : accountOf(field['from']).id
        const toId = field['to'] === null ? keptTo : accountOf(field['to']).id
        if (fromId === null || toId === null) throw new StepRefused('An entry that is no transfer yet needs the account on its other side.')
        const from = accountOf(fromId)
        const to = accountOf(toId)
        const sameCurrency = from.currency === to.currency
        const keptAmount = legs !== null ? absAccountMoney(legs[0].amount) : isOut || sameCurrency ? absAccountMoney(before.amount) : null
        const keptArrived = legs !== null ? absAccountMoney(legs[1].amount) : !isOut || sameCurrency ? absAccountMoney(before.amount) : null
        const amount = field['amount'] === null ? keptAmount : positiveOf(field['amount'])
        if (amount === null) throw new StepRefused('amount says what left the other account in its own currency.')
        const arrived = field['toAmount'] === null ? keptArrived : positiveOf(field['toAmount'])
        const day = field['date'] === null ? (legs?.[0].date ?? before.date) : dayOf(field['date'])
        const entry = { payee: (field['payee'] as string | null) ?? before.payee, note: (field['note'] as string | null) ?? before.note }
        writeTransfer(unit, before, legs, transferLegs(book, from, to, day, amount, arrived, entry))
        break
      }
      case 'delete-entry':
        removeEntry(unit, books.records, rowOf(field['entry']))
        break
      case 'remove-receipt': {
        const row = rowOf(field['entry'])
        if (!book.receipts.some((receipt) => receipt.transaction === row.id) && !book.lines.some((line) => line.transaction === row.id)) throw new StepRefused('That entry has no receipt.')
        removeReceiptOf(unit, books.records, row)
        break
      }
      case 'add-receipt': {
        const { split, warning } = writeReceiptStep(unit, book, field, idOf, ports.receipts, kept?.[at] ?? '')
        book = {
          ...book,
          transactions: split.before === null ? [...book.transactions, split.row] : book.transactions.map((row) => (row.id === split.row.id ? split.row : row)),
          receipts: [...book.receipts, split.receipt],
        }
        if (warning !== null) receiptWarnings.push(warning)
        break
      }
      case 'flag-person': {
        const payee = rowOf(field['entry']).payee.trim()
        if (payee === '') throw new StepRefused('That entry has no payee to flag.')
        treatPayeeAsPerson(unit, book.readings.settings.facts, payee, true)
        break
      }
      case 'join-rows':
      case 'pair-rows':
      case 'unpair-rows':
        writeReviewStep(unit, book, operation, rowOf(field['row']))
        break
      case 'import-statement':
        if (imported !== null) throw new StepRefused('A card imports one statement.')
        imported = importedStatement(field, book, accountOf)
        break
      case 'set-setting':
        setSetting(unit, SETTING_WRITES, book.readings.settings.facts, field['key'], field['value'])
        break
      default:
        throw new StepRefused('There is no such operation.')
    }
  }
  if (imported !== null) {
    const run = importWithRules(unit, book, edits, imported.statement, today())
    const leftOut = statementLeftOut(imported, run)
    const lookAlikes = leftOut.lookAlikes.map(({ number }) => number)
    if (lookAlikes.length > 0 && run.added.length + run.changed.length === 0) throw new StepRefused(lookAlikesForTheModel(lookAlikes, true))
    return { leftOut, receipts: receiptWarnings }
  }
  if (edits.filing.length + edits.fixing.length + edits.deleting.length > 0) writeRules(unit, book, edits)
  return { leftOut: null, receipts: receiptWarnings }
}

/** How the chat's steps become one write of the Spending file. The card warns on what the plan leaves out or doubts, so each check gets its own. A receipt photo kept on Drive stays there after Undo. */
function spendingWork(ports: SpendingPorts): ProposalWork<SpendingBooks, KeptPhotos> {
  let warnings: CardWarnings = { leftOut: null, receipts: [] }
  return {
    notOpen: NOT_OPEN,
    plan: (unit, books, steps, kept) => {
      warnings = planned(unit, books, steps, ports, kept)
    },
    groups: (checked, { workbook }) => proposalGroupsOf(checked, workbook, warnings),
    outside: receiptsOutside,
    heldBack: () => {
      const rows = warnings.leftOut?.rows ?? 0
      const lookAlikes = (warnings.leftOut?.lookAlikes ?? []).map(({ number }) => number)
      const leftOut =
        rows === 1
          ? '1 row of the statement is left out, as it falls before the account opened or the bank sync covers its day.'
          : `${rows} rows of the statement are left out, as they fall before the account opened or the bank sync covers their day.`
      const told = [...(lookAlikes.length === 0 ? [] : [lookAlikesForTheModel(lookAlikes, false)]), ...(rows === 0 ? [] : [`${leftOut} Tell the person, and ask before proposing them another way.`])]
      return told.length === 0 ? null : told.join(' ')
    },
    overLimit: (steps) =>
      steps.some((step) => step.operation === IMPORT_STATEMENT.name)
        ? 'A part of a statement cannot shrink, so put the rules on a card of their own before the import, then propose the import again.'
        : null,
  }
}

const NOT_OPEN = 'The Spending file is not open on this device.'

/** What this device holds for Spending's chat outside the books: the bank set-up list the page holds and the account a new entry starts on. */
export interface SpendingDevice extends LastAccountPorts {
  bankSetup(): BankSetup | null
}

/** What `app.ts` hands the operations besides the store. */
export interface SpendingPorts {
  readonly receipts: ReceiptPorts
  readonly device: SpendingDevice
}

/**
 * The changes the chat can propose and their dry run, over the app's own store and the ports `app.ts` hands in. An attached
 * sheet and a receipt photo are read before the dry run. A card that sets the starting account changes this device alone.
 */
export function spendingProposer(store: Pick<WorkbookStore<SpendingBooks>, 'state' | 'check' | 'write' | 'undo'>, ports: SpendingPorts, file: BrowserFile): AppProposer {
  return withBrowserFileCards(
    {
      operations: SPENDING_OPERATIONS,
      readsBooks: true,
      async check(title, steps) {
        if (setsStartingAccount(steps)) {
          const accounts = store.state.workbook?.accounts
          if (accounts === undefined) return { refused: [NOT_OPEN] }
          try {
            return startingAccountCheck(title, steps, accounts, ports.device)
          } catch (failure) {
            if (failure instanceof StepRefused) return { refused: [failure.message] }
            throw failure
          }
        }
        const sheetsRead = await withSheetsRead(steps)
        if ('refused' in sheetsRead) return sheetsRead
        const read = await withPhotosRead(sheetsRead, ports.receipts)
        return 'refused' in read ? read : proposedWrites(store, spendingWork(ports)).check(title, read)
      },
    },
    file,
  )
}

/**
 * Writes a proposal as it was checked, in one write with one Undo, after keeping any receipt photo it asks to keep. A record
 * changed since refuses this proposal alone, and the file's other writes go on. A starting account card sets this device instead.
 */
export function spendingAcceptance(store: Pick<WorkbookStore<SpendingBooks>, 'state' | 'check' | 'write' | 'undo'>, ports: SpendingPorts, file: BrowserFile): AppAcceptance {
  const keptBefore = new WeakMap<Blob, string>()
  const { accept } = proposedWrites(store, { ...spendingWork(ports), beforeWrite: (steps) => keptPhotos(steps, ports.receipts, keptBefore) })
  return acceptingBrowserFileCards({ accept: async (proposal) => acceptStartingAccount(proposal, ports.device) ?? accept(proposal) }, file)
}
