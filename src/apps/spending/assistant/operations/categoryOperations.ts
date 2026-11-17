import { FLAG_OR_NULL, TEXT, TEXT_OR_NULL, flagOf, found, inputOf } from '../../../../shared/app/operationInput'
import { CATEGORY_WRITES, deleteInto, newCategory } from '../../categories/application/categoryWrites'
import { lastOrder, siblingsUnder, swappedPlaces } from '../../categories/domain/categoryPlaces'
import type { Category } from '../../workbook/domain/category'
import { NEW_CATEGORY_DEFAULTS, isFixedKind } from '../../workbook/domain/category'
import type { SpendingBook, SpendingRecords } from '../../workbook/domain/readSpendingBook'
import { CATEGORY_RECORDS } from '../../workbook/domain/spendingKinds'
import type { AssistantOperation } from '../../../../shared/app/assistantOperations'
import { StepRefused } from '../../../../shared/app/proposedWrites'
import { SWATCHES, swatchOf } from '../../../../shared/charts/swatches'
import type { StrictSchema } from '../../../../shared/ai/domain/strictSchema'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'

const COLOUR_OR_NULL: StrictSchema = {
  type: ['string', 'null'],
  description: `A swatch by its code, ${SWATCHES.map((swatch) => `${swatch.hex} ${swatch.name}`).join(', ')}, an own colour as #rrggbb that keeps 3:1 in the light theme, or "" for its group's colour, or null to leave it.`,
}

/** What Categories does: add, change, move and delete a category or a group. */
export const CATEGORY_OPERATIONS: readonly AssistantOperation[] = [
  {
    name: 'add-category',
    about: 'A new category in a group, or a new group with no parent. It goes one to a card, and a rule on the same card can file into it by its $ name.',
    input: inputOf({ name: TEXT, kind: { type: 'string', enum: ['spending', 'income'] }, parent: TEXT_OR_NULL, colour: COLOUR_OR_NULL, hidden: FLAG_OR_NULL }),
    refs: { parent: CATEGORY_RECORDS.name },
    creates: CATEGORY_RECORDS.name,
    alone: true,
    example: { name: 'Pets', kind: 'spending', parent: null, colour: null, hidden: null },
  },
  {
    name: 'change-category',
    about:
      'A new name, another group of the same kind for a category in a group, a colour, or hidden from the pickers or shown again. A group stays a group, and a fixed category such as Between my accounts takes only a name. Null leaves a field as it is.',
    input: inputOf({ category: TEXT, name: TEXT_OR_NULL, group: TEXT_OR_NULL, colour: COLOUR_OR_NULL, hidden: FLAG_OR_NULL }),
    refs: { category: CATEGORY_RECORDS.name, group: CATEGORY_RECORDS.name },
    creates: null,
    alone: false,
    example: { category: 'category-child', name: 'Renamed', group: 'category', colour: SWATCHES[0]!.hex, hidden: 'yes' },
  },
  {
    name: 'move-category',
    about: 'Moves a category one place up or down among the categories of its group, or a group among the groups of its kind.',
    input: inputOf({ category: TEXT, direction: { type: 'string', enum: ['up', 'down'] } }),
    refs: { category: CATEGORY_RECORDS.name },
    creates: null,
    alone: false,
    example: { category: 'category', direction: 'up' },
  },
  {
    name: 'delete-category',
    about: 'Deletes a category. Its entries, the parts entries are split into, and its rules move to another, and its limits go.',
    input: inputOf({ category: TEXT, into: TEXT }),
    refs: { category: CATEGORY_RECORDS.name, into: CATEGORY_RECORDS.name },
    creates: null,
    alone: false,
    example: { category: 'category', into: 'category-other' },
  },
]

const CATEGORY_OPERATION_NAMES: ReadonlySet<string> = new Set(CATEGORY_OPERATIONS.map((operation) => operation.name))

/** Whether the step is one of the category operations. */
export function isCategoryStep(operation: string): boolean {
  return CATEGORY_OPERATION_NAMES.has(operation)
}

/** The swatch or own colour a step names, blank for the group's colour, or the colour kept. */
function colourOf(text: string | null, kept: string): string {
  if (text === null) return kept
  if (text.trim() === '') return ''
  const swatch = swatchOf(text)
  if (swatch === null) throw new StepRefused(`colour is a swatch code, ${SWATCHES.map((choice) => choice.hex).join(', ')}, an own colour as #rrggbb that keeps 3:1 in the light theme, or "".`)
  return swatch.hex
}

/** A category with its changes, last among its new siblings when it moves to another group, as the category dialog writes it. */
function changedCategory(book: SpendingBook, before: Category, field: Readonly<Record<string, never>>, groupOf: (value: unknown) => Category): Category {
  const name = (field['name'] as string | null)?.trim() ?? before.name
  if (isFixedKind(before.kind)) {
    if (field['group'] !== null || field['colour'] !== null || field['hidden'] !== null) throw new StepRefused('A fixed category takes only a name.')
    return { ...before, name }
  }
  let { parent, order } = before
  if (field['group'] !== null) {
    const group = groupOf(field['group'])
    if (before.parent === null) throw new StepRefused('A group stays a group, so it takes no other group.')
    if (group.parent !== null || group.kind !== before.kind) throw new StepRefused('group is a group of the same kind.')
    if (group.id !== before.parent) {
      parent = group.id
      order = lastOrder(siblingsUnder(book.categories, group.id, before.kind).filter((sibling) => sibling.id !== before.id))
    }
  }
  return { ...before, name, parent, order, colour: colourOf(field['colour'], before.colour), hidden: flagOf(field['hidden'], before.hidden) }
}

/** Writes a category step through the writes Categories uses, and gives the category an add-category step made so a later step names it by `$`. */
export function writeCategoryStep(
  unit: UnitOfWork,
  book: SpendingBook,
  records: SpendingRecords,
  operation: string,
  field: Readonly<Record<string, never>>,
  idOf: (value: unknown) => string,
): Category | null {
  const categoryOf = (value: unknown): Category => found(book.categories, idOf(value), 'category')
  if (operation === 'add-category') {
    const parent = field['parent'] === null ? null : categoryOf(field['parent']).id
    const kind = field['kind'] as Category['kind']
    const category: Category = newCategory({
      name: field['name'],
      kind,
      parent,
      order: lastOrder(siblingsUnder(book.categories, parent, kind)),
      colour: colourOf(field['colour'], ''),
      hidden: flagOf(field['hidden'], NEW_CATEGORY_DEFAULTS.hidden),
      role: NEW_CATEGORY_DEFAULTS.role,
    })
    unit.of(CATEGORY_WRITES).add(category)
    return category
  }
  if (operation === 'change-category') {
    const before = categoryOf(field['category'])
    unit.of(CATEGORY_WRITES).change(before, changedCategory(book, before, field, categoryOf))
  } else if (operation === 'move-category') {
    const category = categoryOf(field['category'])
    const siblings = siblingsUnder(book.categories, category.parent, category.kind)
    const changes = swappedPlaces(siblings, siblings.indexOf(category), field['direction'] === 'up' ? -1 : 1)
    if (changes.length === 0) throw new StepRefused(`That category is already ${field['direction'] === 'up' ? 'first' : 'last'} where it is.`)
    changes.forEach(([before, after]) => unit.of(CATEGORY_WRITES).change(before, after))
  } else {
    deleteInto(unit, records, categoryOf(field['category']), categoryOf(field['into']))
  }
  return null
}
