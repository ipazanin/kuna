import { cardRecords } from './cardRecords'
import { acceptingBrowserFileCards, withBrowserFileCards } from '../../../../shared/app/browserFileCards'
import type { BrowserFile } from '../../../../shared/app/browserFileCards'
import type { CompanyCard, CompanyOperationSet } from './companyCard'
import { IMPORTING, importOperations, withStatementFilesRead } from './importOperations'
import { INVOICING_OPERATIONS } from './invoicingOperations'
import type { HeldStatements, StatementFileReader } from './importOperations'
import { LEDGER_OPERATIONS } from './ledgerOperations'
import { SWITCH_MAIL_DRAFTS, mailDraftsAccept, mailDraftsCheck } from './mailDraftsOperation'
import type { MailDraftsSwitch } from './mailDraftsOperation'
import { proposalGroupsOf } from './proposalLines'
import { SET_UP_ANSWER, setUpAnswerCheck, setUpAnswerAccept } from './setUpAnswers'
import type { SetUpAnswers } from './setUpAnswers'
import { settingsOperations } from './settingsOperations'
import type { PackOperations } from '../companyAssistant'
import { installedPack } from '../../packs/packContribution'
import { readWorkbook } from '../../workbook/domain/readWorkbook'
import type { CompanyBooks } from '../../workbook/domain/readWorkbook'
import type { Workbook } from '../../workbook/domain/workbook'
import type { AppAcceptance, AppProposer, AssistantOperation, CardNote, ProposalStep } from '../../../../shared/app/assistantOperations'
import { StepRefused, proposedWrites, refuseBesideImport } from '../../../../shared/app/proposedWrites'
import type { OpenBooks, ProposalWork } from '../../../../shared/app/proposedWrites'
import type { WorkbookStore } from '../../../../shared/storage/application/createWorkbookStore'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'

/** What Company's operations need beyond its store, which `app.ts` hands in. */
export interface CompanyOperationPorts {
  /** Reads an attached statement file as Import reads a dropped one. */
  readonly readStatementFile: StatementFileReader
  /** The statements the last sync of the statements folder held back. */
  readonly heldStatements: HeldStatements
  /** The answers to Company's set-up questions kept on this device. */
  readonly setUpAnswers: SetUpAnswers
  /** This device's switch for invoice drafts in Gmail. */
  readonly mailDrafts: MailDraftsSwitch
  /** The installed pack's changes, or null when the pack lets the chat change nothing. */
  readonly pack: PackOperations | null
}

type CompanyStore = Pick<WorkbookStore<CompanyBooks>, 'state' | 'check' | 'write' | 'undo'>

/** The pack's changes as a part of Company's, each step planned on the records as the card's earlier steps left them. */
function packSet(pack: PackOperations): CompanyOperationSet {
  return {
    operations: pack.operations,
    planStep: (card, step) => pack.plan(card.unit, { records: card.records(), workbook: card.workbook }, step, card.idOf),
  }
}

/** Every part of what the chat can do in Company, each in its own file. */
function operationSets(ports: CompanyOperationPorts): readonly CompanyOperationSet[] {
  return [LEDGER_OPERATIONS, importOperations(ports.heldStatements), settingsOperations(), INVOICING_OPERATIONS, ...(ports.pack === null ? [] : [packSet(ports.pack)])]
}

/**
 * Plans the steps into one write, in order, each through the screens' own write functions on the books as the earlier steps
 * left them. A `$` name stands for what an earlier step made. Gives the lines the card shows beside what it writes, and what the model hears it holds back.
 */
function planned(unit: UnitOfWork, books: OpenBooks<CompanyBooks>, sets: readonly CompanyOperationSet[], steps: readonly ProposalStep[]): CardTold {
  refuseBesideImport(steps, IMPORTING)
  const records = cardRecords(books.records)
  const names = new Map<string, string>()
  const notes: CardNote[] = []
  const heldBack: string[] = []
  const movedRules = new Set<string>()
  const pack = installedPack().workbook
  const cardOn = (workbook: Workbook): CompanyCard => ({
    books,
    workbook,
    unit: records.unit,
    records: records.records,
    idOf: (value) => names.get(String(value)) ?? String(value),
    made: (as, id) => {
      if (as !== null) names.set(as, id)
    },
    note: (note) => notes.push(note),
    holdBack: (text) => heldBack.push(text),
    movesRule: (id) => movedRules.add(id.toLowerCase()),
  })
  steps.forEach((step, at) => {
    const set = sets.find((candidate) => candidate.operations.some((operation) => operation.name === step.operation))
    if (set === undefined) throw new StepRefused('There is no such operation.')
    set.planStep(cardOn(at === 0 ? books.workbook : readWorkbook(books.workbook, records.records(), pack)), step)
  })
  const card = cardOn(readWorkbook(books.workbook, records.records(), pack))
  sets.forEach((set) => set.finish?.(card))
  records.writeInto(unit)
  return { notes, heldBack, movedRules }
}

/** What a planned card shows beside its write, and what the model hears it holds back. */
interface CardTold {
  readonly notes: readonly CardNote[]
  readonly heldBack: readonly string[]
  /** The rules a step moves, by their names before the card in lower case. */
  readonly movedRules: ReadonlySet<string>
}

/** How the chat's steps become one write of the company's books. The card's notes come from its own plan, so each check gets its own. */
function companyWork(sets: readonly CompanyOperationSet[], pack: PackOperations | null): ProposalWork<CompanyBooks, never> {
  let told: CardTold = { notes: [], heldBack: [], movedRules: new Set() }
  return {
    notOpen: 'The company books are not open on this device.',
    plan: (unit, books, steps) => {
      told = planned(unit, books, sets, steps)
    },
    groups: (checked, { workbook }) => proposalGroupsOf(checked, workbook, told.notes, pack, told.movedRules),
    heldBack: () => (told.heldBack.length === 0 ? null : told.heldBack.join(' ')),
  }
}

/** Every change the chat can propose in Company. A setting that is not listed under set-setting cannot be proposed, whatever a model asks. */
export function companyOperations(ports: CompanyOperationPorts): readonly AssistantOperation[] {
  return [...operationSets(ports).flatMap((set) => set.operations), SET_UP_ANSWER, SWITCH_MAIL_DRAFTS]
}

/** The changes the chat can propose in Company and their dry run, over the company's store, which `app.ts` hands in with the ports. An attached file is read before the dry run. */
export function companyProposer(store: CompanyStore, ports: CompanyOperationPorts, file: BrowserFile): AppProposer {
  const sets = operationSets(ports)
  return withBrowserFileCards(
    {
      operations: companyOperations(ports),
      readsBooks: true,
      async check(title, steps) {
        if (steps.some((step) => step.operation === SET_UP_ANSWER.name)) return setUpAnswerCheck(title, steps, ports.setUpAnswers)
        if (steps.some((step) => step.operation === SWITCH_MAIL_DRAFTS.name)) return mailDraftsCheck(title, steps, ports.mailDrafts)
        const read = await withStatementFilesRead(steps, ports.readStatementFile)
        if ('refused' in read) return read
        const checked = await proposedWrites(store, companyWork(sets, ports.pack)).check(title, read)
        return 'refused' in checked || checked.undoable || steps.length === 1
          ? checked
          : { refused: ['A change with no Undo goes alone on a card, so propose it first and the rest once it is answered.'] }
      },
    },
    file,
  )
}

/** Writes a proposal as it was checked, in one write with one Undo. A record changed since refuses this proposal alone, and the file's other writes go on. */
export function companyAcceptance(store: CompanyStore, ports: CompanyOperationPorts, file: BrowserFile): AppAcceptance {
  const accept = proposedWrites(store, companyWork(operationSets(ports), ports.pack)).accept
  return acceptingBrowserFileCards({ accept: async (proposal) => setUpAnswerAccept(proposal, ports.setUpAnswers) ?? mailDraftsAccept(proposal, ports.mailDrafts) ?? accept(proposal) }, file)
}
