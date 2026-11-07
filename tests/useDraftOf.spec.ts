import { nextTick, ref } from 'vue'
import { describe, expect, it } from 'vitest'

import { useDraftOf } from '../src/shared/ui/useDraftOf'

interface Settings {
  readonly reviewLabel: string
}

describe('a form on a page, such as Settings, General', () => {
  it('keeps what is being typed when another write lands and leaves the saved values alone', async () => {
    const saved = ref<Settings>({ reviewLabel: 'ivan' })
    const draft = useDraftOf(() => saved.value)

    draft.value = { reviewLabel: 'typed' }
    saved.value = { reviewLabel: 'ivan' }
    await nextTick()

    expect(draft.value).toEqual({ reviewLabel: 'typed' })
  })

  it('takes the saved values when they differ, as after its own Save or a sync', async () => {
    const saved = ref<Settings>({ reviewLabel: 'ivan' })
    const draft = useDraftOf(() => saved.value)

    draft.value = { reviewLabel: 'typed' }
    saved.value = { reviewLabel: 'someone else' }
    await nextTick()

    expect(draft.value).toEqual({ reviewLabel: 'someone else' })
  })
})
