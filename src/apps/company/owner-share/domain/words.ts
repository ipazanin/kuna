import { language } from '../../../../shared/text/language'
import { plural } from '../../../../shared/text/translation'
import type { Translation } from '../../../../shared/text/translation'
import { croatianBucket } from '../../settings/domain/words'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// A role keeps its name as the categories tab stores it, such as owner-benefit. A bucket takes its Croatian name in quotes.

export const en = {
  unreadableShare: (text: string) => `owner_share "${text}" is not a whole number from 0 to 100, so it reads as blank`,
  origin: (share: number, category: string) => `${share}% to owner, from ${category}`,
  noRoleCarrier: (role: string) => `no category carries the ${role} role`,
  severalCarriers: (role: string, categories: string) => `the ${role} role is on ${categories}, and only one category may carry it`,
  wrongBucket: (role: string, slug: string, bucket: string) => `the ${role} role is on "${slug}" in the ${bucket} bucket, and only an owner-pay category may carry it`,
  sharesCountAsZero: (held: number, why: string) =>
    `${held} ${held === 1 ? 'row holds' : 'rows hold'} an owner share, but ${why}. So every share counts as 0 until one owner-pay category carries the role.`,
  rowGone: 'The row is no longer in the workbook as the app read it. Sync and look again.',
  noAdvances: 'No pack keeps owner advances in this workbook.',
}

export const hr: Translation<typeof en> = {
  unreadableShare: (text) => `owner_share „${text}” nije cijeli broj od 0 do 100, pa se čita kao prazno`,
  origin: (share, category) => `${share}\u00a0% vlasniku, iz kategorije ${category}`,
  noRoleCarrier: (role) => `nijedna kategorija nema ulogu ${role}`,
  severalCarriers: (role, categories) => `ulogu ${role} imaju ${categories}, a smije je imati samo jedna kategorija`,
  wrongBucket: (role, slug, bucket) => `ulogu ${role} ima „${slug}” u skupini ${croatianBucket(bucket)}, a smije je imati samo kategorija skupine ${croatianBucket('owner-pay')}`,
  sharesCountAsZero: (held, why) =>
    `${plural({ one: `${held} stavka ima`, few: `${held} stavke imaju`, other: `${held} stavki ima` }, held)} udio vlasnika, ali ${why}. Zato se svaki udio broji kao 0 dok ulogu ne preuzme jedna kategorija skupine ${croatianBucket('owner-pay')}.`,
  rowGone: 'Stavka više nije u datoteci onakva kakvu ju je aplikacija pročitala. Sinkronizirajte i pogledajte ponovno.',
  noAdvances: 'Nijedan paket u ovoj datoteci ne čuva predujmove vlasnika.',
}

export const words = language === 'hr' ? hr : en
