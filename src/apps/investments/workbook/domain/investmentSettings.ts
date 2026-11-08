import { SETTING_RECORDS } from './investmentKinds'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import { settingCodec } from '../../../../shared/storage/domain/settingRows'
import type { SettingRow } from '../../../../shared/storage/domain/settingRows'

/** The city or municipality whose surtax the owner paid on income of 2023, by Porezna's code. */
export const SURTAX_CITY_2023_KEY = 'surtax_city_2023'

export const SETTING_CODEC: RecordCodec<SettingRow> = settingCodec(SETTING_RECORDS)
