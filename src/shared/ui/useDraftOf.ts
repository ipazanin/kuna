import { ref, watch } from 'vue'
import type { Ref } from 'vue'

/** A form's draft of saved values. It resets when the saved values differ, not on a new object holding the same ones, which any write landing elsewhere makes, so what is being typed survives. */
export function useDraftOf<Saved>(saved: () => Saved): Ref<Saved> {
  const draft = ref(saved()) as Ref<Saved>
  watch(saved, (now, before) => {
    if (JSON.stringify(now) !== JSON.stringify(before)) draft.value = now
  })
  return draft
}
