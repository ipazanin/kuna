import { readFileSync } from 'node:fs'

import ts from 'typescript'
import { describe, expect, it } from 'vitest'

import { CHAT_EXCEPTIONS, NARROW_CHAT_ACTIONS } from './chatCoverageExceptions'
import { FILE_ACTIONS, NOT_FILE_ACTIONS, appOf, chatCovers, chatReach, screenWrites, writeGraph } from './support/writePaths'

const GRAPH = writeGraph()
const SCREEN_WRITES = screenWrites(GRAPH)
const REACH = chatReach(GRAPH)
const EXCEPTED = new Map(CHAT_EXCEPTIONS.flatMap((exception) => exception.paths.map((path) => [path, exception] as const)))

/** Each path a screen writes through that no operation reaches, with where the screens name it. */
const UNCOVERED = [...SCREEN_WRITES].filter(([path]) => !chatCovers(GRAPH, REACH, path, NARROW_CHAT_ACTIONS))

describe('every action on a screen has a chat action or a listed exception', () => {
  it('finds the write paths of every app and Kuna', () => {
    const apps = new Set([...SCREEN_WRITES.keys()].map((path) => /^([a-z-]+): /.exec(path)?.[1] ?? appOf(path)))
    expect([...apps].sort()).toEqual(['assets', 'company', 'investments', 'kuna', 'loans', 'shared', 'spending'])
    expect([...REACH.keys()].sort()).toEqual(['assets', 'company', 'investments', 'kuna', 'loans', 'spending'])
  })

  it('reaches each path a screen writes through from an operation, or lists it with a reason', () => {
    const gaps = UNCOVERED.filter(([path]) => !EXCEPTED.has(path)).map(([path, sites]) => `${path} (${sites.map((site) => site.at).join(', ')})`)
    expect(gaps, 'Add an operation that reaches it, or a reason in tests/chatCoverageExceptions.ts').toEqual([])
  })

  it('lists no exception the chat reaches or no screen writes through', () => {
    const stale = [...EXCEPTED.keys()].filter((path) => !SCREEN_WRITES.has(path) || chatCovers(GRAPH, REACH, path, NARROW_CHAT_ACTIONS))
    expect(stale, 'Take these out of tests/chatCoverageExceptions.ts').toEqual([])
  })

  it('lists as narrow only store actions the chat calls', () => {
    const reached = new Set([...REACH.values()].flatMap((reach) => [...reach.fileActions]))
    expect([...NARROW_CHAT_ACTIONS].filter((action) => !reached.has(action))).toEqual([])
  })

  it('lists each path once', () => {
    const paths = CHAT_EXCEPTIONS.flatMap((exception) => exception.paths)
    expect(paths.length).toBe(new Set(paths).size)
  })
})

describe("the workbook store's members", () => {
  it('are each a file action the scan reads at the screens, or not one', () => {
    const source = ts.createSourceFile('createWorkbookStore.ts', readFileSync('src/shared/storage/application/createWorkbookStore.ts', 'utf8'), ts.ScriptTarget.Latest, true)
    const store = source.statements.find((statement): statement is ts.InterfaceDeclaration => ts.isInterfaceDeclaration(statement) && statement.name.text === 'WorkbookStore')
    const members = store?.members.flatMap((member) => (member.name !== undefined && ts.isIdentifier(member.name) ? [member.name.text] : [])) ?? []

    expect([...members].sort()).toEqual([...FILE_ACTIONS, ...NOT_FILE_ACTIONS].sort())
  })
})
