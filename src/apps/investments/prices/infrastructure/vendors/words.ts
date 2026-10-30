import { language } from '../../../../../shared/text/language'
import type { Translation } from '../../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. The app is Ulaganja.

export const en = {
  twelveData: { name: 'Twelve Data', covers: 'US shares and ETFs' },
  alphaVantage: { name: 'Alpha Vantage', covers: 'Xetra, Amsterdam and other European listings' },
  ecb: { name: 'European Central Bank', covers: 'Euro exchange rates' },
}

export const hr: Translation<typeof en> = {
  twelveData: { name: 'Twelve Data', covers: 'Američke dionice i ETF-ovi' },
  alphaVantage: { name: 'Alpha Vantage', covers: 'Xetra, Amsterdam i druge europske burze' },
  ecb: { name: 'Europska središnja banka', covers: 'Tečajevi eura' },
}

export const words = language === 'hr' ? hr : en
