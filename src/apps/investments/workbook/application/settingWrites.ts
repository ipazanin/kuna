import { SURTAX_CITY_2023_CHECK } from '../../tax/domain/citySurtax'
import { SETTING_RECORDS } from '../domain/investmentKinds'
import { SURTAX_CITY_2023_KEY } from '../domain/investmentSettings'
import { settingWrites } from '../../../../shared/storage/application/settingWrites'
import type { SettingChecks } from '../../../../shared/storage/domain/settingRows'

/** Each key Investments knows, with the check of its value. */
export const INVESTMENT_SETTING_CHECKS: SettingChecks = new Map([[SURTAX_CITY_2023_KEY, SURTAX_CITY_2023_CHECK]])

/** Keys Investments no longer reads that older files may still hold. */
export const INVESTMENT_RETIRED_SETTING_KEYS: ReadonlySet<string> = new Set()

export const SETTING_WRITES = settingWrites(SETTING_RECORDS, INVESTMENT_SETTING_CHECKS, INVESTMENT_RETIRED_SETTING_KEYS)
