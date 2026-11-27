import { ref } from 'vue'
import { describe, expect, it } from 'vitest'

import { useRowKeys } from '../src/shared/ui/useRowKeys'

interface Line {
  readonly text: string
}

describe("a list of a draft's lines that have no id, such as a client's invoice lines", () => {
  it('keeps a line its key when it moves', () => {
    const first = { text: 'Hours' }
    const second = { text: 'Travel' }
    const lines = ref<Line[]>([first, second])
    const keys = useRowKeys(() => lines.value)
    const [firstKey, secondKey] = keys.value

    lines.value = [second, first]

    expect(keys.value).toEqual([secondKey, firstKey])
  })

  it('keeps an edited line the key of its place, so typing in it keeps the field', () => {
    const lines = ref<Line[]>([{ text: 'Hours' }, { text: 'Travel' }])
    const keys = useRowKeys(() => lines.value)
    const before = keys.value

    lines.value = [lines.value[0]!, { text: 'Travel and stay' }]

    expect(keys.value).toEqual(before)
  })

  it('gives an added line a key no other line has, and a removed line takes its key with it', () => {
    const first = { text: 'Hours' }
    const second = { text: 'Travel' }
    const lines = ref<Line[]>([first, second])
    const keys = useRowKeys(() => lines.value)
    const [, secondKey] = keys.value

    lines.value = [second, { text: 'Materials' }]

    expect(keys.value[0]).toBe(secondKey)
    expect(new Set(keys.value).size).toBe(2)
  })
})
