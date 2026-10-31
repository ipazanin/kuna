import { language } from '../../../../shared/text/language'
import { plural } from '../../../../shared/text/translation'
import type { Translation } from '../../../../shared/text/translation'
import type { CONDITION_COLUMNS } from './rule'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// A rule files a row (razvrstava stavku), a counterparty is partner, and a row of the rules tab is redak. A column keeps its name as the file stores it, such as direction.

type ConditionColumn = (typeof CONDITION_COLUMNS)[number]

export const en = {
  conditions: {
    moneyIn: 'Money in',
    moneyOut: 'Money out',
    ibanIs: (iban: string) => `Counterparty IBAN is ${iban}`,
    hasIban: 'Has a counterparty IBAN',
    hasNoIban: 'Has no counterparty IBAN',
    own: 'Counterparty is one of your accounts',
    client: 'Counterparty is a client',
    counterpartyContains: (fragment: string) => `Counterparty contains "${fragment}"`,
    descriptionContains: (fragment: string) => `Description contains "${fragment}"`,
    descriptionStartsWith: (fragment: string) => `Description starts with "${fragment}"`,
    domainIs: (code: string) => `Bank domain code is ${code}`,
    familyIs: (code: string) => `Bank family code is ${code}`,
    subFamilyIs: (code: string) => `Bank sub-family code is ${code}`,
    purposeIs: (code: string) => `Purpose code is ${code}`,
    revenueCodeIs: (code: string) => `Revenue code is ${code}`,
    card: 'Card purchase',
    foreignCurrency: 'In a foreign currency',
  },
  /** What the form calls each condition column. */
  labels: {
    direction: 'Direction',
    counterparty_iban: 'Counterparty IBAN is',
    has_counterparty_iban: 'Counterparty IBAN',
    counterparty_is_own: 'Counterparty is one of your accounts',
    counterparty_is_client: 'Counterparty is a client',
    counterparty_contains: 'Counterparty contains',
    description_contains: 'Description contains',
    description_starts_with: 'Description starts with',
    tx_domain: 'Bank domain code is',
    tx_family: 'Bank family code is',
    tx_sub_family: 'Bank sub-family code is',
    purpose: 'Purpose code is',
    revenue_code: 'Revenue code is',
    is_card: 'Card purchase',
    foreign_currency: 'In a foreign currency',
  } satisfies Readonly<Record<ConditionColumn, string>>,
  /** What a save did to the rules tab, in a few words. */
  changes: {
    renumbered: (count: number) => (count === 0 ? '' : `, and renumbered ${count} ${count === 1 ? 'rule' : 'rules'}`),
    added: (id: string, renumbered: string) => `Added ${id}${renumbered}`,
    deleted: (id: string) => `Deleted ${id}`,
    none: 'Changed no rule',
    moved: (ahead: string, behind: string) => `Moved ${ahead} ahead of ${behind}`,
    renumberedRules: (count: number) => `Renumbered ${count} rules`,
    switched: (on: boolean, id: string) => `${on ? 'Switched on' : 'Switched off'} ${id}`,
    edited: (id: string, columns: string, renumbered: string) => `Edited ${id}: ${columns}${renumbered}`,
  },
  /** Why a row of the rules tab is left out. */
  reading: {
    unknownColumns: (columns: string) => `${columns} is not a column a rule can test`,
    noId: 'a row without a rule id',
    sharedId: 'the id is on more than one row, so none of them is tried',
    notANumber: (order: string) => `the order "${order}" is not a number`,
    notABoolean: (enabled: string) => `the enabled cell "${enabled}" is neither TRUE nor FALSE`,
    unknownConfidence: (confidence: string) => `the confidence "${confidence}" is neither rule nor review`,
    undefinedCategory: (category: string) => `it files rows as "${category}" at rule confidence, and the categories tab does not define it`,
    noCondition: 'no condition, so it would match every row',
    direction: (text: string) => `direction is "${text}", and it is credit, debit or blank`,
    trueFalseOrBlank: (column: string, text: string) => `${column} is "${text}", and it is TRUE, FALSE or blank`,
    trueOrBlank: (column: string, text: string) => `${column} is "${text}", and it is TRUE or blank`,
    revenueCode: (code: string) => `revenue_code is "${code}", and it is four digits`,
  },
  /** Why a change to the rules tab cannot be made to the rows it holds now. */
  tab: {
    gone: (id: string) => `no row on the rules tab has the id "${id}" any more`,
    several: (count: number, id: string) => `${count} rows on the rules tab have the id "${id}", so the app cannot tell which to change`,
    changed: (id: string) => `rule "${id}" changed since the app last read it`,
  },
}

export const hr: Translation<typeof en> = {
  conditions: {
    moneyIn: 'Uplata',
    moneyOut: 'Isplata',
    ibanIs: (iban) => `IBAN partnera je ${iban}`,
    hasIban: 'Ima IBAN partnera',
    hasNoIban: 'Nema IBAN partnera',
    own: 'Partner je jedan od vaših računa',
    client: 'Partner je klijent',
    counterpartyContains: (fragment) => `Partner sadrži „${fragment}”`,
    descriptionContains: (fragment) => `Opis sadrži „${fragment}”`,
    descriptionStartsWith: (fragment) => `Opis počinje s „${fragment}”`,
    domainIs: (code) => `Bankovna šifra domene je ${code}`,
    familyIs: (code) => `Bankovna šifra obitelji je ${code}`,
    subFamilyIs: (code) => `Bankovna šifra podobitelji je ${code}`,
    purposeIs: (code) => `Šifra namjene je ${code}`,
    revenueCodeIs: (code) => `Šifra prihoda je ${code}`,
    card: 'Kupnja karticom',
    foreignCurrency: 'U stranoj valuti',
  },
  labels: {
    direction: 'Smjer',
    counterparty_iban: 'IBAN partnera je',
    has_counterparty_iban: 'IBAN partnera',
    counterparty_is_own: 'Partner je jedan od vaših računa',
    counterparty_is_client: 'Partner je klijent',
    counterparty_contains: 'Partner sadrži',
    description_contains: 'Opis sadrži',
    description_starts_with: 'Opis počinje s',
    tx_domain: 'Bankovna šifra domene je',
    tx_family: 'Bankovna šifra obitelji je',
    tx_sub_family: 'Bankovna šifra podobitelji je',
    purpose: 'Šifra namjene je',
    revenue_code: 'Šifra prihoda je',
    is_card: 'Kupnja karticom',
    foreign_currency: 'U stranoj valuti',
  },
  changes: {
    renumbered: (count) =>
      count === 0 ? '' : plural({ one: `, i prenumerirano je ${count} pravilo`, few: `, i prenumerirana su ${count} pravila`, other: `, i prenumerirano je ${count} pravila` }, count),
    added: (id, renumbered) => `Dodano: ${id}${renumbered}`,
    deleted: (id) => `Obrisano: ${id}`,
    none: 'Nijedno pravilo nije promijenjeno',
    moved: (ahead, behind) => `${ahead} premješteno ispred ${behind}`,
    renumberedRules: (count) => plural({ one: `Prenumerirano je ${count} pravilo`, few: `Prenumerirana su ${count} pravila`, other: `Prenumerirano je ${count} pravila` }, count),
    switched: (on, id) => `${on ? 'Uključeno' : 'Isključeno'}: ${id}`,
    edited: (id, columns, renumbered) => `Uređeno: ${id} (${columns})${renumbered}`,
  },
  reading: {
    unknownColumns: (columns) => `${columns}: nije stupac koji pravilo može provjeravati`,
    noId: 'redak bez oznake pravila',
    sharedId: 'oznaka je u više redaka, pa se nijedan od njih ne isprobava',
    notANumber: (order) => `redoslijed (order) „${order}” nije broj`,
    notABoolean: (enabled) => `ćelija enabled „${enabled}” nije ni TRUE ni FALSE`,
    unknownConfidence: (confidence) => `confidence „${confidence}” nije ni rule ni review`,
    undefinedCategory: (category) => `razvrstava stavke kao „${category}” uz sigurnost rule, a ta kategorija nije među kategorijama`,
    noCondition: 'nema uvjeta, pa bi odgovaralo svakoj stavci',
    direction: (text) => `direction je „${text}”, a smije biti credit, debit ili prazno`,
    trueFalseOrBlank: (column, text) => `${column} je „${text}”, a smije biti TRUE, FALSE ili prazno`,
    trueOrBlank: (column, text) => `${column} je „${text}”, a smije biti TRUE ili prazno`,
    revenueCode: (code) => `revenue_code je „${code}”, a mora imati četiri znamenke`,
  },
  tab: {
    gone: (id) => `nijedan redak pravila više nema oznaku „${id}”`,
    several: (count, id) =>
      plural(
        {
          one: `${count} redak pravila ima oznaku „${id}”, pa aplikacija ne zna koji promijeniti`,
          few: `${count} retka pravila imaju oznaku „${id}”, pa aplikacija ne zna koji promijeniti`,
          other: `${count} redaka pravila ima oznaku „${id}”, pa aplikacija ne zna koji promijeniti`,
        },
        count,
      ),
    changed: (id) => `pravilo „${id}” promijenilo se otkad ga je aplikacija zadnji put pročitala`,
  },
}

export const words = language === 'hr' ? hr : en
