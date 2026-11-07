// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { computed } from 'vue'

import { hasSetUpAnswer, keepSetUpAnswer } from '../src/shared/app/setUpAnswer'

const KEY = 'kuna.set-up-answer.file-1.delivery'

describe('a set-up answer given in another tab', () => {
  it('shows here once the other tab keeps it, and goes once it takes it back', () => {
    const answered = computed(() => hasSetUpAnswer('file-1', 'delivery'))
    expect(answered.value).toBe(false)

    localStorage.setItem(KEY, 'yes')
    window.dispatchEvent(new StorageEvent('storage', { key: KEY, newValue: 'yes', storageArea: localStorage }))
    expect(answered.value).toBe(true)

    keepSetUpAnswer('file-1', 'delivery')
    localStorage.removeItem(KEY)
    window.dispatchEvent(new StorageEvent('storage', { key: KEY, newValue: null, storageArea: localStorage }))
    expect(answered.value).toBe(false)
  })
})
