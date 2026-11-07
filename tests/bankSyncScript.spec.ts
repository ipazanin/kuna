import { createSign, createVerify, generateKeyPairSync } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'

import { describe, expect, it } from 'vitest'

const SOURCE = readFileSync(fileURLToPath(new URL('../apps-script/bank-sync/Code.gs', import.meta.url)), 'utf8')
const MANIFEST = JSON.parse(readFileSync(fileURLToPath(new URL('../apps-script/bank-sync/appsscript.json', import.meta.url)), 'utf8')) as Record<string, unknown>

// Made here for each run, so no private key is ever in the repository.
const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } })

interface Call {
  readonly url: string
  readonly method: string
  readonly token: string
  readonly body: unknown
  readonly psuUserAgent: string | undefined
}

type Answers = (call: Call) => unknown

/** Runs the script over fakes of the three Apps Script services, with a store of Script Properties seeded by `properties`. */
function script(answers: Answers, properties: Record<string, string> = {}) {
  const store: Record<string, string> = { ENABLE_BANKING_APP_ID: 'made-up-app-id', ENABLE_BANKING_PRIVATE_KEY: privateKey, ...properties }
  const calls: Call[] = []
  const logged: string[] = []
  const sandbox: Record<string, unknown> = {
    Logger: { log: (line: string) => logged.push(line) },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key: string) => store[key] ?? null,
        setProperty: (key: string, value: string) => {
          store[key] = value
        },
        getProperties: () => ({ ...store }),
      }),
    },
    Utilities: {
      // Padded, as the real one may be.
      base64EncodeWebSafe: (data: string | Buffer) => Buffer.from(data).toString('base64').replace(/\+/g, '-').replace(/\//g, '_'),
      computeRsaSha256Signature: (value: string, key: string) => createSign('RSA-SHA256').update(value).sign(key),
    },
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
  return { run, calls, store, logged }
}

function base64urlJson(part: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as Record<string, unknown>
}

describe('the bank sync script', () => {
  it('signs a JWT as Enable Banking asks: RS256, its application id as the kid, its issuer and audience, at most 24 hours, and no padding', () => {
    const { run, calls } = script(() => ({ aspsps: [{ name: 'Revolut', maximum_consent_validity: 15_552_000 }], url: 'https://example.invalid/approve' }))
    run('startLink', 'Revolut', 'https://example.invalid/kuna/', 'one-time')

    const [header, claims, signature] = calls[0]!.token.split('.') as [string, string, string]
    expect(calls[0]!.token).not.toContain('=')
    expect(base64urlJson(header)).toEqual({ typ: 'JWT', alg: 'RS256', kid: 'made-up-app-id' })
    const body = base64urlJson(claims) as { iss: string; aud: string; iat: number; exp: number }
    expect([body.iss, body.aud]).toEqual(['enablebanking.com', 'api.enablebanking.com'])
    expect(body.exp - body.iat).toBeLessThanOrEqual(86_400)
    expect(createVerify('RSA-SHA256').update(`${header}.${claims}`).verify(publicKey, Buffer.from(signature, 'base64url'))).toBe(true)
  })

  it('reads a key whose line breaks Script Properties keep as \\n', () => {
    const { run, calls } = script(() => ({ aspsps: [{ name: 'Revolut', maximum_consent_validity: 100 }], url: 'u' }), { ENABLE_BANKING_PRIVATE_KEY: privateKey.replace(/\n/g, '\\n') })
    run('startLink', 'Revolut', 'r', 's')
    const [header, claims, signature] = calls[0]!.token.split('.') as [string, string, string]
    expect(createVerify('RSA-SHA256').update(`${header}.${claims}`).verify(publicKey, Buffer.from(signature, 'base64url'))).toBe(true)
  })

  it('starts a link for as long as the bank allows, with the state and the address it is given', () => {
    const { run, calls } = script(() => ({ aspsps: [{ name: 'OTP banka', maximum_consent_validity: 15_552_000 }], url: 'https://example.invalid/approve' }))
    expect(run('startLink', 'OTP banka', 'https://example.invalid/kuna/', 'one-time')).toEqual({ url: 'https://example.invalid/approve' })

    expect(calls[0]!.url).toBe('https://api.enablebanking.com/aspsps?country=HR')
    expect(calls[1]).toMatchObject({ url: 'https://api.enablebanking.com/auth', method: 'post' })
    const body = calls[1]!.body as { access: { valid_until: string }; aspsp: unknown; state: string; redirect_url: string; psu_type: string }
    expect(body).toMatchObject({ aspsp: { name: 'OTP banka', country: 'HR' }, state: 'one-time', redirect_url: 'https://example.invalid/kuna/', psu_type: 'personal' })
    const days = (Date.parse(body.access.valid_until) - Date.now()) / 86_400_000
    expect(days).toBeGreaterThan(179.9)
    expect(days).toBeLessThan(180)
  })

  it('keeps only the session id once a link finishes, no account and no name', () => {
    const { run, store } = script(() => ({
      session_id: 'made-up-session',
      aspsp: { name: 'Revolut', country: 'HR' },
      access: { valid_until: '2027-05-03T12:00:00+00:00' },
      accounts: [{ uid: 'u1', account_id: { iban: 'LT000000000000000001' }, name: 'Made-up Owner' }],
    }))
    expect(run('finishLink', 'made-up-code')).toEqual({ validUntil: '2027-05-03T12:00:00+00:00' })
    expect(store['SESSION Revolut']).toBe('made-up-session')
    expect(JSON.stringify(store)).not.toContain('LT000000000000000001')
    expect(JSON.stringify(store)).not.toContain('Made-up Owner')
  })

  it('closes the session a new link replaces, and carries on if the bank already ended it', () => {
    const { run, calls, store } = script(
      ({ method }) => (method === 'delete' ? { status: 401, error: 'EXPIRED_SESSION' } : { session_id: 'new', aspsp: { name: 'Revolut' }, access: { valid_until: '2027-05-03' } }),
      { 'SESSION Revolut': 'old' },
    )
    expect(run('finishLink', 'made-up-code')).toEqual({ validUntil: '2027-05-03' })
    expect(calls.map(({ method, url }) => `${method} ${new URL(url).pathname}`)).toEqual(['post /sessions', 'delete /sessions/old'])
    expect(store['SESSION Revolut']).toBe('new')
  })

  it('answers for each bank apart, so one failing leaves the others theirs', () => {
    const { run } = script(
      ({ url }) => {
        if (url.endsWith('/sessions/down')) return { status: 429, error: 'ASPSP_RATE_LIMIT_EXCEEDED', message: 'Too many' }
        if (url.endsWith('/sessions/live')) return { status: 'AUTHORIZED', accounts: ['u1'] }
        return { account_id: { iban: 'LT000000000000000001' }, currency: 'XXX' }
      },
      { 'SESSION OTP banka': 'down', 'SESSION Revolut': 'live' },
    )
    expect(run('accounts')).toEqual([
      { bank: 'OTP banka', status: 'FAILED', reason: 'Enable Banking answered 429: ASPSP_RATE_LIMIT_EXCEEDED Too many', accounts: [] },
      { bank: 'Revolut', status: 'AUTHORIZED', accounts: [{ uid: 'u1', iban: 'LT000000000000000001', currency: 'XXX' }] },
    ])
  })

  it('names the accounts of each live session, and none of one that ended', () => {
    const { run } = script(
      ({ url }) => {
        if (url.endsWith('/sessions/live')) return { status: 'AUTHORIZED', access: { valid_until: '2027-05-03' }, accounts: ['u1'] }
        if (url.endsWith('/sessions/over')) return { status: 'EXPIRED', access: { valid_until: '2026-05-03' }, accounts: ['u2'] }
        return { account_id: { iban: 'LT000000000000000001' }, currency: 'XXX', name: 'Made-up' }
      },
      { 'SESSION Revolut': 'live', 'SESSION OTP banka': 'over' },
    )
    expect(run('accounts')).toEqual([
      { bank: 'Revolut', status: 'AUTHORIZED', accounts: [{ uid: 'u1', iban: 'LT000000000000000001', currency: 'XXX' }] },
      { bank: 'OTP banka', status: 'EXPIRED', accounts: [] },
    ])
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
    const { run, calls, store } = script(({ url }) => pages[new URL(url).searchParams.get('continuation_key') ?? 'first'])

    const found = run('transactions', 'account-uid', '2026-10-01', 'default') as { reference: string | null; amount: string }[]

    expect(found.map((row) => [row.reference, row.amount])).toEqual([
      ['r1', '1.00'],
      [null, '2.00'],
    ])
    expect(calls.map(({ url }) => url)).toEqual([
      'https://api.enablebanking.com/accounts/account-uid/transactions?date_from=2026-10-01&strategy=default',
      'https://api.enablebanking.com/accounts/account-uid/transactions?date_from=2026-10-01&strategy=default&continuation_key=k%2F1',
      'https://api.enablebanking.com/accounts/account-uid/transactions?date_from=2026-10-01&strategy=default&continuation_key=k2',
    ])
    expect(Object.keys(store).sort()).toEqual(['ENABLE_BANKING_APP_ID', 'ENABLE_BANKING_PRIVATE_KEY'])
  })

  it('marks a fetch as a person being there on each call that reads a bank, only when told to', () => {
    const answers: Answers = ({ url }) => {
      if (url.endsWith('/sessions/live')) return { status: 'AUTHORIZED', accounts: ['u1'] }
      if (url.endsWith('/details')) return { account_id: { iban: 'LT000000000000000001' }, currency: 'EUR' }
      return { transactions: [], balances: [] }
    }
    const present = script(answers, { 'SESSION Revolut': 'live' })
    present.run('accounts', 'made-up browser')
    present.run('transactions', 'u1', '2026-10-01', 'default', 'made-up browser')
    present.run('balances', 'u1', 'made-up browser')
    expect(present.calls.map(({ url, psuUserAgent }) => [new URL(url).pathname, psuUserAgent])).toEqual([
      ['/sessions/live', undefined],
      ['/accounts/u1/details', 'made-up browser'],
      ['/accounts/u1/transactions', 'made-up browser'],
      ['/accounts/u1/balances', 'made-up browser'],
    ])

    const absent = script(answers, { 'SESSION Revolut': 'live' })
    absent.run('accounts')
    absent.run('transactions', 'u1', '2026-10-01', 'default')
    absent.run('balances', 'u1')
    expect(absent.calls.every(({ psuUserAgent }) => psuUserAgent === undefined)).toBe(true)
  })

  it('reads each balance with its currency and kind', () => {
    const { run } = script(() => ({ balances: [{ name: 'Made-up', balance_amount: { amount: '12.50', currency: 'EUR' }, balance_type: 'ITBD' }] }))
    expect(run('balances', 'u1')).toEqual([{ amount: '12.50', currency: 'EUR', type: 'ITBD' }])
  })

  it('hands over a row without the usual fields rather than failing the whole account', () => {
    const { run } = script(() => ({ transactions: [{ status: 'BOOK' }] }))
    expect(run('transactions', 'u1', '2026-10-01', 'default')).toMatchObject([{ amount: '', currency: '', direction: '', status: 'BOOK' }])
  })

  describe('logBankFields', () => {
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

    it('logs field names and counts for every page, and no value at all', () => {
      const { run, logged, calls } = script(answers, { 'SESSION Revolut': 'made-up-session' })
      expect(run('logBankFields') ?? null).toBeNull()
      const log = logged.join('\n')
      SECRETS.forEach((secret) => expect(log).not.toContain(secret))
      expect(logged).toHaveLength(4)
      const rows = JSON.parse(logged[3]!.slice(logged[3]!.indexOf('{'))) as { count: number; fields: Record<string, number>; codes: Record<string, number>; days: Record<string, number> }
      expect(logged[3]).toContain('Revolut account 1 transactions')
      expect(rows.count).toBe(2)
      expect(rows.fields).toMatchObject({ 'transaction_amount.amount': 2, entry_reference: 1, 'exchange_rate.unit_currency': 1, 'remittance_information[]': 1, 'creditor.name': 1 })
      expect(rows.fields.note).toBeUndefined()
      expect(rows.codes).toEqual({ 'status BOOK': 1, 'status other': 1, 'credit_debit_indicator DBIT': 1 })
      expect(rows.days).toEqual({ bookingDateWithTime: 0, transactionDateWithTime: 1, valueDateWithTime: 0, madeOnAnotherDay: 1 })
      expect(logged[2]).toContain('balance_type ITAV')
      expect(logged[1]).toContain('"singleCurrency":false')
      expect(calls.filter(({ url }) => !url.includes('/sessions/')).every(({ psuUserAgent }) => psuUserAgent !== undefined)).toBe(true)
    })

    it('writes nothing to Script Properties', () => {
      const { run, store } = script(answers, { 'SESSION Revolut': 'made-up-session' })
      const before = JSON.stringify(store)
      run('logBankFields')
      expect(JSON.stringify(store)).toBe(before)
    })
  })

  it("throws Enable Banking's own error, for Kuna to show", () => {
    const { run } = script(() => ({ status: 429, error: 'ASPSP_RATE_LIMIT_EXCEEDED', message: 'Too many' }))
    expect(() => run('transactions', 'u', '2026-10-01', 'default')).toThrow('Enable Banking answered 429: ASPSP_RATE_LIMIT_EXCEEDED Too many')
  })

  it('says which Script Property is missing', () => {
    const { run } = script(() => ({}), { ENABLE_BANKING_PRIVATE_KEY: '' })
    expect(() => run('transactions', 'u', '2026-10-01', 'default')).toThrow('Script Properties lack')
  })

  it('asks for one scope, reaches one host, and can be run only by whoever deployed it', () => {
    expect(MANIFEST.oauthScopes).toEqual(['https://www.googleapis.com/auth/script.external_request'])
    expect(MANIFEST.urlFetchWhitelist).toEqual(['https://api.enablebanking.com/'])
    expect(MANIFEST.executionApi).toEqual({ access: 'MYSELF' })
    expect(MANIFEST.exceptionLogging).toBe('NONE')
  })
})
