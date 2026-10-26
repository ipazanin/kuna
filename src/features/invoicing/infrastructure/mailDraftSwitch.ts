import { readonly, ref } from 'vue'

const DRAFT_PREFERENCE_KEY = 'ledgerboard.invoice-mail-draft'

function storedSwitch(): boolean {
  try {
    return localStorage.getItem(DRAFT_PREFERENCE_KEY) === 'true'
  } catch {
    return false
  }
}

const switchedOn = ref(storedSwitch())

/** Whether an invoice made on this device saves a Gmail draft, which puts Gmail in the page's token. Off unless switched on here. */
export const mailDraftsOn = readonly(switchedOn)

export function switchMailDrafts(on: boolean): void {
  try {
    localStorage.setItem(DRAFT_PREFERENCE_KEY, String(on))
  } catch {
    // Not remembered on this device, so the switch starts off next time.
  }
  switchedOn.value = on
}
