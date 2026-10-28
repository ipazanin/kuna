import { parseCivilDate } from '../../../../shared/calendar/civilDate'
import { amountOf, moneyFromAmount } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { isBucket } from '../../workbook/domain/bucket'
import type { Bucket } from '../../workbook/domain/bucket'
import { DEFAULT_FILTERS } from './filterState'
import type { FilterState, Period, Quarter } from './filterState'

/** A query value as the router hands it over: absent, one value, or a repeated key. */
export type QueryValue = string | null | readonly (string | null)[] | undefined

export type FilterQuery = Readonly<Record<string, QueryValue>>

/**
 * The query keys the filters own, for example `#/company/analysis?p=l12&acc=erste&b=operating`. A list
 * repeats its key rather than joining values, because a counterparty key may hold a comma.
 */
const KEYS = {
  period: 'p',
  accounts: 'acc',
  buckets: 'b',
  families: 'fam',
  categories: 'cat',
  counterparties: 'cp',
  text: 'q',
  amountMin: 'min',
  amountMax: 'max',
  needsReview: 'review',
} as const

export const FILTER_QUERY_KEYS: readonly string[] = Object.values(KEYS)

const YEAR_PATTERN = /^(\d{4})$/
const QUARTER_PATTERN = /^(\d{4})q([1-4])$/
const CUSTOM_PATTERN = /^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/

/**
 * The query for a filter state. Fields left at their default are omitted, except the period when
 * `explicitPeriod` asks for it, which a link that must reproduce its rows does.
 */
export function encodeFilters(filters: FilterState, { explicitPeriod = false } = {}): Record<string, string | string[]> {
  const query: Record<string, string | string[]> = {}
  const period = encodePeriod(filters.period)
  if (explicitPeriod || period !== encodePeriod(DEFAULT_FILTERS.period)) {
    query[KEYS.period] = period
  }
  const lists = [
    [KEYS.accounts, filters.accounts],
    [KEYS.buckets, filters.buckets],
    [KEYS.families, filters.families],
    [KEYS.categories, filters.categories],
    [KEYS.counterparties, filters.counterparties],
  ] as const
  for (const [key, values] of lists) {
    if (values.length === 1) {
      query[key] = values[0]
    } else if (values.length > 1) {
      query[key] = [...values]
    }
  }
  if (filters.text !== '') {
    query[KEYS.text] = filters.text
  }
  if (filters.amount.min !== null) {
    query[KEYS.amountMin] = String(amountOf(filters.amount.min))
  }
  if (filters.amount.max !== null) {
    query[KEYS.amountMax] = String(amountOf(filters.amount.max))
  }
  if (filters.needsReview) {
    query[KEYS.needsReview] = '1'
  }
  return query
}

/** The filter state a query describes. A value that does not parse falls back to the default. */
export function decodeFilters(query: FilterQuery): FilterState {
  return {
    period: decodePeriod(firstValue(query[KEYS.period])) ?? DEFAULT_FILTERS.period,
    accounts: listOf(query[KEYS.accounts]),
    buckets: listOf(query[KEYS.buckets]).filter((bucket): bucket is Bucket => isBucket(bucket)),
    families: listOf(query[KEYS.families]),
    categories: listOf(query[KEYS.categories]),
    counterparties: listOf(query[KEYS.counterparties]),
    text: firstValue(query[KEYS.text]) ?? '',
    amount: {
      min: moneyOfText(firstValue(query[KEYS.amountMin])),
      max: moneyOfText(firstValue(query[KEYS.amountMax])),
    },
    needsReview: firstValue(query[KEYS.needsReview]) === '1',
  }
}

export function hasFilterKeys(query: FilterQuery): boolean {
  return FILTER_QUERY_KEYS.some((key) => query[key] !== undefined)
}

/** The query keys that belong to something else, such as `theme`, kept across a filter change. */
export function withoutFilterKeys<Query extends FilterQuery>(query: Query): Partial<Query> {
  return Object.fromEntries(Object.entries(query).filter(([key]) => !FILTER_QUERY_KEYS.includes(key))) as Partial<Query>
}

function encodePeriod(period: Period): string {
  switch (period.preset) {
    case 'l3':
    case 'l12':
    case 'all':
      return period.preset
    case 'year':
      return String(period.year)
    case 'quarter':
      return `${period.year}q${period.quarter}`
    case 'custom':
      return `${period.range.from}..${period.range.to}`
  }
}

function decodePeriod(text: string | null): Period | null {
  if (text === 'l3' || text === 'l12' || text === 'all') {
    return { preset: text }
  }
  if (text === null) {
    return null
  }
  const year = YEAR_PATTERN.exec(text)
  if (year !== null) {
    return { preset: 'year', year: Number(year[1]) }
  }
  const quarter = QUARTER_PATTERN.exec(text)
  if (quarter !== null) {
    return { preset: 'quarter', year: Number(quarter[1]), quarter: Number(quarter[2]) as Quarter }
  }
  const custom = CUSTOM_PATTERN.exec(text)
  if (custom !== null) {
    const from = parseCivilDate(custom[1])
    const to = parseCivilDate(custom[2])
    if (from !== null && to !== null && from <= to) {
      return { preset: 'custom', range: { from, to } }
    }
  }
  return null
}

function firstValue(value: QueryValue): string | null {
  if (typeof value === 'string') {
    return value
  }
  return value?.find((entry): entry is string => typeof entry === 'string') ?? null
}

function listOf(value: QueryValue): string[] {
  const entries = typeof value === 'string' ? [value] : (value ?? [])
  const present = entries.filter((entry): entry is string => typeof entry === 'string' && entry !== '')
  return [...new Set(present)]
}

function moneyOfText(text: string | null): Money | null {
  if (text === null || text.trim() === '') {
    return null
  }
  const amount = Number(text)
  return Number.isFinite(amount) ? moneyFromAmount(amount) : null
}
