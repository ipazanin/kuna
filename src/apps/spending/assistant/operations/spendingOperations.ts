import { FLAG_OR_NULL, NUMBER, NUMBER_OR_NULL, PART_AMOUNT, TEXT, TEXT_OR_NULL, choiceOf, dayOf, found, inputOf } from '../../../../shared/app/operationInput'
import { acceptingBrowserFileCards, withBrowserFileCards } from '../../../../shared/app/browserFileCards'
import type { BrowserFile } from '../../../../shared/app/browserFileCards'
import { BANK_SETUP_OPERATIONS, isBankSetupStep, planBankSetup } from './bankSetupOperations'
import { EVENT_OPERATIONS, isEventStep, writeEventStep } from './eventOperations'
import { LABEL_OPERATIONS, isLabelStep, writeLabelStep } from './labelOperations'
import { SHORTCUT_OPERATIONS, isShortcutStep, writeShortcutStep } from './shortcutOperations'
import { NO_WARNINGS, proposalGroupsOf, statementLeftOut } from './proposalLines'
import type { CardWarnings, StatementLeftOut } from './proposalLines'
import { ADD_RECEIPT, keptPhotos, receiptsOutside, withPhotosRead, writeReceiptStep } from './receiptOperation'
import type { KeptPhotos, ReceiptPorts } from './receiptOperation'
import { REVIEW_OPERATIONS, writeReviewStep } from './reviewPairs'
import { WAITING_RECEIPT_OPERATIONS, writeWaitingReceiptStep } from './waitingReceiptOperations'
import { IMPORT_STATEMENT, importedStatement } from './statementImport'
import type { CardStatement } from './statementImport'
import { SET_STARTING_ACCOUNT, acceptStartingAccount, setsStartingAccount, startingAccountCheck } from './startingAccountOperation'
import type { LastAccountPorts } from './startingAccountOperation'
import type { BankSetup } from '../../bankSync/application/bankSync'
import { ACCOUNT_WRITES, changeAccount, keptAccount, newAccount } from '../../accounts/application/accountWrites'
import { startDayMove } from '../../accounts/domain/startDayMove'
import type { StartDayMove } from '../../accounts/domain/startDayMove'
import { setLimit } from '../../budgets/application/budgetWrites'
import { CATEGORY_WRITES, deleteInto, newCategory } from '../../categories/application/categoryWrites'
import { lastOrder, siblingsUnder, swappedPlaces } from '../../categories/domain/categoryPlaces'
import { newTransfer } from '../../entries/domain/transfer'
import { heldItemsOf, moveToItems } from '../../entries/application/rowRecords'
import { isBeforeItems, moveBlockers } from '../../workbook/domain/beforeItems'
import { linkEntry, newEntry, removeEntry, removeSplitOf, unlinkEntry, writeEntry, writeEntrySplit, writeTransfer } from '../../entries/application/entryWrites'
import { instalmentLinksOf } from '../../links/domain/instalmentSplit'
import { paidLoansIn } from '../../links/domain/linkTarget'
import type { AppTargets, LinkTarget } from '../../links/domain/linkTarget'
import { fixedByBank } from '../../entries/domain/bankRows'
import { entrySplit } from '../../entries/domain/entrySplit'
import type { ItemDraft } from '../../entries/domain/entrySplit'
import { refiledReceiptLines } from '../../receipts/domain/receiptLines'
import { en as entriesEnglish } from '../../entries/presentation/words'
import { words as linkWords } from '../../links/presentation/words'
import { words as statementWords } from '../../statements/presentation/words'
import { fileRows, importWithRules, rowsRulesWouldChange, writeRules } from '../../statements/application/statementWrites'
import type { RuleEdits, RuleMove } from '../../statements/application/statementWrites'
import { treatPayeeAsPerson } from '../../workbook/application/settingWrites'
import { ACCOUNT_BANKS, ACCOUNT_KINDS, NEW_ACCOUNT_DEFAULTS, ROWS_FROM, beforeStartDay, cardsOfText, rowsFromRefusal } from '../../workbook/domain/account'
import type { Account, AccountBank, AccountKind, RowsFrom, RowsFromRefusal } from '../../workbook/domain/account'
import type { Category } from '../../workbook/domain/category'
import { holdsLink, isSplit, itemizedRow, largestItem, linkOfItems, wholeItemOf } from '../../workbook/domain/rowItems'
import type { ItemizedRow } from '../../workbook/domain/rowItems'
import { NEW_CATEGORY_DEFAULTS, isFixedKind, isTransferCategory, transferCategoryOf } from '../../workbook/domain/category'
import type { SpendingBook, SpendingRecords } from '../../workbook/domain/readSpendingBook'
import type { SpendingBooks } from '../../workbook/domain/spendingBooks'
import { payeeCondition, ruleProblem } from '../../workbook/domain/spendingRule'
import type { RuleDraft, RuleWithdrawal, SpendingRule } from '../../workbook/domain/spendingRule'
import type { Label } from '../../workbook/domain/label'
import { CONDITIONS_ABOUT, RULE_CONDITIONS, RULE_PROBLEMS, conditionsOfStep } from './ruleConditionSteps'
import { inTryingOrder } from '../../../../shared/categorising/domain/rule'
import type { RowLink } from '../../workbook/domain/rowLink'
import { ACCOUNT_RECORDS, CATEGORY_RECORDS, ITEM_RECORDS, LABEL_RECORDS, RULE_RECORDS, TRANSACTION_RECORDS } from '../../workbook/domain/spendingKinds'
import type { Transaction } from '../../workbook/domain/transaction'
import { BY_DAYS } from '../../workbook/domain/event'
import { fileNotOpen } from '../../../../shared/app/assistantOperations'
import type { AppAcceptance, AppProposer, AssistantOperation, CardNote, ProposalStep } from '../../../../shared/app/assistantOperations'
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
import { language } from '../../../../shared/text/language'
import type { WorkbookStore } from '../../../../shared/storage/application/createWorkbookStore'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { cardRecords } from '../../../../shared/app/cardRecords'
import { SPENDING_CARD_RECORDS } from './cardRecords'
import type { StrictSchema } from '../../../../shared/ai/domain/strictSchema'

const COLOUR_OR_NULL: StrictSchema = {
  type: ['string', 'null'],
  description: `A swatch by its code, ${SWATCHES.map((swatch) => `${swatch.hex} ${swatch.name}`).join(', ')}, an own colour as #rrggbb that keeps 3:1 in the light theme, or "" for its group's colour, or null to leave it.`,
}

const CARDS_INPUT: StrictSchema = {
  type: ['string', 'null'],
  description:
    'The last four digits of each card that pays from it, separated by commas, such as 3670, 1234. A row on another account that names one, such as Top-Up by *3670, pairs as a transfer. "" for no card, or null to leave them.',
}

const ROWS_FROM_ABOUT =
  'rowsFrom is by-hand when the person types its rows, imports its files or adds them through the chat, or bank-link when the bank sync fetches them. Ask the person which. bank-link needs an IBAN and a saved bank sync deployment, which the bank-sync line tells, and cash is always by-hand.'

/** Why a step's account cannot take its rows from where it says, in the chat's words. */
function refuseRowsFrom(refusal: RowsFromRefusal | null): void {
  if (refusal === 'bank-link-not-offered') throw new StepRefused('A bank link is for a bank or savings account, once the person saves a bank sync deployment on Settings, Bank sync. Make it by-hand.')
  if (refusal === 'bank-link-without-iban') throw new StepRefused("A bank link needs the account's IBAN, since the bank sync finds the account by it.")
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
    about: 'Deletes a category. Its entries, the parts entries are split into, and its rules move to another, and its limits go.',
    input: inputOf({ category: TEXT, into: TEXT }),
    refs: { category: CATEGORY_RECORDS.name, into: CATEGORY_RECORDS.name },
    creates: null,
    alone: false,
    example: { category: 'category', into: 'category-other' },
  },
  {
    name: 'add-rule',
    about: `A rule that files rows into a category, adds a label, or both, tried after the rules there are. A row's payee or IBAN by its ref makes the one condition, else ${CONDITIONS_ABOUT} An alias of a person in values covers every way they were written. stop yes ends the trying for a row it holds for. On Accept the person picks whether rows already in the book follow. withdrawal yes says the rows are cash taken out, as Bankomat at OTP: the category is then Between my accounts, the rule holds only for money out, and each row gets its other leg on the cash account cash_account names, or with none named on the one cash account of its currency. pays names a bank loan as Loans lists it: each row is then linked to the instalment it pays and split into its interest under the category and its principal under Loan principal.`,
    input: inputOf({
      row: TEXT_OR_NULL,
      conditions: RULE_CONDITIONS,
      category: TEXT_OR_NULL,
      label: TEXT_OR_NULL,
      stop: FLAG_OR_NULL,
      withdrawal: FLAG_OR_NULL,
      cash_account: TEXT_OR_NULL,
      pays: TEXT_OR_NULL,
    }),
    refs: { row: TRANSACTION_RECORDS.name, category: CATEGORY_RECORDS.name, label: LABEL_RECORDS.name, cash_account: ACCOUNT_RECORDS.name },
    spellings: ['conditions.values'],
    creates: null,
    alone: false,
    example: { row: 'transaction', conditions: [], category: 'category', label: null, stop: null, withdrawal: null, cash_account: null, pays: null },
  },
  {
    name: 'change-rule',
    about:
      'Fixes a rule: conditions in place of its own, or none to keep them, another category, a label in place of its labels, stop, whether it spots cash taken out, the cash account the cash goes to, or the bank loan its rows pay by its name in Loans, none for no loan. Null leaves a field as it is. A rule moved off Between my accounts needs withdrawal no. On Accept the person picks whether rows already in the book follow.',
    input: inputOf({
      rule: TEXT,
      conditions: RULE_CONDITIONS,
      category: TEXT_OR_NULL,
      label: TEXT_OR_NULL,
      stop: FLAG_OR_NULL,
      withdrawal: FLAG_OR_NULL,
      cash_account: TEXT_OR_NULL,
      pays: TEXT_OR_NULL,
    }),
    refs: { rule: RULE_RECORDS.name, category: CATEGORY_RECORDS.name, label: LABEL_RECORDS.name, cash_account: ACCOUNT_RECORDS.name },
    spellings: ['conditions.values'],
    creates: null,
    alone: false,
    example: { rule: 'rule', conditions: [{ test: 'payee_starts_with', values: ['Market'], not: false }], category: null, label: null, stop: null, withdrawal: null, cash_account: null, pays: null },
  },
  {
    name: 'move-rule',
    about: 'Moves a rule one place up, tried earlier, or down, tried later. On Accept the person picks whether rows already in the book follow.',
    input: inputOf({ rule: TEXT, direction: { type: 'string', enum: ['up', 'down'] } }),
    refs: { rule: RULE_RECORDS.name },
    creates: null,
    alone: true,
    example: { rule: 'rule', direction: 'down' },
  },
  {
    name: 'delete-rule',
    about: 'Deletes a rule. On Accept the person picks whether the rows it filed follow the rules that are left.',
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
    about: `A new account in one currency. kind is bank, cash or savings. bank is otp, revolut, other or null. Cash has no bank and no IBAN. ${ROWS_FROM_ABOUT} openedOn is the day it starts from, and a bank link fetches its rows from that day.`,
    input: inputOf({
      name: TEXT,
      kind: { type: 'string', enum: [...ACCOUNT_KINDS] },
      bank: TEXT_OR_NULL,
      currency: TEXT,
      opening: NUMBER,
      openedOn: TEXT,
      iban: TEXT_OR_NULL,
      cards: CARDS_INPUT,
      rowsFrom: { type: 'string', enum: [...ROWS_FROM] },
    }),
    refs: {},
    creates: ACCOUNT_RECORDS.name,
    alone: false,
    example: { name: 'Savings', kind: 'savings', bank: null, currency: 'EUR', opening: 100, openedOn: '2026-11-01', iban: null, cards: null, rowsFrom: 'by-hand' },
  },
  {
    name: 'change-account',
    about:
      "A new name, type, bank, currency, opening balance, opening day, IBAN, cards or way its rows come in, or closed or open again. rowsFrom by-hand stops the bank sync reading it, as when its bank link ended. An account with entries keeps its currency. Null leaves a field as it is. A later openedOn deletes the account's entries, receipts and bank rows on hold before it, leaves each transfer's other leg unpaired, and with opening null works out the opening that keeps today's balance. The card shows what goes. An earlier openedOn deletes nothing, and the bank sync reaches back only about 90 days, so older rows come from a statement file.",
    input: inputOf({
      account: TEXT,
      name: TEXT_OR_NULL,
      kind: { type: ['string', 'null'], description: `${ACCOUNT_KINDS.join(', ')}, or null to leave it.` },
      bank: { type: ['string', 'null'], description: `${ACCOUNT_BANKS.join(', ')}, none for no bank, or null to leave it.` },
      currency: TEXT_OR_NULL,
      opening: NUMBER_OR_NULL,
      openedOn: TEXT_OR_NULL,
      iban: TEXT_OR_NULL,
      cards: CARDS_INPUT,
      rowsFrom: { type: ['string', 'null'], description: `${ROWS_FROM.join(', ')}, or null to leave it.` },
      closed: FLAG_OR_NULL,
    }),
    refs: { account: ACCOUNT_RECORDS.name },
    creates: null,
    alone: false,
    example: { account: 'account', name: 'Renamed', kind: null, bank: null, currency: null, opening: 250, openedOn: null, iban: null, cards: '3670', rowsFrom: null, closed: 'yes' },
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
      "Files a row under a category, or fixes its account, kind, date, amount, payee or note. kind is out or in, and sets the amount's sign. A row a statement brought keeps its account and what the bank said, and on an account the bank fills its date and amount too. A transfer's leg given a kind or another category becomes a plain entry, and its other leg goes. Otherwise a leg takes a new account, date or amount only through change-transfer, and no payee. Null leaves a field as it is.",
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
      "Money moved between two of your accounts, as two legs under Between my accounts that name each other and have no payee, since the money stays yours. amount is what left from, above zero. toAmount is what reached to in its own currency, and is needed only when the two accounts' currencies differ.",
    input: inputOf({ from: TEXT, to: TEXT, date: TEXT, amount: NUMBER, toAmount: NUMBER_OR_NULL, note: TEXT }),
    refs: { from: ACCOUNT_RECORDS.name, to: ACCOUNT_RECORDS.name },
    creates: null,
    alone: false,
    example: { from: 'account', to: 'account-other', date: '2026-11-02', amount: 50, toAmount: null, note: '' },
  },
  {
    name: 'change-transfer',
    about:
      'Makes an entry a transfer between two of your accounts, or changes a transfer through either leg. The entry stays the leg its money already is, so an entry that is no transfer yet needs the account on its other side, and its payee goes, as a transfer has none. Amounts are above zero as in add-transfer. Null leaves a field as it is.',
    input: inputOf({ entry: TEXT, from: TEXT_OR_NULL, to: TEXT_OR_NULL, date: TEXT_OR_NULL, amount: NUMBER_OR_NULL, toAmount: NUMBER_OR_NULL, note: TEXT_OR_NULL }),
    refs: { entry: TRANSACTION_RECORDS.name, from: ACCOUNT_RECORDS.name, to: ACCOUNT_RECORDS.name },
    creates: null,
    alone: false,
    example: { entry: 'transaction', from: null, to: 'account-other', date: null, amount: null, toAmount: null, note: null },
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
    name: 'split-entry',
    about: [
      "Splits an entry into parts by hand, each under a category of its own, as the entry's Split does. A split has two parts or more, and splitting an entry again puts the new parts in place of its old ones.",
      "Each amount is above zero in the entry's account currency. Kuna signs it as the entry is, and exactly one part has amount null and takes the rest, which must leave something.",
      'A part goes under any category a row may take, For the company too, but never under a group with categories under it or under Between my accounts. note is the owner\'s optional words on the part, or "".',
      "part is the ref of the entry's part it keeps, which stays the same part with its new amount, category and note, or null for a new part. The one part of an entry not split yet goes to the first part that names none.",
      "Every part keeps the entry's link. A transfer's leg and an entry a receipt split stay as they are.",
    ].join(' '),
    input: inputOf({
      entry: TEXT,
      parts: { type: 'array', items: inputOf({ part: TEXT_OR_NULL, amount: PART_AMOUNT, category: TEXT, note: TEXT }) },
    }),
    refs: { entry: TRANSACTION_RECORDS.name, 'parts.part': ITEM_RECORDS.name, 'parts.category': CATEGORY_RECORDS.name },
    creates: null,
    alone: false,
    example: {
      entry: 'transaction',
      parts: [
        { part: null, amount: 30, category: 'category', note: 'Lunch' },
        { part: null, amount: null, category: 'category-other', note: '' },
      ],
    },
  },
  {
    name: 'remove-split',
    about: 'Takes the parts off an entry split by hand, and keeps the entry under the category most of its money was in. An entry a receipt split loses its lines through remove-receipt.',
    input: inputOf({ entry: TEXT }),
    refs: { entry: TRANSACTION_RECORDS.name },
    creates: null,
    alone: false,
    example: { entry: 'transaction-split' },
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
  {
    name: 'refile-receipt',
    about: [
      "Files lines of the receipt on an entry anew, as the entry dialog does. Each line names one of the receipt's lines by its ref, and takes a category as a part of split-entry does, never a group with categories under it or Between my accounts.",
      "note is the owner's words on the line, or null to keep them, and category null keeps its category. A line's amount, the entry's amount and its account stay the receipt's, and a line not named stays as it is.",
    ].join(' '),
    input: inputOf({
      entry: TEXT,
      lines: { type: 'array', items: inputOf({ line: TEXT, category: TEXT_OR_NULL, note: TEXT_OR_NULL }) },
    }),
    refs: { entry: TRANSACTION_RECORDS.name, 'lines.line': ITEM_RECORDS.name, 'lines.category': CATEGORY_RECORDS.name },
    creates: null,
    alone: false,
    example: { entry: 'transaction-receipt', lines: [{ line: 'item-receipt-line', category: 'category-child', note: 'Bread for the trip' }] },
  },
  ADD_RECEIPT,
  {
    name: 'link-entry',
    about:
      "Links an entry to the record in Loans it is, in place of any link it had, by the loan's name as Loans lists it and a day: a bank loan's instalment or interim interest by its due date, or an extra payment or an informal loan's movement by its day. A movement or an extra payment must be in Loans already. An instalment on money out of an account in euros splits a filed entry into the plan's interest under its category, principal under Loan principal, which counts as no spending, and what differs from the plan under its category. An extra payment files the whole entry under Loan principal, and an informal loan or its movement under Loans to and from people.",
    input: inputOf({
      entry: TEXT,
      loan: TEXT,
      due: { type: 'string', description: "The instalment's due date or the movement's or extra payment's day as yyyy-mm-dd." },
    }),
    refs: { entry: TRANSACTION_RECORDS.name },
    creates: null,
    alone: false,
    example: { entry: 'transaction', loan: 'Housing loan', due: '2026-11-15' },
  },
  {
    name: 'unlink-entry',
    about: 'Takes the link to a record in another app off an entry. The entry keeps its category.',
    input: inputOf({ entry: TEXT }),
    refs: { entry: TRANSACTION_RECORDS.name },
    creates: null,
    alone: false,
    example: { entry: 'transaction-linked' },
  },
  {
    name: 'flag-person',
    about: "Flags an entry's payee as a person, so the chat sends the name under an alias from then on. Only a person takes a flag off, on the entry's dialog.",
    input: inputOf({ entry: TEXT }),
    refs: { entry: TRANSACTION_RECORDS.name },
    creates: null,
    alone: false,
    example: { entry: 'transaction' },
  },
  {
    name: 'move-to-items',
    about: 'Gives every entry of a file from before parts its own parts, which then hold its category, note and link. Undo takes it back until a reload.',
    input: inputOf({}),
    refs: {},
    creates: null,
    alone: true,
    example: {},
  },
  ...LABEL_OPERATIONS,
  ...EVENT_OPERATIONS,
  ...SHORTCUT_OPERATIONS,
  ...REVIEW_OPERATIONS,
  ...WAITING_RECEIPT_OPERATIONS,
  IMPORT_STATEMENT,
  ...BANK_SETUP_OPERATIONS,
  SET_STARTING_ACCOUNT,
]

/** The records Loans lists, or why the chat cannot name one. */
function readLoans(loans: AppTargets<LinkTarget>): readonly LinkTarget[] {
  if (loans === null) throw new StepRefused('Loans is not set up on this device, so nothing in it can be linked.')
  if (loans === 'opening') throw new StepRefused('Loans is still opening. Propose the link again once it is open.')
  if (loans === 'failed') throw new StepRefused('Loans did not open, so nothing in it can be linked.')
  return loans
}

/** The record in Loans a step names by its loan's name: an instalment by its due date, or a movement or an extra payment by its day. */
function linkedTarget(loans: AppTargets<LinkTarget>, name: string, due: CivilDate): LinkTarget {
  const named = readLoans(loans)
    .filter((target) => target.kind !== 'informal-loan')
    .filter((target) => target.loanName === name && (target.kind === 'instalment' ? target.due : target.day) === due)
  if (named.length > 1) throw new StepRefused(`More than one record of a loan called ${name} falls on that day. Rename one in Loans, or link it on the entry's dialog.`)
  const [target] = named
  if (target !== undefined) return target
  throw new StepRefused(`${name} is not a loan Loans lists with an instalment, a movement or an extra payment on ${due}. Add a movement or an extra payment in Loans first, or on the entry's dialog.`)
}

/** The bank loan a rule step names by its name in Loans, none on none, or the one kept on null. */
function paidLoanOf(loans: AppTargets<LinkTarget>, name: string | null, kept: RowLink | null): RowLink | null {
  if (name === null) return kept
  if (name === 'none') return null
  const named = paidLoansIn(readLoans(loans)).filter((loan) => loan.loanName === name)
  if (named.length > 1) throw new StepRefused(`More than one bank loan is called ${name}. Rename one in Loans, or set the rule on its dialog.`)
  if (named[0] === undefined) throw new StepRefused(`${name} is not a bank loan Loans lists with a plan.`)
  return named[0].link
}

function flagOf(text: string | null, kept: boolean): boolean {
  return text === null ? kept : text === 'yes'
}

/** The withdrawal a rule step asks for: none on no, one into the named cash account or none named on yes, and on null the one kept, or one into the cash account named alone. */
function withdrawalOf(flag: string | null, cashAccount: Account | null, kept: RuleWithdrawal | null): RuleWithdrawal | null {
  if (flag === 'no') return null
  if (flag === 'yes') return { cashAccount: cashAccount?.id ?? null }
  return cashAccount === null ? kept : { cashAccount: cashAccount.id }
}

/** The rule a step drafts, refused in a sentence when it cannot be kept. */
function draftOf(draft: RuleDraft): RuleDraft {
  const problem = ruleProblem(draft)
  if (problem !== null) throw new StepRefused(RULE_PROBLEMS[problem])
  return draft
}

/** The cards a step types, or the ones kept on null. */
function typedCards(text: string | null, kept: readonly string[]): readonly string[] {
  if (text === null) return kept
  const cards = cardsOfText(text)
  if (cards === null) throw new StepRefused('Each card is its last four digits, separated by commas, such as 3670, 1234.')
  return cards
}

/** An amount above zero, as a transfer's legs are typed. */
function positiveOf(amount: number): AccountMoney {
  const money = accountMoneyFromAmount(amount)
  if (money <= 0) throw new StepRefused('A transfer amount is above zero.')
  return money
}

/** An amount above zero signed as the row is, so a part of money out is money out. */
function signedAs(row: Transaction, amount: AccountMoney): AccountMoney {
  return row.amount < 0 ? negateAccountMoney(amount) : amount
}

/** The swatch or own colour a step names, blank for the group's colour, or the colour kept. */
function colourOf(text: string | null, kept: string): string {
  if (text === null) return kept
  if (text.trim() === '') return ''
  const swatch = swatchOf(text)
  if (swatch === null) throw new StepRefused(`colour is a swatch code, ${SWATCHES.map((choice) => choice.hex).join(', ')}, an own colour as #rrggbb that keeps 3:1 in the light theme, or "".`)
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
  if (accounts.some((account) => beforeStartDay(account, day))) throw new StepRefused('That day is before the account opened.')
  return day
}

/** The two legs of a transfer the step asks for, with the amount that reached the other account when its currency differs. */
function transferLegs(book: SpendingBook, from: Account, to: Account, day: CivilDate, amount: AccountMoney, arrived: AccountMoney | null, note: string): readonly [ItemizedRow, ItemizedRow] {
  const transfer = transferCategoryOf(book.categories)
  if (transfer === null) throw new StepRefused('The file has no Between my accounts category to file a transfer under.')
  if (from.id === to.id) throw new StepRefused('A transfer moves money between two different accounts.')
  if (from.currency !== to.currency && arrived === null) throw new StepRefused("The two accounts' currencies differ, so toAmount says what reached the other one.")
  return newTransfer({ account: from.id, amount }, { account: to.id, amount: from.currency === to.currency ? amount : arrived! }, { date: openedBy(day, [from, to]), note, category: transfer.id })
}

/** A transfer's legs from either one with their items, the money-out leg first, or null for a plain entry. */
function legsOf(book: SpendingBook, row: Transaction): readonly [ItemizedRow, ItemizedRow] | null {
  const other = row.pair === null ? undefined : book.transactions.find((candidate) => candidate.id === row.pair)
  if (other === undefined) return null
  const [out, into] = row.amount < 0 ? [row, other] : [other, row]
  return [itemizedRow(book, out), itemizedRow(book, into)]
}

const IMPORTING: ReadonlySet<string> = new Set([IMPORT_STATEMENT.name])

/** The rule steps an import card may hold, since the rules on its card file its new rows. */
const FILING_IMPORTED_ROWS: ReadonlySet<string> = new Set(['add-rule', 'change-rule', 'delete-rule'])

/**
 * Plans the steps into one write, in order. A `$` name stands for what an earlier step made, and the rules are re-run once,
 * over all of them, and file a statement's new rows. Each step writes on the records as the earlier steps left them, and a
 * record two steps change is changed once. `loans` are the records in Loans an entry links to, and `kept` holds the Drive id
 * of each receipt photo Accept kept. Gives what the card warns on: what the import leaves out of its statement, and each receipt's checks that failed.
 */
function planned(
  unit: UnitOfWork,
  books: OpenBooks<SpendingBooks>,
  steps: readonly ProposalStep[],
  ports: SpendingPorts,
  loans: AppTargets<LinkTarget>,
  kept: KeptPhotos | undefined,
  onlyNew: boolean,
): CardWarnings {
  refuseBesideImport(steps, IMPORTING, FILING_IMPORTED_ROWS)
  if (steps.some(isBankSetupStep)) {
    planBankSetup(unit, books.workbook, steps, ports.device.bankSetup())
    return NO_WARNINGS
  }
  const staged = cardRecords(books.records, SPENDING_CARD_RECORDS)
  const warnings = plannedSteps(staged.unit, books.workbook, staged.records, steps, ports, loans, kept, onlyNew)
  staged.writeInto(unit)
  return warnings
}

function plannedSteps(
  unit: UnitOfWork,
  workbook: SpendingBook,
  records: () => SpendingRecords,
  steps: readonly ProposalStep[],
  ports: SpendingPorts,
  loans: AppTargets<LinkTarget>,
  kept: KeptPhotos | undefined,
  onlyNew: boolean,
): CardWarnings {
  if (steps.some((step) => step.operation === ADD_RECEIPT.name) && steps.some((step) => step.operation === 'add-category'))
    throw new StepRefused('A new category goes on a card before the receipt, and the receipt card files into it once that card is accepted.')
  let book = workbook
  const links = instalmentLinksOf(loans, { language, notes: linkWords.notes })
  const made = new Map<string, string>()
  const edits: { adding: RuleDraft[]; changing: NonNullable<RuleEdits['changing']>[number][]; deleting: SpendingRule[]; moving?: RuleMove } = {
    adding: [],
    changing: [],
    deleting: [],
  }
  let imported: CardStatement | null = null
  const receiptWarnings: CardNote[] = []
  const moves: StartDayMove[] = []
  const idOf = (value: unknown): string => {
    const text = String(value)
    return made.get(text) ?? text
  }
  const categoryOf = (value: unknown): Category => found(book.categories, idOf(value), 'category')
  const accountOf = (value: unknown): Account => found(book.accounts, idOf(value), 'account')
  const rowOf = (value: unknown): Transaction => found(book.transactions, idOf(value), 'row')
  const labelOf = (value: unknown): Label => found(book.labels, idOf(value), 'label')

  for (const [at, { operation, input, as }] of steps.entries()) {
    // The chat checked the input against this operation's schema, so each field has the type the schema gives it.
    const field = input as Readonly<Record<string, never>>
    if (isLabelStep(operation)) {
      const added = writeLabelStep(unit, book, records(), operation, field, idOf)
      if (added !== null) {
        book = { ...book, labels: [...book.labels, added] }
        if (as !== null) made.set(as, added.id)
      }
      continue
    }
    if (isShortcutStep(operation)) {
      const written = writeShortcutStep(unit, book, records(), operation, field, idOf)
      if (written !== null && 'shortcut' in written) {
        book = { ...book, shortcuts: [...book.shortcuts, written.shortcut.shortcut], shortcutParts: [...book.shortcutParts, ...written.shortcut.parts] }
        if (as !== null) made.set(as, written.shortcut.shortcut.id)
      }
      if (written !== null && 'entry' in written) {
        book = { ...book, transactions: [...book.transactions, written.entry.row], items: [...book.items, ...written.entry.items] }
        if (as !== null) made.set(as, written.entry.row.id)
      }
      continue
    }
    if (isEventStep(operation)) {
      const added = writeEventStep(unit, book, records(), operation, field, idOf)
      if (added !== null) {
        book = { ...book, events: [...book.events, added] }
        if (as !== null) made.set(as, added.id)
      }
      continue
    }
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
          hidden: flagOf(field['hidden'], NEW_CATEGORY_DEFAULTS.hidden),
          role: NEW_CATEGORY_DEFAULTS.role,
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
        deleteInto(unit, records(), categoryOf(field['category']), categoryOf(field['into']))
        break
      case 'add-rule': {
        const row = field['row'] === null ? null : rowOf(field['row'])
        const conditions = row !== null ? [payeeCondition(row)].flatMap((condition) => condition ?? []) : conditionsOfStep(field['conditions'], book.accounts)
        if (conditions.length === 0) throw new StepRefused('A rule needs a row with a payee or an IBAN, or conditions.')
        const draft: RuleDraft = {
          conditions,
          category: field['category'] === null ? null : categoryOf(field['category']).id,
          labels: field['label'] === null ? [] : [labelOf(field['label']).id],
          stop: flagOf(field['stop'], false),
          withdrawal: withdrawalOf(field['withdrawal'], field['cash_account'] === null ? null : accountOf(field['cash_account']), null),
          link: paidLoanOf(loans, field['pays'], null),
        }
        edits.adding.push(draftOf(draft))
        break
      }
      case 'change-rule': {
        const rule = found(book.rules, idOf(field['rule']), 'rule')
        const typed: readonly unknown[] = field['conditions']
        const draft: RuleDraft = {
          conditions: typed.length === 0 ? rule.conditions : conditionsOfStep(field['conditions'], book.accounts),
          category: field['category'] === null ? rule.category : categoryOf(field['category']).id,
          labels: field['label'] === null ? rule.labels : [labelOf(field['label']).id],
          stop: flagOf(field['stop'], rule.stop),
          withdrawal: withdrawalOf(field['withdrawal'], field['cash_account'] === null ? null : accountOf(field['cash_account']), rule.withdrawal),
          link: paidLoanOf(loans, field['pays'], rule.link),
        }
        edits.changing.push({ rule, draft: draftOf(draft) })
        break
      }
      case 'move-rule': {
        const rule = found(book.rules, idOf(field['rule']), 'rule')
        const tried = inTryingOrder(book.rules)
        if (tried.at(field['direction'] === 'up' ? 0 : -1) === rule) throw new StepRefused(`That rule is already ${field['direction'] === 'up' ? 'first' : 'last'}.`)
        edits.moving = { rule: rule.id, direction: field['direction'] === 'up' ? 'up' : 'down' }
        break
      }
      case 'delete-rule':
        edits.deleting.push(found(book.rules, idOf(field['rule']), 'rule'))
        break
      case 'set-limit': {
        const from = parseMonthKey(field['from'])
        if (from === null) throw new StepRefused('A month reads as 2026-10.')
        setLimit(unit, records(), categoryOf(field['category']).id, from, moneyFromAmount(field['amount']))
        break
      }
      case 'add-account': {
        const currency = currencyCodeOf(field['currency'])
        if (currency === null) throw new StepRefused('That currency is not one Kuna knows. Write its three-letter ISO code, such as EUR or USD.')
        const typed = {
          name: field['name'],
          kind: field['kind'] as AccountKind,
          bank: choiceOf(ACCOUNT_BANKS, field['bank'], 'bank'),
          currency,
          opening: accountMoneyFromAmount(field['opening']),
          openedOn: dayOf(field['openedOn']),
          iban: (field['iban'] as string | null) ?? '',
          rowsFrom: field['rowsFrom'] as RowsFrom,
          ...NEW_ACCOUNT_DEFAULTS,
          cards: typedCards(field['cards'], NEW_ACCOUNT_DEFAULTS.cards),
        }
        refuseRowsFrom(rowsFromRefusal(typed, null, book.settings))
        const account = newAccount(typed)
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
        const move = field['openedOn'] === null ? null : startDayMove(book, before, dayOf(field['openedOn']))
        if (move !== null) moves.push(move)
        const kind = choiceOf(ACCOUNT_KINDS, field['kind'], 'kind') ?? before.kind
        const after = {
          ...before,
          name: (field['name'] as string | null) ?? before.name,
          kind,
          bank: bank === null ? before.bank : bank === 'none' ? null : bank,
          currency,
          opening: field['opening'] === null ? (move?.opening ?? before.opening) : accountMoneyFromAmount(field['opening']),
          openedOn: move?.startsOn ?? before.openedOn,
          iban: (field['iban'] as string | null) ?? before.iban,
          cards: typedCards(field['cards'], before.cards),
          rowsFrom: choiceOf(ROWS_FROM, field['rowsFrom'], 'rowsFrom') ?? (kind === 'cash' ? 'by-hand' : before.rowsFrom),
          closed: flagOf(field['closed'], before.closed),
        }
        refuseRowsFrom(rowsFromRefusal(after, before, book.settings))
        changeAccount(unit, records(), before, keptAccount(after), move)
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
          labels: [],
        })
        writeEntry(unit, records(), null, entry, null)
        book = { ...book, transactions: [...book.transactions, entry.row], items: [...book.items, ...entry.items] }
        if (as !== null) made.set(as, entry.row.id)
        break
      }
      case 'change-entry': {
        const before = itemizedRow(book, rowOf(field['entry']))
        const kind = choiceOf(['out', 'in'], field['kind'], 'kind')
        const filedUnder = field['category'] === null ? null : categoryOf(field['category'])
        const onlyFiled = [field['account'], field['kind'], field['date'], field['amount'], field['payee'], field['note']].every((value) => value === null)
        const legs = legsOf(book, before.row)
        const plain = legs !== null && (kind !== null || (filedUnder !== null && !isTransferCategory(filedUnder)))
        const [whole] = before.items
        if (isSplit(before.items) && (filedUnder !== null || field['note'] !== null))
          throw new StepRefused('That entry is split, so each part keeps its own category and note. split-entry changes them.')
        if (onlyFiled && filedUnder !== null && legs === null) {
          fileRows(unit, records(), [before.row], filedUnder)
          break
        }
        const amount = field['amount'] === null ? before.row.amount : accountMoneyFromAmount(field['amount'])
        const account = accountOf(field['account'] ?? before.row.account)
        const date = field['date'] === null ? before.row.date : dayOf(field['date'])
        const typed: Transaction = {
          ...before.row,
          account: account.id,
          date,
          amount: kind === null ? amount : kind === 'out' ? negateAccountMoney(absAccountMoney(amount)) : absAccountMoney(amount),
          payee: (field['payee'] as string | null) ?? before.row.payee,
          pair: plain ? null : before.row.pair,
        }
        const filing = {
          category: filedUnder?.id ?? whole?.category ?? null,
          note: (field['note'] as string | null) ?? whole?.note ?? '',
          link: whole?.link ?? null,
          labels: whole?.labels ?? [],
          event: whole?.event ?? BY_DAYS,
        }
        const onAccount = accountOf(before.row.account)
        if (fixedByBank(before.row, onAccount) && (typed.date !== before.row.date || typed.amount !== before.row.amount))
          throw new StepRefused(`The bank booked that row on ${onAccount.name}, so its date and amount stay. Its category, payee, note and split can change.`)
        if (legs !== null && !plain && (typed.account !== before.row.account || typed.date !== before.row.date || typed.amount !== before.row.amount))
          throw new StepRefused("That entry is a transfer's leg, so its account, date or amount change through change-transfer, which keeps both legs in step.")
        if (legs !== null && !plain && typed.payee !== before.row.payee) throw new StepRefused("That entry is a transfer's leg, a move between the person's own accounts, so it takes no payee.")
        if (isSplit(before.items) && typed.amount !== before.row.amount) throw new StepRefused('That entry is split, so its amount stays. remove-split takes the split off first.')
        if (field['account'] !== null || field['date'] !== null) openedBy(date, [account])
        const otherLeg = plain ? (legs.map(({ row }) => row).find((leg) => leg.id !== before.row.id) ?? null) : null
        writeEntry(unit, records(), before, { row: typed, items: [wholeItemOf(typed, filing)] }, otherLeg)
        break
      }
      case 'add-transfer': {
        const from = accountOf(field['from'])
        const to = accountOf(field['to'])
        const arrived = field['toAmount'] === null ? null : positiveOf(field['toAmount'])
        writeTransfer(unit, records(), null, null, transferLegs(book, from, to, dayOf(field['date']), positiveOf(field['amount']), arrived, field['note'] as string))
        break
      }
      case 'change-transfer': {
        const before = rowOf(field['entry'])
        const legs = legsOf(book, before)
        const legRows = legs?.map(({ row }) => row) ?? null
        const isOut = legs !== null || before.amount < 0
        const keptFrom = legRows?.[0]?.account ?? (isOut ? before.account : null)
        const keptTo = legRows?.[1]?.account ?? (isOut ? null : before.account)
        const fromId = field['from'] === null ? keptFrom : accountOf(field['from']).id
        const toId = field['to'] === null ? keptTo : accountOf(field['to']).id
        if (fromId === null || toId === null) throw new StepRefused('An entry that is no transfer yet needs the account on its other side.')
        const from = accountOf(fromId)
        const to = accountOf(toId)
        const sameCurrency = from.currency === to.currency
        const keptAmount = legs !== null ? absAccountMoney(legs[0].row.amount) : isOut || sameCurrency ? absAccountMoney(before.amount) : null
        const keptArrived = legs !== null ? absAccountMoney(legs[1].row.amount) : !isOut || sameCurrency ? absAccountMoney(before.amount) : null
        const amount = field['amount'] === null ? keptAmount : positiveOf(field['amount'])
        if (amount === null) throw new StepRefused('amount says what left the other account in its own currency.')
        const arrived = field['toAmount'] === null ? keptArrived : positiveOf(field['toAmount'])
        const day = field['date'] === null ? (legs?.[0].row.date ?? before.date) : dayOf(field['date'])
        const moved = (row: Transaction): boolean => row.date !== day || absAccountMoney(row.amount) !== (row.amount < 0 ? amount : (arrived ?? amount))
        const booked = (legRows ?? [before]).find((row) => fixedByBank(row, accountOf(row.account)) && moved(row))
        if (booked !== undefined) throw new StepRefused(`The bank booked that leg on ${accountOf(booked.account).name}, so its date and amount stay.`)
        const itemized = itemizedRow(book, before)
        const note = (field['note'] as string | null) ?? largestItem(itemized.items)?.note ?? ''
        writeTransfer(unit, records(), itemized, legs, transferLegs(book, from, to, day, amount, arrived, note))
        break
      }
      case 'delete-entry':
        removeEntry(unit, records(), rowOf(field['entry']))
        break
      case 'split-entry': {
        const row = rowOf(field['entry'])
        const given = field['parts'] as readonly { readonly part: string | null; readonly amount: number | null; readonly category: string; readonly note: string }[]
        const held = itemizedRow(book, row).items
        const keptPart = (ref: string | null): RecordId | null => {
          if (ref === null) return null
          const part = held.find((candidate) => candidate.id === idOf(ref))
          if (part === undefined) throw new StepRefused("A part keeps only one of the entry's own parts.")
          return part.id
        }
        const drafts = given.map((part): ItemDraft => ({
          id: keptPart(part.part),
          amount: part.amount === null ? 'rest' : signedAs(row, accountMoneyFromAmount(part.amount)),
          category: categoryOf(part.category).id,
          note: part.note,
        }))
        const kept = drafts.flatMap((draft) => (draft.id === null ? [] : [draft.id]))
        if (new Set(kept).size < kept.length) throw new StepRefused("Each of the entry's parts is kept by one part at most.")
        const split = entrySplit(book, row, drafts)
        if ('refused' in split) throw new StepRefused(entriesEnglish.split.refusals[split.refused])
        writeEntrySplit(unit, records(), split)
        book = {
          ...book,
          transactions: book.transactions.map((held) => (held.id === row.id ? split.row : held)),
          items: [...book.items.filter((part) => part.transaction !== row.id), ...split.parts],
        }
        break
      }
      case 'remove-split': {
        const row = rowOf(field['entry'])
        if (book.receipts.some((receipt) => receipt.transaction === row.id)) throw new StepRefused('A receipt split that entry, so remove-receipt takes its lines off.')
        if (!isSplit(itemizedRow(book, row).items)) throw new StepRefused('That entry is not split.')
        removeSplitOf(unit, records(), row)
        break
      }
      case 'remove-receipt': {
        const row = rowOf(field['entry'])
        if (!book.receipts.some((receipt) => receipt.transaction === row.id)) throw new StepRefused('That entry has no receipt.')
        removeSplitOf(unit, records(), row)
        break
      }
      case 'refile-receipt': {
        const before = itemizedRow(book, rowOf(field['entry']))
        if (!book.receipts.some((receipt) => receipt.transaction === before.row.id)) throw new StepRefused('That entry has no receipt.')
        const given = field['lines'] as readonly { readonly line: string; readonly category: string | null; readonly note: string | null }[]
        const refiles = given.map((line) => {
          const held = before.items.find((item) => item.id === idOf(line.line))
          const category = line.category === null ? held?.category : categoryOf(line.category).id
          if (held === undefined || category === null || category === undefined) throw new StepRefused("A line names one of the entry's own receipt lines.")
          return { line: held.id, category, note: line.note ?? held.note }
        })
        const lines = refiledReceiptLines(book.categories, before.items, refiles)
        if ('refused' in lines) throw new StepRefused(lines.refused === 'not-a-receipt-line' ? "A line names one of the entry's own receipt lines." : entriesEnglish.split.refusals[lines.refused])
        writeEntry(unit, records(), before, { row: before.row, items: lines }, null)
        book = { ...book, items: [...book.items.filter((part) => part.transaction !== before.row.id), ...lines] }
        break
      }
      case 'add-receipt': {
        const { split, notes } = writeReceiptStep(unit, book, field, idOf, ports.receipts, kept?.[at] ?? '')
        const { before, row: filed } = split
        book = {
          ...book,
          transactions: filed === null ? book.transactions : before === null ? [...book.transactions, filed] : book.transactions.map((row) => (row.id === filed.id ? filed : row)),
          receipts: [...book.receipts, split.receipt],
          items: [...book.items.filter((part) => !split.replaced.includes(part)), ...split.lines],
        }
        receiptWarnings.push(...notes)
        break
      }
      case 'link-entry': {
        const row = rowOf(field['entry'])
        const target = linkedTarget(loans, field['loan'], dayOf(field['due']))
        const place = { currency: accountOf(row.account).currency, categories: book.categories, language, notes: linkWords.notes }
        const { entry, added } = linkEntry(unit, records(), row, target, place)
        book = {
          ...book,
          categories: [...book.categories, ...added],
          transactions: book.transactions.map((held) => (held.id === row.id ? entry.row : held)),
          items: [...book.items.filter((part) => part.transaction !== row.id), ...entry.items],
        }
        break
      }
      case 'unlink-entry': {
        const row = rowOf(field['entry'])
        const held = heldItemsOf(records())(row)
        const link = linkOfItems(held)
        if (link === null && holdsLink(held)) throw new StepRefused("That entry's parts link to different records. The person takes each part's link off on the entry's dialog.")
        if (link === null) throw new StepRefused('That entry has no link.')
        unlinkEntry(unit, records(), row, link)
        break
      }
      case 'move-to-items': {
        if (!isBeforeItems(book.stored)) throw new StepRefused('This file stores entries the current way already.')
        const { leftOut, splitLegs } = moveBlockers(book)
        if (leftOut > 0) throw new StepRefused(`${leftOut} entries or parts need fixing first: the person fixes or deletes what Overview lists as left out of the figures.`)
        if (splitLegs > 0) throw new StepRefused(`${splitLegs} transfers between the person's accounts are split. The person takes the split off them first.`)
        moveToItems(unit, book)
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
      case 'not-cash':
        writeReviewStep(unit, book, operation, rowOf(field['row']))
        break
      case 'move-to-cash':
        writeReviewStep(unit, book, operation, rowOf(field['row']), field['cash_account'] === null ? null : accountOf(field['cash_account']))
        break
      case 'place-waiting-receipt':
      case 'remove-waiting-receipt':
        writeWaitingReceiptStep(unit, book, records(), operation, field, idOf)
        break
      case 'import-statement':
        if (imported !== null) throw new StepRefused('A card imports one statement.')
        imported = importedStatement(field, book, accountOf)
        break
      default:
        throw new StepRefused('There is no such operation.')
    }
  }
  const editsRules = edits.adding.length + edits.changing.length + edits.deleting.length > 0 || edits.moving !== undefined
  // Only new rows changes no row already in the book, so its card says nothing of them.
  const refiled = editsRules && !onlyNew ? rowsRulesWouldChange(book, edits, links) : 0
  if (imported !== null) {
    const run = importWithRules(unit, book, edits, imported.statement, today(), links, !onlyNew)
    const leftOut = statementLeftOut(imported, run)
    const lookAlikes = leftOut.lookAlikes.map(({ number }) => number)
    if (lookAlikes.length > 0 && run.added.length + run.changed.length === 0) throw new StepRefused(lookAlikesForTheModel(lookAlikes, true))
    return { leftOut, receipts: receiptWarnings, moves, refiled }
  }
  if (editsRules) writeRules(unit, book, edits, links, !onlyNew)
  return { leftOut: null, receipts: receiptWarnings, moves, refiled }
}

/** How the chat's steps become one write of the Spending file. The card warns on what its own plan leaves out or doubts. A receipt photo kept on Drive stays there after Undo. */
function spendingWork(appName: string, ports: SpendingPorts): ProposalWork<SpendingBooks, KeptPhotos, CardWarnings> {
  return {
    appName,
    plan: (unit, books, steps, kept, onlyNew) => {
      return planned(unit, books, steps, ports, ports.loanTargets(), kept, onlyNew)
    },
    narrower: (warnings) => (warnings.refiled === 0 ? null : statementWords.rules.apply.onlyNew),
    card: (checked, { workbook }, warnings, steps) => ({
      groups: proposalGroupsOf(checked, workbook, ports.linkTargets, warnings),
      outside: receiptsOutside(steps),
      heldBack: statementHeldBack(warnings.leftOut),
    }),
    overLimit: (steps) =>
      steps.some((step) => step.operation === IMPORT_STATEMENT.name)
        ? 'A part of a statement cannot shrink, so put the rules on a card of their own before the import, then propose the import again.'
        : null,
  }
}

/** What the model hears of the rows a statement's import leaves out, or null when it leaves none. */
function statementHeldBack(leftOut: StatementLeftOut | null): string | null {
  const rows = leftOut?.rows ?? 0
  const lookAlikes = (leftOut?.lookAlikes ?? []).map(({ number }) => number)
  const left =
    rows === 1
      ? '1 row of the statement is left out, as it falls before the account opened, outside the days the card names or on a day the bank sync covers.'
      : `${rows} rows of the statement are left out, as they fall before the account opened, outside the days the card names or on a day the bank sync covers.`
  const told = [...(lookAlikes.length === 0 ? [] : [lookAlikesForTheModel(lookAlikes, false)]), ...(rows === 0 ? [] : [`${left} Tell the person, and ask before proposing them another way.`])]
  return told.length === 0 ? null : told.join(' ')
}

/** What this device holds for Spending's chat outside the books: the bank set-up list the page holds and the account a new entry starts on. */
export interface SpendingDevice extends LastAccountPorts {
  bankSetup(): BankSetup | null
}

/** What `app.ts` hands the operations besides the store. */
export interface SpendingPorts {
  readonly receipts: ReceiptPorts
  readonly device: SpendingDevice
  /** The records of the app a link names, which the card reads the link's state against, as the screens do. */
  linkTargets(app: string): AppTargets<LinkTarget>
  /** The records in Loans an entry or a rule's rows can link to, which a step names by the loan's name. */
  loanTargets(): AppTargets<LinkTarget>
}

/**
 * The changes the chat can propose and their dry run, over the app's own store and the ports `app.ts` hands in. A receipt
 * photo is read before the dry run. A card that sets the starting account changes this device alone.
 */
export function spendingProposer(store: Pick<WorkbookStore<SpendingBooks>, 'state' | 'check' | 'write' | 'undo'>, ports: SpendingPorts, file: BrowserFile): AppProposer {
  return withBrowserFileCards(
    {
      operations: SPENDING_OPERATIONS,
      readsBooks: true,
      async check(title, steps) {
        if (setsStartingAccount(steps)) {
          const accounts = store.state.workbook?.accounts
          if (accounts === undefined) return { refused: fileNotOpen(file.appName) }
          try {
            return startingAccountCheck(title, steps, accounts, ports.device)
          } catch (failure) {
            if (failure instanceof StepRefused) return { refused: [failure.message] }
            throw failure
          }
        }
        const read = await withPhotosRead(steps, ports.receipts)
        return 'refused' in read ? read : proposedWrites(store, spendingWork(file.appName, ports)).check(title, read)
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
  const { accept } = proposedWrites(store, { ...spendingWork(file.appName, ports), beforeWrite: (steps) => keptPhotos(steps, ports.receipts, keptBefore) })
  return acceptingBrowserFileCards({ accept: async (proposal) => acceptStartingAccount(proposal, ports.device) ?? accept(proposal) }, file)
}
