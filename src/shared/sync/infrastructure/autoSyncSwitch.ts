import { readonly, ref } from 'vue'

import { deviceChoice } from '../../device/deviceChoice'

const kept = deviceChoice('kuna.auto-sync', true, { read: (stored) => (stored === 'off' ? false : null), write: () => 'off' })

const switchedOn = ref(kept.read())

/** Whether this device syncs by itself as the app opens and when the tab is shown again. On unless switched off here. */
export const autoSyncOn = readonly(switchedOn)

/** Switches auto-sync on this device. Off is remembered, and on forgets the choice. */
export function switchAutoSync(on: boolean): void {
  kept.remember(on)
  switchedOn.value = on
}
