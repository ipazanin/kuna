import { plural } from '../../../../../shared/text/translation'
import type { CategoryNamingWords } from '../../packContribution'
import { counted } from '../../../workbook/domain/slug'
import { OWNER_ADVANCE_RECORDS, PLAN_RECORDS, YEAR_END_RECORDS } from '../domain/hrDooKinds'
import { words as domainWords } from '../domain/words'
import { words } from './words'

const NEVER_JOINED = (): null => null

const BY_KIND: ReadonlyMap<string, CategoryNamingWords> = new Map([
  [OWNER_ADVANCE_RECORDS.name, { counted: counted(words.categoryNaming.ownerAdvances), editedOn: words.links.ownerOwed, joined: NEVER_JOINED }],
  [YEAR_END_RECORDS.name, { counted: counted(words.categoryNaming.yearEndKontoRows), editedOn: words.links.yearStatements, joined: NEVER_JOINED }],
  [PLAN_RECORDS.name, { counted: counted(domainWords.uses.planTabRows), editedOn: words.links.yearPlan, joined: (count: number) => plural(words.categoryNaming.planRowsJoined(count), count) }],
])

/** The words for the records of one of the pack's kinds that name categories. */
export function categoryNamingWords(kind: string): CategoryNamingWords {
  const named = BY_KIND.get(kind)
  if (named === undefined) throw new Error(`The hr-doo pack names no category with ${kind} records.`)
  return named
}
