import { IBKR_FLEX_RECIPE } from '../domain/ibkrFlexRecipe'
import type { MailReaderFault, MailReaderField } from '../domain/mailReaderTexts'
import { words as mailWords } from '../../../../shared/mail-filing/domain/words'
import { language } from '../../../../shared/text/language'
import type { EnglishForms, Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Pregledaj.
// Mail is pošta and one mail poruka. IBKR's report is izvješće, and the Investments app is Ulaganja.

/** IBKR's own names of the sections its query offers, which it shows in English whatever the language. */
const SECTIONS = IBKR_FLEX_RECIPE.sections.map((section) => section.name).join(', ')

export const en = {
  step: {
    label: 'IBKR report',
    searching: 'Looking for the IBKR report in your mail',
    beforeBooks: 'Waits for the Investments file',
    seeList: 'See what it read',
    misfit: (name: string, reason: string) => `${name} does not fit. ${reason}.`,
    filesMisfit: (count: number): EnglishForms => ({ one: `${count} file does not fit.`, other: `${count} files do not fit.` }),
    fixes: { 'no-section': 'Tick that section in the Flex Query.', 'no-column': 'Tick that field in the Flex Query.' },
    accessRanOut: 'The access to your mail ran out. Sync again to allow it.',
    stopped: 'Google turned the mail step away. Sync again to allow it.',
  },
  card: {
    title: 'IBKR report by mail',
    subtitle: 'IBKR can mail its Activity Flex report each day. Kuna reads it here, and nothing goes in until you accept it.',
    on: 'Read the report from mail',
    onHelp: 'Each sync searches your mail. Kuna only reads it, and never marks, moves or files a mail.',
    off: 'Off',
    readFrom: (senders: readonly string[]) => `Reads mail from ${senders.join(', ')}`,
    senders: 'Sender',
    sendersHelp: 'The address IBKR mails from. Separate more than one with a comma.',
    subject: 'Subject contains',
    subjectHelp: 'Blank takes any subject.',
    contents: 'Words in the mail',
    contentsHelp: 'Gmail looks for these words. Blank takes any mail.',
    since: 'First day to read',
    sinceHelp: 'Rows dated earlier are left out, so what you already booked does not count twice.',
    sinceMissing: 'Pick a day',
    unconfirmed: 'These filters are not confirmed yet',
    unconfirmedWhy: 'Kuna has not seen a real IBKR mail, so the sender is its best guess. The first sync that finds one confirms it.',
    format: `In IBKR's Flex Query, set the format to XML for the last 7 to 14 days, with the sections ${SECTIONS}.`,
    saved: 'IBKR report settings saved',
    notSaved: 'IBKR report settings not saved',
    lastSync: 'What the last sync read',
    searchedFrom: { newest: 'a week before the newest record from this report', since: 'the first day to read' },
    noMailFound: 'No mail fits these filters. Check the sender and the subject against a real mail.',
    rowsRead: (name: string, rows: number): EnglishForms => ({ one: `${name}: ${rows} row read`, other: `${name}: ${rows} rows read` }),
    noFile: (format: string) => `This mail holds no ${format} file, so it was passed over.`,
  },
  review: {
    fresh: (count: number): EnglishForms => ({ one: `${count} record from the IBKR report waits for you.`, other: `${count} records from the IBKR report wait for you.` }),
    changed: (count: number): EnglishForms => ({ one: `The report now gives other figures for ${count} record.`, other: `The report now gives other figures for ${count} records.` }),
    asked: (count: number): EnglishForms => ({ one: `${count} row to look at.`, other: `${count} rows to look at.` }),
    open: 'Review',
    title: 'Review the IBKR report',
    description: 'A row is in Kuna already when a record holds its IBKR id. Nothing goes in until Accept, and one Undo takes all of it back.',
    accept: 'Accept',
    accepted: 'IBKR report accepted',
    notAccepted: 'Nothing accepted',
  },
  upload: {
    title: 'Upload a report',
    intro:
      'Choose an Activity Flex report in XML that you saved from IBKR or from its mail. You check every row before anything goes in. A row is in Kuna already, and skipped, when a record holds its IBKR id. A row with the account, day and amounts of a record you typed or imported asks whether it is that record.',
    drop: 'Drop the IBKR report here',
    orChoose: 'or choose an XML file',
  },
  guide: {
    title: 'IBKR report by mail',
    body: `IBKR can mail its Activity Flex report each day, so trades, dividends, tax withheld, conversions, deposits, interest and fees reach Investments with no upload. In IBKR's Client Portal, make an Activity Flex Query in XML for the last 7 to 14 days with the sections ${SECTIONS}, and turn on its delivery by email. In Investments, Settings, General, turn on IBKR report by mail. Each sync reads what arrived, and new records wait for a review with one tap to accept and an Undo. A row Kuna has not seen, such as a corporate action or a corrected trade, is asked about and never guessed. It helps most for someone adding broker trades by hand or importing a statement.`,
  },
}

export const hr: Translation<typeof en> = {
  step: {
    label: 'Izvješće IBKR-a',
    searching: 'Traži izvješće IBKR-a u pošti',
    beforeBooks: 'Čeka datoteku ulaganja',
    seeList: 'Pogledajte što je pročitano',
    misfit: (name, reason) => `${name} ne odgovara. ${reason}.`,
    filesMisfit: (count) => ({ one: `${count} datoteka ne odgovara.`, few: `${count} datoteke ne odgovaraju.`, other: `${count} datoteka ne odgovara.` }),
    fixes: { 'no-section': 'Označite taj odjeljak u upitu Flex Query.', 'no-column': 'Označite to polje u upitu Flex Query.' },
    accessRanOut: 'Pristup pošti je istekao. Sinkronizirajte ponovno da ga dopustite.',
    stopped: 'Google je odbio korak pošte. Sinkronizirajte ponovno da ga dopustite.',
  },
  card: {
    title: 'Izvješće IBKR-a poštom',
    subtitle: 'IBKR svaki dan može poslati svoje izvješće Activity Flex. Kuna ga čita ovdje i ništa ne ulazi dok ga ne prihvatite.',
    on: 'Čitaj izvješće iz pošte',
    onHelp: 'Svaka sinkronizacija pretražuje poštu. Kuna je samo čita i nikad ne označava, ne premješta ni ne sprema poruke.',
    off: 'Isključeno',
    readFrom: (senders) => `Čita poštu od ${senders.join(', ')}`,
    senders: 'Pošiljatelj',
    sendersHelp: 'Adresa s koje IBKR šalje. Više adresa odvojite zarezom.',
    subject: 'Predmet sadrži',
    subjectHelp: 'Prazno prihvaća svaki predmet.',
    contents: 'Riječi u poruci',
    contentsHelp: 'Gmail traži te riječi. Prazno prihvaća svaku poruku.',
    since: 'Prvi dan za čitanje',
    sinceHelp: 'Raniji retci se izostavljaju, pa se ono što ste već upisali ne broji dvaput.',
    sinceMissing: 'Odaberite dan',
    unconfirmed: 'Ovi filtri još nisu potvrđeni',
    unconfirmedWhy: 'Kuna još nije vidjela pravu poruku IBKR-a, pa je pošiljatelj njezina najbolja procjena. Prva sinkronizacija koja je pronađe to potvrđuje.',
    format: `U IBKR-ovu upitu Flex Query postavite format XML za zadnjih 7 do 14 dana, s odjeljcima: ${SECTIONS}.`,
    saved: 'Postavke izvješća IBKR-a su spremljene',
    notSaved: 'Postavke izvješća IBKR-a nisu spremljene',
    lastSync: 'Što je pročitala zadnja sinkronizacija',
    searchedFrom: { newest: 'tjedan dana prije najnovijeg zapisa iz ovog izvješća', since: 'prvog dana za čitanje' },
    noMailFound: 'Nijedna poruka ne odgovara ovim filtrima. Provjerite pošiljatelja i predmet prema pravoj poruci.',
    rowsRead: (name, rows) => ({ one: `${name}: pročitan je ${rows} redak`, few: `${name}: pročitana su ${rows} retka`, other: `${name}: pročitano je ${rows} redaka` }),
    noFile: (format) => `Ova poruka nema datoteke ${format}, pa je preskočena.`,
  },
  review: {
    fresh: (count) => ({
      one: `Iz izvješća IBKR-a čeka vas ${count} novi zapis.`,
      few: `Iz izvješća IBKR-a čekaju vas ${count} nova zapisa.`,
      other: `Iz izvješća IBKR-a čeka vas ${count} novih zapisa.`,
    }),
    changed: (count) => ({
      one: `Izvješće sada daje druge iznose za ${count} zapis.`,
      few: `Izvješće sada daje druge iznose za ${count} zapisa.`,
      other: `Izvješće sada daje druge iznose za ${count} zapisa.`,
    }),
    asked: (count) => ({ one: `${count} redak za pregled.`, few: `${count} retka za pregled.`, other: `${count} redaka za pregled.` }),
    open: 'Pregledaj',
    title: 'Pregled izvješća IBKR-a',
    description: 'Redak je već u Kuni kad neki zapis ima njegovu oznaku iz IBKR-a. Ništa ne ulazi prije nego što prihvatite, a jedno poništavanje vraća sve.',
    accept: 'Prihvati',
    accepted: 'Izvješće IBKR-a je prihvaćeno',
    notAccepted: 'Ništa nije prihvaćeno',
  },
  upload: {
    title: 'Učitaj izvješće',
    intro:
      'Odaberite izvješće Activity Flex u formatu XML koje ste spremili iz IBKR-a ili iz njegove poruke. Svaki redak provjerite prije nego što išta uđe. Redak je već u Kuni, pa se preskače, kad neki zapis ima njegovu oznaku iz IBKR-a. Redak s računom, danom i iznosima zapisa koji ste upisali ili uvezli pita je li to taj zapis.',
    drop: 'Ispustite izvješće IBKR-a ovdje',
    orChoose: 'ili odaberite datoteku XML',
  },
  guide: {
    title: 'Izvješće IBKR-a poštom',
    body: `IBKR svaki dan može poslati svoje izvješće Activity Flex, pa transakcije, dividende, obustavljeni porez, konverzije, uplate, kamate i naknade stižu u Ulaganja bez ručnog učitavanja. U IBKR-ovu Client Portalu napravite Activity Flex Query u formatu XML za zadnjih 7 do 14 dana, s odjeljcima: ${SECTIONS}. Zatim uključite slanje e-poštom. U Ulaganjima, Postavke, Općenito, uključite Izvješće IBKR-a poštom. Svaka sinkronizacija pročita što je stiglo, a novi zapisi čekaju pregled, s prihvaćanjem jednim dodirom i poništavanjem. Redak kakav Kuna još nije vidjela ide vama na pitanje i nikad se ne nagađa, primjerice korporativna akcija ili ispravljena transakcija. Najviše pomaže onome tko transakcije brokera upisuje ručno ili učitava izvod.`,
  },
}

export const words = language === 'hr' ? hr : en

/** What each field of the mail card says it lacks: senders their help, the first day a pick, and a phrase Gmail cannot search for the mail search's wording of its fault. */
export function mailReaderErrors(faults: Readonly<Record<MailReaderField, MailReaderFault | null>>): Readonly<Record<MailReaderField, string | null>> {
  const text = (field: MailReaderField): string | null => {
    const fault = faults[field]
    if (fault === null) return null
    if (fault.kind === 'unsearchable') return mailWords.searchFault(fault.search)
    return field === 'since' ? words.card.sinceMissing : words.card.sendersHelp
  }
  return { senders: text('senders'), subject: text('subject'), contents: text('contents'), since: text('since') }
}
