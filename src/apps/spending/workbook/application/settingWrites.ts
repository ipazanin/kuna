import { SPENDING_RETIRED_SETTING_KEYS, SPENDING_SETTING_CHECKS } from '../domain/readSpendingBook'
import { SETTING_RECORDS } from '../domain/spendingKinds'
import { settingWrites } from '../../../../shared/storage/application/settingWrites'

export const SETTING_WRITES = settingWrites(SETTING_RECORDS, SPENDING_SETTING_CHECKS, SPENDING_RETIRED_SETTING_KEYS)
