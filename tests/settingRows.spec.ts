import { describe, expect, it } from 'vitest'

import { changesOf } from '../src/shared/storage/application/recordWrites'
import { setSetting, settingWrites } from '../src/shared/storage/application/settingWrites'
import { recordKind } from '../src/shared/storage/domain/recordKind'
import { ANY_VALUE, readSettingRows, settingRow, settingValue } from '../src/shared/storage/domain/settingRows'
import { words as recordWords } from '../src/shared/storage/domain/words'
import type { SettingRow } from '../src/shared/storage/domain/settingRows'

const KIND = recordKind<SettingRow>('setting', {
  en: { one: 'setting', many: 'settings', article: 'a' },
  hr: { one: 'postavka', of: 'postavke', few: 'postavke', other: 'postavki', gender: 'feminine' },
})
const CHECKS = new Map([
  ['note', ANY_VALUE],
  ['size', (value: string) => (/^\d+$/.test(value) ? [] : [`size "${value}" is not a number`])],
])
const RETIRED = new Set(['old_size'])
const WRITES = settingWrites(KIND, CHECKS, RETIRED)

function changes(rows: readonly SettingRow[], key: string, value: string) {
  return changesOf((unit) => setSetting(unit, WRITES, rows, key, value)).map(({ change }) => change)
}

describe("an app's setting rows", () => {
  it('reads a known key and a retired one silently, and lists an unknown key and a value its check refuses', () => {
    const rows = [settingRow(KIND, 'note', 'anything'), settingRow(KIND, 'size', 'big'), settingRow(KIND, 'constructor', 'x'), settingRow(KIND, 'old_size', 'any')]
    const reading = readSettingRows({ records: rows.map((row) => ({ record: row, id: row.id, label: row.key, fields: {} })), refused: [] }, CHECKS, RETIRED, recordWords.settingUnknown)

    expect([reading.facts.map((row) => row.key), reading.problems.map((problem) => problem.reason)]).toEqual([
      ['note', 'old_size'],
      ['size "big" is not a number', 'this Kuna knows no setting constructor'],
    ])
    expect([settingValue(rows, 'note'), settingValue(rows, 'missing')]).toEqual(['anything', ''])
  })

  it('adds a row for a first value, changes a held one, and removes it for a blank', () => {
    const held = settingRow(KIND, 'size', '3')

    expect(changes([], 'size', '3')).toMatchObject([{ verb: 'add', after: held }])
    expect(changes([held], 'size', '4')).toMatchObject([{ verb: 'change', before: held, after: settingRow(KIND, 'size', '4') }])
    expect(changes([held], 'size', '')).toMatchObject([{ verb: 'remove', before: held }])
  })

  it('writes nothing for the value already held, or for a blank with no row', () => {
    expect([changes([settingRow(KIND, 'size', '3')], 'size', '3'), changes([], 'size', '')]).toEqual([[], []])
  })
})
