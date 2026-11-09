import { holdingsWithFactProblems } from '../../holdings/domain/factProblems'
import { words as holdingsWords } from '../../holdings/presentation/words'
import { INVESTMENTS_PRICES_ROUTE } from '../../overview/presentation/investmentLinks'
import type { PricesFetchRun, PricesUpdate } from '../../prices/application/pricesUpdate'
import { readClosesCsv } from '../../prices/domain/closesCsv'
import type { ClosesCsvRefusal } from '../../prices/domain/closesCsv'
import { closesImportLine, holdingsNamedBy } from '../../prices/domain/closesImport'
import type { ClosesImportLine } from '../../prices/domain/closesImport'
import { fetchedFactsBook } from '../../prices/domain/factsBook'
import { emptyPricesFile } from '../../prices/domain/pricesFile'
import type { PricesFile } from '../../prices/domain/pricesFile'
import { runProblem } from '../../prices/presentation/runProblem'
import { words as pricesWords } from '../../prices/presentation/words'
import { words as settingsWords } from '../../settings/presentation/words'
import type { Instrument } from '../../workbook/domain/instrument'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import { INSTRUMENT_RECORDS } from '../../workbook/domain/investmentKinds'
import { words } from '../words'
import type { ChatAttachment } from '../../../../shared/ai/domain/chatAttachments'
import { ATTACHMENT_REF } from '../../../../shared/app/assistantOperations'
import type { AcceptResult, AssistantOperation, CheckedProposal, ProposalLine, ProposalStep } from '../../../../shared/app/assistantOperations'
import { NOT_READ_OFF_A_PAGE, TEXT, TEXT_OR_NULL, inputOf } from '../../../../shared/app/operationInput'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import type { RecordNoun } from '../../../../shared/storage/domain/recordKind'
import { plural } from '../../../../shared/text/translation'
import type { SideCards } from './investmentSteps'

/** What the prices cards reach, which `app.ts` hands in: the page's one prices update, this browser's copy of the prices file, and the fetch of the series an import adds. */
export interface PricesPorts {
  readonly prices: Pick<PricesUpdate, 'fetchNow' | 'importCloses' | 'askFactsAgain'>
  pricesFile(): PricesFile | null
  fetchAddedPrices(): void
}

/** The prices file beside the books, as a card counts what it changes there. */
const PRICES_NOUN: RecordNoun = {
  en: { one: 'change to the prices file', many: 'changes to the prices file', article: 'a' },
  hr: { one: 'promjena datoteke cijena', of: 'promjene datoteke cijena', few: 'promjene datoteke cijena', other: 'promjena datoteke cijena', gender: 'feminine' },
}

const FETCH_PRICES = 'fetch-prices'
const IMPORT_CLOSES = 'import-closes'

export const PRICES_OPERATIONS: readonly AssistantOperation[] = [
  {
    name: FETCH_PRICES,
    about: "Fetches the day's closes and ECB rates now, as Fetch now on Settings, Prices does, with the vendor keys of this browser. It writes the prices file and not the books, so it has no Undo.",
    input: inputOf({}),
    refs: {},
    creates: null,
    alone: true,
    example: {},
  },
  {
    name: IMPORT_CLOSES,
    about:
      "Writes the daily closes of an attached CSV with Date and Close columns, such as Yahoo's history download, into a holding's series, as Settings, Prices does. Kuna reads the file itself, so file names its id. instrument names the holding by ref, or null to take the one whose symbol the file is named after. It writes the prices file and not the books, so it has no Undo.",
    input: inputOf({ file: TEXT, instrument: TEXT_OR_NULL }),
    refs: { file: ATTACHMENT_REF, instrument: INSTRUMENT_RECORDS.name },
    creates: null,
    alone: true,
    example: { file: 'a2', instrument: 'instrument' },
  },
  {
    name: 'ask-facts-again',
    about:
      "Asks the price vendors again for a held instrument's company or fund profile, as Ask again on its page does, when its page warns that a fact is missing. It writes the prices file and not the books, so it has no Undo.",
    input: inputOf({ instrument: TEXT }),
    refs: { instrument: INSTRUMENT_RECORDS.name },
    creates: null,
    alone: true,
    example: { instrument: 'instrument' },
  },
]

/** What Accept of a prices card runs, which only this file reads. */
type HeldRun = { readonly pricesRun: 'fetch' } | { readonly pricesRun: 'closes'; readonly line: ClosesImportLine } | { readonly pricesRun: 'facts'; readonly instrument: Instrument }

function isHeldRun(held: object): held is HeldRun {
  return 'pricesRun' in held
}

function isAttachment(file: unknown): file is ChatAttachment {
  return typeof file === 'object' && file !== null && 'kind' in file && 'bytes' in file && 'name' in file
}

function refusalText(reason: ClosesCsvRefusal): string {
  const refused = pricesWords.closesImport.refused
  return reason.kind === 'unreadable' ? refused.unreadable(reason.line) : reason.kind === 'repeated-day' ? refused['repeated-day'](reason.day) : refused[reason.kind]
}

type Checked = CheckedProposal | { readonly refused: readonly string[] }

function cardOf(title: string, line: ProposalLine, outside: string, held: HeldRun): Checked {
  return { title, count: 1, groups: [{ verb: 'change', noun: PRICES_NOUN, notes: [], lines: [line] }], outside: [outside], undoable: false, heldBack: null, held }
}

/** The holdings a file of closes may be for, as the Prices tab offers them: each priced by a vendor, held or sold. */
function vendorPriced(book: InvestmentBook): Instrument[] {
  return book.instruments.filter((instrument) => instrument.prices !== 'manual' && instrument.sourceSymbol !== '')
}

/** The dry run of an attached file of closes against the holding's series, as the Prices tab shows it, or why not. */
function closesLine(step: ProposalStep, book: InvestmentBook, file: PricesFile): ClosesImportLine | string {
  const attached = step.input['file']
  if (!isAttachment(attached)) return 'file is not a file attached to this chat.'
  if (attached.kind === 'photo' || attached.kind === 'pdf') return NOT_READ_OFF_A_PAGE
  if (attached.kind !== 'csv') return 'Closes are imported from a CSV with Date and Close columns.'
  const reading = readClosesCsv(new TextDecoder().decode(attached.bytes))
  if (reading.kind === 'refused') return refusalText(reading.refusal)
  const holdings = vendorPriced(book)
  const named = step.input['instrument']
  if (named !== null) {
    const chosen = holdings.find((instrument) => instrument.id === named)
    return chosen === undefined ? 'That holding is priced by hand, so it has no series to fill.' : closesImportLine(file, book, chosen, reading.closes)
  }
  const matches = holdingsNamedBy(attached.name, holdings)
  if (matches.length !== 1) return `${matches.length === 0 ? pricesWords.closesImport.noMatch : pricesWords.closesImport.twoMatch} Name it by ref in instrument.`
  return closesImportLine(file, book, matches[0]!, reading.closes)
}

/** What the card says of a run that wrote nothing, as the Prices tab's toast says it. */
function notRun(run: PricesFetchRun | 'running' | 'no-books'): AcceptResult {
  if (run === 'running') return { kind: 'refused', reason: `${pricesWords.run.running}. ${pricesWords.run.runningNote}` }
  if (run === 'no-books') return { kind: 'refused', reason: 'The Investments file is not open on this device.' }
  return { kind: 'refused', reason: runProblem(run) ?? pricesWords.run.failed }
}

const DONE: AcceptResult = { kind: 'done', undo: null }

/** A fetch that wrote the prices file, warning of the series it got nothing for, as the Prices tab's toast does. */
function fetched(file: PricesFile): AcceptResult {
  const missed = file.failures.length
  if (missed === 0) return DONE
  const link = { label: `${settingsWords.title}, ${settingsWords.tabs.prices}`, to: INVESTMENTS_PRICES_ROUTE }
  return { kind: 'done', undo: null, warning: { text: `${plural(pricesWords.failures.title(missed), missed)}. ${words.cards.failuresListed}`, link } }
}

/** Fetch now, the import of closes and Ask again, each a card with no Undo, since each writes the prices file beside the books. */
export function pricesCards(ports: PricesPorts): SideCards {
  return {
    operations: PRICES_OPERATIONS,
    check(title, step, book) {
      if (book === null) return Promise.resolve({ refused: ['The Investments file is not open on this device.'] })
      if (step.operation === FETCH_PRICES) {
        return Promise.resolve(cardOf(title, { label: words.cards.everyHolding, fields: [], warning: null }, words.cards.vendorsOutside, { pricesRun: 'fetch' }))
      }
      if (step.operation === IMPORT_CLOSES) {
        const line = closesLine(step, book, ports.pricesFile() ?? emptyPricesFile())
        if (typeof line === 'string') return Promise.resolve({ refused: [line] })
        const adds = pricesWords.closesImport.adds(line.added, dayLabel(line.first), dayLabel(line.last), line.replaced)
        const shown: ProposalLine = {
          label: line.instrument.name,
          fields: [{ name: words.cards.closes, before: null, after: adds, warns: false }],
          warning: line.gapFrom === null ? null : pricesWords.closesImport.gap(dayLabel(line.gapFrom), dayLabel(line.first)),
        }
        return Promise.resolve(cardOf(title, shown, words.cards.closesOutside, { pricesRun: 'closes', line }))
      }
      const instrument = book.instruments.find((candidate) => candidate.id === step.input['instrument'])
      if (instrument === undefined) return Promise.resolve({ refused: ['That instrument is no longer in the file.'] })
      const file = ports.pricesFile()
      const warned = file !== null && holdingsWithFactProblems(book, fetchedFactsBook(file.facts)).some((problem) => problem.instrument.id === instrument.id)
      if (!warned) return Promise.resolve({ refused: ['Its page warns of no missing fact, so there is nothing to ask again.'] })
      return Promise.resolve(cardOf(title, { label: instrument.name, fields: [], warning: null }, words.cards.vendorsOutside, { pricesRun: 'facts', instrument }))
    },
    acceptOwn(proposal) {
      const { held } = proposal
      if (!isHeldRun(held)) return null
      return (async (): Promise<AcceptResult> => {
        switch (held.pricesRun) {
          case 'fetch': {
            const run = await ports.prices.fetchNow()
            if (run === 'running' || run === 'no-books') return notRun(run)
            if (run.kind === 'written') return fetched(run.file)
            return run.kind === 'current' || run.kind === 'busy' ? DONE : notRun(run)
          }
          case 'closes': {
            const run = await ports.prices.importCloses([held.line])
            if (run === 'no-books' || run.kind !== 'written') return notRun(run)
            ports.fetchAddedPrices()
            return DONE
          }
          case 'facts': {
            const run = await ports.prices.askFactsAgain(held.instrument.id)
            return run !== 'no-books' && run.kind === 'written' ? DONE : { kind: 'refused', reason: holdingsWords.details.problems.notAsked }
          }
        }
      })()
    },
  }
}
