import type { InvestmentsBooks } from '../../workbook/domain/investmentsBooks'
import { words } from '../words'
import { ACCOUNT_STEPS } from './accountOperations'
import { INSTRUMENT_STEPS } from './instrumentOperations'
import type { CardBooks, InvestmentSteps } from './investmentSteps'
import { proposalGroupsOf } from './proposalLines'
import { TRANSACTION_STEPS } from './transactionOperations'
import type { AppAcceptance, AppProposer, AssistantOperation, CheckedProposal, ProposalStep } from '../../../../shared/app/assistantOperations'
import { StepRefused, proposedWrites } from '../../../../shared/app/proposedWrites'
import type { OpenBooks, ProposalWork } from '../../../../shared/app/proposedWrites'
import type { RateBook } from '../../../../shared/money/rateBook'
import type { WorkbookStore } from '../../../../shared/storage/application/createWorkbookStore'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'

/** What `app.ts` hands in from outside the books: the rates a new record's rate is filled from, and the fetch of a new holding's prices. */
export interface InvestmentsPorts {
  rates(): RateBook | null
  /** Starts the fetch of the series the books just gained, as the holding dialog does after a save. */
  fetchAddedPrices(): void
}

type InvestmentsStore = Pick<WorkbookStore<InvestmentsBooks>, 'state' | 'check' | 'write' | 'undo'>

/** Each part of the operations, which a later part joins by a line here. */
const PARTS: readonly InvestmentSteps[] = [ACCOUNT_STEPS, INSTRUMENT_STEPS, TRANSACTION_STEPS]

/** Every change the chat can propose in Investments. Each calls the write functions and checks the screens use. */
export const INVESTMENTS_OPERATIONS: readonly AssistantOperation[] = PARTS.flatMap((part) => part.operations)

const PART_OF = new Map(PARTS.flatMap((part) => part.operations.map((operation) => [operation.name, part] as const)))

/** The cards whose Accept starts a price fetch, as the holding dialog starts one after saving a priced holding. */
const FETCHING = new WeakSet<CheckedProposal>()

/** Plans the steps into one write, in order, each on the books the steps before it leave. Gives the holdings whose prices Accept fetches. */
function planned(unit: UnitOfWork, books: OpenBooks<InvestmentsBooks>, steps: readonly ProposalStep[], rates: RateBook | null): readonly string[] {
  let book = books.workbook.book
  const made = new Map<string, string>()
  const fetches: string[] = []
  for (const step of steps) {
    const part = PART_OF.get(step.operation)
    if (part === undefined) throw new StepRefused('There is no such operation.')
    const card: CardBooks = { book, rates, idOf: (value) => made.get(String(value)) ?? String(value) }
    const written = part.write(unit, card, step)
    book = written.book
    if (step.as !== null && written.made !== null) made.set(step.as, written.made)
    if (written.fetchesPricesOf !== null) fetches.push(written.fetchesPricesOf)
  }
  return fetches
}

/** How the chat's steps become one write of the Investments file. The card says which holdings' prices Accept fetches, so each check keeps its own. */
function investmentsWork(ports: InvestmentsPorts): ProposalWork<InvestmentsBooks, never> {
  let fetches: readonly string[] = []
  return {
    notOpen: 'The Investments file is not open on this device.',
    plan: (unit, books, steps) => {
      fetches = planned(unit, books, steps, ports.rates())
    },
    groups: (checked, { workbook }) => proposalGroupsOf(checked, workbook.book),
    outside: () => fetches.map(words.proposals.pricesFetched),
  }
}

/** The changes the chat can propose and their dry run, over the app's own store, which `app.ts` hands in. */
export function investmentsProposer(store: InvestmentsStore, ports: InvestmentsPorts): AppProposer {
  return {
    operations: INVESTMENTS_OPERATIONS,
    readsBooks: true,
    async check(title, steps) {
      const checked = await proposedWrites(store, investmentsWork(ports)).check(title, steps)
      if ('held' in checked && checked.outside.length > 0) FETCHING.add(checked)
      return checked
    },
  }
}

/** Writes a proposal as it was checked, in one write with one Undo, then starts the price fetch its card names. */
export function investmentsAcceptance(store: InvestmentsStore, ports: InvestmentsPorts): AppAcceptance {
  const { accept } = proposedWrites(store, investmentsWork(ports))
  return {
    async accept(proposal) {
      const result = await accept(proposal)
      if (result.kind === 'done' && FETCHING.has(proposal)) ports.fetchAddedPrices()
      return result
    },
  }
}
