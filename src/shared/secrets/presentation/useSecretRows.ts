import { reactive } from 'vue'

/** Where the secrets are kept: this browser's storage, which keeps a trimmed key and forgets on null, noting when. */
export interface SecretStore {
  read(id: string): string | null
  write(id: string, key: string | null): void
}

/** What a row of a keys card is about: a price vendor or an AI provider, and whether it takes a key. */
export interface SecretOwner {
  readonly id: string
  readonly needsKey: boolean
}

/** How a kept key shows: never whole, and only a long one with its last four characters, which a person can match against the vendor's page. */
export function keyEnding(key: string): string | null {
  return key.length >= 12 ? key.slice(-4) : null
}

/** What one row shows of its key: whether one is kept and how it ends, and the last Test. */
export interface SecretRow<Test> {
  readonly kept: boolean
  readonly ending: string | null
  readonly test: Test | 'testing' | null
}

export interface SecretRows<Owner extends SecretOwner, Test> {
  readonly rows: Readonly<Record<string, SecretRow<Test>>>
  /** Keeps the typed key, with the Test it already passed if any, and returns what puts back the key before it, or null with no key to keep. */
  save(id: string, typed: string, test?: Test): (() => void) | null
  /** Forgets the key, and returns what puts it back. */
  forget(id: string): () => void
  /** Reads every row's key again, as after a sync took the keys another browser saved. A row keeps its last Test only while its key still ends the same. */
  reread(): void
  /** One cheap request with the key kept for the owner, or with none for one that needs none. */
  test(owner: Owner): Promise<void>
}

/** The key rows of a keys card. A key goes into the store only through `save` and is never read back whole onto the screen. */
export function useSecretRows<Owner extends SecretOwner, Test>(owners: readonly Owner[], store: SecretStore, request: (owner: Owner, key: string | null) => Promise<Test>): SecretRows<Owner, Test> {
  const rowOf = (id: string, test: SecretRow<Test>['test'] = null): SecretRow<Test> => {
    const key = store.read(id)
    return { kept: key !== null, ending: key === null ? null : keyEnding(key), test }
  }
  const rows = reactive<Record<string, SecretRow<Test>>>(Object.fromEntries(owners.map((owner) => [owner.id, rowOf(owner.id)])))

  /** Writes the key, and returns what puts back the one before it, which does nothing once the key changed again. */
  const write = (id: string, key: string | null, test: Test | null = null): (() => void) => {
    const before = store.read(id)
    store.write(id, key)
    const written = store.read(id)
    rows[id] = rowOf(id, test)
    return () => {
      if (store.read(id) !== written) return
      store.write(id, before)
      rows[id] = rowOf(id)
    }
  }

  return {
    rows,
    save(id, typed, test) {
      return typed.trim() === '' ? null : write(id, typed, test ?? null)
    },
    forget(id) {
      return write(id, null)
    },
    reread() {
      for (const owner of owners) {
        const before = rows[owner.id]!
        const after = rowOf(owner.id)
        rows[owner.id] = after.kept === before.kept && after.ending === before.ending ? { ...after, test: before.test } : after
      }
    },
    async test(owner) {
      rows[owner.id] = { ...rows[owner.id]!, test: 'testing' }
      const key = owner.needsKey ? store.read(owner.id) : null
      const result = await request(owner, key)
      // A key changed meanwhile is not the key this result is about.
      rows[owner.id] = rowOf(owner.id, !owner.needsKey || store.read(owner.id) === key ? result : null)
    },
  }
}
