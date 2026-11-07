import { globSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from '@vue/compiler-sfc'
import type { ElementNode, RootNode, TemplateChildNode } from '@vue/compiler-dom'
import { shallowReactive } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import type { WorkbookStore, BooksRead } from '../src/shared/storage/application/createWorkbookStore'
import type { WriteOptions } from '../src/shared/storage/application/writeQueue'
import { trackWrite, writesInFlight } from '../src/shared/storage/application/writesInFlight'
import { useRecordWrites } from '../src/shared/storage/presentation/useRecordWrites'

vi.mock('@nuxt/ui/composables/useToast', () => ({ useToast: () => ({ add: () => undefined }) }))

/** A store whose writes wait in `waiting` until the test lets each go, as the real queue holds them. */
function queueingStore() {
  const state = shallowReactive<{ waiting: readonly { readonly key: string | null }[]; writes: readonly never[] }>({ waiting: [], writes: [] })
  const landings: (() => void)[] = []
  const store = {
    state,
    write: (_title: string, _work: unknown, options?: WriteOptions) =>
      new Promise<null>((resolve) => {
        const queued = { key: options?.key ?? null }
        state.waiting = [...state.waiting, queued]
        landings.push(() => {
          state.waiting = state.waiting.filter((waiting) => waiting !== queued)
          resolve(null)
        })
      }),
    undo: async () => {},
  } as unknown as Pick<WorkbookStore<BooksRead>, 'state' | 'write' | 'undo'>
  return { store, landings }
}

const root = join(import.meta.dirname, '..')
const ELEMENT = 1
const DIRECTIVE = 7

function elementsOf(node: RootNode | TemplateChildNode): ElementNode[] {
  const children = 'children' in node ? (node.children as TemplateChildNode[]) : []
  return [...(node.type === ELEMENT ? [node as ElementNode] : []), ...children.flatMap((child) => (typeof child === 'object' ? elementsOf(child) : []))]
}

function boundProps(element: ElementNode): { readonly name: string; readonly expression: string }[] {
  return element.props.flatMap((prop) =>
    prop.type === DIRECTIVE && prop.name === 'bind' && prop.arg !== undefined && 'content' in prop.arg
      ? [{ name: prop.arg.content, expression: prop.exp && 'content' in prop.exp ? prop.exp.content : '' }]
      : [],
  )
}

/** The elements of a component that disable themselves on a busy flag and have no loading state beside it. */
function disabledWithoutLoading(source: string): string[] {
  const ast = parse(source).descriptor.template?.ast
  if (ast === undefined || ast === null) return []
  return elementsOf(ast)
    .filter((element) => {
      const bound = boundProps(element)
      const disabledOnBusy = bound.some((prop) => prop.name === 'disabled' && /\bbusy\b/.test(prop.expression))
      return disabledOnBusy && !bound.some((prop) => prop.name === 'loading')
    })
    .map((element) => `<${element.tag}> at line ${element.loc.start.line}`)
}

/** The switches and selects of a component that act on a change and show no spinner. */
function savesOnChangeWithoutLoading(source: string): string[] {
  const ast = parse(source).descriptor.template?.ast
  if (ast === undefined || ast === null || !source.includes('useRecordWrites(')) return []
  return elementsOf(ast)
    .filter((element) => {
      const acts = element.props.some((prop) => prop.type === DIRECTIVE && prop.name === 'on' && prop.arg !== undefined && 'content' in prop.arg && /^update:model/.test(prop.arg.content))
      return (element.tag === 'USwitch' || element.tag === 'USelect') && acts && !boundProps(element).some((prop) => prop.name === 'loading')
    })
    .map((element) => `<${element.tag}> at line ${element.loc.start.line}`)
}

/** Their switch or select changes something on this device or a draft, and writes nothing to the file. */
const CHANGES_NOTHING_ON_FILE = ['src/apps/company/imports/presentation/ImportPanel.vue', 'src/apps/company/transactions/presentation/ReviewQueue.vue']

describe('what a control shows while its save waits', () => {
  it('keeps the second write spinning when the first one lands', async () => {
    const { store, landings } = queueingStore()
    const writes = useRecordWrites(store)

    const first = writes.write('First', () => {}, { key: 'one' })
    const second = writes.write('Second', () => {}, { key: 'two' })
    expect([writes.saving('one'), writes.saving('two'), writes.busy.value]).toEqual([true, true, true])

    landings[0]!()
    await first
    expect([writes.saving('one'), writes.saving('two'), writes.busy.value]).toEqual([false, true, true])

    landings[1]!()
    await second
    expect([writes.saving('two'), writes.busy.value]).toEqual([false, false])
  })

  it('never spins another card with a write that has no key of its own', async () => {
    const { store, landings } = queueingStore()
    const card = useRecordWrites(store)
    const other = useRecordWrites(store)

    const written = card.write('Saved', () => {})
    expect([card.saving('save'), other.saving('save'), other.busy.value]).toEqual([true, false, false])

    landings[0]!()
    await written
  })

  it('keeps a key spinning on a screen left and reopened', async () => {
    const { store, landings } = queueingStore()
    const left = useRecordWrites(store)
    const written = left.write('Saved', () => {}, { key: 'loan-bucket' })

    expect(useRecordWrites(store).saving('loan-bucket')).toBe(true)

    landings[0]!()
    await written
  })
})

describe('write feedback', () => {
  it('counts overlapping writes until both are done', async () => {
    let finishFirst: () => void = () => {}
    let finishSecond: () => void = () => {}
    const first = trackWrite(() => new Promise<void>((resolve) => (finishFirst = resolve)))
    const second = trackWrite(() => new Promise<void>((resolve) => (finishSecond = resolve)))
    expect(writesInFlight.value).toBe(2)
    finishFirst()
    await first
    expect(writesInFlight.value).toBe(1)
    finishSecond()
    await second
    expect(writesInFlight.value).toBe(0)
  })

  it('counts a failed write down and passes its failure on', async () => {
    await expect(trackWrite(() => Promise.reject(new Error('refused')))).rejects.toThrow('refused')
    expect(writesInFlight.value).toBe(0)
  })

  it('counts a save that waits its turn, from the tap to the end', async () => {
    let upload: () => void = () => {}
    const uploading = new Promise<void>((resolve) => (upload = resolve))
    const first = trackWrite(() => uploading)
    const waitingTurn = trackWrite(() => first)
    expect(writesInFlight.value).toBe(2)
    upload()
    await waitingTurn
    expect(writesInFlight.value).toBe(0)
  })

  it('returns what the write returns', async () => {
    await expect(trackWrite(() => Promise.resolve('receipt'))).resolves.toBe('receipt')
  })

  const components = globSync('src/**/*.vue', { cwd: root })

  it.each(components)('%s disables no control on a busy flag without a loading state beside it', (file) => {
    expect(disabledWithoutLoading(readFileSync(join(root, file), 'utf8'))).toEqual([])
  })

  it.each(components.filter((file) => !CHANGES_NOTHING_ON_FILE.includes(file)))('%s spins every switch or select that saves on change', (file) => {
    expect(savesOnChangeWithoutLoading(readFileSync(join(root, file), 'utf8'))).toEqual([])
  })
})
