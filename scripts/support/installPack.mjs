import { installPack } from '../../src/features/packs/packContribution.ts'
import { installPackTabs } from '../../src/features/workbook/infrastructure/packTabs.ts'
import { hrDooPack } from '../../src/packs/hr-doo/hrDooPack.ts'
import { HR_DOO_TABS } from '../../src/packs/hr-doo/infrastructure/hrDooTabs.ts'

/** Installs the pack and its tabs as main.ts does, so a script reads and writes the pack's tabs like the app. */
export function installHrDooPack() {
  installPack(hrDooPack)
  installPackTabs(HR_DOO_TABS)
}
