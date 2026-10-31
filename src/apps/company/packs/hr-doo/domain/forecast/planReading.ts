import { SHARED_ID_REASON, idSharing, problemOf, refusedProblems } from '../../../../../../shared/storage/domain/recordsRead'
import type { ReadRecord, Reading, RecordProblem, RecordsRead } from '../../../../../../shared/storage/domain/recordsRead'
import { yearOf } from '../../../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../../../shared/calendar/civilDate'
import { monthNumber, monthOf } from '../../../../../../shared/calendar/monthKey'
import { ASSET_GROUPS } from '../assets/assets'
import { PLAN_KEYWORDS } from './plan'
import type { PlanLine } from './plan'
import { labelWords, labelled, numberText, withIdField } from '../../../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../../../shared/storage/domain/recordCodec'
import { amountText, filledFields } from '../../../../../../shared/storage/domain/recordFields'
import type { FieldValue } from '../../../../../../shared/storage/domain/recordFields'
import type { RecordId } from '../../../../../../shared/storage/domain/recordId'
import { sharedKeys } from '../../../../../../shared/storage/domain/sharedKeys'
import { optionalDate, ownId, positiveMoney, refuse, requiredChoice, requiredMoney, requiredYear, slugOf, textOf, wholeNumberOf } from '../../../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../../../shared/storage/domain/storedFields'
import { PLAN_RECORDS } from '../hrDooKinds'
import { words } from './words'

/**
 * One plan line. An `owner_pay_scenario` line holds from its date and names its scenario in
 * `amount`, a purchase takes its month from its date, and a dividend needs its month. Planned
 * revenue lives on the `outgoing-plan` tab, so a `revenue` line is refused with a reason that says
 * to move it there.
 */
export function planLineOf(fields: StoredFields, id: RecordId | null): PlanLine {
  const year = requiredYear(fields, 'year')
  const month = fields.month === undefined ? null : wholeNumberOf(fields.month)
  if (fields.month !== undefined && (month === null || month < 1 || month > 12)) refuse(words.reading.notAMonth(fields.month.text))
  const note = textOf(fields.note)
  const item = slugOf(fields.item)
  if (item === '') refuse(words.reading.noItem)
  if (item === 'revenue') refuse(words.reading.revenueElsewhere)
  if (item === 'owner_pay_scenario') {
    if (month !== null) refuse(words.reading.scenarioHasNoMonth)
    const scenario = slugOf(fields.amount)
    if (scenario === '') refuse(words.reading.noScenario)
    const from = optionalDate(fields, 'date')
    return { year, month: null, note, id: ownId(id), kind: 'owner-pay-scenario', scenario, from: from === null ? null : inYear(from, year) }
  }
  if (item === 'purchase') {
    const date = inYear(optionalDate(fields, 'date') ?? refuse(words.reading.purchaseNeedsDate), year)
    const dateMonth = monthNumber(monthOf(date))
    if (month !== null && month !== dateMonth) refuse(words.reading.notTheMonthOf(month, date))
    const amount = positiveMoney(fields, 'amount')
    const group = requiredChoice(fields, 'group', ASSET_GROUPS, 'asset group')
    return { year, month: dateMonth, note, id: ownId(id), kind: 'purchase', date, amount, group }
  }
  if (item === 'dividend') {
    if (month === null) refuse(words.reading.dividendNeedsMonth)
    const amount = positiveMoney(fields, 'amount')
    return { year, month, note, id: ownId(id), kind: 'amount', item, amount }
  }
  const amount = requiredMoney(fields, 'amount')
  return { year, month, note, id: ownId(id), kind: 'amount', item, amount }
}

/** A plan line's item, amount, date and group fields, by its kind. */
function planLineFields(line: PlanLine): Readonly<Record<string, FieldValue | null>> {
  switch (line.kind) {
    case 'amount':
      return { item: line.item, amount: amountText(line.amount) }
    case 'purchase':
      return { item: 'purchase', amount: amountText(line.amount), date: line.date, group: line.group }
    case 'owner-pay-scenario':
      return { item: 'owner_pay_scenario', amount: line.scenario, date: line.from }
  }
}

export const PLAN_CODEC: RecordCodec<PlanLine> = withIdField(
  PLAN_RECORDS,
  (fields) => labelWords([textOf(fields.item), textOf(fields.year), labelled('month', textOf(fields.month)), numberText(fields.amount)]),
  planLineOf,
  // A purchase takes its month from its date, so its month is kept blank.
  (line) => filledFields({ year: String(line.year), month: line.kind === 'purchase' || line.month === null ? null : String(line.month), ...planLineFields(line), note: line.note }),
)

function inYear(day: CivilDate, year: number): CivilDate {
  return yearOf(day) === year ? day : refuse(words.reading.notInYear(day, year))
}

/**
 * The plan. A category or dividend line is listed once per year and month, and an
 * `owner_pay_scenario` line once per year and starting day, or every record of the key is left out.
 * A purchase may repeat, since two purchases can share a day. An item must be a keyword or a
 * category on the categories tab, and an `owner_pay_scenario` line must name a scenario on the
 * scenarios tab, or the line is left out. Rules across lines, such as one dividend a year, are the
 * plan guards'.
 */
export function readPlan(read: RecordsRead<PlanLine>, categorySlugs: ReadonlySet<string>, scenarioSlugs: ReadonlySet<string>): Reading<PlanLine> {
  const sharesId = idSharing(read)
  const problems: RecordProblem[] = refusedProblems(read)
  const keyed: { readonly stored: ReadRecord<PlanLine>; readonly key: { readonly text: string; readonly words: string } | null }[] = []
  for (const stored of read.records) {
    const line = stored.record
    const unknown = unknownReference(line, categorySlugs, scenarioSlugs)
    if (unknown !== null) {
      problems.push(problemOf(stored, unknown))
    } else if (sharesId(stored)) {
      problems.push(problemOf(stored, SHARED_ID_REASON))
    } else {
      keyed.push({ stored, key: keyOf(line) })
    }
  }
  const twice = sharedKeys(
    keyed.flatMap(({ key }) => (key === null ? [] : [key.text])),
    (text) => text,
  )
  for (const { stored, key } of keyed) {
    if (key !== null && twice.has(key.text)) {
      problems.push(problemOf(stored, words.reading.listedTwice(key.words)))
    }
  }
  return { facts: keyed.filter(({ key }) => key === null || !twice.has(key.text)).map(({ stored }) => stored.record), problems }
}

/** Why a line names what the workbook lacks: a scenario the scenarios tab does not hold, or an item that is neither a keyword nor a category. */
function unknownReference(line: PlanLine, categorySlugs: ReadonlySet<string>, scenarioSlugs: ReadonlySet<string>): string | null {
  switch (line.kind) {
    case 'owner-pay-scenario':
      return scenarioSlugs.has(line.scenario) ? null : words.reading.notAScenario(line.scenario)
    case 'amount':
      return (PLAN_KEYWORDS as readonly string[]).includes(line.item) || categorySlugs.has(line.item) ? null : words.reading.notAnItem(line.item, PLAN_KEYWORDS)
    case 'purchase':
      return null
  }
}

function keyOf(line: PlanLine): { readonly text: string; readonly words: string } | null {
  switch (line.kind) {
    case 'purchase':
      return null
    case 'owner-pay-scenario':
      return { text: `${line.year} owner_pay_scenario ${line.from ?? 'start'}`, words: words.reading.scenarioFrom(line.from, line.year) }
    case 'amount':
      return { text: `${line.year} ${line.month ?? 'every'} ${line.item}`, words: words.reading.itemFor(line.item, line.month, line.year) }
  }
}
