import { describe, expect, it } from 'vitest'

import type { RemovalReport } from '../src/shared/storage/application/appData'
import { en } from '../src/shared/storage/presentation/words'
import { removalLines } from '../src/shared/storage/presentation/removalLines'

const FILES = { fileName: 'kuna-investments.json', besideFileName: 'kuna-investments-prices.json' }

describe('what a failed delete says', () => {
  it('names the prices file that went to the bin and the file that stayed, and leaves out what never started', () => {
    const report: RemovalReport = {
      removed: false,
      steps: [
        { step: 'beside-file', outcome: { kind: 'done' } },
        { step: 'drive-file', outcome: { kind: 'failed', message: 'Only its owner can.', final: true } },
        { step: 'beside-copy', outcome: { kind: 'not-run' } },
      ],
    }

    expect(removalLines(report, FILES)).toEqual([
      { kind: 'gone', text: en.deleteData.lineGone.besideFile('kuna-investments-prices.json') },
      { kind: 'failed', text: en.deleteData.lineFailed.driveFile('kuna-investments.json', 'Only its owner can.') },
    ])
  })

  it('names a prices file that failed', () => {
    const report: RemovalReport = { removed: false, steps: [{ step: 'beside-file', outcome: { kind: 'failed', message: 'Drive answered 500.' } }] }

    expect(removalLines(report, FILES)[0]?.text).toContain('kuna-investments-prices.json')
  })
})
