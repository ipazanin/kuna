import type { LinkableBank } from '../../workbook/domain/spendingSettings'
import { language } from '../../../../shared/text/language'
import type { CroatianForms, EnglishForms, Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.

export const en = {
  title: 'Bank sync',
  subtitle: 'Brings booked rows from your banks through a script of your own, into the same review as a statement.',
  deployment: 'Script deployment ID',
  deploymentHelp: "From Deploy, Manage deployments in the script's editor. Without it Kuna asks Google for nothing more and sends no request.",
  save: 'Save',
  saved: 'Bank sync script saved',
  notSaved: 'Not saved',
  banks: { otp: 'OTP', revolut: 'Revolut' } satisfies Record<LinkableBank, string>,
  link: (bank: string) => `Link ${bank}`,
  linkAgain: (bank: string) => `Link ${bank} again`,
  finish: (bank: string) => `Finish linking ${bank}`,
  linkedUntil: (date: string) => `Linked until ${date}`,
  endedOn: (date: string) => `Ended on ${date}`,
  notLinked: 'Not linked',
  linkEnds: (bank: string, date: string) => `The link to ${bank} ends on ${date}. Link it again.`,
  linkEnded: (bank: string, date: string) => `The link to ${bank} ended on ${date}. Link it again.`,
  linkRefused: (reason: string) => `The bank did not link: ${reason}`,
  cameBackElsewhere: 'A bank came back to a browser that did not start the link, so nothing was linked. Link it again from this browser.',
  syncNow: 'Sync now',
  lastSync: 'Last sync',
  summary: (added: number, alreadyIn: number, filled: number) => `${added} new, ${alreadyIn} already in, ${filled} paired with what you typed.`,
  nothing: 'Nothing here is new.',
  unknownAccount: (bank: string, iban: string) => `${bank} has an account Kuna does not keep: ${iban}`,
  addAccount: 'Add an account',
  step: {
    label: 'Bank sync',
    start: 'Asking the banks',
    noLiveLink: 'No bank link is still good',
    tooSoon: 'Asked the banks less than six hours ago, so they are left alone for now.',
    review: (count: number): EnglishForms => ({ one: '1 row to review', other: `${count} rows to review` }),
    settings: 'Bank sync',
  },
}

export const hr: Translation<typeof en> = {
  title: 'Sinkronizacija s bankom',
  subtitle: 'Donosi proknjižene retke iz vaših banaka preko vaše vlastite skripte, u isti pregled kao i izvod.',
  deployment: 'ID implementacije skripte',
  deploymentHelp: 'Iz Deploy, Manage deployments u uređivaču skripte. Bez njega Kuna ne traži od Googlea ništa novo i ne šalje nijedan zahtjev.',
  save: 'Spremi',
  saved: 'Skripta za sinkronizaciju spremljena',
  notSaved: 'Nije spremljeno',
  banks: { otp: 'OTP', revolut: 'Revolut' },
  link: (bank) => `Poveži ${bank}`,
  linkAgain: (bank) => `Ponovno poveži ${bank}`,
  finish: (bank) => `Dovrši povezivanje ${bank}`,
  linkedUntil: (date) => `Povezano do ${date}`,
  endedOn: (date) => `Završeno ${date}`,
  notLinked: 'Nije povezano',
  linkEnds: (bank, date) => `Veza s bankom ${bank} istječe ${date} Povežite je ponovno.`,
  linkEnded: (bank, date) => `Veza s bankom ${bank} istekla je ${date} Povežite je ponovno.`,
  linkRefused: (reason) => `Banka nije povezana: ${reason}`,
  cameBackElsewhere: 'Banka se vratila u preglednik koji nije započeo povezivanje, pa ništa nije povezano. Povežite je ponovno iz ovog preglednika.',
  syncNow: 'Sinkroniziraj',
  lastSync: 'Zadnja sinkronizacija',
  summary: (added, alreadyIn, filled) => `Novih: ${added}, već unesenih: ${alreadyIn}, spojenih s vašim unosima: ${filled}.`,
  nothing: 'Ovdje nema ničeg novog.',
  unknownAccount: (bank, iban) => `${bank} ima račun koji Kuna ne vodi: ${iban}`,
  addAccount: 'Dodaj račun',
  step: {
    label: 'Sinkronizacija s bankom',
    start: 'Pita banke',
    noLiveLink: 'Nijedna veza s bankom više ne vrijedi',
    tooSoon: 'Banke su pitane prije manje od šest sati, pa ih zasad ne pita ponovno.',
    review: (count): CroatianForms => ({ one: `Za pregled: ${count}`, few: `Za pregled: ${count}`, other: `Za pregled: ${count}` }),
    settings: 'Sinkronizacija s bankom',
  },
}

export const words = language === 'hr' ? hr : en
