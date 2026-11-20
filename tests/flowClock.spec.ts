import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const SUPPORT = fileURLToPath(new URL('../scripts/support/', import.meta.url))

describe('flows', () => {
  it('do not branch on the weekday of the run, so a flow checks the same thing whatever day CI runs', () => {
    const branches = readdirSync(SUPPORT)
      .filter((name) => name.endsWith('Flows.mjs'))
      .flatMap((name) =>
        readFileSync(`${SUPPORT}${name}`, 'utf8')
          .split('\n')
          .flatMap((line, index) => (/\.getDay\(\)|\bisWeekend\b/.test(line) ? [`scripts/support/${name}:${index + 1}`] : [])),
      )
    expect(branches).toEqual([])
  })
})
