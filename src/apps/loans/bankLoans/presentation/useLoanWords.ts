import { computed, inject, provide } from 'vue'
import type { ComputedRef, InjectionKey } from 'vue'

import { words, wordsFor } from './words'
import type { BankLoan } from '../../workbook/domain/bankLoan'

const LOAN_WORDS: InjectionKey<ComputedRef<typeof words>> = Symbol('loan words')

/** Gives the components under one loan's page or dialog the words of how its instalments are set, and returns them. */
export function provideLoanWords(repayment: () => BankLoan['repayment']): ComputedRef<typeof words> {
  const chosen = computed(() => wordsFor(repayment()))
  provide(LOAN_WORDS, chosen)
  return chosen
}

/** The words of the loan whose page or dialog holds the component. Only one loan's page or dialog provides them. */
export function useLoanWords(): ComputedRef<typeof words> {
  const chosen = inject(LOAN_WORDS, null)
  if (chosen === null) {
    throw new Error("useLoanWords needs one loan's page or dialog around it, which calls provideLoanWords.")
  }
  return chosen
}
