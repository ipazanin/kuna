import { ENABLE_BANKING_NAMES, NO_SINGLE_CURRENCY } from './bankAnswer'
import type { LinkedAccount } from './bankAnswer'
import { isBankSyncKey } from '../../statements/domain/statementRows'
import type { Account } from '../../workbook/domain/account'
import { ibanKey } from '../../workbook/domain/accountReading'
import { LINKABLE_BANKS } from '../../workbook/domain/spendingSettings'
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

/** How often the step asks the banks by itself. Enable Banking says many banks allow four background fetches a day and says to retry after six hours. */
export const FETCH_INTERVAL_MS = 6 * 3_600_000

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

/** Whether a sync has anything to ask: a saved deployment and a link still good on the day. */
export function hasLiveLink(settings: SpendingSettings, day: CivilDate): boolean {
  return settings.bankSyncDeployment !== '' && LINKABLE_BANKS.some((bank) => (settings.bankLinks[bank] ?? '') >= day)
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

/**
 * Its opening day while no file or sync has brought a row, then a little back of the newest such row. Past 89 days a bank
 * may refuse the period itself, so such a fetch asks for what the bank has. Never past yesterday here, since the API reads
 * the day in UTC, which at most lags a day behind this device's, and refuses a day in the future.
 */
export function fetchFrom(account: Account, rows: readonly Pick<Transaction, 'account' | 'date' | 'importKey'>[], day: CivilDate): FetchStart {
  const latest = addDays(day, -1)
  const brought = rows.filter((row) => row.account === account.id && row.importKey !== '').map((row) => row.date)
  const wanted =
    brought.length === 0
      ? account.openedOn
      : addDays(
          brought.reduce((newest, date) => (date > newest ? date : newest)),
          -OVERLAP_DAYS,
        )
  const from = wanted < latest ? wanted : latest
  return { from, longest: brought.length === 0 || daysBetween(from, day) > PERIOD_A_BANK_GIVES_DAYS }
}

/**
 * The first day a fetch's rows reach when it wanted days older than a bank gives outside a fresh link and got none of them,
 * or null when nothing is missing. Days a file already brought are not wanted, since the file covers them. `reached` is
 * null when the fetch brought no row at all.
 */
export function olderRowsMissing(
  account: Account,
  start: FetchStart,
  fetched: readonly Pick<Transaction, 'date'>[],
  rows: readonly Pick<Transaction, 'account' | 'date' | 'importKey'>[],
  day: CivilDate,
): { readonly reached: CivilDate | null } | null {
  const fileDays = rows.filter((row) => row.account === account.id && row.importKey !== '' && !isBankSyncKey(row.importKey)).map((row) => row.date)
  const lastFileDay = fileDays.reduce<CivilDate | null>((newest, date) => (newest === null || date > newest ? date : newest), null)
  const wanted = lastFileDay === null || addDays(lastFileDay, 1) < start.from ? start.from : addDays(lastFileDay, 1)
  const given = addDays(day, -PERIOD_A_BANK_GIVES_DAYS)
  if (wanted >= given || fetched.some((row) => row.date < given)) return null
  const reached = fetched.map((row) => row.date).reduce<CivilDate | null>((oldest, date) => (oldest === null || date < oldest ? date : oldest), null)
  return { reached }
}
