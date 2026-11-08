import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { readBanks } from '../src/apps/spending/bankSync/application/bankRead'
import { addBankAccounts, bringBackBankDetails, fixOpening, keepMine, keepOutOfKuna, takeBankDetails } from '../src/apps/spending/bankSync/application/bankSetupWrites'
import { bankAccountKey, draftAccount, kindOfBankAccount, proposeAccount, setupLines, withOlderHistory } from '../src/apps/spending/bankSync/domain/bankAccountSetup'
import type { LinkedOfBank } from '../src/apps/spending/bankSync/domain/bankAccountSetup'
import type { BankTransaction, LinkedAccount } from '../src/apps/spending/bankSync/domain/bankAnswer'
import { fakeBankSync } from '../src/apps/spending/bankSync/infrastructure/fake/fakeBankSync'
import { writeDryRun } from '../src/apps/spending/statements/application/statementWrites'
import { statementDryRun } from '../src/apps/spending/statements/domain/statementDryRun'
import { codecOfSpendingKind } from '../src/apps/spending/workbook/application/spendingCodecs'
import type { SpendingBooks } from '../src/apps/spending/workbook/domain/spendingBooks'
import { ACCOUNT_RECORDS, CATEGORY_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import { spendingDocumentOf } from '../src/apps/spending/workbook/infrastructure/spendingDocument'
import type { WorkbookStore } from '../src/shared/storage/application/createWorkbookStore'
import type { RecordKind } from '../src/shared/storage/domain/recordKind'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { accountMoneyFromAmount } from '../src/shared/money/accountMoney'
import { SETTING_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import { BANK_ACCOUNTS_NOT_IN_KUNA_KEY, SPENDING_SETTING_CHECKS, spendingSettingsOf } from '../src/apps/spending/workbook/domain/spendingSettings'
import { settingRow } from '../src/shared/storage/domain/settingRows'
import { civil } from './fixtures/ledger'
import { ACCOUNTS, CATEGORIES, OTP, REVOLUT_EUR, REVOLUT_USD, USD, category } from './fixtures/spending'
import { SPENDING, browserHarness, forgetCaches } from './fixtures/writeBack'

const DAY = civil('2026-10-30')

function linked(uid: string, iban: string, currency: string, described: Partial<LinkedAccount> = {}): LinkedAccount {
  return { uid, iban, currency, product: null, details: null, cashAccountType: null, usage: null, identificationHash: null, ...described }
}

const revolut = (account: LinkedAccount): LinkedOfBank => ({ bank: 'revolut', account })
const book = (accounts = ACCOUNTS, transactions: readonly { account: string }[] = [], marks: { notInKuna?: readonly string[]; keepMine?: readonly string[] } = {}) => ({
  accounts,
  transactions: transactions as never,
  settings: { bankAccountsNotInKuna: marks.notInKuna ?? [], bankAccountsKeepMine: marks.keepMine ?? [] },
})

function bankRow(fields: Partial<BankTransaction>): BankTransaction {
  return {
    reference: 'r',
    amount: '10.00',
    currency: 'USD',
    direction: 'CRDT',
    status: 'BOOK',
    bookedOn: '2026-10-20',
    valueOn: null,
    madeOn: null,
    creditorName: null,
    creditorIban: null,
    debtorName: 'Someone',
    debtorIban: null,
    remittance: [],
    exchangeRate: null,
    ...fields,
  }
}

describe('the setup list', () => {
  it('keeps each currency of one IBAN on its own account, Revolut as two accounts', () => {
    const lines = setupLines([revolut(linked('eur', REVOLUT_EUR.iban, 'EUR')), revolut(linked('usd', REVOLUT_USD.iban, 'USD'))], [], book())
    expect(lines.map((line) => [line.kind, 'account' in line ? line.account.name : null])).toEqual([
      ['kept', 'Revolut EUR'],
      ['kept', 'Revolut USD'],
    ])
  })

  it('offers a dollar account Kuna does not keep, even though the euro account has its IBAN', () => {
    const lines = setupLines([revolut(linked('eur', REVOLUT_EUR.iban, 'EUR')), revolut(linked('usd', REVOLUT_EUR.iban, 'USD'))], [], book([OTP, REVOLUT_EUR]))
    expect(lines.map((line) => line.kind)).toEqual(['kept', 'missing'])
  })

  it('keeps an account typed with a blank bank, and offers the bank as an update', () => {
    const typed = { ...REVOLUT_EUR, bank: null }
    const [line] = setupLines([revolut(linked('eur', REVOLUT_EUR.iban, 'EUR'))], [], book([typed]))
    expect(line).toMatchObject({ kind: 'kept', account: typed, update: { ...typed, bank: 'revolut' } })
  })

  it('offers an account of the bank and currency typed without an IBAN the bank details, rather than a second account', () => {
    const typed = { ...REVOLUT_USD, iban: '' }
    const [line] = setupLines([revolut(linked('usd', REVOLUT_EUR.iban, 'USD'))], [], book([OTP, REVOLUT_EUR, typed]))
    expect(line).toMatchObject({ kind: 'fits', account: typed, update: { ...typed, iban: REVOLUT_EUR.iban } })
  })

  it("offers an unclaimed account with the IBAN the bank's currency only while it has no entries", () => {
    const lone = { ...REVOLUT_EUR, name: 'Revolut' }
    const linkedUsd = [revolut(linked('usd', REVOLUT_EUR.iban, 'USD'))]
    expect(setupLines(linkedUsd, [], book([lone]))[0]).toMatchObject({ kind: 'fits', update: { currency: 'USD' } })
    expect(setupLines(linkedUsd, [], book([lone], [{ account: lone.id }]))[0]?.kind).toBe('missing')
  })

  it('never offers a closed account or cash', () => {
    const closed = { ...REVOLUT_USD, iban: '', closed: true }
    const cash = ACCOUNTS.find((account) => account.kind === 'cash')!
    const lines = setupLines([revolut(linked('eur', REVOLUT_EUR.iban, 'EUR')), revolut(linked('usd', REVOLUT_EUR.iban, 'USD'))], [], book([REVOLUT_EUR, closed, { ...cash, currency: USD }]))
    expect(lines.map((line) => line.kind)).toEqual(['kept', 'missing'])
  })

  it('lists one you said is not in Kuna apart, by IBAN or by the bank hash when there is none', () => {
    const byIban = linked('usd', 'LT00 0000 0000 0000 0003', 'USD')
    const byHash = linked('card', '', 'EUR', { identificationHash: 'hash-1' })
    expect([bankAccountKey(byIban), bankAccountKey(byHash)]).toEqual(['LT000000000000000003 USD', 'hash-1 EUR'])
    const lines = setupLines([revolut(byIban), revolut(byHash)], [], book(ACCOUNTS, [], { notInKuna: ['LT000000000000000003 USD', 'hash-1 EUR'] }))
    expect(lines.map((line) => line.kind)).toEqual(['not-in-kuna', 'not-in-kuna'])
  })

  it('keeps an account you added under the IBAN of one you had said is not in Kuna', () => {
    const lines = setupLines([revolut(linked('usd', REVOLUT_USD.iban, 'USD'))], [], book(ACCOUNTS, [], { notInKuna: [`${REVOLUT_USD.iban} USD`] }))
    expect(lines.map((line) => line.kind)).toEqual(['kept'])
  })

  it('stops offering the bank details for an account you said keeps its own', () => {
    const usd = revolut(linked('usd', REVOLUT_USD.iban, 'USD', { cashAccountType: 'SVGS' }))
    expect(setupLines([usd], [], book())[0]).toMatchObject({ kind: 'kept', update: { kind: 'savings' } })
    expect(setupLines([usd], [], book(ACCOUNTS, [], { keepMine: [`${REVOLUT_USD.iban} USD`] }))[0]).toMatchObject({ kind: 'kept', update: null, keptMine: true })
  })

  it('names no account with neither an IBAN nor a bank hash, since the bank names it anew on every link', () => {
    expect(bankAccountKey(linked('pocket', '', 'EUR'))).toBeNull()
  })

  it('drafts one account per currency of a multi-currency account, keeping the currencies Kuna has', () => {
    const xxx = linked('all', REVOLUT_EUR.iban, 'XXX')
    const answer = [bankRow({}), bankRow({ currency: 'GBP' })]
    const gbp = proposeAccount(xxx, 'revolut', 'GBP' as never, answer, [], recordIdOf(ACCOUNT_RECORDS, 'gbp'), DAY, ACCOUNTS)
    const lines = setupLines([revolut(xxx)], [gbp], book([REVOLUT_EUR, REVOLUT_USD]))
    expect(lines.map((line) => [line.kind, line.kind === 'missing' ? line.currency : line.kind === 'kept' ? line.account.currency : null])).toEqual([
      ['kept', 'EUR'],
      ['kept', 'USD'],
      ['missing', 'GBP'],
    ])
  })
})

describe('a draft held from an earlier fetch', () => {
  const usd = linked('usd', 'LT000000000000000003', 'USD')
  const draftFrom = (answer: readonly BankTransaction[], uid = 'held') =>
    proposeAccount({ ...usd, uid }, 'revolut', USD, answer, [{ amount: '10.00', currency: 'USD', type: 'ITAV' }], recordIdOf(ACCOUNT_RECORDS, uid), DAY, [])

  it('stays when a later sync brings fewer of the older rows', () => {
    const long = draftFrom([bankRow({ bookedOn: '2025-01-10' })])
    const short = draftFrom([], 'later')
    expect(withOlderHistory([short], [long])).toEqual([long])
    expect(withOlderHistory([long], [short])).toEqual([long])
  })

  it('opens as worked out, never as an empty start, while the bank holds pending rows', () => {
    const proposal = draftFrom([bankRow({}), bankRow({ reference: 'p', status: 'PDNG', amount: '3.00', direction: 'DBIT' })])
    expect(proposal.opening).toMatchObject({ source: 'pending', opening: 0 })
  })
})

describe('a drafted account', () => {
  it("takes the IBAN's last four characters when another account has its name", () => {
    const id = recordIdOf(ACCOUNT_RECORDS, 'x')
    expect(draftAccount(linked('u', 'LT000000000000000003', 'USD'), 'revolut', USD, id, DAY, ACCOUNTS).name).toBe('Revolut USD 0003')
  })

  it("is savings by the bank's type or its product's name, a current account by any other stated type, and unknown when the bank states none", () => {
    expect([
      kindOfBankAccount({ cashAccountType: 'SVGS', product: null }),
      kindOfBankAccount({ cashAccountType: null, product: 'Savings vault' }),
      kindOfBankAccount({ cashAccountType: 'CACC', product: 'Standard' }),
      kindOfBankAccount({ cashAccountType: null, product: null }),
    ]).toEqual(['savings', 'savings', 'bank', null])
  })

  it('is named from the bank and the currency, never the holder', () => {
    const id = recordIdOf(ACCOUNT_RECORDS, 'x')
    expect(draftAccount(linked('u', 'lt00 1', 'USD', { cashAccountType: 'SVGS', details: 'Ana Horvat' }), 'revolut', USD, id, DAY, [])).toEqual({
      id,
      name: 'Revolut USD savings',
      kind: 'savings',
      bank: 'revolut',
      currency: USD,
      opening: 0,
      openedOn: DAY,
      iban: 'LT001',
      closed: false,
    })
  })
})

const used = new Set<string>()

afterEach(async () => {
  await forgetCaches(used)
})

function stored<R>(kind: RecordKind<R>, records: readonly R[]) {
  const codec = codecOfSpendingKind(kind)
  return { [kind.name]: records.map((record) => codec.fieldsOf(record)) }
}

async function spendingStore(accounts = ACCOUNTS): Promise<WorkbookStore<SpendingBooks>> {
  const document = spendingDocumentOf('2026-10-30T09:00:00.000Z', { ...stored(ACCOUNT_RECORDS, accounts), ...stored(CATEGORY_RECORDS, CATEGORIES) })
  const { store } = await browserHarness(used, document, SPENDING)
  return store
}

describe('the setup writes', () => {
  it('adds the drafted accounts with their held rows in one write, which one Undo takes back', async () => {
    const store = await spendingStore()
    let place = 0
    const read = await readBanks(fakeBankSync('new-accounts', DAY), store.state.workbook!, DAY, [], () => recordIdOf(ACCOUNT_RECORDS, `5e000000-0000-4000-8000-00000000900${(place += 1)}`))

    const receipt = await store.write('Accounts added', (unit) => addBankAccounts(unit, store.state.workbook!, read.proposals, DAY))

    expect(store.state.workbook!.problems).toEqual([])
    expect(store.state.workbook!.accounts.map((account) => account.name).slice(-2)).toEqual(['Revolut USD 0003', 'Revolut EUR savings'])
    expect(store.state.workbook!.transactions.map((each) => each.payee)).toEqual(['Top-up', 'Savings deposit', 'Bookshop in Boston'])
    await store.undo(store.state.writes.find((write) => write.receipt === receipt)!)
    expect(store.state.workbook!.accounts).toEqual(ACCOUNTS)
    expect(store.state.workbook!.transactions).toEqual([])
  })

  it('pairs a held exchange leg with the other leg already on the file, under Between my accounts', async () => {
    const store = await spendingStore([OTP, REVOLUT_EUR])
    const outLeg = { ...bankRow({ reference: 'x-1', amount: '50.00', currency: 'EUR', direction: 'DBIT', creditorName: 'Exchanged to USD', debtorName: null }), exchangeRate: '1.0850' }
    const inLeg = bankRow({ reference: 'x-2', amount: '54.25', currency: 'USD', debtorName: 'Exchanged from EUR' })
    const port = fakeBankSync('linked', DAY)
    const sessions = async () => [{ bank: 'Revolut', status: 'AUTHORIZED', accounts: [linked('eur', REVOLUT_EUR.iban, 'EUR'), linked('usd', REVOLUT_EUR.iban, 'USD')] }]
    const read = await readBanks({ ...port, sessions, transactions: async (uid) => (uid === 'eur' ? [outLeg] : [inLeg]), balances: async () => [] }, store.state.workbook!, DAY)
    await store.write('Imported', (unit) => writeDryRun(unit, statementDryRun(store.state.workbook!, read.statement, DAY)))

    await store.write('Account added', (unit) => addBankAccounts(unit, store.state.workbook!, read.proposals, DAY))

    const between = category('Between my accounts').id
    expect(store.state.workbook!.transactions.map((each) => [each.payee, each.category === between, each.pair !== null])).toEqual([
      ['Exchanged to USD', true, true],
      ['Exchanged from EUR', true, true],
    ])
  })

  it("gives an account the bank's details and its held rows in one write, keeping its name and opening", async () => {
    const typed = { ...REVOLUT_USD, iban: '' }
    const store = await spendingStore([OTP, REVOLUT_EUR, typed])
    const usd = linked('usd', REVOLUT_EUR.iban, 'USD')
    const proposal = proposeAccount(usd, 'revolut', USD, [bankRow({})], [], recordIdOf(ACCOUNT_RECORDS, 'never-written'), DAY, [])
    const [line] = setupLines([revolut(usd)], [proposal], store.state.workbook!)
    if (line?.kind !== 'fits') throw new Error('expected a fitting account')

    await store.write('Account updated', (unit) => takeBankDetails(unit, store.state.workbook!, line.account, line.update, line.proposal, DAY))

    expect(store.state.workbook!.accounts.find((account) => account.id === typed.id)).toEqual({ ...typed, iban: REVOLUT_EUR.iban })
    expect(store.state.workbook!.transactions.map((each) => [each.account, each.amount])).toEqual([[typed.id, accountMoneyFromAmount(10)]])
  })

  it('marks an account not in Kuna and brings it back with one setting', async () => {
    const store = await spendingStore()
    const usd = linked('usd', 'LT000000000000000003', 'USD')
    await store.write('Left out', (unit) => keepOutOfKuna(unit, store.state.workbook!, usd, true))
    expect(store.state.workbook!.settings.bankAccountsNotInKuna).toEqual(['LT000000000000000003 USD'])
    await store.write('Brought back', (unit) => keepOutOfKuna(unit, store.state.workbook!, usd, false))
    expect(store.state.workbook!.settings.bankAccountsNotInKuna).toEqual([])
  })

  it("keeps an account's own details with one setting and brings the bank's back with the same", async () => {
    const store = await spendingStore()
    const usd = linked('usd', REVOLUT_USD.iban, 'USD')
    await store.write('Kept yours', (unit) => keepMine(unit, store.state.workbook!, usd))
    expect(store.state.workbook!.settings.bankAccountsKeepMine).toEqual([`${REVOLUT_USD.iban} USD`])
    await store.write('Brought back', (unit) => bringBackBankDetails(unit, store.state.workbook!, usd))
    expect(store.state.workbook!.settings.bankAccountsKeepMine).toEqual([])
  })

  it('sets the opening alone, leaving its day and every row where they were', async () => {
    const store = await spendingStore()
    await store.write('Opening set', (unit) => fixOpening(unit, OTP, accountMoneyFromAmount(12)))
    expect(store.state.workbook!.accounts.find((account) => account.id === OTP.id)).toEqual({ ...OTP, opening: accountMoneyFromAmount(12) })
  })
})

describe("Spending's bank_sync_not_in_kuna setting", () => {
  const check = SPENDING_SETTING_CHECKS.get(BANK_ACCOUNTS_NOT_IN_KUNA_KEY)!

  it('reads one account per line with blank lines dropped, and none by default', () => {
    const rows = [settingRow(SETTING_RECORDS, BANK_ACCOUNTS_NOT_IN_KUNA_KEY, 'LT000000000000000003 USD\n\nhash-1 EUR\n')]
    expect(check(rows[0]!.value)).toEqual([])
    expect(spendingSettingsOf(rows).bankAccountsNotInKuna).toEqual(['LT000000000000000003 USD', 'hash-1 EUR'])
    expect(spendingSettingsOf([]).bankAccountsNotInKuna).toEqual([])
  })

  it('refuses a line that is not an IBAN and a currency', () => {
    expect(check('LT000000000000000003 USD\nRevolut dollars')).toEqual(['bank_sync_not_in_kuna line "Revolut dollars" is not an IBAN and a currency such as LT000000000000000001 USD'])
  })
})
