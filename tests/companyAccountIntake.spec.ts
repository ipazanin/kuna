import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { firstVatOpenDay, vatReturnDue } from '../src/apps/company/packs/hr-doo/domain/vatFiledDays'
import { ACCOUNT_WRITES } from '../src/apps/company/settings/application/namedRecordWrites'
import { derivedIntake, folderFiledOnSync, statementMailReach } from '../src/apps/company/workbook/domain/accountIntakes'
import { isBankStatementRow } from '../src/apps/company/workbook/domain/rowOrigin'
import type { AccountRecord } from '../src/apps/company/workbook/domain/accountsReading'
import { BY_HAND } from '../src/shared/app/accountSource'
import { parseCivilDate } from '../src/shared/calendar/civilDate'
import type { CivilDate } from '../src/shared/calendar/civilDate'
import { WorkbookWriteRefused } from '../src/shared/storage/application/workbookWriteRefused'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import type { RecordsRead } from '../src/shared/storage/domain/recordsRead'
import type { SettingRow } from '../src/shared/storage/domain/settingRows'
import { SETTING_RECORDS } from '../src/apps/company/workbook/domain/coreKinds'
import { COMPANY, LEDGER_HEADER, browserHarness, forgetCaches, workbookGrids } from './fixtures/writeBack'

const used = new Set<string>()
afterEach(async () => forgetCaches(used))

function day(text: string): CivilDate {
  return parseCivilDate(text)!
}

/** The settings rows as stored, with only the fields the derivation reads. */
function settingRows(rows: readonly (readonly [string, string])[]): RecordsRead<SettingRow> {
  return { records: rows.map(([key, value]) => ({ record: { id: recordIdOf(SETTING_RECORDS, key), key, value }, id: recordIdOf(SETTING_RECORDS, key), label: key, fields: {} })), refused: [] }
}

describe('where a ledger row came from', () => {
  it.each([
    ['a camt statement', '2026-10-05-statement-002', 'REF-4', true],
    ['a camt statement numbered past 999', '2026-10-05-statement-1002', 'REF-4', true],
    ['a bank sheet, named by its file', 'promet (ffffffff)', 'X-1', false],
    ['a copied statement', 'main, October', 'read-main-1', false],
    ['a copied statement labelled as a camt one', '2026-10-05-statement-002', 'read-main-1', false],
  ])('%s is the bank statement: %s', (_label, statement, reference, fromBank) => {
    expect(isBankStatementRow({ statement, reference })).toBe(fromBank)
  })
})

describe("the day the bank's statement mail reaches back to", () => {
  const mail = (slug: string, startsOn: string) => ({ slug, intake: { rowsFrom: 'mail' as const, startsOn: day(startsOn), alsoFrom: [] } })
  const row = (account: string, date: string, statement: string, reference = `${account}-${date}`) => ({ account, date: day(date), statement, reference })

  it('is the oldest of the newest statement day of each account the mail fills, so an account furthest behind keeps its statements in the search', () => {
    const ledger = [row('main', '2026-10-01', '2026-10-01-statement-010'), row('main', '2026-11-10', '2026-11-10-statement-030'), row('savings', '2026-10-20', '2026-10-20-statement-004')]

    expect(statementMailReach([mail('main', '2026-09-01'), mail('savings', '2026-09-01')], ledger, [])).toBe('2026-10-20')
  })

  it('is the start day of an account with no statement row on or after it, and leaves out rows by hand and accounts kept by hand', () => {
    const ledger = [
      row('main', '2026-11-10', '2026-11-10-statement-030'),
      row('reserve', '2026-11-12', 'export (aaaaaaaa)'),
      row('reserve', '2026-10-01', '2026-10-01-statement-001'),
      row('hand', '2026-01-01', '2026-01-01-statement-001'),
    ]

    expect(statementMailReach([mail('main', '2026-09-01'), mail('reserve', '2026-11-05'), { slug: 'hand', intake: BY_HAND }], ledger, [])).toBe('2026-11-05')
  })

  it('is null while the mail fills no account', () => {
    expect(statementMailReach([{ slug: 'hand', intake: BY_HAND }], [], [])).toBeNull()
  })

  it('reaches back to the mail of a held statement that waits, and no longer once the person passed it over', () => {
    const ledger = [row('main', '2026-11-10', '2026-11-10-statement-030')]
    const waiting = { mailedOn: day('2026-10-02'), passedOverOn: null }

    expect(statementMailReach([mail('main', '2026-09-01')], ledger, [waiting])).toBe('2026-10-02')
    expect(statementMailReach([mail('main', '2026-09-01')], ledger, [{ ...waiting, passedOverOn: day('2026-11-15') }])).toBe('2026-11-10')
    expect(statementMailReach([mail('main', '2026-09-01')], ledger, [{ ...waiting, mailedOn: day('2026-11-18') }])).toBe('2026-11-10')
  })
})

describe('an account that does not say how its rows come in', () => {
  const row = (date: string, sequence: number, statement: string, reference = `R-${sequence}`) => ({ account: 'main', date: day(date), sequence, statement, reference })

  it("reads as filled by the bank's statements from the first statement after its last row by hand, once the folder was filed on sync", () => {
    const ledger = [row('2026-01-10', 1, 'export (aaaaaaaa)'), row('2026-02-03', 2, '2026-02-03-statement-001'), row('2026-03-03', 3, '2026-03-03-statement-002')]
    expect(derivedIntake({ slug: 'main' }, ledger, true)).toEqual({ rowsFrom: 'mail', startsOn: '2026-02-03', alsoFrom: [] })
  })

  it('starts the day after a row by hand on the same day as the first statement', () => {
    const ledger = [row('2026-02-03', 1, 'main, February', 'read-1'), row('2026-02-03', 2, '2026-02-03-statement-001')]
    expect(derivedIntake({ slug: 'main' }, ledger, true)).toEqual({ rowsFrom: 'mail', startsOn: '2026-02-04', alsoFrom: [] })
  })

  it('reads as by hand when its newest row is by hand, when it has none, or when the folder was not filed on sync', () => {
    const ledger = [row('2026-02-03', 1, '2026-02-03-statement-001'), row('2026-03-01', 2, 'export (aaaaaaaa)')]
    expect(derivedIntake({ slug: 'main' }, ledger, true)).toEqual(BY_HAND)
    expect(derivedIntake({ slug: 'savings' }, ledger, true)).toEqual(BY_HAND)
    expect(derivedIntake({ slug: 'main' }, ledger.slice(0, 1), false)).toEqual(BY_HAND)
  })

  it.each([
    [[['statements_folder', 'Books/statements']], true],
    [
      [
        ['statements_folder', 'Books/statements'],
        ['statements_sync', 'FALSE'],
      ],
      false,
    ],
    [
      [
        ['statements_folder', 'Books/statements'],
        ['statements_sync', 'TRUE'],
      ],
      true,
    ],
    [[], false],
  ] as const)('reads settings %o as the folder filed on sync: %s', (rows, filed) => {
    expect(folderFiledOnSync(settingRows(rows))).toBe(filed)
  })
})

describe('a VAT return', () => {
  it.each([
    ['2025-11', '2025-12-20'],
    ['2025-12', '2026-01-20'],
    ['2026-01', '2026-02-28'],
    ['2026-10', '2026-11-30'],
  ])('of %s is due on %s', (month, due) => {
    expect(vatReturnDue(month as Parameters<typeof vatReturnDue>[0])).toBe(due)
  })

  it.each([
    ['2026-11-17', '2026-10-01'],
    ['2026-11-30', '2026-10-01'],
    ['2026-12-01', '2026-11-01'],
    ['2026-01-20', '2025-12-01'],
    ['2026-01-21', '2026-01-01'],
  ])('leaves on %s the first day not filed at %s', (today, first) => {
    expect(firstVatOpenDay(day(today))).toBe(first)
  })
})

describe("the writes of an account's source", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-17T10:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  async function storeOf() {
    const grids = workbookGrids()
    return (await browserHarness(used, { ...grids, ledger: [LEDGER_HEADER, ...grids.ledger!.slice(1).map((cells) => [...cells])] }, COMPANY)).store
  }

  const mailFrom = (main: AccountRecord, startsOn: string): AccountRecord => ({ ...main, intake: { rowsFrom: 'mail', startsOn: day(startsOn), alsoFrom: [] } })

  it("refuses a start day over the harness's rows by hand and in a filed VAT month, and takes one after them", async () => {
    const store = await storeOf()
    const main = store.state.records!.accounts.records[0]!.record
    // The harness's rows of main are a bank sheet's, up to 5 Oct 2026, and September's return was due on 31 Oct 2026.
    await expect(store.write('Mail', (unit) => unit.of(ACCOUNT_WRITES).change(main, mailFrom(main, '2026-09-30')))).rejects.toThrow(WorkbookWriteRefused)
    await expect(store.write('Mail', (unit) => unit.of(ACCOUNT_WRITES).change(main, mailFrom(main, '2026-10-05')))).rejects.toThrow(/rows by hand from 5 Oct 2026/)
    await store.write('Mail', (unit) => unit.of(ACCOUNT_WRITES).change(main, mailFrom(main, '2026-10-06')))
    expect(store.state.workbook!.accounts[0]!.intake).toEqual({ rowsFrom: 'mail', startsOn: '2026-10-06', alsoFrom: [] })
  })
})
