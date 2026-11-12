import type { PackDescriber } from '../../../../assistant/companyAssistant'
import { words as cardWords } from '../../../../../../shared/app/words'
import { ownerShareText } from '../../../../owner-share/domain/ownerShare'
import { displayNamesOf } from '../../../../workbook/domain/displayName'
import type { Workbook } from '../../../../workbook/domain/workbook'
import { moneyFormatOf } from '../../../../settings/domain/settings'
import { NEW_ASSET_DEFAULTS } from '../../domain/assets/assets'
import type { GrantClawback, GrantParts } from '../../domain/grants/grants'
import { ASSET_RECORDS, EMPLOYEE_RECORDS, GRANT_RECORDS, OWNER_ADVANCE_RECORDS, PLAN_RECORDS, SCENARIO_RECORDS, YEAR_END_RECORDS } from '../../domain/hrDooKinds'
import type { ScenarioComponent } from '../../domain/scenarios/ownerPayScenarios'
import { componentInWords } from '../../domain/scenarios/scenarioGuards'
import { scenarioName } from '../../domain/scenarios/startingScenarios'
import type { YearEndFigure } from '../../domain/yearEnd/yearEnd'
import { words as forecastWords } from '../../presentation/forecast/words'
import { words as packWords } from '../../presentation/words'
import { words } from '../words'
import { TRIP_KINDS, tripFieldsInLabel, tripLabel, tripShownValue } from './tripProposalLines'
import type { ProposedRecord } from '../../../../../../shared/app/proposalGroups'
import { dayLabel } from '../../../../../../shared/calendar/dayLabel'
import type { CivilDate } from '../../../../../../shared/calendar/civilDate'
import { monthKey } from '../../../../../../shared/calendar/monthKey'
import { monthName } from '../../../../../../shared/calendar/monthLabel'
import type { Money } from '../../../../../../shared/money/money'
import { formatMoney } from '../../../../../../shared/money/moneyFormat'
import type { MoneyFormat } from '../../../../../../shared/money/moneyFormat'
import { writtenPercent } from '../../../../../../shared/money/percent'
import type { DateRange } from '../../../../../../shared/calendar/dateRange'
import type { RecordKind } from '../../../../../../shared/storage/domain/recordKind'

/** The fields Kuna keeps by itself on the pack's records, which no operation sets. A plan row's kind and a scenario row's key show through other fields, so the card reads them as nothing. */
const KEPT_BY_KUNA: ReadonlySet<string> = new Set(['id', 'ownerPart'])
const SHOWN_ELSEWHERE: ReadonlyMap<string, string> = new Map([
  [PLAN_RECORDS.name, 'kind'],
  [SCENARIO_RECORDS.name, 'key'],
])

/** Whether the record is of the kind, so its fields read with their types. */
function isKind<R>(kind: RecordKind<unknown>, of: RecordKind<R>, record: ProposedRecord): record is ProposedRecord & R {
  return kind.name === of.name && typeof record === 'object'
}

/** The amount a field holds, on the kinds whose field holds money. */
function moneyIn(kind: RecordKind<unknown>, field: string, record: ProposedRecord): Money | null {
  if (field === 'amount' && (isKind(kind, OWNER_ADVANCE_RECORDS, record) || isKind(kind, GRANT_RECORDS, record))) return record.amount
  if (field === 'amount' && isKind(kind, PLAN_RECORDS, record)) return record.kind === 'owner-pay-scenario' ? null : record.amount
  if (field === 'costNet' && isKind(kind, ASSET_RECORDS, record)) return record.costNet
  if (field === 'agreedGross' && isKind(kind, EMPLOYEE_RECORDS, record)) return record.agreedGross
  return null
}
const DAY_FIELDS: ReadonlySet<string> = new Set(['date', 'from', 'to', 'bought', 'inUse', 'disposed', 'received', 'employmentRequiredUntil'])

function clawbackText(clawback: GrantClawback, format: MoneyFormat): string {
  return clawback === 'whole' ? words.proposals.whole : formatMoney(clawback, 'negative', format)
}

function figureText(figure: YearEndFigure, format: MoneyFormat): string {
  switch (figure.kind) {
    case 'money':
      return formatMoney(figure.amount, 'negative', format)
    case 'date':
      return dayLabel(figure.date)
    case 'rate':
      return `${writtenPercent(figure.basisPoints)}%`
    case 'count':
      return String(figure.count)
  }
}

/** What a plan row plans, as the Plan tab names it. */
function planItemText(record: ProposedRecord, category: (slug: string) => string): string {
  if (record['kind'] === 'owner-pay-scenario') return words.proposals.ownerPay
  if (record['kind'] === 'purchase') return String(record['note'])
  return record['item'] === 'dividend' ? words.proposals.dividend : category(String(record['item']))
}

/**
 * A value as the pack's screens show it: money in the company's currency, days and months in words, a plan row without a month as every month, a category by its
 * name, a scenario part, a grant's parts and period and a year-end figure in words, and a list as one line.
 */
function shownValue(kind: RecordKind<unknown>, field: string, record: ProposedRecord, format: MoneyFormat, category: (slug: string) => string): string | null {
  const value = record[field]
  if (kind.name === PLAN_RECORDS.name && field === 'month' && value === null && record['kind'] === 'amount') return words.proposals.everyMonth
  if (value === null || value === undefined || value === '' || SHOWN_ELSEWHERE.get(kind.name) === field) return null
  if (field === 'categories' && Array.isArray(value)) return value.length === 0 ? null : value.map((slug) => category(String(slug))).join(', ')
  if (Array.isArray(value)) return value.length === 0 ? null : value.join(', ')
  if (typeof value === 'boolean') return value ? cardWords.yes : cardWords.no
  const money = moneyIn(kind, field, record)
  if (money !== null) return formatMoney(money, 'negative', format)
  if (DAY_FIELDS.has(field) && typeof value === 'string') return dayLabel(value as CivilDate)
  if (field === 'category') return category(String(value))
  if (field === 'ownerShare' && isKind(kind, OWNER_ADVANCE_RECORDS, record)) return ownerShareText(record.ownerShare)
  if (field === 'month' && typeof value === 'number' && typeof record['year'] === 'number') return monthName(monthKey(record['year'], value))
  if (kind.name === PLAN_RECORDS.name && field === 'item') return planItemText(record, category)
  if (field === 'group') return forecastWords.groups[value as keyof typeof forecastWords.groups] ?? String(value)
  if (field === 'component') return componentInWords(value as ScenarioComponent)
  if (field === 'figure') return figureText(value as YearEndFigure, format)
  if (field === 'parts') {
    const parts = value as GrantParts
    return words.proposals.parts(formatMoney(parts.fixed, 'negative', format), formatMoney(parts.variable, 'negative', format))
  }
  if (field === 'period') {
    const period = value as DateRange
    return words.proposals.period(dayLabel(period.from), dayLabel(period.to))
  }
  if (field === 'release') return packWords.grantColumns.releases[value as keyof typeof packWords.grantColumns.releases] ?? String(value)
  if (field === 'clawbackFirstYear' || field === 'clawbackSecondYear') return clawbackText(value as GrantClawback, format)
  if (field === 'statement') return packWords.yearEndColumns.statements[value as keyof typeof packWords.yearEndColumns.statements] ?? String(value)
  return String(value)
}

/** What a record of the pack is called on its screen. */
function labelOf(kind: RecordKind<unknown>, record: ProposedRecord, fallback: string, category: (slug: string) => string): string {
  const text = (field: string): string => (typeof record[field] === 'string' ? (record[field] as string) : '')
  switch (kind.name) {
    case OWNER_ADVANCE_RECORDS.name:
      return text('description') || category(text('category'))
    case PLAN_RECORDS.name:
      return `${planItemText(record, category)}, ${String(record['year'])}`
    case SCENARIO_RECORDS.name:
      return scenarioName({ slug: text('slug'), label: text('label') })
    case YEAR_END_RECORDS.name:
      return text('label') || text('line')
    case ASSET_RECORDS.name:
      return text('name')
    case GRANT_RECORDS.name:
      return text('slug')
    case EMPLOYEE_RECORDS.name:
      return text('name') || text('slug')
    default:
      return fallback
  }
}

/** What a new asset holds unless a person sets it, which a card leaves off its add. */
export function defaultsOnAdd(kind: RecordKind<unknown>): ProposedRecord {
  return kind.name === ASSET_RECORDS.name ? NEW_ASSET_DEFAULTS : {}
}

/** The bank row an asset is linked to, by its day, its other side and its amount, or nothing for an asset linked to none. */
function paymentText(workbook: Workbook, rowId: string | null, format: MoneyFormat): string | null {
  const row = rowId === null ? undefined : workbook.transactions.find((candidate) => candidate.rowId === rowId)
  if (row === undefined) return rowId
  return [dayLabel(row.date), row.counterparty || row.description, formatMoney(row.amount, 'negative', format)].filter((part) => part !== '').join(', ')
}

/** A plan row's label names its item and year, so an add or a removal leaves both off its line. */
const PLAN_IN_LABEL: ReadonlySet<string> = new Set(['year', 'item'])

/** The fields a record's label names on the card, which an add or a removal leaves off its line. */
export function packFieldsInLabel(kind: RecordKind<unknown>): ReadonlySet<string> {
  return tripFieldsInLabel(kind) ?? (kind.name === PLAN_RECORDS.name ? PLAN_IN_LABEL : new Set())
}

/** How a card reads the pack's records, in the words of its screens. An employee's accounts say where pay goes, so the card warns on them. */
export function packDescriber(workbook: Workbook): PackDescriber {
  const format = moneyFormatOf(workbook.settings)
  const names = displayNamesOf(workbook)
  const category = (slug: string): string => names.category(slug)
  return {
    kinds: new Set([OWNER_ADVANCE_RECORDS, PLAN_RECORDS, SCENARIO_RECORDS, YEAR_END_RECORDS, ASSET_RECORDS, GRANT_RECORDS, EMPLOYEE_RECORDS, ...TRIP_KINDS].map((kind) => kind.name)),
    keptByKuna: KEPT_BY_KUNA,
    fieldName: (field) => (words.proposals.fields as Readonly<Record<string, string>>)[field] ?? field,
    shown: (kind, field, record) => {
      if (isKind(kind, ASSET_RECORDS, record) && field === 'rowId') return paymentText(workbook, record.rowId, format)
      const trip = tripShownValue(kind, field, record, format, workbook)
      return trip === undefined ? shownValue(kind, field, record, format, category) : trip
    },
    label: (kind, record, fallback) => tripLabel(kind, record, fallback, workbook) ?? labelOf(kind, record, fallback, category),
    defaultsOf: defaultsOnAdd,
    inLabel: packFieldsInLabel,
    warns: (kind, field) => kind.name === EMPLOYEE_RECORDS.name && field === 'ibans',
    settingNames: {
      hr_company_registered: packWords.facts.registered,
      hr_cit_return: packWords.facts.citReturn,
      hr_vat_principle: packWords.facts.vatPrinciple,
      hr_depreciation_doubled: packWords.facts.doubled,
      hr_owner_loan_interest: packWords.facts.loanInterest,
    },
  }
}
