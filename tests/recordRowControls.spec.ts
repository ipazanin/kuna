import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('the controls a record row leaves to themselves', () => {
  const root = join(import.meta.dirname, '..')
  const recordRow = readFileSync(join(root, 'src/shared/ui/RecordRow.vue'), 'utf8')
  const visualCheck = readFileSync(join(root, 'scripts/visual-check.mjs'), 'utf8')

  it('are the ones the visual check skips when it presses a cell', () => {
    const controls = /const CONTROLS =\s*'([^']+)'/.exec(recordRow)?.[1]
    expect(controls).toBeDefined()
    expect(/const recordRowControls =\s*'([^']+)'/.exec(visualCheck)?.[1]).toBe(controls)
  })
})
