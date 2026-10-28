import { installPack } from '../../src/apps/company/packs/packContribution.ts'
import { installPackTabs } from '../../src/apps/company/workbook/infrastructure/packTabs.ts'
import { hrDooPack } from '../../src/apps/company/packs/hr-doo/hrDooPack.ts'
import { HR_DOO_TABS } from '../../src/apps/company/packs/hr-doo/infrastructure/hrDooTabs.ts'

/** Installs the pack and its tabs as main.ts does, so a script reads and writes the pack's tabs like the app. */
export function installHrDooPack() {
  installPack(hrDooPack)
  installPackTabs(HR_DOO_TABS)
}
