import { language } from '../../../../../shared/text/language'
import type { Translation } from '../../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence.

export const en = {
  title: 'Read a receipt',
  sends: 'the whole photo of the receipt, which can show a masked card number, a loyalty card and the shop, your categories, and earlier lines at the same shop',
}

export const hr: Translation<typeof en> = {
  title: 'Pročitaj fiskalni račun',
  sends: 'cijela fotografija fiskalnog računa, na kojoj se može vidjeti maskirani broj kartice, kartica vjernosti i trgovina, vaše kategorije te ranije stavke iz iste trgovine',
}

export const words = language === 'hr' ? hr : en
