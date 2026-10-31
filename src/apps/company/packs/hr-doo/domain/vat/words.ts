import { language } from '../../../../../../shared/text/language'
import type { Translation } from '../../../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// Input VAT is pretporez and the reverse charge prijenos porezne obveze, as the VAT act names them.

export const en = {
  /** The labels of a payment split into its cost and its input VAT. */
  split: {
    paid: 'Amount paid',
    none: 'No VAT in the amount',
    reverseCharge: 'Reverse charge: no VAT in the amount, and the VAT on the return cancels out',
    foreignVat: 'Foreign VAT, not deductible in Croatia, stays in the cost',
    representation: 'Representation: its VAT is not deductible and stays in the cost',
    deductible: (rate: string) => `Input VAT at ${rate}, deductible`,
    inside: (rate: string) => `VAT at ${rate} inside the amount`,
    car: (share: string) => `Input VAT on a personal car, ${share} deductible`,
    noInputVat: 'No deductible input VAT',
    cost: 'Cost without the deductible VAT',
  },
}

export const hr: Translation<typeof en> = {
  split: {
    paid: 'Plaćeni iznos',
    none: 'U iznosu nema PDV-a',
    reverseCharge: 'Prijenos porezne obveze: u iznosu nema PDV-a, a PDV u prijavi se poništava',
    foreignVat: 'Strani PDV, koji se u Hrvatskoj ne odbija, ostaje u trošku',
    representation: 'Reprezentacija: njezin se PDV ne odbija i ostaje u trošku',
    deductible: (rate) => `Pretporez po stopi ${rate}, odbitni`,
    inside: (rate) => `PDV po stopi ${rate} sadržan u iznosu`,
    car: (share) => `Pretporez na osobni automobil, ${share} odbitno`,
    noInputVat: 'Nema odbitnog pretporeza',
    cost: 'Trošak bez odbitnog PDV-a',
  },
}

export const words = language === 'hr' ? hr : en
