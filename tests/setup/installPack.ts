import { installPack } from '../../src/features/packs/packContribution'
import { hrDooPack } from '../../src/packs/hr-doo/hrDooPack'

// The app installs the pack before anything reads it, so every spec starts with it installed too.
installPack(hrDooPack)
