import { daysBetween, parseCivilDate } from '../../calendar/civilDate'
import type { CivilDate } from '../../calendar/civilDate'
import type { ReceiptPaymentsFound } from '../../app/assistantReader'
import { accountMoneyOfDecimal, decimalOfText } from '../../money/decimal'
import { bookedTwins } from '../../money/lookAlikeBookings'
import type { Booking } from '../../money/lookAlikeBookings'
import type { AccountMoney } from '../../money/accountMoney'
import { moneyFromAmount, plainAmount } from '../../money/money'
import type { Money } from '../../money/money'
import type { ChatAttachment } from '../domain/chatAttachments'
import { NOT_ALLOWED, NO_APP, fileNotReadable, recordsKeptHome, refusal } from './chatReads'
import type { ChatReads, ChatToolAnswer } from './chatReads'

/** The most rows one call matches, as many as a page of records holds. */
const MOST_ROWS = 200

const AMOUNT = /^-?\d+(?:\.\d{1,2})?$/

/** The kind that matches fiscal receipts with the payments each may be, in place of rows with bookings. */
export const RECEIPT_KIND = 'receipt'

/** The most receipts one call matches. */
const MOST_RECEIPTS = 20

/** A receipt as the model read it. */
export interface ReceiptToMatch {
  readonly date: string
  readonly total: number
  readonly merchant: string
  /** The id of the photo attached to the chat, or null. */
  readonly photo: string | null
}

export interface MatchRecordsInput {
  readonly app: string
  readonly kind: string
  /** A ref Kuna handed out for one of the app's accounts, or null for an app that holds only one. */
  readonly account: string | null
  readonly rows: readonly { readonly date: string; readonly amount: string; readonly counterparty: string; readonly description: string }[]
  readonly receipts: readonly ReceiptToMatch[]
}

/**
 * Says for each row copied off a statement whether the account's books hold it already, by the look-alike test the imports use,
 * against every booking of the account whatever brought it. While Anonymise is on, bookings about an employee stay out unsaid.
 */
export function matchRecords(input: MatchRecordsInput, reads: ChatReads): ChatToolAnswer {
  const app = reads.readers.get(input.app)
  if (app === undefined) return refusal(NO_APP)
  if (input.receipts.length > 0) return refusal(`Receipts go with kind ${RECEIPT_KIND}, in a call of their own.`)
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
  if (status !== 'open') return fileNotReadable(app.name, status)

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

/** A receipt as the model read it, with its photo as attached, or why it does not read. */
function receiptRead(receipt: ReceiptToMatch, attachments: readonly ChatAttachment[]): { readonly date: CivilDate; readonly total: Money; readonly photo: Blob | null } | string {
  const date = parseCivilDate(receipt.date)
  if (date === null) return 'a date reads as 2026-10-31'
  if (!(receipt.total > 0) || !AMOUNT.test(String(receipt.total))) return 'a total is euros above zero with at most two decimals'
  if (receipt.photo === null) return { date, total: moneyFromAmount(receipt.total), photo: null }
  const photo = attachments.find((attached) => attached.id === receipt.photo)
  if (photo === undefined || photo.kind !== 'photo') return 'photo is the id of a photo attached to this chat, or null'
  return { date, total: moneyFromAmount(receipt.total), photo: photo.original }
}

/**
 * Says for each fiscal receipt which payments it may be, as the app's own receipt matching finds them, on the QR code's date
 * and total when its photo holds one. Each payment comes with its ref, its day, how many days it is from the receipt's and a
 * figure ref for its amount and for how far that is from the total. While Anonymise is on, payments about an employee stay out unsaid.
 */
export async function matchReceipts(input: MatchRecordsInput, reads: ChatReads, attachments: readonly ChatAttachment[]): Promise<ChatToolAnswer> {
  const app = reads.readers.get(input.app)
  if (app === undefined) return refusal(NO_APP)
  const payments = app.reader.receipts
  const kind = payments === undefined ? undefined : app.reader.kinds.find((candidate) => candidate.name === payments.kind)
  if (payments === undefined || kind === undefined) return refusal('That app keeps no payments to match receipts against.')
  if (input.account !== null || input.rows.length > 0) return refusal(`Kind ${RECEIPT_KIND} takes receipts only, with account null and no rows.`)
  if (input.receipts.length === 0) return refusal('Pass the receipts to match.')
  if (input.receipts.length > MOST_RECEIPTS) return refusal(`At most ${MOST_RECEIPTS} receipts go in one call. Send the rest in another.`)
  const read = input.receipts.map((receipt) => receiptRead(receipt, attachments))
  const unread = read.findIndex((receipt) => typeof receipt === 'string')
  if (unread !== -1) return refusal(`Receipt ${unread + 1} does not read: ${String(read[unread])}.`)

  if (!reads.mayRead()) return refusal(NOT_ALLOWED)
  const status = app.reader.status()
  if (status !== 'open') return fileNotReadable(app.name, status)

  const keptHome = recordsKeptHome(kind, reads)
  const found = await Promise.all(
    input.receipts.map(async (receipt, at) => {
      const { date, total, photo } = read[at] as Exclude<(typeof read)[number], string>
      return payments.match({ date, total, merchant: reads.pseudonyms.restored(receipt.merchant), photo })
    }),
  )
  const receipts = found.map((matched, at) => receiptShown(input.app, payments.kind, matched, keptHome, reads, at + 1))
  return {
    text: JSON.stringify({ source: `${input.app}/${RECEIPT_KIND}`, untrusted: true, receipts }),
    isError: false,
    read: { kind: 'records', app: app.name, noun: kind.noun, count: receipts.reduce((count, receipt) => count + receipt.payments.length, 0) },
  }
}

/** One receipt's match as the model reads it, with the payments kept home left out, so one left of several is still a pick. */
function receiptShown(app: string, kind: string, matched: ReceiptPaymentsFound, keptHome: ReadonlySet<string>, reads: ChatReads, number: number) {
  reads.refs.noteAmount(matched.total)
  const shown = matched.candidates.filter((candidate) => !keptHome.has(candidate.id))
  const match = shown.length === 0 ? 'none' : shown.length < matched.candidates.length ? 'pick' : matched.match
  return {
    receipt: number,
    matchedOn: { date: matched.date, total: `${plainAmount(matched.total)} EUR`, from: matched.fromCode ? 'the QR code' : 'what you read' },
    match,
    payments: shown.map((candidate) => ({
      ref: reads.refs.recordRef({ app, kind, id: candidate.id }),
      date: candidate.date,
      daysFromReceipt: daysBetween(matched.date, candidate.date),
      amount: {
        amount: `${plainAmount(candidate.amount)} ${candidate.currency}`,
        ref: reads.refs.figureRef(`${app}/${kind}/${candidate.id}/amount`, { of: 'account', cents: candidate.amount, currency: candidate.currency }),
      },
      differenceFromTotal: {
        amount: `${plainAmount(candidate.difference)} ${candidate.currency}`,
        ref: reads.refs.figureRef(`${app}/${RECEIPT_KIND}/${number}/${candidate.id}/difference`, { of: 'account', cents: candidate.difference, currency: candidate.currency }),
      },
    })),
  }
}
