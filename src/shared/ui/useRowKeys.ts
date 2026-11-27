import { computed, toRaw } from 'vue'
import type { ComputedRef } from 'vue'

/**
 * A key for each row of a list whose rows have no id, such as a draft's lines. A row keeps its key when it moves, since a move
 * keeps the row's object, and an edited row, which is a new object at the same place, keeps the key of the place. So a list keyed
 * by these keeps each row's elements, and the focus in them, through a move.
 */
export function useRowKeys(rows: () => readonly object[]): ComputedRef<readonly number[]> {
  let held: { readonly rows: readonly object[]; readonly keys: readonly number[] } = { rows: [], keys: [] }
  let unused = 0
  return computed(() => {
    const now = rows().map((row) => toRaw(row))
    const kept = now.map((row) => {
      const at = held.rows.indexOf(row)
      return at === -1 ? undefined : held.keys[at]
    })
    const taken = new Set(kept.filter((key) => key !== undefined))
    const keys = kept.map((key, place) => {
      if (key !== undefined) return key
      const ofPlace = held.keys[place]
      if (ofPlace !== undefined && !taken.has(ofPlace)) {
        taken.add(ofPlace)
        return ofPlace
      }
      unused += 1
      return unused
    })
    held = { rows: now, keys }
    return keys
  })
}
