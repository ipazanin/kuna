import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

export const en = {
  difference: 'Difference',
}

export const hr: Translation<typeof en> = {
  difference: 'Razlika',
}

export const words = language === 'hr' ? hr : en
