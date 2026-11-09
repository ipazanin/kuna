import { CITY_WITHOUT_SURTAX, cityOfValue } from '../../tax/domain/citySurtax'
import { SETTING_WRITES } from '../../workbook/application/settingWrites'
import { SURTAX_CITY_2023_KEY } from '../../workbook/domain/investmentSettings'
import { TEXT, inputOf } from '../../../../shared/app/operationInput'
import { StepRefused } from '../../../../shared/app/proposedWrites'
import { setSetting } from '../../../../shared/storage/application/settingWrites'
import { unchanged } from './investmentSteps'
import type { InvestmentSteps } from './investmentSteps'

/** The value a step sets, checked as the Tax screen's list allows it: a code of the 2023 table, none, or blank to clear it. */
function surtaxCityValue(text: string): string {
  const value = text.trim()
  if (value !== '' && cityOfValue(value) === null) {
    throw new StepRefused(`${value} is no code of Porezna's 2023 table. Look the place up in surtax-city-2023, or write ${CITY_WITHOUT_SURTAX} for a place the table leaves out.`)
  }
  return value
}

/** The Investments settings, as the Tax screen's 2023 city card sets them. */
export const SETTING_STEPS: InvestmentSteps = {
  operations: [
    {
      name: 'set-setting',
      about: `The 2023 city, as the Tax screen's card sets it: a code from surtax-city-2023, ${CITY_WITHOUT_SURTAX} for a place the table leaves out, or blank to clear it.`,
      input: inputOf({ key: { type: 'string', enum: [SURTAX_CITY_2023_KEY] }, value: TEXT }),
      refs: {},
      creates: null,
      alone: false,
      example: { key: SURTAX_CITY_2023_KEY, value: '133' },
    },
  ],
  write(unit, card, { input }) {
    setSetting(unit, SETTING_WRITES, card.storedSettings, SURTAX_CITY_2023_KEY, surtaxCityValue(String(input['value'])))
    return unchanged(card)
  },
}
