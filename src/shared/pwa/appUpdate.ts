import { readonly, ref } from 'vue'
import type { Ref } from 'vue'

const updateReady = ref(false)
let registration: ServiceWorkerRegistration | null = null
let reloadOnActivation = false

/**
 * Registers the service worker that keeps the app shell offline, and watches for a newer deploy.
 * A new release downloads into its own cache and waits there until the user reloads from the
 * prompt, so an open page is never swapped under the reader. Returns the function that stops it.
 */
export function startServiceWorker(): () => void {
  if (!window.isSecureContext || !('serviceWorker' in navigator)) {
    return () => {}
  }
  const workers = navigator.serviceWorker
  // The first install also changes the controller, from none to the worker. That is not an update.
  let controlled = workers.controller !== null
  const observed = new Set<ServiceWorker>()

  const report = (): void => {
    if (registration === null) return
    if (registration.waiting !== null && workers.controller !== null) {
      updateReady.value = true
    }
    const installing = registration.installing
    if (installing !== null && !observed.has(installing)) {
      observed.add(installing)
      installing.addEventListener('statechange', report)
    }
  }
  const onControllerChange = (): void => {
    if (reloadOnActivation) {
      window.location.reload()
      return
    }
    // Another window applied the update. This one still runs the old release, whose lazy screens are gone.
    if (controlled) {
      updateReady.value = true
    }
    controlled = true
  }
  const checkForUpdate = (): void => {
    if (document.visibilityState === 'visible' && navigator.onLine) {
      void registration?.update().catch(() => undefined)
    }
  }

  workers.addEventListener('controllerchange', onControllerChange)
  document.addEventListener('visibilitychange', checkForUpdate)
  workers
    .register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL, updateViaCache: 'none' })
    .then((registered) => {
      registration = registered
      registered.addEventListener('updatefound', report)
      report()
    })
    .catch(() => {
      // No offline copy, as in a private window that refuses storage. The app still works online.
    })

  return () => {
    workers.removeEventListener('controllerchange', onControllerChange)
    document.removeEventListener('visibilitychange', checkForUpdate)
    registration?.removeEventListener('updatefound', report)
    for (const worker of observed) worker.removeEventListener('statechange', report)
  }
}

export interface AppUpdate {
  /** A newer deploy is downloaded, or another window already switched to it. */
  readonly updateReady: Readonly<Ref<boolean>>
  /** Switches to the newer deploy and reloads this window. */
  applyUpdate(): void
}

export function useAppUpdate(): AppUpdate {
  return {
    updateReady: readonly(updateReady),
    applyUpdate() {
      const waiting = registration?.waiting ?? null
      if (waiting === null) {
        window.location.reload()
        return
      }
      reloadOnActivation = true
      waiting.postMessage({ type: 'activate-update' })
    },
  }
}
