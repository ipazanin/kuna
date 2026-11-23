import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

export const en = {
  noPart: 'A quick add with no part writes nothing.',
}

export const hr: Translation<typeof en> = {
  noPart: 'Brzi unos bez ijednog dijela ništa ne upisuje.',
}

export const words = language === 'hr' ? hr : en
