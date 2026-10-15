import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import fakeWorkbook from '../src/features/workbook/infrastructure/fake/fakeWorkbook.json'
import { FAKE_WORKBOOK_MARKER, SPIKE_LOG_PREFIX } from '../scripts/support/devOnlyMarkers.mjs'

describe('dev-only markers', () => {
  it('uses the fake marker as the fake workbook spreadsheet id, which every use of the fixture carries', () => {
    expect(fakeWorkbook.spreadsheetId).toBe(FAKE_WORKBOOK_MARKER)
  })

  it('logs every spike line with the prefix the build looks for', () => {
    const spike = readFileSync(join(import.meta.dirname, '../src/features/workbook/presentation/SpikeScreen.vue'), 'utf8')

    expect(spike).toContain(`console.log('${SPIKE_LOG_PREFIX}'`)
  })
})
