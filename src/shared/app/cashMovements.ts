import type { RouteLocationRaw } from 'vue-router'

import type { CivilDate } from '../calendar/civilDate'
import type { Money } from '../money/money'
import type { PublishedLinkTarget } from './rowLinks'

/** Money paid into a broker's account or taken out of it, as another app reads it: the account's name, its day, its way and its euros. */
export interface PublishedCashMovement {
  readonly link: PublishedLinkTarget
  readonly accountName: string
  readonly day: CivilDate
  readonly kind: 'deposit' | 'withdrawal'
  /** Above zero, at the movement's own rate. The kind gives its direction. */
  readonly euros: Money
  readonly to: RouteLocationRaw
}

/** An app's deposits and withdrawals, a wait while its file opens, a failure, or null while the app is not set up. */
export type AppCashMovements = readonly PublishedCashMovement[] | 'opening' | 'failed' | null

/** The deposits and withdrawals one app publishes, under the app's id. */
export interface CashMovementsOfApp {
  readonly app: string
  readonly movements: AppCashMovements
}
