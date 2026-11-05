import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence.

export const en = {
  fixedKept: (name: string) => `"${name}" is a fixed category, so it stays. It can be renamed`,
}

export const hr: Translation<typeof en> = {
  fixedKept: (name) => `„${name}” je stalna kategorija, pa ostaje. Može joj se promijeniti naziv`,
}

export const words = language === 'hr' ? hr : en
