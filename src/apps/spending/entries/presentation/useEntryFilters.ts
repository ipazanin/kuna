import { computed, reactive } from 'vue'
import { labelsOf } from '../../../../shared/categorising/domain/labels'
import { useRoute, useRouter } from 'vue-router'

import { filterCategoryChoices } from './categoryChoices'
import { words } from './words'
import { countedRowOf } from '../../analytics/domain/countedRow'
import { keepsAnyPart } from '../../analytics/domain/partTotals'
import { categoriesOfRow } from '../../categories/domain/rowSide'
import { partsInEvent } from '../../events/domain/eventMembership'
import { eventsNewestFirst } from '../../events/domain/events'
import { dayRangeLabel } from '../../../../shared/calendar/dayLabel'
import { ALL_MONTHS, LAST_12_MONTHS, accountNamed, categoryIdNamed, entriesMonthsNamed, entriesSpanNamed, eventNamed, labelNamed, payeeNamed } from '../../overview/presentation/spendingLinks'
import type { EntriesMonths } from '../../overview/presentation/spendingLinks'
import { countsUnderPayee } from '../../payees/domain/payeeTotals'
import type { EuroRow } from '../../rates/domain/euroRows'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import { ACCOUNT_RECORDS, CATEGORY_RECORDS, EVENT_RECORDS, LABEL_RECORDS } from '../../workbook/domain/spendingKinds'
import { today } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { lastTwelveMonths, rangeContains } from '../../../../shared/calendar/dateRange'
import type { DateRange } from '../../../../shared/calendar/dateRange'
import { anchorWindow } from '../../../../shared/calendar/ledgerWindow'
import { monthOf, monthsFrom } from '../../../../shared/calendar/monthKey'
import { monthLabel } from '../../../../shared/calendar/monthLabel'
import { periodInWords } from '../../../../shared/calendar/periodInWords'
import { keyOfRecordId } from '../../../../shared/storage/domain/recordId'

/** Every filter's "all" choice, since a select cannot hold null. */
const ALL = 'all'

/** The month select's choice while the address names a span of days, which picks nothing of its own. */
const SPAN = 'span'

/** The address with no span, which every pick of months or of a label or event by hand leaves. */
const NO_SPAN = { from: null, to: null } as const

/** A filter that narrows the list, as a chip names it, and what takes it off. */
export interface ActiveFilter {
  readonly key: string
  readonly label: string
  readonly remove: () => void
}

/**
 * Entries' filters, kept in `?month=` or a span of days in `?from=` and `?to=`, `?account=`, `?category=`, `?label=`, `?event=` and
 * `?payee=`. This month stays out of the address, and a span wins over the month. A group's total counts the span a link gave.
 * Picking a label or an event shows its entries of every month, since a flight bought in March can be put in a July trip, so
 * every month is part of that filter rather than one of its own, and taking the last of them off goes back to this month. A
 * payee comes only from the Payees tab, with the months that tab counted. The screen keeps one and hands it to its parts,
 * which change a filter through its pick function.
 */
export function useEntryFilters(book: () => SpendingBook | null) {
  const route = useRoute()
  const router = useRouter()
  const thisMonth = monthOf(today())

  const accounts = computed(() => book()?.accounts ?? [])
  const categories = computed(() => book()?.categories ?? [])
  const labels = computed(() => book()?.labels ?? [])
  const events = computed(() => eventsNewestFirst(book()?.events ?? []))

  /** Sets each key of the address, or takes it out when null, in one change, since a second change would start from the old address. */
  function changeQuery(changes: Readonly<Record<string, string | null>>): void {
    const kept = Object.entries(route.query).filter(([key]) => !(key in changes))
    const set = Object.entries(changes).filter((change): change is [string, string] => change[1] !== null)
    void router.replace({ query: Object.fromEntries([...kept, ...set]) })
  }

  const month = computed<EntriesMonths>({
    get: () => entriesMonthsNamed(route.query.month) ?? thisMonth,
    set: (picked) => changeQuery({ month: picked === thisMonth ? null : picked, ...NO_SPAN }),
  })

  const span = computed((): DateRange | null => entriesSpanNamed(route.query.from, route.query.to))
  /** The span as Company's period bar names its days, such as "1 – 15 Oct 2026" or "Oct so far". */
  const spanLabel = computed(() => {
    const shown = span.value
    if (shown === null) return ''
    const oldest = book()?.transactions[0]?.date
    return periodInWords({ preset: 'custom', range: shown }, anchorWindow(oldest !== undefined && oldest < shown.from ? oldest : shown.from, today()))
  })

  /** Whether a day falls in the months shown. */
  const inMonths = computed((): ((date: CivilDate) => boolean) => {
    const days = span.value
    if (days !== null) return (date) => rangeContains(days, date)
    const shown = month.value
    if (shown === ALL_MONTHS) return () => true
    if (shown === LAST_12_MONTHS) {
      const range = lastTwelveMonths(today())
      return (date) => rangeContains(range, date)
    }
    return (date) => monthOf(date) === shown
  })

  /** Whether the list reaches over more than one month, as every month, the last twelve or a span into another month do. */
  const manyMonths = computed(() => {
    const days = span.value
    if (days !== null) return monthOf(days.from) !== monthOf(days.to)
    return month.value === ALL_MONTHS || month.value === LAST_12_MONTHS
  })

  /** Every month goes with the last label, event or payee taken off, back to this month, and a month picked by hand stays. */
  const monthLeft = (last: boolean): Readonly<Record<string, null>> => (last && month.value === ALL_MONTHS ? { month: null } : {})

  const pickedAccount = computed(() => accountNamed(accounts.value, route.query.account))
  const account = computed<string>({
    get: () => pickedAccount.value?.id ?? ALL,
    set: (id) => {
      const found = accounts.value.find((candidate) => candidate.id === id)
      changeQuery({ account: found === undefined ? null : keyOfRecordId(ACCOUNT_RECORDS, found.id) })
    },
  })

  const pickedCategory = computed(() => {
    const id = categoryIdNamed(route.query.category)
    return categories.value.find((candidate) => candidate.id === id) ?? null
  })
  const category = computed<string>({
    get: () => pickedCategory.value?.id ?? ALL,
    set: (id) => {
      const found = categories.value.find((candidate) => candidate.id === id)
      changeQuery({ category: found === undefined ? null : keyOfRecordId(CATEGORY_RECORDS, found.id) })
    },
  })

  const pickedLabel = computed(() => labelNamed(labels.value, route.query.label))
  const label = computed<string>({
    get: () => pickedLabel.value?.id ?? ALL,
    set: (id) => {
      const found = labels.value.find((candidate) => candidate.id === id)
      changeQuery(
        found === undefined
          ? { label: null, ...monthLeft(pickedEvent.value === null && pickedPayee.value === null) }
          : { label: keyOfRecordId(LABEL_RECORDS, found.id), month: ALL_MONTHS, ...NO_SPAN },
      )
    },
  })

  const pickedEvent = computed(() => eventNamed(events.value, route.query.event))
  const event = computed<string>({
    get: () => pickedEvent.value?.id ?? ALL,
    set: (id) => {
      const found = events.value.find((candidate) => candidate.id === id)
      changeQuery(
        found === undefined
          ? { event: null, ...monthLeft(pickedLabel.value === null && pickedPayee.value === null) }
          : { event: keyOfRecordId(EVENT_RECORDS, found.id), month: ALL_MONTHS, ...NO_SPAN },
      )
    },
  })

  const pickedPayee = computed(() => payeeNamed(book() ?? { transactions: [], items: [] }, route.query.payee))
  const dropPayee = (): void => changeQuery({ payee: null, ...monthLeft(pickedLabel.value === null && pickedEvent.value === null) })

  /** Every month, the last twelve, then each from the oldest entry's to this one, newest first, and the picked one when it lies outside them. */
  const monthItems = computed(() => {
    const rows = book()?.transactions ?? []
    const picked = month.value === ALL_MONTHS || month.value === LAST_12_MONTHS ? [] : [month.value]
    const known = [thisMonth, ...picked, ...[rows[0], rows.at(-1)].flatMap((row) => (row === undefined ? [] : [monthOf(row.date)]))].sort()
    return [
      { label: words.filters.allMonths, value: ALL_MONTHS },
      { label: words.filters.lastTwelveMonths, value: LAST_12_MONTHS },
      ...(span.value === null ? [] : [{ label: spanLabel.value, value: SPAN }]),
      ...monthsFrom(known[0]!, known.at(-1)!)
        .reverse()
        .map((value) => ({ label: monthLabel(value), value })),
    ]
  })
  const accountItems = computed(() => [{ label: words.filters.allAccounts, value: ALL }, ...accounts.value.map((candidate) => ({ label: candidate.name, value: candidate.id as string }))])
  const categoryItems = computed(() => [[{ label: words.filters.allCategories, value: ALL }], ...filterCategoryChoices(categories.value)])
  const labelItems = computed(() => [{ label: words.filters.allLabels, value: ALL }, ...labels.value.map((candidate) => ({ label: candidate.name, value: candidate.id as string }))])
  /** Two events of one name, such as two trips to Prague, read apart by their days. */
  const eventItems = computed(() => [
    { label: words.filters.allEvents, value: ALL },
    ...events.value.map((candidate) => ({
      label: events.value.some((other) => other !== candidate && other.name === candidate.name) ? `${candidate.name} · ${dayRangeLabel(candidate.days)}` : candidate.name,
      value: candidate.id as string,
    })),
  ])

  /** Whether a row shows under the filters: a group of categories takes its children, and an event or a payee any row with a part in it or under them. */
  const shows = computed(() => {
    const shown = inMonths.value
    const onAccount = pickedAccount.value
    const picked = pickedCategory.value
    const under = picked === null ? null : new Set(categories.value.filter((candidate) => candidate.id === picked.id || candidate.parent === picked.id).map((candidate) => candidate.id))
    const carried = pickedLabel.value
    const during = pickedEvent.value
    const byId = new Map(categories.value.map((candidate) => [candidate.id, candidate]))
    const inEvent = during === null ? null : partsInEvent(events.value, during.id)
    const paid = pickedPayee.value
    return (row: EuroRow): boolean =>
      shown(row.transaction.date) &&
      (onAccount === null || row.transaction.account === onAccount.id) &&
      (under === null || categoriesOfRow(row).some((id) => under.has(id))) &&
      (carried === null || labelsOf(row.items).includes(carried.id)) &&
      (inEvent === null || keepsAnyPart(countedRowOf(row), byId, inEvent)) &&
      (paid === null || countsUnderPayee(countedRowOf(row), paid.key))
  })

  /** The filters that narrow the list, each as a chip names it. This month is where the list starts, and every month goes with a label, an event or a payee, so none of them is a filter. */
  const groupPicked = computed(() => pickedLabel.value !== null || pickedEvent.value !== null || pickedPayee.value !== null)
  const active = computed((): readonly ActiveFilter[] => [
    ...(span.value !== null
      ? [{ key: 'span', label: spanLabel.value, remove: () => changeQuery({ month: groupPicked.value ? ALL_MONTHS : null, ...NO_SPAN }) }]
      : month.value === thisMonth || (month.value === ALL_MONTHS && groupPicked.value)
        ? []
        : [{ key: 'month', label: monthsLabel(month.value), remove: () => (month.value = thisMonth) }]),
    ...(pickedAccount.value === null ? [] : [{ key: 'account', label: pickedAccount.value.name, remove: () => (account.value = ALL) }]),
    ...(pickedCategory.value === null ? [] : [{ key: 'category', label: pickedCategory.value.name, remove: () => (category.value = ALL) }]),
    ...(pickedLabel.value === null ? [] : [{ key: 'label', label: pickedLabel.value.name, remove: () => (label.value = ALL) }]),
    ...(pickedEvent.value === null ? [] : [{ key: 'event', label: pickedEvent.value.name, remove: () => (event.value = ALL) }]),
    ...(pickedPayee.value === null ? [] : [{ key: 'payee', label: pickedPayee.value.name, remove: dropPayee }]),
  ])

  return reactive({
    month: computed(() => (span.value === null ? month.value : SPAN)),
    account: computed(() => account.value),
    category: computed(() => category.value),
    label: computed(() => label.value),
    event: computed(() => event.value),
    /** The span's own choice names no months, so picking it again changes nothing. */
    pickMonth: (picked: string) => {
      const months = entriesMonthsNamed(picked)
      if (months !== null) month.value = months
    },
    pickAccount: (id: string) => void (account.value = id),
    pickCategory: (id: string) => void (category.value = id),
    pickLabel: (id: string) => void (label.value = id),
    pickEvent: (id: string) => void (event.value = id),
    clear: () => changeQuery({ month: null, ...NO_SPAN, account: null, category: null, label: null, event: null, payee: null }),
    pickedLabel,
    pickedEvent,
    pickedPayee,
    span,
    manyMonths,
    inMonths,
    monthItems,
    accountItems,
    categoryItems,
    labelItems,
    eventItems,
    labels,
    events,
    shows,
    active,
  })
}

function monthsLabel(months: EntriesMonths): string {
  if (months === ALL_MONTHS) return words.filters.allMonths
  return months === LAST_12_MONTHS ? words.filters.lastTwelveMonths : monthLabel(months)
}

export type EntryFilters = ReturnType<typeof useEntryFilters>
