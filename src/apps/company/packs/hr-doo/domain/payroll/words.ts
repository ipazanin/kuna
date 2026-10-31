import type { CivilDate } from '../../../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../../../shared/calendar/dayLabel'
import { language } from '../../../../../../shared/text/language'
import { plural } from '../../../../../../shared/text/translation'
import type { Translation } from '../../../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// Gross pay is bruto plaća, with bruto I and bruto II, net pay neto plaća, the personal allowance osobni odbitak and pillar I and II I. i II. mirovinski stup.
// A month written as a key, such as 2026-09, stays as the payroll keys it. A payment's name, such as occasional-gift, stays as the ruleset names it.

export const en = {
  /** The labels of the payroll's figures, which the build-ups name. */
  month: {
    grossWithOverCaps: 'Gross salary with the payments over their tax-free caps',
    grossWithExtras: 'Gross salary with taxable extras',
    grossCapped: 'Gross, capped at the maximum pension base',
    gross: 'Gross',
    grossCappedYearly: 'Gross, capped at what is left of the annual maximum pension base',
    pillarOneBase: 'Pillar I base',
    pillarOne: (rate: string) => `Pension pillar I at ${rate}`,
    pillarTwo: (rate: string) => `Pension pillar II at ${rate}`,
    notAMember: 'Pension pillar II, not a member',
    income: 'Income after pension contributions',
    taxableIncome: 'Taxable income, not below zero',
    incomeTax: 'Income tax withheld in the month, without youth relief',
    net: 'Net salary',
    health: (rate: string) => `Health insurance at ${rate}, on top of the gross`,
    employerCost: 'Gross II, the salary cost to the company',
    paidToEmployee: 'Paid to the employee',
    totalCompanyCost: 'Total cost to the company',
    stateTake: 'Taken by the state',
    agreedGross: 'Agreed monthly gross',
    grossFor: (days: number, workingDays: number) => `Gross salary for ${days} of ${workingDays} working days`,
    grossSalary: 'Gross salary',
    directorFloor: 'Director floor for a full month',
    minimumWage: 'Minimum wage for a full month',
    lowPayRelief: 'Low-pay reduction of the pension base, on pillar I only as the accountant applies it (practice, not statute)',
    nontaxable: 'Non-taxable payments, kept apart from the salary',
  },
  allowance: {
    noLocalRates: (day: CivilDate, problem: string) => `No local income tax rates on ${day}: ${problem}.`,
    noRatesFor: (unit: string, day: CivilDate) => `The ruleset has no income tax rates for ${unit} on ${day}.`,
    dependant: (position: number, share: number) => `Dependant ${position} at ${share} of the allowance`,
    basic: 'Basic allowance',
    personal: 'Personal allowance',
    lowerRate: (rate: string) => `At the lower rate of ${rate}`,
    higherRate: (rate: string) => `At the higher rate of ${rate}`,
  },
  settlement: {
    incomeFor: (month: string) => `Income for ${month}, paid on`,
    income: 'Income of the year after pension contributions',
    allowanceFor: (months: number, elsewhere: number) =>
      elsewhere === 0 ? `Personal allowance for ${months} months` : `Personal allowance for ${months} months, the other ${elsewhere} used by another employer`,
    taxable: 'Taxable income of the year, not below zero',
    tax: 'Income tax of the year',
    withheldFor: (month: string) => `Withheld for ${month}, paid on`,
    withheld: 'Income tax withheld in the months',
    refund: 'Refund, or extra tax to pay when negative',
    noBirthYear: 'No youth relief, because the birth year is not set',
    notThisBirthYear: 'No youth relief for this birth year',
    youthRelief: (share: string) => `Youth relief of ${share} of the lower-rate tax`,
  },
  caps: {
    paidOn: 'Paid on',
    paidIn: (payment: string, period: string) => `${payment} paid in ${period}`,
    noCap: 'No cap applies here',
    left: 'Left under the cap',
    over: 'Over the cap, taxed as salary',
    yearly: 'Yearly cap',
    monthly: 'Monthly cap',
    capFor: (units: number, unitName: string) => `Cap for ${units} ${unitName}`,
    limited: 'Cap, limited to the monthly cap',
  },
}

export const hr: Translation<typeof en> = {
  month: {
    grossWithOverCaps: 'Bruto plaća s isplatama iznad neoporezivih iznosa',
    grossWithExtras: 'Bruto plaća s oporezivim dodacima',
    grossCapped: 'Bruto, ograničeno najvišom mirovinskom osnovicom',
    gross: 'Bruto',
    grossCappedYearly: 'Bruto, ograničeno ostatkom godišnje najviše mirovinske osnovice',
    pillarOneBase: 'Osnovica za I. stup',
    pillarOne: (rate) => `I. mirovinski stup po stopi ${rate}`,
    pillarTwo: (rate) => `II. mirovinski stup po stopi ${rate}`,
    notAMember: 'II. mirovinski stup, nije član',
    income: 'Dohodak nakon mirovinskih doprinosa',
    taxableIncome: 'Porezna osnovica, ne ispod nule',
    incomeTax: 'Porez na dohodak obustavljen u mjesecu, bez olakšice za mlade',
    net: 'Neto plaća',
    health: (rate) => `Zdravstveno osiguranje po stopi ${rate}, povrh bruta`,
    employerCost: 'Bruto II, trošak plaće za tvrtku',
    paidToEmployee: 'Isplaćeno zaposleniku',
    totalCompanyCost: 'Ukupni trošak tvrtke',
    stateTake: 'Uzima država',
    agreedGross: 'Ugovorena mjesečna bruto plaća',
    grossFor: (days, workingDays) => `Bruto plaća za ${days} od ${workingDays} ${plural({ one: 'radnog dana', few: 'radna dana', other: 'radnih dana' }, workingDays)}`,
    grossSalary: 'Bruto plaća',
    directorFloor: 'Najniža plaća direktora za cijeli mjesec',
    minimumWage: 'Minimalna plaća za cijeli mjesec',
    lowPayRelief: 'Umanjenje mirovinske osnovice za niske plaće, samo za I. stup kako ga primjenjuje knjigovođa (praksa, ne zakon)',
    nontaxable: 'Neoporezive isplate, odvojeno od plaće',
  },
  allowance: {
    noLocalRates: (day, problem) => `Nema lokalnih stopa poreza na dohodak na dan ${dayLabel(day)}: ${problem}.`,
    noRatesFor: (unit, day) => `Propisi nemaju stope poreza na dohodak za ${unit} na dan ${dayLabel(day)}`,
    dependant: (position, share) => `Uzdržavani član ${position}, faktor ${share} osobnog odbitka`,
    basic: 'Osnovni osobni odbitak',
    personal: 'Osobni odbitak',
    lowerRate: (rate) => `Po nižoj stopi od ${rate}`,
    higherRate: (rate) => `Po višoj stopi od ${rate}`,
  },
  settlement: {
    incomeFor: (month) => `Dohodak za ${month}, isplaćen`,
    income: 'Dohodak godine nakon mirovinskih doprinosa',
    allowanceFor: (months, elsewhere) => {
      const allowance = `Osobni odbitak za ${months} ${plural({ one: 'mjesec', few: 'mjeseca', other: 'mjeseci' }, months)}`
      return elsewhere === 0 ? allowance : `${allowance}, a ostalih ${elsewhere} iskoristio je drugi poslodavac`
    },
    taxable: 'Porezna osnovica godine, ne ispod nule',
    tax: 'Porez na dohodak godine',
    withheldFor: (month) => `Obustavljeno za ${month}, isplaćeno`,
    withheld: 'Porez na dohodak obustavljen kroz mjesece',
    refund: 'Povrat, ili doplata poreza kad je negativno',
    noBirthYear: 'Nema olakšice za mlade jer godina rođenja nije postavljena',
    notThisBirthYear: 'Nema olakšice za mlade za ovu godinu rođenja',
    youthRelief: (share) => `Olakšica za mlade od ${share} poreza po nižoj stopi`,
  },
  caps: {
    paidOn: 'Isplaćeno',
    paidIn: (payment, period) => `${payment}: isplata u razdoblju ${period}`,
    noCap: 'Ovdje ne vrijedi nikakav najviši iznos',
    left: 'Preostaje do najvišeg iznosa',
    over: 'Iznad najvišeg iznosa, oporezuje se kao plaća',
    yearly: 'Godišnji najviši iznos',
    monthly: 'Mjesečni najviši iznos',
    capFor: (units, unitName) => {
      const forms =
        unitName === 'kilometres'
          ? { one: 'kilometar', few: 'kilometra', other: 'kilometara' }
          : unitName === 'events'
            ? { one: 'događaj', few: 'događaja', other: 'događaja' }
            : { one: 'dan', few: 'dana', other: 'dana' }
      return `Najviši iznos za ${units} ${plural(forms, units)}`
    },
    limited: 'Najviši iznos, ograničen mjesečnim',
  },
}

export const words = language === 'hr' ? hr : en
