import { formatMoney } from '../../../../shared/money/moneyFormat'
import { moneyFromAmount } from '../../../../shared/money/money'
import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'
import { en as invoicingEn, hr as invoicingHr, lineProblemsInWords } from '../../invoicing/domain/words'
import type { InvoiceRefusal } from '../domain/invoiceGuards'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// An invoice is račun, and the invoices tab is the popis računa.

export const en = {
  /** Why a change to the invoices tab is refused. */
  numberTaken: (number: string) => `Invoice ${number} is already on the invoices tab, and each number is used once.`,
  notAboveZero: (number: string, amount: number) => `Invoice ${number} is for ${amount}, and an invoice is for an amount above zero.`,
  badLines: (number: string, problems: readonly string[]) => `The lines of invoice ${number} cannot be saved. ${problems.join(' ')}`,
  refusal: (refusal: InvoiceRefusal): string => {
    switch (refusal.kind) {
      case 'number-taken':
        return en.numberTaken(refusal.number)
      case 'not-above-zero':
        return en.notAboveZero(refusal.number, refusal.amount)
      case 'bad-lines':
        return en.badLines(refusal.number, lineProblemsInWords(refusal.problems, invoicingEn))
    }
  },
}

export const hr: Translation<typeof en> = {
  numberTaken: (number) => `Račun ${number} već je u popisu računa, a svaki se broj koristi samo jednom.`,
  notAboveZero: (number, amount) => `Račun ${number} glasi na ${formatMoney(moneyFromAmount(amount))}, a račun mora glasiti na iznos veći od nule.`,
  badLines: (number, problems) => `Stavke računa ${number} ne mogu se spremiti. ${problems.join(' ')}`,
  refusal: (refusal) => {
    switch (refusal.kind) {
      case 'number-taken':
        return hr.numberTaken(refusal.number)
      case 'not-above-zero':
        return hr.notAboveZero(refusal.number, refusal.amount)
      case 'bad-lines':
        return hr.badLines(refusal.number, lineProblemsInWords(refusal.problems, invoicingHr))
    }
  },
}

export const words = language === 'hr' ? hr : en
