import { language } from '../../../../../shared/text/language'
import type { Translation } from '../../../../../shared/text/translation'

export const en = {
  automations: {
    accountantMail: {
      title: "Filing the accountant's mail",
      what: "Each sync looks in Gmail for the accountant's payroll, VAT return and invoice mail and files what is new into their folders on Drive. On Settings, turn on each kind under the accountant's mail, with the addresses and the words of its subject.",
    },
  },
}

export const hr: Translation<typeof en> = {
  automations: {
    accountantMail: {
      title: 'Spremanje pošte knjigovođe',
      what: 'Svaka sinkronizacija traži u Gmailu poštu knjigovođe o plaćama, PDV-u i računima i ono što je novo sprema u njihove mape na Driveu. U Postavkama, pod poštom knjigovođe, uključite svaku vrstu s adresama i riječima iz naslova.',
    },
  },
}

export const words = language === 'hr' ? hr : en
