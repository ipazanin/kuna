import { OFFER_OPERATIONS, planOfferStep } from './offerOperation'
import { acceptingBrowserFileCards, withBrowserFileCards } from '../../../../shared/app/browserFileCards'
import type { BrowserFile } from '../../../../shared/app/browserFileCards'
import { BANK_INSTALMENT, RATE, RATE_OR_NULL, printedInstalmentOf } from './operationTexts'
import { loansCardOf } from './proposalLines'
import {
  BANK_LOAN_WRITES,
  EXTRA_PAYMENT_WRITES,
  LATE_INSTALMENT_WRITES,
  RATE_PERIOD_WRITES,
  newBankLoan,
  newExtraPayment,
  newLateInstalment,
  newRatePeriod,
  removeBankLoan,
} from '../../bankLoans/application/bankLoanWrites'
import { triedRate } from '../../bankLoans/domain/whatIf'
import { typedRate } from '../../bankLoans/domain/yearlyRate'
import type { YearlyRate } from '../../bankLoans/domain/yearlyRate'
import { loanTermsTexts, typedLoanTerms } from '../../bankLoans/presentation/loanTermsTexts'
import type { LoanTermsTexts } from '../../bankLoans/presentation/loanTermsTexts'
import { tryName } from '../../bankLoans/presentation/savedTries'
import type { TriedChange } from '../../bankLoans/presentation/savedTries'
import { subsidyTexts, typedSubsidy } from '../../bankLoans/presentation/subsidyTexts'
import { words as bankWords, wordsFor } from '../../bankLoans/presentation/words'
import { INFORMAL_LOAN_WRITES, MOVEMENT_WRITES, newInformalLoan, newMovement, removeInformalLoan } from '../../informalLoans/application/informalLoanWrites'
import { copyScenario, newLoanScenario, removeScenario, saveScenario } from '../../scenarios/application/scenarioWrites'
import { words as scenarioWords } from '../../scenarios/presentation/words'
import { REPAYMENTS } from '../../workbook/domain/bankLoan'
import type { BankLoan, LoanSubsidy } from '../../workbook/domain/bankLoan'
import { EXTRA_PAYMENT_EFFECTS } from '../../workbook/domain/extraPayment'
import type { ExtraPayment } from '../../workbook/domain/extraPayment'
import { LOAN_DIRECTIONS } from '../../workbook/domain/informalLoan'
import type { ExpectedPlan, InformalLoan } from '../../workbook/domain/informalLoan'
import { BANK_LOAN_RECORDS, EXTRA_PAYMENT_RECORDS, INFORMAL_LOAN_RECORDS, LATE_INSTALMENT_RECORDS, LOAN_SCENARIO_RECORDS, MOVEMENT_RECORDS, RATE_PERIOD_RECORDS } from '../../workbook/domain/loanKinds'
import type { LoansBooks } from '../../workbook/domain/loansBooks'
import { MOVEMENT_KINDS } from '../../workbook/domain/movement'
import { RATE_TYPES } from '../../workbook/domain/ratePeriod'
import type { RatePeriod } from '../../workbook/domain/ratePeriod'
import type { BankLoanBook, LoanBook, ScenarioBook } from '../../workbook/domain/readLoanBook'
import { NUMBER, NUMBER_OR_NULL, TEXT, TEXT_OR_NULL, choiceOf, dayOf, found, inputOf } from '../../../../shared/app/operationInput'
import { amountText, choiceOrNull, countText, moneyOf, refuseOnErrors } from '../../../../shared/app/operationTexts'
import type { AppAcceptance, AppProposer, AssistantOperation, ProposalStep } from '../../../../shared/app/assistantOperations'
import { StepRefused, proposedWrites } from '../../../../shared/app/proposedWrites'
import type { OpenBooks, ProposalWork } from '../../../../shared/app/proposedWrites'
import { dayOfMonth, today } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { Money } from '../../../../shared/money/money'
import type { WorkbookStore } from '../../../../shared/storage/application/createWorkbookStore'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'

const REPAYMENT = { type: 'string', enum: [...REPAYMENTS] } as const
const RATE_TYPE = { type: 'string', enum: [...RATE_TYPES] } as const
const EFFECT = { type: 'string', enum: [...EXTRA_PAYMENT_EFFECTS] } as const
const SUBSIDY_FIELDS = { subsidyMonthly: NUMBER_OR_NULL, subsidyPayer: TEXT, subsidyFirstInstalment: NUMBER_OR_NULL, subsidyInstalments: NUMBER_OR_NULL }
const EXPECTED_FIELDS = { expectedMonthly: NUMBER_OR_NULL, expectedFrom: TEXT_OR_NULL, expectedDay: NUMBER_OR_NULL }

/** Every change the chat can propose in Loans but an offer's. Each calls the write functions and checks the screens use. */
const LOAN_OPERATIONS: readonly AssistantOperation[] = [
  {
    name: 'add-bank-loan',
    about:
      "A bank loan you have, with its first rate from the first instalment, as the contract gives it. principal is in euros. instalments counts every monthly payment. interimAmount and interimDate are the interest charged before repayment, both or neither. subsidyMonthly and the next two fields add a subsidy, or are null for none. bankInstalment is the first instalment the contract or repayment plan prints, which the card sets beside Kuna's own and the file does not keep. Later rates go as add-rate-period.",
    input: inputOf({
      name: TEXT,
      lender: TEXT,
      principal: NUMBER,
      drawdown: TEXT,
      firstInstalment: TEXT,
      instalments: NUMBER,
      interimAmount: NUMBER_OR_NULL,
      interimDate: TEXT_OR_NULL,
      repayment: REPAYMENT,
      rate: RATE,
      rateType: RATE_TYPE,
      rateNote: TEXT,
      ...SUBSIDY_FIELDS,
      note: TEXT,
      bankInstalment: BANK_INSTALMENT,
    }),
    refs: {},
    creates: BANK_LOAN_RECORDS.name,
    alone: false,
    example: {
      name: 'Car loan',
      lender: 'Example Bank',
      principal: 15000,
      drawdown: '2026-11-02',
      firstInstalment: '2026-12-02',
      instalments: 60,
      interimAmount: null,
      interimDate: null,
      repayment: 'annuity',
      rate: '4.5',
      rateType: 'fixed',
      rateNote: '',
      subsidyMonthly: null,
      subsidyPayer: '',
      subsidyFirstInstalment: null,
      subsidyInstalments: null,
      note: '',
      bankInstalment: 279.65,
    },
  },
  {
    name: 'change-bank-loan',
    about:
      "Fixes a bank loan's terms. A new first instalment moves the first rate period with it. interimAmount 0 removes the interim interest. Rates, the subsidy and extra payments have their own operations. Null leaves a field as it is.",
    input: inputOf({
      loan: TEXT,
      name: TEXT_OR_NULL,
      lender: TEXT_OR_NULL,
      principal: NUMBER_OR_NULL,
      drawdown: TEXT_OR_NULL,
      firstInstalment: TEXT_OR_NULL,
      instalments: NUMBER_OR_NULL,
      interimAmount: NUMBER_OR_NULL,
      interimDate: TEXT_OR_NULL,
      repayment: choiceOrNull(REPAYMENTS),
      note: TEXT_OR_NULL,
    }),
    refs: { loan: BANK_LOAN_RECORDS.name },
    creates: null,
    alone: false,
    example: {
      loan: 'bank-loan',
      name: 'Renamed',
      lender: null,
      principal: null,
      drawdown: null,
      firstInstalment: null,
      instalments: null,
      interimAmount: null,
      interimDate: null,
      repayment: null,
      note: 'Checked',
    },
  },
  {
    name: 'delete-bank-loan',
    about: 'Deletes a bank loan with its rate periods, extra payments, late instalments and the tries saved on it.',
    input: inputOf({ loan: TEXT }),
    refs: { loan: BANK_LOAN_RECORDS.name },
    creates: null,
    alone: false,
    example: { loan: 'bank-loan' },
  },
  {
    name: 'set-subsidy',
    about:
      'Adds or changes what a third party such as APN pays of each instalment, from the instalment numbered firstInstalment, for instalments of them. monthly null takes the subsidy off. Null payer, firstInstalment or instalments keeps what the subsidy has.',
    input: inputOf({ loan: TEXT, monthly: NUMBER_OR_NULL, payer: TEXT_OR_NULL, firstInstalment: NUMBER_OR_NULL, instalments: NUMBER_OR_NULL }),
    refs: { loan: BANK_LOAN_RECORDS.name },
    creates: null,
    alone: false,
    example: { loan: 'bank-loan', monthly: 20, payer: 'APN', firstInstalment: 1, instalments: 6 },
  },
  {
    name: 'add-rate-period',
    about: "A new yearly rate on a bank loan from one of its due dates on, until the next period. Only the loan's first period starts at its first instalment.",
    input: inputOf({ loan: TEXT, from: TEXT, rate: RATE, rateType: RATE_TYPE, note: TEXT }),
    refs: { loan: BANK_LOAN_RECORDS.name },
    creates: null,
    alone: false,
    example: { loan: 'bank-loan', from: '2026-10-05', rate: '3.9', rateType: 'variable', note: '' },
  },
  {
    name: 'change-rate-period',
    about: 'Fixes a rate period: another due date, rate, type or note. The first period stays at the first instalment. Null leaves a field as it is.',
    input: inputOf({ period: TEXT, from: TEXT_OR_NULL, rate: RATE_OR_NULL, rateType: choiceOrNull(RATE_TYPES), note: TEXT_OR_NULL }),
    refs: { period: RATE_PERIOD_RECORDS.name },
    creates: null,
    alone: false,
    example: { period: 'rate-period-later', from: null, rate: '4.2', rateType: null, note: null },
  },
  {
    name: 'delete-rate-period',
    about: "Deletes a rate period. The loan's first one goes only with the loan.",
    input: inputOf({ period: TEXT }),
    refs: { period: RATE_PERIOD_RECORDS.name },
    creates: null,
    alone: false,
    example: { period: 'rate-period-later' },
  },
  {
    name: 'add-extra-payment',
    about: 'Principal paid back early on a bank loan, on or after its payout, in euros. effect is what the bank does after it.',
    input: inputOf({ loan: TEXT, date: TEXT, amount: NUMBER, effect: EFFECT }),
    refs: { loan: BANK_LOAN_RECORDS.name },
    creates: null,
    alone: false,
    example: { loan: 'bank-loan', date: '2026-09-01', amount: 100, effect: 'lower-instalment' },
  },
  {
    name: 'change-extra-payment',
    about: 'Fixes an extra payment. Null leaves a field as it is.',
    input: inputOf({ payment: TEXT, date: TEXT_OR_NULL, amount: NUMBER_OR_NULL, effect: choiceOrNull(EXTRA_PAYMENT_EFFECTS) }),
    refs: { payment: EXTRA_PAYMENT_RECORDS.name },
    creates: null,
    alone: false,
    example: { payment: 'extra-payment', date: null, amount: 150, effect: null },
  },
  {
    name: 'delete-extra-payment',
    about: 'Deletes an extra payment.',
    input: inputOf({ payment: TEXT }),
    refs: { payment: EXTRA_PAYMENT_RECORDS.name },
    creates: null,
    alone: false,
    example: { payment: 'extra-payment' },
  },
  {
    name: 'add-late-instalment',
    about: "Marks one of a bank loan's instalments, due by today, as paid late on the paid day, after its due date. due is the instalment's due date.",
    input: inputOf({ loan: TEXT, due: TEXT, paid: TEXT }),
    refs: { loan: BANK_LOAN_RECORDS.name },
    creates: null,
    alone: false,
    example: { loan: 'bank-loan', due: '2026-04-05', paid: '2026-04-08' },
  },
  {
    name: 'change-late-instalment',
    about: 'Fixes a late instalment. Null leaves a field as it is.',
    input: inputOf({ late: TEXT, due: TEXT_OR_NULL, paid: TEXT_OR_NULL }),
    refs: { late: LATE_INSTALMENT_RECORDS.name },
    creates: null,
    alone: false,
    example: { late: 'late-instalment', due: null, paid: '2026-03-10' },
  },
  {
    name: 'delete-late-instalment',
    about: 'Takes the late mark off an instalment, so it counts as paid on its due date.',
    input: inputOf({ late: TEXT }),
    refs: { late: LATE_INSTALMENT_RECORDS.name },
    creates: null,
    alone: false,
    example: { late: 'late-instalment' },
  },
  {
    name: 'save-try',
    about:
      'Saves a try on a bank loan, as What if on its page does, under the name What if gives it. kind extra-payment takes date (on or after the payout), amount and effect. rate-change takes date, a due date still to come, and rate. term-change takes date, a due date still to come, and instalments, fewer than the loan has left from then. Fields a kind does not take are null.',
    input: inputOf({
      loan: TEXT,
      kind: { type: 'string', enum: ['extra-payment', 'rate-change', 'term-change'] },
      date: TEXT,
      amount: NUMBER_OR_NULL,
      effect: choiceOrNull(EXTRA_PAYMENT_EFFECTS),
      rate: RATE_OR_NULL,
      instalments: NUMBER_OR_NULL,
    }),
    refs: { loan: BANK_LOAN_RECORDS.name },
    creates: null,
    alone: false,
    example: { loan: 'bank-loan', kind: 'extra-payment', date: '2026-09-01', amount: 200, effect: 'shorter-term', rate: null, instalments: null },
  },
  {
    name: 'copy-scenario',
    about: 'Copies an offer or a saved try with its changes, under a new name, or under the name the Scenarios screen gives a copy for null.',
    input: inputOf({ scenario: TEXT, name: TEXT_OR_NULL }),
    refs: { scenario: LOAN_SCENARIO_RECORDS.name },
    creates: null,
    alone: false,
    example: { scenario: 'loan-scenario', name: null },
  },
  {
    name: 'delete-scenario',
    about: 'Deletes an offer or a saved try with its changes.',
    input: inputOf({ scenario: TEXT }),
    refs: { scenario: LOAN_SCENARIO_RECORDS.name },
    creates: null,
    alone: false,
    example: { scenario: 'loan-scenario-try' },
  },
  {
    name: 'add-informal-loan',
    about:
      'Money owed between people, with no interest. direction says who owes. openingBalance is what was owed on the start day, in euros. expectedMonthly, expectedFrom and expectedDay note what the borrower means to repay each month, or are null for no plan.',
    input: inputOf({ name: TEXT, counterparty: TEXT, direction: { type: 'string', enum: [...LOAN_DIRECTIONS] }, openingBalance: NUMBER, start: TEXT, note: TEXT, ...EXPECTED_FIELDS }),
    refs: {},
    creates: INFORMAL_LOAN_RECORDS.name,
    alone: false,
    example: { name: 'From Marko', counterparty: 'Marko', direction: 'you-owe', openingBalance: 500, start: '2026-10-01', note: '', expectedMonthly: null, expectedFrom: null, expectedDay: null },
  },
  {
    name: 'change-informal-loan',
    about: 'Fixes an informal loan. expectedMonthly 0 takes the expected plan off. A plan field left null keeps what the plan had. Null leaves a field as it is.',
    input: inputOf({
      loan: TEXT,
      name: TEXT_OR_NULL,
      counterparty: TEXT_OR_NULL,
      direction: choiceOrNull(LOAN_DIRECTIONS),
      openingBalance: NUMBER_OR_NULL,
      start: TEXT_OR_NULL,
      note: TEXT_OR_NULL,
      ...EXPECTED_FIELDS,
    }),
    refs: { loan: INFORMAL_LOAN_RECORDS.name },
    creates: null,
    alone: false,
    example: {
      loan: 'informal-loan',
      name: null,
      counterparty: null,
      direction: null,
      openingBalance: null,
      start: null,
      note: 'Checked',
      expectedMonthly: 100,
      expectedFrom: '2026-04-01',
      expectedDay: 15,
    },
  },
  {
    name: 'delete-informal-loan',
    about: 'Deletes an informal loan with its movements.',
    input: inputOf({ loan: TEXT }),
    refs: { loan: INFORMAL_LOAN_RECORDS.name },
    creates: null,
    alone: false,
    example: { loan: 'informal-loan' },
  },
  {
    name: 'add-movement',
    about: 'A dated change to what an informal loan owes, on or after its start. amount is above zero, and kind gives its direction.',
    input: inputOf({ loan: TEXT, date: TEXT, kind: { type: 'string', enum: [...MOVEMENT_KINDS] }, amount: NUMBER, note: TEXT }),
    refs: { loan: INFORMAL_LOAN_RECORDS.name },
    creates: null,
    alone: false,
    example: { loan: 'informal-loan', date: '2026-10-15', kind: 'repaid', amount: 200, note: '' },
  },
  {
    name: 'change-movement',
    about: 'Fixes a movement. Null leaves a field as it is.',
    input: inputOf({ movement: TEXT, date: TEXT_OR_NULL, kind: choiceOrNull(MOVEMENT_KINDS), amount: NUMBER_OR_NULL, note: TEXT_OR_NULL }),
    refs: { movement: MOVEMENT_RECORDS.name },
    creates: null,
    alone: false,
    example: { movement: 'movement', date: null, kind: null, amount: 250, note: null },
  },
  {
    name: 'delete-movement',
    about: 'Deletes a movement.',
    input: inputOf({ movement: TEXT }),
    refs: { movement: MOVEMENT_RECORDS.name },
    creates: null,
    alone: false,
    example: { movement: 'movement' },
  },
]

/** Every change the chat can propose in Loans. A field that is not listed here cannot be proposed, whatever a model asks. */
export const LOANS_OPERATIONS: readonly AssistantOperation[] = [...LOAN_OPERATIONS, ...OFFER_OPERATIONS]

/** An amount above zero, as every Loans form asks. */
function positiveOf(amount: number, what: string): Money {
  const cents = moneyOf(amount)
  if (cents <= 0) throw new StepRefused(`${what} is above zero.`)
  return cents
}

function rateOf(text: string): YearlyRate {
  const rate = typedRate(text)
  if (rate === null) throw new StepRefused(`${text} does not read as a yearly percent such as 3.18, with at most four decimals.`)
  return rate
}

/** The subsidy the fields give, through the subsidy dialog's own check, or null for none. */
function subsidyOf(monthly: number | null, payer: string, firstInstalment: number | null, instalments: number | null, loanInstalments: number): LoanSubsidy | null {
  if (monthly === null) return null
  const texts = { monthly: amountText(monthly), payer, firstInstalment: countText(firstInstalment), instalments: countText(instalments) }
  const typed = typedSubsidy(texts, loanInstalments, bankWords.subsidyFields)
  refuseOnErrors({ monthly: typed.errors.monthly, firstInstalment: typed.errors.firstInstalment, instalments: typed.errors.instalments })
  return typed.subsidy
}

/** The loan's terms the texts give, through the loan dialog's own check, with its name, subsidy and note. */
function loanOf(texts: LoanTermsTexts, name: string, subsidy: LoanSubsidy | null, note: string): Omit<BankLoan, 'id'> {
  if (name.trim() === '') throw new StepRefused('A bank loan needs a name, such as Home loan.')
  const typed = typedLoanTerms(texts)
  refuseOnErrors(typed.errors)
  return { ...typed.terms!, name, subsidy, note }
}

/** The expected plan the fields give over what the loan had, as the informal loan dialog checks it, or null for none. */
function expectedOf(field: Readonly<Record<string, never>>, kept: ExpectedPlan | null, start: CivilDate): ExpectedPlan | null {
  const [monthly, from, day] = [field['expectedMonthly'] as number | null, field['expectedFrom'] as string | null, field['expectedDay'] as number | null]
  if (monthly === null && from === null && day === null) return kept
  if (monthly === 0) return null
  const planned = {
    monthly: monthly === null ? kept?.monthly : positiveOf(monthly, 'expectedMonthly'),
    from: from === null ? kept?.from : dayOf(from),
  }
  if (planned.monthly === undefined || planned.from === undefined) throw new StepRefused('An expected plan needs expectedMonthly and expectedFrom.')
  if (planned.from < start) throw new StepRefused('expectedFrom is on or after the day the loan starts.')
  const repaidOn = day ?? kept?.day ?? dayOfMonth(planned.from)
  if (!Number.isInteger(repaidOn) || repaidOn < 1 || repaidOn > 31) throw new StepRefused('expectedDay is a day of the month from 1 to 31.')
  return { monthly: planned.monthly, from: planned.from, day: repaidOn }
}

/** The informal loan the fields give, with the name the dialog asks for. */
function namedInformalLoan(fields: Omit<InformalLoan, 'id'>): Omit<InformalLoan, 'id'> {
  if (fields.name.trim() === '') throw new StepRefused('An informal loan needs a name, such as From Ana.')
  return fields
}

/** The change a try saves, checked as What if checks it: a payment on or after the payout, and a rate or term from a due date still to come. */
function triedChangeOf(book: BankLoanBook, field: Readonly<Record<string, never>>, day: CivilDate): TriedChange {
  const date = dayOf(field['date'])
  if (field['kind'] === 'extra-payment') {
    if (field['amount'] === null || field['effect'] === null) throw new StepRefused('An extra payment takes amount and effect.')
    if (date < book.loan.drawdown) throw new StepRefused('An extra payment falls on or after the payout.')
    return { kind: 'extra-payment', date, amount: positiveOf(field['amount'], 'amount'), effect: choiceOf(EXTRA_PAYMENT_EFFECTS, field['effect'], 'effect')! }
  }
  const coming = (book.plan ?? []).filter((row) => row.kind === 'instalment' && row.number !== null && row.date > day)
  if (!coming.some((row) => row.date === date)) throw new StepRefused('date is a due date of the loan still to come.')
  if (field['kind'] === 'rate-change') {
    if (field['rate'] === null) throw new StepRefused('A rate change takes rate.')
    return triedRate(book, date, rateOf(field['rate']))
  }
  const left = coming.filter((row) => row.date >= date).length
  const instalments = field['instalments'] as number | null
  if (instalments === null || !Number.isInteger(instalments) || instalments < 1 || instalments >= left)
    throw new StepRefused(`instalments is a whole number below the ${left} the loan has left from then.`)
  return { kind: 'term-change', from: date, instalments }
}

/**
 * Plans the steps into one write, in order, through the screens' own write functions. A `$` name stands for a loan an earlier step added.
 * It gives the instalment each new loan or offer printed, by the id of what the card writes, for the card to set beside Kuna's.
 */
function planned(unit: UnitOfWork, { workbook, records }: OpenBooks<LoansBooks>, steps: readonly ProposalStep[]): ReadonlyMap<string, Money> {
  const book: LoanBook = workbook
  const made = new Map<string, string>()
  const printed = new Map<string, Money>()
  const addedLoans: BankLoan[] = []
  const addedInformal: InformalLoan[] = []
  const idOf = (value: unknown): string => {
    const text = String(value)
    return made.get(text) ?? text
  }
  const bankLoanOf = (value: unknown): BankLoan => found([...book.readings.bankLoans.facts, ...addedLoans], idOf(value), 'bank loan')
  const bankBookOf = (value: unknown): BankLoanBook => {
    const id = idOf(value)
    const loanBook = book.bankLoans.find((candidate) => candidate.loan.id === id)
    if (loanBook !== undefined) return loanBook
    if (addedLoans.some((loan) => loan.id === id)) throw new StepRefused('A bank loan added on this card is changed, and takes its tries, on a card after it.')
    throw new StepRefused('That bank loan is no longer in the file.')
  }
  const informalOf = (value: unknown): InformalLoan => found([...book.readings.informalLoans.facts, ...addedInformal], idOf(value), 'informal loan')
  const scenarioOf = (value: unknown): ScenarioBook => {
    const id = idOf(value)
    const scenario = book.scenarios.find((candidate) => candidate.scenario.id === id)
    if (scenario === undefined) throw new StepRefused('That scenario is no longer in the file.')
    return scenario
  }
  const day = today()

  for (const { operation, input, as } of steps) {
    // The chat checked the input against this operation's schema, so each field has the type the schema gives it.
    const field = input as Readonly<Record<string, never>>
    switch (operation) {
      case 'add-bank-loan': {
        const texts: LoanTermsTexts = {
          lender: field['lender'],
          principal: amountText(field['principal']),
          drawdown: field['drawdown'],
          firstInstalment: field['firstInstalment'],
          instalments: countText(field['instalments']),
          interimAmount: amountText(field['interimAmount']),
          interimDate: field['interimDate'] ?? '',
          repayment: field['repayment'],
        }
        const subsidy = subsidyOf(field['subsidyMonthly'], field['subsidyPayer'], field['subsidyFirstInstalment'], field['subsidyInstalments'], field['instalments'])
        const loan = newBankLoan(loanOf(texts, field['name'], subsidy, field['note']))
        unit.of(BANK_LOAN_WRITES).add(loan)
        unit.of(RATE_PERIOD_WRITES).add(newRatePeriod({ loan: loan.id, from: loan.firstInstalment, rate: rateOf(field['rate']), rateType: field['rateType'], note: field['rateNote'] }))
        addedLoans.push(loan)
        if (as !== null) made.set(as, loan.id)
        const instalment = printedInstalmentOf(field['bankInstalment'])
        if (instalment !== null) printed.set(loan.id, instalment)
        break
      }
      case 'change-bank-loan': {
        const loanBook = bankBookOf(field['loan'])
        const before = loanBook.loan
        const kept = loanTermsTexts(before)
        const interimGone = field['interimAmount'] === 0
        const texts: LoanTermsTexts = {
          lender: field['lender'] ?? kept.lender,
          principal: field['principal'] === null ? kept.principal : amountText(field['principal']),
          drawdown: field['drawdown'] ?? kept.drawdown,
          firstInstalment: field['firstInstalment'] ?? kept.firstInstalment,
          instalments: field['instalments'] === null ? kept.instalments : countText(field['instalments']),
          interimAmount: interimGone ? '' : field['interimAmount'] === null ? kept.interimAmount : amountText(field['interimAmount']),
          interimDate: interimGone ? '' : (field['interimDate'] ?? kept.interimDate),
          repayment: choiceOf(REPAYMENTS, field['repayment'], 'repayment') ?? kept.repayment,
        }
        const after: BankLoan = { ...newBankLoan(loanOf(texts, field['name'] ?? before.name, before.subsidy, field['note'] ?? before.note)), id: before.id }
        unit.of(BANK_LOAN_WRITES).change(before, after)
        const firstPeriod = loanBook.ratePeriods.find((period) => period.from === before.firstInstalment) ?? null
        if (firstPeriod !== null && after.firstInstalment !== before.firstInstalment) unit.of(RATE_PERIOD_WRITES).change(firstPeriod, { ...firstPeriod, from: after.firstInstalment })
        break
      }
      case 'delete-bank-loan':
        removeBankLoan(unit, records, bankBookOf(field['loan']).loan)
        break
      case 'set-subsidy': {
        const loan = bankBookOf(field['loan']).loan
        const kept = subsidyTexts(loan.subsidy)
        const subsidy =
          field['monthly'] === null
            ? null
            : subsidyOf(field['monthly'], field['payer'] ?? kept.payer, field['firstInstalment'] ?? Number(kept.firstInstalment), field['instalments'] ?? Number(kept.instalments), loan.instalments)
        if (subsidy === null && loan.subsidy === null) throw new StepRefused('That loan has no subsidy to take off.')
        unit.of(BANK_LOAN_WRITES).change(loan, { ...loan, subsidy })
        break
      }
      case 'add-rate-period': {
        const loan = bankLoanOf(field['loan'])
        unit.of(RATE_PERIOD_WRITES).add(newRatePeriod({ loan: loan.id, from: dayOf(field['from']), rate: rateOf(field['rate']), rateType: field['rateType'], note: field['note'] }))
        break
      }
      case 'change-rate-period': {
        const before = found(book.readings.ratePeriods.facts, idOf(field['period']), 'rate period')
        const after: RatePeriod = {
          ...before,
          from: field['from'] === null ? before.from : dayOf(field['from']),
          rate: field['rate'] === null ? before.rate : rateOf(field['rate']),
          rateType: choiceOf(RATE_TYPES, field['rateType'], 'rateType') ?? before.rateType,
          note: field['note'] ?? before.note,
        }
        unit.of(RATE_PERIOD_WRITES).change(before, after)
        break
      }
      case 'delete-rate-period':
        unit.of(RATE_PERIOD_WRITES).remove(found(book.readings.ratePeriods.facts, idOf(field['period']), 'rate period'))
        break
      case 'add-extra-payment': {
        const loan = bankLoanOf(field['loan'])
        unit.of(EXTRA_PAYMENT_WRITES).add(newExtraPayment({ loan: loan.id, date: dayOf(field['date']), amount: positiveOf(field['amount'], 'amount'), effect: field['effect'] }))
        break
      }
      case 'change-extra-payment': {
        const before = found(book.readings.extraPayments.facts, idOf(field['payment']), 'extra payment')
        const after: ExtraPayment = {
          ...before,
          date: field['date'] === null ? before.date : dayOf(field['date']),
          amount: field['amount'] === null ? before.amount : positiveOf(field['amount'], 'amount'),
          effect: choiceOf(EXTRA_PAYMENT_EFFECTS, field['effect'], 'effect') ?? before.effect,
        }
        unit.of(EXTRA_PAYMENT_WRITES).change(before, after)
        break
      }
      case 'delete-extra-payment':
        unit.of(EXTRA_PAYMENT_WRITES).remove(found(book.readings.extraPayments.facts, idOf(field['payment']), 'extra payment'))
        break
      case 'add-late-instalment':
      case 'change-late-instalment': {
        const before = operation === 'change-late-instalment' ? found(book.readings.lateInstalments.facts, idOf(field['late']), 'late instalment') : null
        const due = field['due'] === null ? before!.due : dayOf(field['due'])
        const paid = field['paid'] === null ? before!.paid : dayOf(field['paid'])
        if (due > day) throw new StepRefused('Only an instalment due by today can be marked late.')
        if (paid <= due) throw new StepRefused('paid is after the due date.')
        if (before === null) unit.of(LATE_INSTALMENT_WRITES).add(newLateInstalment({ loan: bankLoanOf(field['loan']).id, due, paid }))
        else unit.of(LATE_INSTALMENT_WRITES).change(before, { ...before, due, paid })
        break
      }
      case 'delete-late-instalment':
        unit.of(LATE_INSTALMENT_WRITES).remove(found(book.readings.lateInstalments.facts, idOf(field['late']), 'late instalment'))
        break
      case 'save-try': {
        const loanBook = bankBookOf(field['loan'])
        if (loanBook.plan === null) throw new StepRefused("Kuna cannot work that loan's plan out, so it has nothing to try a change against.")
        const change = triedChangeOf(loanBook, field, day)
        const scenario = newLoanScenario({ name: tryName(change, wordsFor(loanBook.loan.repayment)), start: { kind: 'loan', loan: loanBook.loan.id } })
        saveScenario(unit, records, scenario, [change], null)
        break
      }
      case 'copy-scenario': {
        const scenario = scenarioOf(field['scenario'])
        const name = (field['name'] as string | null)?.trim() || scenarioWords.list.copyName(scenario.scenario.name)
        copyScenario(unit, scenario, name)
        break
      }
      case 'delete-scenario':
        removeScenario(unit, records, scenarioOf(field['scenario']).scenario)
        break
      case 'add-informal-loan': {
        const start = dayOf(field['start'])
        const fields = {
          name: field['name'],
          counterparty: field['counterparty'],
          direction: field['direction'],
          openingBalance: moneyOf(field['openingBalance']),
          start,
          note: field['note'],
          expected: expectedOf(field, null, start),
        }
        const loan = newInformalLoan(namedInformalLoan(fields))
        unit.of(INFORMAL_LOAN_WRITES).add(loan)
        addedInformal.push(loan)
        if (as !== null) made.set(as, loan.id)
        break
      }
      case 'change-informal-loan': {
        const before = found(book.readings.informalLoans.facts, idOf(field['loan']), 'informal loan')
        const start = field['start'] === null ? before.start : dayOf(field['start'])
        const fields = {
          name: field['name'] ?? before.name,
          counterparty: field['counterparty'] ?? before.counterparty,
          direction: choiceOf(LOAN_DIRECTIONS, field['direction'], 'direction') ?? before.direction,
          openingBalance: field['openingBalance'] === null ? before.openingBalance : moneyOf(field['openingBalance']),
          start,
          note: field['note'] ?? before.note,
          expected: expectedOf(field, before.expected, start),
        }
        unit.of(INFORMAL_LOAN_WRITES).change(before, { ...newInformalLoan(namedInformalLoan(fields)), id: before.id })
        break
      }
      case 'delete-informal-loan':
        removeInformalLoan(unit, records, found(book.readings.informalLoans.facts, idOf(field['loan']), 'informal loan'))
        break
      case 'add-movement': {
        const loan = informalOf(field['loan'])
        unit.of(MOVEMENT_WRITES).add(newMovement({ loan: loan.id, date: dayOf(field['date']), kind: field['kind'], amount: positiveOf(field['amount'], 'amount'), note: field['note'] }))
        break
      }
      case 'change-movement': {
        const before = found(book.readings.movements.facts, idOf(field['movement']), 'movement')
        unit.of(MOVEMENT_WRITES).change(before, {
          ...before,
          date: field['date'] === null ? before.date : dayOf(field['date']),
          kind: choiceOf(MOVEMENT_KINDS, field['kind'], 'kind') ?? before.kind,
          amount: field['amount'] === null ? before.amount : positiveOf(field['amount'], 'amount'),
          note: field['note'] ?? before.note,
        })
        break
      }
      case 'delete-movement':
        unit.of(MOVEMENT_WRITES).remove(found(book.readings.movements.facts, idOf(field['movement']), 'movement'))
        break
      default: {
        const offer = planOfferStep(unit, records, book, operation, field, day, idOf)
        if (offer === null) throw new StepRefused('There is no such operation.')
        if (offer.printedInstalment !== null) printed.set(offer.scenario, offer.printedInstalment)
      }
    }
  }
  return printed
}

/**
 * How the chat's steps become one write of the Loans file. Each plan adds its printed instalments under the new ids it writes, so two checks
 * at once keep each other's. The model hears when a first instalment differs, as the card's warning never reaches it.
 */
function loansWork(): ProposalWork<LoansBooks, never> {
  let printed: ReadonlyMap<string, Money> = new Map()
  let instalmentsDiffering = 0
  return {
    notOpen: 'The Loans file is not open on this device.',
    plan: (unit, books, steps) => {
      printed = new Map([...printed, ...planned(unit, books, steps)])
    },
    groups: (checked, { workbook }) => {
      const card = loansCardOf(checked, workbook, printed)
      instalmentsDiffering = card.instalmentsDiffering
      return card.groups
    },
    heldBack: () => {
      if (instalmentsDiffering === 0) return null
      const loans = instalmentsDiffering === 1 ? '1 loan or offer' : `${instalmentsDiffering} loans or offers`
      return `Kuna's first instalment is not the printed one on ${loans}. Tell the person to check the amount, rate, term and days against the document before accepting.`
    },
  }
}

type LoansStore = Pick<WorkbookStore<LoansBooks>, 'state' | 'check' | 'write' | 'undo'>

/** The changes the chat can propose and their dry run, over the app's own store, which `app.ts` hands in. */
export function loansProposer(store: LoansStore, file: BrowserFile): AppProposer {
  return withBrowserFileCards({ operations: LOANS_OPERATIONS, readsBooks: true, check: proposedWrites(store, loansWork()).check }, file)
}

/** Writes a proposal as it was checked, in one write with one Undo. A record changed since refuses this proposal alone. */
export function loansAcceptance(store: LoansStore, file: BrowserFile): AppAcceptance {
  return acceptingBrowserFileCards({ accept: proposedWrites(store, loansWork()).accept }, file)
}
