import { computed, ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import { useToast } from '@nuxt/ui/composables/useToast'

import { useWorkbook } from '../../workbook/application/workbookStore'
import type { SheetRow } from '../../workbook/infrastructure/workbookSnapshot'
import { DEFAULT_SETTINGS, changedSettings } from '../domain/settings'
import type { Settings } from '../domain/settings'

export interface SettingsSave {
  /** The settings as the workbook holds them. */
  readonly settings: ComputedRef<Settings>
  readonly saving: Readonly<Ref<boolean>>
  save(next: Settings): Promise<void>
}

/**
 * Writes the settings a form changed. Only the keys that changed are written, each checked against
 * the value the app read for it, and a toast says how it went.
 */
export function useSettingsSave(): SettingsSave {
  const store = useWorkbook()
  const { state } = store
  const toast = useToast()
  const saving = ref(false)
  const settings = computed(() => state.workbook?.settings ?? DEFAULT_SETTINGS)

  async function save(next: Settings): Promise<void> {
    const rows = state.snapshot?.settings ?? []
    const changes = changedSettings(settings.value, next).map(({ key, value }) => {
      const row = rows.find((candidate: SheetRow) => String(candidate.cells.key ?? '').trim().toLowerCase() === key)
      return { key, value, expected: row === undefined ? null : (row.cells.value ?? '') }
    })
    saving.value = true
    try {
      await store.changeSettings(changes)
      const google = (state.choice?.source ?? state.workbook?.source) === 'google'
      toast.add({ title: 'Settings saved', ...(google ? { description: 'Written to the settings tab of the Sheet.' } : {}), icon: 'i-lucide-check', color: 'success' })
    } catch (failure) {
      toast.add({ title: 'Not saved', description: failure instanceof Error ? failure.message : String(failure), icon: 'i-lucide-triangle-alert', color: 'error', duration: 10_000 })
    } finally {
      saving.value = false
    }
  }

  return { settings, saving, save }
}
