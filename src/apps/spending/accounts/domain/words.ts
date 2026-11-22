import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

export const en = {
  /** The name a drafted account is stored under. */
  draftName: (bank: string, currency: string, savings: boolean) => `${bank} ${currency}${savings ? ' savings' : ''}`,
}

export const hr: Translation<typeof en> = {
  draftName: (bank, currency, savings) => `${bank} ${currency}${savings ? ' štednja' : ''}`,
}

export const words = language === 'hr' ? hr : en
