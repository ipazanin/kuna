import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import { definedCategorySlugs } from '../../workbook/domain/categoriesReading'
import { CATEGORY_RECORDS, RULE_RECORDS } from '../../workbook/domain/coreKinds'
import { recordIdOf } from '../../../../shared/storage/domain/recordId'
import { recordsOf } from '../../../../shared/storage/domain/recordsRead'
import type { WriteRules } from '../../../../shared/storage/domain/writeRules'
import { readRules } from '../domain/readRules'
import type { RuleTabRow } from '../domain/readRules'
import type { RulesTabChange } from '../domain/rulesTabChange'

/** Rules, checked by their own reader against the categories defined now. */
export const RULE_WRITES: WriteRules<RuleTabRow> = {
  kind: RULE_RECORDS,
  reads: [CATEGORY_RECORDS],
  undoable: true,
  read: (read, records) => {
    const { rules, problems } = readRules(recordsOf(read), definedCategorySlugs(records.of(CATEGORY_RECORDS)))
    return { facts: rules.map((rule) => ({ id: recordIdOf(RULE_RECORDS, rule.id.toLowerCase()) })), problems }
  },
  refusals: () => [],
}

/** Writes a save of the rules: the new rule added, each edited rule changed from what the app read, and the deleted rule removed. */
export function writeRulesChange(unit: UnitOfWork, change: RulesTabChange): void {
  const rules = unit.of(RULE_WRITES)
  if (change.appended !== null) rules.add({ fields: change.appended })
  for (const edit of change.edited) rules.change({ fields: edit.expected }, { fields: edit.fields })
  if (change.removed !== null) rules.remove({ fields: change.removed })
}
