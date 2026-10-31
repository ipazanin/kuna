import { formatMoney } from '../../../../shared/money/moneyFormat'
import { moneyFromAmount } from '../../../../shared/money/money'
import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// An invoice is račun, and the invoices tab is the popis računa. Late counts from the due date, dospijeće.

export const en = {
  /** How late what is still owed is, by days past its due date. */
  ageing: {
    'not-due': 'Not due yet',
    'days-0-30': '0–30 days',
    'days-31-60': '31–60 days',
    'days-61-90': '61–90 days',
    'days-over-90': 'Over 90 days',
  },
  /** Why a change to the invoices tab is refused. */
  numberTaken: (number: string) => `Invoice ${number} is already on the invoices tab, and each number is used once.`,
  notAboveZero: (number: string, amount: number) => `Invoice ${number} is for ${amount}, and an invoice is for an amount above zero.`,
}

export const hr: Translation<typeof en> = {
  ageing: {
    'not-due': 'Još nije dospjelo',
    'days-0-30': '0–30 dana',
    'days-31-60': '31–60 dana',
    'days-61-90': '61–90 dana',
    'days-over-90': 'Više od 90 dana',
  },
  numberTaken: (number) => `Račun ${number} već je u popisu računa, a svaki se broj koristi samo jednom.`,
  notAboveZero: (number, amount) => `Račun ${number} glasi na ${formatMoney(moneyFromAmount(amount))}, a račun mora glasiti na iznos veći od nule.`,
}

export const words = language === 'hr' ? hr : en
