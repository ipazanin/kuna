import { watch } from 'vue'
import type { Ref } from 'vue'

/**
 * Keeps the line being typed in view while the prompt grows. Nuxt UI's auto-resize sets the field back to one row on every
 * change, and Firefox drops the scroll on that shrink without scrolling back to the caret.
 */
export function useCaretInView(field: () => HTMLTextAreaElement | null | undefined, draft: Ref<string>): void {
  let scrolled = 0
  watch(
    draft,
    () => {
      scrolled = field()?.scrollTop ?? 0
    },
    { flush: 'sync' },
  )
  watch(draft, () => {
    requestAnimationFrame(() => {
      const prompt = field()
      if (prompt === null || prompt === undefined) return
      prompt.scrollTop = prompt.selectionEnd === prompt.value.length ? prompt.scrollHeight : scrolled
    })
  })
}
