// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import { fileMail, planLine } from '../src/features/mail/application/mailFiling'
import { statementMailSource } from '../src/features/mail/application/statementMailSource'
import { FAKE_MAIL_SETTINGS, fakeMailFolders, fakeMailbox } from '../src/features/mail/infrastructure/fake/fakeMailbox'
import { loadImportFile } from '../src/features/imports/infrastructure/importFiles'
import { FAKE_WORKBOOK_ID, fakeWorkbookDocument } from '../src/features/workbook/infrastructure/fake/fakeWorkbook'
import { tabsOfDocument } from '../src/features/workbook/infrastructure/spreadsheetDocument'
import { readSnapshot } from '../src/features/workbook/infrastructure/spreadsheetTab'
import { sha256Hex } from '../src/shared/files/sha256'
import { ACCOUNTANT_MAIL_SOURCES } from '../src/packs/hr-doo/application/accountantMailSources'
import { fakeStatementFolder } from '../src/features/imports/infrastructure/fake/fakeStatementFolder'
import { sampleCamtLabel, sampleCamtXml } from '../src/features/imports/infrastructure/fake/sampleImportFiles'
import type { FakeMadeFile } from '../src/features/workbook/infrastructure/fake/fakeFolderFiles'
import { FAKE_FOLDERS } from '../src/features/workbook/infrastructure/fake/fakeWorkbook'

const AT = '2026-10-16T08:00:00.000Z'

/** The fake books with the mail rows the `?fake=mail` variants add, read as the app reads them. */
function mailBooks() {
  const document = fakeWorkbookDocument(AT)
  const mailed = { ...document, records: { ...document.records, setting: [...(document.records.setting ?? []), ...FAKE_MAIL_SETTINGS] } }
  return readSnapshot({ meta: { id: FAKE_WORKBOOK_ID, source: 'drive', title: 'Fake workbook', syncedAt: AT, lastExportedAt: null, unexportedSince: null }, ...tabsOfDocument(mailed) })
}

function planFake(variant: string, made: FakeMadeFile[] = []) {
  const { workbook } = mailBooks()
  expect(workbook.problems).toEqual([])
  return fileMail({
    mailbox: fakeMailbox(variant),
    folders: fakeMailFolders(variant, made),
    sources: [statementMailSource(loadImportFile, 'Europe/Zagreb'), ...ACCOUNTANT_MAIL_SOURCES],
    workbook,
    sinceStart: Date.parse('2025-12-31T23:00:00Z'),
    hash: sha256Hex,
    report: () => {},
  })
}

describe('the fake mailbox', () => {
  it('files the bank’s new PDF and the sample statement into the fake Drive, where the statements folder lists the statement, and a second run files nothing new', async () => {
    const made: FakeMadeFile[] = []
    const folder = fakeStatementFolder('mail', made)
    const before = await folder.files(FAKE_FOLDERS.statements)

    await planFake('mail', made)
    const after = await folder.files(FAKE_FOLDERS.statements)
    const again = await planFake('mail', made)

    const sample = `${sampleCamtLabel()}-main.xml`
    expect(before.kind === 'listed' && before.files.some((file) => file.name === sample)).toBe(false)
    expect(made.map((file) => [file.folder.join('/'), file.folders.join('/'), file.name])).toEqual([
      ['finance/statements', `${sample.slice(0, 4)}-statements`, sample],
      ['finance/statements', `${made[1]?.name.slice(0, 4)}-statements`, made[1]?.name],
    ])
    expect(made[1]?.name).toMatch(/^\d{4}-\d{2}-\d{2}-statement-\d{3}\.pdf$/)
    const listed = after.kind === 'listed' ? after.files.find((file) => file.name === sample) : undefined
    expect(new TextDecoder().decode(await folder.download(listed!))).toBe(sampleCamtXml())
    expect(planLine(again)).toBe('Would file 7, already there 5, 1 correction, 1 not compared, 1 unmatched.')
    expect(again.sources[0]?.kind === 'planned' && again.sources[0].entries.map((entry) => entry.kind)).toEqual(['already', 'already', 'already'])
    expect(made).toHaveLength(2)
  })

  it('holds mail of every kind the list shows: some filed, some to file, some already there, a correction, one not compared and two unmatched', async () => {
    const plan = await planFake('mail')

    expect(plan.sources.map((source) => [source.id, source.kind])).toEqual([
      ['statements', 'planned'],
      ['hr-doo.payroll', 'planned'],
      ['hr-doo.vat-returns', 'planned'],
      ['hr-doo.invoices', 'planned'],
    ])
    expect(planLine(plan)).toBe('Filed 2, would file 7, already there 4, 1 correction, 1 not compared, 2 unmatched.')
  })

  it('holds only mail already filed for nothing new, fails the VAT search beside the others, and fails the upload of a PDF beside its statement', async () => {
    const made: FakeMadeFile[] = []
    const uploadFailed = await planFake('mail-upload-failed', made)

    expect(planLine(await planFake('mail-nothing-new'))).toBe('Nothing new, already there 5.')
    expect(planLine(await planFake('mail-failed'))).toBe('Filed 2, would file 6, already there 4, 2 unmatched. VAT returns: Gmail did not answer the search. Sync again later.')
    expect(planLine(uploadFailed)).toMatch(/^Filed 1, would file 7, already there 4, 1 correction, 1 not compared, 2 unmatched\. Bank statements: \d{4}-\d{2}-\d{2}-statement-\d{3}\.pdf was not filed\.$/)
    expect(made.map((file) => file.name)).toEqual([`${sampleCamtLabel()}-main.xml`])
  })
})
