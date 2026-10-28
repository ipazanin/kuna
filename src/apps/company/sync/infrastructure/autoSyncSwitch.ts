import { readonly, ref } from 'vue'

const AUTO_SYNC_KEY = 'ledgerboard.auto-sync'

function storedSwitch(): string | null {
  try {
    return localStorage.getItem(AUTO_SYNC_KEY)
  } catch {
    return null
  }
}

const switchedOn = ref(storedSwitch() !== 'off')

/** Whether this device syncs by itself as the app opens and when the tab is shown again. On unless switched off here. */
export const autoSyncOn = readonly(switchedOn)

/** Switches auto-sync on this device. Off is remembered, and on forgets the choice. */
export function switchAutoSync(on: boolean): void {
  try {
    if (on) {
      localStorage.removeItem(AUTO_SYNC_KEY)
    } else {
      localStorage.setItem(AUTO_SYNC_KEY, 'off')
    }
  } catch {
    // Storage denied: the switch still holds for this visit.
  }
  switchedOn.value = on
}
