import { NO_ANSWERS, proposedCostShare, workbookDryRun } from '../domain/importDryRun'
import type { AccountQuestion, InstrumentQuestion, SpinOffAnswer, SpinOffQuestion, SplitQuestion, SplitRatio, WorkbookAnswers, WorkbookDryRun, WorkbookRows } from '../domain/importDryRun'
import { words } from './words'
import { instrumentErrors, instrumentOfTexts, instrumentTexts } from '../../holdings/presentation/instrumentForm'
import type { InstrumentErrors, InstrumentTexts } from '../../holdings/presentation/instrumentForm'
import type { ReportedSplit } from '../../prices/application/priceVendor'
import type { SplitsLookedUp } from '../../prices/application/splitLookup'
import type { RateBook } from '../../prices/domain/rateBook'
import type { Instrument } from '../../workbook/domain/instrument'
import type { InvestmentAccount } from '../../workbook/domain/investmentAccount'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import { INSTRUMENT_RECORDS, INVESTMENT_ACCOUNT_RECORDS } from '../../workbook/domain/investmentKinds'
import { daysBetween, parseCivilDate } from '../../../../shared/calendar/civilDate'
import { DECIMAL_ZERO, decimalOfText, decimalShown, roundedDecimal, scaledDecimal, timesDecimal, typedDecimal } from '../../../../shared/money/decimal'
import type { Decimal } from '../../../../shared/money/decimal'
import { recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { fold } from '../../../../shared/text/fold'

export type AccountChoice = { readonly kind: 'new'; readonly name: string } | { readonly kind: 'existing'; readonly account: RecordId }

export type InstrumentChoice = { readonly kind: 'new'; readonly texts: InstrumentTexts } | { readonly kind: 'existing'; readonly instrument: RecordId }

export interface SplitTexts {
  readonly newUnits: string
  readonly oldUnits: string
}

export interface SpinOffTexts {
  readonly parent: RecordId | null
  /** In percent as typed, or null to take the share proposed. */
  readonly costShare: string | null
}

/** What the person changed on the steps, each by its question. Every question not here takes its default. */
export interface ImportChoices {
  /** By the workbook's Account text. */
  readonly accounts: Readonly<Record<string, AccountChoice>>
  /** By the instrument's identity in the workbook. */
  readonly instruments: Readonly<Record<string, InstrumentChoice>>
  /** By the key of the split's entry. */
  readonly splits: Readonly<Record<string, SplitTexts>>
  readonly spinOffs: Readonly<Record<string, SpinOffTexts>>
}

export const NO_CHOICES: ImportChoices = { accounts: {}, instruments: {}, splits: {}, spinOffs: {} }

/** A new random id for each key, the same one every time it is asked for that key. */
export type NewIds = (key: string) => string

export interface AccountStep {
  readonly question: AccountQuestion
  readonly choice: AccountChoice
  readonly problem: string | null
}

export interface InstrumentStep {
  readonly question: InstrumentQuestion
  readonly choice: InstrumentChoice
  /** What a new holding's fields lack, null for one Kuna has. */
  readonly errors: InstrumentErrors | null
}

/** What the lookup has of a symbol's splits: nothing asked without a key, nothing yet while it asks, or the vendor's answer. */
export type SplitsAnswer = { readonly kind: 'no-key' } | { readonly kind: 'pending' } | SplitsLookedUp

export type SplitsOf = (symbol: string) => SplitsAnswer

/** No lookup, as in a browser without the vendor's key. */
export const NO_SPLIT_LOOKUP: SplitsOf = () => ({ kind: 'no-key' })

/** Why no listed split answers a split's question. */
export type UnlistedSplit = 'no-key' | 'pending' | 'failed' | 'none-near' | 'priced-by-hand'

export interface SplitStep {
  readonly question: SplitQuestion
  /** The symbol its splits are looked up under, null while its holding has no answer or is priced by hand. */
  readonly symbol: string | null
  /** The split the vendor lists near the row's day, which answers the question so it is not asked. */
  readonly listed: ReportedSplit | null
  readonly unlisted: UnlistedSplit | null
  readonly texts: SplitTexts
  readonly problem: string | null
}

export interface SpinOffStep {
  readonly question: SpinOffQuestion
  /** The holding received, once its question has an answer. */
  readonly received: RecordId | null
  readonly parent: RecordId | null
  readonly costShare: string
  /** The fraction of the parent's cost proposed for the parent picked. */
  readonly proposed: Decimal | null
  readonly problems: { readonly parent: string | null; readonly costShare: string | null }
  /** What the row's own Spin-off from or Cost share cell gave that cannot be used, or null. */
  readonly workbookProblem: string | null
  /** The row's own columns answer it whole, so it is not asked. */
  readonly answeredByRow: boolean
}

/** A split listed this many days either side of the row's day is the row's split, as a workbook may date it by its statement. */
const LISTED_SPLIT_DAYS = 7

/** The dry run with every answer the steps give, and each question with what answers it now. */
export interface SettledImport {
  readonly dryRun: WorkbookDryRun
  readonly accounts: readonly AccountStep[]
  readonly instruments: readonly InstrumentStep[]
  readonly splits: readonly SplitStep[]
  readonly spinOffs: readonly SpinOffStep[]
  /** The instruments a spin-off may come from: Kuna's and the new ones the steps name. */
  readonly parents: readonly Instrument[]
}

/** A split's ratio and a spin-off's cost share are proposed from what is held, which earlier answers change, so the run settles over a few passes. */
const MOST_PASSES = 6

const PERCENT = decimalOfText('100')!
/** The places of a percent a proposed cost share shows in its field. */
const SHOWN_PERCENT_PLACES = 2

/**
 * The dry run of the workbook's rows with the person's choices, and a default for every question they left: an account
 * an earlier import wrote to, else a new one named as proposed, a holding an earlier import wrote to or the one Kuna
 * offers, else a new one from the guess, a split at the ratio its vendor lists, else at its proposed ratio, and a
 * spin-off's parent and share as its row gives them, else the share as proposed for the parent picked. Each pass
 * answers what the previous pass asked, until the answers stop changing.
 */
export function settledImport(reading: WorkbookRows, book: InvestmentBook, rates: RateBook, choices: ImportChoices, newIds: NewIds, splitsOf: SplitsOf = NO_SPLIT_LOOKUP): SettledImport {
  let dryRun = workbookDryRun(reading, { book, rates, answers: NO_ANSWERS })
  let answered = answersOf(dryRun, book, choices, newIds, splitsOf)
  for (let pass = 0; pass < MOST_PASSES; pass += 1) {
    dryRun = workbookDryRun(reading, { book, rates, answers: answered.answers })
    const next = answersOf(dryRun, book, choices, newIds, splitsOf)
    const settled = answersKey(next.answers) === answersKey(answered.answers)
    answered = next
    if (settled) break
  }
  return { dryRun, ...answered.steps }
}

interface Answered {
  readonly answers: WorkbookAnswers
  readonly steps: Omit<SettledImport, 'dryRun'>
}

/** A question's step on screen, and the answer it gives the dry run, null while it gives none. */
interface Answering<Step, Answer> {
  readonly step: Step
  readonly answer: Answer | null
}

function answersOf(dryRun: WorkbookDryRun, book: InvestmentBook, choices: ImportChoices, newIds: NewIds, splitsOf: SplitsOf): Answered {
  const { questions } = dryRun
  const accounts = questions.accounts.map((question) => accountStep(question, book, choices, newIds))
  const instruments = instrumentSteps(questions.instruments, book, choices, newIds)
  const answeredInstruments = instruments.flatMap(({ step, answer }) => (answer === null ? [] : [[step.question.identity, answer] as const]))
  const parents = [...book.instruments, ...answeredInstruments.map(([, instrument]) => instrument).filter((instrument) => !book.instruments.some((held) => held.id === instrument.id))]
  const instrumentOf = new Map(answeredInstruments)
  const splits = questions.splits.map((question) => splitStep(question, instrumentOf.get(question.identity) ?? null, choices, splitsOf))
  const receivedOf = new Map(answeredInstruments.map(([identity, instrument]) => [identity, instrument.id]))
  const spinOffs = questions.spinOffs.map((question) => spinOffStep(question, receivedOf.get(question.identity) ?? null, dryRun, parents, choices))

  const answered = <Step extends { readonly question: unknown }, Answer>(all: readonly Answering<Step, Answer>[], keyOf: (question: Step['question']) => string): Map<string, Answer> =>
    new Map(all.flatMap(({ step, answer }) => (answer === null ? [] : [[keyOf(step.question), answer] as const])))
  const steps = <Step, Answer>(all: readonly Answering<Step, Answer>[]): Step[] => all.map(({ step }) => step)
  return {
    answers: {
      accounts: answered(accounts, (question) => question.account),
      instruments: new Map(answeredInstruments),
      splits: answered(splits, (question) => question.key),
      spinOffs: answered(spinOffs, (question) => question.key),
    },
    steps: { accounts: steps(accounts), instruments: steps(instruments), splits: steps(splits), spinOffs: steps(spinOffs), parents },
  }
}

function accountStep(question: AccountQuestion, book: InvestmentBook, choices: ImportChoices, newIds: NewIds): Answering<AccountStep, InvestmentAccount> {
  const chosen = choices.accounts[question.account]
  const existing = (id: RecordId | null | undefined): InvestmentAccount | undefined => book.accounts.find((account) => account.id === id)
  const choice: AccountChoice =
    chosen?.kind === 'new' || (chosen?.kind === 'existing' && existing(chosen.account) !== undefined)
      ? chosen
      : existing(question.known) !== undefined
        ? { kind: 'existing', account: question.known! }
        : { kind: 'new', name: question.proposedName }
  if (choice.kind === 'existing') {
    return { step: { question, choice, problem: null }, answer: existing(choice.account)! }
  }
  const name = choice.name.trim()
  return {
    step: { question, choice, problem: name === '' ? words.accounts.nameMissing : null },
    answer: name === '' ? null : { id: recordIdOf(INVESTMENT_ACCOUNT_RECORDS, newIds(`account:${question.account}`)), name, note: '' },
  }
}

/** Each holding as chosen, a new one checked against Kuna's and the other new ones, so two cannot share an ISIN. */
function instrumentSteps(questions: readonly InstrumentQuestion[], book: InvestmentBook, choices: ImportChoices, newIds: NewIds): Answering<InstrumentStep, Instrument>[] {
  const chosen = questions.map((question) => ({ question, choice: instrumentChoiceOf(question, book, choices), id: recordIdOf(INSTRUMENT_RECORDS, newIds(`instrument:${question.identity}`)) }))
  const fresh = chosen.flatMap(({ question, choice, id }) => (choice.kind === 'new' ? (instrumentOfTexts(choice.texts, book.instruments, id, question.proposal.quoted) ?? []) : []))
  return chosen.map(({ question, choice, id }) => {
    if (choice.kind === 'existing') {
      return { step: { question, choice, errors: null }, answer: book.instruments.find((instrument) => instrument.id === choice.instrument) ?? null }
    }
    const others = [...book.instruments, ...fresh.filter((other) => other.id !== id)]
    return { step: { question, choice, errors: instrumentErrors(choice.texts, others) }, answer: instrumentOfTexts(choice.texts, others, id, question.proposal.quoted) }
  })
}

function instrumentChoiceOf(question: InstrumentQuestion, book: InvestmentBook, choices: ImportChoices): InstrumentChoice {
  const chosen = choices.instruments[question.identity]
  const held = (id: RecordId | null | undefined): boolean => book.instruments.some((instrument) => instrument.id === id)
  if (chosen !== undefined && (chosen.kind === 'new' || held(chosen.instrument))) return chosen
  if (held(question.known)) return { kind: 'existing', instrument: question.known! }
  if (question.offer !== null) return { kind: 'existing', instrument: question.offer.id }
  return { kind: 'new', texts: instrumentTexts(question.proposal) }
}

const WHOLE = /^\d+$/

/** A ratio the person typed wins, then the split the vendor lists near the row's day, then the proposal from what was held. */
function splitStep(question: SplitQuestion, instrument: Instrument | null, choices: ImportChoices, splitsOf: SplitsOf): Answering<SplitStep, SplitRatio> {
  const symbol = instrument === null || instrument.prices === 'manual' || instrument.sourceSymbol === '' ? null : instrument.sourceSymbol
  const lookedUp: SplitsAnswer | null = symbol === null ? null : splitsOf(symbol)
  const listed =
    lookedUp?.kind === 'splits'
      ? (lookedUp.splits.find((split) => {
          const day = parseCivilDate(split.date)
          return day !== null && Math.abs(daysBetween(question.date, day)) <= LISTED_SPLIT_DAYS
        }) ?? null)
      : null
  const unlisted: UnlistedSplit | null =
    listed !== null ? null : lookedUp === null ? (instrument === null ? null : 'priced-by-hand') : lookedUp.kind === 'splits' ? 'none-near' : lookedUp.kind === 'failed' ? 'failed' : lookedUp.kind
  const proposal = question.proposal
  const texts =
    choices.splits[question.key] ??
    (listed !== null
      ? { newUnits: listed.newUnits, oldUnits: listed.oldUnits }
      : proposal === null
        ? { newUnits: '', oldUnits: '' }
        : { newUnits: String(proposal.newUnits), oldUnits: String(proposal.oldUnits) })
  const [newUnits, oldUnits] = [texts.newUnits.trim(), texts.oldUnits.trim()]
  const ratio = WHOLE.test(newUnits) && WHOLE.test(oldUnits) && Number(newUnits) > 0 && Number(oldUnits) > 0 ? { newUnits: Number(newUnits), oldUnits: Number(oldUnits) } : null
  return { step: { question, symbol, listed, unlisted, texts, problem: ratio === null ? words.questions.ratioProblem : null }, answer: ratio }
}

/**
 * The parent and the share come from the row's Spin-off from and Cost share cells where they can be used, else from
 * the person. The share is typed in percent, as the transaction dialog takes it, and proposed for the parent picked.
 * The field shows the proposal to two places, and the answer keeps it exact until the person types over it.
 */
function spinOffStep(question: SpinOffQuestion, received: RecordId | null, dryRun: WorkbookDryRun, parents: readonly Instrument[], choices: ImportChoices): Answering<SpinOffStep, SpinOffAnswer> {
  const chosen = choices.spinOffs[question.key]
  const named =
    question.from === ''
      ? null
      : (parents.find((instrument) => instrument.id !== received && (instrument.isin === question.from.toUpperCase() || fold(instrument.symbol) === fold(question.from))) ?? null)
  const chosenParent = chosen?.parent !== undefined && chosen.parent !== null && chosen.parent !== received && parents.some((instrument) => instrument.id === chosen.parent) ? chosen.parent : null
  const parent = chosenParent ?? named?.id ?? null
  const proposed = parent === null ? null : proposedCostShare(dryRun.planned, parent, question)
  const typed = chosen?.costShare ?? null
  const fromRow = question.costShare
  const costShare =
    typed ?? (fromRow !== null ? decimalShown(timesDecimal(fromRow, PERCENT)) : decimalShown(proposed === null ? null : roundedDecimal(timesDecimal(proposed, PERCENT), SHOWN_PERCENT_PLACES)))
  const percent = typed === null ? null : typedDecimal(typed)
  const fraction = typed === null ? (fromRow ?? proposed) : percent === null || percent <= DECIMAL_ZERO || percent > PERCENT ? null : scaledDecimal(percent, 1n, 100n)
  const workbookProblem =
    question.from !== '' && named === null
      ? words.questions.parentNotFound(question.from)
      : question.costShareText !== '' && fromRow === null
        ? words.questions.costShareUnreadable(question.costShareText)
        : null
  return {
    step: {
      question,
      received,
      parent,
      costShare,
      proposed,
      problems: { parent: parent === null ? words.questions.parentMissing : null, costShare: fraction === null ? words.questions.costShareProblem : null },
      workbookProblem,
      answeredByRow: named !== null && fromRow !== null,
    },
    answer: parent === null || fraction === null ? null : { parent, costShare: fraction },
  }
}

/** The answers as text that two passes with the same answers give alike. */
function answersKey(answers: WorkbookAnswers): string {
  return JSON.stringify(Object.fromEntries(Object.entries(answers).map(([part, map]) => [part, [...(map as ReadonlyMap<string, unknown>)]])), (_key, value: unknown) =>
    typeof value === 'bigint' ? value.toString() : value,
  )
}
