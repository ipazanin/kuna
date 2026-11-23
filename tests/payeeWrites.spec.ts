import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { clearPayee, mergePayees, renamePayee, savePayee, setPayeeParty } from '../src/apps/spending/payees/application/payeeWrites'
import { newPayee } from '../src/apps/spending/payees/domain/payeeDetails'
import { codecOfSpendingKind } from '../src/apps/spending/workbook/application/spendingCodecs'
import type { Payee } from '../src/apps/spending/workbook/domain/payee'
import type { SpendingBooks } from '../src/apps/spending/workbook/domain/spendingBooks'
import { PAYEE_RECORDS, SETTING_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import { PERSON_PAYEES_KEY } from '../src/apps/spending/workbook/domain/spendingSettings'
import { spendingDocumentOf } from '../src/apps/spending/workbook/infrastructure/spendingDocument'
import type { WorkbookStore } from '../src/shared/storage/application/createWorkbookStore'
import type { RecordKind } from '../src/shared/storage/domain/recordKind'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { settingRow } from '../src/shared/storage/domain/settingRows'
import { SPENDING, browserHarness, forgetCaches } from './fixtures/writeBack'

const MARKET_IBAN = 'HR6212345670000000001'

const used = new Set<string>()

afterEach(async () => {
  await forgetCaches(used)
})

function stored<R>(kind: RecordKind<R>, records: readonly R[]) {
  const codec = codecOfSpendingKind(kind)
  return { [kind.name]: records.map((record) => codec.fieldsOf(record)) }
}

function payee(key: string, names: readonly string[], details: Partial<Payee> = {}): Payee {
  return { id: recordIdOf(PAYEE_RECORDS, key), names, ibans: [], party: null, taxId: '', website: '', note: '', ...details }
}

/** A store whose file holds the payees, and the old person setting when `marks` names any. */
async function spendingStore(payees: readonly Payee[], marks = ''): Promise<WorkbookStore<SpendingBooks>> {
  const settings = marks === '' ? {} : stored(SETTING_RECORDS, [settingRow(SETTING_RECORDS, PERSON_PAYEES_KEY, marks)])
  const document = spendingDocumentOf('2026-11-04T09:00:00.000Z', { ...stored(PAYEE_RECORDS, payees), ...settings })
  const { store } = await browserHarness(used, document, SPENDING)
  return store
}

describe('payee writes', () => {
  it('keep a payee with its names and IBANs, and refuse a second payee of the same IBAN', async () => {
    const store = await spendingStore([])
    const market = { ...newPayee('Corner market', 'business'), ibans: ['hr62 1234 5670 0000 0000 1'] }

    await store.write('Saved', (unit) => savePayee(unit, store.state.records!, market))

    expect(store.state.workbook!.payees).toEqual([{ ...market, ibans: [MARKET_IBAN] }])
    expect(store.state.workbook!.problems).toEqual([])
    await expect(store.write('Saved', (unit) => savePayee(unit, store.state.records!, { ...newPayee('Bakery'), ibans: [MARKET_IBAN] }))).rejects.toThrow(
      'Bakery: another payee, Corner market, holds the IBAN HR6212345670000000001 too.',
    )
  })

  it('keep the old name on a rename, and one Undo puts the payee back', async () => {
    const market = payee('market', ['Corner market'])
    const store = await spendingStore([market])

    await store.write('Renamed', (unit) => renamePayee(unit, store.state.records!, market, 'The corner market'))
    expect(store.state.workbook!.payees).toEqual([{ ...market, names: ['The corner market', 'Corner market'] }])

    await store.undo(store.state.writes[0]!)
    expect(store.state.workbook!.payees).toEqual([market])
  })

  it('merge two payees into one in one write', async () => {
    const market = payee('market', ['Corner market'], { party: 'business' })
    const short = payee('short', ['CORNER MKT'], { ibans: [MARKET_IBAN], note: 'Cash only' })
    const store = await spendingStore([market, short])

    await store.write('Merged', (unit) => mergePayees(unit, store.state.records!, market, short))

    expect(store.state.workbook!.payees).toEqual([{ ...market, names: ['Corner market', 'CORNER MKT'], ibans: [MARKET_IBAN], note: 'Cash only' }])
  })

  it('clear the details, and remove a payee left with one name and nothing else', async () => {
    const market = payee('market', ['Corner market', 'CORNER MKT'], { ibans: [MARKET_IBAN], party: 'business' })
    const bakery = payee('bakery', ['Bakery'], { note: 'Opens at six' })
    const store = await spendingStore([market, bakery])

    await store.write('Cleared', (unit) => clearPayee(unit, store.state.records!, market))
    await store.write('Cleared', (unit) => clearPayee(unit, store.state.records!, bakery))

    expect(store.state.workbook!.payees).toEqual([{ ...market, ibans: [], party: null }])
  })

  it('remove a payee of one name when the person mark comes off and leaves it nothing else', async () => {
    const store = await spendingStore([])

    await store.write('Marked', (unit) => setPayeeParty(unit, store.state.records!, 'Bakery', 'person'))
    expect(store.state.workbook!.payees).toMatchObject([{ names: ['Bakery'], party: 'person' }])

    await store.write('Marked', (unit) => setPayeeParty(unit, store.state.records!, 'Bakery', null))
    expect(store.state.workbook!.payees).toEqual([])
  })

  it('mark a payee found by its IBAN as a person, and take the mark off a person payee written surname first', async () => {
    const ana = payee('ana', ['Ana Horvat'], { ibans: [MARKET_IBAN] })
    const store = await spendingStore([ana])

    await store.write('Marked', (unit) => setPayeeParty(unit, store.state.records!, 'A. Horvat', 'person', MARKET_IBAN))
    expect(store.state.workbook!.payees).toEqual([{ ...ana, party: 'person' }])

    await store.write('Marked', (unit) => setPayeeParty(unit, store.state.records!, 'HORVAT ANA', null))
    expect(store.state.workbook!.payees).toEqual([ana])
  })
})

describe('the move of the old person setting', () => {
  it('turns every marked name into a person payee and removes the setting row in the first payee write, which one Undo takes back', async () => {
    const store = await spendingStore([], 'Ana Horvat\nMarko Kovač')

    await store.write('Saved', (unit) => savePayee(unit, store.state.records!, newPayee('Bakery', 'business')))

    expect(store.state.workbook!.payees).toMatchObject([
      { names: ['Ana Horvat'], party: 'person' },
      { names: ['Marko Kovač'], party: 'person' },
      { names: ['Bakery'], party: 'business' },
    ])
    expect(store.state.workbook!.readings.settings.facts).toEqual([])
    expect(store.state.writes).toHaveLength(1)

    await store.undo(store.state.writes[0]!)
    expect(store.state.workbook!.payees).toEqual([])
    expect(store.state.workbook!.readings.settings.facts).toMatchObject([{ key: PERSON_PAYEES_KEY, value: 'Ana Horvat\nMarko Kovač' }])
  })

  it('lets a new payee of a marked name take the place of its mark', async () => {
    const store = await spendingStore([], 'Ana Horvat')
    const ana = { ...newPayee('Ana Horvat', 'person'), note: 'Babysitter' }

    await store.write('Saved', (unit) => savePayee(unit, store.state.records!, ana))

    expect(store.state.workbook!.payees).toMatchObject([{ names: ['Ana Horvat'], party: 'person', note: 'Babysitter' }])
  })

  it('turns the mark off for a marked name the first write is about, which leaves no record of that name', async () => {
    const store = await spendingStore([], 'Ana Horvat\nMarko Kovač')

    await store.write('Marked', (unit) => setPayeeParty(unit, store.state.records!, 'HORVAT ANA', null))

    expect(store.state.workbook!.payees).toMatchObject([{ names: ['Marko Kovač'], party: 'person' }])
  })

  it('reads the marks beside payees that all fail to count, and moves them in the write that makes a payee count', async () => {
    const twins = [payee('market', ['Corner market'], { ibans: [MARKET_IBAN] }), payee('short', ['CORNER MKT'], { ibans: [MARKET_IBAN] })]
    const store = await spendingStore(twins, 'Ana Horvat')
    expect(store.state.workbook!.payees).toEqual([])
    expect(store.state.workbook!.readings.settings.facts).toMatchObject([{ key: PERSON_PAYEES_KEY, value: 'Ana Horvat' }])

    await store.write('Saved', (unit) => savePayee(unit, store.state.records!, newPayee('Bakery', 'business')))

    expect(store.state.workbook!.payees).toMatchObject([
      { names: ['Ana Horvat'], party: 'person' },
      { names: ['Bakery'], party: 'business' },
    ])
    expect(store.state.workbook!.readings.settings.facts).toEqual([])
    expect(store.state.workbook!.problems.filter((problem) => problem.kind === 'setting')).toEqual([])
  })

  it('lets a new payee of two marked names take the place of both marks', async () => {
    const store = await spendingStore([], 'Ana Horvat\nA. Horvat\nMarko Kovač')

    await store.write('Saved', (unit) => savePayee(unit, store.state.records!, { ...newPayee('Ana Horvat', 'person'), names: ['Ana Horvat', 'A. Horvat'] }))

    expect(store.state.workbook!.payees).toMatchObject([
      { names: ['Ana Horvat', 'A. Horvat'], party: 'person' },
      { names: ['Marko Kovač'], party: 'person' },
    ])
  })

  it('leaves a setting row found beside payees out of the marks, doubted', async () => {
    const store = await spendingStore([payee('bakery', ['Bakery'])], 'Ana Horvat')

    expect(store.state.workbook!.problems).toMatchObject([{ kind: 'setting', reason: 'is read no more, since each payee now says whether they are a person' }])
  })
})

describe('a refused payee write', () => {
  it("says the payee's problem in the words the file's problems use, in Croatian too", async () => {
    vi.resetModules()
    vi.doMock('../src/shared/text/language', async (original) => ({ ...(await original<object>()), language: 'hr' }))
    const croatian = await import('../src/apps/spending/workbook/domain/words')
    vi.doUnmock('../src/shared/text/language')

    expect(croatian.words.payeeRefused('Pekara', croatian.payeeReason({ kind: 'iban-taken', iban: MARKET_IBAN, holder: 'Corner market' }))).toBe(
      'Pekara: i drugi primatelj ili platitelj, Corner market, ima IBAN HR6212345670000000001.',
    )
    expect(croatian.words.payeeRefused('', croatian.payeeReason({ kind: 'no-name' }))).toBe('Primatelj ili platitelj nema naziv.')
  })
})
