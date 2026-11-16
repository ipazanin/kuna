import { globSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(import.meta.dirname, '..')
/** A path that only exists on one machine, such as a macOS temp folder or a home folder, which a clean checkout lacks. */
const MACHINE_PATH = /\/(?:private\/tmp|Users)\//

describe('paths of one machine', () => {
  it('keeps them out of the source and the tests, which take a temp folder from the system instead', () => {
    const files = globSync('{src,tests}/**/*.{ts,mts,mjs,vue}', { cwd: ROOT })
    const found = files.filter((file) => MACHINE_PATH.test(readFileSync(join(ROOT, file), 'utf8')))

    expect(files.length).toBeGreaterThan(100)
    expect(found).toEqual([])
  })
})
