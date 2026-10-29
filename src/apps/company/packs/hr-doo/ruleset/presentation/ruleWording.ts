import type { RouteLocationRaw } from 'vue-router'

import type { CivilDate } from '../../../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../../../shared/calendar/dayLabel'
import { fold } from '../../../../../../shared/text/fold'
import { ACTS } from '../acts'
import { versionOn } from '../ruleset'
import type { RuleId } from '../ruleset'
import type { AppliesBy, Confidence, GeneralRule, LegalSource, OpenItem, RuleArea, RuleTerms, RuleVersion, ScalarTerm, TableTerm, Term } from '../schema'

/** Where a figure links to show the rule it rests on. */
export function ruleLink(ruleId: RuleId): RouteLocationRaw {
  return { path: '/company/settings', query: { tab: 'ruleset', rule: ruleId } }
}

export const AREA_WORDING: Readonly<Record<RuleArea, { readonly label: string; readonly description: string }>> = {
  'profit-tax': { label: 'Profit tax', description: 'Corporate income tax: the PD return, its base, rate, add-backs, advances and deadlines.' },
  'owner-pay': { label: 'Owner pay', description: 'Salary, contributions, income tax, tax-free payments and dividends.' },
  accounting: { label: 'Accounting', description: 'Size class, statements, recognition and the asset and grant policies.' },
  vat: { label: 'VAT', description: 'Registration, rates, place of supply, deductions, periods and refunds.' },
  'company-law': { label: 'Company law', description: 'Share capital, reserves, profit payouts and the decisions they need.' },
}

export interface ConfidenceWording {
  readonly label: string
  readonly meaning: string
  readonly color: 'neutral' | 'info' | 'warning' | 'error'
  readonly variant: 'outline' | 'subtle'
  readonly icon: string
}

/** Confirmed values stay quiet. Estimates, pending and unconfirmed values carry a status colour, since they are the ones to recheck. */
export const CONFIDENCE_WORDING: Readonly<Record<Confidence, ConfidenceWording>> = {
  'confirmed-nn': {
    label: 'Confirmed in NN',
    meaning: 'Read in the text published in Narodne novine.',
    color: 'neutral',
    variant: 'outline',
    icon: 'i-lucide-badge-check',
  },
  'confirmed-consolidated': {
    label: 'Confirmed, consolidated text',
    meaning: 'Read in the consolidated text on zakon.hr, with its list of amendments checked.',
    color: 'neutral',
    variant: 'outline',
    icon: 'i-lucide-badge-check',
  },
  'confirmed-table': {
    label: 'Confirmed, official table',
    meaning: 'Read in a table the tax administration compiles from the decisions published in Narodne novine.',
    color: 'neutral',
    variant: 'outline',
    icon: 'i-lucide-badge-check',
  },
  reading: {
    label: 'Our reading',
    meaning: 'The text was read. How it applies to the company is an interpretation to discuss with the accountant.',
    color: 'info',
    variant: 'subtle',
    icon: 'i-lucide-book-open-text',
  },
  practice: {
    label: "Accountant's practice",
    meaning: "The accountant's own figures apply it and match to the cent.",
    color: 'info',
    variant: 'subtle',
    icon: 'i-lucide-calculator',
  },
  estimate: {
    label: 'Estimate',
    meaning: 'Worked out before the official figure is published. It changes once the figure is out.',
    color: 'warning',
    variant: 'subtle',
    icon: 'i-lucide-hourglass',
  },
  pending: {
    label: 'Pending',
    meaning: 'Set by a bill or a draft that is not law yet.',
    color: 'warning',
    variant: 'subtle',
    icon: 'i-lucide-clock',
  },
  unconfirmed: {
    label: 'Unconfirmed',
    meaning: 'The text was not loaded or not confirmed. The pack never uses it as a fact.',
    color: 'error',
    variant: 'subtle',
    icon: 'i-lucide-circle-help',
  },
}

export const CONFIDENCE_ORDER: readonly Confidence[] = ['confirmed-nn', 'confirmed-consolidated', 'confirmed-table', 'reading', 'practice', 'estimate', 'pending', 'unconfirmed']

const APPLIES_BY_WORDING: Readonly<Record<AppliesBy, string>> = {
  'tax-period': "The tax period's first day picks the version",
  'month-worked': 'The first day of the month worked picks the version',
  'payment-date': 'The payment date picks the version',
  'supply-date': 'The supply date picks the version',
  'event-date': 'The date of the event picks the version',
}

export function appliesByWording(appliesBy: AppliesBy): string {
  return APPLIES_BY_WORDING[appliesBy]
}

/** A version's dates in years where they line up with whole years: "2025", "2025 and 2026", "2027 onward", else "1 Mar 2025 to 31 Dec 2026". */
export function periodLabel(validFrom: CivilDate, validTo: CivilDate | null): string {
  const fromYear = Number(validFrom.slice(0, 4))
  const startsYear = validFrom.endsWith('-01-01')
  if (validTo === null) {
    return startsYear ? `${fromYear} onward` : `${dayLabel(validFrom)} onward`
  }
  const toYear = Number(validTo.slice(0, 4))
  if (startsYear && validTo.endsWith('-12-31')) {
    if (fromYear === toYear) return String(fromYear)
    return toYear === fromYear + 1 ? `${fromYear} and ${toYear}` : `${fromYear} to ${toYear}`
  }
  return `${dayLabel(validFrom)} to ${dayLabel(validTo)}`
}

const ACRONYMS: Readonly<Record<string, string>> = {
  vat: 'VAT',
  eu: 'EU',
  joppd: 'JOPPD',
  b2b: 'B2B',
  pd: 'PD',
  hnb: 'HNB',
  nn: 'NN',
  ecb: 'ECB',
}

/** `limitPerItemWithoutVat` reads "Limit per item without VAT". */
export function termLabel(key: string): string {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(' ')
    .map((word) => ACRONYMS[word.toLowerCase()] ?? word.toLowerCase())
  const sentence = words.join(' ').replace(/\be invoiced\b/, 'e-invoiced')
  return sentence.charAt(0).toUpperCase() + sentence.slice(1)
}

/** A coefficient is stored in basis points like a rate, but the law writes it as a factor such as 0.65. */
function isCoefficient(key: string): boolean {
  return /coefficient/i.test(key)
}

export interface TermFormat {
  readonly percent: Intl.NumberFormat
  readonly factor: Intl.NumberFormat
  readonly euros: Intl.NumberFormat
}

/**
 * Rates in the law go to two decimals, such as 4.38%, which the app's one-decimal share format would round away.
 * Amounts in Croatian law are in euros whatever currency the workbook keeps.
 */
export function termFormat(locale: string): TermFormat {
  return {
    percent: new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 2 }),
    factor: new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 4 }),
    euros: new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }),
  }
}

/** A key the law names, such as `last-day-of-following-month`, reads as words. A code or a name such as `PD-IPO` or `Grad Zagreb` stays as written. */
function textWording(wording: string): string {
  return /^[a-z0-9-]+$/.test(wording) && /[a-z]/.test(wording) ? wording.replace(/-/g, ' ') : wording
}

export function scalarWording(key: string, term: ScalarTerm, format: TermFormat): string {
  switch (term.kind) {
    case 'rate':
      return isCoefficient(key) ? format.factor.format(term.basisPoints / 10_000) : format.percent.format(term.basisPoints / 10_000)
    case 'money':
      return format.euros.format(term.cents / 100)
    case 'count':
      return String(term.count)
    case 'flag':
      return term.holds ? 'Yes' : 'No'
    case 'text':
      return textWording(term.text)
  }
}

export interface ValueColumn {
  readonly period: string
  readonly confidence: Confidence
}

export interface ValueCell {
  readonly wording: string
  /** Differs from the version before, so the eye finds what a new year changed. */
  readonly changed: boolean
}

export interface ValueRow {
  readonly key: string
  readonly label: string
  readonly cells: readonly ValueCell[]
}

export interface TableRowView {
  readonly key: string
  /** The period of the version the row belongs to. */
  readonly group: string
  /** The version's period on the first row of its group, null on the rows after it and when every version holds the same table. */
  readonly period: string | null
  /** How many rows the period spans. */
  readonly periodSpan: number
  readonly cells: readonly ValueCell[]
  /** Folded text a search inside the table matches against. */
  readonly searchText: string
}

/** A table term. When versions differ, their rows are stacked in one table, each group led by its period. */
export interface TableView {
  readonly key: string
  readonly label: string
  readonly byPeriod: boolean
  /** Too many rows to show at once, so the table opens on a search instead. */
  readonly long: boolean
  readonly headers: readonly string[]
  /** Columns holding text, which may wrap. The rest are figures. */
  readonly textColumns: readonly boolean[]
  readonly rows: readonly TableRowView[]
}

/** Where a long table opens: the rows whose cells hold all these words, or a hint when there are none. */
export interface TableFocus {
  readonly cells: readonly string[] | null
  readonly hint: string
}

export interface PeriodNote {
  /** Null when the rule has one version, or every version says the same. */
  readonly period: string | null
  readonly note: string
}

export interface SourceView {
  readonly key: string
  /** The versions that cite it, or null when every version does. */
  readonly periods: string | null
  readonly act: string
  readonly actId: string
  readonly reference: string
  readonly issues: string
  readonly loadedOn: string
  readonly url: string
  readonly quote: string | null
}

/** A figure of the version in force, which the compact list shows beside the rule's name. */
export interface Headline {
  /** The term's name, null when the rule has only that term. */
  readonly label: string | null
  readonly wording: string
}

/** The version in force on the day the view is made for. */
export interface InForceView {
  readonly period: string
  readonly confidence: Confidence
  /** Its first rate, amount or count, or its first rate for a rule named for a rate. Null when it holds only flags, text and tables. */
  readonly headline: Headline | null
}

export interface RuleView {
  readonly id: string
  readonly area: RuleArea
  readonly title: string
  readonly appliesBy: string
  readonly inForce: InForceView
  readonly columns: readonly ValueColumn[]
  readonly rows: readonly ValueRow[]
  readonly tables: readonly TableView[]
  readonly notes: readonly PeriodNote[]
  readonly sources: readonly SourceView[]
  /** Folded text the search box matches against. */
  readonly searchText: string
}

function articleReference(source: LegalSource): string {
  const { article, act } = source
  if (source.ofAmendingAct) {
    return `Art. ${article} of the amending act in NN ${source.nn.join(', ')}`
  }
  if (act === 'HSFI') {
    return `HSFI ${article}`
  }
  return /^\d/.test(article) ? `Art. ${article}` : article.charAt(0).toUpperCase() + article.slice(1)
}

/** "2025", "2025 and 2026", "2025, 2026 and 2027 onward". */
function inWords(periods: readonly string[]): string {
  return periods.length < 2 ? periods.join('') : `${periods.slice(0, -1).join(', ')} and ${periods.at(-1)}`
}

function sourceKey(source: LegalSource): string {
  return `${source.act}|${source.article}|${source.nn.join(',')}|${source.url}`
}

function sourceView(source: LegalSource, periods: string | null): SourceView {
  return {
    key: sourceKey(source),
    periods,
    act: ACTS[source.act].title,
    actId: source.act,
    reference: articleReference(source),
    issues: source.ofAmendingAct ? '' : `NN ${source.nn.join(', ')}`,
    loadedOn: dayLabel(source.loadedOn),
    url: source.url,
    quote: source.quote ?? null,
  }
}

function sameAcrossVersions<Shown>(versions: readonly RuleVersion<RuleTerms>[], pick: (version: RuleVersion<RuleTerms>) => Shown): boolean {
  const first = JSON.stringify(pick(versions[0] as RuleVersion<RuleTerms>))
  return versions.every((version) => JSON.stringify(pick(version)) === first)
}

/** A version's table above this many rows opens on a search. Every other table in the ruleset is far shorter. */
const LONG_TABLE_ROWS = 60

function tableView(key: string, versions: readonly RuleVersion<RuleTerms>[], periods: readonly string[], format: TermFormat): TableView {
  const tables = versions.flatMap((version, index) => {
    const term = version.value[key]
    return term !== undefined && isTable(term) ? [{ table: term, period: periods[index] ?? '' }] : []
  })
  const byPeriod = !tables.every((entry) => JSON.stringify(entry.table) === JSON.stringify(tables[0]?.table))
  const shown = byPeriod ? tables : tables.slice(0, 1)
  const rowsOfAll = tables.flatMap((entry) => entry.table.rows)
  // A row may leave a column out, such as a cap that is only monthly, so the columns are every key any row has.
  const columnKeys = [...new Set(rowsOfAll.flatMap((row) => Object.keys(row)))]
  const wordingsOf = (table: TableTerm): string[][] =>
    table.rows.map((row) =>
      columnKeys.map((columnKey) => {
        const cell = row[columnKey]
        return cell === undefined ? '–' : scalarWording(columnKey, cell, format)
      }),
    )
  return {
    key,
    label: termLabel(key),
    byPeriod,
    long: tables.some((entry) => entry.table.rows.length > LONG_TABLE_ROWS),
    headers: columnKeys.map(termLabel),
    textColumns: columnKeys.map((columnKey) => rowsOfAll.find((row) => row[columnKey] !== undefined)?.[columnKey]?.kind === 'text'),
    rows: shown.flatMap((entry, tableIndex) => {
      const previous = shown[tableIndex - 1]
      const before = previous === undefined ? null : wordingsOf(previous.table)
      const wordings = wordingsOf(entry.table)
      return wordings.map((rowWordings, rowIndex) => ({
        key: `${entry.period}|${rowIndex}`,
        group: entry.period,
        period: byPeriod && rowIndex === 0 ? entry.period : null,
        periodSpan: wordings.length,
        cells: rowWordings.map((wording, columnIndex) => ({
          wording,
          changed: before !== null && before[rowIndex]?.[columnIndex] !== wording,
        })),
        searchText: fold(rowWordings.join(' ')),
      }))
    }),
  }
}

function isTable(term: Term): term is TableTerm {
  return term.kind === 'table'
}

/** The version in force on the day. Before the first starts it is the first, and after the last ends the last. */
function inForceView(rule: GeneralRule, day: CivilDate, format: TermFormat): InForceView {
  const first = rule.versions[0]?.validFrom ?? day
  const last = rule.versions.at(-1)?.validTo ?? null
  const version = versionOn(rule, day < first ? first : last !== null && day > last ? last : day)
  const terms = Object.entries(version.value)
  const figures = terms.filter((entry): entry is [string, ScalarTerm] => ['rate', 'money', 'count'].includes(entry[1].kind))
  // A rule named for a rate, such as the corporate income tax rate, leads with the rate rather than a threshold listed before it.
  const headline = (/\brates?\b/i.test(rule.title) ? figures.find(([, term]) => term.kind === 'rate') : undefined) ?? figures[0]
  return {
    period: periodLabel(version.validFrom, version.validTo),
    confidence: version.confidence,
    headline: headline === undefined ? null : { label: terms.length === 1 ? null : termLabel(headline[0]), wording: scalarWording(headline[0], headline[1], format) },
  }
}

/** The rule as the ruleset shows it, with the version in force on the day picked out. */
export function ruleView(rule: GeneralRule, format: TermFormat, day: CivilDate): RuleView {
  const { versions } = rule
  const periods = versions.map((version) => periodLabel(version.validFrom, version.validTo))
  const firstValue = versions[0]?.value ?? {}
  const termKeys = Object.keys(firstValue)

  const rows: ValueRow[] = termKeys
    .filter((key) => !isTable(firstValue[key] as Term))
    .map((key) => {
      const wordings = versions.map((version) => {
        const term = version.value[key]
        return term === undefined || isTable(term) ? '–' : scalarWording(key, term, format)
      })
      return {
        key,
        label: termLabel(key),
        cells: wordings.map((wording, index) => ({ wording, changed: index > 0 && wording !== wordings[index - 1] })),
      }
    })

  const tables = termKeys.filter((key) => isTable(firstValue[key] as Term)).map((key) => tableView(key, versions, periods, format))

  const firstNote = versions[0]?.note
  const notes: PeriodNote[] = sameAcrossVersions(versions, (version) => version.note ?? null)
    ? firstNote === undefined
      ? []
      : [{ period: null, note: firstNote }]
    : versions.flatMap((version, index) => (version.note === undefined ? [] : [{ period: periods[index] ?? null, note: version.note }]))

  const citedSources = new Map<string, { readonly source: LegalSource; readonly periods: string[] }>()
  versions.forEach((version, index) => {
    for (const source of version.sources) {
      const cited = citedSources.get(sourceKey(source)) ?? { source, periods: [] }
      cited.periods.push(periods[index] ?? '')
      citedSources.set(sourceKey(source), cited)
    }
  })
  const sources = [...citedSources.values()].map((cited) => sourceView(cited.source, cited.periods.length === versions.length ? null : inWords(cited.periods)))

  const columns = versions.map((version, index) => ({ period: periods[index] ?? '', confidence: version.confidence }))

  const searchText = fold(
    [
      rule.id,
      rule.title,
      AREA_WORDING[rule.area].label,
      ...rows.flatMap((row) => [row.label, ...row.cells.map((cell) => cell.wording)]),
      ...tables.flatMap((table) => [table.label, ...table.rows.flatMap((row) => row.cells.map((cell) => cell.wording))]),
      ...notes.map((note) => note.note),
      ...sources.flatMap((source) => [source.act, source.actId, source.reference, source.issues, source.quote ?? '']),
      ...columns.map((column) => CONFIDENCE_WORDING[column.confidence].label),
    ].join(' '),
  )

  return {
    id: rule.id,
    area: rule.area,
    title: rule.title,
    appliesBy: appliesByWording(rule.appliesBy),
    inForce: inForceView(rule, day, format),
    columns,
    rows,
    tables,
    notes,
    sources,
    searchText,
  }
}

export interface WatchView {
  readonly key: string
  readonly area: RuleArea
  readonly title: string
  /** The rule a watched version belongs to. Null for a matter with no value in the ruleset yet. */
  readonly ruleId: RuleId | null
  readonly period: string | null
  readonly confidence: Confidence
  readonly note: string
  readonly url: string | null
  readonly searchText: string
}

export function watchedVersionView(rule: GeneralRule, version: RuleVersion<RuleTerms>): WatchView {
  const period = periodLabel(version.validFrom, version.validTo)
  const note = version.note ?? ''
  return {
    key: `${rule.id}|${version.validFrom}`,
    area: rule.area,
    title: rule.title,
    ruleId: rule.id as RuleId,
    period,
    confidence: version.confidence,
    note,
    url: null,
    searchText: fold([rule.id, rule.title, period, note, CONFIDENCE_WORDING[version.confidence].label].join(' ')),
  }
}

export function openItemView(item: OpenItem): WatchView {
  return {
    key: item.id,
    area: item.area,
    title: item.title,
    ruleId: null,
    period: null,
    confidence: item.status,
    note: item.note,
    url: item.url,
    searchText: fold([item.id, item.title, item.note, CONFIDENCE_WORDING[item.status].label].join(' ')),
  }
}
