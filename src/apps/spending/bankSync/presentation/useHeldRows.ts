import { computed, shallowRef } from 'vue'
import type { ComputedRef, Ref } from 'vue'

import { answerHeldRow } from '../application/heldRowWrites'
import { words } from './words'
import { rowCaption, rowTitle, twinCaption } from '../../statements/presentation/rowParts'
import type { RowQuestion } from '../../statements/presentation/rowParts'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import { rowKey } from '../../workbook/domain/transaction'
import { today } from '../../../../shared/calendar/civilDate'
import { EURO } from '../../../../shared/money/currencyCode'
import { TWIN_CHOICES, twinWords } from '../../../../shared/ai/presentation/copiedRowsWords'
import type { TwinChoice } from '../../../../shared/ai/presentation/copiedRowsWords'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'

interface HeldRows {
  readonly items: ComputedRef<readonly RowQuestion<TwinChoice>[]>
  readonly options: (typeof TWIN_CHOICES)['sync']
  /** The answer being written, which its button shows until the write lands. */
  readonly saving: Readonly<Ref<{ readonly key: string; readonly choice: TwinChoice } | null>>
  answer(key: string, choice: TwinChoice): Promise<void>
}

/**
 * The bank rows on hold as `QuestionList` lists them, those `shown` keeps by their key, and the answer that writes the
 * person's word on one. A row whose look-alike is gone says so and offers to keep it or leave it out. Decide later writes nothing.
 */
export function useHeldRows(shown: (key: string) => boolean = () => true): HeldRows {
  const store = useSpendingBooks()
  const writes = useRecordWrites(store)
  const saving = shallowRef<{ readonly key: string; readonly choice: TwinChoice } | null>(null)
  const items = computed(() => {
    const book = store.state.workbook
    if (book === null) return []
    const accounts = new Map(book.accounts.map((account) => [account.id, account]))
    const rows = new Map(book.transactions.map((row) => [row.id, row]))
    return book.held
      .filter((held) => shown(rowKey(held)))
      .map((held): RowQuestion<TwinChoice> => {
        const account = accounts.get(held.account)
        const like = rows.get(held.like)
        const asked = { key: rowKey(held), row: rowTitle(held), caption: rowCaption(held, account), choice: 'later' as const, amount: held.amount, currency: account?.currency ?? EURO }
        return like === undefined ? { ...asked, note: twinWords.gone, options: TWIN_CHOICES.gone } : { ...asked, note: twinCaption(like, account) }
      })
  })
  return {
    items,
    options: TWIN_CHOICES.sync,
    saving,
    async answer(key, choice) {
      const book = store.state.workbook
      const held = book?.held.find((candidate) => rowKey(candidate) === key)
      if (book == null || held === undefined || choice === 'later' || choice === 'file' || saving.value !== null) return
      saving.value = { key, choice }
      try {
        await writes.write(choice === 'both' ? words.heldBooked : words.heldKept, (unit) => answerHeldRow(unit, book, held, choice, today()), { key: `held-${key}`, failedTitle: words.heldNotWritten })
      } finally {
        saving.value = null
      }
    },
  }
}
