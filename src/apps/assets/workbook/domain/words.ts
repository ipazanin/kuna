import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import { dayText, labelWords, numberText } from '../../../../shared/storage/domain/recordCodec'
import { textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'
import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. A field keeps its name as the file stores it, such as first_registration.
// English keeps the file's dates, and Croatian writes them its own way.

/** A valuation as Croatian names it: its day and its value as Croatian writes them, or the fields' text where they hold neither. */
function croatianValuationLabel(fields: StoredFields): string {
  const day = fields.date?.date ?? null
  const value = fields.value?.money ?? null
  return labelWords([day === null ? textOf(fields.date) : dayLabel(day), value === null ? textOf(fields.value) : formatMoney(value)])
}

export const en = {
  /** The words that name a valuation, as its stored fields read. */
  valuationLabel: (fields: StoredFields) => labelWords([dayText(fields.date), numberText(fields.value)]),
  priceWithoutBought: 'price is filled without bought, the day it was paid',
  regionNotHome: 'region is for a flat or house only',
  registrationNotCar: 'first_registration is for a car only',
  valueBelowZero: 'value is below zero',
  noAsset: 'names no asset in the file',
  loanShared: 'names the same bank loan as another asset, so neither shows what is yours after it. A loan goes on one asset',
  notALoan: (text: string) => `loan "${text}" is not the bare UUID of a bank loan`,
  beforeBought: (date: CivilDate, asset: string, bought: CivilDate) => `date ${date} is before "${asset}" was bought on ${bought}`,
  valuationSharesDay: (asset: string, date: CivilDate) => `another valuation of "${asset}" is on ${date} too`,
}

export const hr: Translation<typeof en> = {
  valuationLabel: croatianValuationLabel,
  priceWithoutBought: 'price je popunjen bez polja bought, dana plaćanja',
  regionNotHome: 'region vrijedi samo za stan ili kuću',
  registrationNotCar: 'first_registration vrijedi samo za automobil',
  valueBelowZero: 'value je manji od nule',
  noAsset: 'u datoteci nema imovine koju navodi',
  loanShared: 'navodi isti kredit kao druga stavka imovine, pa se ni kod jedne ne prikazuje vaš dio nakon kredita. Kredit ide uz jednu stavku imovine',
  notALoan: (text) => `loan „${text}” nije UUID kredita`,
  beforeBought: (date, asset, bought) => `datum ${dayLabel(date)} je prije kupnje „${asset}” ${dayLabel(bought)}`,
  valuationSharesDay: (asset, date) => `i druga procjena „${asset}” ima datum ${dayLabel(date)}`,
}

export const words = language === 'hr' ? hr : en
