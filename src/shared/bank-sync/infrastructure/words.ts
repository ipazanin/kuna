import { language } from '../../text/language'
import type { Translation } from '../../text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence.

export const en = {
  didNotAnswer: (reason: string) => `The bank sync script did not answer: ${reason}`,
}

export const hr: Translation<typeof en> = {
  didNotAnswer: (reason) => `Skripta za sinkronizaciju s bankom nije odgovorila: ${reason}`,
}

export const words = language === 'hr' ? hr : en
