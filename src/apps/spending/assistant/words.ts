import { language } from '../../../shared/text/language'
import type { Translation } from '../../../shared/text/translation'

/** The words on the screens a guide names, passed in so a guide calls each thing what the screen calls it. */
export interface GuideLabels {
  readonly entries: string
  readonly review: string
  readonly import: string
  readonly always: string
  readonly settings: string
  readonly rules: string
  readonly bankSync: string
  readonly limits: string
  readonly general: string
  readonly deployment: string
}

export const en = {
  automations: {
    bankSync: {
      title: 'Bank sync',
      what: (labels: GuideLabels) =>
        `While a bank is linked, every sync brings its new booked rows from OTP or Revolut into ${labels.entries}, ${labels.review}, with no file to upload. It is set up on ${labels.settings}, ${labels.bankSync}.`,
    },
  },
  settings: {
    bankSyncDeployment: "The bank sync script's API executable deployment. Blank leaves the whole sync off.",
    bankLink: (bank: string) => `The day the approval for ${bank} runs out, set by linking the bank.`,
    companyOib: "The company's OIB, which tells an R1 receipt for it.",
  },
  guides: {
    rules: {
      title: 'Set up rules for your bank',
      body: (labels: GuideLabels) =>
        [
          'A rule files a statement row by itself. It looks at the payee, or at the IBAN on the other side, so it works the same for every bank that brings rows into Kuna.',
          `1. Bring in some rows, through ${labels.entries}, ${labels.import} or ${labels.settings}, ${labels.bankSync}. Rows no rule files wait on ${labels.entries}, ${labels.review}.`,
          `2. On ${labels.review}, pick a category for a row and choose ${labels.always}. Kuna shows how many rows the rule files before you save it.`,
          `3. Every rule is listed on ${labels.settings}, ${labels.rules}, where you can delete one.`,
          'A row you filed yourself stays as it is, whatever a rule says.',
        ].join('\n'),
    },
    import: {
      title: 'Import a statement',
      body: (labels: GuideLabels) =>
        [
          `On ${labels.entries}, ${labels.import}, drop a Revolut export, as its .xlsx or .csv file. Other banks have no file reader here yet, and their rows come through the bank sync.`,
          'Kuna first shows what the file would do, and writes nothing until you import it. An import can be undone from the message that follows it.',
          `Rows no rule files then wait on ${labels.review}.`,
        ].join('\n'),
    },
    bankSync: {
      title: 'Link a bank',
      body: (labels: GuideLabels) =>
        [
          `The bank sync brings booked rows from OTP and Revolut through a script of your own, into the same review as a statement. It lives on ${labels.settings}, ${labels.bankSync}.`,
          `1. Deploy the script and save its ${labels.deployment} there. Without it the sync stays off.`,
          '2. Link each bank. Its approval runs out on a date the card shows, and then you link it again.',
        ].join('\n'),
    },
    limits: {
      title: 'Set a monthly limit',
      body: (labels: GuideLabels) =>
        `On ${labels.limits}, set a monthly limit in euros on a group such as Food, or on one of its categories. What a month leaves unspent carries into the next, and an overspent month lowers the next.`,
    },
    categories: {
      title: 'Change your categories',
      body: (labels: GuideLabels) => `Groups and categories are on ${labels.settings}, ${labels.general}. A hidden category keeps its entries.`,
    },
  },
}

export const hr: Translation<typeof en> = {
  automations: {
    bankSync: {
      title: 'Sinkronizacija s bankom',
      what: (labels) =>
        `Dok je banka povezana, svaka sinkronizacija donosi nove proknjižene retke iz OTP-a ili Revoluta na zaslon ${labels.entries}, na karticu ${labels.review}, bez datoteke za učitavanje. Postavlja se na zaslonu ${labels.settings}, na kartici ${labels.bankSync}.`,
    },
  },
  settings: {
    bankSyncDeployment: 'ID implementacije skripte. Ako je prazno, sinkronizacija je isključena.',
    bankLink: (bank) => `Datum isteka odobrenja za ${bank}. Postavlja se povezivanjem banke.`,
    companyOib: 'OIB tvrtke, po kojem se prepoznaje R1 račun za nju.',
  },
  guides: {
    rules: {
      title: 'Postavite pravila za svoju banku',
      body: (labels) =>
        [
          'Pravilo automatski razvrstava redak izvoda. Gleda primatelja ili IBAN druge strane, pa jednako radi za svaku banku čiji retci dolaze u Kunu.',
          `1. Uvezite retke na zaslonu ${labels.entries}, na kartici ${labels.import}, ili ih donesite sinkronizacijom na zaslonu ${labels.settings}, na kartici ${labels.bankSync}. Retci koje nijedno pravilo ne razvrsta čekaju na zaslonu ${labels.entries}, na kartici ${labels.review}.`,
          `2. Na kartici ${labels.review} odaberite kategoriju za redak i zatim ${labels.always}. Prije spremanja Kuna pokaže koliko redaka pravilo razvrstava.`,
          `3. Sva pravila navedena su na zaslonu ${labels.settings}, na kartici ${labels.rules}, gdje ih možete i obrisati.`,
          'Redak koji ste sami razvrstali ostaje kakav jest, što god pravilo kaže.',
        ].join('\n'),
    },
    import: {
      title: 'Uvezite izvod',
      body: (labels) =>
        [
          `Na zaslonu ${labels.entries}, na kartici ${labels.import} ispustite izvoz iz Revoluta, kao datoteku .xlsx ili .csv. Za druge banke ovdje još nema čitača datoteka, a njihovi retci dolaze sinkronizacijom s bankom.`,
          'Kuna najprije pokaže što bi datoteka učinila i ne zapisuje ništa dok je ne uvezete. Uvoz možete poništiti iz poruke koja slijedi.',
          `Retci koje nijedno pravilo ne razvrsta zatim čekaju na kartici ${labels.review}.`,
        ].join('\n'),
    },
    bankSync: {
      title: 'Povežite banku',
      body: (labels) =>
        [
          `Sinkronizacija s bankom donosi proknjižene retke iz OTP-a i Revoluta preko vaše vlastite skripte, u isti pregled kao i izvod. Nalazi se na zaslonu ${labels.settings}, na kartici ${labels.bankSync}.`,
          `1. Objavite skriptu (Deploy u uređivaču skripte) pa tamo spremite ${labels.deployment}. Bez toga sinkronizacija ostaje isključena.`,
          '2. Povežite svaku banku. Odobrenje istječe na datum s kartice i tada banku ponovno povežite.',
        ].join('\n'),
    },
    limits: {
      title: 'Postavite mjesečno ograničenje',
      body: (labels) =>
        `Na zaslonu ${labels.limits} postavite mjesečno ograničenje u eurima na skupinu kao što je Hrana ili na neku od njezinih kategorija. Ono što u mjesecu ne potrošite prenosi se u sljedeći, a prekoračenje umanjuje sljedeći mjesec.`,
    },
    categories: {
      title: 'Promijenite kategorije',
      body: (labels) => `Skupine i kategorije nalaze se na zaslonu ${labels.settings}, na kartici ${labels.general}. Skrivena kategorija zadržava svoje unose.`,
    },
  },
}

export const words = language === 'hr' ? hr : en
