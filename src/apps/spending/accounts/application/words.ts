import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence.

export const en = {
  currencyKept: (name: string, currency: string) => `"${name}" has entries in ${currency}, so it keeps that currency`,
  bankLinkWithoutIban: (name: string) => `"${name}" takes its rows from the bank, so it needs the IBAN the bank sync finds it by`,
  rowsOfAnotherSource: (name: string, count: number) =>
    `"${name}" holds ${count === 1 ? '1 row' : `${count} rows`} on the days you give another source, which that source would not take. Change the source in the account dialog, which lists them first.`,
  undoAfterHandover: (name: string) => `The new source has brought rows to "${name}" on the days it took since, so Undo would count them twice. Move the edge back in the account dialog instead.`,
}

export const hr: Translation<typeof en> = {
  currencyKept: (name, currency) => `„${name}” ima unose u valuti ${currency}, pa zadržava tu valutu`,
  bankLinkWithoutIban: (name) => `„${name}” dobiva retke iz banke, pa treba IBAN po kojem ga sinkronizacija pronalazi`,
  rowsOfAnotherSource: (name, count) =>
    `„${name}” ima ${count === 1 ? '1 redak' : `${count} redaka`} na danima koje dajete drugom izvoru, a taj ih izvor ne bi primio. Promijenite izvor u prozoru računa, koji ih najprije navodi.`,
  undoAfterHandover: (name) => `Novi je izvor u međuvremenu donio retke na račun „${name}” za dane koje je preuzeo, pa bi ih Poništi brojao dvaput. Umjesto toga vratite granicu u prozoru računa.`,
}

export const words = language === 'hr' ? hr : en
