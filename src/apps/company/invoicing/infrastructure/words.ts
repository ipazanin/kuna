import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.

export const en = {
  fontFailed: (url: string, status: number) => `The invoice font ${url} did not load: ${status}.`,
}

export const hr: Translation<typeof en> = {
  fontFailed: (url, status) => `Font računa ${url} nije se učitao: ${status}.`,
}

export const words = language === 'hr' ? hr : en
