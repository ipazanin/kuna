import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence.

export const en = {
  moveStaysWhole: 'A move between your accounts stays whole, so it joins no shared cost.',
}

export const hr: Translation<typeof en> = {
  moveStaysWhole: 'Prijenos između vaših računa ostaje cijeli, pa ne ulazi u zajednički trošak.',
}

export const words = language === 'hr' ? hr : en
