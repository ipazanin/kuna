import type { LinkableBank } from '../../workbook/domain/spendingSettings'
import { language } from '../../../../shared/text/language'
import type { CroatianForms, EnglishForms, Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence.

export const en = {
  banks: { otp: 'OTP', revolut: 'Revolut' } satisfies Record<LinkableBank, string>,
  /** The name a drafted account is stored under. */
  draftName: (bank: LinkableBank, currency: string, savings: boolean) => `${en.banks[bank]} ${currency}${savings ? ' savings' : ''}`,
  pendingLeftOut: (count: number, account: string): EnglishForms => ({
    one: `1 pending row of ${account} left out. It comes once it is booked.`,
    other: `${count} pending rows of ${account} left out. They come once they are booked.`,
  }),
  zeroLeftOut: (count: number, account: string): EnglishForms => ({ one: `1 row of ${account} without an amount left out.`, other: `${count} rows of ${account} without an amount left out.` }),
  otherCurrencyLeftOut: (count: number, currency: string): EnglishForms => ({
    one: `1 row in ${currency} left out, since no account keeps ${currency}.`,
    other: `${count} rows in ${currency} left out, since no account keeps ${currency}.`,
  }),
  unreadableLeftOut: (count: number, account: string): EnglishForms => ({
    one: `1 row of ${account} left out, since its day or amount cannot be read.`,
    other: `${count} rows of ${account} left out, since their day or amount cannot be read.`,
  }),
  balanceNotRead: (accounts: string, reason: string) => `The balance of ${accounts} was not checked, since the bank did not give it: ${reason}`,
  sameAccountTwice: (bank: string, account: string) => `${bank} has more than one account that fits ${account}, so none of them was read.`,
  didNotAnswer: (reason: string) => `The bank sync script did not answer: ${reason}`,
  bankFailed: (bank: string, reason: string) => `${bank} did not answer, so its rows wait for a later sync: ${reason}`,
  sessionEnded: (bank: string) => `The link to ${bank} ended early. Link it again.`,
  noFile: 'The Spending file is not open yet.',
  imported: 'Bank rows imported',
  linked: 'Bank linked',
  linkEndedTitle: 'Bank link ended',
}

export const hr: Translation<typeof en> = {
  banks: { otp: 'OTP', revolut: 'Revolut' },
  draftName: (bank, currency, savings) => `${hr.banks[bank]} ${currency}${savings ? ' štednja' : ''}`,
  pendingLeftOut: (count, account): CroatianForms => ({
    one: `Izostavljeno transakcija na čekanju računa ${account}: ${count}. Stiže kad se proknjiži.`,
    few: `Izostavljeno transakcija na čekanju računa ${account}: ${count}. Stižu kad se proknjiže.`,
    other: `Izostavljeno transakcija na čekanju računa ${account}: ${count}. Stižu kad se proknjiže.`,
  }),
  zeroLeftOut: (count, account): CroatianForms => ({
    one: `Izostavljeno redaka računa ${account} bez iznosa: ${count}.`,
    few: `Izostavljeno redaka računa ${account} bez iznosa: ${count}.`,
    other: `Izostavljeno redaka računa ${account} bez iznosa: ${count}.`,
  }),
  otherCurrencyLeftOut: (count, currency): CroatianForms => ({
    one: `Izostavljeno redaka u valuti ${currency}: ${count}. Nijedan račun ne vodi tu valutu.`,
    few: `Izostavljeno redaka u valuti ${currency}: ${count}. Nijedan račun ne vodi tu valutu.`,
    other: `Izostavljeno redaka u valuti ${currency}: ${count}. Nijedan račun ne vodi tu valutu.`,
  }),
  unreadableLeftOut: (count, account): CroatianForms => ({
    one: `Izostavljeno redaka računa ${account} kojima se ne mogu pročitati dan ili iznos: ${count}.`,
    few: `Izostavljeno redaka računa ${account} kojima se ne mogu pročitati dan ili iznos: ${count}.`,
    other: `Izostavljeno redaka računa ${account} kojima se ne mogu pročitati dan ili iznos: ${count}.`,
  }),
  balanceNotRead: (accounts, reason) => `Stanje računa ${accounts} nije provjereno jer ga banka nije dala: ${reason}`,
  sameAccountTwice: (bank, account) => `${bank} ima više računa koji odgovaraju računu ${account}, pa nijedan nije pročitan.`,
  didNotAnswer: (reason) => `Skripta za sinkronizaciju s bankom nije odgovorila: ${reason}`,
  bankFailed: (bank, reason) => `Banka ${bank} nije odgovorila, pa njezini retci čekaju sljedeću sinkronizaciju: ${reason}`,
  sessionEnded: (bank) => `Veza s bankom ${bank} prekinuta je prije roka. Povežite je ponovno.`,
  noFile: 'Datoteka potrošnje još nije otvorena.',
  imported: 'Retci iz banke uvezeni',
  linked: 'Banka povezana',
  linkEndedTitle: 'Veza s bankom završena',
}

export const words = language === 'hr' ? hr : en
