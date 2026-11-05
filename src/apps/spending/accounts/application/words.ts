import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence.

export const en = {
  currencyKept: (name: string, currency: string) => `"${name}" has entries in ${currency}, so it keeps that currency`,
}

export const hr: Translation<typeof en> = {
  currencyKept: (name, currency) => `„${name}” ima unose u valuti ${currency}, pa zadržava tu valutu`,
}

export const words = language === 'hr' ? hr : en
