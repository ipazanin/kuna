import type { Category, CategoryKind, FixedKind } from '../../workbook/domain/category'
import { CATEGORY_RECORDS } from '../../workbook/domain/spendingKinds'
import { newRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { Language } from '../../../../shared/text/language'

/** A name in both languages, English first. */
type Named = readonly [en: string, hr: string]

interface StarterGroup {
  readonly name: Named
  readonly kind: CategoryKind
  readonly children: readonly Named[]
}

const BANK_FEES: Named = ['Bank fees', 'Bankovne naknade']

const STARTER_GROUPS: readonly StarterGroup[] = [
  {
    name: ['Food', 'Hrana'],
    kind: 'spending',
    children: [
      ['Groceries', 'Namirnice'],
      ['Restaurants', 'Restorani'],
      ['Coffee', 'Kava'],
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
      ['Internet and phone', 'Internet i telefon'],
      ['Maintenance', 'Održavanje'],
      ['Household goods', 'Kućanske potrepštine'],
    ],
  },
  {
    name: ['Transport', 'Prijevoz'],
    kind: 'spending',
    children: [
      ['Fuel', 'Gorivo'],
      ['Parking and tolls', 'Parking i cestarine'],
      ['Public transport and taxi', 'Javni prijevoz i taksi'],
      ['Car service', 'Servis auta'],
      ['Car insurance and registration', 'Osiguranje i registracija auta'],
    ],
  },
  {
    name: ['Boat', 'Brod'],
    kind: 'spending',
    children: [
      ['Berth', 'Vez'],
      ['Fuel', 'Gorivo'],
      ['Service and gear', 'Servis i oprema'],
      ['Insurance and registration', 'Osiguranje i registracija broda'],
    ],
  },
  {
    name: ['Health', 'Zdravlje'],
    kind: 'spending',
    children: [
      ['Supplementary insurance', 'Dopunsko osiguranje'],
      ['Pharmacy', 'Ljekarna'],
      ['Doctor and dentist', 'Liječnik i stomatolog'],
    ],
  },
  {
    name: ['Personal', 'Osobno'],
    kind: 'spending',
    children: [
      ['Clothes and shoes', 'Odjeća i obuća'],
      ['Care and hairdresser', 'Njega i frizer'],
      ['Electronics', 'Elektronika'],
    ],
  },
  {
    name: ['Leisure', 'Slobodno vrijeme'],
    kind: 'spending',
    children: [
      ['Sport', 'Sport'],
      ['Hobbies', 'Hobiji'],
      ['Going out and culture', 'Izlasci i kultura'],
      ['Subscriptions', 'Pretplate'],
    ],
  },
  {
    name: ['Travel', 'Putovanja'],
    kind: 'spending',
    children: [
      ['Accommodation', 'Smještaj'],
      ['Tickets', 'Karte'],
      ['On the trip', 'Na putu'],
    ],
  },
  {
    name: ['Family and gifts', 'Obitelj i pokloni'],
    kind: 'spending',
    children: [
      ['Gifts', 'Pokloni'],
      ['Donations', 'Donacije'],
      ['Pets', 'Ljubimci'],
    ],
  },
  {
    name: ['Money and fees', 'Novac i naknade'],
    kind: 'spending',
    children: [BANK_FEES, ['Taxes and charges', 'Porezi i pristojbe'], ['Insurance', 'Osiguranja'], ['Loan interest', 'Kamate na kredit']],
  },
  { name: ['Other', 'Ostalo'], kind: 'spending', children: [['Other', 'Ostalo']] },
  {
    name: ['Income', 'Prihodi'],
    kind: 'income',
    children: [
      ['Salary', 'Plaća'],
      ['Profit payout', 'Isplata dobiti'],
      ['Interest', 'Kamate'],
      ['Other income', 'Ostali prihodi'],
    ],
  },
  { name: ['Between my accounts', 'Između mojih računa'], kind: 'transfer', children: [] },
  { name: ['Saved to investments', 'Prijenos u ulaganja'], kind: 'saving', children: [] },
  { name: ['For the company', 'Za tvrtku'], kind: 'company', children: [] },
  { name: ['Loan principal', 'Glavnica kredita'], kind: 'repayment', children: [] },
]

/** The starter category a statement's fee goes in, by its name in either language, or undefined once it was renamed or deleted. */
export function bankFeesCategory(categories: readonly Category[]): Category | undefined {
  return categories.find((category) => category.kind === 'spending' && BANK_FEES.includes(category.name))
}

/**
 * The categories a new Spending file starts with, named in the first run's language: eleven spending groups with their
 * children, Income, and the four fixed categories. Every one can be renamed, moved, hidden or deleted later, but the
 * fixed four, which can only be renamed. `newKey` makes each category's bare UUID.
 */
export function starterCategories(language: Language, newKey: () => string = newRecordId): Category[] {
  return STARTER_GROUPS.flatMap((group, groupPlace) => {
    const parent = groupCategory(group, groupPlace, language, newKey)
    return [
      parent,
      ...group.children.map((child, childPlace): Category => ({
        id: recordIdOf(CATEGORY_RECORDS, newKey()),
        name: nameIn(language, child),
        kind: group.kind,
        parent: parent.id,
        order: childPlace + 1,
        colour: '',
        hidden: false,
      })),
    ]
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
  return { id: recordIdOf(CATEGORY_RECORDS, newKey()), name: nameIn(language, group.name), kind: group.kind, parent: null, order: groupPlace + 1, colour: '', hidden: false }
}
