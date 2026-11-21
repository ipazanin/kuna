import { ENABLE_BANKING_NAMES, NO_SINGLE_CURRENCY } from './bankAnswer'
import type { LinkedAccount } from './bankAnswer'
import { isBankSyncKey } from '../../statements/domain/statementRows'
import type { Account } from '../../workbook/domain/account'
import { ibanKey } from '../../workbook/domain/accountReading'
import { LINKABLE_BANKS, bankSyncSetUp } from '../../workbook/domain/spendingSettings'
import type { LinkableBank, SpendingSettings } from '../../workbook/domain/spendingSettings'
import type { Transaction } from '../../workbook/domain/transaction'
import { addDays, daysBetween } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'

/** How long before a link runs out the home card starts to say so. */
const ENDING_DAYS = 14

/** How far back of the newest statement row a fetch looks, since a bank may book a row under an earlier day. */
const OVERLAP_DAYS = 14

/** The FAQ says many banks restrict transactions to the past 90 days. */
const PERIOD_A_BANK_GIVES_DAYS = 89

/** How often the step asks a bank by itself. Enable Banking says many banks allow four background fetches a day and says to retry after six hours. */
const FETCH_INTERVAL_MS = 6 * 3_600_000

export interface EndingLink {
  readonly bank: LinkableBank
  readonly endsOn: CivilDate
  /** True once the day has passed, so the link no longer reads. */
  readonly ended: boolean
}

/** Each link that runs out within 14 days or already has. */
export function endingLinks(settings: SpendingSettings, day: CivilDate): readonly EndingLink[] {
  return LINKABLE_BANKS.flatMap((bank) => {
    const endsOn = settings.bankLinks[bank]
    return endsOn === null || daysBetween(day, endsOn) > ENDING_DAYS ? [] : [{ bank, endsOn, ended: endsOn < day }]
  })
}

/** Whether a sync has anything to ask: an application set up and a link still good on the day. */
export function hasLiveLink(settings: SpendingSettings, day: CivilDate): boolean {
  return bankSyncSetUp(settings) && LINKABLE_BANKS.some((bank) => (settings.bankLinks[bank] ?? '') >= day)
}

/** The banks any device sharing the file asked within the last six hours, which the step leaves alone. */
export function heldBanks(settings: SpendingSettings, now: number): readonly LinkableBank[] {
  return LINKABLE_BANKS.filter((bank) => {
    const fetchedAt = settings.bankFetchedAt[bank]
    return fetchedAt !== null && now - fetchedAt < FETCH_INTERVAL_MS
  })
}

/** Whether the step has a bank to ask by itself: a live link that no device asked within the last six hours. */
export function hasDueLink(settings: SpendingSettings, day: CivilDate, now: number): boolean {
  const held = heldBanks(settings, now)
  return bankSyncSetUp(settings) && LINKABLE_BANKS.some((bank) => (settings.bankLinks[bank] ?? '') >= day && !held.includes(bank))
}

/** The link a session of Enable Banking belongs to, or null for a bank Kuna does not link. */
export function linkableBankNamed(name: string): LinkableBank | null {
  return LINKABLE_BANKS.find((bank) => ENABLE_BANKING_NAMES[bank] === name) ?? null
}

/**
 * The Spending accounts a linked account goes to, by IBAN and currency, open ones before closed and current ones before
 * savings. The IBAN already names the bank, so an account typed with a blank bank fits too. A multi-currency account goes
 * to each currency Kuna keeps under its IBAN.
 */
export function accountsOfLinked(linked: Pick<LinkedAccount, 'iban' | 'currency'>, accounts: readonly Account[]): readonly Account[] {
  const iban = ibanKey(linked.iban)
  const fitting = accounts.filter((account) => iban !== '' && account.iban === iban && (linked.currency === NO_SINGLE_CURRENCY || account.currency === linked.currency))
  return [...new Set(fitting.map((account) => account.currency))].flatMap((currency) => {
    const ofCurrency = fitting.filter((account) => account.currency === currency)
    const open = ofCurrency.filter((account) => !account.closed)
    return open.find((account) => account.kind === 'bank') ?? open[0] ?? ofCurrency[0] ?? []
  })
}

/** Where a fetch for an account starts, and whether it asks for what the bank has from there rather than exactly that period. */
export interface FetchStart {
  readonly from: CivilDate
  readonly longest: boolean
}

/** The first day of the bank link's period that runs on the day, or of the latest one before it, or null when the bank link brings no day up to it. */
export function bankLinkStart(account: Pick<Account, 'sources' | 'openedOn'>, day: CivilDate): CivilDate | null {
  let start: CivilDate | null = null
  for (const period of account.sources) {
    if (period.from !== null && period.from > day) break
    if (period.source === 'bank-link') start = period.from ?? account.openedOn
  }
  return start
}

/**
 * The start of the bank link's period while the sync has brought no row in it, then a little back of the newest booked such
 * row, and no later than the oldest row the bank has not booked yet, so a fetch always sees the days of what is still pending.
 * Rows a file brought never move it, since the periods say whose days are whose. Past 89 days a bank may refuse the period
 * itself, so such a fetch asks for what the bank has. Never past yesterday here, since the API reads the day in UTC, which at
 * most lags a day behind this device's, and refuses a day in the future.
 */
export function fetchFrom(account: Account, rows: readonly Pick<Transaction, 'account' | 'date' | 'importKey' | 'pending'>[], day: CivilDate): FetchStart {
  const latest = addDays(day, -1)
  const linkStart = bankLinkStart(account, day) ?? account.openedOn
  const ofLink = rows.filter((row) => row.account === account.id && isBankSyncKey(row.importKey) && row.date >= linkStart)
  const brought = ofLink.filter((row) => !row.pending).map((row) => row.date)
  const pending = ofLink.filter((row) => row.pending).map((row) => row.date)
  const back =
    brought.length === 0
      ? linkStart
      : addDays(
          brought.reduce((newest, date) => (date > newest ? date : newest)),
          -OVERLAP_DAYS,
        )
  const sinceBooked = back < linkStart ? linkStart : back
  const wanted = pending.reduce((oldest, date) => (date < oldest ? date : oldest), sinceBooked)
  const from = wanted < latest ? wanted : latest
  return { from, longest: brought.length === 0 || daysBetween(from, day) > PERIOD_A_BANK_GIVES_DAYS }
}

/**
 * The first day a fetch's rows reach when it wanted days older than a bank gives outside a fresh link and got none of them,
 * or null when nothing is missing. The fetch starts no earlier than the bank link's period, so days a file brings are never
 * wanted. `reached` is null when the fetch brought no row at all.
 */
export function olderRowsMissing(start: FetchStart, fetched: readonly Pick<Transaction, 'date'>[], day: CivilDate): { readonly reached: CivilDate | null } | null {
  const wanted = start.from
  const given = addDays(day, -PERIOD_A_BANK_GIVES_DAYS)
  if (wanted >= given || fetched.some((row) => row.date < given)) return null
  const reached = fetched.map((row) => row.date).reduce<CivilDate | null>((oldest, date) => (oldest === null || date < oldest ? date : oldest), null)
  return { reached }
}
