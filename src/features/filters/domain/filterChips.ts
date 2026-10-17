import { formatMoney } from '../../../shared/money/moneyFormat'
import { isBucket } from '../../workbook/domain/bucket'
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

/** How a chip names what it narrows to: counterparties are stored as keys, buckets and categories as identifiers. */
export interface ChipLabels {
  readonly counterparty: (key: string) => string
  readonly bucket: (bucket: string) => string
  readonly category: (slug: string) => string
}

/** A chip for every filter beyond the period and the accounts, which the period bar shows in its own controls. */
export function filterChips(filters: FilterState, labels: ChipLabels): FilterChip[] {
  const chips: FilterChip[] = LIST_FIELDS.flatMap(({ field, name }) =>
    filters[field].map((selected) => ({
      id: `${field}:${selected}`,
      label: `${name}: ${chipValue(field, selected, labels)}`,
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

function chipValue(field: ListField, selected: string, labels: ChipLabels): string {
  switch (field) {
    case 'counterparties':
      return labels.counterparty(selected)
    case 'buckets':
      return labels.bucket(selected)
    case 'categories':
      return labels.category(selected)
    default:
      return selected
  }
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

/** The fields the Add filter menu narrows, each choice named by its chip id. */
const ADDABLE_FIELDS = ['buckets', 'categories', 'counterparties'] as const satisfies readonly ListField[]

/** The chip ids of the active choices the Add filter menu offers. */
export function addedChoices(filters: FilterState): string[] {
  return ADDABLE_FIELDS.flatMap((field) => filters[field].map((selected) => `${field}:${selected}`))
}

/** The filters with exactly these Add filter choices. Every other narrowing stays as it is. */
export function withAddedChoices(filters: FilterState, chipIds: readonly string[]): FilterState {
  const chosen = (field: ListField): string[] =>
    chipIds.filter((chipId) => chipId.startsWith(`${field}:`)).map((chipId) => chipId.slice(field.length + 1))
  return { ...filters, buckets: chosen('buckets').filter(isBucket), categories: chosen('categories'), counterparties: chosen('counterparties') }
}

/** Every chip removed at once. The period and the accounts stay, since they are not chips. */
export function withoutChips(filters: FilterState): FilterState {
  return { ...DEFAULT_FILTERS, period: filters.period, accounts: filters.accounts }
}
