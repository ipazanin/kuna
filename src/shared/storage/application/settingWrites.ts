import type { UnitOfWork } from './repository'
import type { RecordKind } from '../domain/recordKind'
import { readSettingRows, settingRow } from '../domain/settingRows'
import type { SettingChecks, SettingRow } from '../domain/settingRows'
import type { WriteRules } from '../domain/writeRules'
import { words } from '../domain/words'

/** How an app's settings are written. They read nothing else and keep Undo. A retired key's row is kept as it is. */
export function settingWrites(kind: RecordKind<SettingRow>, checks: SettingChecks, retired: ReadonlySet<string>): WriteRules<SettingRow> {
  return {
    kind,
    reads: [],
    undoable: true,
    read: (read) => readSettingRows(read, checks, retired, words.settingUnknown),
    refusals: () => [],
  }
}

/** The key holds this value, or no row at all for a blank one. `rows` are the rows as stored, so a value the reader refused is changed or cleared too. */
export function setSetting(unit: UnitOfWork, writes: WriteRules<SettingRow>, rows: readonly SettingRow[], key: string, value: string): void {
  const held = rows.find((row) => row.key === key)
  const settings = unit.of(writes)
  if (held === undefined) {
    if (value !== '') settings.add(settingRow(writes.kind, key, value))
  } else if (value === '') {
    settings.remove(held)
  } else if (held.value !== value) {
    settings.change(held, settingRow(writes.kind, key, value))
  }
}
