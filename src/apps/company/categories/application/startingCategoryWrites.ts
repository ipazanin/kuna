import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import { recordIdOf } from '../../../../shared/storage/domain/recordId'
import { recordsOf } from '../../../../shared/storage/domain/recordsRead'
import type { Rule } from '../../rules/domain/rule'
import { RULE_WRITES } from '../../rules/application/ruleWrites'
import { placeRules } from '../../rules/domain/rulePlacement'
import { ruleFieldsOf, sameId } from '../../rules/domain/rulesTabChange'
import { CATEGORY_WRITES } from './categoryWrites'
import { categoryColourOf } from '../../workbook/domain/categoryColour'
import { CATEGORY_RECORDS } from '../../workbook/domain/coreKinds'
import type { MissingStartingCategory } from '../../workbook/domain/packPart'
import type { WorkbookRecords } from '../../workbook/domain/readWorkbook'

/**
 * Adds a starting category the books lack, as new books start with it, and its starting rules in the same write, so one Undo
 * takes back all of it. It takes no colour of its own, since a starting colour sits outside the palette and draws in its bucket's
 * colour anyway. Each rule is tried just before the rule its offer names, and the rules there are renumbered when two
 * neighbours leave no room.
 */
export function addStartingCategory(unit: UnitOfWork, records: Pick<WorkbookRecords, 'rules'>, rules: readonly Rule[], missing: MissingStartingCategory): void {
  const { category } = missing
  unit.of(CATEGORY_WRITES).add({
    slug: category.slug,
    label: '',
    family: category.family,
    bucket: category.bucket,
    colour: categoryColourOf(''),
    roles: category.roles,
    vat: category.vat,
    ownerShare: null,
    id: recordIdOf(CATEGORY_RECORDS, category.slug),
  })
  const placed = placeRules(rules, missing.rules)
  const rows = recordsOf(records.rules)
  for (const [id, order] of placed.renumbered) {
    const row = rows.find((candidate) => sameId(candidate.fields.rule, id))
    if (row !== undefined) unit.of(RULE_WRITES).change(row, { fields: { ...row.fields, order: String(order) } })
  }
  for (const rule of placed.added) unit.of(RULE_WRITES).add({ fields: ruleFieldsOf(rule) })
}
