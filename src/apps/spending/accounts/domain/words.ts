import type { LinkableBank } from '../../workbook/domain/spendingSettings'
import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

export const en = {
  banks: { otp: 'OTP', revolut: 'Revolut' } satisfies Record<LinkableBank, string>,
  /** The name a drafted account is stored under. */
  draftName: (bank: string, currency: string, savings: boolean) => `${bank} ${currency}${savings ? ' savings' : ''}`,
}

export const hr: Translation<typeof en> = {
  banks: { otp: 'OTP', revolut: 'Revolut' },
  draftName: (bank, currency, savings) => `${bank} ${currency}${savings ? ' štednja' : ''}`,
}

export const words = language === 'hr' ? hr : en
