import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { DISMISSED_ROWS, dismissalCells } from '../src/features/review/application/dismissedRows'
import { withoutDismissed } from '../src/features/review/domain/dismissedSuggestions'
import { ruleCoverage } from '../src/features/rules/domain/ruleCoverage'
import { categorisationContextOf } from '../src/features/rules/domain/transactionFacts'
import { rowCellsOf } from '../src/features/workbook/application/tabRowWrites'
import type { WorkbookStore } from '../src/features/workbook/application/workbookStore'
import type { CivilDate } from '../src/shared/calendar/civilDate'
import { readDismissals } from '../src/features/workbook/infrastructure/dismissedTabReader'
import { sheetRowsFromValues } from '../src/features/workbook/infrastructure/workbookSnapshot'
import type { CellValue } from '../src/features/workbook/infrastructure/workbookSnapshot'
import { DESK_IBAN, LEDGER_ROWS, dateFormat, excelHarness, forgetCaches, googleHarness, sentRequests, workbookGrids } from './fixtures/writeBack'
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

function coverageOf(store: WorkbookStore) {
  const workbook = store.state.workbook!
  return withoutDismissed(ruleCoverage(workbook.transactions, workbook.rules, categorisationContextOf(workbook)), workbook.dismissals)
}

function deskGroup(store: WorkbookStore) {
  const workbook = store.state.workbook!
  return ruleCoverage(workbook.transactions, workbook.rules, categorisationContextOf(workbook)).notCovered.find((group) => group.key === DESK_KEY)!
}

describe('the dismissed tab', () => {
  it('reads one row per dismissal, and reports a row it cannot use and every row of a suggestion dismissed twice', () => {
    const reading = readDismissals(
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
    )

    expect(reading.facts).toEqual([{ kind: 'exception', key: 'name:corner shop', category: '', dismissedOn: null, id: recordIdOf(DISMISSAL_RECORDS, 'dismissal-3') }])
    expect(reading.problems.map((problem) => [problem.label, problem.reason])).toEqual([
      [`${DESK_KEY}, 2026-10-21`, `${DESK_KEY} is dismissed on more than one row, so none of them counts`],
      [`${DESK_KEY}, 2026-10-22`, `${DESK_KEY} is dismissed on more than one row, so none of them counts`],
      ['name:kiosk', '"rule" is not a kind of suggestion. Use not-covered, exception'],
      ['unnamed', 'no key'],
      ['name:bakery, Tuesday', 'dismissed_on "Tuesday" is not a date cell'],
    ])
  })

  it('keeps a dismissed group hidden as new rows join it, and lists the dismissal', async () => {
    const newDesk: CellValue[] = [46301, 'main', 's-003', 'Desk Co', DESK_IBAN, 'Chair', -60, 940, 'equipment', 'human', 'REF-5', '', '', '', '', '', '', '']
    const { store } = await excelHarness(used, {
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

    expect(dismissalCells('not-covered', group, DAY)).toEqual({ kind: 'not-covered', key: DESK_KEY, category: 'equipment', dismissed_on: 46316 })
  })

  it('hides only the exception to the rule it names, not the same counterparty’s exception to another rule', () => {
    const exception = (ruleId: string) => ({ key: `${DESK_KEY}|${ruleId}`, name: 'Desk Co', iban: DESK_IBAN, rows: [], categories: [], ruleId, ruleCategory: 'equipment' })
    const coverage = { notCovered: [], exceptions: [exception('desk-rent'), exception('desk-chairs')] }
    const dismissal = { kind: 'exception' as const, key: dismissalCells('exception', exception('desk-rent'), DAY).key as string, category: '', dismissedOn: DAY, id: recordIdOf(DISMISSAL_RECORDS, 'dismissal-2') }

    const shown = withoutDismissed(coverage, [dismissal])

    expect(shown.coverage.exceptions.map((group) => group.ruleId)).toEqual(['desk-chairs'])
    expect(shown.dismissed.map((entry) => entry.group?.key)).toEqual([`${DESK_KEY}|desk-rent`])
  })
})

describe.each([
  ['a Google Sheet', googleHarness],
  ['a workbook kept in this browser', excelHarness],
] as const)('dismissals written to %s', (_name, harnessOf: (used: Set<string>, grids?: Record<string, CellValue[][]>) => Promise<WriteBackHarness>) => {
  it('dismisses a group, restores it, and Undo puts the dismissal back', async () => {
    const { store } = await harnessOf(used, grids())

    await store.changeRows(DISMISSED_ROWS, { added: [dismissalCells('not-covered', deskGroup(store), DAY)], changed: [], removed: [] })
    expect(coverageOf(store).coverage.notCovered.map((group) => group.key)).not.toContain(DESK_KEY)
    expect(store.state.workbook?.dismissals.map((dismissal) => [dismissal.key, dismissal.dismissedOn])).toEqual([[DESK_KEY, DAY]])

    const row = store.state.snapshot!.dismissed[0]!
    await store.changeRows(DISMISSED_ROWS, { added: [], changed: [], removed: [rowCellsOf(row, DISMISSED_ROWS)] })
    expect(coverageOf(store).coverage.notCovered.map((group) => group.key)).toContain(DESK_KEY)
    expect(store.state.snapshot?.dismissed).toEqual([])

    await store.undo(store.state.writes[0]!)
    expect(store.state.workbook?.dismissals.map((dismissal) => dismissal.key)).toEqual([DESK_KEY])
  })
})

describe('dismissals written to a Google Sheet without the tab', () => {
  it('adds the dismissed tab with the template’s header once the person agreed, the day as a date cell', async () => {
    const { store, sheets } = await googleHarness(used, grids(false))
    const change = { added: [dismissalCells('not-covered', deskGroup(store), DAY)], changed: [], removed: [] }

    await expect(store.changeRows(DISMISSED_ROWS, change)).rejects.toThrow('The workbook has no dismissed tab')
    await store.changeRows(DISMISSED_ROWS, change, true)

    const dismissed = (await sheets.sheetGrids()).get('dismissed')!.sheetId
    expect(sentRequests(sheets).map((request) => Object.keys(request)[0])).toEqual(['addSheet', 'updateCells', 'appendCells', 'repeatCell'])
    expect(sentRequests(sheets)[3]).toEqual(dateFormat(dismissed, 1, 3))
    expect(sheets.grids.dismissed?.[0]).toEqual([...HEADER, 'id'])
    expect(store.state.snapshot?.meta.missingTabs).not.toContain('dismissed')
    expect(coverageOf(store).coverage.notCovered.map((group) => group.key)).not.toContain(DESK_KEY)
  })
})
