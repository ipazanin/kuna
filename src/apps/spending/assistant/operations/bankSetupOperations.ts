import type { BankSetup } from '../../bankSync/application/bankSync'
import { addBankAccounts, bringBackBankDetails, fixOpening, keepMine, keepOutOfKuna, takeBankDetails } from '../../bankSync/application/bankSetupWrites'
import { BANK_ACCOUNT_LINES, canStartOn, setupActions, setupLineKey, setupLines, startDays } from '../../bankSync/domain/bankAccountSetup'
import type { AccountProposal, BankAccountStart, SetupAction, SetupLine } from '../../bankSync/domain/bankAccountSetup'
import { currentDifferences } from '../../bankSync/domain/bankBalance'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import { ACCOUNT_RECORDS } from '../../workbook/domain/spendingKinds'
import { TEXT, TEXT_OR_NULL, dayOf, found, inputOf } from '../../../../shared/app/operationInput'
import type { AssistantOperation, ProposalStep } from '../../../../shared/app/assistantOperations'
import { StepRefused } from '../../../../shared/app/proposedWrites'
import { today } from '../../../../shared/calendar/civilDate'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'

const SETUP_ABOUT = 'line is a bank-account ref, and its offers say what it takes. Bank account steps go on a card with no other kind of step.'

function lineStep(name: string, about: string, example: string): AssistantOperation {
  return { name, about: `${about} ${SETUP_ABOUT}`, input: inputOf({ line: TEXT }), refs: { line: BANK_ACCOUNT_LINES.name }, creates: null, alone: false, example: { line: example } }
}

/** What the chat can do on the bank set-up list, as its buttons on Settings, Bank sync do. */
export const BANK_SETUP_OPERATIONS: readonly AssistantOperation[] = [
  {
    name: 'add-bank-account',
    about: `Adds the account the bank's details draft, as Add does, from the day startsOn. That is a day from its line's earliestStart to its openedOn, or null for openedOn, the day of the fetch. Its opening is the bank's balance less the rows from that day on, and only those rows come in. Ask the person from which day to track it. Several on one card add them in one write, as Add all does. ${SETUP_ABOUT}`,
    input: inputOf({ line: TEXT, startsOn: TEXT_OR_NULL }),
    refs: { line: BANK_ACCOUNT_LINES.name },
    creates: null,
    alone: false,
    example: { line: 'bank-account-missing', startsOn: '2026-10-01' },
  },
  lineStep('update-bank-account', "Gives the Spending account the bank's bank, IBAN, currency and kind, as Update account does. Its name and opening stay.", 'bank-account-update'),
  lineStep('keep-my-account-details', "Keeps the Spending account's own details, so the sync stops offering the bank's, as Keep mine does.", 'bank-account-update'),
  lineStep('leave-out-bank-account', 'Marks the linked account as one Kuna does not keep, so the sync stops offering and reading it, as Leave out does.', 'bank-account-missing'),
  lineStep(
    'bring-back-bank-account',
    "Takes a linked account off the ones not in Kuna, or for a kept account whose own details were kept offers the bank's details again, as Bring back does.",
    'bank-account-left-out',
  ),
  {
    name: 'fix-opening',
    about: "Sets the account's opening to the fixedOpening its bank-account line gives, so Kuna's balance agrees with the bank's. Its opening day stays. It goes on a card with no other kind of step.",
    input: inputOf({ account: TEXT }),
    refs: { account: ACCOUNT_RECORDS.name },
    creates: null,
    alone: false,
    example: { account: 'account' },
  },
]

const NAMES: ReadonlySet<string> = new Set(BANK_SETUP_OPERATIONS.map((operation) => operation.name))

/** Whether a step works on the bank set-up list. */
export function isBankSetupStep(step: ProposalStep): boolean {
  return NAMES.has(step.operation)
}

/** The actions each step may take on its line, the first the line offers. */
const ACTIONS: Readonly<Record<string, readonly SetupAction[]>> = {
  'add-bank-account': ['add'],
  'update-bank-account': ['update'],
  'keep-my-account-details': ['keep-mine'],
  'leave-out-bank-account': ['leave-out'],
  'bring-back-bank-account': ['bring-back', 'bring-back-mine'],
}

/** The list of linked accounts each marking action changes, which one card changes once. */
const MARKS: Readonly<Partial<Record<SetupAction, string>>> = { 'keep-mine': 'keep-mine', 'bring-back-mine': 'keep-mine', 'leave-out': 'not-in-kuna', 'bring-back': 'not-in-kuna' }

/**
 * Plans the bank set-up steps into one write, against the list as the page holds it and the file as it stands. The drafts
 * the steps add go in one write with their held rows. One card marks one linked account of each sort and changes each account once.
 */
export function planBankSetup(unit: UnitOfWork, book: SpendingBook, steps: readonly ProposalStep[], setup: BankSetup | null): void {
  if (steps.some((step) => !isBankSetupStep(step))) throw new StepRefused('Bank account steps go on a card of their own.')
  if (setup === null) throw new StepRefused('No bank sync ran on this page or device, so there is no list of bank accounts. The person syncs on Settings, Bank sync first.')
  const lines = setupLines(setup.linked, setup.proposals, book)
  bringsRowsOnce(steps, lines)
  const adding: BankAccountStart[] = []
  const marked = new Set<string>()
  const changed = new Set<string>()
  const changing = (id: string): void => {
    if (changed.has(id)) throw new StepRefused('One card changes each account once. Propose the next once it is answered.')
    changed.add(id)
  }
  for (const { operation, input } of steps) {
    if (operation === 'fix-opening') {
      const account = found(book.accounts, String(input['account']), 'account')
      const difference = currentDifferences(setup.differences, book.accounts).find((each) => each.account.id === account.id)
      if (difference?.fixedOpening == null) throw new StepRefused('The last bank sync gave no opening to set for that account. Its fixedOpening on the bank-account line says when it does.')
      changing(account.id)
      fixOpening(unit, account, difference.fixedOpening)
      continue
    }
    const line = lines.find((each) => setupLineKey(each) === input['line'])
    if (line === undefined) throw new StepRefused('That bank account is not on the list as it stands. Read the bank-account kind again.')
    if (operation === 'add-bank-account' && line.kind === 'missing' && line.proposal === null)
      throw new StepRefused('The page holds no rows for that account since it was reloaded, so the person syncs again on Settings, Bank sync before it can be added.')
    const action = setupActions(line).find((offered) => ACTIONS[operation]!.includes(offered))
    if (action === undefined) throw new StepRefused(`That bank account offers ${setupActions(line).join(', ') || 'nothing'}.`)
    const mark = MARKS[action]
    if (mark !== undefined) {
      if (marked.has(mark)) throw new StepRefused('One card marks one linked account of each sort. Propose the next once it is answered.')
      marked.add(mark)
    }
    if (action === 'add') {
      const typed = input['startsOn']
      if (line.kind === 'missing' && line.proposal !== null) adding.push(startOf(line.proposal, typeof typed === 'string' ? typed : null))
      continue
    }
    writeAction(unit, book, line, action, changing)
  }
  if (adding.length > 0) addBankAccounts(unit, book, adding, today())
}

/** Each write of held rows checks them against the file as it stood, so a card brings in the rows of one write only, as the screen does. */
function bringsRowsOnce(steps: readonly ProposalStep[], lines: readonly SetupLine[]): void {
  const withRows = steps.filter(({ operation, input }) => {
    const line = lines.find((each) => setupLineKey(each) === input['line'])
    return operation === 'add-bank-account' || (operation === 'update-bank-account' && line?.kind === 'fits' && line.proposal !== null)
  })
  const writes = new Set(withRows.map(({ operation, input }) => (operation === 'add-bank-account' ? 'add' : String(input['line']))))
  if (writes.size > 1) throw new StepRefused('Adding accounts and updating an account the fetch holds rows for go on separate cards, so each set of rows is checked against the file as it stands.')
}

/** The start a step names, on the day of the fetch when it names none, refused outside the days the account can start on. */
function startOf(proposal: AccountProposal, typed: string | null): BankAccountStart {
  const startsOn = typed === null ? proposal.fetchedOn : dayOf(typed)
  if (!canStartOn(proposal, startsOn)) {
    const { earliest, latest } = startDays(proposal)
    throw new StepRefused(`That account can start from ${earliest} to ${latest}, the days its rows and the bank's balance at the fetch cover.`)
  }
  return { proposal, startsOn }
}

function writeAction(unit: UnitOfWork, book: SpendingBook, line: SetupLine, action: Exclude<SetupAction, 'add'>, changing: (id: string) => void): void {
  switch (action) {
    case 'update':
      if ((line.kind === 'kept' || line.kind === 'fits') && line.update !== null) {
        changing(line.account.id)
        takeBankDetails(unit, book, line.account, line.update, line.kind === 'fits' ? line.proposal : null, today())
      }
      return
    case 'keep-mine':
      keepMine(unit, book, line.linked)
      return
    case 'bring-back-mine':
      bringBackBankDetails(unit, book, line.linked)
      return
    case 'leave-out':
    case 'bring-back':
      keepOutOfKuna(unit, book, line.linked, action === 'leave-out')
      return
  }
}
