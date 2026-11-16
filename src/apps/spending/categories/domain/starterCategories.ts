import { categoryWithRole } from '../../workbook/domain/category'
import type { Category, CategoryKind, CategoryRole, FixedKind } from '../../workbook/domain/category'
import { CATEGORY_RECORDS } from '../../workbook/domain/spendingKinds'
import { newRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { Language } from '../../../../shared/text/language'

/** A name in both languages, English first. */
type Named = readonly [en: string, hr: string]

/** A starter category, with the role Kuna finds it by when it fills it. */
type StarterChild = Named | { readonly name: Named; readonly role: CategoryRole }

interface StarterGroup {
  readonly name: Named
  readonly kind: CategoryKind
  readonly children: readonly StarterChild[]
}

const LOAN_INTEREST: Named = ['Loan interest', 'Kamate na kredit']

const MONEY_AND_FEES: StarterGroup = {
  name: ['Money and fees', 'Novac i naknade'],
  kind: 'spending',
  children: [
    { name: ['Bank fees', 'Bankovne naknade'], role: 'bank-fees' },
    ['Taxes and charges', 'Porezi i pristojbe'],
    ['Other insurance', 'Ostala osiguranja'],
    { name: LOAN_INTEREST, role: 'loan-interest' },
  ],
}

const STARTER_GROUPS: readonly StarterGroup[] = [
  {
    name: ['Food', 'Hrana'],
    kind: 'spending',
    children: [
      ['Groceries', 'Namirnice'],
      ['Eating out', 'Restorani i kafići'],
      ['Delivery', 'Dostava'],
    ],
  },
  {
    name: ['Home', 'Dom'],
    kind: 'spending',
    children: [
      ['Rent', 'Najam'],
      ['Utilities', 'Režije'],
      ['Building reserve', 'Pričuva'],
      ['Internet, phone and TV', 'Internet, telefon i TV'],
      ['Repairs and maintenance', 'Popravci i održavanje'],
      ['Furniture and household goods', 'Namještaj i kućanske potrepštine'],
    ],
  },
  {
    name: ['Transport', 'Prijevoz'],
    kind: 'spending',
    children: [
      ['Fuel', 'Gorivo'],
      ['Parking and tolls', 'Parking i cestarine'],
      ['Public transport and taxi', 'Javni prijevoz i taksi'],
      ['Car service and repairs', 'Servis i popravci auta'],
      ['Car registration and insurance', 'Registracija i osiguranje auta'],
    ],
  },
  {
    name: ['Health', 'Zdravlje'],
    kind: 'spending',
    children: [
      ['Supplementary insurance', 'Dopunsko osiguranje'],
      ['Pharmacy', 'Ljekarna'],
      ['Doctors and dentist', 'Liječnici i stomatolog'],
    ],
  },
  {
    name: ['Personal', 'Osobno'],
    kind: 'spending',
    children: [
      ['Clothes and shoes', 'Odjeća i obuća'],
      ['Care and hairdresser', 'Njega i frizer'],
      ['Electronics and devices', 'Elektronika i uređaji'],
    ],
  },
  {
    name: ['Children and education', 'Djeca i obrazovanje'],
    kind: 'spending',
    children: [
      ['Kindergarten and school', 'Vrtić i škola'],
      ["Children's activities", 'Aktivnosti djece'],
      ['Courses and books', 'Tečajevi i knjige'],
    ],
  },
  {
    name: ['Leisure', 'Slobodno vrijeme'],
    kind: 'spending',
    children: [
      ['Sport and fitness', 'Sport i rekreacija'],
      ['Hobbies', 'Hobiji'],
      ['Going out and culture', 'Izlasci i kultura'],
      ['Streaming and apps', 'Streaming i aplikacije'],
    ],
  },
  {
    name: ['Travel', 'Putovanja'],
    kind: 'spending',
    children: [
      ['Accommodation', 'Smještaj'],
      ['Travel tickets and car hire', 'Karte i najam auta'],
      ['Trip activities', 'Izleti i aktivnosti'],
    ],
  },
  {
    name: ['Family and gifts', 'Obitelj i pokloni'],
    kind: 'spending',
    children: [
      ['Gifts', 'Pokloni'],
      ['Help for family', 'Pomoć obitelji'],
      ['Pets', 'Ljubimci'],
      ['Donations', 'Donacije'],
    ],
  },
  MONEY_AND_FEES,
  { name: ['Other', 'Ostalo'], kind: 'spending', children: [['Other', 'Ostalo']] },
  {
    name: ['Income', 'Prihodi'],
    kind: 'income',
    children: [
      ['Salary', 'Plaća'],
      ['Pension', 'Mirovina'],
      ['Benefits', 'Naknade i potpore'],
      ['Rental income', 'Prihod od najma'],
      ['Profit payout', 'Isplata dobiti'],
      ['Interest', 'Kamate'],
      ['Other income', 'Ostali prihodi'],
    ],
  },
  { name: ['Between my accounts', 'Između mojih računa'], kind: 'transfer', children: [] },
  { name: ['Saved to investments', 'Prijenos u ulaganja'], kind: 'saving', children: [] },
  { name: ['For the company', 'Za tvrtku'], kind: 'company', children: [] },
  { name: ['Loan principal', 'Glavnica kredita'], kind: 'repayment', children: [] },
  { name: ['Loans to and from people', 'Posudbe'], kind: 'informal-loan', children: [] },
]

/**
 * The file's Loan interest, or a new one named in the language beside the file's Bank fees, or under a new Money and fees
 * when the file has no Bank fees. Says which categories are new, so the write that needs them adds them.
 */
export function loanInterestCategoryIn(categories: readonly Category[], language: Language, newKey: () => string = newRecordId): { readonly category: Category; readonly added: readonly Category[] } {
  const held = categoryWithRole(categories, 'loan-interest')
  if (held !== undefined) return { category: held, added: [] }
  const heldGroup = categories.find((category) => category.id === categoryWithRole(categories, 'bank-fees')?.parent)
  const group = heldGroup ?? groupCategory(MONEY_AND_FEES, STARTER_GROUPS.indexOf(MONEY_AND_FEES), language, newKey)
  const order = Math.max(0, ...categories.filter((category) => category.parent === group.id).map((category) => category.order)) + 1
  const child = childCategory({ name: LOAN_INTEREST, role: 'loan-interest' }, group, order, language, newKey)
  return { category: child, added: heldGroup === undefined ? [group, child] : [child] }
}

/**
 * The categories a new Spending file starts with, named in the first run's language: eleven spending groups with their
 * children, Income, and the five fixed categories. Every one can be renamed, moved, hidden or deleted later, but the
 * fixed five, which can only be renamed. `newKey` makes each category's bare UUID.
 */
export function starterCategories(language: Language, newKey: () => string = newRecordId): Category[] {
  return STARTER_GROUPS.flatMap((group, groupPlace) => {
    const parent = groupCategory(group, groupPlace, language, newKey)
    return [parent, ...group.children.map((child, childPlace) => childCategory(child, parent, childPlace + 1, language, newKey))]
  })
}

/**
 * The file's fixed category of the kind, or a new one as a new file has it, named in the language, for a file made before
 * that kind was. Says whether it is new, so the write that needs it adds it.
 */
export function fixedCategoryIn(categories: readonly Category[], kind: FixedKind, language: Language, newKey: () => string = newRecordId): { readonly category: Category; readonly added: boolean } {
  const held = categories.find((category) => category.kind === kind)
  if (held !== undefined) return { category: held, added: false }
  const groupPlace = STARTER_GROUPS.findIndex((group) => group.kind === kind)
  return { category: groupCategory(STARTER_GROUPS[groupPlace]!, groupPlace, language, newKey), added: true }
}

function nameIn(language: Language, [en, hr]: Named): string {
  return language === 'hr' ? hr : en
}

function groupCategory(group: StarterGroup, groupPlace: number, language: Language, newKey: () => string): Category {
  return { id: recordIdOf(CATEGORY_RECORDS, newKey()), name: nameIn(language, group.name), kind: group.kind, parent: null, order: groupPlace + 1, colour: '', hidden: false, role: null }
}

function childCategory(child: StarterChild, group: Category, order: number, language: Language, newKey: () => string): Category {
  const { name, role } = 'role' in child ? child : { name: child, role: null }
  return { id: recordIdOf(CATEGORY_RECORDS, newKey()), name: nameIn(language, name), kind: group.kind, parent: group.id, order, colour: '', hidden: false, role }
}
