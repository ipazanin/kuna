// Paying the state: the revenue codes and model of a payment to the state budget, from the yearly Naputak.

import { day, text } from '../schema'
import type { OpenItem, RuleIn, TextTerm } from '../schema'

export interface StatePaymentValues {
  'hr.state.revenue-codes': {
    /** The model the reference of a payment to the state budget starts with. */
    readonly model: TextTerm
    readonly vatCode: TextTerm
    readonly profitTaxCode: TextTerm
    /** Pension insurance, pillar I, on a salary. */
    readonly pensionPillarOneCode: TextTerm
  }
}

const NAPUTAK_2026_URL = 'https://narodne-novine.nn.hr/clanci/sluzbeni/2026_02_18_197.html'

export const statePaymentRules: readonly RuleIn<StatePaymentValues>[] = [
  {
    id: 'hr.state.revenue-codes',
    area: 'state-payments',
    title: 'Revenue codes of payments to the state budget',
    appliesBy: 'payment-date',
    versions: [
      {
        validFrom: day('2026-01-01'),
        validTo: null,
        value: { model: text('HR68'), vatCode: text('1201'), profitTaxCode: text('1651'), pensionPillarOneCode: text('8168') },
        sources: [
          {
            act: 'Naputak2026',
            nn: ['18/26'],
            article: 'II 1.1.2, 1.11 and 1.2.1',
            url: NAPUTAK_2026_URL,
            loadedOn: day('2026-11-04'),
            quote: '1201 Porez na dodanu vrijednost; 1651 Porez na dobit; 8168 Doprinos za mirovinsko osiguranje na temelju generacijske solidarnosti temeljem radnog odnosa',
          },
        ],
        confidence: 'confirmed-nn',
        note: 'The part of the Naputak read names 1651 for profit tax and no separate code for the monthly advance. The amendment in NN 39/26 was not loaded.',
      },
    ],
  },
]

export const statePaymentOpenItems: readonly OpenItem[] = [
  {
    id: 'hr.state.naputak-amendment',
    area: 'state-payments',
    title: 'Amendment of the 2026 Naputak in NN 39/26',
    status: 'unconfirmed',
    note: 'The amendment was seen in a search result and not loaded. It may change a revenue code. Loading NN 39/26 and comparing its codes with this rule settles it.',
    url: 'https://narodne-novine.nn.hr/clanci/sluzbeni/2026_04_39_470.html',
  },
  {
    id: 'hr.state.advance-code',
    area: 'state-payments',
    title: 'Revenue code of the monthly profit tax advance',
    status: 'unconfirmed',
    note: 'The part of NN 18/26 read names 1651 for "porez na dobit" and no separate code for the monthly advance. Reading the rest of the Naputak settles whether an advance is paid under 1651.',
    url: NAPUTAK_2026_URL,
  },
]
