import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

// What an event must hold, which the event dialog shows under its fields and a refused event write says.

export const en = {
  blank: 'Give the event a name',
  endsBefore: 'The last day cannot be before the first',
}

export const hr: Translation<typeof en> = {
  blank: 'Upiši naziv',
  endsBefore: 'Zadnji dan ne može biti prije prvog',
}

export const words = language === 'hr' ? hr : en
