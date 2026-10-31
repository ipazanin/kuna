import { language } from '../../../../shared/text/language'
import type { EnglishForms, Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.

export const en = {
  shareDialog: {
    title: 'Owner share',
    description: (counterparty: string, day: string) => `${counterparty || 'No counterparty'}, ${day}`,
    noDefault: (category: string) => `${category} has no default share.`,
    defaultIs: (category: string, share: number) => `The default of ${category} is ${share}%.`,
    cleared: 'Owner share cleared',
    setTo: (share: number) => `Owner share set to ${share}%`,
    notSaved: 'Not saved',
    noCounterpartyRow: 'A row with no counterparty',
    share: 'Share to the owner',
    shareError: 'A whole number from 0 to 100, or blank for none',
    none: 'None',
    shareLabel: 'Share to the owner, in percent',
    useDefault: "Use the category's default",
    companyKeeps: 'The company keeps',
    youTake: 'You take',
    note: "Changing the category later sets the new category's default. A blank share counts as none.",
    cancel: 'Cancel',
    save: 'Save',
  },
  fillDialog: {
    title: 'Fill the rows without a share?',
    rows: (count: number): EnglishForms => ({ one: `${count} row`, other: `${count} rows` }),
    keepTheirs: 'Rows that already have a share keep it, a share of 0 included.',
    cancel: 'Cancel',
    defaultOnly: 'Save the default only',
    saveAndFill: (count: number): EnglishForms => ({ one: `Save and fill ${count} row`, other: `Save and fill ${count} rows` }),
  },
}

export const hr: Translation<typeof en> = {
  shareDialog: {
    title: 'Udio vlasnika',
    description: (counterparty, day) => `${counterparty || 'Bez partnera'}, ${day}`,
    noDefault: (category) => `„${category}” nema zadani udio.`,
    defaultIs: (category, share) => `Zadani udio za „${category}” je ${share}\u00a0%.`,
    cleared: 'Udio vlasnika je uklonjen',
    setTo: (share) => `Udio vlasnika postavljen je na ${share}\u00a0%`,
    notSaved: 'Nije spremljeno',
    noCounterpartyRow: 'Stavka bez partnera',
    share: 'Udio vlasniku',
    shareError: 'Cijeli broj od 0 do 100 ili prazno ako udjela nema',
    none: 'Nema',
    shareLabel: 'Udio vlasniku, u postocima',
    useDefault: 'Koristi zadani udio kategorije',
    companyKeeps: 'Tvrtka zadržava',
    youTake: 'Vi uzimate',
    note: 'Kasnija promjena kategorije postavlja zadani udio nove kategorije. Prazan udio znači da ga nema.',
    cancel: 'Odustani',
    save: 'Spremi',
  },
  fillDialog: {
    title: 'Popuniti stavke bez udjela?',
    rows: (count) => ({ one: `${count} stavka`, few: `${count} stavke`, other: `${count} stavki` }),
    keepTheirs: 'Stavke koje već imaju udio zadržavaju ga, uključujući udio 0.',
    cancel: 'Odustani',
    defaultOnly: 'Spremi samo zadani udio',
    saveAndFill: (count) => ({ one: `Spremi i popuni ${count} stavku`, few: `Spremi i popuni ${count} stavke`, other: `Spremi i popuni ${count} stavki` }),
  },
}

export const words = language === 'hr' ? hr : en
