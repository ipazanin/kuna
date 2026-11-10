import { addMoney } from '../../../../../shared/money/money'
import { slugListOf, slugOf } from '../../../../../shared/storage/domain/storedFields'
import { recordsOf } from '../../../../../shared/storage/domain/recordsRead'
import type { RecordsRead } from '../../../../../shared/storage/domain/recordsRead'
import { movedTo } from '../../../owner-share/domain/ownerShare'
import type { MovedRecord } from '../../../settings/domain/categoryMove'
import type { CategoryNaming, NamedRecordsMove } from '../../../workbook/domain/packPart'
import type { PlanLine } from './forecast/plan'
import { OWNER_ADVANCE_WRITES, PLAN_WRITES, YEAR_END_WRITES } from './hrDooWrites'
import type { OwnerAdvanceEntry } from './ownerAdvancesReading'
import type { YearEndLine } from './yearEnd/yearEnd'

/** Owner advances name their one category, and a moved one takes the owner share of the category it moves to, as a ledger row does. */
export const OWNER_ADVANCE_NAMING: CategoryNaming<OwnerAdvanceEntry> = {
  writes: OWNER_ADVANCE_WRITES,
  categoriesOf: (fields) => [slugOf(fields.category)],
  editedOn: { path: '/company/owner', query: { tab: 'owed' } },
  movedInto: (read, from, into, categories) => ({
    changed: recordsOf(read)
      .filter((advance) => advance.category === from)
      .map((advance) => ({ before: advance, after: movedTo(advance, into, categories) })),
    removed: [],
  }),
}

/** A konto row lists the categories its account corresponds to, and a moved one lists the other category once. */
const YEAR_END_NAMING: CategoryNaming<YearEndLine> = {
  writes: YEAR_END_WRITES,
  categoriesOf: (fields) => slugListOf(fields.categories),
  editedOn: { path: '/company/year', query: { tab: 'statements' } },
  movedInto: (read, from, into) => ({
    changed: recordsOf(read)
      .filter((line) => line.categories.includes(from))
      .map((line) => ({ before: line, after: { ...line, categories: [...new Set(line.categories.map((slug) => (slug === from ? into : slug)))] } })),
    removed: [],
  }),
}

type CategoryPlanLine = Extract<PlanLine, { readonly kind: 'amount' }>

/** The year and month a category's plan rows are listed once for. */
function planSlot(line: PlanLine): string {
  return `${line.year} ${line.month ?? 'every'}`
}

/**
 * A plan row of the category moves to the other one. Where the other already holds a row of the same year and month, the plan
 * keeps one row there with both amounts added up, so the year's plan adds up to what it did.
 */
function planMovedInto(read: RecordsRead<PlanLine>, from: string, into: string): NamedRecordsMove<PlanLine> {
  const lines = recordsOf(read).filter((line): line is CategoryPlanLine => line.kind === 'amount')
  const kept = new Map<string, MovedRecord<CategoryPlanLine>>()
  for (const line of lines.filter((candidate) => candidate.item === into)) {
    if (!kept.has(planSlot(line))) kept.set(planSlot(line), { before: line, after: line })
  }
  const removed: CategoryPlanLine[] = []
  for (const line of lines.filter((candidate) => candidate.item === from)) {
    const there = kept.get(planSlot(line))
    if (there === undefined) {
      kept.set(planSlot(line), { before: line, after: { ...line, item: into } })
    } else {
      kept.set(planSlot(line), { before: there.before, after: { ...there.after, amount: addMoney(there.after.amount, line.amount) } })
      removed.push(line)
    }
  }
  return { changed: [...kept.values()].filter((moved) => moved.before !== moved.after), removed }
}

const PLAN_NAMING: CategoryNaming<PlanLine> = {
  writes: PLAN_WRITES,
  categoriesOf: (fields) => [slugOf(fields.item)],
  editedOn: { path: '/company/year', query: { tab: 'plan' } },
  movedInto: planMovedInto,
}

/** The pack's kinds whose records name categories, each with how a category's delete into another moves them. */
export const CATEGORY_NAMING: readonly CategoryNaming[] = [OWNER_ADVANCE_NAMING, YEAR_END_NAMING, PLAN_NAMING]
