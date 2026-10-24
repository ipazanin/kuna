import type { UnitOfWork } from '../../workbook/application/repository'
import { definedCategorySlugs } from '../../workbook/domain/categoriesReading'
import { recordIdOf } from '../../workbook/domain/recordId'
import { CATEGORY_RECORDS, RULE_RECORDS } from '../../workbook/domain/recordKind'
import { recordsOf } from '../../workbook/domain/recordsRead'
import type { WriteRules } from '../../workbook/domain/writeRules'
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
  if (change.appended !== null) rules.add({ cells: change.appended })
  for (const edit of change.edited) rules.change({ cells: edit.expected }, { cells: edit.cells })
  if (change.removed !== null) rules.remove({ cells: change.removed })
}
