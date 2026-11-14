import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import type { WholeReason } from '../domain/instalmentSplit'
import type { LinkState, LinkTarget } from '../domain/linkTarget'
import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

// Croatian names the app Krediti, plural, so it takes plural verbs. A rate is rata, and an informal loan pozajmica.

export const en = {
  instalment: (loan: string, due: CivilDate) => `${loan}, instalment due ${dayLabel(due)}`,
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
    unfiled: 'Links the whole entry, since it has no category to keep the interest under.',
    'no-principal': 'It is all interest, so the entry stays whole.',
    'informal-loan': '',
    'money-in': '',
    'transfer-leg': '',
  } satisfies Record<WholeReason, string>,
  /** The words a split gives its parts. */
  notes: { interest: 'Interest', difference: 'Difference from the plan' },
}

export const hr: Translation<typeof en> = {
  instalment: (loan, due) => `${loan}, rata s dospijećem ${dayLabel(due)}`,
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
    unfiled: 'Povezuje se cijeli unos jer nema kategoriju pod kojom bi ostale kamate.',
    'no-principal': 'Sve je kamata, pa unos ostaje cijeli.',
    'informal-loan': '',
    'money-in': '',
    'transfer-leg': '',
  },
  notes: { interest: 'Kamate', difference: 'Razlika prema planu' },
}

export const words = language === 'hr' ? hr : en

/** A record as the Link to Loans picker lists it: an instalment by its loan and due date, which tell two instalments apart on a phone. */
export function choiceText(target: LinkTarget): string {
  return target.kind === 'informal-loan' ? words.informalLoan(target.name) : words.choice(target.loanName, target.due)
}

/** What a row's link reads as: the record it names, or why that record is not shown. */
export function linkText(read: LinkState<LinkTarget>): string {
  if (read.state === 'there') {
    const { target } = read
    return target.kind === 'informal-loan' ? words.informalLoan(target.name) : (target.interim ? words.interim : words.instalment)(target.loanName, target.due)
  }
  return { opening: words.opening, failed: words.failed, 'not-set-up': words.notSetUp, gone: words.gone }[read.state]
}
