import { addShortcut, newShortcut } from '../application/shortcutWrites'
import { repeatsWithoutShortcut } from '../domain/shortcuts'
import type { ShortcutDraft } from '../domain/shortcuts'
import { words } from './words'
import type { SpendingBook, SpendingRecords } from '../../workbook/domain/readSpendingBook'
import { words as spendingWords } from '../../words'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { RecordWriteOptions, RecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'

/** A typed entry not split as the dialog adds it. */
export type TypedEntry = Pick<ShortcutDraft, 'account' | 'payee'> & ShortcutDraft['parts'][number]

/**
 * Make a Quick add beside Undo on the toast of a typed entry not split whose like was added twice in the last 30 days, which
 * makes a quick add of it in one tap. Nothing when it does not repeat or a quick add writes it already.
 */
export function shortcutOffer(book: SpendingBook | null, records: () => SpendingRecords | null, writes: RecordWrites, entry: TypedEntry, day: CivilDate): Pick<RecordWriteOptions, 'follow'> {
  const { account, payee, ...part } = entry
  const draft: ShortcutDraft = { name: '', account, payee: payee.trim(), parts: [{ ...part, note: part.note.trim() }] }
  if (book === null || !repeatsWithoutShortcut(book, { ...entry, payee: draft.payee }, day)) return {}
  const follow = {
    label: words.make,
    icon: 'i-lucide-zap',
    run: () => {
      const held = records()
      if (held !== null) void writes.write(words.made, (unit) => addShortcut(unit, newShortcut(held, draft)), { key: 'make-shortcut', failedTitle: spendingWords.form.notAdded })
    },
  }
  return { follow }
}
