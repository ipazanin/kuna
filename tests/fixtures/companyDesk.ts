import { companyAcceptance, companyProposer } from '../../src/apps/company/assistant/operations/companyOperations'
import { FILE_OPEN } from './browserFile'
import type { CompanyOperationPorts } from '../../src/apps/company/assistant/operations/companyOperations'
import { hrDooOperations } from '../../src/apps/company/packs/hr-doo/assistant/operations/packOperations'
import type { MailDraftsSwitch } from '../../src/apps/company/assistant/operations/mailDraftsOperation'
import type { SetUpAnswer } from '../../src/apps/company/assistant/operations/setUpAnswers'
import type { GmailForDrafts } from '../../src/apps/company/invoicing/application/invoiceGoogle'
import type { StatementReading } from '../../src/apps/company/imports/domain/importedStatement'
import { RULE_COLUMNS } from '../../src/apps/company/rules/domain/readRules'
import type { CompanyBooks } from '../../src/apps/company/workbook/domain/readWorkbook'
import type { Transaction } from '../../src/apps/company/workbook/domain/workbook'
import type { ChatReads } from '../../src/shared/ai/application/chatReads'
import { proposeChanges } from '../../src/shared/ai/application/chatProposals'
import type { ChatAttachment } from '../../src/shared/ai/domain/chatAttachments'
import { chatRefs } from '../../src/shared/ai/domain/chatRefs'
import type { CheckedProposal } from '../../src/shared/app/assistantOperations'
import { newPseudonyms } from '../../src/shared/privacy/domain/pseudonyms'
import type { WorkbookStore } from '../../src/shared/storage/application/createWorkbookStore'
import type { CellValue } from '../../src/apps/company/workbook/infrastructure/workbookSnapshot'
import { LEDGER_HEADER, browserHarness, ruleRow } from './writeBack'

/** The IBAN of the account no row is on yet, which the camt fixture's statement is of. */
export const FRESH_IBAN = 'HR2923400091110000001'

/** Ledger rows newest first, all made up: two waiting, four confirmed, two of them a purchase and its refund, one filed by a rule, and one split. */
const LEDGER: CellValue[][] = [
  [46305, 'main', 's-003', 'NEW SHOP', '', 'Card purchase', -50, 760, 'unknown', 'ai', 'REF-9', '', '', '', '', '', '', ''],
  [46304, 'main', 's-003', 'MARKET ONE', '', 'Card purchase', -30, 810, 'office', 'ai', 'REF-8', '', '', '', '', '', '', ''],
  [46303, 'main', 's-003', 'HOTEL SEA', '', 'Stay', -100, 840, 'office', 'ivan', 'REF-7', '', '', '', '', '', '', ''],
  [46302, 'main', 's-002', 'Desk Co', '', 'Desk', -60, 940, 'equipment', 'ivan', 'REF-6', '', '', '', '', '', '', ''],
  [46301, 'main', 's-002', 'MODEL API INC', '', 'Card purchase', -20, 1000, 'ai-services', 'rule', 'REF-5', '', '', '', '', '', '', ''],
  [46300, 'main', 's-001', 'Client Ltd', '', 'Invoice 1', 1020, 1020, 'revenue', 'rule', 'REF-4', '', '', '', '', '', '', ''],
  [46299, 'main', 's-001', 'PAPER CORNER', '', 'Card refund', 10, 0, 'office', 'ivan', 'REF-3', '', '', '', '', '', '', ''],
  [46299, 'main', 's-001', 'PAPER CORNER', '', 'Card purchase', -10, -10, 'office', 'ivan', 'REF-2', '', '', '', '', '', '', ''],
]

const CATEGORY_COLUMNS = ['category', 'label', 'family', 'bucket', 'roles', 'vat', 'owner_share']

/** A company with owner pay on, a split hotel stay, an account and a category nothing names, and a dismissed suggestion. */
function deskGrids(): Record<string, CellValue[][]> {
  return {
    ledger: [LEDGER_HEADER, ...LEDGER.map((row) => [...row])],
    categories: [
      CATEGORY_COLUMNS,
      ['equipment', '', 'operating', 'operating', 'deductible-cost', 'deductible-25', ''],
      ['ai-services', '', 'operating', 'operating', 'deductible-cost', 'deductible-25', ''],
      ['office', 'Office', 'operating', 'operating', 'deductible-cost', 'deductible-25', ''],
      ['travel', 'Travel', 'operating', 'operating', 'deductible-cost', 'deductible-25', ''],
      ['spare', 'Spare', 'operating', 'operating', 'deductible-cost', 'deductible-25', ''],
      ['revenue', '', 'income', 'income', 'revenue', 'none', ''],
      ['owner-benefit', '', 'owner-pay', 'owner-pay', 'owner-benefit', 'none', ''],
    ],
    accounts: [
      ['account', 'iban'],
      ['main', 'XX00FAKE0000000001'],
      ['fresh', FRESH_IBAN],
    ],
    settings: [
      ['key', 'value'],
      ['review_label', 'ivan'],
      ['owner_pay_module', 'TRUE'],
      ['old_key', 'left over'],
      ['import_profile_saved-profile', 'account=main; date=Datum; date_format=dd.mm.yyyy; decimal=comma; amount=Iznos'],
    ],
    rules: [[...RULE_COLUMNS], ruleRow({ rule: 'merchant-model', order: 100, enabled: true, counterparty_contains: 'MODEL', category: 'ai-services', confidence: 'rule' })],
    splits: [
      ['date', 'account', 'row_amount', 'row_balance', 'amount', 'category', 'note', 'id'],
      [46303, 'main', -100, 840, -70, 'travel', '', 'part-1'],
      [46303, 'main', -100, 840, -30, 'office', 'Private part', 'part-2'],
    ],
    dismissed: [
      ['kind', 'key', 'category', 'dismissed_on', 'id'],
      ['not-covered', 'name:DESK CO', 'equipment', 46302, 'dismissal-1'],
    ],
  }
}

/** The answers to the set-up questions this device keeps, as a test holds them. */
export function setUpAnswersHeld(): CompanyOperationPorts['setUpAnswers'] & { readonly held: Set<SetUpAnswer> } {
  const held = new Set<SetUpAnswer>()
  return { held, given: (answer) => held.has(answer), give: (answer) => held.add(answer), takeBack: (answer) => held.delete(answer) }
}

/** This device's switch for invoice drafts as a test holds it: off, with Gmail as given, and a consent that grants Gmail unless it is told to refuse. */
export function mailDraftsHeld(gmail: GmailForDrafts = 'held', refuses: string | null = null): MailDraftsSwitch & { readonly asked: number } {
  let on = false
  let stands = gmail
  let asked = 0
  return {
    get asked() {
      return asked
    },
    on: () => on,
    switchTo: (switched) => {
      on = switched
    },
    gmail: () => stands,
    askGmail: () => {
      asked += 1
      if (refuses !== null) return Promise.reject(new Error(refuses))
      stands = 'held'
      return Promise.resolve()
    },
  }
}

/** The chat over a Company store: its refs, the cards it was shown, and its proposer and acceptance with the ports given. */
export interface CompanyChat {
  readonly reads: ChatReads
  readonly cards: CheckedProposal[]
  readonly ports: CompanyOperationPorts
  ref(kind: string, id: string): string
  propose(steps: readonly { readonly op: string; readonly input: unknown; readonly as?: string }[], attachments?: readonly ChatAttachment[]): ReturnType<typeof proposeChanges>
  accept(at?: number): ReturnType<ReturnType<typeof companyAcceptance>['accept']>
}

/** A Company file where every operation's example has what it needs, with the chat over it. */
export interface CompanyDesk extends CompanyChat {
  readonly store: WorkbookStore<CompanyBooks>
  /** A ledger row by its reference. */
  row(reference: string): Transaction
}

export interface DeskPorts {
  readonly heldStatements?: () => readonly StatementReading[]
  readonly pack?: CompanyOperationPorts['pack']
  readonly mailDrafts?: MailDraftsSwitch
}

/** The ports a test hands Company's proposer: nothing was held unless given, and the pack's changes as installed. */
export function deskPorts(given: DeskPorts = {}): CompanyOperationPorts {
  return {
    heldStatements: given.heldStatements ?? (() => []),
    setUpAnswers: setUpAnswersHeld(),
    mailDrafts: given.mailDrafts ?? mailDraftsHeld(),
    pack: given.pack === undefined ? hrDooOperations(() => false) : given.pack,
  }
}

/** The chat proposing to Company over the store, as Company's wiring hands it the ports. */
export function companyChat(store: WorkbookStore<CompanyBooks>, ports: CompanyOperationPorts, anonymising = true): CompanyChat {
  const reads: ChatReads = { readers: new Map(), pseudonyms: newPseudonyms(), refs: chatRefs(), anonymising: () => anonymising, persons: () => [], mayRead: () => true }
  const cards: CheckedProposal[] = []
  const proposers = new Map([['company', companyProposer(store, ports, FILE_OPEN)]])
  return {
    reads,
    cards,
    ports,
    ref: (kind, id) => reads.refs.recordRef({ app: 'company', kind, id }),
    propose: (steps, attachments = []) =>
      proposeChanges(
        { app: 'company', title: 'A title', steps: steps.map((step) => ({ op: step.op, input: JSON.stringify(step.input), as: step.as ?? null })), next: false },
        proposers,
        reads,
        attachments,
        (_app, card) => cards.push(card),
      ),
    accept: (at = cards.length - 1) => companyAcceptance(store, ports, FILE_OPEN).accept(cards[at]!),
  }
}

/** The desk's file, with `tabs` added or put in place of its own, such as the pack's tabs a test needs. */
export async function companyDesk(used: Set<string>, given: DeskPorts = {}, tabs: Record<string, CellValue[][]> = {}): Promise<CompanyDesk> {
  const { store } = await browserHarness(used, { ...deskGrids(), ...tabs })
  const typed = store as unknown as WorkbookStore<CompanyBooks>
  return {
    ...companyChat(typed, deskPorts(given)),
    store: typed,
    row: (reference) => typed.state.workbook!.transactions.find((row) => row.reference === reference)!,
  }
}
