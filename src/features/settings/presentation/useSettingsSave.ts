import { computed } from 'vue'
import type { ComputedRef, Ref } from 'vue'

import { installedPack } from '../../packs/packContribution'
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
  /** Writes what Settings, General changed, core's keys and the pack's facts. */
  saveGeneral(next: Settings, nextFacts: unknown): Promise<void>
}

/**
 * Writes the settings a form changed, core's keys and then the pack's. Only the keys that changed
 * are written, each checked against the value the app read for it, and a toast says how it went.
 */
export function useSettingsSave(): SettingsSave {
  const { state } = useWorkbook()
  const writes = useRecordWrites()
  const settings = computed(() => state.workbook?.settings ?? DEFAULT_SETTINGS)
  const facts = computed(() => installedPack().companyFacts?.factsOf(state.workbook) ?? null)
  const held = computed(() => state.records?.settings ?? NO_RECORDS)

  async function write(changes: readonly SettingEntry[]): Promise<void> {
    await writes.write('Settings saved', (unit) => setSettings(unit, held.value, changes), { failedTitle: 'Not saved' })
  }

  return {
    settings,
    facts,
    saving: writes.busy,
    async save(next) {
      await write(changedSettings(settings.value, next))
    },
    async saveGeneral(next, nextFacts) {
      const packSettings = installedPack().workbook?.settings ?? null
      const packChanges = packSettings === null ? [] : changedPackSettings(packSettings, facts.value, nextFacts)
      await write([...changedSettings(settings.value, next), ...packChanges])
    },
  }
}
