import type { Transaction } from '../../workbook/domain/transaction'
import { addDays } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { subtractAccountMoney, sumAccountMoney, ZERO_ACCOUNT_MONEY } from '../../../../shared/money/accountMoney'
import type { AccountMoney } from '../../../../shared/money/accountMoney'

/**
 * Where an opening drafted from a bank or its file comes from: `start` when every row from the day reaches back to an empty account,
 * `worked` when it is the bank's balance less the rows, `pending` when it is worked out the same way but the bank's balance may count
 * rows that have not booked, and `guess` when the bank gave no balance, so it is zero until you check it.
 */
export type OpeningSource = 'start' | 'worked' | 'pending' | 'guess'

export interface BankOpening {
  readonly openedOn: CivilDate
  readonly opening: AccountMoney
  readonly source: OpeningSource
  /** How many rows it was worked out from. */
  readonly rows: number
}

/** What an opening drafted from a bank or its file is worked out from: the rows it gave, its last balance, and whether that balance may count rows not booked yet. */
export interface OpeningEvidence {
  readonly rows: readonly Pick<Transaction, 'date' | 'amount'>[]
  readonly stated: AccountMoney | null
  readonly pending: boolean
}

function firstRowDay(rows: readonly Pick<Transaction, 'date'>[]): CivilDate | null {
  return rows.map((row) => row.date).reduce<CivilDate | null>((oldest, date) => (oldest === null || date < oldest ? date : oldest), null)
}

/**
 * What the account held at the start of the day it starts on, which is the bank's balance less every row from that day on. Rows
 * before it stay out of Kuna. A zero from a day no later than the first row means the rows reach back to an empty account. While
 * the bank holds pending rows a zero proves nothing, since its balance may count them.
 */
export function openingOn(evidence: OpeningEvidence, startsOn: CivilDate): BankOpening {
  const counted = evidence.rows.filter((row) => row.date >= startsOn)
  if (evidence.stated === null) return { openedOn: startsOn, opening: ZERO_ACCOUNT_MONEY, source: 'guess', rows: counted.length }
  const opening = subtractAccountMoney(evidence.stated, sumAccountMoney(counted.map((row) => row.amount)))
  const firstDay = firstRowDay(evidence.rows)
  const fromEmpty = opening === ZERO_ACCOUNT_MONEY && !evidence.pending && firstDay !== null && startsOn <= firstDay
  return { openedOn: startsOn, opening, source: evidence.pending ? 'pending' : fromEmpty ? 'start' : 'worked', rows: counted.length }
}

/**
 * The earliest day an account drafted from its rows can start on: the day before the first row when the rows reach back to an
 * empty account, else the first row's day, since nothing tells what came before it. Null with no rows.
 */
export function earliestStart(evidence: OpeningEvidence): CivilDate | null {
  const firstDay = firstRowDay(evidence.rows)
  if (firstDay === null) return null
  return openingOn(evidence, firstDay).source === 'start' ? addDays(firstDay, -1) : firstDay
}

/** The days an account drafted from its rows can start on, from its earliest start to the latest day its balance knows. With no rows only the latest. */
export function startDays(evidence: OpeningEvidence, latest: CivilDate): { readonly earliest: CivilDate; readonly latest: CivilDate } {
  const earliest = earliestStart(evidence)
  return { earliest: earliest === null || earliest > latest ? latest : earliest, latest }
}

/** Whether an account drafted from its rows can start on the day. */
export function startsWithin(evidence: OpeningEvidence, startsOn: CivilDate, latest: CivilDate): boolean {
  const { earliest } = startDays(evidence, latest)
  return startsOn >= earliest && startsOn <= latest
}
