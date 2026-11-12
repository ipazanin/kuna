import { ref } from 'vue'

import { deviceText, keptKeys, onChoiceKeptElsewhere } from '../device/deviceChoice'

const KEY_PREFIX = 'kuna.set-up-answer.'

/** What this visit kept, since storage can be denied in a private window. */
const kept = ref<ReadonlySet<string>>(new Set())

// A fresh set makes every reader look at the storage again, which now holds what the other tab did.
onChoiceKeptElsewhere((key) => {
  if (key === null) kept.value = new Set()
  else if (key.startsWith(KEY_PREFIX)) kept.value = new Set([...kept.value].filter((held) => held !== key))
})

function storageKeyOf(fileId: string, answer: string): string {
  return `${KEY_PREFIX}${fileId}.${answer}`
}

/** Whether someone answered this about the file on this device. An answer is kept here and not in the file, so a person's file stays as it is, and a lost answer only asks once more. */
export function hasSetUpAnswer(fileId: string, answer: string): boolean {
  const key = storageKeyOf(fileId, answer)
  return kept.value.has(key) || deviceText(key).read() !== null
}

/** Takes the answer back, so the question is asked again. */
export function forgetSetUpAnswer(fileId: string, answer: string): void {
  const key = storageKeyOf(fileId, answer)
  deviceText(key).remember(null)
  kept.value = new Set([...kept.value].filter((held) => held !== key))
}

/** Takes back every answer about the file, once this device no longer has it. */
export function forgetSetUpAnswersOf(fileId: string): void {
  const prefix = storageKeyOf(fileId, '')
  keptKeys(prefix).forEach((key) => deviceText(key).remember(null))
  kept.value = new Set([...kept.value].filter((held) => !held.startsWith(prefix)))
}

export function keepSetUpAnswer(fileId: string, answer: string): void {
  const key = storageKeyOf(fileId, answer)
  deviceText(key).remember('yes')
  kept.value = new Set([...kept.value, key])
}
