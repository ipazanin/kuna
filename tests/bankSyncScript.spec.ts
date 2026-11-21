import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'

import { describe, expect, it } from 'vitest'

const SOURCE = readFileSync(fileURLToPath(new URL('../apps-script/bank-sync/Code.gs', import.meta.url)), 'utf8')
const MANIFEST = JSON.parse(readFileSync(fileURLToPath(new URL('../apps-script/bank-sync/appsscript.json', import.meta.url)), 'utf8')) as Record<string, unknown>

/** What Kuna signs on the page. The script only passes it on, so any text stands in for it here. */
const TOKEN = 'made-up.signed.token'

interface Call {
  readonly url: string
  readonly method: string
  readonly token: string
  readonly body: unknown
  readonly psuUserAgent: string | undefined
}

type Answers = (call: Call) => unknown

/** Runs the script over a fake of `UrlFetchApp`, the one Apps Script service it uses. */
function script(answers: Answers) {
  const calls: Call[] = []
  const sandbox: Record<string, unknown> = {
    UrlFetchApp: {
      fetch: (url: string, params: { method: string; headers: { Authorization: string; 'Psu-User-Agent'?: string }; payload?: string }) => {
        const call = {
          url,
          method: params.method,
          token: params.headers.Authorization.replace('Bearer ', ''),
          body: params.payload === undefined ? undefined : JSON.parse(params.payload),
          psuUserAgent: params.headers['Psu-User-Agent'],
        }
        calls.push(call)
        const answer = answers(call) as { status?: number } | undefined
        return { getResponseCode: () => answer?.status ?? 200, getContentText: () => JSON.stringify(answer ?? {}) }
      },
    },
  }
  runInNewContext(SOURCE, sandbox)
  // `run` crosses back out of the sandbox as plain JSON, as `scripts.run` hands the answer over.
  const run = (name: string, ...parameters: unknown[]): unknown => JSON.parse(JSON.stringify((sandbox[name] as (...inputs: unknown[]) => unknown)(...parameters) ?? null))
  return { run, calls }
}

describe('the bank sync script', () => {
  it('keeps nothing and signs nothing, so no line names a store or a signature', () => {
    expect(SOURCE).not.toMatch(/PropertiesService|CacheService|computeRsaSha256Signature|Logger/)
  })

  it('passes on the token it was given with every call', () => {
    const { run, calls } = script(({ url }) => (url.includes('/aspsps') ? { aspsps: [{ name: 'Revolut', maximum_consent_validity: 15_552_000 }] } : { url: 'https://example.invalid/approve' }))
    run('startLink', TOKEN, 'Revolut', 'https://example.invalid/kuna/', 'one-time')
    run('transactions', TOKEN, 'u1', '2026-10-01', 'default')
    run('balances', TOKEN, 'u1')
    run('application', TOKEN)
    expect(calls.length).toBeGreaterThan(3)
    expect(calls.every(({ token }) => token === TOKEN)).toBe(true)
  })

  it("answers the application's name, environment, redirects and whether it is active", () => {
    const { run, calls } = script(() => ({ name: 'Kuna', kid: 'made-up-app-id', environment: 'PRODUCTION', redirect_urls: ['https://example.invalid/kuna/'], active: true }))
    expect(run('application', TOKEN)).toEqual({ name: 'Kuna', environment: 'PRODUCTION', redirectUrls: ['https://example.invalid/kuna/'], active: true })
    expect(calls.map(({ method, url }) => `${method} ${url}`)).toEqual(['get https://api.enablebanking.com/application'])
  })

  it('starts a link for as long as the bank allows, with the state and the address it is given', () => {
    const { run, calls } = script(() => ({ aspsps: [{ name: 'OTP banka', maximum_consent_validity: 15_552_000 }], url: 'https://example.invalid/approve' }))
    expect(run('startLink', TOKEN, 'OTP banka', 'https://example.invalid/kuna/', 'one-time')).toEqual({ url: 'https://example.invalid/approve' })

    expect(calls[0]!.url).toBe('https://api.enablebanking.com/aspsps?country=HR')
    expect(calls[1]).toMatchObject({ url: 'https://api.enablebanking.com/auth', method: 'post' })
    const body = calls[1]!.body as { access: { valid_until: string }; aspsp: unknown; state: string; redirect_url: string; psu_type: string }
    expect(body).toMatchObject({ aspsp: { name: 'OTP banka', country: 'HR' }, state: 'one-time', redirect_url: 'https://example.invalid/kuna/', psu_type: 'personal' })
    const days = (Date.parse(body.access.valid_until) - Date.now()) / 86_400_000
    expect(days).toBeGreaterThan(179.9)
    expect(days).toBeLessThan(180)
  })

  it('answers the session id, its bank and its end once a link finishes, no account and no name, and closes nothing', () => {
    const { run, calls } = script(() => ({
      session_id: 'made-up-session',
      aspsp: { name: 'Revolut', country: 'HR' },
      access: { valid_until: '2027-05-03T12:00:00+00:00' },
      accounts: [{ uid: 'u1', account_id: { iban: 'LT000000000000000001' }, name: 'Made-up Owner' }],
    }))
    const answer = run('finishLink', TOKEN, 'made-up-code')
    expect(answer).toEqual({ sessionId: 'made-up-session', bank: 'Revolut', validUntil: '2027-05-03T12:00:00+00:00' })
    expect(calls.map(({ method, url }) => `${method} ${new URL(url).pathname}`)).toEqual(['post /sessions'])
  })

  it('closes the session it is given, and carries on if the bank already ended it', () => {
    const { run, calls } = script(() => ({ status: 401, error: 'EXPIRED_SESSION' }))
    expect(run('closeSession', TOKEN, 'old')).toBeNull()
    expect(calls.map(({ method, url }) => `${method} ${new URL(url).pathname}`)).toEqual(['delete /sessions/old'])
  })

  it('answers for each bank apart, so one failing leaves the others theirs', () => {
    const { run } = script(({ url }) => {
      if (url.endsWith('/sessions/down')) return { status: 429, error: 'ASPSP_RATE_LIMIT_EXCEEDED', message: 'Too many' }
      if (url.endsWith('/sessions/live')) return { status: 'AUTHORIZED', accounts: ['u1'] }
      return { account_id: { iban: 'LT000000000000000001' }, currency: 'XXX' }
    })
    expect(
      run('accounts', TOKEN, [
        { bank: 'OTP banka', sessionId: 'down' },
        { bank: 'Revolut', sessionId: 'live' },
      ]),
    ).toEqual([
      { bank: 'OTP banka', status: 'FAILED', reason: 'Enable Banking answered 429: ASPSP_RATE_LIMIT_EXCEEDED Too many', accounts: [] },
      { bank: 'Revolut', status: 'AUTHORIZED', accounts: [expect.objectContaining({ uid: 'u1', iban: 'LT000000000000000001', currency: 'XXX' })] },
    ])
  })

  it('names the accounts of each live session, and none of one that ended', () => {
    const { run } = script(({ url }) => {
      if (url.endsWith('/sessions/live')) return { status: 'AUTHORIZED', access: { valid_until: '2027-05-03' }, accounts: ['u1'] }
      if (url.endsWith('/sessions/over')) return { status: 'EXPIRED', access: { valid_until: '2026-05-03' }, accounts: ['u2'] }
      return { account_id: { iban: 'LT000000000000000001' }, currency: 'XXX', name: 'Made-up' }
    })
    const none = { product: null, details: null, cashAccountType: null, usage: null, identificationHash: null }
    expect(
      run('accounts', TOKEN, [
        { bank: 'Revolut', sessionId: 'live' },
        { bank: 'OTP banka', sessionId: 'over' },
      ]),
    ).toEqual([
      { bank: 'Revolut', status: 'AUTHORIZED', accounts: [{ uid: 'u1', iban: 'LT000000000000000001', currency: 'XXX', ...none }] },
      { bank: 'OTP banka', status: 'EXPIRED', accounts: [] },
    ])
  })

  it("hands over the bank's description of an account and never the holder's name", () => {
    const { run } = script(({ url }) => {
      if (url.endsWith('/sessions/live')) return { status: 'AUTHORIZED', access: { valid_until: '2027-05-03' }, accounts: ['u1'] }
      return {
        account_id: { iban: 'LT000000000000000001' },
        currency: 'USD',
        name: 'Made-up Owner',
        product: 'Savings',
        details: 'Trip',
        cash_account_type: 'SVGS',
        usage: 'PRIV',
        identification_hash: 'made-up-hash',
      }
    })
    const answer = run('accounts', TOKEN, [{ bank: 'Revolut', sessionId: 'live' }])
    expect(answer).toEqual([
      {
        bank: 'Revolut',
        status: 'AUTHORIZED',
        accounts: [{ uid: 'u1', iban: 'LT000000000000000001', currency: 'USD', product: 'Savings', details: 'Trip', cashAccountType: 'SVGS', usage: 'PRIV', identificationHash: 'made-up-hash' }],
      },
    ])
    expect(JSON.stringify(answer)).not.toContain('Made-up Owner')
  })

  it('follows continuation_key through an empty page until none is named, keeping the other parameters', () => {
    const pages: Record<string, unknown> = {
      first: {
        transactions: [
          {
            entry_reference: 'r1',
            transaction_amount: { amount: '1.00', currency: 'EUR' },
            credit_debit_indicator: 'DBIT',
            status: 'BOOK',
            booking_date: '2026-10-01',
            creditor: { name: 'A' },
            remittance_information: ['x'],
          },
        ],
        continuation_key: 'k/1',
      },
      'k/1': { transactions: [], continuation_key: 'k2' },
      k2: { transactions: [{ transaction_amount: { amount: '2.00', currency: 'EUR' }, credit_debit_indicator: 'CRDT', status: 'BOOK', value_date: '2026-10-02' }], continuation_key: null },
    }
    const { run, calls } = script(({ url }) => pages[new URL(url).searchParams.get('continuation_key') ?? 'first'])

    const found = run('transactions', TOKEN, 'account-uid', '2026-10-01', 'default') as { reference: string | null; amount: string }[]

    expect(found.map((row) => [row.reference, row.amount])).toEqual([
      ['r1', '1.00'],
      [null, '2.00'],
    ])
    expect(calls.map(({ url }) => url)).toEqual([
      'https://api.enablebanking.com/accounts/account-uid/transactions?date_from=2026-10-01&strategy=default',
      'https://api.enablebanking.com/accounts/account-uid/transactions?date_from=2026-10-01&strategy=default&continuation_key=k%2F1',
      'https://api.enablebanking.com/accounts/account-uid/transactions?date_from=2026-10-01&strategy=default&continuation_key=k2',
    ])
  })

  it('marks a fetch as a person being there on each call that reads a bank, only when told to', () => {
    const answers: Answers = ({ url }) => {
      if (url.endsWith('/sessions/live')) return { status: 'AUTHORIZED', accounts: ['u1'] }
      if (url.endsWith('/details')) return { account_id: { iban: 'LT000000000000000001' }, currency: 'EUR' }
      return { transactions: [], balances: [] }
    }
    const sessions = [{ bank: 'Revolut', sessionId: 'live' }]
    const present = script(answers)
    present.run('accounts', TOKEN, sessions, 'made-up browser')
    present.run('transactions', TOKEN, 'u1', '2026-10-01', 'default', 'made-up browser')
    present.run('balances', TOKEN, 'u1', 'made-up browser')
    expect(present.calls.map(({ url, psuUserAgent }) => [new URL(url).pathname, psuUserAgent])).toEqual([
      ['/sessions/live', undefined],
      ['/accounts/u1/details', 'made-up browser'],
      ['/accounts/u1/transactions', 'made-up browser'],
      ['/accounts/u1/balances', 'made-up browser'],
    ])

    const absent = script(answers)
    absent.run('accounts', TOKEN, sessions)
    absent.run('transactions', TOKEN, 'u1', '2026-10-01', 'default')
    absent.run('balances', TOKEN, 'u1')
    expect(absent.calls.every(({ psuUserAgent }) => psuUserAgent === undefined)).toBe(true)
  })

  it('reads each balance with its currency and kind', () => {
    const { run } = script(() => ({ balances: [{ name: 'Made-up', balance_amount: { amount: '12.50', currency: 'EUR' }, balance_type: 'ITBD' }] }))
    expect(run('balances', TOKEN, 'u1')).toEqual([{ amount: '12.50', currency: 'EUR', type: 'ITBD' }])
  })

  it('hands over a row without the usual fields rather than failing the whole account', () => {
    const { run } = script(() => ({ transactions: [{ status: 'BOOK' }] }))
    expect(run('transactions', TOKEN, 'u1', '2026-10-01', 'default')).toMatchObject([{ amount: '', currency: '', direction: '', status: 'BOOK', madeOn: null, exchangeRate: null }])
  })

  it('hands over the transaction day with its time and the exchange rate, only when the bank gives them', () => {
    const { run } = script(() => ({
      transactions: [
        { status: 'BOOK', booking_date: '2026-10-02', transaction_date: '2026-10-01T09:30:00', exchange_rate: { unit_currency: 'EUR', exchange_rate: '1.0850', rate_type: 'SPOT' } },
        { status: 'BOOK', booking_date: '2026-10-02', exchange_rate: { unit_currency: 'EUR' } },
      ],
    }))
    expect(run('transactions', TOKEN, 'u1', '2026-10-01', 'default')).toMatchObject([
      { bookedOn: '2026-10-02', madeOn: '2026-10-01T09:30:00', exchangeRate: '1.0850' },
      { bookedOn: '2026-10-02', madeOn: null, exchangeRate: null },
    ])
  })

  describe('bankFields', () => {
    const SECRETS = ['LT000000000000000001', 'Made-up Owner', 'made-up-uid', 'made-up-session', '123.45', 'made-up-reference', 'Made-up shop', 'made-up-proprietary']
    const answers: Answers = ({ url }) => {
      if (url.includes('/sessions/')) return { status: 'AUTHORIZED', session_id: 'made-up-session', accounts: ['made-up-uid'] }
      if (url.endsWith('/details')) return { account_id: { iban: 'LT000000000000000001' }, currency: 'XXX', name: 'Made-up Owner', cash_account_type: 'CACC' }
      if (url.endsWith('/balances')) return { balances: [{ balance_amount: { amount: '123.45', currency: 'EUR' }, balance_type: 'ITAV' }] }
      if (url.includes('continuation_key')) {
        return { transactions: [{ transaction_amount: { amount: '123.45', currency: 'EUR' }, status: 'made-up-proprietary', booking_date: '2026-10-02' }] }
      }
      return {
        transactions: [
          {
            entry_reference: 'made-up-reference',
            transaction_amount: { amount: '123.45', currency: 'EUR' },
            credit_debit_indicator: 'DBIT',
            status: 'BOOK',
            booking_date: '2026-10-02',
            transaction_date: '2026-10-01T10:00:00',
            creditor: { name: 'Made-up shop' },
            exchange_rate: { unit_currency: 'USD' },
            remittance_information: ['Made-up shop'],
            note: '',
          },
        ],
        continuation_key: 'next',
      }
    }

    it('answers field names and counts for every page, and no value at all', () => {
      const { run, calls } = script(answers)
      const answer = run('bankFields', TOKEN, [{ bank: 'Revolut', sessionId: 'made-up-session' }]) as {
        bank: string
        accounts: {
          details: { singleCurrency: boolean; codes: Record<string, number> }
          balances: { codes: Record<string, number> }
          transactions: { count: number; fields: Record<string, number>; codes: Record<string, number>; days: Record<string, number> }
        }[]
      }[]
      const text = JSON.stringify(answer)
      SECRETS.forEach((secret) => expect(text).not.toContain(secret))
      expect(answer.map(({ bank, accounts }) => [bank, accounts.length])).toEqual([['Revolut', 1]])
      const { details, balances, transactions } = answer[0]!.accounts[0]!
      expect(transactions.count).toBe(2)
      expect(transactions.fields).toMatchObject({ 'transaction_amount.amount': 2, entry_reference: 1, 'exchange_rate.unit_currency': 1, 'remittance_information[]': 1, 'creditor.name': 1 })
      expect(transactions.fields.note).toBeUndefined()
      expect(transactions.codes).toEqual({ 'status BOOK': 1, 'status other': 1, 'credit_debit_indicator DBIT': 1 })
      expect(transactions.days).toEqual({ bookingDateWithTime: 0, transactionDateWithTime: 1, valueDateWithTime: 0, madeOnAnotherDay: 1 })
      expect(balances.codes).toEqual({ 'balance_type ITAV': 1 })
      expect(details.singleCurrency).toBe(false)
      expect(calls.filter(({ url }) => !url.includes('/sessions/')).every(({ psuUserAgent }) => psuUserAgent !== undefined)).toBe(true)
      expect(calls.every(({ token }) => token === TOKEN)).toBe(true)
    })
  })
  it("throws Enable Banking's own error, for Kuna to show", () => {
    const { run } = script(() => ({ status: 429, error: 'ASPSP_RATE_LIMIT_EXCEEDED', message: 'Too many' }))
    expect(() => run('transactions', TOKEN, 'u', '2026-10-01', 'default')).toThrow('Enable Banking answered 429: ASPSP_RATE_LIMIT_EXCEEDED Too many')
  })

  it('asks for one scope, reaches one host, and can be run only by whoever deployed it', () => {
    expect(MANIFEST.oauthScopes).toEqual(['https://www.googleapis.com/auth/script.external_request'])
    expect(MANIFEST.urlFetchWhitelist).toEqual(['https://api.enablebanking.com/'])
    expect(MANIFEST.executionApi).toEqual({ access: 'MYSELF' })
    expect(MANIFEST.exceptionLogging).toBe('NONE')
  })
})
