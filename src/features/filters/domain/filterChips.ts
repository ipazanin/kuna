import { formatMoney } from '../../../shared/money/moneyFormat'
import { DEFAULT_FILTERS } from './filterState'
import type { FilterState } from './filterState'

/** One active narrowing the user can see and remove, such as "Category: travel". */
export interface FilterChip {
  readonly id: string
  readonly label: string
}

const LIST_FIELDS = [
  { field: 'buckets', name: 'Bucket' },
  { field: 'families', name: 'Family' },
  { field: 'categories', name: 'Category' },
  { field: 'counterparties', name: 'Counterparty' },
] as const

type ListField = (typeof LIST_FIELDS)[number]['field']

/** How a chip names what it narrows to: counterparties are stored as keys and buckets as identifiers. */
export interface ChipLabels {
  readonly counterparty: (key: string) => string
  readonly bucket: (bucket: string) => string
}

/** A chip for every filter beyond the period and the accounts, which the period bar shows in its own controls. */
export function filterChips(filters: FilterState, labels: ChipLabels): FilterChip[] {
  const chips: FilterChip[] = LIST_FIELDS.flatMap(({ field, name }) =>
    filters[field].map((selected) => ({
      id: `${field}:${selected}`,
      label: `${name}: ${field === 'counterparties' ? labels.counterparty(selected) : field === 'buckets' ? labels.bucket(selected) : selected}`,
    })),
  )
  if (filters.text !== '') {
    chips.push({ id: 'text', label: `Text: “${filters.text}”` })
  }
  const { min, max } = filters.amount
  if (min !== null || max !== null) {
    const bounds =
      min === null ? `at most ${formatMoney(max ?? 0)}` : max === null ? `at least ${formatMoney(min)}` : `${formatMoney(min)} to ${formatMoney(max)}`
    chips.push({ id: 'amount', label: `Amount: ${bounds}` })
  }
  if (filters.needsReview) {
    chips.push({ id: 'needsReview', label: 'Needs review' })
  }
  return chips
}

/** The filters with one chip's narrowing taken off. An unknown id changes nothing. */
export function withoutChip(filters: FilterState, chipId: string): FilterState {
  switch (chipId) {
    case 'text':
      return { ...filters, text: '' }
    case 'amount':
      return { ...filters, amount: DEFAULT_FILTERS.amount }
    case 'needsReview':
      return { ...filters, needsReview: false }
  }
  const separator = chipId.indexOf(':')
  const field = chipId.slice(0, separator) as ListField
  const removed = chipId.slice(separator + 1)
  if (!LIST_FIELDS.some((list) => list.field === field)) {
    return filters
  }
  return { ...filters, [field]: filters[field].filter((selected) => selected !== removed) }
}

/** Every chip removed at once. The period and the accounts stay, since they are not chips. */
export function withoutChips(filters: FilterState): FilterState {
  return { ...DEFAULT_FILTERS, period: filters.period, accounts: filters.accounts }
}
