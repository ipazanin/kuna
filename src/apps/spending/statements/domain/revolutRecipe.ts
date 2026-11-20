import type { StatementRecipe } from './recipeStatement'
import { REVOLUT_BANK } from '../../accounts/domain/accountDraft'
import type { RecipeFields, RowTest } from '../../../../shared/recipes/domain/recipe'

const STARTED_FORMATS = ['yyyy-MM-dd HH:mm:ss', 'yyyy-MM-dd HH:mm', 'yyyy-MM-ddTHH:mm:ss', 'yyyy-MM-ddTHH:mm', 'yyyy-MM-dd']

const COMPLETED: RowTest = { column: 'State', is: ['COMPLETED'], anyCase: true }
const PENDING: RowTest = { column: 'State', is: ['PENDING'], anyCase: true }
const ON_A_PRODUCT_KUNA_READS: RowTest = { column: 'Product', is: ['Current', 'Savings'], anyCase: true }

/** What a row that comes in names, whether it completed or the bank still holds it as pending. */
const ROW_FIELDS: RecipeFields = {
  started: { from: 'Started Date', as: 'date', formats: STARTED_FORMATS },
  startedTime: { from: 'Started Date', as: 'time', formats: STARTED_FORMATS },
  amount: { from: 'Amount', as: 'decimal' },
  fee: { from: 'Fee', as: 'decimal', blank: true },
  currency: { from: 'Currency', as: 'text' },
  description: { from: 'Description', as: 'text', blank: true },
  product: { from: 'Product', as: 'text' },
}

/** A completed row also names when it completed and the balance after it, for the balance check. */
const COMPLETED_FIELDS: RecipeFields = {
  ...ROW_FIELDS,
  completed: { from: 'Completed Date', as: 'date', formats: STARTED_FORMATS, blank: true },
  completedTime: { from: 'Completed Date', as: 'time', formats: STARTED_FORMATS, blank: true },
  balance: { from: 'Balance', as: 'decimal', blank: true },
}

/**
 * Revolut's export, as a csv or an xlsx, with the columns the open-source parsers name, since Revolut publishes no
 * definition. Rows of the current account and of savings come in, completed or pending. A row of another product, such as a
 * deposit, is counted, and so is a reverted or declined one. The first kind whose tests a row passes takes it, so a pending
 * exchange or cash withdrawal comes in as a plain pending row until it completes.
 */
export const REVOLUT_STATEMENT: StatementRecipe = {
  bank: REVOLUT_BANK,
  currency: null,
  recipe: {
    id: 'revolut-export',
    name: 'Revolut',
    file: { format: 'table' },
    sections: [
      {
        name: 'Revolut',
        rows: '',
        keep: [],
        shown: [],
        fields: {},
        kinds: [
          { kind: 'pending', when: [PENDING, ON_A_PRODUCT_KUNA_READS], fields: ROW_FIELDS },
          { kind: 'exchange', when: [COMPLETED, ON_A_PRODUCT_KUNA_READS, { column: 'Type', is: ['EXCHANGE'], anyCase: true }], fields: COMPLETED_FIELDS },
          { kind: 'cash-withdrawal', when: [COMPLETED, { column: 'Product', is: ['Current'], anyCase: true }, { column: 'Type', is: ['ATM'], anyCase: true }], fields: COMPLETED_FIELDS },
          { kind: 'payment', when: [COMPLETED, ON_A_PRODUCT_KUNA_READS], fields: COMPLETED_FIELDS },
          { kind: 'other-product', when: [{ column: 'State', is: ['COMPLETED', 'PENDING'], anyCase: true }], fields: { product: { from: 'Product', as: 'text', blank: true } } },
          { kind: 'not-completed', when: [], fields: {} },
        ],
      },
    ],
  },
}
