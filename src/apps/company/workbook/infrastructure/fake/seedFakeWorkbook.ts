import { answerKunaStart, forgetKunaStart } from '../../../../../shared/app/kunaStart'
import { replaceBrowserDocument } from '../../../../../shared/storage/infrastructure/browserDocument'
import { decodeDocument, encodeDocument } from '../../../../../shared/storage/infrastructure/documentFormat'
import type { DocumentCopy } from '../../../../../shared/storage/infrastructure/documentRecordStorage'
import { COMPANY_APP } from '../../domain/companyApp'
import { createDriveDocument, documentName } from '../../../../../shared/storage/infrastructure/driveDocument'
import { failNextUpload, fakeBooksFolder, fakeDriveSession, raceTheNextSave, seedFakeBackups, slowUploads } from '../../../../../shared/storage/infrastructure/fake/fakeDriveSession'
import { openWorkbookCache } from '../../../../../shared/storage/infrastructure/workbookCache'
import { saveWorkbookChoice } from '../../../../../shared/storage/infrastructure/workbookChoice'
import { MAIL_SOURCE_PROPERTY } from '../../../../../shared/mail-filing/domain/mailSource'
import { FAKE_MAIL_SETTINGS } from '../../../mail/infrastructure/fake/fakeMailbox'
import { FAKE_FOLDERS, FAKE_WORKBOOK_ID, categoryMovePlanRecords, fakeWorkbookDocument } from './fakeWorkbook'
import { sampleCopiedLedgerRow } from '../../../imports/infrastructure/fake/sampleImportFiles'
import type { FakeStaff } from './fakeWorkbook'

const DAY = 86_400_000

/** The variants that start without the records of a kind, by the end of their name. */
/** Each load of the fake build starts with the home welcome unanswered, unless the address says otherwise, so one check's answer does not reach the next. */
function seedFakeStart(home: string | null): void {
  forgetKunaStart()
  if (home === 'drive' || home === 'browser') answerKunaStart({ home, apps: ['company', 'loans', 'assets'] })
}

const LEFT_OUT: readonly (readonly [suffix: string, kind: string])[] = [
  ['no-billing-plan', 'billing-item'],
  ['no-scenarios', 'hr-doo.scenario-component'],
  ['no-plan', 'hr-doo.plan-line'],
  ['no-ledger', 'ledger-row'],
]

/**
 * Fills the browser from the synthetic workbook, as a successful sync would, and chooses it: a file
 * on the fake build's Drive, or with `?fake=browser` a workbook kept in this browser with changes nine
 * days past their last export, and `?fake=mail-move` books whose statements folder on the fake Drive holds a mix for a move, `?fake=browser-beside-drive` that workbook with a file another
 * device made on the fake Drive too. `?fake=empty` keeps nothing, which is a first run. A variant that ends
 * in `no-billing-plan`, `no-scenarios`, `no-plan` or `no-ledger` starts without those records. `?fake=newer-file`
 * is a file a newer app saved, and with `?fake=race` another device saves at the same moment as the
 * first save, with `?fake=slow-writes` every save takes a few seconds to land, and with `?fake=save-fails` the first of them then fails. A variant that starts with `mail` names the bank's mail, which the
 * fake mailbox answers. A variant a pack pays a made-up staff in, which `staffOf` gives, pays them in place of
 * the owner's flat salary. Only the company app's install imports this, behind an inline VITE_FAKE_WORKBOOK comparison,
 * so the module and its fixture never reach a production chunk. `?start=drive` or `?start=browser` is a person who already answered the home welcome, and `?backups` puts backups beside a file on the fake Drive.
 * A variant that ends in `copied` adds a ledger row the AI copied that the sample camt statement's client payment looks like, and one that
 * ends in `category-move` adds plan rows a category's move joins or cannot change.
 */
export async function seedFakeWorkbook(variant: string | null, staffOf: (variant: string | null) => FakeStaff | null): Promise<void> {
  seedFakeStart(new URLSearchParams(window.location.search).get('start'))
  if (variant === 'empty') {
    saveWorkbookChoice(COMPANY_APP, null)
    return
  }
  const source = variant?.startsWith('browser') ? 'browser' : 'drive'
  const now = Date.now()
  const savedAt = new Date(now).toISOString()
  const seeded = fakeWorkbookDocument(savedAt, source, staffOf(variant))
  const full = variant?.endsWith('copied') ? { ...seeded, records: { ...seeded.records, 'ledger-row': [sampleCopiedLedgerRow(), ...(seeded.records['ledger-row'] ?? [])] } } : seeded
  const missing = LEFT_OUT.find(([suffix]) => variant?.endsWith(suffix))?.[1] ?? null
  const planned = variant?.endsWith('category-move') ? { ...full, records: { ...full.records, 'hr-doo.plan-line': [...(full.records['hr-doo.plan-line'] ?? []), ...categoryMovePlanRecords()] } } : full
  const kept = missing === null ? planned : { ...planned, records: { ...planned.records, [missing]: [] } }
  const mailed = variant?.startsWith('mail') ? { ...kept, records: { ...kept.records, setting: [...(kept.records.setting ?? []), ...FAKE_MAIL_SETTINGS] } } : kept
  const document = variant === 'newer-file' ? { ...mailed, schema: { ...mailed.schema, core: (mailed.schema.core ?? 0) + 1 } } : mailed
  if (variant === 'race') {
    raceTheNextSave(otherDeviceSave)
  }
  if (variant === 'slow-writes' || variant === 'save-fails') {
    slowUploads()
  }
  if (variant === 'save-fails') {
    failNextUpload()
  }
  const text = encodeDocument(document)
  if (variant === 'browser-beside-drive') {
    await onFakeDrive(text, savedAt, document)
  }
  const copy: DocumentCopy =
    source === 'browser'
      ? {
          meta: {
            id: FAKE_WORKBOOK_ID,
            source,
            title: 'Fake workbook',
            syncedAt: savedAt,
            lastExportedAt: new Date(now - 12 * DAY).toISOString(),
            unexportedSince: new Date(now - 9 * DAY).toISOString(),
          },
          revision: (await replaceBrowserDocument(FAKE_WORKBOOK_ID, text)).revision,
          document,
        }
      : await onFakeDrive(text, savedAt, document)
  if (variant === 'mail-move') {
    await seedMixedStatements()
  }
  if (source === 'drive' && new URLSearchParams(window.location.search).has('backups')) {
    await seedFakeBackups(copy.meta.id, COMPANY_APP)
  }
  const cache = openWorkbookCache(copy.meta.id)
  try {
    await cache.replace(copy)
  } finally {
    cache.close()
  }
  saveWorkbookChoice(COMPANY_APP, { source, id: copy.meta.id, name: copy.meta.title })
}

/** The save another device makes in a race: the snack kiosk's row filed as travel on a phone. */
function otherDeviceSave(text: string): string {
  const document = decodeDocument(text)
  const ledger = (document.records['ledger-row'] ?? []).map((row) => (row.counterparty === 'SNACK KIOSK' ? { ...row, category: 'travel', flagged_by: 'phone' } : row))
  return encodeDocument({ ...document, records: { ...document.records, 'ledger-row': ledger } })
}

/** A made-up statements folder holding a statement Kuna filed from mail, one a script filed and a file another mail source filed, for the move to sort out. */
async function seedMixedStatements(): Promise<void> {
  const drive = fakeDriveSession()
  const finance = await drive.createFolder('root', FAKE_FOLDERS.statements[0])
  const statements = await drive.createFolder(finance, FAKE_FOLDERS.statements[1])
  const year = await drive.createFolder(statements, `2026-${FAKE_FOLDERS.statements[1]}`)
  await drive.createFile(year, '2026-09-01-statement-010-main.xml', '<Document/>', { [MAIL_SOURCE_PROPERTY]: 'statements' })
  const scripted = await drive.createFile(year, '2026-09-02-statement-011-main.xml', '<Document/>')
  drive.file(scripted.id).isAppAuthorized = false
  await drive.createFile(year, '2026-09-pdv.xlsx', 'made up', { [MAIL_SOURCE_PROPERTY]: 'vat' })
}

async function onFakeDrive(text: string, savedAt: string, document: DocumentCopy['document']): Promise<DocumentCopy> {
  const created = await createDriveDocument(fakeDriveSession(), await fakeBooksFolder(), COMPANY_APP, text)
  return {
    meta: { id: created.fileId, source: 'drive', title: documentName(COMPANY_APP), syncedAt: savedAt, lastExportedAt: null, unexportedSince: null },
    revision: created.document.revision,
    document,
  }
}
