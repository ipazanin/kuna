import { formatMoney } from '../../../../shared/money/moneyFormat'
import { isBucket } from '../../workbook/domain/bucket'
import { labelIdsOf } from '../domain/filterQuery'
import { DEFAULT_FILTERS, EVERY_OWNER_ADVANCE } from '../domain/filterState'
import type { FilterState } from '../domain/filterState'
import { words } from './words'
import { ZERO } from '../../../../shared/money/money'

/** One active narrowing the user can see and remove, such as "Category: travel". */
export interface FilterChip {
  readonly id: string
  readonly label: string
}

const LIST_FIELDS = [
  { field: 'buckets', name: words.chips.bucket },
  { field: 'families', name: words.chips.family },
  { field: 'categories', name: words.chips.category },
  { field: 'counterparties', name: words.chips.counterparty },
  { field: 'labels', name: words.chips.label },
] as const

type ListField = (typeof LIST_FIELDS)[number]['field']

/** What the chip and the Add filter menu call the category choice that selects every owner advance. */
export const EVERY_OWNER_ADVANCE_LABEL = words.chips.everyOwnerAdvance

/** How a chip names what it narrows to: counterparties are stored as keys, buckets and categories as identifiers, and labels by their ids. */
export interface ChipNames {
  readonly counterparty: (key: string) => string
  readonly bucket: (bucket: string) => string
  readonly category: (slug: string) => string
  readonly label: (id: string) => string
}

/** A chip for every filter beyond the period and the accounts, which the period bar shows in its own controls. */
export function filterChips(filters: FilterState, names: ChipNames): FilterChip[] {
  const chips: FilterChip[] = LIST_FIELDS.flatMap(({ field, name }) =>
    filters[field].map((selected) => ({
      id: `${field}:${selected}`,
      label: field === 'categories' && selected === EVERY_OWNER_ADVANCE ? EVERY_OWNER_ADVANCE_LABEL : `${name}: ${chipValue(field, selected, names)}`,
    })),
  )
  if (filters.text !== '') {
    chips.push({ id: 'text', label: words.chips.text(filters.text) })
  }
  const { min, max } = filters.amount
  if (min !== null || max !== null) {
    const bounds = min === null ? words.chips.atMost(formatMoney(max ?? ZERO)) : max === null ? words.chips.atLeast(formatMoney(min)) : words.chips.between(formatMoney(min), formatMoney(max))
    chips.push({ id: 'amount', label: words.chips.amount(bounds) })
  }
  if (filters.needsReview) {
    chips.push({ id: 'needsReview', label: words.chips.needsReview })
  }
  return chips
}

function chipValue(field: ListField, selected: string, names: ChipNames): string {
  switch (field) {
    case 'counterparties':
      return names.counterparty(selected)
    case 'buckets':
      return names.bucket(selected)
    case 'categories':
      return names.category(selected)
    case 'labels':
      return names.label(selected)
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
const ADDABLE_FIELDS = ['buckets', 'categories', 'counterparties', 'labels'] as const satisfies readonly ListField[]

/** The chip ids of the active choices the Add filter menu offers. */
export function addedChoices(filters: FilterState): string[] {
  return ADDABLE_FIELDS.flatMap((field) => filters[field].map((selected) => `${field}:${selected}`))
}

/** The filters with exactly these Add filter choices. Every other narrowing stays as it is. */
export function withAddedChoices(filters: FilterState, chipIds: readonly string[]): FilterState {
  const chosen = (field: ListField): string[] => chipIds.filter((chipId) => chipId.startsWith(`${field}:`)).map((chipId) => chipId.slice(field.length + 1))
  return { ...filters, buckets: chosen('buckets').filter(isBucket), categories: chosen('categories'), counterparties: chosen('counterparties'), labels: labelIdsOf(chosen('labels')) }
}

/** Every chip removed at once. The period and the accounts stay, since they are not chips. */
export function withoutChips(filters: FilterState): FilterState {
  return { ...DEFAULT_FILTERS, period: filters.period, accounts: filters.accounts }
}
