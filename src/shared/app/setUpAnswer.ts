import { ref } from 'vue'

const KEY_PREFIX = 'kuna.set-up-answer.'

/** What this visit kept, since storage can be denied in a private window. */
const kept = ref<ReadonlySet<string>>(new Set())

function storageKeyOf(fileId: string, answer: string): string {
  return `${KEY_PREFIX}${fileId}.${answer}`
}

/** Whether someone answered this about the file on this device. An answer is kept here and not in the file, so a person's file stays as it is, and a lost answer only asks once more. */
export function hasSetUpAnswer(fileId: string, answer: string): boolean {
  const key = storageKeyOf(fileId, answer)
  if (kept.value.has(key)) return true
  try {
    return localStorage.getItem(key) !== null
  } catch {
    return false
  }
}

/** Takes the answer back, so the question is asked again. */
export function forgetSetUpAnswer(fileId: string, answer: string): void {
  const key = storageKeyOf(fileId, answer)
  try {
    localStorage.removeItem(key)
  } catch {
    // Storage denied: only this visit held the answer.
  }
  kept.value = new Set([...kept.value].filter((held) => held !== key))
}

export function keepSetUpAnswer(fileId: string, answer: string): void {
  const key = storageKeyOf(fileId, answer)
  try {
    localStorage.setItem(key, 'yes')
  } catch {
    // Storage denied: the answer still holds for this visit.
  }
  kept.value = new Set([...kept.value, key])
}
