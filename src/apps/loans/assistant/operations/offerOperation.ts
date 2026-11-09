import { BANK_INSTALMENT, RATE, RATE_OR_NULL, printedInstalmentOf } from './operationTexts'
import { dueDateOf } from '../../bankLoans/domain/loanPlan'
import { newLoanScenario, saveScenario } from '../../scenarios/application/scenarioWrites'
import { REPEATS } from '../../scenarios/domain/loanScenario'
import type { LoanChange, LoanScenario } from '../../scenarios/domain/loanScenario'
import { offerBase } from '../../scenarios/domain/scenarioPlan'
import { costTexts, typedChange } from '../../scenarios/presentation/changeTexts'
import type { ChangeTexts } from '../../scenarios/presentation/changeTexts'
import { offerAutoName, offerTexts, typedOffer } from '../../scenarios/presentation/offerTexts'
import type { OfferTexts } from '../../scenarios/presentation/offerTexts'
import { REPAYMENTS } from '../../workbook/domain/bankLoan'
import { EXTRA_PAYMENT_EFFECTS } from '../../workbook/domain/extraPayment'
import { LOAN_SCENARIO_RECORDS } from '../../workbook/domain/loanKinds'
import { RATE_TYPES } from '../../workbook/domain/ratePeriod'
import type { LoanBook, LoansRecords } from '../../workbook/domain/readLoanBook'
import { NUMBER, NUMBER_OR_NULL, TEXT, TEXT_OR_NULL, choiceOf, inputOf } from '../../../../shared/app/operationInput'
import { amountText, choiceOrNull, countText, refuseOnErrors } from '../../../../shared/app/operationTexts'
import type { StrictSchema } from '../../../../shared/ai/domain/strictSchema'
import type { AssistantOperation } from '../../../../shared/app/assistantOperations'
import { StepRefused } from '../../../../shared/app/proposedWrites'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { Money } from '../../../../shared/money/money'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'

/** The changes an offer's editor adds under More terms. A move an offer holds stays as it is. */
const OFFER_CHANGE_KINDS = ['extra-payment', 'regular-extra-payment', 'rate-change'] as const

const OFFER_CHANGE: StrictSchema = inputOf({
  kind: { type: 'string', enum: [...OFFER_CHANGE_KINDS] },
  date: { type: 'string', description: "An extra payment's day, on or after the payout, or the due date a regular payment or a rate starts on." },
  amount: NUMBER_OR_NULL,
  effect: choiceOrNull(EXTRA_PAYMENT_EFFECTS),
  every: choiceOrNull(REPEATS),
  until: TEXT_OR_NULL,
  rate: RATE_OR_NULL,
  rateType: choiceOrNull(RATE_TYPES),
})

const CHANGES: StrictSchema = {
  type: 'array',
  items: OFFER_CHANGE,
  description:
    "The offer's extra payments and later rates, each in full: amount and effect for a payment, every and until for a regular one, rate and rateType for a rate. Fields a kind does not take are null.",
}

const LATER_TERMS: StrictSchema = {
  type: 'string',
  enum: ['keep', 'replace'],
  description: 'keep leaves the extra payments and later rates the offer holds, with changes []. replace sets them to changes.',
}

const OFFER_TERMS = {
  lender: TEXT,
  principal: NUMBER,
  rate: RATE,
  instalments: NUMBER,
  repayment: { type: 'string', enum: [...REPAYMENTS] },
  payout: TEXT,
  firstInstalment: TEXT_OR_NULL,
  interimAmount: NUMBER_OR_NULL,
  interimDate: TEXT_OR_NULL,
  fixedYears: NUMBER_OR_NULL,
  thenVariable: RATE_OR_NULL,
  subsidyMonthly: NUMBER_OR_NULL,
  subsidyPayer: TEXT,
  subsidyFirstInstalment: NUMBER_OR_NULL,
  subsidyInstalments: NUMBER_OR_NULL,
  upfrontCost: NUMBER,
  monthlyCost: NUMBER,
  yearlyCost: NUMBER,
  bankEks: { type: ['string', 'null'], description: 'The effective rate (EKS) the offer prints, as a percent such as 3.09, or null when it prints none. Never worked out.' },
} satisfies Readonly<Record<string, StrictSchema>>

/** The offer's operations: a new one from a bank's terms, checked on its card against the EKS it prints, and a change to one kept. */
export const OFFER_OPERATIONS: readonly AssistantOperation[] = [
  {
    name: 'add-offer',
    about:
      "A loan offer to weigh on the Scenarios screen, transcribed as the offer prints it. name is blank for the name Kuna gives it. principal and costs are in euros. instalments counts every monthly payment. rate is the first rate, fixed, and fixedYears with thenVariable give a variable rate after whole years, or are null. firstInstalment null is a month after the payout. The card sets Kuna's estimate of the EKS beside bankEks, and Kuna's first instalment beside bankInstalment, which the file does not keep.",
    input: inputOf({ name: TEXT, ...OFFER_TERMS, bankInstalment: BANK_INSTALMENT, changes: CHANGES }),
    refs: {},
    creates: null,
    alone: false,
    example: {
      name: '',
      lender: 'Example Bank',
      principal: 100000,
      rate: '3.5',
      instalments: 240,
      repayment: 'annuity',
      payout: '2026-12-01',
      firstInstalment: null,
      interimAmount: null,
      interimDate: null,
      fixedYears: 5,
      thenVariable: '4.1',
      subsidyMonthly: null,
      subsidyPayer: '',
      subsidyFirstInstalment: null,
      subsidyInstalments: null,
      upfrontCost: 500,
      monthlyCost: 0,
      yearlyCost: 0,
      bankEks: '3.95',
      bankInstalment: 579.96,
      changes: [],
    },
  },
  {
    name: 'change-offer',
    about:
      "Fixes a kept offer's terms. Null leaves a field as it is, and fixedYears 0 keeps the first rate to the end. subsidyMonthly 0 takes its subsidy off. With laterTerms replace, changes takes the place of every extra payment and later rate it holds, so list the ones to keep. A move it holds stays.",
    input: inputOf({
      scenario: TEXT,
      name: TEXT_OR_NULL,
      ...Object.fromEntries(Object.entries(OFFER_TERMS).map(([field, schema]) => [field, field === 'subsidyPayer' ? TEXT_OR_NULL : orNull(schema)])),
      laterTerms: LATER_TERMS,
      changes: CHANGES,
    }),
    refs: { scenario: LOAN_SCENARIO_RECORDS.name },
    creates: null,
    alone: false,
    example: {
      scenario: 'loan-scenario',
      name: null,
      lender: null,
      principal: 90000,
      rate: null,
      instalments: null,
      repayment: null,
      payout: null,
      firstInstalment: null,
      interimAmount: null,
      interimDate: null,
      fixedYears: null,
      thenVariable: null,
      subsidyMonthly: null,
      subsidyPayer: null,
      subsidyFirstInstalment: null,
      subsidyInstalments: null,
      upfrontCost: null,
      monthlyCost: null,
      yearlyCost: null,
      bankEks: null,
      laterTerms: 'replace',
      changes: [{ kind: 'extra-payment', date: '2027-06-01', amount: 5000, effect: 'shorter-term', every: null, until: null, rate: null, rateType: null }],
    },
  },
]

/** The same field, where null leaves it as it is. */
function orNull(schema: StrictSchema): StrictSchema {
  if (schema.type === 'number') return NUMBER_OR_NULL
  if (schema.type === 'string') return { type: ['string', 'null'], description: `${schema.enum === undefined ? (schema.description ?? 'Text') : schema.enum.join(', ')}, or null to leave it.` }
  return schema
}

type Field = Readonly<Record<string, never>>

/** The offer's fields over the ones it had, as its editor would hold them. A null keeps a field, fixedYears 0 clears the variable rate, and subsidyMonthly 0 the subsidy. */
function textsOver(kept: OfferTexts, field: Field): OfferTexts {
  const text = (name: string, of: (value: never) => string, held: string): string => (field[name] === null ? held : of(field[name]))
  const plain = (value: string): string => value
  const instalments = field['instalments'] as number | null
  const fixedGone = field['fixedYears'] === 0
  const subsidised = field['subsidyMonthly'] === null ? kept.subsidised : field['subsidyMonthly'] !== 0
  return {
    ...kept,
    name: field['name'] === null ? kept.name : (field['name'] as string),
    lender: text('lender', plain, kept.lender),
    principal: text('principal', amountText, kept.principal),
    rate: text('rate', plain, kept.rate),
    years: instalments === null ? kept.years : String(Math.floor(instalments / 12)),
    months: instalments === null ? kept.months : String(instalments % 12),
    repayment: choiceOf(REPAYMENTS, field['repayment'], 'repayment') ?? kept.repayment,
    payout: text('payout', plain, kept.payout),
    firstInstalment: text('firstInstalment', plain, kept.firstInstalment),
    interimAmount: text('interimAmount', amountText, kept.interimAmount),
    interimDate: text('interimDate', plain, kept.interimDate),
    fixedYears: fixedGone ? '' : text('fixedYears', countText, kept.fixedYears),
    thenVariable: fixedGone ? '' : text('thenVariable', plain, kept.thenVariable),
    subsidised,
    subsidy: subsidised
      ? {
          monthly: text('subsidyMonthly', amountText, kept.subsidy.monthly),
          payer: text('subsidyPayer', plain, kept.subsidy.payer),
          firstInstalment: text('subsidyFirstInstalment', countText, kept.subsidy.firstInstalment),
          instalments: text('subsidyInstalments', countText, kept.subsidy.instalments),
        }
      : kept.subsidy,
    costs: { upfront: text('upfrontCost', amountText, kept.costs.upfront), monthly: text('monthlyCost', amountText, kept.costs.monthly), yearly: text('yearlyCost', amountText, kept.costs.yearly) },
    bankEks: text('bankEks', plain, kept.bankEks),
  }
}

/** A new offer's fields, as the editor would hold them once typed in, with nulls blank. */
function newTexts(field: Field, day: CivilDate): OfferTexts {
  return textsOver(offerTexts('', null, [], day).texts, field)
}

/** The listed changes, each through the editor's own check against the offer's payout and due dates. */
function listedChanges(listed: readonly Field[], base: ReturnType<typeof offerBase>, kept: readonly LoanChange[]): LoanChange[] {
  const moved = Math.max(0, ...kept.map((change) => (change.kind === 'move' ? change.instalments : 0)))
  const dues = new Set(Array.from({ length: base.loan.instalments + moved }, (_, offset): string => dueDateOf(base.loan, offset + 1)))
  return listed.map((change, at) => {
    const kind = change['kind'] as (typeof OFFER_CHANGE_KINDS)[number]
    const date = change['date'] as string
    const texts: ChangeTexts = {
      id: at,
      kind,
      amount: amountText(change['amount']),
      date: kind === 'extra-payment' ? date : '',
      due: kind === 'extra-payment' ? '' : date,
      every: choiceOf(REPEATS, change['every'], 'every') ?? 'month',
      until: (change['until'] as string | null) ?? '',
      effect: choiceOf(EXTRA_PAYMENT_EFFECTS, change['effect'], 'effect') ?? 'shorter-term',
      rate: { rate: (change['rate'] as string | null) ?? '', rateType: choiceOf(RATE_TYPES, change['rateType'], 'rateType') ?? 'variable' },
      lender: '',
      instalments: '',
      costs: costTexts(null),
    }
    const typed = typedChange(texts, { drawdown: base.loan.drawdown, dues })
    if (typed.change === null) {
      refuseOnErrors(Object.fromEntries(Object.entries(typed.errors).map(([name, error]) => [`changes ${at + 1} ${name}`, error ?? null])))
      throw new StepRefused(`changes ${at + 1} is not a change the offer can take.`)
    }
    return typed.change
  })
}

/** Writes the offer the texts give, with its rates and the changes, through the editor's own check and its save, and gives the id of the scenario it writes. */
function writeOffer(unit: UnitOfWork, records: LoansRecords, texts: OfferTexts, field: Field, kept: readonly LoanChange[], editing: LoanScenario | null): string {
  const typed = typedOffer(texts)
  refuseOnErrors(typed.errors)
  if (typed.terms === null) throw new StepRefused('Those terms are not an offer the Scenarios screen can take.')
  const name = texts.name.trim() || offerAutoName(texts)
  const base = offerBase(name, typed.terms)
  const changes = [...typed.rates, ...kept, ...listedChanges(field['changes'] as readonly Field[], base, kept)]
  const start = { kind: 'offer', terms: typed.terms } as const
  const scenario: LoanScenario = editing === null ? newLoanScenario({ name, start }) : { ...editing, name, start }
  saveScenario(unit, records, scenario, changes, editing)
  return scenario.id
}

/** The offer an offer's step writes, by its scenario's id, with the instalment its document printed, which only the card reads. */
export interface OfferStep {
  readonly scenario: string
  readonly printedInstalment: Money | null
}

/** Plans an offer's step, or gives null for a step that is no offer's. */
export function planOfferStep(unit: UnitOfWork, records: LoansRecords, book: LoanBook, operation: string, field: Field, day: CivilDate, idOf: (value: unknown) => string): OfferStep | null {
  switch (operation) {
    case 'add-offer': {
      const printedInstalment = printedInstalmentOf(field['bankInstalment'])
      return { scenario: writeOffer(unit, records, newTexts(field, day), field, [], null), printedInstalment }
    }
    case 'change-offer': {
      const id = idOf(field['scenario'])
      const kept = book.scenarios.find((candidate) => candidate.scenario.id === id)
      if (kept === undefined) throw new StepRefused('That scenario is no longer in the file.')
      const { start } = kept.scenario
      if (start.kind !== 'offer') throw new StepRefused('That is a try saved on a bank loan, not an offer. Delete it and save another.')
      const { texts, later } = offerTexts(kept.scenario.name, start.terms, kept.changes, day)
      const replaced = field['laterTerms'] === 'replace'
      if (!replaced && (field['changes'] as readonly Field[]).length > 0) throw new StepRefused('changes is [] with laterTerms keep.')
      const scenario = writeOffer(unit, records, textsOver(texts, field), field, replaced ? later.filter((change) => change.kind === 'move' || change.kind === 'term-change') : later, kept.scenario)
      return { scenario, printedInstalment: null }
    }
    default:
      return null
  }
}
