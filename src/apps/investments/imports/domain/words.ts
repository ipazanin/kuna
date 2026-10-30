import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. The app is Ulaganja.
// These words are written into the notes of imported records, which then stay as they were written.

export const en = {
  bookedNet: 'Booked net of the tax withheld at source',
  stockYieldIncome: 'Stock yield income',
  referralCredit: 'Referral credit',
}

export const hr: Translation<typeof en> = {
  bookedNet: 'Knjiženo umanjeno za porez obustavljen na izvoru',
  stockYieldIncome: 'Prihod od posudbe dionica',
  referralCredit: 'Nagrada za preporuku',
}

export const words = language === 'hr' ? hr : en
