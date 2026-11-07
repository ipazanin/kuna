import { BankScriptFailure } from '../../application/bankSync'
import type { BankSyncPort } from '../../application/bankSync'
import type { BankBalance, BankSession, BankTransaction } from '../../domain/bankAnswer'
import { words } from '../../domain/words'
import { addDays, today } from '../../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../../shared/calendar/civilDate'

const OTP_UID = 'fake-otp-account'
const REVOLUT_UID = 'fake-revolut-account'

/** A linked account the fake Spending file keeps no account for. Each IBAN here is made up. */
const UNKNOWN_IBAN = 'HR0000000000000000077'

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
  }
}

/**
 * The made-up answers the fake build's script gives, built against the `statements` set: on OTP a row a file brought on the
 * same day, two equal payments on one day, a row without a reference and a pending one, and on the multi-currency Revolut
 * account a coffee that fills the typed one, a row a rule files and a row in dollars.
 */
export function fakeBankTransactions(accountUid: string, day: CivilDate): readonly BankTransaction[] {
  if (accountUid === OTP_UID) {
    return [
      transaction(day, 2, 'otp-1001', '75.00', 'DBIT', 'Transfer to Revolut'),
      transaction(day, 1, 'otp-1002', '6.50', 'DBIT', 'Corner bakery'),
      transaction(day, 1, 'otp-1003', '6.50', 'DBIT', 'Corner bakery'),
      transaction(day, 1, null, '11.20', 'DBIT', 'Newspaper kiosk'),
      transaction(day, 0, null, '3.10', 'DBIT', 'Waiting bakery', 'PDNG'),
    ]
  }
  if (accountUid === REVOLUT_UID) {
    return [
      transaction(day, 2, 'rev-2001', '4.20', 'DBIT', 'Café on the square'),
      transaction(day, 1, 'rev-2002', '14.30', 'DBIT', 'Corner market'),
      transaction(day, 1, 'rev-2003', '9.00', 'DBIT', 'Diner in Boston', 'BOOK', 'USD'),
    ]
  }
  return []
}

/** What the fake script's Revolut says it holds in `balance-differs`, which no fake set adds up to. Every other variant gives no balance, so nothing is checked. */
const DIFFERING_BALANCE: BankBalance = { amount: '1.00', currency: 'EUR', type: 'ITBD' }

/** The sessions the fake script holds, with Revolut as one multi-currency account. `unknown-account` has one more account at OTP, `otp-failed` has OTP not answering, and `ended` has OTP's approval over early. */
export function fakeBankSessions(variant: string | null): readonly BankSession[] {
  const revolut: BankSession = { bank: 'Revolut', status: 'AUTHORIZED', accounts: [{ uid: REVOLUT_UID, iban: 'LT000000000000000001', currency: 'XXX' }] }
  if (variant === 'otp-failed') return [{ bank: 'OTP banka', status: 'FAILED', reason: 'HTTP 503', accounts: [] }, revolut]
  if (variant === 'ended') return [{ bank: 'OTP banka', status: 'EXPIRED', accounts: [] }, revolut]
  return [
    {
      bank: 'OTP banka',
      status: 'AUTHORIZED',
      accounts: [{ uid: OTP_UID, iban: 'HR0000000000000000001', currency: 'EUR' }, ...(variant === 'unknown-account' ? [{ uid: 'fake-other-account', iban: UNKNOWN_IBAN, currency: 'EUR' }] : [])],
    },
    revolut,
  ]
}

/** The fake build's script as `?banksync=` names it, which answers from the page and sends nothing away. `failed` answers an error, `balance-differs` has Revolut state a balance Kuna does not reach, and a link's trip comes straight back to this address. */
export function fakeBankSync(variant: string | null, day: CivilDate = today()): BankSyncPort {
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
    transactions: async (accountUid) => fakeBankTransactions(accountUid, day),
    balances: async (accountUid) => (variant === 'balance-differs' && accountUid === REVOLUT_UID ? [DIFFERING_BALANCE] : []),
  }
}
