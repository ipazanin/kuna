import { FAKE_SPREADSHEET_ID, FAKE_WORKBOOK_TITLE, fakeWorkbookSnapshot } from './fakeWorkbook'
import { saveWorkbookChoice } from '../workbookChoice'
import { openWorkbookCache } from '../workbookCache'

const DAY = 86_400_000

/**
 * Fills the browser from the synthetic workbook, as a successful sync would, and chooses it.
 * `?fake=excel` keeps it as a workbook of this browser with changes nine days past their last
 * export, and `?fake=empty` keeps nothing, which is a first run. `?fake=no-billing-plan` and
 * `?fake=excel-no-billing-plan` leave out the outgoing-plan tab. Only main.ts imports this, behind
 * an inline VITE_FAKE_WORKBOOK comparison, so the module and its fixture never reach a production chunk.
 */
export async function seedFakeWorkbook(variant: string | null): Promise<void> {
  if (variant === 'empty') {
    saveWorkbookChoice(null)
    return
  }
  const source = variant?.startsWith('excel') ? 'excel' : 'google'
  const now = Date.now()
  const full = fakeWorkbookSnapshot(new Date(now).toISOString(), source)
  const snapshot = variant?.endsWith('no-billing-plan')
    ? { ...full, 'outgoing-plan': [], meta: { ...full.meta, missingTabs: source === 'google' ? (['outgoing-plan'] as const) : [] } }
    : full
  const seeded =
    source === 'excel'
      ? {
          ...snapshot,
          meta: { ...snapshot.meta, lastExportedAt: new Date(now - 12 * DAY).toISOString(), unexportedSince: new Date(now - 9 * DAY).toISOString() },
        }
      : snapshot
  const cache = openWorkbookCache(FAKE_SPREADSHEET_ID)
  try {
    await cache.replace(seeded)
  } finally {
    cache.close()
  }
  saveWorkbookChoice({ source, id: FAKE_SPREADSHEET_ID, name: FAKE_WORKBOOK_TITLE })
}
