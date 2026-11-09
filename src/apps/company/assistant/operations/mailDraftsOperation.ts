import { words } from './words'
import type { GmailForDrafts } from '../../invoicing/application/invoiceGoogle'
import { DEVICE_SETTING } from '../../../../shared/app/assistantOperations'
import type { AcceptResult, AssistantOperation, CheckedProposal, ProposalStep, UndoResult } from '../../../../shared/app/assistantOperations'
import { inputOf } from '../../../../shared/app/operationInput'
import { words as sharedWords } from '../../../../shared/app/words'

/** Company's switch for invoice drafts in Gmail on this device, and Google's consent for Gmail that turning it on may need, which `app.ts` hands in. */
export interface MailDraftsSwitch {
  /** Whether an invoice made on this device saves a Gmail draft. */
  on(): boolean
  switchTo(on: boolean): void
  gmail(): GmailForDrafts
  /** Asks Google for Gmail in Accept's click. Throws in the person's words when Google gives no Gmail. */
  askGmail(): Promise<unknown>
}

const SWITCH = ['on', 'off'] as const

export const SWITCH_MAIL_DRAFTS: AssistantOperation = {
  name: 'switch-mail-drafts',
  about: [
    "Whether an invoice made on this device also saves a Gmail draft with the PDF attached, as the invoice dialog's switch does. Nothing is ever sent.",
    'Turning it on for books on Drive asks Google to allow Gmail drafts as the person accepts, when the page lacks that, and the card says so.',
    'It goes alone on a card, and Undo puts the switch back.',
  ].join(' '),
  input: inputOf({ drafts: { type: 'string', enum: [...SWITCH] } }),
  refs: {},
  creates: null,
  alone: true,
  example: { drafts: 'on' },
}

/** The switch as the card read it and as Accept sets it, which only this file reads. */
interface HeldSwitch {
  readonly mailDrafts: { readonly before: boolean; readonly after: boolean }
}

function isHeldSwitch(held: object): held is HeldSwitch {
  return 'mailDrafts' in held
}

function onOff(on: boolean): string {
  return on ? words.mailDrafts.on : words.mailDrafts.off
}

/** The card that switches invoice drafts, which goes alone and writes nothing to the books, or why not. */
export function mailDraftsCheck(title: string, steps: readonly ProposalStep[], drafts: MailDraftsSwitch): CheckedProposal | { readonly refused: readonly string[] } {
  if (steps.length !== 1) return { refused: ['Switching invoice drafts goes alone on a card.'] }
  const choice = SWITCH.find((candidate) => candidate === steps[0]!.input['drafts'])
  if (choice === undefined) return { refused: [`drafts is one of ${SWITCH.join(', ')}.`] }
  const before = drafts.on()
  const after = choice === 'on'
  if (before === after) return { refused: [`Invoice drafts are already ${choice} on this device.`] }
  const gmail = after ? drafts.gmail() : 'held'
  if (gmail === 'leaves')
    return { refused: ["Asking Google for Gmail here would leave the page and drop the card. Link /company/invoicing?tab=invoices, where the invoice dialog's switch turns drafts on."] }
  const held: HeldSwitch = { mailDrafts: { before, after } }
  return {
    title,
    count: 1,
    groups: [
      {
        verb: 'change',
        noun: DEVICE_SETTING,
        notes: [],
        lines: [{ label: words.mailDrafts.thisDevice, fields: [{ name: words.mailDrafts.field, before: onOff(before), after: onOff(after), warns: false }], warning: null }],
      },
    ],
    outside: gmail === 'asks' ? [words.mailDrafts.asksGmail] : [],
    undoable: true,
    heldBack: null,
    held,
  }
}

/**
 * Sets the switch of a drafts card, first asking Google for Gmail in Accept's click when turning it on needs that, and leaves it
 * as it was when Google refuses or it was switched since. Undo puts it back while it is still what the card set. Null for any other card.
 */
export function mailDraftsAccept(proposal: CheckedProposal, drafts: MailDraftsSwitch): Promise<AcceptResult> | null {
  const { held } = proposal
  return isHeldSwitch(held) ? switched(held.mailDrafts, drafts) : null
}

async function switched({ before, after }: HeldSwitch['mailDrafts'], drafts: MailDraftsSwitch): Promise<AcceptResult> {
  if (drafts.on() !== before) return { kind: 'refused', reason: words.mailDrafts.changedSince }
  if (after && drafts.gmail() !== 'held') {
    try {
      await drafts.askGmail()
    } catch (failure) {
      return { kind: 'refused', reason: failure instanceof Error ? failure.message : String(failure) }
    }
  }
  drafts.switchTo(after)
  const undo = (): Promise<UndoResult> => {
    if (drafts.on() !== after) return Promise.resolve({ kind: 'refused', reason: sharedWords.proposalUndoEnded })
    drafts.switchTo(before)
    return Promise.resolve({ kind: 'undone' })
  }
  return { kind: 'done', undo }
}
