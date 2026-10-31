import { language } from './language'
import type { Translation } from './translation'

export const en = {
  /** Where a Drive path starts, as a trail of folders and a message about a folder missing there name it. */
  myDrive: 'My Drive',
}

export const hr: Translation<typeof en> = {
  myDrive: 'Moj disk',
}

export const words = language === 'hr' ? hr : en
