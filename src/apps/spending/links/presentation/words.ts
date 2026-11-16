import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import type { WholeReason } from '../domain/instalmentSplit'
import type { ExtraPaymentEffect, InstalmentTarget, LinkState, LinkTarget, MovementKind } from '../domain/linkTarget'
import { language } from '../../../../shared/text/language'
import type { EnglishForms, Translation } from '../../../../shared/text/translation'

// Croatian names the app Krediti, plural, so it takes plural verbs. A rate is rata, and an informal loan pozajmica.

export const en = {
  instalment: (loan: string, number: number, count: number, due: CivilDate) => `${loan}, instalment ${number} of ${count}, due ${dayLabel(due)}`,
  interim: (loan: string, due: CivilDate) => `${loan}, interim interest due ${dayLabel(due)}`,
  choice: (loan: string, due: CivilDate) => `${loan}, ${dayLabel(due)}`,
  interimShare: (amount: string) => `${amount} of interim interest`,
  informalLoan: (name: string) => `${name}, informal loan`,
  movement: (loan: string, kind: string, day: CivilDate) => `${loan}, ${kind} ${dayLabel(day)}`,
  extraPayment: (loan: string, day: CivilDate) => `${loan}, extra payment ${dayLabel(day)}`,
  /** What happened on an informal loan, as Loans names it, inside a sentence. */
  movementKinds: { borrowed: 'borrowed', 'borrowed-in-kind': 'borrowed in kind', repaid: 'repaid', 'repaid-in-kind': 'repaid in kind', forgiven: 'forgiven' } satisfies Record<MovementKind, string>,
  above: (amount: string) => `${amount} above the plan`,
  below: (amount: string) => `${amount} below the plan`,
  moreThanLoans: (amount: string) => `${amount} more than in Loans`,
  lessThanLoans: (amount: string) => `${amount} less than in Loans`,
  gone: 'No longer in Loans',
  opening: 'Linked to Loans, which is still opening',
  failed: 'Linked to Loans, which did not open',
  notSetUp: 'Linked to Loans, which is not set up on this device',
  label: 'Linked to',
  open: 'Open in Loans',
  remove: 'Remove link',
  removed: 'Link removed',
  pickLabel: 'Link to Loans',
  pick: 'Pick a record in Loans',
  link: 'Link',
  linked: 'Entry linked',
  saveFirst: 'Save your changes before linking.',
  splits: (interest: string, principal: string) => `Splits into ${interest} of interest and ${principal} of principal, which counts as no spending.`,
  paidMore: (amount: string, category: string) => `You paid ${amount} more than the plan. The difference stays under ${category}.`,
  paidLess: (amount: string, category: string) => `You paid ${amount} less than the plan. The difference goes under ${category} as money in, which lowers its spending.`,
  replacesParts: 'This replaces the parts the entry has now.',
  filesWhole: (category: string) => `Files the whole entry under ${category}, which counts as neither spending nor income.`,
  splitNote: "The link split this entry into the plan's interest and principal, so its amount and account stay as they are. Removing the link leaves the parts.",
  /** Why an entry links whole, where a person can link it. */
  whole: {
    'not-euro': 'Links the whole entry, since the plan is in euros and the account is not.',
    receipt: 'Links the whole entry, since a receipt split it.',
    'no-principal': 'It is all interest, so the entry stays whole.',
    principal: '',
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
  /** The form that adds a movement in Loans from an entry and links the entry to it. */
  add: {
    open: 'Add a movement to an informal loan',
    help: 'Adds the movement to the informal loan in Loans, then links this entry to it under Loan principal. One Undo takes back both.',
    loan: 'Informal loan',
    pickLoan: 'Pick a loan',
    kind: 'What happened',
    kinds: { borrowed: 'Borrowed', 'borrowed-in-kind': 'Borrowed in kind', repaid: 'Repaid', 'repaid-in-kind': 'Repaid in kind', forgiven: 'Forgiven' } satisfies Record<MovementKind, string>,
    amount: 'Amount in EUR',
    anAmount: 'An amount above zero',
    save: 'Add and link',
    inLoans: 'Movement added from Spending',
    done: 'Added in Loans and linked',
    notAdded: 'Not added to Loans',
    notLinked: 'Added in Loans, not linked',
    staysInLoans: (reason: string) => `The movement stays in Loans, where you can see and delete it. ${reason}`,
    undone: 'The link and the movement are taken back.',
    keptInLoans: (reason: string) => `The link is off, and the movement stays in Loans. ${reason}`,
  },
  notUndone: 'Not undone',
  /** The card of rows a loan's rule filed whole that To review offers to record in Loans as an extra payment, and the form that does it. */
  extra: {
    title: 'Extra payments to record',
    subtitle: "Rows a loan's rule filed whole, above the instalment another row already pays.",
    caption: (instalment: string) => `Above ${instalment}, which another row pays`,
    record: 'Record as an extra payment',
    dialogTitle: 'Record an extra payment',
    dialogDescription: (loan: string) => `Adds the extra payment to ${loan} in Loans, then files this row whole under Loan principal, linked to it. One Undo takes back both.`,
    effect: 'What the bank does with it',
    effects: { 'shorter-term': 'Shorter term', 'lower-instalment': 'Lower instalment' } satisfies Record<ExtraPaymentEffect, string>,
    save: 'Record and link',
    inLoans: 'Extra payment added from Spending',
    done: 'Recorded in Loans and linked',
    notAdded: 'Not recorded in Loans',
    notLinked: 'Recorded in Loans, not linked',
    staysInLoans: (reason: string) => `The extra payment stays in Loans, where you can see and delete it. ${reason}`,
    undone: 'The link and the extra payment are taken back.',
    keptInLoans: (reason: string) => `The link is off, and the extra payment stays in Loans. ${reason}`,
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
  movement: (loan, kind, day) => `${loan}, ${kind} ${dayLabel(day)}`,
  extraPayment: (loan, day) => `${loan}, prijevremena otplata ${dayLabel(day)}`,
  movementKinds: { borrowed: 'posuđeno', 'borrowed-in-kind': 'posuđeno u naravi', repaid: 'vraćeno', 'repaid-in-kind': 'vraćeno u naravi', forgiven: 'oprošteno' },
  above: (amount) => `${amount} iznad plana`,
  below: (amount) => `${amount} ispod plana`,
  moreThanLoans: (amount) => `${amount} više nego u Kreditima`,
  lessThanLoans: (amount) => `${amount} manje nego u Kreditima`,
  gone: 'Više nije u Kreditima',
  opening: 'Povezano s Kreditima, koji se još otvaraju',
  failed: 'Povezano s Kreditima, koji se nisu otvorili',
  notSetUp: 'Povezano s Kreditima, koji na ovom uređaju nisu postavljeni',
  label: 'Povezano s',
  open: 'Otvori u Kreditima',
  remove: 'Ukloni poveznicu',
  removed: 'Poveznica uklonjena',
  pickLabel: 'Poveznica s Kreditima',
  pick: 'Odaberi zapis u Kreditima',
  link: 'Poveži',
  linked: 'Unos povezan',
  saveFirst: 'Spremite promjene prije povezivanja.',
  splits: (interest, principal) => `Unos se dijeli na kamate od ${interest} i glavnicu od ${principal}, koja se ne računa u potrošnju.`,
  paidMore: (amount, category) => `Platili ste ${amount} više od plana. Razlika ostaje pod kategorijom „${category}”.`,
  paidLess: (amount, category) => `Platili ste ${amount} manje od plana. Razlika ide pod kategoriju „${category}” kao uplata i smanjuje njezinu potrošnju.`,
  replacesParts: 'Ovo zamjenjuje dijelove koje unos sada ima.',
  filesWhole: (category) => `Cijeli unos ide pod kategoriju „${category}”, koja se ne računa ni u potrošnju ni u prihode.`,
  splitNote: 'Poveznica je podijelila unos na kamate i glavnicu iz plana, pa iznos i račun ostaju kakvi jesu. Kad uklonite poveznicu, dijelovi ostaju.',
  whole: {
    'not-euro': 'Povezuje se cijeli unos jer je plan u eurima, a račun nije.',
    receipt: 'Povezuje se cijeli unos jer ga je podijelio fiskalni račun.',
    'no-principal': 'Sve je kamata, pa unos ostaje cijeli.',
    principal: '',
    'money-in': '',
    'transfer-leg': '',
  },
  notes: { interest: 'Kamate', difference: 'Razlika prema planu' },
  offer: {
    pays: (instalment) => `Je li ovo ${instalment}?`,
    mayPay: (instalment, difference) => `Je li ovo možda ${instalment}, ${difference}?`,
    mayPayAnotherDay: (instalment) => `Je li ovo možda ${instalment}?`,
  },
  add: {
    open: 'Dodaj promjenu pozajmici',
    help: 'Dodaje promjenu pozajmici u Kreditima, a zatim ovaj unos povezuje s njom pod glavnicom kredita. Jedno poništavanje vraća oboje.',
    loan: 'Pozajmica',
    pickLoan: 'Odaberi pozajmicu',
    kind: 'Što se dogodilo',
    kinds: { borrowed: 'Posuđeno', 'borrowed-in-kind': 'Posuđeno u naravi', repaid: 'Vraćeno', 'repaid-in-kind': 'Vraćeno u naravi', forgiven: 'Oprošteno' },
    amount: 'Iznos u EUR',
    anAmount: 'Iznos veći od nule',
    save: 'Dodaj i poveži',
    inLoans: 'Promjena dodana iz Potrošnje',
    done: 'Dodano u Kredite i povezano',
    notAdded: 'Nije dodano u Kredite',
    notLinked: 'Dodano u Kredite, nije povezano',
    staysInLoans: (reason) => `Promjena ostaje u Kreditima, gdje je možete vidjeti i obrisati. ${reason}`,
    undone: 'Poveznica i promjena su vraćene.',
    keptInLoans: (reason) => `Poveznica je uklonjena, a promjena ostaje u Kreditima. ${reason}`,
  },
  notUndone: 'Nije poništeno',
  extra: {
    title: 'Prijevremene otplate za upis',
    subtitle: 'Stavke koje je pravilo kredita razvrstalo cijele, iznad rate koju već plaća druga stavka.',
    caption: (instalment) => `Iznad rate: ${instalment}, koju već plaća druga stavka`,
    record: 'Upiši kao prijevremenu otplatu',
    dialogTitle: 'Upiši prijevremenu otplatu',
    dialogDescription: (loan) => `Dodaje prijevremenu otplatu kreditu ${loan} u Kreditima, a zatim ovu stavku cijelu stavlja u Glavnicu kredita, povezanu s njom. Jedno poništavanje vraća oboje.`,
    effect: 'Što banka radi s njom',
    effects: { 'shorter-term': 'Kraći rok otplate', 'lower-instalment': 'Isti rok, manja rata' },
    save: 'Upiši i poveži',
    inLoans: 'Prijevremena otplata dodana iz Potrošnje',
    done: 'Upisano u Kredite i povezano',
    notAdded: 'Nije upisano u Kredite',
    notLinked: 'Upisano u Kredite, nije povezano',
    staysInLoans: (reason) => `Prijevremena otplata ostaje u Kreditima, gdje je možete vidjeti i obrisati. ${reason}`,
    undone: 'Poveznica i prijevremena otplata su vraćene.',
    keptInLoans: (reason) => `Poveznica je uklonjena, a prijevremena otplata ostaje u Kreditima. ${reason}`,
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

/** A record as the Link to Loans picker lists it: an instalment by its loan and due date, which tell two instalments apart on a phone, a movement or an extra payment by its loan, what happened and its day. */
export function choiceText(target: LinkTarget): string {
  switch (target.kind) {
    case 'instalment':
      return words.choice(target.loanName, target.due)
    case 'informal-loan':
      return words.informalLoan(target.name)
    case 'movement':
      return words.movement(target.loanName, words.movementKinds[target.movement], target.day)
    case 'extra-payment':
      return words.extraPayment(target.loanName, target.day)
  }
}

/** An instalment by its loan, its number in the plan and its due date, or interim interest by its loan and due date. */
export function instalmentText(target: InstalmentTarget): string {
  return target.number === null ? words.interim(target.loanName, target.due) : words.instalment(target.loanName, target.number, target.count, target.due)
}

/** What a row's link reads as: the record it names, or why that record is not shown. */
export function linkText(read: LinkState<LinkTarget>): string {
  if (read.state === 'there') {
    const { target } = read
    return target.kind === 'instalment' ? instalmentText(target) : choiceText(target)
  }
  return { opening: words.opening, failed: words.failed, 'not-set-up': words.notSetUp, gone: words.gone }[read.state]
}
