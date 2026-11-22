import { forgetBankSync, saveApplicationId } from '../application/bankSync'
import { BANK_USAGE } from '../domain/bankLinks'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import { words } from '../domain/words'
import { words as workbookWords } from '../../workbook/domain/words'
import type { BankSyncHost } from '../../../../shared/bank-sync/presentation/bankSyncHost'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'

/** The Spending file as the shared bank sync cards read and write it. Call it in a component's setup, since its writes show toasts. */
export function useSpendingBankHost(): BankSyncHost {
  const store = useSpendingBooks()
  const openBook = () => {
    const book = store.state.workbook
    if (book === null) throw new Error(words.noFile)
    return book
  }
  return {
    usage: BANK_USAGE,
    applicationLabel: workbookWords.settingLabels.application,
    applicationId: () => store.state.workbook?.settings.bankSyncApplication ?? null,
    writes: useRecordWrites(store),
    saveApplication: (unit, applicationId) => saveApplicationId(unit, openBook(), applicationId),
    forgetBankSync: (unit) => forgetBankSync(unit, openBook()),
  }
}
