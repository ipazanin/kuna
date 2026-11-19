import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence.

export const en = {
  description: 'The categories your entries go in, the labels that group them across categories, and the rules that file your bank rows under both.',
}

export const hr: Translation<typeof en> = {
  description: 'Kategorije u koje idu vaši unosi, oznake koje ih grupiraju preko kategorija i pravila koja po njima razvrstavaju stavke iz banke.',
}

export const words = language === 'hr' ? hr : en
