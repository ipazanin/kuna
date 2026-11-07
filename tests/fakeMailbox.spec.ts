// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import { MailRateLimited, fileMail, planLine } from '../src/shared/mail-filing/application/mailFiling'
import { statementMailSource } from '../src/apps/company/mail/application/statementMailSource'
import { FAKE_MAIL_SETTINGS, fakeMailFolders, fakeMailbox } from '../src/apps/company/mail/infrastructure/fake/fakeMailbox'
import { loadImportFile } from '../src/apps/company/imports/infrastructure/importFiles'
import { FAKE_WORKBOOK_ID, fakeWorkbookDocument } from '../src/apps/company/workbook/infrastructure/fake/fakeWorkbook'
import { tabsOfDocument } from '../src/apps/company/workbook/infrastructure/spreadsheetDocument'
import { readSnapshot } from '../src/apps/company/workbook/infrastructure/spreadsheetTab'
import { fakeStatementFolder } from '../src/apps/company/imports/infrastructure/fake/fakeStatementFolder'
import { sampleCamtLabel, sampleCamtXml } from '../src/apps/company/imports/infrastructure/fake/sampleImportFiles'
import type { FakeMadeFile } from '../src/shared/mail-filing/infrastructure/fake/fakeMail'
import { FAKE_FOLDERS } from '../src/apps/company/workbook/infrastructure/fake/fakeWorkbook'

const AT = '2026-10-16T08:00:00.000Z'

/** The fake books with the mail rows a `?fake=mail` variant adds, read as the app reads them. */
function mailBooks() {
  const document = fakeWorkbookDocument(AT)
  const mailed = { ...document, records: { ...document.records, setting: [...(document.records.setting ?? []), ...FAKE_MAIL_SETTINGS] } }
  return readSnapshot({ meta: { id: FAKE_WORKBOOK_ID, source: 'drive', title: 'Fake workbook', syncedAt: AT, lastExportedAt: null, unexportedSince: null }, ...tabsOfDocument(mailed) })
}

function planFake(variant: string, made: FakeMadeFile[] = []) {
  const { workbook } = mailBooks()
  expect(workbook.problems).toEqual([])
  return fileMail({
    open: async () => ({ mailbox: fakeMailbox(variant), folders: fakeMailFolders(variant, made) }),
    sources: [statementMailSource(loadImportFile, 'Europe/Zagreb')],
    books: workbook,
    sinceStart: Date.parse('2025-12-31T23:00:00Z'),
    years: [2026],
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
    const statementPdf = made[1]?.name
    expect(made.map((file) => [file.folder.join('/'), file.folders.join('/'), file.name])).toEqual([
      ['finance/statements', `${sample.slice(0, 4)}-statements`, sample],
      ['finance/statements', `${statementPdf?.slice(0, 4)}-statements`, statementPdf],
    ])
    expect(statementPdf).toMatch(/^\d{4}-\d{2}-\d{2}-statement-\d{3}\.pdf$/)
    const listed = after.kind === 'listed' ? after.files.find((file) => file.name === sample) : undefined
    expect(new TextDecoder().decode(await folder.download(listed!))).toBe(sampleCamtXml())
    expect(planLine(again)).toBe('Nothing new, already there 3.')
    expect(again.sources[0]?.kind === 'planned' && again.sources[0].entries.map((entry) => entry.kind)).toEqual(['already', 'already', 'already'])
  })

  it('holds only mail already filed for nothing new, fails the bank’s search, and fails the upload of the statement’s PDF beside its XML', async () => {
    const made: FakeMadeFile[] = []
    const uploadFailed = await planFake('mail-upload-failed', made)

    expect(planLine(await planFake('mail-nothing-new'))).toBe('Nothing new, already there 3.')
    expect(planLine(await planFake('mail-failed'))).toBe('Bank statements: Gmail did not answer the search. Sync again later.')
    expect(planLine(uploadFailed)).toMatch(/^Filed 1, already there 2, 1 unmatched\. Bank statements: \d{4}-\d{2}-\d{2}-statement-\d{3}\.pdf was not filed\.$/)
    expect(made.map((file) => file.name)).toEqual([`${sampleCamtLabel()}-main.xml`])
  })

  it('stops on Gmail asking to slow down', async () => {
    await expect(planFake('mail-rate-limited')).rejects.toBeInstanceOf(MailRateLimited)
  })

  it('searches from a week before the newest file in the folder once the mail is already there, not from the mail-since day', async () => {
    const plan = await planFake('mail-nothing-new')

    expect(plan.sources.map((source) => source.kind === 'planned' && source.window.after)).toEqual(['newest'])
  })
})
