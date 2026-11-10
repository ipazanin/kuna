import { BankScriptFailure } from '../../application/bankSync'
import type { BankSyncPort } from '../../application/bankSync'
import type { BankBalance, BankSession, BankTransaction, LinkedAccount } from '../../domain/bankAnswer'
import { words } from '../../domain/words'
import { addDays } from '../../../../../shared/calendar/civilDate'
import { fakeSpendingDayHere } from '../../../workbook/infrastructure/fake/fakeSpending'
import type { CivilDate } from '../../../../../shared/calendar/civilDate'

const OTP_UID = 'fake-otp-account'
const REVOLUT_UID = 'fake-revolut-account'
const REVOLUT_USD_UID = 'fake-revolut-usd-account'
const POCKET_UID = 'fake-revolut-pocket'
const NEW_USD_UID = 'fake-revolut-new-usd'
const NEW_SAVINGS_UID = 'fake-revolut-new-savings'

/** The IBAN of the Revolut pocket the `pocket` variant links as an account of its own, which the fake Spending file keeps as a savings account. */
export const FAKE_POCKET_IBAN = 'LT000000000000000002'

/** The IBAN of the dollar account `new-accounts` adds, which the fake Spending file keeps no account for, and which `not-in-kuna` leaves out. */
export const FAKE_NEW_USD_IBAN = 'LT000000000000000003'

/** A linked account the fake Spending file keeps no account for. Each IBAN here is made up. */
const UNKNOWN_IBAN = 'HR0000000000000000077'

function linkedAccount(uid: string, iban: string, currency: string, described: Partial<LinkedAccount> = {}): LinkedAccount {
  return { uid, iban, currency, product: null, details: null, cashAccountType: null, usage: null, identificationHash: null, ...described }
}

function transaction(day: CivilDate, back: number, reference: string | null, amount: string, direction: 'CRDT' | 'DBIT', name: string, status = 'BOOK', currency = 'EUR'): BankTransaction {
  const date = addDays(day, -back)
  const out = direction === 'DBIT'
  return {
    reference,
    amount,
    currency,
    direction,
    status,
    bookedOn: date,
    valueOn: date,
    madeOn: date,
    creditorName: out ? name : null,
    creditorIban: null,
    debtorName: out ? null : name,
    debtorIban: null,
    remittance: [name],
    exchangeRate: null,
  }
}

function revolutEuroRows(day: CivilDate, variant: string | null): readonly BankTransaction[] {
  return [
    transaction(day, 2, 'rev-2001', '4.20', 'DBIT', 'Café on the square'),
    transaction(day, 1, 'rev-2002', '14.30', 'DBIT', 'Corner market'),
    // The euro leg of an exchange carries the rate on the money out.
    ...(variant === 'exchange' ? [{ ...transaction(day, 1, 'rev-2101', '50.00', 'DBIT', 'Exchanged to USD'), exchangeRate: '1.0850' }] : []),
    ...(variant === 'pocket' ? [transaction(day, 1, 'rev-2201', '20.00', 'DBIT', 'To pocket Summer trip')] : []),
    ...(variant === 'card-pending' ? [transaction(day, 0, null, '0.80', 'DBIT', 'Newspaper kiosk', 'PDNG')] : []),
    ...(variant === 'look-alike' ? [transaction(day, 2, 'rev-2401', '26.50', 'DBIT', 'OLD TOWN BOOKSHOP D.O.O.')] : []),
  ]
}

function revolutDollarRows(day: CivilDate, variant: string | null): readonly BankTransaction[] {
  return [
    transaction(day, 1, 'rev-2003', '9.00', 'DBIT', 'Diner in Boston', 'BOOK', 'USD'),
    ...(variant === 'settled' ? [transaction(day, 100, 'rev-2301', '5.00', 'CRDT', 'Diner in Boston', 'BOOK', 'USD')] : []),
    ...(variant === 'exchange' ? [transaction(day, 1, 'rev-2102', '54.25', 'CRDT', 'Exchanged from EUR', 'BOOK', 'USD')] : []),
  ]
}

/**
 * The made-up answers the fake build's script gives, built against the `statements` set: on OTP a row a file brought on the
 * same day, two equal payments on one day, a row without a reference and a pending one, on Revolut's euro account a coffee
 * that fills the typed one and a row a rule files, and on its dollar account a row in dollars. `multi-currency` gives both
 * currencies on one account. `exchange` adds an exchange's two legs, `pocket` a move to a pocket that comes as an
 * account of its own, and `withdrawal` cash taken out at an OTP cash machine. The two accounts `new-accounts` adds reach further back.
 */
export function fakeBankTransactions(accountUid: string, day: CivilDate, variant: string | null = null): readonly BankTransaction[] {
  if (accountUid === OTP_UID) {
    return [
      transaction(day, 2, 'otp-1001', '75.00', 'DBIT', 'Transfer to Revolut'),
      transaction(day, 1, 'otp-1002', '6.50', 'DBIT', 'Corner bakery'),
      transaction(day, 1, 'otp-1003', '6.50', 'DBIT', 'Corner bakery'),
      transaction(day, 1, null, '11.20', 'DBIT', 'Newspaper kiosk'),
      transaction(day, 0, null, '3.10', 'DBIT', 'Waiting bakery', 'PDNG'),
      ...(variant === 'withdrawal' ? [transaction(day, 1, 'otp-1004', '50.00', 'DBIT', 'Bankomat Ilica')] : []),
    ]
  }
  if (accountUid === REVOLUT_UID) return variant === 'multi-currency' ? [...revolutEuroRows(day, variant), ...revolutDollarRows(day, variant)] : revolutEuroRows(day, variant)
  if (accountUid === REVOLUT_USD_UID) return revolutDollarRows(day, variant)
  if (accountUid === POCKET_UID) return [transaction(day, 1, 'pocket-3001', '20.00', 'CRDT', 'From current')]
  if (accountUid === NEW_USD_UID) {
    return [
      transaction(day, 120, 'rev-4001', '40.00', 'CRDT', 'Top-up', 'BOOK', 'USD'),
      transaction(day, 6, 'rev-4002', '12.50', 'DBIT', 'Bookshop in Boston', 'BOOK', 'USD'),
      ...(variant === 'new-pending' ? [transaction(day, 0, null, '3.00', 'DBIT', 'Waiting bookshop', 'PDNG', 'USD')] : []),
    ]
  }
  if (accountUid === NEW_SAVINGS_UID) return [transaction(day, 30, 'rev-5001', '100.00', 'CRDT', 'Savings deposit')]
  return []
}

/** What the fake script's banks say an account holds. Any account a variant does not name gives no balance, so nothing is checked. */
function fakeBalances(accountUid: string, variant: string | null): readonly BankBalance[] {
  // OTP holds a pending row, which an available balance may count.
  if (variant === 'balance-differs' && accountUid === OTP_UID) return [{ amount: '1.00', currency: 'EUR', type: 'ITAV' }]
  if (variant === 'opening-off' && accountUid === REVOLUT_UID) return [{ amount: '1.00', currency: 'EUR', type: 'ITBD' }]
  // Kuna works out 306.20 on the euro account once the rows are in, and the available balance counts the pending 0.80 card payment.
  if (variant === 'card-pending' && accountUid === REVOLUT_UID) return [{ amount: '305.40', currency: 'EUR', type: 'ITAV' }]
  // The dollar account's rows add up to its balance, so it opened empty. The savings account held 250.00 before its one row.
  if (accountUid === NEW_USD_UID) return [{ amount: '27.50', currency: 'USD', type: 'ITAV' }]
  if (accountUid === NEW_SAVINGS_UID) return [{ amount: '350.00', currency: 'EUR', type: 'ITAV' }]
  return []
}

/**
 * The sessions the fake script holds, with Revolut as one account per currency under one IBAN, as the first real run gave
 * it. `multi-currency` has Revolut as one account in `XXX`, `unknown-account` has one more account at OTP, `new-accounts`
 * `not-in-kuna` and `new-pending` a dollar account and a savings account more at Revolut, `otp-failed` has OTP not answering, `ended` has
 * OTP's approval over early, `pocket` has a Revolut pocket as an account of its own, and `kind-differs` has Revolut call
 * the dollar account savings, and `settled` does too with older rows given, so keeping the file's kind leaves nothing to set up.
 */
export function fakeBankSessions(variant: string | null): readonly BankSession[] {
  const revolutIban = 'LT000000000000000001'
  const revolutAccounts =
    variant === 'multi-currency'
      ? [linkedAccount(REVOLUT_UID, revolutIban, 'XXX')]
      : [
          linkedAccount(REVOLUT_UID, revolutIban, 'EUR', { cashAccountType: 'CACC' }),
          linkedAccount(REVOLUT_USD_UID, revolutIban, 'USD', { cashAccountType: variant === 'kind-differs' || variant === 'settled' ? 'SVGS' : 'CACC' }),
        ]
  const added =
    variant === 'new-accounts' || variant === 'not-in-kuna' || variant === 'new-pending'
      ? [
          linkedAccount(NEW_USD_UID, FAKE_NEW_USD_IBAN, 'USD', { cashAccountType: 'CACC', product: 'Standard' }),
          linkedAccount(NEW_SAVINGS_UID, 'LT000000000000000004', 'EUR', { cashAccountType: 'SVGS', product: 'Savings vault' }),
        ]
      : []
  const revolut: BankSession = {
    bank: 'Revolut',
    status: 'AUTHORIZED',
    accounts: [...revolutAccounts, ...(variant === 'pocket' ? [linkedAccount(POCKET_UID, FAKE_POCKET_IBAN, 'EUR')] : []), ...added],
  }
  if (variant === 'otp-failed') return [{ bank: 'OTP banka', status: 'FAILED', reason: 'HTTP 503', accounts: [] }, revolut]
  if (variant === 'ended') return [{ bank: 'OTP banka', status: 'EXPIRED', accounts: [] }, revolut]
  return [
    {
      bank: 'OTP banka',
      status: 'AUTHORIZED',
      accounts: [linkedAccount(OTP_UID, 'HR0000000000000000001', 'EUR'), ...(variant === 'unknown-account' ? [linkedAccount('fake-other-account', UNKNOWN_IBAN, 'EUR')] : [])],
    },
    revolut,
  ]
}

/**
 * The fake build's script as `?banksync=` names it, which answers from the page and sends nothing away. `failed` answers an
 * error, `balance-differs` has OTP state a balance Kuna does not reach while it holds a pending row, `opening-off` has
 * Revolut's euro account do so with none, `card-pending` has it state an available balance its one pending card payment explains, `iban-blank` reaches the dollar account the fake file keeps without an IBAN,
 * `exchange` and `pocket` bring a move between your accounts, `look-alike` books the file's Old Town Bookshop three days later
 * under a longer name, and a link's trip comes straight back to this address.
 */
export function fakeBankSync(variant: string | null, day: CivilDate): BankSyncPort {
  const failed = (): void => {
    if (variant === 'failed') throw new BankScriptFailure(words.didNotAnswer('HTTP 503'))
  }
  return {
    startLink: async (_bankName, _redirectUrl, state) => {
      failed()
      const url = new URL(window.location.href)
      url.searchParams.set('banksync', 'saved')
      url.searchParams.set('code', 'fake-code')
      url.searchParams.set('state', state)
      url.hash = ''
      return url.href
    },
    finishLink: async () => {
      failed()
      return `${addDays(day, 180)}T12:00:00.000000+00:00`
    },
    sessions: async () => {
      failed()
      return fakeBankSessions(variant)
    },
    transactions: async (accountUid) => fakeBankTransactions(accountUid, day, variant),
    balances: async (accountUid) => fakeBalances(accountUid, variant),
  }
}

/** The fake sync this address names with `?banksync=`, dating its rows from the same day as the fake file. */
export function fakeBankSyncHere(): BankSyncPort {
  return fakeBankSync(new URLSearchParams(window.location.search).get('banksync'), fakeSpendingDayHere())
}
