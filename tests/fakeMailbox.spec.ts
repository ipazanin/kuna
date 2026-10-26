// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import { planLine, planMail } from '../src/features/mail/application/mailFiling'
import { statementMailSource } from '../src/features/mail/application/statementMailSource'
import { FAKE_MAIL_SETTINGS, fakeMailFolders, fakeMailbox } from '../src/features/mail/infrastructure/fake/fakeMailbox'
import { loadImportFile } from '../src/features/imports/infrastructure/importFiles'
import { FAKE_WORKBOOK_ID, fakeWorkbookDocument } from '../src/features/workbook/infrastructure/fake/fakeWorkbook'
import { tabsOfDocument } from '../src/features/workbook/infrastructure/spreadsheetDocument'
import { readSnapshot } from '../src/features/workbook/infrastructure/spreadsheetTab'
import { sha256Hex } from '../src/shared/files/sha256'
import { ACCOUNTANT_MAIL_SOURCES } from '../src/packs/hr-doo/application/accountantMailSources'

const AT = '2026-10-16T08:00:00.000Z'

/** The fake books with the mail rows the `?fake=mail` variants add, read as the app reads them. */
function mailBooks() {
  const document = fakeWorkbookDocument(AT)
  const mailed = { ...document, records: { ...document.records, setting: [...(document.records.setting ?? []), ...FAKE_MAIL_SETTINGS] } }
  return readSnapshot({ meta: { id: FAKE_WORKBOOK_ID, source: 'drive', title: 'Fake workbook', syncedAt: AT, lastExportedAt: null, unexportedSince: null }, ...tabsOfDocument(mailed) })
}

function planFake(variant: string) {
  const { workbook } = mailBooks()
  expect(workbook.problems).toEqual([])
  return planMail({
    mailbox: fakeMailbox(variant),
    folders: fakeMailFolders(),
    sources: [statementMailSource(loadImportFile, 'Europe/Zagreb'), ...ACCOUNTANT_MAIL_SOURCES],
    workbook,
    sinceStart: Date.parse('2025-12-31T23:00:00Z'),
    hash: sha256Hex,
    report: () => {},
  })
}

describe('the fake mailbox', () => {
  it('holds mail of every kind the list shows: some to file, some already there, a correction, one not compared and two unmatched', async () => {
    const plan = await planFake('mail')

    expect(plan.sources.map((source) => [source.id, source.kind])).toEqual([
      ['statements', 'planned'],
      ['hr-doo.payroll', 'planned'],
      ['hr-doo.vat-returns', 'planned'],
      ['hr-doo.invoices', 'planned'],
    ])
    expect(planLine(plan)).toBe('Would file 8, already there 5, 1 correction, 1 not compared, 2 unmatched.')
  })

  it('holds only mail already filed for nothing new, and fails the VAT search beside the others', async () => {
    expect(planLine(await planFake('mail-nothing-new'))).toBe('Nothing new, already there 5.')
    expect(planLine(await planFake('mail-failed'))).toBe('Would file 7, already there 5, 2 unmatched. VAT returns: Gmail did not answer the search. Sync again later.')
  })
})
