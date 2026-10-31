import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. The app is Ulaganja.
// These words are written into the notes of imported records, which then stay as they were written.

export const en = {
  bookedNet: 'Booked net of the tax withheld at source',
  stockYieldIncome: 'Stock yield income',
  referralCredit: 'Referral credit',
  debitInterest: 'Debit interest',
  againstSign: (type: string) => `A ${type} row signed against its type`,
  withheldRefund: 'Refund of tax withheld at source',
  withheldLowered: 'Tax withheld lowered by a refund',
  reversesDividend: 'Reverses a dividend',
  reversesPayment: 'Reverses an earlier payment',
}

export const hr: Translation<typeof en> = {
  bookedNet: 'Knjiženo umanjeno za porez obustavljen na izvoru',
  stockYieldIncome: 'Prihod od posudbe dionica',
  referralCredit: 'Nagrada za preporuku',
  debitInterest: 'Dugovna kamata',
  againstSign: (type) => `Redak ${type} s predznakom suprotnim njegovoj vrsti`,
  withheldRefund: 'Povrat poreza obustavljenog na izvoru',
  withheldLowered: 'Obustavljeni porez umanjen za povrat',
  reversesDividend: 'Poništava dividendu',
  reversesPayment: 'Poništava raniju isplatu',
}

export const words = language === 'hr' ? hr : en
