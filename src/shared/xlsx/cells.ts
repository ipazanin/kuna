import type { CellObject } from 'xlsx'

import { serialFromCivilDate } from '../calendar/civilDate'
import type { CivilDate } from '../calendar/civilDate'
import { amountOf } from '../money/money'
import type { Money } from '../money/money'

/** How a day cell shows its date, such as 21.9.2026. */
const DAY_FORMAT = 'd.m.yyyy.'

/** How a euro cell shows its amount, with thousands grouped and two decimals. */
const EURO_FORMAT = '#,##0.00'

/** A day as a spreadsheet date, so the sheet can sort and count with it. */
export function dayCell(day: CivilDate): CellObject {
  return { t: 'n', v: serialFromCivilDate(day), z: DAY_FORMAT }
}

/** An amount in euros as a number cell, or a blank cell when there is no amount. */
export function eurosCell(money: Money | null): CellObject | undefined {
  return money === null ? undefined : { t: 'n', v: amountOf(money), z: EURO_FORMAT }
}
