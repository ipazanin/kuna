import { computed } from 'vue'
import type { ComputedRef, Ref } from 'vue'

import { installedPack } from '../../packs/packContribution'
import { useSync } from '../../sync/presentation/useSync'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { NO_RECORDS } from '../../workbook/domain/recordsRead'
import { useRecordWrites } from '../../workbook/presentation/useRecordWrites'
import { setSettings } from '../application/settingWrites'
import { DEFAULT_SETTINGS, changedPackSettings, changedSettings } from '../domain/settings'
import type { SettingEntry, Settings } from '../domain/settings'

export interface SettingsSave {
  /** The settings as the workbook holds them. */
  readonly settings: ComputedRef<Settings>
  /** The installed pack's facts as the workbook holds them, or null without a pack that keeps any. */
  readonly facts: ComputedRef<unknown>
  readonly saving: Readonly<Ref<boolean>>
  /** Writes the settings a form changed. */
  save(next: Settings): Promise<void>
  /**
   * Writes what Settings, General changed, core's keys and the pack's facts. A change that switches
   * on a step needing more Google access asks for it in the same tap and syncs. Call it from a click handler.
   */
  saveGeneral(next: Settings, nextFacts: unknown): Promise<void>
}

/**
 * Writes the settings a form changed, core's keys and then the pack's. Only the keys that changed
 * are written, each checked against the value the app read for it, and a toast says how it went.
 */
export function useSettingsSave(): SettingsSave {
  const { state } = useWorkbook()
  const writes = useRecordWrites()
  const sync = useSync()
  const settings = computed(() => state.workbook?.settings ?? DEFAULT_SETTINGS)
  const facts = computed(() => installedPack().companyFacts?.factsOf(state.workbook) ?? null)
  const held = computed(() => state.records?.settings ?? NO_RECORDS)

  function write(changes: readonly SettingEntry[]): Promise<boolean> {
    return writes.write('Settings saved', (unit) => setSettings(unit, held.value, changes), { failedTitle: 'Not saved' })
  }

  return {
    settings,
    facts,
    saving: writes.busy,
    async save(next) {
      await write(changedSettings(settings.value, next))
    },
    async saveGeneral(next, nextFacts) {
      const pack = installedPack()
      const packChanges = pack.workbook === null ? [] : changedPackSettings(pack.workbook.settings, facts.value, nextFacts)
      const changes = [...changedSettings(settings.value, next), ...packChanges]
      const workbook = state.workbook
      if (workbook === null) {
        await write(changes)
        return
      }
      const saved = { ...workbook, settings: next }
      await sync.saveAllowing(pack.companyFacts?.withFacts(saved, nextFacts) ?? saved, () => write(changes))
    },
  }
}
