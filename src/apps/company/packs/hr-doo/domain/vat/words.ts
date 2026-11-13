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
    carOnlyPrivate: 'A personal car used only privately: its VAT is not deductible and stays in the cost',
    carKept: 'The part of the VAT on a personal car that is not deductible',
    noneKept: 'No VAT taken out of the amount stays in the cost',
    privateShare: (share: string) => `The part of the VAT on the owner's private share, ${share}, not deductible`,
    businessShare: (rate: string) => `Input VAT at ${rate} on the business share, deductible`,
    selfCharged: (rate: string) => `VAT at ${rate} the reverse charge self-charges on the amount`,
    owedOnPrivateShare: 'VAT on the private share, which no input VAT offsets and which is owed to the state',
    costWithOwed: 'Cost with the VAT on the private share',
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
    carOnlyPrivate: 'Osobni automobil samo za privatne potrebe: njegov se PDV ne odbija i ostaje u trošku',
    carKept: 'Dio PDV-a na osobni automobil koji se ne odbija',
    noneKept: 'U trošku ne ostaje PDV izdvojen iz iznosa',
    privateShare: (share) => `Dio PDV-a na privatni udio vlasnika, ${share}, nije odbitan`,
    businessShare: (rate) => `Pretporez po stopi ${rate} na poslovni udio, odbitni`,
    selfCharged: (rate) => `PDV po stopi ${rate} obračunan na iznos prijenosom porezne obveze`,
    owedOnPrivateShare: 'PDV na privatni udio koji se ne prebija s pretporezom i duguje se državi',
    costWithOwed: 'Trošak s PDV-om na privatni udio',
    noInputVat: 'Nema odbitnog pretporeza',
    cost: 'Trošak bez odbitnog PDV-a',
  },
}

export const words = language === 'hr' ? hr : en
