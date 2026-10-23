import { installPack } from '../../src/features/packs/packContribution'
import { installPackTabs } from '../../src/features/workbook/infrastructure/packTabs'
import { hrDooPack } from '../../src/packs/hr-doo/hrDooPack'
import { HR_DOO_TABS } from '../../src/packs/hr-doo/infrastructure/hrDooTabs'

// The app installs the pack before anything reads it, so every spec starts with it installed too.
installPack(hrDooPack)
installPackTabs(HR_DOO_TABS)
