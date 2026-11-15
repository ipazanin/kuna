import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import type { WholeReason } from '../domain/instalmentSplit'
import type { InstalmentTarget, LinkState, LinkTarget } from '../domain/linkTarget'
import { language } from '../../../../shared/text/language'
import type { EnglishForms, Translation } from '../../../../shared/text/translation'

// Croatian names the app Krediti, plural, so it takes plural verbs. A rate is rata, and an informal loan pozajmica.

export const en = {
  instalment: (loan: string, number: number, count: number, due: CivilDate) => `${loan}, instalment ${number} of ${count}, due ${dayLabel(due)}`,
  interim: (loan: string, due: CivilDate) => `${loan}, interim interest due ${dayLabel(due)}`,
  choice: (loan: string, due: CivilDate) => `${loan}, ${dayLabel(due)}`,
  interimShare: (amount: string) => `${amount} of interim interest`,
  informalLoan: (name: string) => `${name}, informal loan`,
  above: (amount: string) => `${amount} above the plan`,
  below: (amount: string) => `${amount} below the plan`,
  gone: 'No longer in Loans',
  opening: 'Linked to Loans, which is still opening',
  failed: 'Linked to Loans, which did not open',
  notSetUp: 'Linked to Loans, which is not set up on this device',
  label: 'Linked to',
  open: 'Open in Loans',
  remove: 'Remove link',
  removed: 'Link removed',
  pickLabel: 'Link to Loans',
  pick: 'Pick an instalment or a loan',
  link: 'Link',
  linked: 'Entry linked',
  saveFirst: 'Save your changes before linking.',
  splits: (interest: string, principal: string) => `Splits into ${interest} of interest and ${principal} of principal, which counts as no spending.`,
  paidMore: (amount: string, category: string) => `You paid ${amount} more than the plan. The difference stays under ${category}.`,
  paidLess: (amount: string, category: string) => `You paid ${amount} less than the plan. The difference goes under ${category} as money in, which lowers its spending.`,
  replacesParts: 'This replaces the parts the entry has now.',
  splitNote: "The link split this entry into the plan's interest and principal, so its amount and account stay as they are. Removing the link leaves the parts.",
  /** Why an entry links whole, where a person can link it. */
  whole: {
    'not-euro': 'Links the whole entry, since the plan is in euros and the account is not.',
    receipt: 'Links the whole entry, since a receipt split it.',
    'no-principal': 'It is all interest, so the entry stays whole.',
    'informal-loan': '',
    'money-in': '',
    'transfer-leg': '',
  } satisfies Record<WholeReason, string>,
  /** The words a split gives its parts. */
  notes: { interest: 'Interest', difference: 'Difference from the plan' },
  /** What To review offers for a row that may pay an instalment. */
  offer: {
    pays: (instalment: string) => `Pays ${instalment}?`,
    mayPay: (instalment: string, difference: string) => `May pay ${instalment}, ${difference}?`,
    mayPayAnotherDay: (instalment: string) => `May pay ${instalment}?`,
  },
  /** The card of rows filed already that look like a loan's instalments. */
  past: {
    title: (loan: string) => `Past instalments of ${loan}`,
    rows: (count: number, from: string, to: string): EnglishForms => ({ one: `1 row from ${from} looks like an instalment.`, other: `${count} rows from ${from} to ${to} look like its instalments.` }),
    note: "Linking splits each into the plan's interest and principal, which counts as no spending.",
    linkAll: (count: number): EnglishForms => ({ one: 'Link it', other: `Link all ${count}` }),
    linked: (count: number): EnglishForms => ({ one: 'Entry linked', other: `${count} entries linked` }),
    notNow: 'Not now',
    putOff: 'Not offered again before the next instalment',
  },
}

export const hr: Translation<typeof en> = {
  instalment: (loan, number, count, due) => `${loan}, ${number}. rata od ${count}, s dospijećem ${dayLabel(due)}`,
  interim: (loan, due) => `${loan}, interkalarna kamata s dospijećem ${dayLabel(due)}`,
  choice: (loan, due) => `${loan}, ${dayLabel(due)}`,
  interimShare: (amount) => `interkalarna kamata od ${amount}`,
  informalLoan: (name) => `${name}, pozajmica`,
  above: (amount) => `${amount} iznad plana`,
  below: (amount) => `${amount} ispod plana`,
  gone: 'Više nije u Kreditima',
  opening: 'Povezano s Kreditima, koji se još otvaraju',
  failed: 'Povezano s Kreditima, koji se nisu otvorili',
  notSetUp: 'Povezano s Kreditima, koji na ovom uređaju nisu postavljeni',
  label: 'Povezano s',
  open: 'Otvori u Kreditima',
  remove: 'Ukloni poveznicu',
  removed: 'Poveznica uklonjena',
  pickLabel: 'Poveznica s Kreditima',
  pick: 'Odaberi ratu ili pozajmicu',
  link: 'Poveži',
  linked: 'Unos povezan',
  saveFirst: 'Spremite promjene prije povezivanja.',
  splits: (interest, principal) => `Unos se dijeli na kamate od ${interest} i glavnicu od ${principal}, koja se ne računa u potrošnju.`,
  paidMore: (amount, category) => `Platili ste ${amount} više od plana. Razlika ostaje pod kategorijom „${category}”.`,
  paidLess: (amount, category) => `Platili ste ${amount} manje od plana. Razlika ide pod kategoriju „${category}” kao uplata i smanjuje njezinu potrošnju.`,
  replacesParts: 'Ovo zamjenjuje dijelove koje unos sada ima.',
  splitNote: 'Poveznica je podijelila unos na kamate i glavnicu iz plana, pa iznos i račun ostaju kakvi jesu. Kad uklonite poveznicu, dijelovi ostaju.',
  whole: {
    'not-euro': 'Povezuje se cijeli unos jer je plan u eurima, a račun nije.',
    receipt: 'Povezuje se cijeli unos jer ga je podijelio fiskalni račun.',
    'no-principal': 'Sve je kamata, pa unos ostaje cijeli.',
    'informal-loan': '',
    'money-in': '',
    'transfer-leg': '',
  },
  notes: { interest: 'Kamate', difference: 'Razlika prema planu' },
  offer: {
    pays: (instalment) => `Je li ovo ${instalment}?`,
    mayPay: (instalment, difference) => `Je li ovo možda ${instalment}, ${difference}?`,
    mayPayAnotherDay: (instalment) => `Je li ovo možda ${instalment}?`,
  },
  past: {
    title: (loan) => `Prošle rate kredita ${loan}`,
    rows: (count, from, to) => ({
      one: count === 1 ? `1 redak, ${from}, izgleda kao rata.` : `${count} redak, ${from} – ${to}, izgleda kao njegove rate.`,
      few: `${count} retka, ${from} – ${to}, izgledaju kao njegove rate.`,
      other: `${count} redaka, ${from} – ${to}, izgleda kao njegove rate.`,
    }),
    note: 'Povezivanje svaki dijeli na kamate i glavnicu iz plana, koja se ne računa u potrošnju.',
    linkAll: (count) => ({ one: count === 1 ? 'Poveži ga' : `Poveži svih ${count}`, few: `Poveži sva ${count}`, other: `Poveži svih ${count}` }),
    linked: (count) => ({ one: `${count} unos povezan`, few: `${count} unosa povezana`, other: `${count} unosa povezano` }),
    notNow: 'Ne sada',
    putOff: 'Neće se ponovno nuditi do sljedeće rate',
  },
}

export const words = language === 'hr' ? hr : en

/** A record as the Link to Loans picker lists it: an instalment by its loan and due date, which tell two instalments apart on a phone. */
export function choiceText(target: LinkTarget): string {
  return target.kind === 'informal-loan' ? words.informalLoan(target.name) : words.choice(target.loanName, target.due)
}

/** An instalment by its loan, its number in the plan and its due date, or interim interest by its loan and due date. */
export function instalmentText(target: InstalmentTarget): string {
  return target.number === null ? words.interim(target.loanName, target.due) : words.instalment(target.loanName, target.number, target.count, target.due)
}

/** What a row's link reads as: the record it names, or why that record is not shown. */
export function linkText(read: LinkState<LinkTarget>): string {
  if (read.state === 'there') {
    const { target } = read
    return target.kind === 'informal-loan' ? words.informalLoan(target.name) : instalmentText(target)
  }
  return { opening: words.opening, failed: words.failed, 'not-set-up': words.notSetUp, gone: words.gone }[read.state]
}
