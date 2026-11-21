import { en as accountsEn, hr as accountsHr } from '../../accounts/domain/words'
import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence.

export const en = {
  banks: accountsEn.banks,
  /** A linked account Kuna does not keep, by its bank, its currency where it has one, and the end of its number, never the whole IBAN. */
  linkedAccount: (bank: string, currency: string, ending: string) => [bank, currency, ending === '' ? '' : `ending ${ending}`].filter((part) => part !== '').join(' '),
  sameAccountTwice: (bank: string, account: string) => `${bank} has more than one account that fits ${account}, so none of them was read.`,
  didNotAnswer: (reason: string) => `The bank sync script did not answer: ${reason}`,
  bankFailed: (bank: string, reason: string) => `${bank} did not answer, so its rows wait for a later sync: ${reason}`,
  sessionEnded: (bank: string) => `The link to ${bank} ended early. Link it again.`,
  sessionNotHere: (bank: string) => `This browser does not hold the link to ${bank}. Get it from Google on Settings, Bank sync, or link it again.`,
  noFile: 'The Spending file is not open yet.',
  imported: 'Bank rows imported',
  fetched: 'Banks asked',
  linked: 'Bank linked',
  linkEndedTitle: 'Bank link ended',
}

export const hr: Translation<typeof en> = {
  banks: accountsHr.banks,
  linkedAccount: (bank, currency, ending) => [bank, currency, ending === '' ? '' : `koji završava na ${ending}`].filter((part) => part !== '').join(' '),
  sameAccountTwice: (bank, account) => `${bank} ima više računa koji odgovaraju računu ${account}, pa nijedan nije pročitan.`,
  didNotAnswer: (reason) => `Skripta za sinkronizaciju s bankom nije odgovorila: ${reason}`,
  bankFailed: (bank, reason) => `Banka ${bank} nije odgovorila, pa njezini retci čekaju sljedeću sinkronizaciju: ${reason}`,
  sessionEnded: (bank) => `Veza s bankom ${bank} prekinuta je prije roka. Povežite je ponovno.`,
  sessionNotHere: (bank) => `Ovaj preglednik nema vezu s bankom ${bank}. Preuzmite je s Googlea u Postavkama, na kartici Sinkronizacija s bankom, ili je ponovno povežite.`,
  noFile: 'Datoteka potrošnje još nije otvorena.',
  imported: 'Retci iz banke uvezeni',
  fetched: 'Banke pitane',
  linked: 'Banka povezana',
  linkEndedTitle: 'Veza s bankom završena',
}

export const words = language === 'hr' ? hr : en
