import { words as bankWords } from '../../bankLoans/presentation/words'
import { firstInstalmentOf, instalmentAgreement } from '../../bankLoans/domain/instalmentAgreement'
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

/** Kuna's first instalment and the printed one, when the document printed one, and a warning when they disagree. */
function instalmentLines(rows: readonly PlanRow[], printed: Money | null): { readonly fields: ProposalField[]; readonly warning: string | null; readonly differs: boolean } {
  const planned = firstInstalmentOf(rows)
  const field = (name: string, amount: Money | null): ProposalField[] => (amount === null ? [] : [{ name, before: null, after: formatMoney(amount), warns: false }])
  const agreement = instalmentAgreement(planned, printed)
  return {
    fields: [...field(words.proposals.fields.kunaInstalment, planned), ...field(words.proposals.fields.bankInstalment, printed)],
    warning: agreement.kind === 'differs' ? words.proposals.instalmentDiffers(formatMoney(agreement.planned), formatMoney(agreement.printed)) : null,
    differs: agreement.kind === 'differs',
  }
}

/** A line of the card, and whether Kuna's first instalment on it differs from the printed one. */
interface CheckedLine {
  readonly line: ProposalLine
  readonly differs: boolean
}

/** The warnings a line gives, as one text, or null for none. */
function warningOf(...warnings: readonly (string | null)[]): string | null {
  const given = warnings.filter((warning): warning is string => warning !== null)
  return given.length === 0 ? null : given.join(' ')
}

/**
 * The EKS lines of an offer the card writes, Kuna's figure and the bank's, and a warning when they disagree or Kuna cannot work the offer out.
 * A new offer also shows its first instalment beside `printedInstalment`, which `adding` says.
 */
function offerLine(line: ProposalLine, scenario: LoanScenario, changes: readonly LoanChange[], adding: boolean, printedInstalment: Money | null): CheckedLine {
  const { start } = scenario
  if (start.kind !== 'offer') return { line, differs: false }
  const base = offerBase(scenario.name, start.terms)
  const plan = scenarioPlan(base, changes, null)
  if ('refused' in plan) return { line: { ...line, warning: words.proposals.notWorkedOut(refusalText(plan)) }, differs: false }
  const estimated = offerEks(base, changes)
  const printed = start.terms.bankEks
  const field = (name: string, rate: YearlyRate | null): ProposalField[] => (rate === null ? [] : [{ name, before: null, after: rateShown(rate), warns: false }])
  const agreement = eksAgreement(estimated, printed)
  const instalment = adding ? instalmentLines(plan.rows, printedInstalment) : { fields: [], warning: null, differs: false }
  return {
    line: {
      ...line,
      fields: [...line.fields, ...field(words.proposals.fields.kunaEks, estimated), ...field(words.proposals.fields.bankEks, printed), ...instalment.fields],
      warning: warningOf(agreement.kind === 'differs' ? words.proposals.eksDiffers(rateShown(agreement.estimated), rateShown(agreement.printed)) : line.warning, instalment.warning),
    },
    differs: instalment.differs,
  }
}

/** The first instalment lines of a bank loan the card adds, worked out from its first rate period on the same card. */
function bankLoanLine(line: ProposalLine, loan: BankLoan, periods: readonly RatePeriod[], printedInstalment: Money | null): CheckedLine {
  const own = periods.filter((period) => period.loan === loan.id)
  if (!own.some((period) => period.from === loan.firstInstalment)) return { line, differs: false }
  const instalment = instalmentLines(loanPlan(loan, own, []), printedInstalment)
  return { line: { ...line, fields: [...line.fields, ...instalment.fields], warning: warningOf(line.warning, instalment.warning) }, differs: instalment.differs }
}

/** What the card shows, and how many of its new loans and offers have a first instalment that differs from the printed one. */
export interface LoansCard {
  readonly groups: readonly ProposalGroup[]
  readonly instalmentsDiffering: number
}

/**
 * What a checked write does, grouped by verb and kind in the order it does it, in Kuna's words and never the model's. Each offer the card writes
 * says how Kuna's EKS stands against the printed one, and each new loan or offer how its first instalment stands against `printed`, by its id.
 */
export function loansCardOf(checked: CheckedWrite, book: LoanBook, printed: ReadonlyMap<string, Money>): LoansCard {
  const named = [...book.readings.bankLoans.facts, ...book.readings.informalLoans.facts, ...book.readings.loanScenarios.facts]
  const namesOf = new Map<unknown, string>(named.map((record) => [record.id, record.name]))
  const written = checked.changes.flatMap(({ change }) =>
    change.verb === 'add' || change.verb === 'change' ? [{ verb: change.verb, kind: change.kind.name, record: change.after as ProposedRecord }] : [],
  )
  for (const { kind, record } of written) {
    if ([BANK_LOAN_RECORDS.name, INFORMAL_LOAN_RECORDS.name, LOAN_SCENARIO_RECORDS.name].includes(kind)) namesOf.set(record['id'], record['name'] as string)
  }
  const describer: ProposalDescriber = {
    keptByKuna: KEPT_BY_KUNA,
    fieldName: proposalFieldName,
    shown: (kind, field, record) => shownValue(kind, field, record, namesOf),
    label: (kind, record, fallback) => labelOf(kind, record, fallback, namesOf),
    warns: () => false,
  }
  const groups = proposalGroups(checked, () => describer)
  const addedChanges = written.flatMap(({ verb, kind, record }) => (verb === 'add' && kind === SCENARIO_CHANGE_RECORDS.name ? [record as unknown as ScenarioChange] : []))
  const recordsOf = <R>(verb: string, kind: RecordKind<R>): R[] => written.flatMap((entry) => (entry.verb === verb && entry.kind === kind.name ? [entry.record as unknown as R] : []))
  const addedPeriods = recordsOf('add', RATE_PERIOD_RECORDS)
  let instalmentsDiffering = 0
  const shown = (checkedLine: CheckedLine): ProposalLine => {
    if (checkedLine.differs) instalmentsDiffering += 1
    return checkedLine.line
  }
  const loans = recordsOf('add', BANK_LOAN_RECORDS)
  const cardGroups = groups.map((group) => {
    if (group.verb === 'add' && group.noun === BANK_LOAN_RECORDS.noun) {
      return { ...group, lines: group.lines.map((line, at) => (loans[at] === undefined ? line : shown(bankLoanLine(line, loans[at], addedPeriods, printed.get(loans[at].id) ?? null)))) }
    }
    if (group.noun !== LOAN_SCENARIO_RECORDS.noun || group.verb === 'remove') return group
    const scenarios = recordsOf(group.verb, LOAN_SCENARIO_RECORDS)
    return {
      ...group,
      lines: group.lines.map((line, at) => {
        const scenario = scenarios[at]
        return scenario === undefined
          ? line
          : shown(
              offerLine(
                line,
                scenario,
                addedChanges.filter((change) => change.scenario === scenario.id),
                group.verb === 'add',
                printed.get(scenario.id) ?? null,
              ),
            )
      }),
    }
  })
  return { groups: cardGroups, instalmentsDiffering }
}
