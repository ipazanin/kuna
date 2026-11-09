import { describe, expect, it } from 'vitest'

import { companyAssistant } from '../src/apps/company/assistant/companyAssistant'
import { HR_DOO_ASSISTANT } from '../src/apps/company/packs/hr-doo/assistant/hrDooAssistant'
import { SETTING_WRITES as COMPANY_SETTING_WRITES, treatPayeeAsPerson as treatCounterpartyAsPerson } from '../src/apps/company/settings/application/settingWrites'
import { DEFAULT_SETTINGS, PERSON_PAYEES_KEY as COMPANY_PERSON_PAYEES_KEY, parseSettings, settingsTabEntries } from '../src/apps/company/settings/domain/settings'
import { SETTING_RECORDS as COMPANY_SETTING_RECORDS } from '../src/apps/company/workbook/domain/coreKinds'
import { SPENDING_OPERATIONS } from '../src/apps/spending/assistant/operations/spendingOperations'
import { treatPayeeAsPerson } from '../src/apps/spending/workbook/application/settingWrites'
import { SETTING_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import { PERSON_PAYEES_KEY, SPENDING_SETTING_CHECKS, spendingSettingsOf } from '../src/apps/spending/workbook/domain/spendingSettings'
import { flaggedAsPerson, personPayeesOf, withPayeeAsPerson } from '../src/shared/privacy/domain/personPayees'
import { changesOf } from '../src/shared/storage/application/recordWrites'
import { readSettingRows, settingRow } from '../src/shared/storage/domain/settingRows'
import type { SettingRow } from '../src/shared/storage/domain/settingRows'
import type { RecordsRead } from '../src/shared/storage/domain/recordsRead'
import { storedFieldOf } from '../src/shared/storage/domain/storedFields'

function spendingRead(rows: readonly SettingRow[]): RecordsRead<SettingRow> {
  return { records: rows.map((row) => ({ record: row, id: row.id, label: row.key, fields: { key: storedFieldOf(row.key), value: storedFieldOf(row.value) } })), refused: [] }
}

function companyRow(value: string): SettingRow {
  return settingRow(COMPANY_SETTING_RECORDS, COMPANY_PERSON_PAYEES_KEY, value)
}

describe('the payees flagged as people', () => {
  it('read one per line, trimmed, with blank lines dropped', () => {
    expect(personPayeesOf('Ana Horvat\n\n  Marko Kovač  \n \n')).toEqual(['Ana Horvat', 'Marko Kovač'])
    expect(personPayeesOf('')).toEqual([])
  })

  it('match the same words in any order and case, and nothing else', () => {
    expect(flaggedAsPerson(['Ana Horvat'], 'HORVAT ANA')).toBe(true)
    expect(flaggedAsPerson(['Ana Horvat'], 'Ana Horvat d.o.o.')).toBe(false)
    expect(flaggedAsPerson(['Ana Horvat'], '')).toBe(false)
  })

  it('take a payee once, and take every spelling of it off', () => {
    expect(withPayeeAsPerson(['Ana Horvat'], 'HORVAT ANA', true)).toEqual(['Ana Horvat'])
    expect(withPayeeAsPerson(['Ana Horvat'], ' Marko Kovač ', true)).toEqual(['Ana Horvat', 'Marko Kovač'])
    expect(withPayeeAsPerson(['Ana Horvat', 'horvat ana', 'Marko Kovač'], 'HORVAT ANA', false)).toEqual(['Marko Kovač'])
    expect(withPayeeAsPerson(['Ana Horvat'], '  ', true)).toEqual(['Ana Horvat'])
  })
})

describe("Spending's person_payees setting", () => {
  it('reads one payee per line with blank lines dropped, and none by default', () => {
    const rows = [settingRow(SETTING_RECORDS, PERSON_PAYEES_KEY, 'Ana Horvat\n\nMarko Kovač\n')]

    expect(readSettingRows(spendingRead(rows), SPENDING_SETTING_CHECKS).problems).toEqual([])
    expect(spendingSettingsOf(rows).personPayees).toEqual(['Ana Horvat', 'Marko Kovač'])
    expect(spendingSettingsOf([]).personPayees).toEqual([])
  })

  it('still refuses a key it does not know', () => {
    const reading = readSettingRows(spendingRead([settingRow(SETTING_RECORDS, 'person_payee', 'Ana Horvat')]), SPENDING_SETTING_CHECKS)

    expect(reading.facts).toEqual([])
    expect(reading.problems.map((problem) => problem.reason)).toEqual(['this Kuna knows no setting person_payee'])
  })

  it('adds a payee to the list, and a first one as a new row', () => {
    const first = changesOf((unit) => treatPayeeAsPerson(unit, [], 'Ana Horvat', true))
    expect(first.map(({ change }) => change)).toMatchObject([{ verb: 'add', after: settingRow(SETTING_RECORDS, PERSON_PAYEES_KEY, 'Ana Horvat') }])

    const held = settingRow(SETTING_RECORDS, PERSON_PAYEES_KEY, 'Ana Horvat')
    const second = changesOf((unit) => treatPayeeAsPerson(unit, [held], 'Marko Kovač', true))
    expect(second.map(({ change }) => change)).toMatchObject([{ verb: 'change', before: held, after: settingRow(SETTING_RECORDS, PERSON_PAYEES_KEY, 'Ana Horvat\nMarko Kovač') }])
  })

  it('writes nothing for a payee already flagged under another spelling', () => {
    expect(changesOf((unit) => treatPayeeAsPerson(unit, [settingRow(SETTING_RECORDS, PERSON_PAYEES_KEY, 'Ana Horvat')], 'HORVAT ANA', true))).toEqual([])
  })

  it('removes a payee by the same words, and the row with the last one', () => {
    const two = settingRow(SETTING_RECORDS, PERSON_PAYEES_KEY, 'Ana Horvat\nMarko Kovač')
    expect(changesOf((unit) => treatPayeeAsPerson(unit, [two], 'KOVAČ MARKO', false)).map(({ change }) => change)).toMatchObject([
      { verb: 'change', before: two, after: settingRow(SETTING_RECORDS, PERSON_PAYEES_KEY, 'Ana Horvat') },
    ])

    const one = settingRow(SETTING_RECORDS, PERSON_PAYEES_KEY, 'Ana Horvat')
    expect(changesOf((unit) => treatPayeeAsPerson(unit, [one], 'horvat ana', false)).map(({ change }) => change)).toMatchObject([{ verb: 'remove', before: one }])
  })

  it('is no key the chat may propose', () => {
    const setSetting = SPENDING_OPERATIONS.find((operation) => operation.name === 'set-setting')
    expect(JSON.stringify(setSetting?.input)).not.toContain(PERSON_PAYEES_KEY)
  })
})

describe("Company's person_payees setting", () => {
  it('reads one counterparty per line with blank lines dropped, writes them back the same way, and holds none by default', () => {
    const { settings, problems } = parseSettings([{ key: 'person_payees', value: 'Ana Horvat\n \nMarko Kovač\n' }])

    expect(problems).toEqual([])
    expect(settings.personPayees).toEqual(['Ana Horvat', 'Marko Kovač'])
    expect(settingsTabEntries(settings, null)).toContainEqual({ key: 'person_payees', value: 'Ana Horvat\nMarko Kovač' })
    expect(DEFAULT_SETTINGS.personPayees).toEqual([])
  })

  it('still reports a key it does not know', () => {
    expect(parseSettings([{ key: 'person_payee', value: 'Ana Horvat' }]).problems.map((problem) => problem.label)).toEqual(['person_payee'])
  })

  it('adds a counterparty to the list, and a first one as a new row', () => {
    const first = changesOf((unit) => treatCounterpartyAsPerson(unit, spendingRead([]), 'Ana Horvat', true))
    expect(first.map(({ change }) => change)).toMatchObject([{ verb: 'add', after: { key: 'person_payees', value: 'Ana Horvat' } }])

    const held = companyRow('Ana Horvat')
    const second = changesOf((unit) => treatCounterpartyAsPerson(unit, spendingRead([held]), 'Marko Kovač', true))
    expect(second.map(({ change }) => change)).toMatchObject([{ verb: 'change', before: held, after: { key: 'person_payees', value: 'Ana Horvat\nMarko Kovač' } }])
  })

  it('removes a counterparty by the same words, and the row with the last one', () => {
    const two = companyRow('Ana Horvat\nMarko Kovač')
    expect(changesOf((unit) => treatCounterpartyAsPerson(unit, spendingRead([two]), 'HORVAT ANA', false)).map(({ change }) => change)).toMatchObject([
      { verb: 'change', before: two, after: { key: 'person_payees', value: 'Marko Kovač' } },
    ])

    const one = companyRow('Ana Horvat')
    expect(changesOf((unit) => treatCounterpartyAsPerson(unit, spendingRead([one]), 'ana horvat', false)).map(({ change }) => change)).toMatchObject([{ verb: 'remove', before: one }])
  })

  it('keeps an Undo, as every write to the settings does', () => {
    expect(COMPANY_SETTING_WRITES.undoable).toBe(true)
  })

  it('is never told to the chat', () => {
    const told = companyAssistant(HR_DOO_ASSISTANT, { status: () => 'none', workbook: () => null, records: () => null }, () => []).settings.map((setting) => setting.key)

    expect(told).toContain('company_name')
    expect(told).not.toContain(COMPANY_PERSON_PAYEES_KEY)
  })
})
