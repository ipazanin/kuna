import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

describe('npmrc', () => {
  it('holds back any version published less than 3 days ago', () => {
    const lines = readFileSync(`${ROOT}.npmrc`, 'utf8').split('\n')
    const setting = lines.map((line) => /^\s*min-release-age\s*=\s*(\S+)\s*$/.exec(line)).find((found) => found !== null)
    expect(setting, '.npmrc sets no min-release-age').toBeDefined()
    expect(Number(setting?.[1])).toBeGreaterThanOrEqual(3)
  })

  it('names an npm in engines that has the option', () => {
    const engines = JSON.parse(readFileSync(`${ROOT}package.json`, 'utf8')).engines as Record<string, string>
    const [major, minor] = (engines.npm ?? '')
      .replace(/[^\d.]/g, '')
      .split('.')
      .map(Number)
    expect(major * 1000 + minor).toBeGreaterThanOrEqual(11 * 1000 + 10)
  })
})
