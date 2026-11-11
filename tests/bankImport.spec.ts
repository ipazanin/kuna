import { afterEach, describe, expect, it, vi } from 'vitest'

import type { BankRead } from '../src/apps/spending/bankSync/application/bankRead'
import { proposeAccount } from '../src/apps/spending/bankSync/domain/bankAccountSetup'
import { bankImporter, BankScriptFailure, finishBankLink } from '../src/apps/spending/bankSync/application/bankSync'
import type { BankImportPorts, BankSyncPort, PendingLinks } from '../src/apps/spending/bankSync/application/bankSync'
import type { BankTransaction, LinkedAccount } from '../src/apps/spending/bankSync/domain/bankAnswer'
import type { PendingLink } from '../src/apps/spending/bankSync/domain/bankReturn'
import { bankHeldResult, bankStepResult, pendingCaption, pendingLine } from '../src/apps/spending/bankSync/presentation/bankStepResult'
import { hr } from '../src/apps/spending/bankSync/presentation/words'
import type { SpendingBook } from '../src/apps/spending/workbook/domain/readSpendingBook'
import type { SpendingBooks } from '../src/apps/spending/workbook/domain/spendingBooks'
import { spendingSettingsOf } from '../src/apps/spending/workbook/domain/spendingSettings'
import type { Transaction } from '../src/apps/spending/workbook/domain/transaction'
import { accountMoneyFromCents } from '../src/shared/money/accountMoney'
import type { UnitOfWork } from '../src/shared/storage/application/repository'
import { ACCOUNTS, CATEGORIES, OTP, REVOLUT_USD, row } from './fixtures/spending'
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
  exchangeRate: null,
}

const NOW = Date.parse('2026-10-30T12:00:00.000Z')
const HOUR = 3_600_000

function bookOf(transactions: readonly Transaction[], otpLink: string | null = '2027-01-01', otpFetchedAt: number | null = null): SpendingBooks {
  const links = [
    { id: 'w', key: 'bank_sync_deployment', value: 'AKfycb-made-up' },
    ...(otpLink === null ? [] : [{ id: 'x', key: 'bank_link_otp', value: otpLink }]),
    ...(otpFetchedAt === null ? [] : [{ id: 'y', key: 'bank_sync_fetched_otp', value: new Date(otpFetchedAt).toISOString() }]),
  ]
  return {
    title: 'made-up',
    accounts: ACCOUNTS,
    categories: CATEGORIES,
    transactions,
    budgets: [],
    rules: [],
    held: [],
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
      settled: async () => {},
    } as unknown as BankImportPorts['store'],
    state,
  }
}

function linked(uid: string, iban: string, currency: string): LinkedAccount {
  return { uid, iban, currency, product: null, details: null, cashAccountType: null, usage: null, identificationHash: null }
}

const OTP_SESSION = { bank: 'OTP banka', status: 'AUTHORIZED', accounts: [linked('otp', OTP.iban, 'EUR')] }

function portOf(fields: Partial<BankSyncPort> = {}): BankSyncPort {
  return { startLink: async () => '', finishLink: async () => '2027-05-03T12:00:00+00:00', sessions: async () => [OTP_SESSION], transactions: async () => [BANK], balances: async () => [], ...fields }
}

function importerOver(port: BankSyncPort, store: BankImportPorts['store'], asked: (read: BankRead) => void = () => undefined) {
  return bankImporter({ script: async () => port, store, asked, day: () => DAY, now: () => NOW })
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

    const { dryRun, receipt } = await importerOver(port, fake.store).run(false)

    expect(dryRun.added).toEqual([])
    expect(dryRun.lines.map((line) => line.outcome)).toEqual(['other-source'])
    expect(receipt).toBeNull()
  })

  it('tells the script a person is there only when a tap started the fetch', async () => {
    const fake = storeOver(bookOf([]))
    const script = vi.fn(async () => portOf())
    const importer = bankImporter({ script, store: fake.store, asked: () => undefined, day: () => DAY, now: () => NOW })

    await importer.run(true)
    await importer.run(false)

    expect(script.mock.calls.map((call) => (call as unknown as [string, boolean])[1])).toEqual([true, false])
  })

  describe('the balance check', () => {
    const stated =
      (amount: string, type = 'ITBD') =>
      async () => [{ amount, currency: 'EUR', type }]
    // The account's opening less the one €6.50 row the fetch brings.
    const afterImport = ((OTP.opening - 650) / 100).toFixed(2)

    it('says nothing when the bank agrees with the file once the rows are in', async () => {
      const { differences } = await importerOver(portOf({ balances: stated(afterImport) }), storeOver(bookOf([])).store).run(false)
      expect(differences).toEqual([])
    })

    it('offers the opening that makes a differing balance agree, and still imports', async () => {
      const fake = storeOver(bookOf([]))
      const outcome = await importerOver(portOf({ balances: stated('1.00') }), fake.store).run(false)
      // The bank says 1.00 where Kuna works out the opening less 6.50, so the opening moves by 1.00 − (opening − 6.50).
      expect(outcome.differences).toEqual([{ account: OTP, stated: 100, worked: OTP.opening - 650, pending: null, explained: false, fixedOpening: 750 }])
      expect(fake.added).toHaveLength(1)
      const line = bankStepResult(outcome, null, null, 0)
      expect('line' in line && line.line).toMatch(/OTP current: the bank says .*1\.00 and Kuna works out .*, so a row may be missing or the opening balance may be wrong\./)
    })

    it('offers no opening while the bank holds pending rows its balance may count', async () => {
      const pending: BankTransaction = { ...BANK, reference: 'ref-2', status: 'PDNG' }
      const { differences } = await importerOver(portOf({ balances: stated('1.00', 'ITAV'), transactions: async () => [BANK, pending] }), storeOver(bookOf([])).store).run(false)
      expect(differences.map((difference) => difference.fixedOpening)).toEqual([null])
    })

    it('notes the pending rows it left out, by account', async () => {
      const pending: BankTransaction = { ...BANK, reference: 'ref-2', status: 'PDNG' }
      const { dryRun } = await importerOver(portOf({ balances: stated('1.00', 'ITAV'), transactions: async () => [BANK, pending] }), storeOver(bookOf([])).store).run(false)
      expect(dryRun.notes).toContain('1 pending row of OTP current left out. It comes once it is booked.')
    })

    describe('with a pending card payment', () => {
      const card: BankTransaction = { ...BANK, reference: null, amount: '0.80', status: 'PDNG' }
      // The available balance counts the pending 0.80 on top of the opening less the booked 6.50.
      const available = ((OTP.opening - 650 - 80) / 100).toFixed(2)

      it('says the pending payments explain the difference as information, and the step stays done without a warning', async () => {
        const outcome = await importerOver(portOf({ balances: stated(available, 'ITAV'), transactions: async () => [BANK, card] }), storeOver(bookOf([])).store).run(false)
        expect(outcome.differences).toMatchObject([{ pending: -80, explained: true, fixedOpening: null }])
        expect(pendingLine(outcome.differences[0]!)).toBe('OTP current: €0.80 of payments are still pending. They come once they are booked.')
        const result = bankStepResult(outcome, null, null, 0)
        expect(result.kind).toBe('done')
        expect('line' in result && result.line).not.toContain('the bank says')
      })

      it('says pending money coming in, not payments, when it lifts the balance', () => {
        const incoming = {
          account: OTP,
          stated: accountMoneyFromCents(1500),
          worked: accountMoneyFromCents(1000),
          pending: accountMoneyFromCents(500),
          explained: true,
          fixedOpening: null,
        }
        expect(pendingLine(incoming)).toBe('OTP current: €5.00 coming in is still pending. It comes once it is booked.')
      })

      it('keeps the warning when the pending payments explain only part of the difference, and says how much is pending and how much is not explained', async () => {
        // 2.10 below what the pending 0.80 explains.
        const short = ((OTP.opening - 650 - 80 - 210) / 100).toFixed(2)
        const outcome = await importerOver(portOf({ balances: stated(short, 'ITAV'), transactions: async () => [BANK, card] }), storeOver(bookOf([])).store).run(false)
        const [difference] = outcome.differences
        expect(difference).toMatchObject({ pending: -80, explained: false, fixedOpening: null })
        const result = bankStepResult(outcome, null, null, 0)
        expect('line' in result && result.line).toMatch(/OTP current: the bank says .* and Kuna works out .*, so a row may be missing or the opening balance may be wrong\./)
        expect(pendingCaption({ ...difference!, pending: difference!.pending! })).toBe(
          'The bank still has €0.80 of payments pending, which its balance may count, so wait until they are booked before changing the opening. That leaves €2.10 they do not explain.',
        )
      })

      it('says the same in Croatian, with the account first and money in in the plural', () => {
        expect(hr.pendingPayments('Revolut EUR', '0,80 €')).toBe('Revolut EUR: plaćanja od 0,80 € još su na čekanju. Stižu kad se proknjiže.')
        expect(hr.pendingIncoming('Revolut EUR', '5,00 €')).toBe('Revolut EUR: uplate od 5,00 € još su na čekanju. Stižu kad se proknjiže.')
      })
    })

    it('reads a booked balance before an available one', async () => {
      const balances = async () => [
        { amount: '1.00', currency: 'EUR', type: 'ITAV' },
        { amount: afterImport, currency: 'EUR', type: 'CLBD' },
      ]
      const { differences } = await importerOver(portOf({ balances }), storeOver(bookOf([])).store).run(false)
      expect(differences).toEqual([])
    })

    it('counts a row the fetch filled in, not twice', async () => {
      const typed = row(OTP, '2026-10-27', -6.5, 'Food/Coffee', { payee: 'Bakery' })
      const { dryRun, differences } = await importerOver(portOf({ balances: stated(afterImport) }), storeOver(bookOf([typed])).store).run(false)
      expect(dryRun.filled).toBe(1)
      expect(differences).toEqual([])
    })

    it('says the balance was not checked when the bank refuses it, and keeps the rows', async () => {
      const fake = storeOver(bookOf([]))
      const balances = async () => {
        throw new BankScriptFailure('Enable Banking answered 429: ASPSP_RATE_LIMIT_EXCEEDED')
      }
      const { dryRun } = await importerOver(portOf({ balances }), fake.store).run(false)
      expect(dryRun.notes).toEqual(['The balance of OTP current was not checked, since the bank did not give it: Enable Banking answered 429: ASPSP_RATE_LIMIT_EXCEEDED'])
      expect(fake.added).toHaveLength(1)
    })
  })

  it('shares one fetch between two callers, and the next call makes its own', async () => {
    const fake = storeOver(bookOf([]))
    const sessions = vi.fn(async () => [OTP_SESSION])
    const importer = importerOver(portOf({ sessions }), fake.store)

    const [one, other] = await Promise.all([importer.run(false), importer.run(false)])

    expect(one).toBe(other)
    expect(sessions).toHaveBeenCalledTimes(1)
    expect(fake.added).toHaveLength(1)
    await importer.run(false)
    expect(sessions).toHaveBeenCalledTimes(2)
  })

  it('works out what is new only once nothing of the file is queued, since a waiting save may change it', async () => {
    const fake = storeOver(bookOf([]))
    const steps: string[] = []
    fake.store.settled = async () => {
      await Promise.resolve()
      steps.push('settled')
    }
    vi.mocked(fake.store.write).mockImplementationOnce(async () => {
      steps.push('write')
      return null
    })
    await importerOver(portOf(), fake.store).run(false)
    expect(steps).toEqual(['settled', 'write'])
  })

  it('holds the next one back only once the banks answered', async () => {
    const fake = storeOver(bookOf([]))
    const asked = vi.fn()
    const down: BankSyncPort = portOf({
      sessions: async () => {
        throw new Error('The bank sync script did not answer: 404')
      },
    })
    await expect(importerOver(down, fake.store, asked).run(false)).rejects.toThrow('404')
    expect(asked).not.toHaveBeenCalled()
    await importerOver(portOf(), fake.store, asked).run(false)
    expect(asked).toHaveBeenCalledOnce()
  })

  it('marks a session that ended, with the rest of the rows still imported in their own write', async () => {
    const fake = storeOver(bookOf([]))
    const port = portOf({ sessions: async () => [{ bank: 'OTP banka', status: 'EXPIRED', accounts: [] }] })

    const { problems } = await importerOver(port, fake.store).run(false)

    expect(fake.settings).toEqual([expect.objectContaining({ key: 'bank_link_otp', value: '2026-10-29' })])
    expect(problems).toEqual(['The link to OTP banka ended early. Link it again.'])
  })

  it('leaves the day alone for a link already over', async () => {
    const fake = storeOver(bookOf([], '2026-10-01'))
    await importerOver(portOf({ sessions: async () => [{ bank: 'OTP banka', status: 'EXPIRED', accounts: [] }] }), fake.store).run(false)
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
    await finishBankLink({ script: portOf(), pending, store: fake.store })
    expect(fake.settings).toEqual([expect.objectContaining({ key: 'bank_link_revolut', value: '2027-05-03' })])
    expect(pending.held()).toBeNull()
  })

  it('keeps what the code was traded for when the write fails, and a retry only writes', async () => {
    const fake = storeOver(bookOf([], null))
    const pending = pendingOver(WAITING)
    const finishLink = vi.fn(async () => '2027-05-03T12:00:00+00:00')
    const ports = { script: portOf({ finishLink }), pending, store: fake.store }
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
    await expect(finishBankLink({ script, pending, store: fake.store })).rejects.toThrow('EXPIRED_AUTHORIZATION_CODE')
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
    await expect(finishBankLink({ script, pending, store: fake.store })).rejects.toThrow('Failed to fetch')
    expect(pending.held()?.code).toBe('made-up')
  })
})

describe('what the step says', () => {
  const dryRun = { newRows: 2, alreadyIn: 1, filled: 0, notes: [] } as never
  const noWrite = { dryRun, problems: [], linked: [], proposals: [], differences: [], olderRows: [], receipt: null }
  const bookNow = () => bookOf([]) as unknown as SpendingBook
  const other = { bank: 'otp' as const, account: linked('u', 'HR0000000000000000077', 'EUR') }

  it('is done with a link to review when nothing went wrong', () => {
    expect(bankStepResult(noWrite, bookNow(), 7, 3)).toEqual({
      kind: 'done',
      line: '2 new, 1 already in, 0 paired with what you typed.',
      writeId: 7,
      link: { label: '3 rows to review', to: '/spending/transactions?tab=review' },
    })
  })

  it('waits and names a linked account Kuna does not keep with its currency, with a way to Settings', () => {
    const result = bankStepResult({ ...noWrite, linked: [other] }, bookNow(), null, 3)
    expect(result).toMatchObject({ kind: 'waits', link: { to: '/spending/settings?tab=bank-sync' } })
    expect('line' in result && result.line).toContain('OTP has an account in EUR that Kuna does not keep (HR0000000000000000077).')
  })

  it('names a multi-currency account by the currency the fetch drafted', () => {
    const all = linked('all', 'LT000000000000000009', 'XXX')
    const gbp = proposeAccount(all, 'revolut', 'GBP' as never, [], [], 'account:gbp' as never, DAY, ACCOUNTS)
    const result = bankStepResult({ ...noWrite, linked: [{ bank: 'revolut', account: all }], proposals: [gbp] }, bookNow(), null, 0)
    expect('line' in result && result.line).toContain('Revolut has an account in GBP that Kuna does not keep (LT000000000000000009).')
  })

  it('says an account that fits one without its IBAN needs updating, not that Kuna does not keep it', () => {
    const typed = { ...REVOLUT_USD, iban: '' }
    const book = { ...bookNow(), accounts: [...bookNow().accounts.filter((account) => account.id !== REVOLUT_USD.id), typed] }
    const result = bankStepResult({ ...noWrite, linked: [{ bank: 'revolut', account: linked('usd', 'LT000000000000000009', 'USD') }] }, book, null, 0)
    expect('line' in result && result.line).toContain(`Revolut has an account in USD that ${REVOLUT_USD.name} keeps once you update it with the bank's details.`)
  })

  it('stays quiet about a linked account kept by hand, which the person chose', () => {
    const byHand = { ...REVOLUT_USD, rowsFrom: 'by-hand' as const }
    const book = { ...bookNow(), accounts: [...bookNow().accounts.filter((account) => account.id !== REVOLUT_USD.id), byHand] }
    expect(bankStepResult({ ...noWrite, linked: [{ bank: 'revolut', account: linked('usd', REVOLUT_USD.iban, 'USD') }] }, book, null, 0)).toMatchObject({ kind: 'done' })
  })

  it('stays quiet about an account added since the fetch', () => {
    const added = { ...OTP, id: 'account:added', iban: 'HR0000000000000000077' } as typeof OTP
    const book = { ...bookNow(), accounts: [...bookNow().accounts, added] }
    expect(bankHeldResult([], [other], book)).toMatchObject({ kind: 'done' })
    expect(bankHeldResult([], [other], bookNow())).toMatchObject({ kind: 'waits' })
  })

  it('waits and says which bank gave no rows, keeping the write for Undo', () => {
    const result = bankStepResult({ ...noWrite, problems: ['OTP did not answer, so its rows wait for a later sync: HTTP 503'] }, bookNow(), 9, 0)
    expect(result).toMatchObject({ kind: 'waits', writeId: 9 })
  })

  it('waits and says older rows need a new link when a fetch reached back further than the bank gave', () => {
    const result = bankStepResult({ ...noWrite, olderRows: [{ bank: 'revolut', account: OTP, reached: civil('2026-08-10') }] }, bookNow(), null, 0)
    expect(result).toMatchObject({ kind: 'waits' })
    expect('line' in result && result.line).toContain('Older rows come only if you link Revolut again')
  })
})

describe('the six hours every device shares', () => {
  const transactions = vi.fn(async () => [BANK])

  afterEach(() => {
    transactions.mockClear()
  })

  it('leaves a bank alone on a second device within six hours of a fetch on another', async () => {
    const fake = storeOver(bookOf([], '2027-01-01', NOW - 6 * HOUR + 1))
    const { linked: reached } = await importerOver(portOf({ transactions }), fake.store).run(false)
    expect(transactions).not.toHaveBeenCalled()
    expect(reached.map((account) => account.bank)).toEqual(['otp'])
    expect(fake.titles).toEqual([])
  })

  it('asks again once six hours have passed, and writes the time in the same write as the rows', async () => {
    const fake = storeOver(bookOf([], '2027-01-01', NOW - 6 * HOUR))
    await importerOver(portOf({ transactions }), fake.store).run(false)
    expect(transactions).toHaveBeenCalledOnce()
    expect(fake.titles).toEqual(['Bank rows imported'])
    expect(fake.settings).toMatchObject([{ key: 'bank_sync_fetched_otp', value: '2026-10-30T12:00:00.000Z' }])
  })

  it('asks on Sync now within the six hours, and starts them again', async () => {
    const fake = storeOver(bookOf([], '2027-01-01', NOW - HOUR))
    await importerOver(portOf({ transactions }), fake.store).run(true)
    expect(transactions).toHaveBeenCalledOnce()
    expect(fake.settings).toMatchObject([{ key: 'bank_sync_fetched_otp', value: '2026-10-30T12:00:00.000Z' }])
  })

  it('writes the time alone when the fetch brought nothing new', async () => {
    const fake = storeOver(bookOf([]))
    await importerOver(portOf({ transactions: async () => [] }), fake.store).run(false)
    expect(fake.titles).toEqual(['Banks asked'])
    expect(fake.settings).toMatchObject([{ key: 'bank_sync_fetched_otp' }])
  })

  it('writes no time when the bank did not answer, so the next sync asks again', async () => {
    const fake = storeOver(bookOf([]))
    const failing = portOf({
      transactions: async () => {
        throw new BankScriptFailure('HTTP 503')
      },
    })
    await importerOver(failing, fake.store).run(false)
    expect(fake.settings).toEqual([])
  })
})
