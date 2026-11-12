import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

import { writeGraph } from './support/writePaths'

const GRAPH = writeGraph()

/** Each `.remember(` call in the program, as `file:line`, found by its text alone. */
function rememberCalls(): string[] {
  const found = execFileSync('git', ['grep', '-n', '-F', '--', '.remember(', 'src'], { encoding: 'utf8' })
  return found
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => line.split(':').slice(0, 2).join(':'))
}

describe('the scan of what this device keeps', () => {
  it("counts every call of a device choice's remember as a write", () => {
    const counted = new Set([...GRAPH.modules.values()].flatMap((module) => [...module.declarations.keys()].flatMap((name) => GRAPH.named(`${module.file}#${name}`).deviceWrites)))

    expect(rememberCalls().filter((at) => !counted.has(at))).toEqual([])
  })

  it('reads a choice as no write, and keeps one as a write, through a constant, a call or a function that makes the choice', () => {
    const writes = (key: string) => GRAPH.writes(key)

    expect(
      [
        'src/shell/ui/sidebarLayout.ts#chooseSidebar',
        'src/shared/ui/cardCollapse.ts#rememberCollapse',
        'src/shared/google/googleSession.ts#saveGrantedScopes',
        'src/shared/app/setUpAnswer.ts#keepSetUpAnswer',
      ].filter((key) => !writes(key)),
    ).toEqual([])
    expect(
      [
        'src/shell/ui/sidebarLayout.ts#sidebarChoice',
        'src/shared/ui/cardCollapse.ts#storedCollapse',
        'src/shared/google/googleSession.ts#loadGrantedScopes',
        'src/shared/app/kunaStart.ts#kunaStart',
      ].filter(writes),
    ).toEqual([])
  })
})
