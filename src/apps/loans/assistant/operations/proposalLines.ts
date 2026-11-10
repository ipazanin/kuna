import { words as bankWords } from '../../bankLoans/presentation/words'
import { instalmentAgreement, instalmentFrom } from '../../bankLoans/domain/instalmentAgreement'
import { loanPlan } from '../../bankLoans/domain/loanPlan'
import type { PlanRow } from '../../bankLoans/domain/loanPlan'
import { fractionOf } from '../../bankLoans/domain/yearlyRate'
import type { YearlyRate } from '../../bankLoans/domain/yearlyRate'
import { MOVEMENT_KIND_NAMES } from '../../informalLoans/presentation/informalLoanView'
import { words as informalWords } from '../../informalLoans/presentation/words'
import { offerEks } from '../../scenarios/domain/effectiveRate'
import { eksAgreement } from '../../scenarios/domain/eksAgreement'
import type { LoanChange, LoanCosts, LoanScenario, ScenarioChange } from '../../scenarios/domain/loanScenario'
import { offerBase, scenarioPlan } from '../../scenarios/domain/scenarioPlan'
import { refusalText, spanOf } from '../../scenarios/presentation/scenarioComparison'
import { changeSummary } from '../../scenarios/presentation/scenariosView'
import { words as scenarioWords } from '../../scenarios/presentation/words'
import type { BankLoan, InterimInterest, LoanSubsidy } from '../../workbook/domain/bankLoan'
import type { ExpectedPlan } from '../../workbook/domain/informalLoan'
import { BANK_LOAN_RECORDS, EXTRA_PAYMENT_RECORDS, INFORMAL_LOAN_RECORDS, LOAN_SCENARIO_RECORDS, MOVEMENT_RECORDS, RATE_PERIOD_RECORDS, SCENARIO_CHANGE_RECORDS } from '../../workbook/domain/loanKinds'
import type { RatePeriod } from '../../workbook/domain/ratePeriod'
import type { LoanBook } from '../../workbook/domain/readLoanBook'
import { words } from '../words'
import type { ProposalField, ProposalGroup, ProposalLine } from '../../../../shared/app/assistantOperations'
import { proposalGroups } from '../../../../shared/app/proposalGroups'
import type { ProposalDescriber, ProposedRecord } from '../../../../shared/app/proposalGroups'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { formatMoney, formatRate } from '../../../../shared/money/moneyFormat'
import type { Money } from '../../../../shared/money/money'
import type { CheckedWrite } from '../../../../shared/storage/application/recordWrites'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import type { RecordKind } from '../../../../shared/storage/domain/recordKind'

/** The fields Kuna keeps by itself, which no operation sets, so a card leaves them off. */
export const KEPT_BY_KUNA: ReadonlySet<string> = new Set(['id'])

const DAY_FIELDS: ReadonlySet<string> = new Set(['drawdown', 'firstInstalment', 'from', 'date', 'due', 'paid', 'until', 'on'])

/** A field's name on the card. A scenario's start reads as the offer it weighs or the loan it tries something on, and an informal loan's as the day it starts. */
export function proposalFieldName(field: string, record: ProposedRecord): string {
  const start = record['start']
  if (field === 'start' && typeof start === 'object' && start !== null) return (start as LoanScenario['start']).kind === 'offer' ? words.proposals.fields.offer : words.proposals.fields.loan
  return (words.proposals.fields as Readonly<Record<string, string>>)[field] ?? field
}

const rateShown = (rate: YearlyRate): string => formatRate(fractionOf(rate))

function startShown(scenario: LoanScenario, namesOf: ReadonlyMap<unknown, string>): string | null {
  const { start } = scenario
  if (start.kind === 'loan') return namesOf.get(start.loan) ?? null
  const { terms } = start
  return words.proposals.offer(terms.lender, formatMoney(terms.principal), spanOf(terms.instalments), dayLabel(terms.drawdown))
}

/** Whether the record is of the kind, so its fields read with their types. */
function isKind<R>(kind: RecordKind<unknown>, of: RecordKind<R>, record: ProposedRecord): record is ProposedRecord & R {
  return kind.name === of.name && typeof record === 'object'
}

/** The amount a field holds, for a field that holds one. */
function moneyIn(kind: RecordKind<unknown>, field: string, record: ProposedRecord): Money | null {
  if (isKind(kind, BANK_LOAN_RECORDS, record) && field === 'principal') return record.principal
  if (isKind(kind, EXTRA_PAYMENT_RECORDS, record) && field === 'amount') return record.amount
  if (isKind(kind, INFORMAL_LOAN_RECORDS, record) && field === 'openingBalance') return record.openingBalance
  if (isKind(kind, MOVEMENT_RECORDS, record) && field === 'amount') return record.amount
  if (kind.name === SCENARIO_CHANGE_RECORDS.name && field === 'amount') {
    const change = record as unknown as ScenarioChange
    return 'amount' in change ? change.amount : null
  }
  return null
}

/** A value as a person reads it on the Loans screens: money, rates and days in words, a loan or scenario by its name, and each choice as its form names it. */
function shownValue(kind: RecordKind<unknown>, field: string, record: ProposedRecord, namesOf: ReadonlyMap<unknown, string>): string | null {
  const value = record[field]
  if (value === null || value === undefined || value === '') return null
  if (kind.name === LOAN_SCENARIO_RECORDS.name && field === 'start') return startShown(record as unknown as LoanScenario, namesOf)
  if (kind.name === INFORMAL_LOAN_RECORDS.name && field === 'start') return dayLabel(value as CivilDate)
  if (kind.name === INFORMAL_LOAN_RECORDS.name && field === 'direction') return value === 'you-owe' ? informalWords.loanDialog.youOweThem : informalWords.loanDialog.theyOweYou
  if (kind.name === MOVEMENT_RECORDS.name && field === 'kind') return MOVEMENT_KIND_NAMES[value as keyof typeof MOVEMENT_KIND_NAMES]
  if (kind.name === SCENARIO_CHANGE_RECORDS.name && field === 'kind') return scenarioWords.editor.kinds[value as ScenarioChange['kind']]
  const money = moneyIn(kind, field, record)
  if (money !== null) return formatMoney(money)
  if (DAY_FIELDS.has(field)) return dayLabel(value as CivilDate)
  switch (field) {
    case 'rate':
      return rateShown(value as YearlyRate)
    case 'rateType':
      return bankWords.changes.rateTypes[value as 'fixed' | 'variable']
    case 'repayment':
      return bankWords.loanDialog.repayments[value as BankLoan['repayment']]
    case 'effect':
      return bankWords.extraDialog.effects[value as 'shorter-term' | 'lower-instalment'].label
    case 'every':
      return words.proposals.every[value as 'month' | 'year']
    case 'interimInterest': {
      const interim = value as InterimInterest
      return words.proposals.interim(formatMoney(interim.amount), dayLabel(interim.date))
    }
    case 'subsidy': {
      const subsidy = value as LoanSubsidy
      return words.proposals.subsidy(formatMoney(subsidy.monthly), subsidy.firstInstalment, subsidy.firstInstalment + subsidy.instalments - 1, subsidy.payer)
    }
    case 'expected': {
      const expected = value as ExpectedPlan
      return words.proposals.expected(formatMoney(expected.monthly), expected.day, dayLabel(expected.from))
    }
    case 'costs': {
      const costs = value as LoanCosts
      return words.proposals.costs(formatMoney(costs.upfront), formatMoney(costs.monthly), formatMoney(costs.yearly))
    }
    default:
      return namesOf.get(value) ?? String(value)
  }
}

/**
 * What the record is called on screen: a loan or scenario by its name, a scenario's change in the Scenarios screen's sentence,
 * since its Scenario field names the scenario, and what else belongs to one by the name of what it belongs to.
 */
function labelOf(kind: RecordKind<unknown>, record: ProposedRecord, fallback: string, namesOf: ReadonlyMap<unknown, string>): string {
  if (typeof record['name'] === 'string' && record['name'] !== '') return record['name']
  if (kind.name === SCENARIO_CHANGE_RECORDS.name) return changeSummary(record as unknown as ScenarioChange, bankWords.extraDialog.effects)
  return namesOf.get(record['loan']) ?? namesOf.get(record['scenario']) ?? fallback
}

/** Kuna's instalment and the printed one, when the document printed one, and a warning when they disagree. */
interface InstalmentCheck {
  readonly fields: readonly ProposalField[]
  readonly warning: string | null
  readonly differs: boolean
}

const NOT_PRINTED: InstalmentCheck = { fields: [], warning: null, differs: false }

/** Kuna's instalment due from `from` beside the printed one, and a warning when they disagree. A line whose document printed none shows neither. */
function instalmentCheck(rows: readonly PlanRow[], from: CivilDate, printed: Money | null): InstalmentCheck {
  if (printed === null) return NOT_PRINTED
  const planned = instalmentFrom(rows, from)
  const field = (name: string, amount: Money | null): ProposalField[] => (amount === null ? [] : [{ name, before: null, after: formatMoney(amount), warns: false }])
  const agreement = instalmentAgreement(planned, printed)
  return {
    fields: [...field(words.proposals.fields.kunaInstalment, planned), ...field(words.proposals.fields.bankInstalment, printed)],
    warning: agreement.kind === 'differs' ? words.proposals.instalmentDiffers(dayLabel(from), formatMoney(agreement.planned), formatMoney(agreement.printed)) : null,
    differs: agreement.kind === 'differs',
  }
}

/** A line of the card, and whether Kuna's instalment on it differs from the printed one. */
interface CheckedLine {
  readonly line: ProposalLine
  readonly differs: boolean
}

/** The warnings a line gives, as one text, or null for none. */
function warningOf(...warnings: readonly (string | null)[]): string | null {
  const given = warnings.filter((warning): warning is string => warning !== null)
  return given.length === 0 ? null : given.join(' ')
}

/** The line with the instalment check's fields and warning after its own. */
function withInstalment(line: ProposalLine, check: InstalmentCheck, ...warnings: readonly (string | null)[]): CheckedLine {
  return { line: { ...line, fields: [...line.fields, ...check.fields], warning: warningOf(...warnings, check.warning) }, differs: check.differs }
}

/** The EKS lines of an offer the card writes, Kuna's figure and the bank's, with a warning when they disagree or Kuna cannot work the offer out, and its first instalment beside the printed one. */
function offerLine(line: ProposalLine, scenario: LoanScenario, changes: readonly LoanChange[], printedInstalment: Money | null): CheckedLine {
  const { start } = scenario
  if (start.kind !== 'offer') return { line, differs: false }
  const base = offerBase(scenario.name, start.terms)
  const plan = scenarioPlan(base, changes, null)
  if ('refused' in plan) return { line: { ...line, warning: words.proposals.notWorkedOut(refusalText(plan)) }, differs: false }
  const estimated = offerEks(base, changes)
  const printed = start.terms.bankEks
  const field = (name: string, rate: YearlyRate | null): ProposalField[] => (rate === null ? [] : [{ name, before: null, after: rateShown(rate), warns: false }])
  const agreement = eksAgreement(estimated, printed)
  const eks = { ...line, fields: [...line.fields, ...field(words.proposals.fields.kunaEks, estimated), ...field(words.proposals.fields.bankEks, printed)] }
  const eksWarning = agreement.kind === 'differs' ? words.proposals.eksDiffers(rateShown(agreement.estimated), rateShown(agreement.printed)) : line.warning
  return withInstalment(eks, instalmentCheck(plan.rows, base.loan.firstInstalment, printedInstalment), eksWarning)
}

/** The records of the kind as the file will hold them once the card is written. */
function heldAfter<R extends { readonly id: RecordId }>(facts: readonly R[], kind: RecordKind<R>, checked: CheckedWrite): R[] {
  const held = new Map(facts.map((record) => [record.id, record]))
  for (const { change } of checked.changes) {
    if (change.kind.name !== kind.name) continue
    if (change.verb === 'add' || change.verb === 'change' || change.verb === 'repair') held.set((change.after as R).id, change.after as R)
    if (change.verb === 'remove') held.delete((change.before as R).id)
  }
  return [...held.values()]
}

/** What a card shows, and how many of its lines have an instalment that differs from the printed one. */
export interface LoansCard {
  readonly groups: readonly ProposalGroup[]
  readonly instalmentsDiffering: number
}

/**
 * What a checked write does, grouped by verb and kind in the order it does it, in Kuna's words and never the model's. Each offer the card writes
 * says how Kuna's EKS stands against the printed one. Each loan, rate period or offer `printed` names by its id sets Kuna's instalment beside the printed one:
 * a loan's or offer's first, and a rate period's first at its rate, each worked out from the file as the card leaves it.
 */
export function loansCardOf(checked: CheckedWrite, book: LoanBook, printed: ReadonlyMap<string, Money>): LoansCard {
  const named = [...book.readings.bankLoans.facts, ...book.readings.informalLoans.facts, ...book.readings.loanScenarios.facts]
  const namesOf = new Map<unknown, string>(named.map((record) => [record.id, record.name]))
  for (const { change } of checked.changes) {
    if ((change.verb === 'add' || change.verb === 'change') && [BANK_LOAN_RECORDS.name, INFORMAL_LOAN_RECORDS.name, LOAN_SCENARIO_RECORDS.name].includes(change.kind.name)) {
      const record = change.after as ProposedRecord
      namesOf.set(record['id'], record['name'] as string)
    }
  }
  const loans = heldAfter(book.readings.bankLoans.facts, BANK_LOAN_RECORDS, checked)
  const periods = heldAfter(book.readings.ratePeriods.facts, RATE_PERIOD_RECORDS, checked)
  const extraPayments = heldAfter(book.readings.extraPayments.facts, EXTRA_PAYMENT_RECORDS, checked)
  const scenarioChanges = heldAfter(book.readings.scenarioChanges.facts, SCENARIO_CHANGE_RECORDS, checked)
  const planOf = (loan: BankLoan): readonly PlanRow[] => {
    const own = periods.filter((period) => period.loan === loan.id)
    if (!own.some((period) => period.from === loan.firstInstalment)) return []
    return loanPlan(
      loan,
      own,
      extraPayments.filter((payment) => payment.loan === loan.id),
    )
  }
  const loanOf = (id: RecordId): BankLoan | null => loans.find((loan) => loan.id === id) ?? null
  const checkedLine = (kind: RecordKind<unknown>, record: ProposedRecord, line: ProposalLine): CheckedLine => {
    const instalment = printed.get(record['id'] as string) ?? null
    if (isKind(kind, LOAN_SCENARIO_RECORDS, record))
      return offerLine(
        line,
        record,
        scenarioChanges.filter((change) => change.scenario === record.id),
        instalment,
      )
    if (instalment === null) return { line, differs: false }
    if (isKind(kind, BANK_LOAN_RECORDS, record)) return withInstalment(line, instalmentCheck(planOf(record), record.firstInstalment, instalment), line.warning)
    const loan = isKind(kind, RATE_PERIOD_RECORDS, record) ? loanOf(record.loan) : null
    if (loan === null) return { line, differs: false }
    return withInstalment(line, instalmentCheck(planOf(loan), (record as unknown as RatePeriod).from, instalment), line.warning)
  }
  let instalmentsDiffering = 0
  const describer: ProposalDescriber = {
    keptByKuna: KEPT_BY_KUNA,
    fieldName: proposalFieldName,
    shown: (kind, field, record) => shownValue(kind, field, record, namesOf),
    label: (kind, record, fallback) => labelOf(kind, record, fallback, namesOf),
    warns: () => false,
    checked: (kind, record, line) => {
      const checkedOne = checkedLine(kind, record, line)
      if (checkedOne.differs) instalmentsDiffering += 1
      return checkedOne.line
    },
  }
  return { groups: proposalGroups(checked, () => describer), instalmentsDiffering }
}
