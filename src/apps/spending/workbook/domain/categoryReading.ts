import { CATEGORY_KINDS, isFixedKind } from './category'
import type { Category } from './category'
import { flagOf, orderOf } from './fieldReading'
import { optionalReference } from './recordReference'
import { CATEGORY_RECORDS } from './spendingKinds'
import { words } from './words'
import { labelWords, withIdField } from '../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import { filledFields } from '../../../../shared/storage/domain/recordFields'
import { keyOfRecordId } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { ownId, refuse, requiredChoice, textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'
import { words as storedWords } from '../../../../shared/storage/domain/words'

export function categoryOf(fields: StoredFields, id: RecordId | null): Category {
  const name = textOf(fields.name)
  if (name === '') refuse(storedWords.reasons.none('name', ''))
  const kind = requiredChoice(fields, 'kind', CATEGORY_KINDS, 'kind of category')
  const parent = optionalReference(fields, 'parent', CATEGORY_RECORDS)
  if (parent !== null && isFixedKind(kind)) refuse(words.fixedWithParent)
  return { id: ownId(id), name, kind, parent, order: orderOf(fields, 'order'), colour: textOf(fields.colour), hidden: flagOf(fields, 'hidden') }
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
    }),
)
