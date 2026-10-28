import { replaceBrowserDocument } from '../../../../../shared/storage/infrastructure/browserDocument'
import { decodeDocument, encodeDocument } from '../../../../../shared/storage/infrastructure/documentFormat'
import type { DocumentCopy } from '../../../../../shared/storage/infrastructure/documentRecordStorage'
import { COMPANY_APP } from '../companyDocument'
import { createDriveDocument, documentName } from '../../../../../shared/storage/infrastructure/driveDocument'
import { fakeBooksFolder, fakeDriveSession, raceTheNextSave } from '../../../../../shared/storage/infrastructure/fake/fakeDriveSession'
import { openWorkbookCache } from '../../../../../shared/storage/infrastructure/workbookCache'
import { saveWorkbookChoice } from '../../../../../shared/storage/infrastructure/workbookChoice'
import { fakeMailSettings } from '../../../mail/infrastructure/fake/fakeMailbox'
import { FAKE_WORKBOOK_ID, fakeWorkbookDocument } from './fakeWorkbook'
import type { FakeStaff } from './fakeWorkbook'

const DAY = 86_400_000

/** The variants that start without the records of a kind, by the end of their name. */
const LEFT_OUT: readonly (readonly [suffix: string, kind: string])[] = [
  ['no-billing-plan', 'billing-item'],
  ['no-scenarios', 'hr-doo.scenario-component'],
  ['no-plan', 'hr-doo.plan-line'],
]

/**
 * Fills the browser from the synthetic workbook, as a successful sync would, and chooses it: a file
 * on the fake build's Drive, or with `?fake=browser` a workbook kept in this browser with changes nine
 * days past their last export. `?fake=empty` keeps nothing, which is a first run. A variant that ends
 * in `no-billing-plan`, `no-scenarios` or `no-plan` starts without those records. `?fake=newer-file`
 * is a file a newer app saved, and with `?fake=race` another device saves at the same moment as the
 * first save. A variant that starts with `mail` names the bank's and the accountant's mail, which the
 * fake mailbox answers. A variant a pack pays a made-up staff in, which `staffOf` gives, pays them in place of
 * the owner's flat salary. Only the company app's install imports this, behind an inline VITE_FAKE_WORKBOOK comparison,
 * so the module and its fixture never reach a production chunk.
 */
export async function seedFakeWorkbook(variant: string | null, staffOf: (variant: string | null) => FakeStaff | null): Promise<void> {
  if (variant === 'empty') {
    saveWorkbookChoice(COMPANY_APP, null)
    return
  }
  const source = variant?.startsWith('browser') ? 'browser' : 'drive'
  const now = Date.now()
  const savedAt = new Date(now).toISOString()
  const full = fakeWorkbookDocument(savedAt, source, staffOf(variant))
  const missing = LEFT_OUT.find(([suffix]) => variant?.endsWith(suffix))?.[1] ?? null
  const kept = missing === null ? full : { ...full, records: { ...full.records, [missing]: [] } }
  const mailed = variant?.startsWith('mail') ? { ...kept, records: { ...kept.records, setting: [...(kept.records.setting ?? []), ...fakeMailSettings(variant)] } } : kept
  const document = variant === 'newer-file' ? { ...mailed, schema: { ...mailed.schema, core: (mailed.schema.core ?? 0) + 1 } } : mailed
  if (variant === 'race') {
    raceTheNextSave(otherDeviceSave)
  }
  const text = encodeDocument(document)
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

async function onFakeDrive(text: string, savedAt: string, document: DocumentCopy['document']): Promise<DocumentCopy> {
  const created = await createDriveDocument(fakeDriveSession(), await fakeBooksFolder(), COMPANY_APP, text)
  return {
    meta: { id: created.fileId, source: 'drive', title: documentName(COMPANY_APP), syncedAt: savedAt, lastExportedAt: null, unexportedSince: null },
    revision: created.document.revision,
    document,
  }
}
