import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.

export const en = {
  exportToExcel: 'Export to Excel',
}

export const hr: Translation<typeof en> = {
  exportToExcel: 'Izvezi u Excel',
}

export const words = language === 'hr' ? hr : en
