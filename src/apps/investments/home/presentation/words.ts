import { language } from '../../../../shared/text/language'
import type { EnglishForms, Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.

export const en = {
  purpose: 'Every buy and sale at your brokers in a file of its own, with what it is worth and what it earned.',
  value: 'Value',
  totalGain: 'Total gain',
  /** The newest close is three weekdays old or more. */
  pricesFrom: (day: string) => `Prices from ${day}`,
  inoDohBy: (day: string) => `INO-DOH by ${day}`,
  joppdBy: (day: string) => `JOPPD by ${day}`,
  taxOnPayments: (count: number, day: string): EnglishForms => ({ one: `Tax on 1 payment by ${day}`, other: `Tax on ${count} payments by ${day}` }),
  investmentsValue: 'Investments value',
  unpriced: (count: number): EnglishForms => ({ one: `${count} holding without a price`, other: `${count} holdings without a price` }),
}

export const hr: Translation<typeof en> = {
  purpose: 'Svaka kupnja i prodaja kod vaših brokera u zasebnoj datoteci, s vrijednošću i zaradom.',
  value: 'Vrijednost',
  totalGain: 'Ukupna dobit',
  pricesFrom: (day) => `Cijene od ${day}`,
  inoDohBy: (day) => `INO-DOH do ${day}`,
  joppdBy: (day) => `JOPPD do ${day}`,
  taxOnPayments: (count, day) => ({
    one: `Porez na ${count} isplatu do ${day}`,
    few: `Porez na ${count} isplate do ${day}`,
    other: `Porez na ${count} isplata do ${day}`,
  }),
  investmentsValue: 'Vrijednost ulaganja',
  unpriced: (count) => ({ one: `${count} ulaganje bez cijene`, few: `${count} ulaganja bez cijene`, other: `${count} ulaganja bez cijene` }),
}

export const words = language === 'hr' ? hr : en
