import { replaceBrowserDocument } from '../browserDocument'
import { encodeDocument } from '../documentFormat'
import type { DocumentCopy } from '../documentRecordStorage'
import { COMPANY_APP } from '../documentStorePorts'
import { createDriveDocument, documentName } from '../driveDocument'
import { openWorkbookCache } from '../workbookCache'
import { saveWorkbookChoice } from '../workbookChoice'
import { fakeBooksFolder, fakeDriveSession, raceTheNextSave } from './fakeDriveSession'
import { FAKE_WORKBOOK_ID, fakeWorkbookDocument } from './fakeWorkbook'

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
 * first save. Only main.ts imports this, behind an inline VITE_FAKE_WORKBOOK comparison, so the
 * module and its fixture never reach a production chunk.
 */
export async function seedFakeWorkbook(variant: string | null): Promise<void> {
  if (variant === 'empty') {
    saveWorkbookChoice(null)
    return
  }
  const source = variant?.startsWith('browser') ? 'browser' : 'drive'
  const now = Date.now()
  const savedAt = new Date(now).toISOString()
  const full = fakeWorkbookDocument(savedAt, source)
  const missing = LEFT_OUT.find(([suffix]) => variant?.endsWith(suffix))?.[1] ?? null
  const kept = missing === null ? full : { ...full, records: { ...full.records, [missing]: [] } }
  const document = variant === 'newer-file' ? { ...kept, schema: { ...kept.schema, core: (kept.schema.core ?? 0) + 1 } } : kept
  if (variant === 'race') {
    raceTheNextSave()
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
  saveWorkbookChoice({ source, id: copy.meta.id, name: copy.meta.title })
}

async function onFakeDrive(text: string, savedAt: string, document: DocumentCopy['document']): Promise<DocumentCopy> {
  const created = await createDriveDocument(fakeDriveSession(), await fakeBooksFolder(), COMPANY_APP, text)
  return {
    meta: { id: created.fileId, source: 'drive', title: documentName(COMPANY_APP), syncedAt: savedAt, lastExportedAt: null, unexportedSince: null },
    revision: created.document.revision,
    document,
  }
}
