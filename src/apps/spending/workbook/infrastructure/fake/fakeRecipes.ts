import { RECIPE_RECORDS } from '../../domain/spendingKinds'
import type { SavedRecipe } from '../../../../../shared/recipes/domain/savedRecipe'
import { EURO } from '../../../../../shared/money/currencyCode'
import { recordIdOf } from '../../../../../shared/storage/domain/recordId'

const ID = recordIdOf(RECIPE_RECORDS, '5e000000-0000-4000-8000-000000001901')

/** A made-up bank's export saved as a recipe: a day, an amount with a decimal comma and a text, every row in euros. */
export function fakeRecipes(): readonly SavedRecipe[] {
  return [
    {
      id: ID,
      bank: 'Primjer banka',
      currency: EURO,
      recipe: {
        id: ID,
        name: 'Promet Primjer banke',
        file: { format: 'table' },
        sections: [
          {
            name: 'Promet',
            rows: '',
            keep: [],
            shown: ['Datum', 'Opis'],
            fields: {
              started: { from: 'Datum', as: 'date', formats: ['dd.MM.yyyy'] },
              amount: { from: 'Iznos', as: 'decimal', mark: 'comma' },
              description: { from: 'Opis', as: 'text', blank: true },
            },
            kinds: [{ kind: 'payment', when: [], fields: {} }],
          },
        ],
      },
    },
  ]
}
