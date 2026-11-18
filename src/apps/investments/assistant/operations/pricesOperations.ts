import { holdingsWithFactProblems } from '../../holdings/domain/factProblems'
import { words as holdingsWords } from '../../holdings/presentation/words'
import { INVESTMENTS_PRICES_ROUTE } from '../../overview/presentation/investmentLinks'
import type { PricesFetchRun, PricesUpdate } from '../../prices/application/pricesUpdate'
import type { QuotesOff } from '../../prices/application/quoteFetch'
import { fetchedFactsBook } from '../../prices/domain/factsBook'
import type { PricesFile } from '../../prices/domain/pricesFile'
import { runProblem } from '../../prices/presentation/runProblem'
import { words as pricesWords } from '../../prices/presentation/words'
import { words as settingsWords } from '../../settings/presentation/words'
import type { Instrument } from '../../workbook/domain/instrument'
import { INSTRUMENT_RECORDS } from '../../workbook/domain/investmentKinds'
import { words } from '../words'
import { words as appWords } from '../../../../shared/app/words'
import { fileNotOpen } from '../../../../shared/app/assistantOperations'
import type { AcceptResult, AssistantOperation, CheckedProposal, ProposalLine } from '../../../../shared/app/assistantOperations'
import { TEXT, inputOf } from '../../../../shared/app/operationInput'
import type { RecordNoun } from '../../../../shared/storage/domain/recordKind'
import { plural } from '../../../../shared/text/translation'
import type { SideCards } from './investmentSteps'

/** What the prices cards reach, which `app.ts` hands in: the page's one prices update, this browser's copy of the prices file and the clock. */
export interface PricesPorts {
  readonly prices: Pick<PricesUpdate, 'fetchNow' | 'askFactsAgain' | 'fetchQuotes' | 'quotesOff'>
  pricesFile(): PricesFile | null
  /** ISO timestamp, since which vendors Fetch today asks depends on the hour. */
  now(): string
}

/** The prices file beside the books, as a card counts what it changes there. */
const PRICES_NOUN: RecordNoun = {
  en: { one: 'change to the prices file', many: 'changes to the prices file', article: 'a' },
  hr: { one: 'promjena datoteke cijena', of: 'promjene datoteke cijena', few: 'promjene datoteke cijena', other: 'promjena datoteke cijena', gender: 'feminine' },
}

/** Today's quotes, which the page keeps and no file does, as a card counts them. */
const QUOTES_NOUN: RecordNoun = {
  en: { one: "today's price", many: "today's prices", article: 'a' },
  hr: { one: 'današnja cijena', of: 'današnje cijene', few: 'današnje cijene', other: 'današnjih cijena', gender: 'feminine' },
}

const FETCH_PRICES = 'fetch-prices'
const FETCH_TODAY = 'fetch-today'

export const PRICES_OPERATIONS: readonly AssistantOperation[] = [
  {
    name: FETCH_PRICES,
    about:
      "Fetches the day's closes and ECB rates now, as Fetch now on Settings, Prices does, with the vendor keys of this browser. It writes the prices file and not the books, so it has no Undo. A CSV of a holding's daily closes is imported on Settings, Prices, so for one link that screen.",
    input: inputOf({}),
    refs: {},
    creates: null,
    alone: true,
    example: {},
  },
  {
    name: FETCH_TODAY,
    about:
      "Asks the vendors for today's prices of the holdings held, as Fetch today on the Overview does, so the portfolio report counts them. The page keeps them for today and no file does, so it has no Undo.",
    input: inputOf({}),
    refs: {},
    creates: null,
    alone: true,
    example: {},
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
type HeldRun = { readonly pricesRun: 'fetch' | 'quotes' } | { readonly pricesRun: 'facts'; readonly instrument: Instrument }

function isHeldRun(held: object): held is HeldRun {
  return 'pricesRun' in held
}

type Checked = CheckedProposal | { readonly refused: readonly string[] }

function cardOf(title: string, line: ProposalLine, outside: string, held: HeldRun): Checked {
  const noun = held.pricesRun === 'quotes' ? QUOTES_NOUN : PRICES_NOUN
  return { title, count: 1, groups: [{ verb: 'change', noun, notes: [], lines: [line] }], outside: [outside], undoable: false, heldBack: null, held }
}

/** Why Fetch today would ask nothing now, in the model's words, naming Settings, Prices where a key is missing. */
function quotesOffReason(off: QuotesOff): string {
  switch (off.kind) {
    case 'nothing-quoted':
      return 'No holding held has a vendor that quotes it during the day with a free key, so Fetch today would ask nothing.'
    case 'no-key':
      return `Today's prices need a price vendor's key, which the person adds on ${settingsWords.title}, ${settingsWords.tabs.prices}.`
    case 'before-close':
      return `The European closes come after ${off.fromHour}:00 in Zagreb, and nothing else is left to ask before then.`
    case 'all-in':
      return "Today's prices are all in. The rest come with tomorrow's fetch."
  }
}

/** What the card says of a run that wrote nothing, as the Prices tab's toast says it. */
function notRun(run: PricesFetchRun | 'running' | 'no-books', appName: string): AcceptResult {
  if (run === 'running') return { kind: 'refused', reason: `${pricesWords.run.running}. ${pricesWords.run.runningNote}` }
  if (run === 'no-books') return { kind: 'refused', reason: appWords.fileNotOpen(appName) }
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

/** Fetch now, Fetch today and Ask again, each a card with no Undo, since none writes the books. */
export function pricesCards(appName: string, ports: PricesPorts): SideCards {
  return {
    operations: PRICES_OPERATIONS,
    check(title, step, book) {
      if (book === null) return Promise.resolve({ refused: fileNotOpen(appName) })
      if (step.operation === FETCH_PRICES) {
        return Promise.resolve(cardOf(title, { label: words.cards.everyHolding, fields: [], warning: null }, words.cards.vendorsOutside, { pricesRun: 'fetch' }))
      }
      if (step.operation === FETCH_TODAY) {
        const off = ports.prices.quotesOff(book, ports.now())
        if (off !== null) return Promise.resolve({ refused: [quotesOffReason(off)] })
        return Promise.resolve(cardOf(title, { label: words.cards.todaysQuotes, fields: [], warning: null }, words.cards.quotesOutside, { pricesRun: 'quotes' }))
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
            if (run === 'running' || run === 'no-books') return notRun(run, appName)
            if (run.kind === 'written') return fetched(run.file)
            return run.kind === 'current' || run.kind === 'busy' ? DONE : notRun(run, appName)
          }
          case 'quotes': {
            const quoted = await ports.prices.fetchQuotes()
            if (quoted === 'running') return { kind: 'refused', reason: pricesWords.run.running }
            if (quoted === 'no-books') return notRun(quoted, appName)
            return quoted.failed === 0 ? DONE : { kind: 'done', undo: null, warning: { text: plural(pricesWords.today.failed(quoted.failed), quoted.failed), link: null } }
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
