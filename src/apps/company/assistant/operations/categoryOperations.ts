import { categoryOf, fieldsOf, madeOrRefused, textOrKept } from './companyCard'
import type { CompanyCard, CompanyOperationSet } from './companyCard'
import { fillShares } from '../../owner-share/application/ownerShareWrites'
import { shareFillsOf } from '../../owner-share/domain/ownerShare'
import { installedPack } from '../../packs/packContribution'
import { writeDrafts } from '../../workbook/application/draftWrites'
import { CATEGORY_WRITES, categoryKeptAfterMove, categoryUses, deleteCategoryInto, joinedInWords, keptInWords } from '../../categories/application/categoryWrites'
import { addStartingCategory } from '../../categories/application/startingCategoryWrites'
import { rolesBesideClass } from '../../categories/domain/categoryClasses'
import { categoriesOfDrafts, categoryDraftErrors, categoryDraftsOf, rolesOfText } from '../../categories/domain/categoryDrafts'
import type { CategoryDraft } from '../../categories/domain/categoryDrafts'
import { knownRoles } from '../../categories/domain/categoryGuards'
import { BUCKETS } from '../../workbook/domain/bucket'
import { displayNamesOf } from '../../workbook/domain/displayName'
import { newestBookingOf } from '../../workbook/domain/workbook'
import type { CategoryClass } from '../../workbook/domain/packPart'
import { CATEGORY_RECORDS } from '../../workbook/domain/coreKinds'
import { recordsOfKindIn } from '../../workbook/domain/readWorkbook'
import type { RecordsOfKind } from '../../workbook/domain/readWorkbook'
import { VAT_TREATMENTS } from '../../workbook/domain/vatTreatment'
import type { AssistantOperation, ProposalStep } from '../../../../shared/app/assistantOperations'
import type { StrictSchema } from '../../../../shared/ai/domain/strictSchema'
import { FLAG_OR_NULL, TEXT, TEXT_OR_NULL, inputOf } from '../../../../shared/app/operationInput'
import { StepRefused } from '../../../../shared/app/proposedWrites'
import { SWATCHES } from '../../../../shared/charts/swatches'
import { today } from '../../../../shared/calendar/civilDate'
import { recordsOf, storedOf } from '../../../../shared/storage/domain/recordsRead'
import type { StoredRecord } from '../../../../shared/storage/domain/recordsRead'

const CATEGORY = CATEGORY_RECORDS.name

const SHARE_OR_NULL = { type: ['string', 'null'], description: 'A whole number from 0 to 100, "" for none, or null to leave it.' } as const
const COLOUR_OR_NULL: StrictSchema = {
  type: ['string', 'null'],
  description: `A swatch by its code, ${SWATCHES.map((swatch) => `${swatch.hex} ${swatch.name}`).join(', ')}, an own colour as #rrggbb that keeps 3:1 in the light theme, or "" for its bucket's colour, or null to leave it.`,
}
const COLOUR_OR_BUCKET: StrictSchema = {
  ...COLOUR_OR_NULL,
  description: `A swatch by its code, ${SWATCHES.map((swatch) => `${swatch.hex} ${swatch.name}`).join(', ')}, an own colour as #rrggbb that keeps 3:1 in the light theme, or null for its bucket's colour.`,
}
const BUCKET: StrictSchema = { type: 'string', enum: [...BUCKETS] }
const BUCKET_OR_NULL: StrictSchema = { type: ['string', 'null'], enum: [...BUCKETS, null], description: 'Null leaves it.' }
const VAT: StrictSchema = { type: 'string', enum: [...VAT_TREATMENTS, ''], description: '"" for none.' }
const VAT_OR_NULL: StrictSchema = { type: ['string', 'null'], enum: [...VAT_TREATMENTS, '', null], description: '"" for none, or null to leave it.' }

/** The classes of the installed pack, one of which a category carries among its roles. None means a category needs no class. */
function packClasses(): readonly CategoryClass[] {
  return installedPack().workbook?.categoryClasses ?? []
}

/** The roles a category may carry beside its class: core's and the installed pack's that carry no class. */
function otherRoles(classes: readonly CategoryClass[]): readonly string[] {
  return rolesBesideClass(knownRoles(installedPack().workbook?.categoryRoles ?? []), classes)
}

/** Each class by its role, with the name the categories editor gives it and the VAT treatments and buckets it allows. */
function classesInWords(classes: readonly CategoryClass[]): string {
  const on = today()
  return classes
    .map((taxClass) => `${taxClass.role}: ${installedPack().categoryClassHelp(taxClass.role, on)?.name ?? taxClass.role} (VAT ${taxClass.vat.join(' or ')}, bucket ${taxClass.buckets.join(' or ')}).`)
    .join(' ')
}

/** The tax class field, an enum of the pack's classes, each explained as the categories editor names it. None while the pack has no classes. */
function taxClassField(classes: readonly CategoryClass[], keeps: boolean): Readonly<Record<string, StrictSchema>> {
  if (classes.length === 0) return {}
  const roles = classes.map((taxClass) => taxClass.role)
  const about = `How Kuna counts the category for profit tax and VAT, as Sorting, Categories offers it under Tax class. ${classesInWords(classes)}`
  return { taxClass: keeps ? { type: ['string', 'null'], enum: [...roles, null], description: `${about} Null keeps the class it has.` } : { type: 'string', enum: roles, description: about } }
}

/** A class an operating category with no VAT may carry, for the example, or null while the pack has none. */
function exampleClass(classes: readonly CategoryClass[]): string | null {
  return classes.find((taxClass) => taxClass.buckets.includes('operating') && taxClass.vat.includes('none'))?.role ?? null
}

function operationsOf(classes: readonly CategoryClass[]): readonly AssistantOperation[] {
  const exampleTaxClass = exampleClass(classes)
  const others = otherRoles(classes)
  const roles: StrictSchema = { type: 'array', items: { type: 'string', enum: others }, description: 'The roles that carry no tax class, or an empty list for none.' }
  const rolesOrNull: StrictSchema = {
    type: ['string', 'null'],
    description: `The roles that carry no tax class, comma separated, from ${others.join(', ')}. "" for none, or null to leave them.`,
  }
  return [
    {
      name: 'add-category',
      about:
        'A new category as Sorting, Categories adds it: a short name in lower case with hyphens, a family, a bucket, its tax class while the pack has classes, the other roles, VAT, a colour, and an owner share while owner pay is on. The class decides which VAT and buckets fit. It goes one to a card, and a later card files rows into it.',
      input: inputOf({ category: TEXT, label: TEXT, family: TEXT, bucket: BUCKET, ...taxClassField(classes, false), roles, vat: VAT, colour: COLOUR_OR_BUCKET, ownerShare: TEXT }),
      refs: {},
      creates: CATEGORY,
      alone: true,
      example: {
        category: 'software',
        label: 'Software',
        family: 'operating',
        bucket: 'operating',
        ...(exampleTaxClass === null ? {} : { taxClass: exampleTaxClass }),
        roles: [],
        vat: '',
        colour: null,
        ownerShare: '',
      },
    },
    {
      name: 'add-starting-category',
      about:
        'Adds a category new books start with that these books lack, with the starting rules that file into it, as Sorting, Categories to sort offers it. category is its short name as Categories to sort lists it. Each rule takes its place among the starting rules the books hold, or goes ahead of their own rules when they hold none of those.',
      input: inputOf({ category: TEXT }),
      refs: {},
      creates: CATEGORY,
      alone: false,
      example: { category: 'vat' },
    },
    {
      name: 'change-category',
      about: [
        "Changes a category's name on screen, family, bucket, tax class, other roles, VAT, colour or owner share. A category rows name keeps its short name. Null leaves a field as it is.",
        'fillRows yes also gives a new owner share to the rows filed in it that hold none, as the categories tab offers on save.',
        'A change of bucket counts its rows elsewhere, such as owner loans as pay or financing.',
      ].join(' '),
      input: inputOf({
        category: TEXT,
        name: TEXT_OR_NULL,
        label: TEXT_OR_NULL,
        family: TEXT_OR_NULL,
        bucket: BUCKET_OR_NULL,
        ...taxClassField(classes, true),
        roles: rolesOrNull,
        vat: VAT_OR_NULL,
        colour: COLOUR_OR_NULL,
        ownerShare: SHARE_OR_NULL,
        fillRows: FLAG_OR_NULL,
      }),
      refs: { category: CATEGORY },
      creates: null,
      alone: false,
      example: {
        category: 'category',
        name: null,
        label: 'Hardware',
        family: null,
        bucket: null,
        ...(classes.length === 0 ? {} : { taxClass: null }),
        roles: null,
        vat: null,
        colour: SWATCHES[0]!.hex,
        ownerShare: null,
        fillRows: null,
      },
    },
    {
      name: 'delete-category',
      about: [
        'Deletes a category, as Sorting, Categories deletes it.',
        "into is the category its ledger rows, split parts, rules and the pack's records that name it move to in the same change, each row keeping who filed it and taking that category's owner share, or null for a category nothing names.",
        'Those pack records are owner advances, plan rows and year-end konto lines. A plan row joins a row into already has for the same year and month, and the two amounts are added up.',
      ].join(' '),
      input: inputOf({ category: TEXT, into: TEXT_OR_NULL }),
      refs: { category: CATEGORY, into: CATEGORY },
      creates: null,
      alone: false,
      example: { category: 'category', into: 'category-other' },
    },
  ]
}

/** Saves the categories as Sorting, Categories saves its editor's rows, after its checks, with the rows a new default fills. */
function writeCategories(card: CompanyCard, edit: (drafts: readonly CategoryDraft[]) => readonly CategoryDraft[], fillRows: boolean): void {
  const records = card.records()
  const stored: readonly StoredRecord<unknown>[] = storedOf(records.categories)
  const drafts = edit(categoryDraftsOf(stored))
  const used = new Set(categoryUses((kind) => recordsOfKindIn(records, kind)).keys())
  const shares = card.workbook.settings.ownerPayModule
  const errors = categoryDraftErrors(drafts, used, knownRoles(installedPack().workbook?.categoryRoles ?? []), shares)
  const made = madeOrRefused(errors, categoriesOfDrafts(stored, drafts))
  writeDrafts(card.unit.of(CATEGORY_WRITES), storedOf(records.categories), made)
  if (!fillRows) return
  if (!shares) throw new StepRefused('Owner shares fill only while owner pay is on.')
  const fills = shareFillsOf(
    card.workbook,
    made.map((draft) => draft.record),
  )
  if (fills.length === 0) throw new StepRefused('No row filed in it is left without a share, or its share did not change.')
  fillShares(card.unit, card.records(), fills)
}

/** The draft of the category a step names, by its short name. */
function draftAt(drafts: readonly CategoryDraft[], slug: string): number {
  const at = drafts.findIndex((draft) => draft.savedName.trim().toLowerCase() === slug)
  if (at < 0) throw new StepRefused('That category is no longer in the books.')
  return at
}

/** Why a category would not count one way, with every class the pack has, so the next step can name one. */
function noClass(slug: string, classes: readonly CategoryClass[]): StepRefused {
  return new StepRefused(`Pick a tax class for "${slug}" in taxClass, one of these. ${classesInWords(classes)}`)
}

/**
 * A category's roles as the categories editor keeps them: its one class first, then the roles that carry none. A class among
 * the other roles is refused, since taxClass names it. A step that leaves the class as it is keeps the category's own.
 */
function rolesWithClass(slug: string, taxClass: string | null | undefined, roles: readonly string[], kept: readonly string[]): string {
  const classes = packClasses()
  const classRoles = classes.map((candidate) => candidate.role)
  const carried = taxClass === null || taxClass === undefined ? kept.filter((role) => classRoles.includes(role)) : [taxClass]
  if (classes.length > 0 && carried.length === 0) throw noClass(slug, classes)
  return [...carried, ...roles].join(', ')
}

/** The roles a change-category step names beside the class, refused with the roles it may name when one is a class or unknown. */
function stepRoles(text: string): readonly string[] {
  const classes = packClasses()
  const roles = rolesOfText(text)
  const misplaced = roles.filter((role) => classes.some((taxClass) => taxClass.role === role))
  if (misplaced.length > 0) throw new StepRefused(`roles holds ${misplaced.join(', ')}, a tax class. Name it in taxClass and keep roles for the roles that carry no class.`)
  const allowed = otherRoles(classes)
  const unknown = roles.filter((role) => !allowed.includes(role))
  if (unknown.length > 0) throw new StepRefused(`roles holds ${unknown.join(', ')}, which Kuna does not know. It takes ${allowed.join(', ')}, or "" for none.`)
  return roles
}

/** Whether a change-category step sets a field a class constrains, so the category must carry a class after it. */
function classedFieldsTouched(field: Readonly<Record<string, string | null | undefined>>): boolean {
  return ['taxClass', 'roles', 'vat', 'bucket'].some((name) => field[name] !== null && field[name] !== undefined)
}

/** The roles as they were written when the change holds the same ones, so the card shows no change of order. */
function sameRolesKept(before: string, after: string): string {
  const sorted = (text: string) => rolesOfText(text).sort().join(',')
  return sorted(before) === sorted(after) ? before : after
}

function addCategory(card: CompanyCard, step: ProposalStep): void {
  const field = fieldsOf(step)
  const slug = String(field['category']).trim().toLowerCase()
  const added: CategoryDraft = {
    saved: null,
    savedName: '',
    category: slug,
    label: field['label'],
    family: field['family'],
    bucket: field['bucket'],
    colour: (field['colour'] as string | null) ?? '',
    roles: rolesWithClass(slug, field['taxClass'], field['roles'] as readonly string[], []),
    vat: field['vat'],
    ownerShare: field['ownerShare'],
  }
  writeCategories(card, (drafts) => [...drafts, added], false)
  card.made(step.as, slug)
}

function addStartingCategoryStep(card: CompanyCard, step: ProposalStep): void {
  const slug = String(fieldsOf(step)['category']).trim().toLowerCase()
  const { workbook } = card
  const missing = installedPack()
    .missingCategoriesToSort(workbook, newestBookingOf(workbook.transactions) ?? today())
    .flatMap((line) => line.missing ?? [])
    .find((offer) => offer.category.slug === slug)
  if (missing === undefined) throw new StepRefused('Categories to sort offers no starting category of that short name. Read the categories to see which these books hold.')
  addStartingCategory(card.unit, card.records(), workbook.rules, missing)
  card.made(step.as, slug)
}

function changeCategory(card: CompanyCard, step: ProposalStep): void {
  const field = fieldsOf(step)
  const slug = card.idOf(field['category']).toLowerCase()
  writeCategories(
    card,
    (drafts) => {
      const at = draftAt(drafts, slug)
      const before = drafts[at]!
      const keptRoles = rolesOfText(before.roles)
      const classRoles = new Set(packClasses().map((taxClass) => taxClass.role))
      const rolesText: string | null = field['roles']
      const besideClass = rolesText === null ? keptRoles.filter((role) => !classRoles.has(role)) : stepRoles(rolesText)
      const after: CategoryDraft = {
        ...before,
        category: textOrKept(field['name'], before.category),
        label: textOrKept(field['label'], before.label),
        family: textOrKept(field['family'], before.family),
        bucket: textOrKept(field['bucket'], before.bucket),
        roles: classedFieldsTouched(field) ? sameRolesKept(before.roles, rolesWithClass(slug, field['taxClass'], besideClass, keptRoles)) : before.roles,
        vat: textOrKept(field['vat'], before.vat),
        colour: textOrKept(field['colour'], before.colour),
        ownerShare: textOrKept(field['ownerShare'], before.ownerShare),
      }
      return drafts.map((draft, place) => (place === at ? after : draft))
    },
    field['fillRows'] === 'yes',
  )
}

function deleteCategory(card: CompanyCard, step: ProposalStep): void {
  const field = fieldsOf(step)
  const slug = card.idOf(field['category']).toLowerCase()
  const records = card.records()
  const recordsOfKind: RecordsOfKind = (kind) => recordsOfKindIn(records, kind)
  if (field['into'] === null) {
    const uses = categoryUses(recordsOfKind).get(slug)
    if (uses !== undefined) throw new StepRefused(`That category is still named by ${uses.join(', ')}. Give into to move them, or file those elsewhere first.`)
    writeCategories(card, (drafts) => drafts.filter((_, place) => place !== draftAt(drafts, slug)), false)
    return
  }
  const into = categoryOf(card, field['into'])
  if (into.slug === slug) throw new StepRefused('into is another category than the one deleted.')
  const kept = categoryKeptAfterMove(recordsOfKind).get(slug)
  if (kept !== undefined) {
    const said = keptInWords(kept)
    throw new StepRefused(
      `That category is still named by ${said.uses.join(', ')} that Kuna cannot read, so a move cannot change them. Fix those on ${said.places.map((place) => place.label).join(' and ')} first.`,
    )
  }
  const category = recordsOf(records.categories).find((record) => record.slug === slug)
  if (category === undefined) throw new StepRefused('That category is no longer in the books.')
  const move = deleteCategoryInto(card.unit, records, category, into.slug, card.workbook.categories)
  const intoName = displayNamesOf(card.workbook).category(into.slug)
  for (const joined of joinedInWords(move)) card.note({ noun: joined.noun, note: { label: intoName, text: joined.text, tone: 'neutral' } })
}

const PLANS: Readonly<Record<string, (card: CompanyCard, step: ProposalStep) => void>> = {
  'add-category': addCategory,
  'add-starting-category': addStartingCategoryStep,
  'change-category': changeCategory,
  'delete-category': deleteCategory,
}

/** What the chat can do to Company's categories, through Sorting, Categories' own drafts and writes. They follow the installed pack's classes and roles. */
export function categoryOperations(): CompanyOperationSet {
  return {
    operations: operationsOf(packClasses()),
    planStep: (card, step) => PLANS[step.operation]!(card, step),
  }
}
