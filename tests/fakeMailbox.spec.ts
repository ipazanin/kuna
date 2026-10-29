// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import { MailRateLimited, fileMail, planLine } from '../src/apps/company/mail/application/mailFiling'
import { statementMailSource } from '../src/apps/company/mail/application/statementMailSource'
import { fakeMailFolders, fakeMailSettings, fakeMailbox } from '../src/apps/company/mail/infrastructure/fake/fakeMailbox'
import { loadImportFile } from '../src/apps/company/imports/infrastructure/importFiles'
import { FAKE_WORKBOOK_ID, fakeWorkbookDocument } from '../src/apps/company/workbook/infrastructure/fake/fakeWorkbook'
import { tabsOfDocument } from '../src/apps/company/workbook/infrastructure/spreadsheetDocument'
import { readSnapshot } from '../src/apps/company/workbook/infrastructure/spreadsheetTab'
import { sha256Hex } from '../src/shared/files/sha256'
import { ACCOUNTANT_MAIL_SOURCES } from '../src/apps/company/packs/hr-doo/application/accountantMailSources'
import { fakeStatementFolder } from '../src/apps/company/imports/infrastructure/fake/fakeStatementFolder'
import { sampleCamtLabel, sampleCamtXml } from '../src/apps/company/imports/infrastructure/fake/sampleImportFiles'
import type { FakeMadeFile } from '../src/apps/company/workbook/infrastructure/fake/fakeFolderFiles'
import { FAKE_FOLDERS } from '../src/apps/company/workbook/infrastructure/fake/fakeWorkbook'

const AT = '2026-10-16T08:00:00.000Z'

/** The fake books with the mail rows a `?fake=mail` variant adds, read as the app reads them. */
function mailBooks(variant: string) {
  const document = fakeWorkbookDocument(AT)
  const mailed = { ...document, records: { ...document.records, setting: [...(document.records.setting ?? []), ...fakeMailSettings(variant)] } }
  return readSnapshot({ meta: { id: FAKE_WORKBOOK_ID, source: 'drive', title: 'Fake workbook', syncedAt: AT, lastExportedAt: null, unexportedSince: null }, ...tabsOfDocument(mailed) })
}

function planFake(variant: string, made: FakeMadeFile[] = []) {
  const { workbook } = mailBooks(variant)
  expect(workbook.problems).toEqual([])
  return fileMail({
    open: async () => ({ mailbox: fakeMailbox(variant), folders: fakeMailFolders(variant, made) }),
    sources: [statementMailSource(loadImportFile, 'Europe/Zagreb'), ...ACCOUNTANT_MAIL_SOURCES],
    workbook,
    sinceStart: Date.parse('2025-12-31T23:00:00Z'),
    years: [2026],
    hash: sha256Hex,
    report: () => {},
  })
}

describe('the fake mailbox', () => {
  it('files the bank’s new PDF, the sample statement and the accountant’s new mail into the fake Drive, where the statements folder lists the statement, and a second run files nothing new', async () => {
    const made: FakeMadeFile[] = []
    const folder = fakeStatementFolder('mail', made)
    const before = await folder.files(FAKE_FOLDERS.statements)

    await planFake('mail', made)
    const after = await folder.files(FAKE_FOLDERS.statements)
    const again = await planFake('mail', made)

    const sample = `${sampleCamtLabel()}-main.xml`
    expect(before.kind === 'listed' && before.files.some((file) => file.name === sample)).toBe(false)
    // The sources file at the same time, so the files are compared folder by folder, each in the order it was made.
    const byFolder = [...made].sort((first, second) => first.folder.join('/').localeCompare(second.folder.join('/')))
    const statementPdf = byFolder[7]?.name
    expect(byFolder.map((file) => [file.folder.join('/'), file.folders.join('/'), file.name])).toEqual([
      ['finance/incoming-invoices', '2026-incoming-invoices/2026-10', '2026-10-03-accounting.pdf'],
      ['finance/payroll', '2026-payroll/2026-09', '2026-09-salary.xlsx'],
      ['finance/payroll', '2026-payroll/2026-09', '2026-09-payment-order-salary.pdf'],
      ['finance/payroll', '2026-payroll/2026-09', '2026-09-payment-order-salary.xml'],
      ['finance/payroll', '2026-payroll/2026-09', '2026-09-payment-order-rent.pdf'],
      ['finance/payroll', '2026-payroll/2026-09', '2026-09-payment-order-rent.xml'],
      ['finance/statements', `${sample.slice(0, 4)}-statements`, sample],
      ['finance/statements', `${statementPdf?.slice(0, 4)}-statements`, statementPdf],
      ['finance/vat-returns', '2026-vat-returns', '2026-09-pdv.xlsx'],
    ])
    expect(statementPdf).toMatch(/^\d{4}-\d{2}-\d{2}-statement-\d{3}\.pdf$/)
    const listed = after.kind === 'listed' ? after.files.find((file) => file.name === sample) : undefined
    expect(new TextDecoder().decode(await folder.download(listed!))).toBe(sampleCamtXml())
    expect(planLine(again)).toBe('Nothing new, already there 10, 1 unmatched.')
    expect(again.sources[0]?.kind === 'planned' && again.sources[0].entries.map((entry) => entry.kind)).toEqual(['already', 'already', 'already'])
    expect(made).toHaveLength(9)
  })

  it('holds mail of every kind the list shows: some filed, some already there, a correction, one not compared and two unmatched', async () => {
    const plan = await planFake('mail')

    expect(plan.sources.map((source) => [source.id, source.kind])).toEqual([
      ['statements', 'planned'],
      ['hr-doo.payroll', 'planned'],
      ['hr-doo.vat-returns', 'planned'],
      ['hr-doo.invoices', 'planned'],
    ])
    expect(planLine(plan)).toBe('Filed 9, already there 4, 1 correction, 1 not compared, 2 unmatched.')
  })

  it('holds only mail already filed for nothing new, fails the VAT search beside the others, and fails the upload of every PDF beside the other files', async () => {
    const made: FakeMadeFile[] = []
    const uploadFailed = await planFake('mail-upload-failed', made)

    expect(planLine(await planFake('mail-nothing-new'))).toBe('Nothing new, already there 5.')
    expect(planLine(await planFake('mail-failed'))).toBe('Filed 8, already there 4, 2 unmatched. VAT returns: Gmail did not answer the search. Sync again later.')
    expect(planLine(uploadFailed)).toMatch(
      /^Filed 5, already there 4, 1 correction, 1 not compared, 2 unmatched\. Bank statements: \d{4}-\d{2}-\d{2}-statement-\d{3}\.pdf was not filed\. Payroll: 2026-09-payment-order-salary\.pdf and 2026-09-payment-order-rent\.pdf were not filed\. Accountant's invoices: 2026-10-03-accounting\.pdf was not filed\.$/,
    )
    expect(made.map((file) => file.name)).toEqual([`${sampleCamtLabel()}-main.xml`, '2026-09-salary.xlsx', '2026-09-payment-order-salary.xml', '2026-09-payment-order-rent.xml', '2026-09-pdv.xlsx'])
  })

  it('stops on Gmail asking to slow down, reads only the bank’s mail with the accountant’s switches off, and fails the payroll switched on without the accountant’s address', async () => {
    await expect(planFake('mail-rate-limited')).rejects.toBeInstanceOf(MailRateLimited)
    const off = await planFake('mail-switches-off')
    const noSender = await planFake('mail-no-sender')

    expect(off.sources.map((source) => source.id)).toEqual(['statements'])
    expect(planLine(off)).toBe('Filed 2, already there 2, 1 unmatched.')
    expect(planLine(noSender)).toBe('Filed 2, already there 2, 1 unmatched. Payroll: It is on, but has no sender on Settings, General.')
  })

  it('searches from a week before the newest file in each folder once the mail is already there, not from the mail-since day', async () => {
    const plan = await planFake('mail-nothing-new')

    expect(plan.sources.map((source) => source.kind === 'planned' && source.window.after)).toEqual(['newest', 'newest', 'newest', 'newest'])
  })
})
