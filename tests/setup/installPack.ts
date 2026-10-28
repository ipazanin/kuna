import { installPack } from '../../src/apps/company/packs/packContribution'
import { installPackTabs } from '../../src/apps/company/workbook/infrastructure/packTabs'
import { hrDooPack } from '../../src/apps/company/packs/hr-doo/hrDooPack'
import { HR_DOO_TABS } from '../../src/apps/company/packs/hr-doo/infrastructure/hrDooTabs'

// The app installs the pack before anything reads it, so every spec starts with it installed too.
installPack(hrDooPack)
installPackTabs(HR_DOO_TABS)
