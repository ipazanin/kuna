import { computed, reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { filterCategoryChoices } from './categoryChoices'
import { words } from './words'
import { categoriesOfRow, rowSide } from '../../categories/domain/rowSide'
import { partsInEvent } from '../../events/domain/eventMembership'
import { eventsNewestFirst } from '../../events/domain/events'
import { eventDays } from '../../events/presentation/eventDays'
import { ALL_MONTHS, accountNamed, categoryIdNamed, eventNamed, labelNamed } from '../../overview/presentation/spendingLinks'
import type { EuroRow } from '../../rates/domain/euroRows'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import { labelsOf } from '../../workbook/domain/carriedChoices'
import { ACCOUNT_RECORDS, CATEGORY_RECORDS, EVENT_RECORDS, LABEL_RECORDS } from '../../workbook/domain/spendingKinds'
import { today } from '../../../../shared/calendar/civilDate'
import { monthOf, monthsFrom, parseMonthKey } from '../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import { monthLabel } from '../../../../shared/calendar/monthLabel'
import { keyOfRecordId } from '../../../../shared/storage/domain/recordId'

/** Every filter's "all" choice, since a select cannot hold null. */
const ALL = 'all'

/** A filter that narrows the list, as a chip names it, and what takes it off. */
export interface ActiveFilter {
  readonly key: string
  readonly label: string
  readonly remove: () => void
}

/**
 * Entries' filters, kept in `?month=`, `?account=`, `?category=`, `?label=` and `?event=`. This month stays out of the address.
 * Picking a label or an event shows its entries of every month, since a flight bought in March can be put in a July trip, and
 * taking it off leaves every month showing until you pick one. The screen keeps one and hands it to its parts, which change a
 * filter through its pick function.
 */
export function useEntryFilters(book: () => SpendingBook | null) {
  const route = useRoute()
  const router = useRouter()
  const thisMonth = monthOf(today())

  const accounts = computed(() => book()?.accounts ?? [])
  const categories = computed(() => book()?.categories ?? [])
  const labels = computed(() => book()?.labels ?? [])
  const events = computed(() => eventsNewestFirst(book()?.events ?? []))

  function replaceQuery(key: string, value: string | null, also: Readonly<Record<string, string>> = {}): void {
    const { [key]: _left, ...others } = route.query
    void router.replace({ query: value === null ? others : { ...others, ...also, [key]: value } })
  }

  const month = computed<MonthKey | typeof ALL_MONTHS>({
    get: () => (route.query.month === ALL_MONTHS ? ALL_MONTHS : ((typeof route.query.month === 'string' ? parseMonthKey(route.query.month) : null) ?? thisMonth)),
    set: (picked) => replaceQuery('month', picked === thisMonth ? null : picked),
  })

  const pickedAccount = computed(() => accountNamed(accounts.value, route.query.account))
  const account = computed<string>({
    get: () => pickedAccount.value?.id ?? ALL,
    set: (id) => {
      const found = accounts.value.find((candidate) => candidate.id === id)
      replaceQuery('account', found === undefined ? null : keyOfRecordId(ACCOUNT_RECORDS, found.id))
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
      replaceQuery('category', found === undefined ? null : keyOfRecordId(CATEGORY_RECORDS, found.id))
    },
  })

  const pickedLabel = computed(() => labelNamed(labels.value, route.query.label))
  const label = computed<string>({
    get: () => pickedLabel.value?.id ?? ALL,
    set: (id) => {
      const found = labels.value.find((candidate) => candidate.id === id)
      replaceQuery('label', found === undefined ? null : keyOfRecordId(LABEL_RECORDS, found.id), { month: ALL_MONTHS })
    },
  })

  const pickedEvent = computed(() => eventNamed(events.value, route.query.event))
  const event = computed<string>({
    get: () => pickedEvent.value?.id ?? ALL,
    set: (id) => {
      const found = events.value.find((candidate) => candidate.id === id)
      replaceQuery('event', found === undefined ? null : keyOfRecordId(EVENT_RECORDS, found.id), { month: ALL_MONTHS })
    },
  })

  /** Every month, then each from the oldest entry's to this one, newest first, and the picked one when it lies outside them. */
  const monthItems = computed(() => {
    const rows = book()?.transactions ?? []
    const picked = month.value === ALL_MONTHS ? [] : [month.value]
    const known = [thisMonth, ...picked, ...[rows[0], rows.at(-1)].flatMap((row) => (row === undefined ? [] : [monthOf(row.date)]))].sort()
    return [
      { label: words.filters.allMonths, value: ALL_MONTHS },
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
      label: events.value.some((other) => other !== candidate && other.name === candidate.name) ? `${candidate.name} · ${eventDays(candidate)}` : candidate.name,
      value: candidate.id as string,
    })),
  ])

  /** Whether a row shows under the filters: a group of categories takes its children, and an event any row with a part in it. */
  const shows = computed(() => {
    const shown = month.value
    const onAccount = pickedAccount.value
    const picked = pickedCategory.value
    const under = picked === null ? null : new Set(categories.value.filter((candidate) => candidate.id === picked.id || candidate.parent === picked.id).map((candidate) => candidate.id))
    const carried = pickedLabel.value
    const during = pickedEvent.value
    const byId = new Map(categories.value.map((candidate) => [candidate.id, candidate]))
    const inEvent = during === null ? null : partsInEvent(events.value, during.id)
    return (row: EuroRow): boolean =>
      (shown === ALL_MONTHS || monthOf(row.transaction.date) === shown) &&
      (onAccount === null || row.transaction.account === onAccount.id) &&
      (under === null || categoriesOfRow(row).some((id) => under.has(id))) &&
      (carried === null || labelsOf(row.items).includes(carried.id)) &&
      (inEvent === null || rowSide(row, byId).some((part, place) => inEvent(row, part, place)))
  })

  /** The filters that narrow the list, each as a chip names it. This month is where the list starts, so it is no filter. */
  const active = computed((): readonly ActiveFilter[] => [
    ...(month.value === thisMonth ? [] : [{ key: 'month', label: month.value === ALL_MONTHS ? words.filters.allMonths : monthLabel(month.value), remove: () => (month.value = thisMonth) }]),
    ...(pickedAccount.value === null ? [] : [{ key: 'account', label: pickedAccount.value.name, remove: () => (account.value = ALL) }]),
    ...(pickedCategory.value === null ? [] : [{ key: 'category', label: pickedCategory.value.name, remove: () => (category.value = ALL) }]),
    ...(pickedLabel.value === null ? [] : [{ key: 'label', label: pickedLabel.value.name, remove: () => (label.value = ALL) }]),
    ...(pickedEvent.value === null ? [] : [{ key: 'event', label: pickedEvent.value.name, remove: () => (event.value = ALL) }]),
  ])

  return reactive({
    month: computed(() => month.value),
    account: computed(() => account.value),
    category: computed(() => category.value),
    label: computed(() => label.value),
    event: computed(() => event.value),
    pickMonth: (picked: MonthKey | typeof ALL_MONTHS) => void (month.value = picked),
    pickAccount: (id: string) => void (account.value = id),
    pickCategory: (id: string) => void (category.value = id),
    pickLabel: (id: string) => void (label.value = id),
    pickEvent: (id: string) => void (event.value = id),
    pickedLabel,
    pickedEvent,
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

export type EntryFilters = ReturnType<typeof useEntryFilters>
