import { found } from '../../../../shared/app/operationInput'
import { acceptingBrowserFileCards, withBrowserFileCards } from '../../../../shared/app/browserFileCards'
import type { BrowserFile } from '../../../../shared/app/browserFileCards'
import { ACCOUNT_OPERATIONS, isAccountStep, writeAccountStep } from './accountOperations'
import { BANK_SETUP_OPERATIONS, isBankSetupStep, planBankSetup } from './bankSetupOperations'
import { CATEGORY_OPERATIONS, isCategoryStep, writeCategoryStep } from './categoryOperations'
import { DELETE_ENTRY, ENTRY_OPERATIONS, PAYEE_AND_FILE_OPERATIONS, isEntryStep, writeEntryStep } from './entryOperations'
import { EVENT_OPERATIONS, isEventStep, writeEventStep } from './eventOperations'
import { LABEL_OPERATIONS, isLabelStep, writeLabelStep } from './labelOperations'
import { LIMIT_OPERATIONS, isLimitStep, writeLimitStep } from './limitOperations'
import { LINK_OPERATIONS, isLinkStep, writeLinkStep } from './linkOperations'
import { FILING_IMPORTED_ROWS, RULE_OPERATIONS, editRuleStep, editsRules, isRuleStep } from './ruleOperations'
import type { CardRuleEdits } from './ruleOperations'
import { SHORTCUT_OPERATIONS, isShortcutStep, writeShortcutStep } from './shortcutOperations'
import { SPLIT_OPERATIONS, isSplitStep, writeSplitStep } from './splitOperations'
import { TRANSFER_OPERATIONS, isTransferStep, writeTransferStep } from './transferOperations'
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
import type { StartDayMove } from '../../accounts/domain/startDayMove'
import { instalmentLinksOf } from '../../links/domain/instalmentSplit'
import type { AppTargets, LinkTarget, TargetSource } from '../../links/domain/linkTarget'
import { words as linkWords } from '../../links/presentation/words'
import { words as statementWords } from '../../statements/presentation/words'
import { importWithRules, rowsRulesWouldChange, writeRules } from '../../statements/application/statementWrites'
import type { Account } from '../../workbook/domain/account'
import type { SpendingBook, SpendingRecords } from '../../workbook/domain/readSpendingBook'
import type { ItemizedRow } from '../../workbook/domain/rowItems'
import type { SpendingBooks } from '../../workbook/domain/spendingBooks'
import type { Transaction } from '../../workbook/domain/transaction'
import { fileNotOpen } from '../../../../shared/app/assistantOperations'
import type { AppAcceptance, AppProposer, AssistantOperation, CardNote, ProposalStep } from '../../../../shared/app/assistantOperations'
import { StepRefused, proposedWrites, refuseBesideImport } from '../../../../shared/app/proposedWrites'
import { lookAlikesForTheModel } from '../../../../shared/ai/presentation/copiedRowsWords'
import type { OpenBooks, ProposalWork } from '../../../../shared/app/proposedWrites'
import { today } from '../../../../shared/calendar/civilDate'
import { language } from '../../../../shared/text/language'
import type { WorkbookStore } from '../../../../shared/storage/application/createWorkbookStore'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import { cardRecords } from '../../../../shared/app/cardRecords'
import { SPENDING_CARD_RECORDS } from './cardRecords'

/** Every change the chat can propose in Spending. Each calls the write functions the screens use. A setting that is not listed here cannot be proposed, whatever a model asks. */
export const SPENDING_OPERATIONS: readonly AssistantOperation[] = [
  ...CATEGORY_OPERATIONS,
  ...RULE_OPERATIONS,
  ...LIMIT_OPERATIONS,
  ...ACCOUNT_OPERATIONS,
  ...ENTRY_OPERATIONS,
  ...TRANSFER_OPERATIONS,
  DELETE_ENTRY,
  ...SPLIT_OPERATIONS,
  ADD_RECEIPT,
  ...LINK_OPERATIONS,
  ...PAYEE_AND_FILE_OPERATIONS,
  ...LABEL_OPERATIONS,
  ...EVENT_OPERATIONS,
  ...SHORTCUT_OPERATIONS,
  ...REVIEW_OPERATIONS,
  ...WAITING_RECEIPT_OPERATIONS,
  IMPORT_STATEMENT,
  ...BANK_SETUP_OPERATIONS,
  SET_STARTING_ACCOUNT,
]

const IMPORTING: ReadonlySet<string> = new Set([IMPORT_STATEMENT.name])

/** The book with an entry in place of the row of its id, with its parts in place of the row's. */
function withEntry(book: SpendingBook, entry: ItemizedRow): SpendingBook {
  return {
    ...book,
    transactions: book.transactions.map((held) => (held.id === entry.row.id ? entry.row : held)),
    items: [...book.items.filter((part) => part.transaction !== entry.row.id), ...entry.items],
  }
}

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
  const edits: CardRuleEdits = { adding: [], changing: [], deleting: [] }
  let imported: CardStatement | null = null
  const receiptWarnings: CardNote[] = []
  const moves: StartDayMove[] = []
  const idOf = (value: unknown): string => {
    const text = String(value)
    return made.get(text) ?? text
  }
  const accountOf = (value: unknown): Account => found(book.accounts, idOf(value), 'account')
  const rowOf = (value: unknown): Transaction => found(book.transactions, idOf(value), 'row')

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
    if (isCategoryStep(operation)) {
      const added = writeCategoryStep(unit, book, records(), operation, field, idOf)
      if (added !== null) {
        book = { ...book, categories: [...book.categories, added] }
        if (as !== null) made.set(as, added.id)
      }
      continue
    }
    if (isRuleStep(operation)) {
      editRuleStep(edits, book, operation, field, idOf, loans)
      continue
    }
    if (isLimitStep(operation)) {
      writeLimitStep(unit, book, records(), field, idOf)
      continue
    }
    if (isAccountStep(operation)) {
      const { added, move } = writeAccountStep(unit, book, records(), operation, field, idOf)
      if (move !== null) moves.push(move)
      if (added !== null) {
        book = { ...book, accounts: [...book.accounts, added] }
        if (as !== null) made.set(as, added.id)
      }
      continue
    }
    if (isEntryStep(operation)) {
      const added = writeEntryStep(unit, book, records(), operation, field, idOf)
      if (added !== null) {
        book = { ...book, transactions: [...book.transactions, added.row], items: [...book.items, ...added.items] }
        if (as !== null) made.set(as, added.row.id)
      }
      continue
    }
    if (isTransferStep(operation)) {
      writeTransferStep(unit, book, records(), operation, field, idOf)
      continue
    }
    if (isSplitStep(operation)) {
      const entry = writeSplitStep(unit, book, records(), operation, field, idOf)
      if (entry !== null) book = withEntry(book, entry)
      continue
    }
    if (isLinkStep(operation)) {
      const linked = writeLinkStep(unit, book, records(), operation, field, idOf, { loans, companyPayments: ports.companyPayments() })
      if (linked !== null) book = withEntry({ ...book, categories: [...book.categories, ...linked.added] }, linked.entry)
      continue
    }
    switch (operation) {
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
  const rulesEdited = editsRules(edits)
  // Only new rows changes no row already in the book, so its card says nothing of them.
  const refiled = rulesEdited && !onlyNew ? rowsRulesWouldChange(book, edits, links) : 0
  if (imported !== null) {
    const run = importWithRules(unit, book, edits, imported.statement, today(), links, !onlyNew)
    const leftOut = statementLeftOut(imported, run)
    const lookAlikes = leftOut.lookAlikes.map(({ number }) => number)
    if (lookAlikes.length > 0 && run.added.length + run.changed.length === 0) throw new StepRefused(lookAlikesForTheModel(lookAlikes, true))
    return { leftOut, receipts: receiptWarnings, moves, refiled }
  }
  if (rulesEdited) writeRules(unit, book, edits, links, !onlyNew)
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
      groups: proposalGroupsOf(checked, workbook, ports.linkTargets, ports.linkSource, warnings),
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
  /** Which kind of app the app a link names is, which the card's words for a link it cannot show follow. */
  linkSource(app: string): TargetSource
  /** The records in Loans an entry or a rule's rows can link to, which a step names by the loan's name. */
  loanTargets(): AppTargets<LinkTarget>
  /** The payments between a company and you of every company app that is open, which a step names by Company and their day. */
  companyPayments(): readonly LinkTarget[]
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
