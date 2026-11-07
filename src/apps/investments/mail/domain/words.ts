import { language } from '../../../../shared/text/language'
import type { EnglishForms, Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. A broker's report is izvješće, a mail poruka.
// These words are written into the notes of imported records, which then stay as they were written.

export const en = {
  broker: 'IBKR',
  commissionOf: (symbol: string) => `Commission of the ${symbol} row, charged in another currency`,
  recipeKindUnknown: (recipe: string, kind: string) => `${recipe} names a kind of row Kuna does not book, ${kind}`,
  mails: (count: number): EnglishForms => ({ one: `Read ${count} mail`, other: `Read ${count} mails` }),
  noMail: 'Found no mail',
  news: (fresh: number, changed: number, asked: number) =>
    [
      fresh === 0 && changed === 0 ? 'nothing new' : '',
      fresh === 0 ? '' : `${fresh} new for review`,
      changed === 0 ? '' : `${changed} changed since booked`,
      asked === 0 ? '' : `${asked} to ask about`,
    ]
      .filter((part) => part !== '')
      .join(', '),
  noFile: (count: number, format: string): EnglishForms => ({ one: `${count} mail held no ${format} file`, other: `${count} mails held no ${format} file` }),
}

export const hr: Translation<typeof en> = {
  broker: 'IBKR',
  commissionOf: (symbol) => `Provizija retka ${symbol}, naplaćena u drugoj valuti`,
  recipeKindUnknown: (recipe, kind) => `${recipe} navodi vrstu retka koju Kuna ne knjiži, ${kind}`,
  mails: (count) => ({ one: `Pročitana je ${count} poruka`, few: `Pročitane su ${count} poruke`, other: `Pročitano je ${count} poruka` }),
  noMail: 'Nije pronađena nijedna poruka',
  news: (fresh, changed, asked) =>
    [
      fresh === 0 && changed === 0 ? 'ništa novo' : '',
      fresh === 0 ? '' : `novo za pregled: ${fresh}`,
      changed === 0 ? '' : `promijenjeno nakon upisa: ${changed}`,
      asked === 0 ? '' : `za pitanje: ${asked}`,
    ]
      .filter((part) => part !== '')
      .join(', '),
  noFile: (count, format) => ({ one: `${count} poruka nema datoteke ${format}`, few: `${count} poruke nemaju datoteke ${format}`, other: `${count} poruka nema datoteke ${format}` }),
}

export const words = language === 'hr' ? hr : en
