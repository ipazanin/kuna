import type { UnitOfWork } from '../../workbook/application/repository'
import { definedCategorySlugs } from '../../workbook/domain/categoriesReading'
import { recordIdOf } from '../../workbook/domain/recordId'
import { CATEGORY_RECORDS, CLIENT_RECORDS, RULE_RECORDS } from '../../workbook/domain/recordKind'
import { recordsOf } from '../../workbook/domain/recordsRead'
import type { RecordsRead } from '../../workbook/domain/recordsRead'
import type { FreshRecords, WriteRules } from '../../workbook/domain/writeRules'
import { readRules } from '../domain/readRules'
import type { RuleTabRow } from '../domain/readRules'
import { newOrderTies } from '../domain/rule'
import type { RulesTabChange } from '../domain/rulesTabChange'
import { rulesTabRefusals } from '../domain/rulesTabRefusals'

function sentence(text: string): string {
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`
}

/** What a rule needs of the other kinds: the categories defined, and whether a clients tab with client and iban columns answers `counterparty_is_client`, as `requireClientIbans` in the Apps Script reads it. */
function ruleContext(records: FreshRecords): { readonly categories: ReadonlySet<string>; readonly hasClientsTab: boolean } {
  const clientFields = records.fieldsKept(CLIENT_RECORDS)?.map((name) => name.trim().toLowerCase()) ?? null
  return { categories: definedCategorySlugs(records.of(CATEGORY_RECORDS)), hasClientsTab: clientFields !== null && clientFields.includes('client') && clientFields.includes('iban') }
}

function rulesOf(read: RecordsRead<RuleTabRow>, records: FreshRecords) {
  const { categories, hasClientsTab } = ruleContext(records)
  return readRules(recordsOf(read), categories, hasClientsTab)
}

/**
 * Rules. The rules after the change must pass every check of `parseRules` in the Apps Script's
 * `Rules.gs`, against the categories and clients as they are now, and leave no two enabled rules
 * sharing an order they did not share before, since the app and the Apps Script break that tie
 * differently. Rules keep no Undo.
 */
export const RULE_WRITES: WriteRules<RuleTabRow> = {
  kind: RULE_RECORDS,
  reads: [CATEGORY_RECORDS, CLIENT_RECORDS],
  undoable: false,
  read: (read, records) => {
    const { rules, problems } = rulesOf(read, records)
    return { facts: rules.map((rule) => ({ id: recordIdOf(RULE_RECORDS, rule.id.toLowerCase()) })), problems }
  },
  refusals: (change, fresh) => {
    const { categories, hasClientsTab } = ruleContext(fresh)
    const refusals = rulesTabRefusals(fresh.fieldsKept(RULE_RECORDS) ?? [], recordsOf(change.after), categories, hasClientsTab)
    if (refusals.length > 0) {
      return [`The rules tab would not pass the Apps Script's check: ${refusals.join('. ')}.`]
    }
    return newOrderTies(rulesOf(change.before, fresh).rules, rulesOf(change.after, fresh).rules).map(sentence)
  },
}

/** Writes a save of the rules: the new rule added, and each edited rule changed from what the app read. */
export function writeRulesChange(unit: UnitOfWork, change: RulesTabChange): void {
  const rules = unit.of(RULE_WRITES)
  if (change.appended !== null) rules.add({ cells: change.appended })
  for (const edit of change.edited) rules.change({ cells: edit.expected }, { cells: edit.cells })
}
