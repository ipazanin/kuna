import { takesRowsByHand } from '../../workbook/domain/account'
import type { Account } from '../../workbook/domain/account'
import { ACCOUNT_RECORDS } from '../../workbook/domain/spendingKinds'
import { words } from '../words'
import { DEVICE_SETTING } from '../../../../shared/app/assistantOperations'
import type { AcceptResult, AssistantOperation, CheckedProposal, ProposalStep } from '../../../../shared/app/assistantOperations'
import { TEXT, found, inputOf } from '../../../../shared/app/operationInput'
import { words as sharedWords } from '../../../../shared/app/words'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** The account a new entry starts on, which this browser keeps, read and set the way the entry and receipt dialogs do. */
export interface LastAccountPorts {
  lastAccountId(): RecordId | null
  startingAccount(accounts: readonly Account[]): Account | null
  rememberLastAccount(account: Account): void
  forgetLastAccount(): void
}

export const SET_STARTING_ACCOUNT: AssistantOperation = {
  name: 'set-starting-account',
  about:
    'The open account kept by hand that a new entry or receipt starts on in this browser, which is otherwise the one last saved on. It changes this device and not the books, so it goes on a card of its own.',
  input: inputOf({ account: TEXT }),
  refs: { account: ACCOUNT_RECORDS.name },
  creates: null,
  alone: true,
  example: { account: 'account-other' },
}

/** What a starting account card holds for Accept: the id this browser kept when the card was made, the account it named, and the one Accept sets. */
interface HeldStartingAccount {
  readonly kept: RecordId | null
  readonly keptAccount: Account | null
  readonly after: Account
}

function isHeldStartingAccount(held: object): held is HeldStartingAccount {
  return 'kept' in held && 'after' in held
}

/** Whether a card's steps set the starting account, which no other step may join. */
export function setsStartingAccount(steps: readonly ProposalStep[]): boolean {
  return steps.some((step) => step.operation === SET_STARTING_ACCOUNT.name)
}

/** The card that sets the starting account, from the accounts as they stand and this browser as it is now. */
export function startingAccountCheck(title: string, steps: readonly ProposalStep[], accounts: readonly Account[], ports: LastAccountPorts): CheckedProposal | { readonly refused: readonly string[] } {
  if (steps.length > 1) return { refused: [`${SET_STARTING_ACCOUNT.name} changes this device and not the books, so it goes on a card of its own.`] }
  const after = found(accounts, String(steps[0]!.input['account']), 'account')
  if (after.closed) return { refused: ['A new entry starts only on an open account.'] }
  if (!takesRowsByHand(after)) return { refused: ['That account takes its rows from the bank, so a new entry never starts on it.'] }
  const before = ports.startingAccount(accounts)
  if (before?.id === after.id) return { refused: ['New entries already start on that account.'] }
  const kept = ports.lastAccountId()
  const held: HeldStartingAccount = { kept, keptAccount: accounts.find((account) => account.id === kept) ?? null, after }
  const field = { name: words.startingAccount.field, before: before?.name ?? null, after: after.name, warns: false }
  return {
    title,
    count: 1,
    groups: [{ verb: 'change', noun: DEVICE_SETTING, notes: [], lines: [{ label: words.startingAccount.thisDevice, fields: [field], warning: null }] }],
    outside: [],
    undoable: true,
    heldBack: null,
    held,
  }
}

/** Sets the starting account the card shows, refused when this browser's was changed since. Undo puts back the one before, or forgets it when there was none, while the card's is still the one kept. */
export function acceptStartingAccount(proposal: CheckedProposal, ports: LastAccountPorts): AcceptResult | null {
  const { held } = proposal
  if (!isHeldStartingAccount(held)) return null
  if (ports.lastAccountId() !== held.kept) return { kind: 'refused', reason: words.startingAccount.changedSince }
  ports.rememberLastAccount(held.after)
  const undo = () => {
    if (ports.lastAccountId() !== held.after.id) return Promise.resolve({ kind: 'refused' as const, reason: sharedWords.proposalUndoEnded })
    if (held.keptAccount === null) ports.forgetLastAccount()
    else ports.rememberLastAccount(held.keptAccount)
    return Promise.resolve({ kind: 'undone' as const })
  }
  return { kind: 'done', undo }
}
