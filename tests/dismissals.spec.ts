import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { DISMISSAL_WRITES, dismissalOfGroup } from '../src/features/review/application/dismissalWrites'
import { withoutDismissed } from '../src/features/review/domain/dismissedSuggestions'
import { ruleCoverage } from '../src/features/rules/domain/ruleCoverage'
import { categorisationContextOf } from '../src/features/rules/domain/transactionFacts'
import type { WorkbookStore } from '../src/features/workbook/application/createWorkbookStore'
import type { WorkbookCopy } from '../src/features/workbook/application/workbookPorts'
import type { CivilDate } from '../src/shared/calendar/civilDate'
import { readDismissals } from '../src/features/workbook/domain/dismissalsReading'
import { CORE_TABS, recordsOfRows } from '../src/features/workbook/infrastructure/spreadsheetTab'
import { sheetRowsFromValues } from '../src/features/workbook/infrastructure/workbookSnapshot'
import type { CellValue } from '../src/features/workbook/infrastructure/workbookSnapshot'
import { DESK_IBAN, LEDGER_ROWS, browserHarness, forgetCaches, driveHarness, workbookGrids } from './fixtures/writeBack'
import type { WriteBackHarness } from './fixtures/writeBack'
import { withIds } from './fixtures/rowIds'
import { recordIdOf } from '../src/features/workbook/domain/recordId'
import { DISMISSAL_RECORDS } from '../src/features/workbook/domain/recordKind'

const used = new Set<string>()

afterEach(async () => {
  await forgetCaches(used)
})

const HEADER: CellValue[] = ['kind', 'key', 'category', 'dismissed_on']
const DESK_KEY = `iban:${DESK_IBAN}`
const DAY = '2026-10-21' as CivilDate

function grids(withTab = true): Record<string, CellValue[][]> {
  return { ...workbookGrids(), ...(withTab ? { dismissed: [HEADER] } : {}) }
}

function coverageOf(store: WorkbookStore<WorkbookCopy>) {
  const workbook = store.state.workbook!
  return withoutDismissed(ruleCoverage(workbook.transactions, workbook.rules, categorisationContextOf(workbook)), workbook.dismissals)
}

function deskGroup(store: WorkbookStore<WorkbookCopy>) {
  const workbook = store.state.workbook!
  return ruleCoverage(workbook.transactions, workbook.rules, categorisationContextOf(workbook)).notCovered.find((group) => group.key === DESK_KEY)!
}

describe('the dismissed tab', () => {
  it('reads one row per dismissal, and reports a row it cannot use and every row of a suggestion dismissed twice', () => {
    const reading = readDismissals(
      recordsOfRows(
        CORE_TABS.dismissed,
        sheetRowsFromValues(
        withIds('dismissal', [
          HEADER,
          ['not-covered', DESK_KEY, 'Equipment', 46316],
          ['exception', 'name:corner shop', '', ''],
          ['not-covered', DESK_KEY, 'equipment', 46317],
          ['rule', 'name:kiosk'],
          ['not-covered', '', 'travel'],
          ['exception', 'name:bakery', '', 'Tuesday'],
        ]),
      ),
      ),
    )

    expect(reading.facts).toEqual([{ kind: 'exception', key: 'name:corner shop', category: '', dismissedOn: null, id: recordIdOf(DISMISSAL_RECORDS, 'dismissal-3') }])
    expect(reading.problems.map((problem) => [problem.label, problem.reason])).toEqual([
      ['name:kiosk', '"rule" is not a kind of suggestion. Use not-covered, exception'],
      ['unnamed', 'no key'],
      ['name:bakery, Tuesday', 'dismissed_on "Tuesday" is not a date cell'],
      [`${DESK_KEY}, 2026-10-21`, `${DESK_KEY} is dismissed on more than one row, so none of them counts`],
      [`${DESK_KEY}, 2026-10-22`, `${DESK_KEY} is dismissed on more than one row, so none of them counts`],
    ])
  })

  it('keeps a dismissed group hidden as new rows join it, and lists the dismissal', async () => {
    const newDesk: CellValue[] = [46301, 'main', 's-003', 'Desk Co', DESK_IBAN, 'Chair', -60, 940, 'equipment', 'human', 'REF-5', '', '', '', '', '', '', '']
    const { store } = await browserHarness(used, {
      ...grids(),
      ledger: [workbookGrids().ledger![0]!, newDesk, ...LEDGER_ROWS.map((row) => [...row])],
      dismissed: withIds('dismissal', [HEADER, ['not-covered', DESK_KEY, 'equipment', 46316]]),
    })

    const { coverage, dismissed } = coverageOf(store)

    expect(coverage.notCovered.map((group) => group.key)).not.toContain(DESK_KEY)
    expect(dismissed.map((entry) => [entry.dismissal.key, entry.group?.rows.length])).toEqual([[DESK_KEY, 2]])
  })

  it('names the group by its counterparty, its most common category and the day', () => {
    const group = { key: DESK_KEY, name: 'Desk Co', iban: DESK_IBAN, rows: [], categories: [{ category: 'equipment', count: 2 }] }

    expect(dismissalOfGroup('not-covered', group, DAY)).toMatchObject({ kind: 'not-covered', key: DESK_KEY, category: 'equipment', dismissedOn: DAY })
  })

  it('hides only the exception to the rule it names, not the same counterparty’s exception to another rule', () => {
    const exception = (ruleId: string) => ({ key: `${DESK_KEY}|${ruleId}`, name: 'Desk Co', iban: DESK_IBAN, rows: [], categories: [], ruleId, ruleCategory: 'equipment' })
    const coverage = { notCovered: [], exceptions: [exception('desk-rent'), exception('desk-chairs')] }
    const dismissal = { kind: 'exception' as const, key: dismissalOfGroup('exception', exception('desk-rent'), DAY).key, category: '', dismissedOn: DAY, id: recordIdOf(DISMISSAL_RECORDS, 'dismissal-2') }

    const shown = withoutDismissed(coverage, [dismissal])

    expect(shown.coverage.exceptions.map((group) => group.ruleId)).toEqual(['desk-chairs'])
    expect(shown.dismissed.map((entry) => entry.group?.key)).toEqual([`${DESK_KEY}|desk-rent`])
  })
})

describe.each([
  ['a file on Drive', driveHarness],
  ['a workbook kept in this browser', browserHarness],
] as const)('dismissals written to %s', (_name, harnessOf: (used: Set<string>, grids?: Record<string, CellValue[][]>) => Promise<WriteBackHarness>) => {
  it('dismisses a group, restores it, and Undo puts the dismissal back', async () => {
    const { store } = await harnessOf(used, grids())

    await store.write('Dismissed', (unit) => unit.of(DISMISSAL_WRITES).add(dismissalOfGroup('not-covered', deskGroup(store), DAY)))
    expect(coverageOf(store).coverage.notCovered.map((group) => group.key)).not.toContain(DESK_KEY)
    expect(store.state.workbook?.dismissals.map((dismissal) => [dismissal.key, dismissal.dismissedOn])).toEqual([[DESK_KEY, DAY]])

    const [dismissal] = store.state.records!.dismissed.records
    await store.write('Restored', (unit) => unit.of(DISMISSAL_WRITES).remove(dismissal!.record))
    expect(coverageOf(store).coverage.notCovered.map((group) => group.key)).toContain(DESK_KEY)
    expect(store.state.snapshot?.document.records.dismissal).toEqual([])

    await store.undo(store.state.writes[0]!)
    expect(store.state.workbook?.dismissals.map((dismissal) => dismissal.key)).toEqual([DESK_KEY])
  })
})
