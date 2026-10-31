import { withFullStop } from '../../../../../../shared/text/withFullStop'
import { language } from '../../../../../../shared/text/language'
import type { Translation } from '../../../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// The year-end close is zaključak godine, the accountant knjigovođa, and a rule of the ruleset odredba. A Croatian date and year end in their own full stop.

export const en = {
  description: "How the year ends, and whether our books agree with the accountant's for the last one.",
  picker: 'Year',
  tabs: {
    label: 'Parts of the year',
    accountant: 'Accountant',
    statements: 'Statements',
    forecast: 'Forecast',
    plan: 'Plan',
    pay: 'Pay',
    taxes: 'Taxes',
    assets: 'Assets',
  },
  banner: {
    title: 'Planning figures to discuss with your accountant, not filing advice',
    checked: (checkedOn: string, forecastSeenOn: string | null) =>
      `The rules behind them were last checked against their sources on ${checkedOn}.${forecastSeenOn === null ? '' : ` The forecast is seen on ${forecastSeenOn}, the newest booking.`}`,
  },
  watchedFor: (wording: string, year: number, rules: string) => `${wording} for ${year}: ${rules}.`,
  noPaymentCalendar: 'no tax has a payment calendar',
  noVatBefore: 'No category has a ',
  noVatAfter: ' treatment, so no input VAT leaves the costs.',
  setOnCategories: 'Set it on Settings, Categories',
  unregistered: (year: number) => ` is blank, so ${year} counts as a full tax period and the advances paid in it are not known.`,
  setOnSettings: 'Set it on Settings',
  notWorkedOut: 'The year could not be worked out',
}

export const hr: Translation<typeof en> = {
  description: 'Kako završava godina i slaže li se naša evidencija s knjigovođinom za zadnju godinu.',
  picker: 'Godina',
  tabs: {
    label: 'Dijelovi godine',
    accountant: 'Knjigovođa',
    statements: 'Izvještaji',
    forecast: 'Prognoza',
    plan: 'Plan',
    pay: 'Isplate',
    taxes: 'Porezi',
    assets: 'Imovina',
  },
  banner: {
    title: 'Brojke za planiranje s knjigovođom, a ne savjet za predaju prijava',
    checked: (checkedOn, forecastSeenOn) =>
      `Odredbe na kojima počivaju zadnji su put provjerene prema izvorima ${withFullStop(checkedOn)}${forecastSeenOn === null ? '' : ` Prognoza se gleda na dan ${forecastSeenOn}, dan najnovije stavke.`}`,
  },
  watchedFor: (wording, year, rules) => `${wording} za ${year}.: ${rules}.`,
  noPaymentCalendar: 'nijedan porez nema kalendar plaćanja',
  noVatBefore: 'Nijedna kategorija nema postavljen ',
  noVatAfter: ' tretman, pa se iz troškova ne izdvaja pretporez.',
  setOnCategories: 'Postavite ga u Postavkama, pod Kategorije',
  unregistered: (year) => ` je prazno, pa se ${year}. broji kao cijelo porezno razdoblje, a predujmovi plaćeni u njoj nisu poznati.`,
  setOnSettings: 'Postavite ga u Postavkama',
  notWorkedOut: 'Godina se nije mogla izračunati',
}

export const words = language === 'hr' ? hr : en
