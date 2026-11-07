import { ref } from 'vue'

/** Where a person's files live: on Google Drive in the one Kuna folder, or in this browser. */
export type FilesHome = 'drive' | 'browser'

/** The answer to the home welcome's one question. Like the other set-up answers it stays on this device, and a lost answer only asks once more. */
export interface KunaStart {
  /** The ids of the apps the person said they will use. An app left out still works and waits under the others. */
  readonly apps: readonly string[]
  readonly home: FilesHome
}

const STORAGE_KEY = 'kuna.start'

function stored(): KunaStart | null {
  try {
    const candidate: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    if (typeof candidate !== 'object' || candidate === null) return null
    const { apps, home } = candidate as Record<string, unknown>
    if ((home !== 'drive' && home !== 'browser') || !Array.isArray(apps)) return null
    return { home, apps: apps.filter((app): app is string => typeof app === 'string') }
  } catch {
    return null
  }
}

const answer = ref<KunaStart | null>(stored())

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === null || event.key === STORAGE_KEY) answer.value = stored()
  })
}

/** The person's answer on this device, reactively, or null before they gave one. */
export function kunaStart(): KunaStart | null {
  return answer.value
}

export function answerKunaStart(start: KunaStart): void {
  answer.value = start
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(start))
  } catch {
    // Storage denied: the answer still holds for this visit.
  }
}

/** Takes the answer back, so the next app set up on this device asks again. */
export function forgetKunaStart(): void {
  answer.value = null
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage denied: only this visit held the answer.
  }
}

/** The answer a first run gives for one app, added to what the person already said. Someone with a file open came to change that one file, which says nothing about the next. */
export function answerFromFirstRun(home: FilesHome, app: string, fileOpen: boolean): void {
  if (fileOpen) return
  answerKunaStart({ home, apps: [...new Set([...(answer.value?.apps ?? []), app])] })
}
