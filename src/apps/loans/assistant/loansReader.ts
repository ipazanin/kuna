import { bankLoanFigures } from '../bankLoans/domain/bankLoanFigures'
import { instalmentStandings } from '../bankLoans/domain/instalmentPayments'
import type { StatementPayments } from '../bankLoans/domain/instalmentPayments'
import { fractionOf, rateText } from '../bankLoans/domain/yearlyRate'
import type { YearlyRate } from '../bankLoans/domain/yearlyRate'
import { planStanding } from '../informalLoans/domain/expectedPlan'
import { informalLoanFigures } from '../informalLoans/domain/informalLoanFigures'
import { BANK_LOAN_ROUTE, INFORMAL_LOAN_ROUTE } from '../overview/presentation/loanLinks'
import { owedOnDay } from '../overview/domain/owedTotals'
import { changeDate } from '../scenarios/domain/loanScenario'
import type { LoanScenario, OfferTerms, ScenarioChange } from '../scenarios/domain/loanScenario'
import { workedOffers } from '../scenarios/domain/workedScenario'
import type { BankLoan } from '../workbook/domain/bankLoan'
import type { ExtraPayment } from '../workbook/domain/extraPayment'
import type { InformalLoan } from '../workbook/domain/informalLoan'
import {
  BANK_LOAN_RECORDS,
  EXTRA_PAYMENT_RECORDS,
  INFORMAL_LOAN_RECORDS,
  LATE_INSTALMENT_RECORDS,
  LOAN_SCENARIO_RECORDS,
  MOVEMENT_RECORDS,
  RATE_PERIOD_RECORDS,
  SCENARIO_CHANGE_RECORDS,
} from '../workbook/domain/loanKinds'
import type { LateInstalment } from '../workbook/domain/lateInstalment'
import type { Movement } from '../workbook/domain/movement'
import type { RatePeriod } from '../workbook/domain/ratePeriod'
import type { LoanBook } from '../workbook/domain/readLoanBook'
import { readableKind } from '../../../shared/app/assistantReader'
import type { AppReader, ReportFigure } from '../../../shared/app/assistantReader'
import { distinctNames } from '../../../shared/app/distinctNames'
import { parseCivilDate, today } from '../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../shared/calendar/civilDate'
import { EURO } from '../../../shared/money/currencyCode'
import { plainAmount } from '../../../shared/money/money'
import type { Money } from '../../../shared/money/money'
import { nearestBasisPoints, pointsOfShare } from '../../../shared/money/percent'
import type { FieldDocs } from '../../../shared/privacy/domain/exposure'
import type { RecordId } from '../../../shared/storage/domain/recordId'
import { words } from './words'

/** What the reader reads from, which `app.ts` hands in over the app's own store, so this folder holds no store. */
export interface LoansReading {
  status(): ReturnType<AppReader['status']>
  book(): LoanBook | null
  /** The rows of your statements linked to bank loan instalments. */
  statementPayments(): StatementPayments
}

/** A scenario as the chat reads it: the bank loan a try starts from, or an offer's terms as lines. */
interface ScenarioRead {
  readonly id: RecordId
  readonly name: string
  readonly loan: RecordId | null
  readonly offer: readonly string[]
}

/** A scenario's change as the chat reads it: its kind, the day it takes effect, and the rest of its terms as lines. */
interface ScenarioChangeRead {
  readonly id: RecordId
  readonly scenario: RecordId
  readonly kind: ScenarioChange['kind']
  readonly on: CivilDate
  readonly terms: readonly string[]
}

const euros = (amount: Money): string => `${plainAmount(amount)} EUR`
const percent = (rate: YearlyRate): string => `${rateText(rate)}%`

const BANK_LOAN_FIELDS: FieldDocs<BankLoan> = {
  id: { exposure: 'ref', to: BANK_LOAN_RECORDS.name, meaning: 'The bank loan.' },
  name: { exposure: 'free-text', meaning: 'The name the owner gave it.' },
  lender: { exposure: 'party', meaning: 'The bank.' },
  principal: { exposure: 'plain', amount: 'app', sign: 'zero-or-more', meaning: 'The amount borrowed, as the contract gives it.' },
  drawdown: { exposure: 'plain', meaning: 'The day it was paid out.' },
  firstInstalment: { exposure: 'plain', meaning: 'The due date of the first instalment. Every later one falls on its day of the month.' },
  instalments: { exposure: 'plain', meaning: 'How many monthly instalments in all.' },
  interimInterest: {
    exposure: 'plain',
    meaning: 'Interest the bank charged from the payout to the start of repayment, and the day it was charged, or empty.',
    read: ({ interimInterest }) => (interimInterest === null ? null : `${euros(interimInterest.amount)} on ${interimInterest.date}`),
  },
  subsidy: {
    exposure: 'plain',
    meaning: 'What a third party such as APN pays of each instalment it covers, or empty.',
    read: ({ subsidy }) =>
      subsidy === null
        ? null
        : `${euros(subsidy.monthly)} a month, instalments ${subsidy.firstInstalment} to ${subsidy.firstInstalment + subsidy.instalments - 1}${subsidy.payer === '' ? '' : `, paid by ${subsidy.payer}`}`,
  },
  repayment: { exposure: 'plain', meaning: 'annuity, the same instalment every month, or equal-principal, the same share of principal with the interest on top.' },
  note: { exposure: 'free-text', meaning: "The owner's note." },
}

const RATE_PERIOD_FIELDS: FieldDocs<RatePeriod> = {
  id: { exposure: 'ref', to: RATE_PERIOD_RECORDS.name, meaning: 'The rate period.' },
  loan: { exposure: 'ref', to: BANK_LOAN_RECORDS.name, meaning: 'The bank loan.' },
  from: { exposure: 'plain', meaning: 'The due date of the first instalment at this rate, until the next period starts.' },
  rate: { exposure: 'plain', meaning: 'The yearly rate, in percent.', read: (period) => percent(period.rate) },
  rateType: { exposure: 'plain', meaning: 'fixed or variable.' },
  note: { exposure: 'free-text', meaning: "The owner's note, such as a variable rate's index and margin." },
}

const EXTRA_PAYMENT_FIELDS: FieldDocs<ExtraPayment> = {
  id: { exposure: 'ref', to: EXTRA_PAYMENT_RECORDS.name, meaning: 'The extra payment.' },
  loan: { exposure: 'ref', to: BANK_LOAN_RECORDS.name, meaning: 'The bank loan.' },
  date: { exposure: 'plain', meaning: 'The day it was paid.' },
  amount: { exposure: 'plain', amount: 'app', sign: 'zero-or-more', meaning: 'The principal paid back early.' },
  effect: { exposure: 'plain', meaning: 'shorter-term keeps the instalment and ends sooner, lower-instalment keeps the end.' },
}

const LATE_INSTALMENT_FIELDS: FieldDocs<LateInstalment> = {
  id: { exposure: 'ref', to: LATE_INSTALMENT_RECORDS.name, meaning: 'The late instalment.' },
  loan: { exposure: 'ref', to: BANK_LOAN_RECORDS.name, meaning: 'The bank loan.' },
  due: { exposure: 'plain', meaning: 'The due date of the instalment.' },
  paid: { exposure: 'plain', meaning: 'The day it went out.' },
}

const INFORMAL_LOAN_FIELDS: FieldDocs<InformalLoan> = {
  id: { exposure: 'ref', to: INFORMAL_LOAN_RECORDS.name, meaning: 'The informal loan.' },
  name: { exposure: 'free-text', meaning: 'The name the owner gave it.' },
  counterparty: { exposure: 'party', meaning: 'Who it is with. An alias for a person Kuna knows.' },
  direction: { exposure: 'plain', meaning: 'you-owe or owed-to-you.' },
  openingBalance: { exposure: 'plain', amount: 'app', sign: 'zero-or-more', meaning: 'What was owed on the start day.' },
  start: { exposure: 'plain', meaning: 'The day it starts. Movements come after it.' },
  note: { exposure: 'free-text', meaning: "The owner's note." },
  expected: {
    exposure: 'plain',
    meaning: 'What the borrower means to repay each month, for information only, or empty.',
    read: ({ expected }) => (expected === null ? null : `${euros(expected.monthly)} a month on day ${expected.day}, from ${expected.from}`),
  },
}

const MOVEMENT_FIELDS: FieldDocs<Movement> = {
  id: { exposure: 'ref', to: MOVEMENT_RECORDS.name, meaning: 'The movement.' },
  loan: { exposure: 'ref', to: INFORMAL_LOAN_RECORDS.name, meaning: 'The informal loan.' },
  date: { exposure: 'plain', meaning: 'The day.' },
  kind: { exposure: 'plain', meaning: 'borrowed and borrowed-in-kind raise what is owed. repaid, repaid-in-kind and forgiven lower it.' },
  amount: { exposure: 'plain', amount: 'app', sign: 'zero-or-more', meaning: 'Above zero. The kind gives its direction.' },
  note: { exposure: 'free-text', meaning: "The owner's note." },
}

const SCENARIO_FIELDS: FieldDocs<ScenarioRead> = {
  id: { exposure: 'ref', to: LOAN_SCENARIO_RECORDS.name, meaning: 'The scenario.' },
  name: { exposure: 'free-text', meaning: 'The name the owner or Kuna gave it.' },
  loan: { exposure: 'ref', to: BANK_LOAN_RECORDS.name, meaning: 'The bank loan a saved try starts from, or none for an offer.' },
  offer: { exposure: 'plain', meaning: "An offer's terms, each a line. Its first rate and any later ones are scenario changes." },
}

const SCENARIO_CHANGE_FIELDS: FieldDocs<ScenarioChangeRead> = {
  id: { exposure: 'ref', to: SCENARIO_CHANGE_RECORDS.name, meaning: 'The change.' },
  scenario: { exposure: 'ref', to: LOAN_SCENARIO_RECORDS.name, meaning: 'The scenario it belongs to.' },
  kind: { exposure: 'plain', meaning: 'extra-payment, regular-extra-payment, rate-change, move or term-change.' },
  on: { exposure: 'plain', meaning: 'The day it takes effect: the payment day, or the due date a rate, move or term starts on.' },
  terms: { exposure: 'plain', meaning: 'The rest of its terms, each a line.' },
}

function offerLines(terms: OfferTerms): readonly string[] {
  return [
    `lender ${terms.lender}`,
    `amount borrowed ${euros(terms.principal)}`,
    `paid out ${terms.drawdown}`,
    `first instalment ${terms.firstInstalment}`,
    `instalments ${terms.instalments}`,
    `repayment ${terms.repayment}`,
    ...(terms.interimInterest === null ? [] : [`interim interest ${euros(terms.interimInterest.amount)} on ${terms.interimInterest.date}`]),
    ...(terms.subsidy === null ? [] : [`subsidy ${euros(terms.subsidy.monthly)} a month from instalment ${terms.subsidy.firstInstalment} for ${terms.subsidy.instalments}`]),
    `costs ${euros(terms.costs.upfront)} up front, ${euros(terms.costs.monthly)} a month, ${euros(terms.costs.yearly)} a year`,
    ...(terms.bankEks === null ? [] : [`EKS the bank printed ${percent(terms.bankEks)}`]),
  ]
}

function scenarioRead(scenario: LoanScenario): ScenarioRead {
  const { start } = scenario
  return { id: scenario.id, name: scenario.name, loan: start.kind === 'loan' ? start.loan : null, offer: start.kind === 'offer' ? offerLines(start.terms) : [] }
}

function changeTerms(change: ScenarioChange): readonly string[] {
  switch (change.kind) {
    case 'extra-payment':
      return [`amount ${euros(change.amount)}`, `effect ${change.effect}`]
    case 'regular-extra-payment':
      return [`amount ${euros(change.amount)}`, `every ${change.every}`, `until ${change.until ?? 'the end'}`, `effect ${change.effect}`]
    case 'rate-change':
      return [`rate ${percent(change.rate)}`, `rate type ${change.rateType}`]
    case 'move':
      return [
        `lender ${change.lender}`,
        `rate ${percent(change.rate)}`,
        `rate type ${change.rateType}`,
        `instalments ${change.instalments}`,
        `costs ${euros(change.costs.upfront)} up front, ${euros(change.costs.monthly)} a month, ${euros(change.costs.yearly)} a year`,
      ]
    case 'term-change':
      return [`instalments from then ${change.instalments}`]
  }
}

function dayOfPeriod(period: string | null): CivilDate {
  if (period === null) return today()
  const day = parseCivilDate(period)
  if (day === null) throw new RangeError('Not a day.')
  return day
}

function amount(label: string, cents: Money): ReportFigure {
  return { label, of: 'app', cents, currency: EURO }
}

function rate(label: string, yearly: YearlyRate): ReportFigure {
  return { label, basisPoints: nearestBasisPoints(pointsOfShare(fractionOf(yearly))) }
}

/** What each loan owes on the day, and what falls due next, as the Overview and each loan's page show it. Loans go by their lender and payout or start day, never by a name a person gave. */
function balancesReport(book: LoanBook, period: string | null): readonly ReportFigure[] {
  const day = dayOfPeriod(period)
  const totals = owedOnDay(book, day)
  const bankNames = distinctNames(book.bankLoans.map(({ loan }) => `bank loan from ${loan.lender} paid out ${loan.drawdown}`))
  const informalNames = distinctNames(book.informalLoans.map(({ loan }) => `informal loan started ${loan.start}`))
  const bank = book.bankLoans.flatMap((loanBook, at): ReportFigure[] => {
    const figures = bankLoanFigures(loanBook, day)
    const named = bankNames[at]!
    if (figures === null) return [{ label: `${named}: rate periods that leave its plan unworked, so it has no figures`, count: 1 }]
    return [
      amount(`${named}: owed`, figures.owed),
      ...(figures.next === null
        ? []
        : [amount(`${named}: next instalment, due ${figures.next.date}`, figures.next.payment), amount(`${named}: your share of it after the subsidy`, figures.next.yourShare)]),
      { label: `${named}: instalments left${figures.payoff === null ? '' : `, paid off ${figures.payoff}`}`, count: figures.instalmentsLeft },
      amount(`${named}: interest in ${figures.interestThisYear.year}`, figures.interestThisYear.interest),
    ]
  })
  const informal = book.informalLoans.flatMap(({ loan, movements }, at): ReportFigure[] => {
    const named = informalNames[at]!
    const next = planStanding(loan, movements, day)?.next ?? null
    return [
      amount(`${named}: you owe, below zero when they owe you`, informalLoanFigures({ loan, movements }, day).owedByYou),
      ...(next === null ? [] : [amount(`${named}: next expected repayment, due ${next.date}`, next.amount)]),
    ]
  })
  return [
    amount('you owe over every loan', totals.owed),
    amount('others owe you on informal loans', totals.owedToYou),
    { label: 'loans you owe on', count: totals.loansYouOwe },
    { label: 'loans others owe you on', count: totals.loansOwedToYou },
    ...bank,
    ...informal,
  ]
}

/**
 * Each bank loan's instalments against the rows of your statements linked to them, as each loan's plan
 * shows them on the day: the day a linked row went out, with a late-instalment record it overrules,
 * and each instalment from the first linked one on that no row shows. Every other instalment counts as
 * paid on its due date and is left out.
 */
function statementsReport(book: LoanBook, payments: StatementPayments, period: string | null): readonly ReportFigure[] {
  const day = dayOfPeriod(period)
  if (payments === 'unchecked') return [{ label: 'instalments checked against your statements, as Spending did not open', count: 0 }]
  const names = distinctNames(book.bankLoans.map(({ loan }) => `bank loan from ${loan.lender} paid out ${loan.drawdown}`))
  return book.bankLoans.flatMap((loanBook, at) => {
    const named = names[at]!
    const standings = instalmentStandings(loanBook, payments, day)
    return (loanBook.plan ?? []).flatMap((row): ReportFigure[] => {
      const standing = row.kind === 'instalment' ? standings.get(row.date) : undefined
      if (standing?.standing === 'not-seen') return [amount(`${named}: instalment due ${row.date}, your share, not seen in your statement`, row.yourShare)]
      if (standing?.standing !== 'seen') return []
      const overruled = standing.overruled === null ? '' : `, which overrules the late-instalment record of ${standing.overruled.paid}`
      return [amount(`${named}: instalment due ${row.date}, your share, paid ${standing.paid} as your statement shows${overruled}`, row.yourShare)]
    })
  })
}

/** An offer by its lender, amount, term, first rate and upfront costs, which tell apart a fixed and a variable offer from one bank. Never by the name a person gave it. */
function offerName(terms: OfferTerms, changes: readonly ScenarioChange[]): string {
  const [first] = changes.flatMap((change) => (change.kind === 'rate-change' ? [change] : [])).sort((one, other) => one.from.localeCompare(other.from))
  const rated = first === undefined ? '' : ` at ${percent(first.rate)} ${first.rateType} first`
  return `offer from ${terms.lender === '' ? 'a bank' : terms.lender} of ${euros(terms.principal)} over ${terms.instalments} instalments${rated}, ${euros(terms.costs.upfront)} up front`
}

/** Each saved offer worked out over its whole loan, as the Scenarios screen compares them. The day is read only to check it is one. */
function offersReport(book: LoanBook, period: string | null): readonly ReportFigure[] {
  dayOfPeriod(period)
  const offers = workedOffers(book.scenarios).flatMap((worked) =>
    worked.kept?.scenario.start.kind === 'offer' ? [{ worked, terms: worked.kept.scenario.start.terms, changes: worked.kept.changes }] : [],
  )
  const names = distinctNames(offers.map(({ terms, changes }) => offerName(terms, changes)))
  return offers.flatMap(({ worked, terms }, at): ReportFigure[] => {
    const named = names[at]!
    const outcome = worked.outcome
    if (outcome === null) return [{ label: `${named}: Kuna cannot work it out`, count: 1 }]
    return [
      ...(outcome.nextInstalment === null ? [] : [amount(`${named}: first instalment`, outcome.nextInstalment)]),
      ...(outcome.lastInstalment === null || !outcome.instalmentChanges ? [] : [amount(`${named}: last instalment`, outcome.lastInstalment)]),
      { label: `${named}: instalments${outcome.payoff === null ? '' : `, paid off ${outcome.payoff}`}`, count: outcome.instalments },
      amount(`${named}: interest`, outcome.interest),
      amount(`${named}: costs beside the instalments`, outcome.costs),
      amount(`${named}: total paid`, outcome.total),
      ...(worked.eks === null ? [] : [rate(`${named}: Kuna's EKS estimate`, worked.eks)]),
      ...(terms.bankEks === null ? [] : [rate(`${named}: EKS the bank printed`, terms.bankEks)]),
    ]
  })
}

/** What the chat can read of Loans: its eight kinds, with every field classified, and the figures the screens show, from the same functions. Nothing here writes. */
export function loansReader(reading: LoansReading): AppReader {
  const rows = <R>(of: (book: LoanBook) => readonly R[]): readonly R[] => {
    const book = reading.book()
    return book === null ? [] : of(book)
  }
  const report = (figures: (book: LoanBook, period: string | null) => readonly ReportFigure[]) => (period: string | null) => {
    const book = reading.book()
    return book === null ? [] : figures(book, period)
  }
  const inEuros = () => EURO
  return {
    status: () => reading.status(),
    kinds: [
      readableKind({
        kind: BANK_LOAN_RECORDS,
        about: words.reads.bankLoan,
        fields: BANK_LOAN_FIELDS,
        dated: 'drawdown',
        rows: () => rows((book) => book.readings.bankLoans.facts),
        currencyOf: inEuros,
        page: BANK_LOAN_ROUTE,
      }),
      readableKind({
        kind: RATE_PERIOD_RECORDS,
        about: words.reads.ratePeriod,
        fields: RATE_PERIOD_FIELDS,
        dated: 'from',
        rows: () => rows((book) => book.readings.ratePeriods.facts),
        currencyOf: inEuros,
      }),
      readableKind({
        kind: EXTRA_PAYMENT_RECORDS,
        about: words.reads.extraPayment,
        fields: EXTRA_PAYMENT_FIELDS,
        dated: 'date',
        rows: () => rows((book) => book.readings.extraPayments.facts),
        currencyOf: inEuros,
      }),
      readableKind({
        kind: LATE_INSTALMENT_RECORDS,
        about: words.reads.lateInstalment,
        fields: LATE_INSTALMENT_FIELDS,
        dated: 'due',
        rows: () => rows((book) => book.readings.lateInstalments.facts),
        currencyOf: inEuros,
      }),
      readableKind({
        kind: INFORMAL_LOAN_RECORDS,
        about: words.reads.informalLoan,
        fields: INFORMAL_LOAN_FIELDS,
        dated: 'start',
        rows: () => rows((book) => book.readings.informalLoans.facts),
        currencyOf: inEuros,
        page: INFORMAL_LOAN_ROUTE,
      }),
      readableKind({ kind: MOVEMENT_RECORDS, about: words.reads.movement, fields: MOVEMENT_FIELDS, dated: 'date', rows: () => rows((book) => book.readings.movements.facts), currencyOf: inEuros }),
      readableKind({
        kind: LOAN_SCENARIO_RECORDS,
        about: words.reads.loanScenario,
        fields: SCENARIO_FIELDS,
        dated: null,
        rows: () => rows((book) => book.readings.loanScenarios.facts.map(scenarioRead)),
        currencyOf: inEuros,
      }),
      readableKind({
        kind: SCENARIO_CHANGE_RECORDS,
        about: words.reads.scenarioChange,
        fields: SCENARIO_CHANGE_FIELDS,
        dated: 'on',
        rows: () =>
          rows((book) => book.readings.scenarioChanges.facts.map((change) => ({ id: change.id, scenario: change.scenario, kind: change.kind, on: changeDate(change), terms: changeTerms(change) }))),
        currencyOf: inEuros,
      }),
    ],
    reports: [
      { id: 'balances', title: words.reports.balances.title, about: words.reports.balances.about, period: 'day', figures: report(balancesReport) },
      { id: 'offers', title: words.reports.offers.title, about: words.reports.offers.about, period: 'day', figures: report(offersReport) },
      {
        id: 'statements',
        title: words.reports.statements.title,
        about: words.reports.statements.about,
        period: 'day',
        figures: report((book, period) => statementsReport(book, reading.statementPayments(), period)),
      },
    ],
  }
}
