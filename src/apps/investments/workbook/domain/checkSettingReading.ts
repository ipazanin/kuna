import { CHECKS, CHECK_DEFAULTS } from './checkSetting'
import type { CheckSetting } from './checkSetting'
import { decimalField, percentField } from './investmentFields'
import { CHECK_RECORDS } from './investmentKinds'
import { words } from './words'
import { labelWords, withIdField } from '../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import { filledFields } from '../../../../shared/storage/domain/recordFields'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { booleanOf, ownId, refuse, requiredChoice, textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'

/** A record changes its check's threshold, switches it off, or both. */
export function checkSettingOf(fields: StoredFields, id: RecordId | null): CheckSetting {
  const check = requiredChoice(fields, 'check', CHECKS, 'check')
  const threshold = fields.threshold === undefined ? null : percentField(fields, 'threshold')
  const off = fields.off === undefined ? false : (booleanOf(fields.off) ?? refuse(words.notAFlag('off', fields.off.text)))
  if (!off && (threshold === null || threshold === CHECK_DEFAULTS[check])) refuse(words.checkChangesNothing)
  return { id: ownId(id), check, threshold, off }
}

export const CHECK_CODEC: RecordCodec<CheckSetting> = withIdField(
  CHECK_RECORDS,
  (fields) => labelWords([textOf(fields.check)]),
  checkSettingOf,
  (setting) => filledFields({ check: setting.check, threshold: decimalField(setting.threshold), off: setting.off ? true : null }),
)
