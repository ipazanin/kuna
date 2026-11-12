import { globSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from '@vue/compiler-sfc'
import type { ElementNode, RootNode, TemplateChildNode } from '@vue/compiler-dom'
import { ref, shallowReactive } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import type { WorkbookStore, BooksRead } from '../src/shared/storage/application/createWorkbookStore'
import { WorkbookWriteRefused } from '../src/shared/storage/application/workbookWriteRefused'
import type { WriteOptions } from '../src/shared/storage/application/writeQueue'
import { trackWrite, writesInFlight } from '../src/shared/storage/application/writesInFlight'
import { GoogleApiError, GoogleTimedOut } from '../src/shared/google/googleApi'
import { words } from '../src/shared/storage/presentation/words'
import { useRecordWrites } from '../src/shared/storage/presentation/useRecordWrites'

interface ToastShown {
  readonly id?: string
  readonly title?: string
  readonly description?: string
  readonly orientation?: string
  readonly actions?: readonly { readonly label?: string; readonly onClick?: () => void }[]
}

const toasts = ref<ToastShown[]>([])

vi.mock('@nuxt/ui/composables/useToast', () => ({
  useToast: () => ({
    toasts,
    add(shown: ToastShown) {
      toasts.value = [...toasts.value.filter((held) => held.id === undefined || held.id !== shown.id), shown]
    },
  }),
}))

/** A store whose writes wait in `waiting` until the test lets each go, as the real queue holds them. */
function queueingStore() {
  const state = shallowReactive<{ waiting: readonly { readonly keys: readonly string[] }[]; writes: readonly never[] }>({ waiting: [], writes: [] })
  const landings: (() => void)[] = []
  const store = {
    state,
    write: (_title: string, _work: unknown, options?: WriteOptions) =>
      new Promise<null>((resolve) => {
        const queued = { keys: options?.key === undefined ? [] : [options.key] }
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
  it('spins the control of a write while an Undo of it waits, under either key', () => {
    const { store } = queueingStore()
    const writes = useRecordWrites(store)
    ;(store.state as { waiting: unknown }).waiting = [{ keys: ['undo-3', 'loan-bucket'] }]

    expect([writes.saving('loan-bucket'), writes.saving('undo-3'), writes.saving('other')]).toEqual([true, true, false])
  })

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

describe('what a toast says of a write', () => {
  /** A store whose next write records a receipt with this shape, or fails with this. */
  function storeThat(outcome: { readonly shownAtOnce: boolean } | { readonly fails: unknown }) {
    const receipt = { title: 'Switched off', records: [] }
    const state = shallowReactive<{ waiting: readonly never[]; writes: readonly unknown[] }>({ waiting: [], writes: [] })
    return {
      state,
      write: async () => {
        if ('fails' in outcome) throw outcome.fails
        state.writes = [{ receipt, undid: null, id: 1, keys: [], shownAtOnce: outcome.shownAtOnce }]
        return receipt
      },
      undo: async () => {},
    } as unknown as Pick<WorkbookStore<BooksRead>, 'state' | 'write' | 'undo'>
  }

  it('keeps a write shown at once to one row, with no line under the title', async () => {
    toasts.value = []
    await useRecordWrites(storeThat({ shownAtOnce: true })).write('Switched off', () => {}, { shownAtOnce: true })

    expect(toasts.value[0]).toMatchObject({ title: 'Switched off', orientation: 'horizontal' })
    expect(toasts.value[0]).not.toHaveProperty('description')
  })

  it('names the write that failed and puts a Drive failure in one plain sentence', async () => {
    toasts.value = []
    const failure = new GoogleApiError('https://www.googleapis.com/upload/drive/v3/files/x', 500, 'Backend Error')
    await useRecordWrites(storeThat({ fails: failure })).write('Switched off', () => {})

    expect(toasts.value[0]?.description).toBe(`Switched off: ${words.driveFailed}`)
  })

  it('puts a browser network failure in the same sentence, and several in one toast', async () => {
    toasts.value = []
    const failure = new TypeError('NetworkError when attempting to fetch resource.')
    await useRecordWrites(storeThat({ fails: failure })).write('First', () => {})
    await useRecordWrites(storeThat({ fails: failure })).write('Second', () => {})

    expect(toasts.value).toHaveLength(1)
    expect(toasts.value[0]?.description).toBe(`First, Second: ${words.driveFailed}`)
  })

  it('says a Drive request that gave up waiting in the same sentence, with Try again that asks for each named write again in order', async () => {
    toasts.value = []
    const asked: string[] = []
    const store = {
      state: shallowReactive({ waiting: [], writes: [] }),
      write: async (title: string) => {
        asked.push(title)
        throw new GoogleTimedOut()
      },
      undo: async () => {},
    } as unknown as Pick<WorkbookStore<BooksRead>, 'state' | 'write' | 'undo'>
    const writes = useRecordWrites(store)
    await writes.write('First', () => {})
    await writes.write('Second', () => {})

    expect(toasts.value).toHaveLength(1)
    expect(toasts.value[0]?.description).toBe(`First, Second: ${words.driveFailed}`)
    const tryAgain = toasts.value[0]?.actions?.find((action) => action.label === words.tryAgain)
    expect(tryAgain).toBeDefined()

    toasts.value = []
    tryAgain?.onClick?.()
    await vi.waitFor(() => expect(asked).toEqual(['First', 'Second', 'First', 'Second']))
    // Both failed again, and the new toast names each once, not with the two before.
    await vi.waitFor(() => expect(toasts.value[0]?.description).toBe(`First, Second: ${words.driveFailed}`))
  })

  it('gives the reason of a refusal under its title alone, so the title of a write that did not happen never leads it', async () => {
    toasts.value = []
    await useRecordWrites(storeThat({ fails: new WorkbookWriteRefused('Nothing was written. It changed.') })).write('Account added', () => {}, { failedTitle: 'Not added' })

    expect(toasts.value[0]).toMatchObject({ title: 'Not added', description: 'Nothing was written. It changed.' })
  })

  it('names the write when a save may not have finished, since its reason alone does not say which', async () => {
    toasts.value = []
    await useRecordWrites(storeThat({ fails: new Error('Failed to fetch') })).write('Account added', () => {}, { failedTitle: 'Not added' })

    expect(toasts.value[0]).toMatchObject({ title: words.mayNotHaveFinished, description: 'Account added: Failed to fetch' })
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
