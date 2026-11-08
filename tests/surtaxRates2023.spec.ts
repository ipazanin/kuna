import { describe, expect, it } from 'vitest'

import { cityOf2023 } from '../src/apps/investments/tax/domain/citySurtax'
import { SURTAX_CITIES_2023, surtaxCity2023 } from '../src/apps/investments/tax/domain/surtaxRates2023'
import { surtaxCityChoices } from '../src/apps/investments/tax/presentation/surtaxCityChoices'
import { INVESTMENT_SETTING_CHECKS } from '../src/apps/investments/workbook/application/settingWrites'
import { SETTING_RECORDS } from '../src/apps/investments/workbook/domain/investmentKinds'
import { SURTAX_CITY_2023_KEY } from '../src/apps/investments/workbook/domain/investmentSettings'
import { writtenPercent } from '../src/shared/money/percent'
import { readSettingRows, settingRow } from '../src/shared/storage/domain/settingRows'
import type { SettingRow } from '../src/shared/storage/domain/settingRows'

function rateOf(code: string): number | null {
  const city = surtaxCity2023(code)
  return city === null ? null : writtenPercent(city.rate)
}

describe("Porezna's table of surtax rates for 2023", () => {
  it('holds every row of the table once, by its code', () => {
    const codes = SURTAX_CITIES_2023.map((city) => city.code)
    expect([SURTAX_CITIES_2023.length, new Set(codes).size, codes.every((code) => /^\d{3}$/.test(code))]).toEqual([322, 322, true])
  })

  it('gives the yearly 2023 rate of the last column for known cities', () => {
    // Zagreb 18, Rijeka 13 since 2023, Split 15, Osijek 13, Karlovac 9 since 2022, Vojnić 7.5, Duga Resa 10 since 2015,
    // and Đurmanec 0, which the table keeps after it ended its surtax.
    expect(['133', '373', '409', '312', '179', '503', '099', '108'].map((code) => [surtaxCity2023(code)?.name, rateOf(code)])).toEqual([
      ['Grad Zagreb', 18],
      ['Grad Rijeka', 13],
      ['Grad Split', 15],
      ['Grad Osijek', 13],
      ['Grad Karlovac', 9],
      ['Vojnić', 7.5],
      ['Grad Duga Resa', 10],
      ['Đurmanec', 0],
    ])
  })

  it('stays within the caps of the local taxes act, 18% for Zagreb and 15% elsewhere', () => {
    const highest = Math.max(...SURTAX_CITIES_2023.filter((city) => city.code !== '133').map((city) => writtenPercent(city.rate)))
    expect([rateOf('133'), highest]).toEqual([18, 15])
  })

  it('tells the two places called Otok apart by their Porezna office', () => {
    expect(SURTAX_CITIES_2023.filter((city) => city.name === 'Otok').map((city) => [city.code, city.office])).toEqual([
      ['535', 'Vinkovci'],
      ['314', 'Sinj'],
    ])
  })
})

describe("the owner's 2023 city", () => {
  const read = (rows: readonly SettingRow[]) => readSettingRows({ records: rows.map((row) => ({ record: row, id: row.id, label: row.key, fields: {} })), refused: [] }, INVESTMENT_SETTING_CHECKS)

  it('reads a code of the table, none for a city the table leaves out, and nothing for a code it lacks', () => {
    const of = (value: string) => cityOf2023([settingRow(SETTING_RECORDS, SURTAX_CITY_2023_KEY, value)])
    expect([of('373'), of('none'), of('999'), cityOf2023([])]).toEqual([{ kind: 'listed', city: surtaxCity2023('373') }, { kind: 'unlisted' }, null, null])
  })

  it('lists a setting key this Kuna does not know and leaves it out', () => {
    const reading = read([settingRow(SETTING_RECORDS, SURTAX_CITY_2023_KEY, '133'), settingRow(SETTING_RECORDS, 'later_setting', 'x')])
    expect([reading.facts.map((row) => row.key), reading.problems.map((problem) => problem.reason)]).toEqual([[SURTAX_CITY_2023_KEY], ['this Kuna knows no setting later_setting']])
  })

  it('lists a stored city that is neither a code of the table nor none, and leaves it out', () => {
    const reading = read([settingRow(SETTING_RECORDS, SURTAX_CITY_2023_KEY, '999')])
    expect([reading.facts, reading.problems.map((problem) => problem.reason)]).toEqual([[], ['surtax_city_2023 "999" is neither a code of Porezna\'s 2023 surtax table nor none']])
  })
})

describe('the 2023 city picker', () => {
  it('shows the name without Grad or Općina and with Sv. as Sveti, sorts by it, and tells a city from a municipality', () => {
    const choices = surtaxCityChoices(SURTAX_CITIES_2023)
    const zelina = choices.find((choice) => choice.city.code === '429')!
    expect([choices.length, zelina.city.name, zelina.kind, zelina.place, zelina.spelled]).toEqual([322, 'Grad Sv.Ivan Zelina', 'city', 'Sv.Ivan Zelina', 'Sveti Ivan Zelina'])
    expect(['033', '239'].map((code) => choices.find((choice) => choice.city.code === code)!).map((choice) => [choice.kind, choice.spelled])).toEqual([
      ['municipality', 'Brckovljani'],
      ['municipality', 'Lovas'],
    ])
    expect(choices.find((choice) => choice.city.code === '433')!.spelled).toBe('Sveti Petar u Šumi')
    expect(choices.slice(0, 2).map((choice) => choice.place)).toEqual(['Andrijaševci', 'Antunovac'])
    // Two places called Otok follow one another, Sinj's office before Vinkovci's.
    expect(choices.filter((choice) => choice.place === 'Otok').map((choice) => choice.city.office)).toEqual(['Sinj', 'Vinkovci'])
  })
})
