import { withFullStop } from '../../../../../../shared/text/withFullStop'
import { language } from '../../../../../../shared/text/language'
import { plural } from '../../../../../../shared/text/translation'
import type { EnglishForms, Translation } from '../../../../../../shared/text/translation'
import { uncapitalised } from '../../../../../../shared/text/capitalised'
import { monthCase } from '../../../../../../shared/calendar/monthCase'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// Corporate income tax is porez na dobit, its monthly advance predujam poreza na dobit and its balance due razlika za uplatu. A Croatian year ends in its own full stop.

export const en = {
  rateDefinition:
    'Taxes paid less tax refunded, over client revenue, both over the year. Client revenue is the categories with the revenue role, ' +
    'so a grant, interest or a refund never enlarges the base. A refund sits in the taxes bucket and lowers the taxes instead.',
  paid: (unit: string) => `${unit} paid`,
  netOfRefunds: 'Net of refunds',
  paidDefinition: (unit: string) => `Everything in the ${uncapitalised(unit)} bucket over the year. A refund booked there lowers it.`,
  effectiveRate: 'Effective tax rate',
  noRevenue: 'No client revenue in this year',
  rateOf: (taxes: string, revenue: string) => `${taxes} on ${revenue} of revenue`,
  noTaxPaidIn: (period: string) => `No tax was paid in ${period}.`,
  byTypeIn: (period: string, parts: string, refunds: string, net: string) => `Tax by type in ${period}: ${parts}.${refunds} Net ${net}.`,
  monthSoFar: 'Month so far',
  noWatchedPayment: 'No watched tax category has a payment yet',
  cadenceOf: (name: string | null, paid: number, elapsed: number, missed: number) => `${name === null ? '' : `${name}, `}${paid} of ${elapsed} months paid${missed === 0 ? '' : `, ${missed} missed`}`,
  corporate: {
    title: 'Corporate income tax, expected against paid',
    needsRegistered: 'Needs the day the company was registered',
    overdueSummary: (count: number, owed: string): EnglishForms => ({ one: `${count} payment overdue, ${owed} still owed`, other: `${count} payments overdue, ${owed} still owed` }),
    yearsSummary: (count: number): EnglishForms => ({ one: `${count} tax year, nothing overdue`, other: `${count} tax years, nothing overdue` }),
    subtitle:
      "Each year's balance due and monthly advances from the first tax period on, filled by the bank rows oldest due date first, since the annual payment and the advances share one payment code. A year whose return is not on the year-end tab sets its advances from our own estimate.",
    seenOn: (day: string) => `Seen on ${day}, the newest booking.`,
    unregistered: ' is blank, so the tax periods and the schedule of advances are not known.',
    setOnSettings: 'Set it on Settings',
    overdueBefore: (count: number): EnglishForms => ({ one: `${count} payment is overdue, `, other: `${count} payments are overdue, ` }),
    overdueAfter: ' still owed.',
    unmatched: 'Payments no obligation takes, and refunds:',
    openRow: (label: string) => `${label}, open the row`,
    noYears: 'A first tax period pays no advances, and no return has left a balance yet.',
    forYear: (year: number) => `For ${year}`,
    paidOf: 'paid of',
  },
  cadence: {
    title: 'Payroll cadence',
    subtitle: 'Every watched tax, month by month since its first payment, whatever the year. A month counts as paid when any payment landed in it.',
    salaries: 'Salaries',
    salariesChecks: ' checks each payday by employee and line.',
    none: 'No watched tax category has a payment yet.',
    since: (name: string, since: string) => `${name}, since ${since}`,
    monthsPaid: 'Complete months paid',
    paidOfRows: (name: string, paid: number, elapsed: number) => `${name}, ${paid} of ${elapsed} months paid, open the rows`,
    paidOf: (paid: number, elapsed: number) => `${paid} of ${elapsed}`,
    missed: 'Missed',
    none2: 'None',
    typical: 'Typical month',
    typicalRows: (name: string) => `${name}, typical month, open the rows`,
  },
  calendar: {
    paid: 'Paid',
    missed: 'Missed',
    notDue: 'Not due yet',
    missedCell: (month: string) => `${month}, missed, open the months around it`,
    notDueCell: (month: string) => `${month}, not due yet`,
    paidCell: (month: string, amount: string) => `${month}, paid ${amount}, open the rows`,
    key: (name: string) => `Key to the ${name} calendar`,
    caption: (name: string) => `${name}, month by month`,
    month: 'Month',
    year: 'Year',
  },
  byType: {
    title: 'Tax by type',
    noneIn: (year: number) => `No tax was paid in ${year}.`,
    subtitle: (period: string) => `${period}. Paid on balance, by category.`,
    definition:
      'Each category of the taxes bucket that paid out more than it took back, as a share of the ring. A refund cannot be a slice, so it sits under the ring, and with it the ring makes the taxes paid.',
    paidIn: (year: number) => `paid in ${year}`,
    less: (label: string) => `Less ${uncapitalised(label)}`,
    byMonth: 'Tax by type, by month',
    byMonthSubtitle: (period: string) => `${period}. Click a month or a band for its rows.`,
    byMonthDefinition: 'Each category of the taxes bucket, stacked. A refund dips below zero in the month it landed. The month still running is hatched.',
  },
  months: (count: number): EnglishForms => ({ one: `${count} month with a tax payment`, other: `${count} months with a tax payment` }),
  noMonth: 'No month with a tax payment',
}

export const hr: Translation<typeof en> = {
  rateDefinition:
    'Plaćeni porezi umanjeni za vraćeni porez, podijeljeni s prihodom od klijenata, oboje za godinu. Prihod od klijenata čine kategorije s ulogom revenue, ' +
    'pa potpora, kamata ili povrat nikad ne povećavaju osnovicu. Povrat stoji u skupini poreza i umjesto toga smanjuje poreze.',
  paid: (unit) => `${unit}, uplate`,
  netOfRefunds: 'Umanjeno za povrate',
  paidDefinition: (unit) => `Sve u skupini „${unit}” tijekom godine. Povrat knjižen ondje smanjuje iznos.`,
  effectiveRate: 'Efektivna porezna stopa',
  noRevenue: 'U ovoj godini nema prihoda od klijenata',
  rateOf: (taxes, revenue) => `${taxes} na ${revenue} prihoda`,
  noTaxPaidIn: (period) => `U razdoblju ${withFullStop(period)} nije plaćen nijedan porez.`,
  byTypeIn: (period, parts, refunds, net) => `Porezi po vrsti, ${period}: ${parts}.${refunds} Neto ${net}.`,
  monthSoFar: 'Tekući mjesec',
  noWatchedPayment: 'Nijedna praćena porezna kategorija još nema uplatu',
  cadenceOf: (name, paid, elapsed, missed) =>
    `${name === null ? '' : `${name}, `}uplate za ${paid} od ${elapsed} ${plural({ one: 'mjeseca', few: 'mjeseca', other: 'mjeseci' }, elapsed)}${missed === 0 ? '' : `, propušteno ${missed}`}`,
  corporate: {
    title: 'Porez na dobit, očekivano i plaćeno',
    needsRegistered: 'Treba dan registracije tvrtke',
    overdueSummary: (count, owed) => ({
      one: `${count} uplata kasni, još se duguje ${owed}`,
      few: `${count} uplate kasne, još se duguje ${owed}`,
      other: `${count} uplata kasni, još se duguje ${owed}`,
    }),
    yearsSummary: (count) => ({
      one: `${count} porezna godina, ništa ne kasni`,
      few: `${count} porezne godine, ništa ne kasni`,
      other: `${count} poreznih godina, ništa ne kasni`,
    }),
    subtitle:
      'Razlika za uplatu i mjesečni predujmovi svake godine od prvog poreznog razdoblja, koje bankovne stavke popunjavaju od najstarijeg dospijeća, jer godišnja uplata i predujmovi dijele isti poziv na broj. Godina čija prijava nije na listu „year-end” predujmove određuje iz naše procjene.',
    seenOn: (day) => `Gledano na dan ${day}, dan najnovije stavke.`,
    unregistered: ' je prazno, pa porezna razdoblja i raspored predujmova nisu poznati.',
    setOnSettings: 'Postavite ga u Postavkama',
    overdueBefore: (count) => ({ one: `${count} uplata kasni, a još se duguje `, few: `${count} uplate kasne, a još se duguje `, other: `${count} uplata kasni, a još se duguje ` }),
    overdueAfter: '.',
    unmatched: 'Uplate koje ne pokrivaju nijednu obvezu i povrati:',
    openRow: (label) => `${label}, otvori stavku`,
    noYears: 'Prvo porezno razdoblje ne plaća predujmove, a nijedna prijava još nije ostavila razliku.',
    forYear: (year) => `Za ${year}.`,
    paidOf: 'plaćeno od',
  },
  cadence: {
    title: 'Ritam plaćanja poreza na plaće',
    subtitle: 'Svaki praćeni porez, mjesec po mjesec od prve uplate, bez obzira na godinu. Mjesec se broji kao plaćen kad je u njemu stigla bilo kakva uplata.',
    salaries: 'Plaće',
    salariesChecks: ' provjeravaju svaki dan isplate po zaposleniku i stavci.',
    none: 'Nijedna praćena porezna kategorija još nema uplatu.',
    since: (name, since) => `${name}, od ${monthCase(since, 'genitive')}`,
    monthsPaid: 'Plaćeni cijeli mjeseci',
    paidOfRows: (name, paid, elapsed) => `${name}, uplate za ${paid} od ${elapsed} ${plural({ one: 'mjeseca', few: 'mjeseca', other: 'mjeseci' }, elapsed)}, otvori stavke`,
    paidOf: (paid, elapsed) => `${paid} od ${elapsed}`,
    missed: 'Propušteno',
    none2: 'Nijedan',
    typical: 'Uobičajeni mjesec',
    typicalRows: (name) => `${name}, uobičajeni mjesec, otvori stavke`,
  },
  calendar: {
    paid: 'Plaćeno',
    missed: 'Propušteno',
    notDue: 'Još ne dospijeva',
    missedCell: (month) => `${month}, propušteno, otvori susjedne mjesece`,
    notDueCell: (month) => `${month}, još ne dospijeva`,
    paidCell: (month, amount) => `${month}, plaćeno ${amount}, otvori stavke`,
    key: (name) => `Legenda kalendara: ${name}`,
    caption: (name) => `${name}, mjesec po mjesec`,
    month: 'Mjesec',
    year: 'Godina',
  },
  byType: {
    title: 'Porezi po vrsti',
    noneIn: (year) => `U ${year}. nije plaćen nijedan porez.`,
    subtitle: (period) => `${withFullStop(period)} Plaćeno u neto iznosu, po kategoriji.`,
    definition:
      'Svaka kategorija skupine poreza na kojoj je plaćeno više nego što je vraćeno, kao dio prstena. Povrat ne može biti dio prstena, pa stoji ispod njega, a s njim prsten čini plaćene poreze.',
    paidIn: (year) => `plaćeno u ${year}.`,
    less: (label) => `Umanjeno za „${label}”`,
    byMonth: 'Porezi po vrsti, po mjesecima',
    byMonthSubtitle: (period) => `${withFullStop(period)} Kliknite mjesec ili pojas za njegove stavke.`,
    byMonthDefinition: 'Svaka kategorija skupine poreza, složena jedna na drugu. Povrat pada ispod nule u mjesecu u kojem je stigao. Mjesec u tijeku je šrafiran.',
  },
  months: (count) => ({ one: `${count} mjesec s uplatom poreza`, few: `${count} mjeseca s uplatom poreza`, other: `${count} mjeseci s uplatom poreza` }),
  noMonth: 'Nijedan mjesec s uplatom poreza',
}

export const words = language === 'hr' ? hr : en
