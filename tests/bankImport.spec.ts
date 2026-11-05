import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { bankImporter, BankScriptFailure, finishBankLink } from '../src/apps/spending/bankSync/application/bankSync'
import type { BankImportPorts, BankRead, BankSyncPort, PendingLinks } from '../src/apps/spending/bankSync/application/bankSync'
import type { BankTransaction } from '../src/apps/spending/bankSync/domain/bankAnswer'
import type { PendingLink } from '../src/apps/spending/bankSync/domain/bankReturn'
import { saveLastFetch } from '../src/apps/spending/bankSync/infrastructure/bankBrowserState'
import { bankStepResult } from '../src/apps/spending/bankSync/presentation/bankStepResult'
import { BANK_SYNC_STEP } from '../src/apps/spending/bankSync/presentation/bankSyncStep'
import type { SpendingBooks } from '../src/apps/spending/workbook/domain/spendingBooks'
import { spendingSettingsOf } from '../src/apps/spending/workbook/domain/spendingSettings'
import type { Transaction } from '../src/apps/spending/workbook/domain/transaction'
import type { UnitOfWork } from '../src/shared/storage/application/repository'
import { ACCOUNTS, CATEGORIES, OTP, row } from './fixtures/spending'
import { civil } from './fixtures/ledger'

const DAY = civil('2026-10-30')

const BANK: BankTransaction = {
  reference: 'ref-1',
  amount: '6.50',
  currency: 'EUR',
  direction: 'DBIT',
  status: 'BOOK',
  bookedOn: '2026-10-28',
  valueOn: null,
  madeOn: null,
  creditorName: 'Corner bakery',
  creditorIban: null,
  debtorName: null,
  debtorIban: null,
  remittance: [],
}

function bookOf(transactions: readonly Transaction[], otpLink: string | null = '2027-01-01'): SpendingBooks {
  const links = otpLink === null ? [] : [{ id: 'x', key: 'bank_link_otp', value: otpLink }]
  return {
    title: 'made-up',
    accounts: ACCOUNTS,
    categories: CATEGORIES,
    transactions,
    budgets: [],
    rules: [],
    settings: spendingSettingsOf(links as never),
    readings: { settings: { facts: links, problems: [] } },
    problems: [],
  } as unknown as SpendingBooks
}

/** A store over the book given, whose writes run their work against a unit that records what was added and set. */
function storeOver(first: SpendingBooks) {
  const state = { workbook: first as SpendingBooks | null, writes: [] }
  const added: Transaction[] = []
  const settings: { key: string; value: string }[] = []
  const titles: string[] = []
  const unit = {
    of: () => ({
      add: (record: Transaction & { key: string; value: string }) => (record.key === undefined ? added.push(record) : settings.push(record)),
      change: (_before: unknown, after: Transaction & { key: string; value: string }) => (after.key === undefined ? undefined : settings.push(after)),
      remove: () => undefined,
    }),
  } as unknown as UnitOfWork
  return {
    added,
    settings,
    titles,
    store: {
      state,
      write: vi.fn(async (title: string, work: (unit: UnitOfWork) => void) => {
        titles.push(title)
        work(unit)
        return { title } as never
      }),
    } as unknown as BankImportPorts['store'],
    state,
  }
}

const OTP_SESSION = { bank: 'OTP banka', status: 'AUTHORIZED', accounts: [{ uid: 'otp', iban: OTP.iban, currency: 'EUR' }] }

function portOf(fields: Partial<BankSyncPort> = {}): BankSyncPort {
  return { startLink: async () => '', finishLink: async () => '2027-05-03T12:00:00+00:00', sessions: async () => [OTP_SESSION], transactions: async () => [BANK], ...fields }
}

function importerOver(port: BankSyncPort, store: BankImportPorts['store'], asked: (read: BankRead) => void = () => undefined) {
  return bankImporter({ script: async () => port, store, whenIdle: async () => undefined, asked, day: () => DAY })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('a fetch', () => {
  it('reads the file as it stands once the banks answered, so a row saved meanwhile is not doubled', async () => {
    const fake = storeOver(bookOf([]))
    const fileRow = row(OTP, '2026-10-28', -6.5, null, { payee: 'Corner bakery', source: 'statement', importKey: '0123456789abcdef-1' })
    const port = portOf({
      transactions: async () => {
        fake.state.workbook = bookOf([fileRow])
        return [BANK]
      },
    })

    const { dryRun, receipt } = await importerOver(port, fake.store).run()

    expect(dryRun.added).toEqual([])
    expect(dryRun.lines.map((line) => line.outcome)).toEqual(['other-source'])
    expect(receipt).toBeNull()
  })

  it('shares one fetch between two callers, and the next call makes its own', async () => {
    const fake = storeOver(bookOf([]))
    const sessions = vi.fn(async () => [OTP_SESSION])
    const importer = importerOver(portOf({ sessions }), fake.store)

    const [one, other] = await Promise.all([importer.run(), importer.run()])

    expect(one).toBe(other)
    expect(sessions).toHaveBeenCalledTimes(1)
    expect(fake.added).toHaveLength(1)
    await importer.run()
    expect(sessions).toHaveBeenCalledTimes(2)
  })

  it('waits for the file to be idle before it writes', async () => {
    const fake = storeOver(bookOf([]))
    let idle = false
    const importer = bankImporter({
      script: async () => portOf(),
      store: fake.store,
      whenIdle: async () => {
        await Promise.resolve()
        idle = true
      },
      asked: () => undefined,
      day: () => DAY,
    })
    vi.mocked(fake.store.write).mockImplementationOnce(async () => {
      expect(idle).toBe(true)
      return null
    })
    await importer.run()
    expect(fake.store.write).toHaveBeenCalledOnce()
  })

  it('holds the next one back only once the banks answered', async () => {
    const fake = storeOver(bookOf([]))
    const asked = vi.fn()
    const down: BankSyncPort = portOf({
      sessions: async () => {
        throw new Error('The bank sync script did not answer: 404')
      },
    })
    await expect(importerOver(down, fake.store, asked).run()).rejects.toThrow('404')
    expect(asked).not.toHaveBeenCalled()
    await importerOver(portOf(), fake.store, asked).run()
    expect(asked).toHaveBeenCalledOnce()
  })

  it('marks a session that ended, with the rest of the rows still imported in their own write', async () => {
    const fake = storeOver(bookOf([]))
    const port = portOf({ sessions: async () => [{ bank: 'OTP banka', status: 'EXPIRED', accounts: [] }] })

    const { problems } = await importerOver(port, fake.store).run()

    expect(fake.settings).toEqual([expect.objectContaining({ key: 'bank_link_otp', value: '2026-10-29' })])
    expect(problems).toEqual(['The link to OTP banka ended early. Link it again.'])
  })

  it('leaves the day alone for a link already over', async () => {
    const fake = storeOver(bookOf([], '2026-10-01'))
    await importerOver(portOf({ sessions: async () => [{ bank: 'OTP banka', status: 'EXPIRED', accounts: [] }] }), fake.store).run()
    expect(fake.settings).toEqual([])
  })
})

describe('finishing a link', () => {
  function pendingOver(first: PendingLink | null): PendingLinks & { held: () => PendingLink | null } {
    let held = first
    return { load: () => held, save: (next) => (held = next), held: () => held }
  }
  const WAITING: PendingLink = { bank: 'revolut', state: 'one-time', code: 'made-up', validUntil: null }

  it('writes the day and forgets the link', async () => {
    const fake = storeOver(bookOf([], null))
    const pending = pendingOver(WAITING)
    await finishBankLink({ script: portOf(), pending, store: fake.store, whenIdle: async () => undefined })
    expect(fake.settings).toEqual([expect.objectContaining({ key: 'bank_link_revolut', value: '2027-05-03' })])
    expect(pending.held()).toBeNull()
  })

  it('waits for the file to be idle before it writes, since the store refuses a write during a read', async () => {
    const fake = storeOver(bookOf([], null))
    const steps: string[] = []
    vi.mocked(fake.store.write).mockImplementationOnce(async () => {
      steps.push('write')
      return null
    })
    const whenIdle = async () => {
      steps.push('idle')
    }
    await finishBankLink({ script: portOf(), pending: pendingOver(WAITING), store: fake.store, whenIdle })
    expect(steps).toEqual(['idle', 'write'])
  })

  it('keeps what the code was traded for when the write fails, and a retry only writes', async () => {
    const fake = storeOver(bookOf([], null))
    const pending = pendingOver(WAITING)
    const finishLink = vi.fn(async () => '2027-05-03T12:00:00+00:00')
    const ports = { script: portOf({ finishLink }), pending, store: fake.store, whenIdle: async () => undefined }
    vi.mocked(fake.store.write).mockRejectedValueOnce(new Error('The file is being read'))

    await expect(finishBankLink(ports)).rejects.toThrow('being read')
    expect(pending.held()).toMatchObject({ code: 'made-up', validUntil: '2027-05-03T12:00:00+00:00' })

    await finishBankLink(ports)
    expect(finishLink).toHaveBeenCalledOnce()
    expect(fake.settings).toEqual([expect.objectContaining({ key: 'bank_link_revolut', value: '2027-05-03' })])
    expect(pending.held()).toBeNull()
  })

  it('forgets a code the script refused, since it will never work', async () => {
    const fake = storeOver(bookOf([], null))
    const pending = pendingOver(WAITING)
    const script = portOf({
      finishLink: async () => {
        throw new BankScriptFailure('The bank sync script did not answer: EXPIRED_AUTHORIZATION_CODE')
      },
    })
    await expect(finishBankLink({ script, pending, store: fake.store, whenIdle: async () => undefined })).rejects.toThrow('EXPIRED_AUTHORIZATION_CODE')
    expect(pending.held()).toBeNull()
  })

  it('keeps the code when the call never reached the script', async () => {
    const fake = storeOver(bookOf([], null))
    const pending = pendingOver(WAITING)
    const script = portOf({
      finishLink: async () => {
        throw new Error('The bank sync script did not answer: Failed to fetch')
      },
    })
    await expect(finishBankLink({ script, pending, store: fake.store, whenIdle: async () => undefined })).rejects.toThrow('Failed to fetch')
    expect(pending.held()?.code).toBe('made-up')
  })
})

describe('what the step says', () => {
  const dryRun = { newRows: 2, alreadyIn: 1, filled: 0, notes: [] } as never
  const noWrite = { dryRun, unknown: [], problems: [], receipt: null }

  it('is done with a link to review when nothing went wrong', () => {
    expect(bankStepResult(noWrite, 7, 3)).toEqual({
      kind: 'done',
      line: '2 new, 1 already in, 0 paired with what you typed.',
      writeId: 7,
      link: { label: '3 rows to review', to: '/spending/transactions?tab=review' },
    })
  })

  it('waits and names a linked account Kuna does not keep, with a way to Settings', () => {
    const result = bankStepResult({ ...noWrite, unknown: [{ bank: 'otp', account: { uid: 'u', iban: 'HR0000000000000000077', currency: 'EUR' } }] }, null, 3)
    expect(result).toMatchObject({ kind: 'waits', link: { to: '/spending/settings?tab=bank-sync' } })
    expect('line' in result && result.line).toContain('OTP has an account Kuna does not keep: HR0000000000000000077')
  })

  it('waits and says which bank gave no rows, keeping the write for Undo', () => {
    const result = bankStepResult({ ...noWrite, problems: ['OTP banka did not answer, so its rows wait for a later sync: HTTP 503'] }, 9, 0)
    expect(result).toMatchObject({ kind: 'waits', writeId: 9 })
  })
})

describe('the step while it holds back', () => {
  function stubStorage(): void {
    const stored = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, text: string) => stored.set(key, text), removeItem: (key: string) => stored.delete(key) })
  }

  it('is done when the last fetch left nothing', async () => {
    stubStorage()
    saveLastFetch({ at: Date.now() - 1000, problems: [] })
    expect(await BANK_SYNC_STEP.run(() => undefined, '')).toMatchObject({ kind: 'done', writeId: null })
  })

  it('keeps saying what the last fetch left, so a failure is not hidden for six hours', async () => {
    stubStorage()
    saveLastFetch({ at: Date.now() - 1000, problems: ['OTP banka did not answer, so its rows wait for a later sync: HTTP 503'] })
    const result = await BANK_SYNC_STEP.run(() => undefined, '')
    expect(result).toMatchObject({ kind: 'waits', link: { to: '/spending/settings?tab=bank-sync' } })
    expect('line' in result && result.line).toContain('OTP banka did not answer')
  })
})

describe('the privacy page', () => {
  const page = readFileSync(fileURLToPath(new URL('../public/privacy.html', import.meta.url)), 'utf8')
  const section = (heading: string): string => page.slice(page.indexOf(`<h2>${heading}</h2>`)).split('</section>')[0]!

  it('says where bank rows go', () => {
    expect(section('Where your data goes')).toContain('api.enablebanking.com')
    expect(section('Where your data goes')).toContain('IBANs')
  })

  it('says removing Kuna does not end a bank link, and how to', () => {
    expect(section('How to revoke access')).toContain('Script')
    expect(section('How to revoke access')).toContain('at your bank')
  })

  it('names what the browser keeps for a link', () => {
    for (const key of ['kuna.bank-link', 'kuna.bank-return', 'kuna.bank-sync-fetched']) expect(page).toContain(key)
  })
})
