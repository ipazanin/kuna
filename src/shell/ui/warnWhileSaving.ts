import { watch } from 'vue'

import { writesInFlight } from '../../shared/storage/application/writesInFlight'

function warnOfWaitingSave(event: BeforeUnloadEvent): void {
  event.preventDefault()
  // Browsers before Chrome 119 and Safari 11 look only at this.
  event.returnValue = true
}

/** Makes closing the tab bring up the browser's own warning, and only while a save waits or runs, since a page that always listens can lose the back/forward cache. Gives what stops it. */
export function warnWhileSaving(): () => void {
  const stopWatching = watch(
    () => writesInFlight.value > 0,
    (saving) => {
      if (saving) {
        window.addEventListener('beforeunload', warnOfWaitingSave)
      } else {
        window.removeEventListener('beforeunload', warnOfWaitingSave)
      }
    },
    { immediate: true, flush: 'sync' },
  )
  return () => {
    stopWatching()
    window.removeEventListener('beforeunload', warnOfWaitingSave)
  }
}
