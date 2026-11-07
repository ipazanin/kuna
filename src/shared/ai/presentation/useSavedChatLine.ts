import { computed, ref } from 'vue'

import { readSavedChat } from '../application/savedChat'

/** The Assistant card's line about the chat kept in this browser. It shows whenever a chat is saved, with or without a key, and stays to say it was cleared. */
export function useSavedChatLine() {
  const saved = ref(false)
  const cleared = ref(false)
  void readSavedChat().then((chat) => {
    saved.value = chat !== null
  })

  /** Through the chat's own code, loaded only now, so the first load holds none of it. */
  async function clear(): Promise<void> {
    const { clearChat } = await import('./chatSession')
    clearChat()
    saved.value = false
    cleared.value = true
  }

  return { shown: computed(() => saved.value || cleared.value), cleared, clear }
}
