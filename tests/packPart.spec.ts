import { describe, expect, it } from 'vitest'

import { readWorkbook } from '../src/features/workbook/domain/readWorkbook'
import { fakeWorkbookSnapshot } from './fixtures/fakeBooks'
import { readSnapshot } from '../src/features/workbook/infrastructure/spreadsheetTab'
import { HR_DOO, HR_DOO_PART, hrDooWorkbook } from '../src/packs/hr-doo/domain/hrDooPart'

const snapshot = fakeWorkbookSnapshot('2026-10-16T08:00:00.000Z', 'browser')
const { records, workbook } = readSnapshot(snapshot)
const identity = { id: workbook.id, source: workbook.source, title: workbook.title, syncedAt: workbook.syncedAt }

describe('the pack part', () => {
  it('reads the pack records into the part, and hands core the owner advances and the rows it keeps whole', () => {
    const books = hrDooWorkbook(workbook)

    expect(Object.keys(workbook.packParts)).toEqual([HR_DOO.name])
    expect(books.assets.length).toBeGreaterThan(0)
    expect(books.yearEndLines.length).toBeGreaterThan(0)
    expect(books.companyFacts.residenceCity).toBe('Zagreb')
    expect(workbook.ownerAdvances).toBe(books.ownerAdvances)
    expect(workbook.ownerAdvances.length).toBeGreaterThan(0)
    expect(workbook.rowsKeptWhole.size).toBeGreaterThan(0)
  })

  it('leaves core as it is without the pack, which then reads none of its records and reports its keys as unknown', () => {
    const core = readWorkbook(identity, records, null)
    const withPack = readWorkbook(identity, records, HR_DOO_PART)

    expect(core.packParts).toEqual({})
    expect(core.ownerAdvances).toEqual([])
    expect(core.rowsKeptWhole.size).toBe(0)
    expect(core.transactions).toEqual(withPack.transactions)
    expect(core.invoices).toEqual(withPack.invoices)
    expect(core.settings).toEqual(withPack.settings)
    const settingProblems = core.problems.filter((problem) => problem.tab === 'settings')
    expect(settingProblems.length).toBeGreaterThan(0)
    expect(settingProblems.every((problem) => problem.label.startsWith('hr_') && problem.reason === 'not a setting this app knows, so it is kept but not used')).toBe(true)
    expect(withPack.problems.filter((problem) => problem.tab === 'settings')).toEqual([])
    expect(() => hrDooWorkbook(core)).toThrow('without the hr-doo pack')
  })
})
