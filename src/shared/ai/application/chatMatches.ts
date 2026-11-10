import { parseCivilDate } from '../../calendar/civilDate'
import { accountMoneyOfDecimal, decimalOfText } from '../../money/decimal'
import { bookedTwins } from '../../money/lookAlikeBookings'
import type { Booking } from '../../money/lookAlikeBookings'
import type { AccountMoney } from '../../money/accountMoney'
import type { Money } from '../../money/money'
import { NOT_ALLOWED, NO_APP, fileNotOpen, recordsKeptHome, refusal } from './chatReads'
import type { ChatReads, ChatToolAnswer } from './chatReads'

/** The most rows one call matches, as many as a page of records holds. */
const MOST_ROWS = 200

const AMOUNT = /^-?\d+(?:\.\d{1,2})?$/

export interface MatchRecordsInput {
  readonly app: string
  readonly kind: string
  /** A ref Kuna handed out for one of the app's accounts, or null for an app that holds only one. */
  readonly account: string | null
  readonly rows: readonly { readonly date: string; readonly amount: string; readonly counterparty: string; readonly description: string }[]
}

/**
 * Says for each row copied off a statement whether the account's books hold it already, by the look-alike test the imports use,
 * against every booking of the account whatever brought it. While Anonymise is on, bookings about an employee stay out unsaid.
 */
export function matchRecords(input: MatchRecordsInput, reads: ChatReads): ChatToolAnswer {
  const app = reads.readers.get(input.app)
  if (app === undefined) return refusal(NO_APP)
  const bookings = app.reader.bookings
  if (bookings === undefined) return refusal('That app keeps no bank bookings to match rows against.')
  const kind = app.reader.kinds.find((candidate) => candidate.name === bookings.kind)
  if (input.kind !== bookings.kind || kind === undefined) return refusal(`Rows of this app match only against kind ${bookings.kind}.`)
  const account = input.account === null ? null : reads.refs.recordOf(input.account)
  if (input.account !== null && (account === null || account.app !== input.app || account.kind !== bookings.accountKind))
    return refusal(`That ref is not an account Kuna handed out in this app. Take it from find_records with kind ${bookings.accountKind}.`)
  if (input.rows.length > MOST_ROWS) return refusal(`At most ${MOST_ROWS} rows go in one call. Send the rest in another.`)
  const copied = input.rows.map((row) => copiedBooking(row, reads))
  const unread = copied.findIndex((row) => row === null)
  if (unread !== -1) return refusal(`Row ${unread + 1} does not read. A date reads as 2026-10-31 and an amount as -12.50, signed, in the account's currency.`)

  if (!reads.mayRead()) return refusal(NOT_ALLOWED)
  const status = app.reader.status()
  if (status !== 'open') return fileNotOpen(status)

  const accountId = account?.id ?? bookings.onlyAccount()
  if (accountId === null) return refusal(`This app holds more than one account. Pass the account's ref, which find_records gives for kind ${bookings.accountKind}.`)
  const booked = bookings.of(accountId)
  if (booked === null) return refusal('That account is no longer in the file.')

  const rows = copied.filter((row) => row !== null)
  const keptHome = recordsKeptHome(kind, reads)
  const pool = booked.filter((record) => !keptHome.has(record.id))
  const twins = bookedTwins(
    rows,
    pool.map((record) => ({ ...record.booking, record })),
  )
  const matches = rows.map((row, index) => {
    const twin = twins.get(row)
    return { row: index + 1, match: twin?.kind ?? 'none', ref: twin === undefined ? null : reads.refs.recordRef({ app: input.app, kind: bookings.kind, id: twin.booked.record.id }) }
  })
  return {
    text: JSON.stringify({ source: `${input.app}/${bookings.kind}`, untrusted: true, matches }),
    isError: false,
    read: { kind: 'records', app: app.name, noun: kind.noun, count: matches.filter((found) => found.ref !== null).length },
  }
}

/** A row as the model copied it, with each alias and token back as what it stands for, or null for a date or an amount that does not read. */
function copiedBooking(row: MatchRecordsInput['rows'][number], reads: ChatReads): Booking<Money | AccountMoney> | null {
  const date = parseCivilDate(row.date)
  const amount = AMOUNT.test(row.amount) ? decimalOfText(row.amount) : null
  if (date === null || amount === null) return null
  return { date, amount: accountMoneyOfDecimal(amount), counterparty: reads.pseudonyms.restored(row.counterparty), description: reads.pseudonyms.restored(row.description) }
}
