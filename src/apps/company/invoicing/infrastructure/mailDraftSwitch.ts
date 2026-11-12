import { readonly, ref } from 'vue'

import { deviceChoice } from '../../../../shared/device/deviceChoice'

const kept = deviceChoice('kuna.invoice-mail-draft', false, { read: (stored) => (stored === 'true' ? true : null), write: () => 'true' })

const switchedOn = ref(kept.read())

/** Whether an invoice made on this device saves a Gmail draft, which puts Gmail in the page's token. Off unless switched on here. */
export const mailDraftsOn = readonly(switchedOn)

/** Switches drafts on this device. On is remembered, and off forgets the choice. */
export function switchMailDrafts(on: boolean): void {
  kept.remember(on)
  switchedOn.value = on
}
