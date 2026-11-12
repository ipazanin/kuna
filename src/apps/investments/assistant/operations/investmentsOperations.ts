import type { InvestmentsBooks } from '../../workbook/domain/investmentsBooks'
import { acceptingBrowserFileCards, withBrowserFileCards } from '../../../../shared/app/browserFileCards'
import type { BrowserFile } from '../../../../shared/app/browserFileCards'
import { words } from '../words'
import { ACCOUNT_STEPS } from './accountOperations'
import { HOLDING_STEPS } from './holdingOperations'
import { HISTORY_OPERATIONS, historyCards } from './historyOperations'
import type { HistoryAnswer } from './historyOperations'
import { IMPORTING, IMPORT_STEPS, importTooLarge, withRowsRead } from './importOperations'
import { INSTRUMENT_STEPS } from './instrumentOperations'
import type { CardBooks, InvestmentSteps, SideCards } from './investmentSteps'
import { PRICES_OPERATIONS, pricesCards } from './pricesOperations'
import { SETTING_STEPS } from './settingOperations'
import type { PricesPorts } from './pricesOperations'
import { proposalGroupsOf } from './proposalLines'
import { REQUEST_COUNT_OPERATIONS, requestCountCards } from './requestCountOperations'
import type { RequestCounts } from './requestCountOperations'
import { TRANSACTION_STEPS } from './transactionOperations'
import type { WorkbookRows } from '../../imports/domain/importDryRun'
import type { AppAcceptance, AppProposer, AssistantOperation, CardNote, CheckedProposal, ProposalStep } from '../../../../shared/app/assistantOperations'
import { StepRefused, proposedWrites, refuseBesideImport } from '../../../../shared/app/proposedWrites'
import type { OpenBooks, ProposalWork } from '../../../../shared/app/proposedWrites'
import type { RateBook } from '../../../../shared/money/rateBook'
import type { WorkbookStore } from '../../../../shared/storage/application/createWorkbookStore'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import { recordsOf } from '../../../../shared/storage/domain/recordsRead'

/**
 * What `app.ts` hands in from outside the books: the rates a new record's rate is filled from, the prices file and its
 * runs, the report the last sync read from mail, the answer this device keeps that the history is complete, and this browser's requests to each price vendor today.
 */
export interface InvestmentsPorts extends PricesPorts {
  rates(): RateBook | null
  /** Starts the fetch of the series the books just gained, as the holding dialog does after a save. */
  fetchAddedPrices(): void
  /** The rows of IBKR's report the last sync read from Gmail, or null before one did. */
  mailReport(): WorkbookRows | null
  readonly history: HistoryAnswer
  readonly requestCounts: RequestCounts
}

type InvestmentsStore = Pick<WorkbookStore<InvestmentsBooks>, 'state' | 'check' | 'write' | 'undo'>

/** Each part of the operations, which a later part joins by a line here. */
const PARTS: readonly InvestmentSteps[] = [ACCOUNT_STEPS, INSTRUMENT_STEPS, TRANSACTION_STEPS, HOLDING_STEPS, IMPORT_STEPS, SETTING_STEPS]

/** The cards that write nothing to the books, each over the ports that do their work. */
function sideCards(appName: string, ports: InvestmentsPorts): readonly SideCards[] {
  return [historyCards(appName, ports.history), pricesCards(appName, ports), requestCountCards(ports.requestCounts)]
}

/** Every change the chat can propose in Investments. Each calls the write functions and checks the screens use. */
export const INVESTMENTS_OPERATIONS: readonly AssistantOperation[] = [...PARTS.flatMap((part) => part.operations), ...HISTORY_OPERATIONS, ...PRICES_OPERATIONS, ...REQUEST_COUNT_OPERATIONS]

const PART_OF = new Map(PARTS.flatMap((part) => part.operations.map((operation) => [operation.name, part] as const)))

/** The cards whose Accept starts a price fetch, as the holding dialog starts one after saving a priced holding. */
const FETCHING = new WeakSet<CheckedProposal>()

/** What a plan leaves beside the write: the holdings whose prices Accept fetches, the card's notes, and what it holds back, for the model. */
interface Planned {
  readonly fetches: readonly string[]
  readonly notes: readonly CardNote[]
  readonly heldBack: readonly string[]
}

/** Plans the steps into one write, in order, each on the books the steps before it leave. */
function planned(unit: UnitOfWork, books: OpenBooks<InvestmentsBooks>, steps: readonly ProposalStep[], ports: InvestmentsPorts): Planned {
  refuseBesideImport(steps, IMPORTING)
  let book = books.workbook.book
  const storedSettings = recordsOf(books.records.settings)
  const made = new Map<string, string>()
  const fetches: string[] = []
  const notes: CardNote[] = []
  const heldBack: string[] = []
  for (const step of steps) {
    const part = PART_OF.get(step.operation)
    if (part === undefined) throw new StepRefused('There is no such operation.')
    const card: CardBooks = { book, rates: ports.rates(), pricesFile: ports.pricesFile(), storedSettings, idOf: (value) => made.get(String(value)) ?? String(value) }
    const written = part.write(unit, card, step)
    book = written.book
    if (step.as !== null && written.made !== null) made.set(step.as, written.made)
    fetches.push(...written.fetchesPricesOf)
    notes.push(...written.notes)
    heldBack.push(...written.heldBack)
  }
  return { fetches, notes, heldBack }
}

/** How the chat's steps become one write of the Investments file. The card says which holdings' prices Accept fetches and what an import leaves, from its own plan. */
function investmentsWork(appName: string, ports: InvestmentsPorts): ProposalWork<InvestmentsBooks, never, Planned> {
  return {
    appName,
    plan: (unit, books, steps) => planned(unit, books, steps, ports),
    card: (checked, { workbook }, { fetches, notes, heldBack }) => ({
      groups: proposalGroupsOf(checked, workbook.book, notes),
      outside: fetches.length === 0 ? [] : [words.proposals.pricesFetched([...new Set(fetches)])],
      heldBack: heldBack.length === 0 ? null : heldBack.join(' '),
    }),
    overLimit: importTooLarge,
  }
}

/** The changes the chat can propose and their dry run, over the app's own store, which `app.ts` hands in. */
export function investmentsProposer(store: InvestmentsStore, ports: InvestmentsPorts, file: BrowserFile): AppProposer {
  const sides = sideCards(file.appName, ports)
  return withBrowserFileCards(
    {
      operations: INVESTMENTS_OPERATIONS,
      readsBooks: true,
      async check(title, steps) {
        const sideStep = steps.find((step) => !PART_OF.has(step.operation))
        const side = sides.find((cards) => cards.operations.some((operation) => operation.name === sideStep?.operation))
        if (sideStep !== undefined && side !== undefined) {
          if (steps.length !== 1) return { refused: [`${sideStep.operation} goes alone on a card.`] }
          return side.check(title, sideStep, store.state.workbook?.book ?? null)
        }
        const read = await withRowsRead(steps, ports.mailReport)
        if ('refused' in read) return read
        const checked = await proposedWrites(store, investmentsWork(file.appName, ports)).check(title, read)
        if ('held' in checked && checked.outside.length > 0) FETCHING.add(checked)
        return checked
      },
    },
    file,
  )
}

/** Writes a proposal as it was checked, in one write with one Undo, then starts the price fetch its card names. A card beside the books runs its own work. */
export function investmentsAcceptance(store: InvestmentsStore, ports: InvestmentsPorts, file: BrowserFile): AppAcceptance {
  const { accept } = proposedWrites(store, investmentsWork(file.appName, ports))
  const sides = sideCards(file.appName, ports)
  return acceptingBrowserFileCards(
    {
      async accept(proposal) {
        const side = sides.map((cards) => cards.acceptOwn(proposal)).find((accepted) => accepted !== null)
        if (side !== undefined) return side
        const result = await accept(proposal)
        if (result.kind === 'done' && FETCHING.has(proposal)) ports.fetchAddedPrices()
        return result
      },
    },
    file,
  )
}
