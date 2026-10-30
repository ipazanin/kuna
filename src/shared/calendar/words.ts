import { language } from '../text/language'
import type { Translation } from '../text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.

export const en = {
  syncAge: {
    justNow: 'just now',
    minutesAgo: (minutes: number) => `${minutes} min ago`,
    hoursAgo: (hours: number) => `${hours} h ago`,
    yesterday: 'yesterday',
    on: (day: string) => `on ${day}`,
  },
}

export const hr: Translation<typeof en> = {
  syncAge: {
    justNow: 'upravo',
    minutesAgo: (minutes) => `prije ${minutes} min`,
    hoursAgo: (hours) => `prije ${hours} h`,
    yesterday: 'jučer',
    on: (day) => day,
  },
}

export const words = language === 'hr' ? hr : en
