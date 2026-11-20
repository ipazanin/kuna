import { language } from '../../text/language'
import type { Translation } from '../../text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Mail is pošta and one mail poruka.

export const en = {
  rateLimited: 'Gmail asked us to slow down. Sync again in a minute.',
}

export const hr: Translation<typeof en> = {
  rateLimited: 'Gmail je zatražio da usporimo. Sinkronizirajte ponovno za minutu.',
}

export const words = language === 'hr' ? hr : en
