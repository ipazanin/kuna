import { describe, expect, it } from 'vitest'

import { holdsReportKey, reportRowKey, sourceOfKey, transcribedRowKey, withImportKey } from '../src/apps/investments/imports/domain/reportKey'
import { TRADE_CODEC } from '../src/apps/investments/workbook/domain/tradeReading'
import { storedFieldsOfValues } from '../src/shared/storage/domain/storedFields'
import { BROKER, instrument, trade } from './fixtures/investments'

const WORKBOOK_KEY = 'a1b2c3d4e5f60718'
const REPORT_KEY = reportRowKey('ibkr-flex', 'U0000001', '1234567')
const COPIED_KEY = transcribedRowKey('9f8e7d6c5b4a3210', '0011223344556677')

describe('the source of an import key', () => {
  it.each([
    [WORKBOOK_KEY, 'workbook'],
    [REPORT_KEY, 'ibkr-flex'],
    [COPIED_KEY, 'transcribed'],
  ])('reads %s as from %s', (key, source) => {
    expect(sourceOfKey(key)).toBe(source)
  })

  it('takes a record as from a report while any of its keys is a report key', () => {
    expect(holdsReportKey([WORKBOOK_KEY, REPORT_KEY])).toBe(true)
    expect(holdsReportKey([WORKBOOK_KEY, COPIED_KEY])).toBe(false)
    expect(holdsReportKey([])).toBe(false)
  })
})

describe('one import key per source', () => {
  it('adds a key of a new source beside the others and replaces the key of the same source in its place', () => {
    expect(withImportKey([WORKBOOK_KEY], REPORT_KEY)).toEqual([WORKBOOK_KEY, REPORT_KEY])
    expect(withImportKey([WORKBOOK_KEY, REPORT_KEY], 'ffffffffffffffff')).toEqual(['ffffffffffffffff', REPORT_KEY])
    expect(withImportKey([], COPIED_KEY)).toEqual([COPIED_KEY])
  })
})

describe('the import key cell', () => {
  const held = trade('buy', BROKER, instrument('abc'), '2026-03-02', '5', '20', null)

  it('reads an older cell with one key as that key, and a blank one as none', () => {
    const fields = TRADE_CODEC.fieldsOf({ ...held, importKeys: [] })
    expect(TRADE_CODEC.make(storedFieldsOfValues({ ...fields, import_key: WORKBOOK_KEY }), held.id).importKeys).toEqual([WORKBOOK_KEY])
    expect(TRADE_CODEC.make(storedFieldsOfValues(fields), held.id).importKeys).toEqual([])
  })

  it('keeps two keys in one cell as a | b and reads them back', () => {
    const fields = TRADE_CODEC.fieldsOf({ ...held, importKeys: [WORKBOOK_KEY, REPORT_KEY] })
    expect(fields['import_key']).toBe(`${WORKBOOK_KEY} | ${REPORT_KEY}`)
    expect(TRADE_CODEC.make(storedFieldsOfValues(fields), held.id).importKeys).toEqual([WORKBOOK_KEY, REPORT_KEY])
  })
})
