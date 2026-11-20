import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import type { WholeReason } from '../domain/instalmentSplit'
import type { CompanyMoneyRole } from '../../workbook/domain/category'
import type { CompanyMoney, ExtraPaymentEffect, InstalmentTarget, LinkState, LinkTarget, MovementKind, OwnerPaymentTarget, TargetSource } from '../domain/linkTarget'
import { capitalised } from '../../../../shared/text/capitalised'
import { listInWords } from '../../../../shared/text/listInWords'
import { language } from '../../../../shared/text/language'
import type { EnglishForms, Translation } from '../../../../shared/text/translation'

// Croatian names the app Krediti, plural, so it takes plural verbs. A rate is rata, and an informal loan pozajmica.
// Company is Tvrtka, singular and feminine.

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
  pickLabel: 'Link to a record',
  /** The picker's prompt, naming the apps set up that a row can link to. */
  pick: (sources: readonly TargetSource[]) =>
    sources.length === 0
      ? 'Pick a record'
      : `Pick a record in ${listInWords(
          sources.map((source) => ({ loans: 'Loans', company: 'Company', investments: 'Investments' })[source]),
          'or',
        )}`,
  link: 'Link',
  linked: 'Entry linked',
  saveFirst: 'Save your changes before linking.',
  splits: (interest: string, principal: string) => `Splits into ${interest} of interest and ${principal} of principal, which counts as no spending.`,
  paidMore: (amount: string, category: string) => `You paid ${amount} more than the plan. The difference stays under ${category}.`,
  paidLess: (amount: string, category: string) => `You paid ${amount} less than the plan. The difference goes under ${category} as money in, which lowers its spending.`,
  replacesParts: 'This replaces the parts the entry has now.',
  filesWhole: (category: string) => `Files the whole entry under ${category}, which counts as neither spending nor income.`,
  /** What the parts of an entry its link split are, by the app the link names. */
  splitNote: {
    loans: "The link split this entry into the loan plan's interest and principal. Its amount and account stay as they are, and removing the link leaves the parts.",
    company: 'The link split this entry into the kinds of money in the payment with Company. Its amount and account stay as they are, and removing the link leaves the parts.',
    investments: 'Its link to Investments keeps the parts as they are.',
  } satisfies Record<TargetSource, string>,
  /** Why an entry links whole, where a person can link it. */
  whole: {
    'not-euro': 'Links the whole entry, since the plan is in euros and the account is not.',
    receipt: 'Links the whole entry, since a receipt split it.',
    'no-principal': 'It is all interest, so the entry stays whole.',
    principal: '',
    saving: '',
    'money-in': '',
    'transfer-leg': '',
    kept: 'The entry keeps its category.',
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
    open: 'Add to Loans',
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
    staysAdded: (reason: string) => `The movement stays in Loans, where you can see and delete it. ${reason}`,
    undone: 'The link and the movement are taken back.',
    keptAdded: (reason: string) => `The link is off, and the movement stays in Loans. ${reason}`,
  },
  notUndone: 'Not undone',
  /** A payment between your company and you in Company, as a link names it. */
  company: {
    kinds: {
      salary: 'salary',
      rent: 'rent',
      'profit-payout': 'profit payout',
      'owner-loan': 'owner loan',
      'cost-refund': 'costs paid back',
      'travel-allowance': 'travel allowances',
      'tax-free-pay': 'tax-free pay',
      other: 'other money',
    } satisfies Record<CompanyMoney, string>,
    toYou: (what: string, day: CivilDate) => `${capitalised(what)} from Company, paid ${dayLabel(day)}`,
    fromYou: (what: string, day: CivilDate) => `${capitalised(what)} to Company, paid ${dayLabel(day)}`,
    /** A cost you paid for your company, kept in Company as an owner advance, by what it was and its day. */
    advance: (description: string, day: CivilDate) => `${description === '' ? 'A cost' : description} you paid for Company, ${dayLabel(day)}`,
    gone: 'No longer in Company',
    opening: 'Linked to Company, which is still opening',
    failed: 'Linked to Company, which did not open',
    notSetUp: 'Linked to Company, which is not set up on this device or keeps no owner pay',
    open: 'Open in Company',
    /** A part of a payment as the link files it, such as "€1,800.00 under Salary". */
    under: (amount: string, category: string) => `${amount} under ${category}`,
    waits: (amount: string) => `${amount} waiting for a category`,
    files: (parts: string) => `Files the entry as ${parts}.`,
    more: (amount: string) => `The entry is ${amount} more than the payment, and the difference stays as a part of its own.`,
    less: (amount: string) => `The entry is ${amount} less than the payment, and the difference stays as a part of its own.`,
    /** The form that adds a cost you paid for your company to Company from an entry and links the entry to it. */
    add: {
      open: 'Add to Company',
      help: 'Adds the cost to Company as an owner advance, which the company owes you, then files this entry under For the company, linked to it. One Undo takes back both.',
      category: 'Category in Company',
      categoryHelp: 'Operating costs and taxes only.',
      pickCategory: 'Pick a category',
      description: 'What it was',
      amount: 'Amount in EUR',
      anAmount: 'An amount above zero',
      save: 'Add and link',
      inCompany: 'Owner advance added from Spending',
      done: 'Added in Company and linked',
      notAdded: 'Not added to Company',
      notLinked: 'Added in Company, not linked',
      staysAdded: (reason: string) => `The cost stays in Company, where you can see and delete it. ${reason}`,
      undone: 'The link and the cost are taken back.',
      keptAdded: (reason: string) => `The link is off, and the cost stays in Company. ${reason}`,
    },
  },
  /** A deposit into a broker's account in Investments or a withdrawal from it, as a link names it. */
  investments: {
    deposit: (account: string, day: CivilDate) => `Deposit to ${account}, ${dayLabel(day)}`,
    withdrawal: (account: string, day: CivilDate) => `Withdrawal from ${account}, ${dayLabel(day)}`,
    more: (amount: string) => `${amount} more arrived`,
    less: (amount: string) => `${amount} less arrived`,
    gone: 'No longer in Investments',
    opening: 'Linked to Investments, which is still opening',
    failed: 'Linked to Investments, which did not open',
    notSetUp: 'Linked to Investments, which is not set up on this device',
    open: 'Open in Investments',
  },
  /** What To review offers for a row that may be a deposit or a withdrawal. */
  investmentsOffer: {
    deposit: (account: string, day: CivilDate) => `the deposit to ${account}, ${dayLabel(day)}`,
    withdrawal: (account: string, day: CivilDate) => `the withdrawal from ${account}, ${dayLabel(day)}`,
    is: (movement: string) => `Looks like ${movement}.`,
    mayBe: (movement: string, difference: string) => `May be ${movement}, ${difference}.`,
  },
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
    staysAdded: (reason: string) => `The extra payment stays in Loans, where you can see and delete it. ${reason}`,
    undone: 'The link and the extra payment are taken back.',
    keptAdded: (reason: string) => `The link is off, and the extra payment stays in Loans. ${reason}`,
  },
  /** The card of rows filed already that are payments between your company and you. */
  payments: {
    title: 'Payments with Company',
    rows: (count: number): EnglishForms => ({ one: '1 row filed already is a payment between Company and you.', other: `${count} rows filed already are payments between Company and you.` }),
    note: 'Linking files each by what its money is, paid to you or to Company: salary, rent, a profit payout, travel allowances, an owner loan or costs paid back.',
    putOff: 'Not offered again before the next payment',
  },
  /** What To review offers for a row that may be a payment with your company. */
  companyOffer: {
    is: (payment: string) => `Looks like ${payment}.`,
    mayBe: (payment: string, difference: string) => `May be ${payment}, ${difference}.`,
    mayBeAnotherDay: (payment: string) => `May be ${payment}.`,
    more: (amount: string) => `${amount} more than the payment`,
    less: (amount: string) => `${amount} less than the payment`,
  },
  /** The card that asks once which income category takes each kind of money your company pays you. */
  roles: {
    title: 'Where Kuna files payments from Company',
    subtitle: 'Pick the category each kind of money goes under when you link a row to a payment from Company.',
    names: { salary: 'Salary and tax-free pay', 'rental-income': 'Rent', 'profit-payout': 'Profit payouts', 'travel-allowance': 'Per diems and kilometres' } satisfies Record<CompanyMoneyRole, string>,
    add: (name: string) => `Add ${name}`,
    clash: 'Pick a different category for each kind of money.',
    save: 'Save',
    saved: 'Categories for payments from Company saved',
    putOff: 'Not asked again before the next payment',
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
  pickLabel: 'Poveznica sa zapisom',
  pick: (sources) =>
    sources.length === 0
      ? 'Odaberi zapis'
      : `Odaberi zapis u ${listInWords(
          sources.map((source) => ({ loans: 'Kreditima', company: 'Tvrtki', investments: 'Ulaganjima' })[source]),
          'or',
        )}`,
  link: 'Poveži',
  linked: 'Unos povezan',
  saveFirst: 'Spremite promjene prije povezivanja.',
  splits: (interest, principal) => `Unos se dijeli na kamate od ${interest} i glavnicu od ${principal}, koja se ne računa u potrošnju.`,
  paidMore: (amount, category) => `Platili ste ${amount} više od plana. Razlika ostaje pod kategorijom „${category}”.`,
  paidLess: (amount, category) => `Platili ste ${amount} manje od plana. Razlika ide pod kategoriju „${category}” kao uplata i smanjuje njezinu potrošnju.`,
  replacesParts: 'Ovo zamjenjuje dijelove koje unos sada ima.',
  filesWhole: (category) => `Cijeli unos ide pod kategoriju „${category}”, koja se ne računa ni u potrošnju ni u prihode.`,
  splitNote: {
    loans: 'Poveznica je podijelila unos na kamate i glavnicu iz plana kredita. Iznos i račun ostaju kakvi jesu, a kad uklonite poveznicu, dijelovi ostaju.',
    company: 'Poveznica je podijelila unos na vrste novca u plaćanju s Tvrtkom. Iznos i račun ostaju kakvi jesu, a kad uklonite poveznicu, dijelovi ostaju.',
    investments: 'Poveznica s Ulaganjima ne mijenja dijelove.',
  },
  whole: {
    'not-euro': 'Povezuje se cijeli unos jer je plan u eurima, a račun nije.',
    receipt: 'Povezuje se cijeli unos jer ga je podijelio fiskalni račun.',
    'no-principal': 'Sve je kamata, pa unos ostaje cijeli.',
    principal: '',
    saving: '',
    'money-in': '',
    'transfer-leg': '',
    kept: 'Unos zadržava svoju kategoriju.',
  },
  notes: { interest: 'Kamate', difference: 'Razlika prema planu' },
  offer: {
    pays: (instalment) => `Je li ovo ${instalment}?`,
    mayPay: (instalment, difference) => `Je li ovo možda ${instalment}, ${difference}?`,
    mayPayAnotherDay: (instalment) => `Je li ovo možda ${instalment}?`,
  },
  add: {
    open: 'Dodaj u Kredite',
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
    staysAdded: (reason) => `Promjena ostaje u Kreditima, gdje je možete vidjeti i obrisati. ${reason}`,
    undone: 'Poveznica i promjena su vraćene.',
    keptAdded: (reason) => `Poveznica je uklonjena, a promjena ostaje u Kreditima. ${reason}`,
  },
  notUndone: 'Nije poništeno',
  company: {
    kinds: {
      salary: 'plaća',
      rent: 'najamnina',
      'profit-payout': 'isplata dobiti',
      'owner-loan': 'pozajmica vlasnika',
      'cost-refund': 'vraćeni troškovi',
      'travel-allowance': 'putni dodaci',
      'tax-free-pay': 'neoporezivi primici',
      other: 'ostali novac',
    },
    toYou: (what, day) => `${capitalised(what)} iz Tvrtke, isplaćeno ${dayLabel(day)}`,
    fromYou: (what, day) => `${capitalised(what)} Tvrtki, uplaćeno ${dayLabel(day)}`,
    advance: (description, day) => `${description === '' ? 'Trošak' : description} koji ste platili za Tvrtku, ${dayLabel(day)}`,
    gone: 'Više nije u Tvrtki',
    opening: 'Povezano s Tvrtkom, koja se još otvara',
    failed: 'Povezano s Tvrtkom, koja se nije otvorila',
    notSetUp: 'Povezano s Tvrtkom, koja na ovom uređaju nije postavljena ili ne vodi plaću vlasnika',
    open: 'Otvori u Tvrtki',
    under: (amount, category) => `${amount} pod kategorijom „${category}”`,
    waits: (amount) => `${amount} bez kategorije`,
    files: (parts) => `Unos se razvrstava kao ${parts}.`,
    more: (amount) => `Unos je ${amount} veći od isplate, a razlika ostaje kao zaseban dio.`,
    less: (amount) => `Unos je ${amount} manji od isplate, a razlika ostaje kao zaseban dio.`,
    add: {
      open: 'Dodaj u Tvrtku',
      help: 'Dodaje trošak u Tvrtku kao predujam vlasnika, koji vam tvrtka duguje, a zatim ovaj unos razvrstava pod Za tvrtku i povezuje s njim. Jedno poništavanje vraća oboje.',
      category: 'Kategorija u Tvrtki',
      categoryHelp: 'Samo poslovni rashodi i porezi.',
      pickCategory: 'Odaberi kategoriju',
      description: 'Što je plaćeno',
      amount: 'Iznos u EUR',
      anAmount: 'Iznos veći od nule',
      save: 'Dodaj i poveži',
      inCompany: 'Predujam vlasnika dodan iz Potrošnje',
      done: 'Dodano u Tvrtku i povezano',
      notAdded: 'Nije dodano u Tvrtku',
      notLinked: 'Dodano u Tvrtku, nije povezano',
      staysAdded: (reason) => `Trošak ostaje u Tvrtki, gdje ga možete vidjeti i obrisati. ${reason}`,
      undone: 'Poveznica i trošak su vraćeni.',
      keptAdded: (reason) => `Poveznica je uklonjena, a trošak ostaje u Tvrtki. ${reason}`,
    },
  },
  investments: {
    deposit: (account, day) => `Uplata na račun ${account}, ${dayLabel(day)}`,
    withdrawal: (account, day) => `Isplata s računa ${account}, ${dayLabel(day)}`,
    more: (amount) => `stiglo ${amount} više`,
    less: (amount) => `stiglo ${amount} manje`,
    gone: 'Više nije u Ulaganjima',
    opening: 'Povezano s Ulaganjima, koja se još otvaraju',
    failed: 'Povezano s Ulaganjima, koja se nisu otvorila',
    notSetUp: 'Povezano s Ulaganjima, koja na ovom uređaju nisu postavljena',
    open: 'Otvori u Ulaganjima',
  },
  investmentsOffer: {
    deposit: (account, day) => `uplata na račun ${account}, ${dayLabel(day)}`,
    withdrawal: (account, day) => `isplata s računa ${account}, ${dayLabel(day)}`,
    // A movement's text ends in a Croatian date, which already ends in a full stop.
    is: (movement) => `Izgleda kao: ${movement}`,
    mayBe: (movement, difference) => `Možda je: ${movement}, ${difference}.`,
  },
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
    staysAdded: (reason) => `Prijevremena otplata ostaje u Kreditima, gdje je možete vidjeti i obrisati. ${reason}`,
    undone: 'Poveznica i prijevremena otplata su vraćene.',
    keptAdded: (reason) => `Poveznica je uklonjena, a prijevremena otplata ostaje u Kreditima. ${reason}`,
  },
  payments: {
    title: 'Plaćanja s Tvrtkom',
    rows: (count) => ({
      one: `${count} već razvrstana stavka odgovara isplati između Tvrtke i vas.`,
      few: `${count} već razvrstane stavke odgovaraju isplatama između Tvrtke i vas.`,
      other: `${count} već razvrstanih stavki odgovara isplatama između Tvrtke i vas.`,
    }),
    note: 'Povezivanje svaku razvrstava prema tome što je novac, isplaćen vama ili uplaćen Tvrtki: plaća, najamnina, isplata dobiti, putni dodaci, pozajmica vlasnika ili vraćeni troškovi.',
    putOff: 'Neće se ponovno nuditi do sljedeće isplate',
  },
  companyOffer: {
    // A payment's text ends in a Croatian date, which already ends in a full stop.
    is: (payment) => `Izgleda kao: ${payment}`,
    mayBe: (payment, difference) => `Možda je: ${payment}, ${difference}.`,
    mayBeAnotherDay: (payment) => `Možda je: ${payment}`,
    more: (amount) => `${amount} više od isplate`,
    less: (amount) => `${amount} manje od isplate`,
  },
  roles: {
    title: 'Kamo Kuna razvrstava isplate iz Tvrtke',
    subtitle: 'Odaberite kategoriju za svaku vrstu novca kad stavku povežete s isplatom iz Tvrtke.',
    names: { salary: 'Plaća i neoporezivi primici', 'rental-income': 'Najamnina', 'profit-payout': 'Isplate dobiti', 'travel-allowance': 'Dnevnice i kilometri' },
    add: (name) => `Dodaj „${name}”`,
    clash: 'Za svaku vrstu novca odaberite drugu kategoriju.',
    save: 'Spremi',
    saved: 'Kategorije za isplate iz Tvrtke spremljene',
    putOff: 'Neće se ponovno pitati do sljedeće isplate',
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
    case 'owner-payment':
      return companyPaymentText(target)
    case 'owner-advance':
      return words.company.advance(target.description, target.day)
    case 'cash-movement':
      return (target.movement === 'deposit' ? words.investments.deposit : words.investments.withdrawal)(target.accountName, target.day)
  }
}

/** A payment with your company by what its money is and its day, such as "Salary from Company, paid 10 Nov". */
function companyPaymentText(target: OwnerPaymentTarget): string {
  const what = listInWords([...new Set(target.parts.map((part) => words.company.kinds[part.kind]))])
  return (target.direction === 'to-owner' ? words.company.toYou : words.company.fromYou)(what, target.day)
}

/** An instalment by its loan, its number in the plan and its due date, or interim interest by its loan and due date. */
export function instalmentText(target: InstalmentTarget): string {
  return target.number === null ? words.interim(target.loanName, target.due) : words.instalment(target.loanName, target.number, target.count, target.due)
}

/** The record a link names in words: an instalment by its number in the plan, any other as the picker lists it. */
export function targetText(target: LinkTarget): string {
  return target.kind === 'instalment' ? instalmentText(target) : choiceText(target)
}

/** What a row's link reads as: the record it names, or why that record is not shown, in the words of the kind of app it names. */
export function linkText(read: LinkState<LinkTarget>, source: TargetSource): string {
  if (read.state === 'there') return targetText(read.target)
  const said = source === 'company' ? words.company : source === 'investments' ? words.investments : words
  return { opening: said.opening, failed: said.failed, 'not-set-up': said.notSetUp, gone: said.gone }[read.state]
}
