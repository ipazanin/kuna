import { CATEGORY_KINDS, CATEGORY_ROLES, isFixedKind } from './category'
import type { Category, CategoryKind, CategoryRole } from './category'
import { flagOf, orderOf } from './fieldReading'
import { optionalReference } from './recordReference'
import { CATEGORY_RECORDS } from './spendingKinds'
import { words } from './words'
import { labelWords, withIdField } from '../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import { filledFields } from '../../../../shared/storage/domain/recordFields'
import { keyOfRecordId } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { ownId, refuse, requiredChoice, requiredText, textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'

/** The names Kuna's own spending categories had in either language before a file stored their roles, from every starter set. */
const NAMES_BEFORE_ROLES: Readonly<Record<CategoryRole, readonly string[]>> = {
  'bank-fees': ['Bank fees', 'Bankovne naknade'],
  'loan-interest': ['Loan interest', 'Kamate na kredit', 'Loan instalments', 'Rate kredita'],
  // A file from before these roles is asked on To review which category is which.
  salary: [],
  'rental-income': [],
  'profit-payout': [],
  'travel-allowance': [],
}

/** The role a spending category of a file from before roles holds by its starter name, which its next write stores, so a rename after it keeps the role. */
function roleBeforeRoles(name: string, kind: CategoryKind, parent: RecordId | null): CategoryRole | null {
  if (kind !== 'spending' || parent === null) return null
  return CATEGORY_ROLES.find((role) => NAMES_BEFORE_ROLES[role].includes(name)) ?? null
}

export function categoryOf(fields: StoredFields, id: RecordId | null): Category {
  const name = requiredText(fields, 'name')
  const kind = requiredChoice(fields, 'kind', CATEGORY_KINDS, 'kind of category')
  const parent = optionalReference(fields, 'parent', CATEGORY_RECORDS)
  if (parent !== null && isFixedKind(kind)) refuse(words.fixedWithParent)
  const role = fields.role === undefined ? roleBeforeRoles(name, kind, parent) : requiredChoice(fields, 'role', CATEGORY_ROLES, 'role of category')
  return { id: ownId(id), name, kind, parent, order: orderOf(fields, 'order'), colour: textOf(fields.colour), hidden: flagOf(fields, 'hidden'), role }
}

export const CATEGORY_CODEC: RecordCodec<Category> = withIdField(
  CATEGORY_RECORDS,
  (fields) => labelWords([textOf(fields.name)]),
  categoryOf,
  (category) =>
    filledFields({
      name: category.name,
      kind: category.kind,
      parent: category.parent === null ? null : keyOfRecordId(CATEGORY_RECORDS, category.parent),
      order: String(category.order),
      colour: category.colour,
      hidden: category.hidden ? true : null,
      role: category.role,
    }),
)
