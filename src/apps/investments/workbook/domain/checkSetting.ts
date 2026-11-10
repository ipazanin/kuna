import { decimalOfText } from '../../../../shared/money/decimal'
import type { Decimal } from '../../../../shared/money/decimal'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/**
 * What the portfolio checks look at: the largest holding, currency, sector, country or region and account, the cash,
 * the last 12 months' costs against the average value, and the largest gap to a target.
 */
export const CHECKS = ['holding', 'currency', 'sector', 'country', 'account', 'cash', 'costs', 'target-gap'] as const

export type CheckName = (typeof CHECKS)[number]

/** Each check's threshold in percent of the value, the target gap's in points, until a check record changes it. */
export const CHECK_DEFAULTS: { readonly [Check in CheckName]: Decimal } = {
  holding: decimalOfText('20')!,
  currency: decimalOfText('50')!,
  sector: decimalOfText('30')!,
  country: decimalOfText('60')!,
  account: decimalOfText('50')!,
  cash: decimalOfText('10')!,
  costs: decimalOfText('1')!,
  'target-gap': decimalOfText('5')!,
}

/** A check whose threshold or switch differs from its default. The file keeps no record for a check left as it is. */
export interface CheckSetting {
  readonly id: RecordId
  readonly check: CheckName
  /** Null keeps the default. */
  readonly threshold: Decimal | null
  /** Switched off, so the check is left out. */
  readonly off: boolean
}

/** What a new check setting holds unless a person sets it: switched on. */
export const NEW_CHECK_DEFAULTS: Pick<CheckSetting, 'off'> = { off: false }
