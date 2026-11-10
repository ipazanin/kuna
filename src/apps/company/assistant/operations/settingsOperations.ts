import { categoryOf, fieldsOf } from './companyCard'
import { settingName } from './settingNames'
import type { CompanyCard, CompanyOperationSet } from './companyCard'
import { words } from './words'
import { fillShares } from '../../owner-share/application/ownerShareWrites'
import { shareFillsOf } from '../../owner-share/domain/ownerShare'
import { installedPack } from '../../packs/packContribution'
import { writeDrafts } from '../../settings/application/draftWrites'
import { ACCOUNT_WRITES, CATEGORY_WRITES, accountUses, categoryUses, categoryUsesAfterMove, deleteCategoryInto } from '../../settings/application/namedRecordWrites'
import type { RecordsOfKind } from '../../settings/application/namedRecordWrites'
import { removeSettings, setSettings } from '../../settings/application/settingWrites'
import { accountDraftErrors, accountDraftsOf, accountsOfDrafts } from '../../settings/domain/accountDrafts'
import type { AccountDraft } from '../../settings/domain/accountDrafts'
import { categoriesOfDrafts, categoryDraftErrors, categoryDraftsOf, rolesOfText } from '../../settings/domain/categoryDrafts'
import type { CategoryDraft } from '../../settings/domain/categoryDrafts'
import { knownRoles } from '../../settings/domain/categoryGuards'
import type { MadeDraft } from '../../settings/domain/recordDrafts'
import { PERSON_PAYEES_KEY, SETTING_DEFINITIONS, readSettingsTab, settingsErrors, unreadSettingKeys } from '../../settings/domain/settings'
import { IMPORT_PROFILE_PREFIX } from '../../imports/domain/importProfile'
import { BUCKETS } from '../../workbook/domain/bucket'
import type { CategoryClass } from '../../workbook/domain/packPart'
import { ACCOUNT_RECORDS, CATEGORY_RECORDS, SETTING_RECORDS } from '../../workbook/domain/coreKinds'
import { recordsOfKindIn } from '../../workbook/domain/readWorkbook'
import type { WorkbookRecords } from '../../workbook/domain/readWorkbook'
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
const BILLING_CLIENT_KEY = 'billing_client'
const ACCOUNT = ACCOUNT_RECORDS.name

/**
 * The keys no card sets. Kuna's version marker and the review label are the owner's. The payees flagged as people are the chat's
 * own guard. The invoice folder needs Google's picker. The statements folder and the bank's mail address need Google's consent,
 * so the chat links their screen. The subject of the bank's mail and the day mail is read from need none, so a card sets them.
 */
const NEVER_PROPOSED: ReadonlySet<string> = new Set(['template_version', 'review_label', PERSON_PAYEES_KEY, 'invoice_folder_id', 'statements_folder', 'statements_sync', 'statements_mail_from'])

/** The keys whose value says where money or mail goes, or where an invoice is filed, which a card warns on. */
export const WARNED_SETTING_KEYS: ReadonlySet<string> = new Set([
  'card_settlement_ibans',
  'invoice_iban',
  'invoice_mail',
  'invoice_file_path',
  'invoice_mail_subject',
  'invoice_mail_body',
  'currency',
  'number_locale',
])

/** The keys a card may set: core's and the installed pack's, but never those a person alone sets. */
function proposedKeys(): readonly string[] {
  const packKeys = installedPack().workbook?.settings.definitions.map((definition) => definition.key) ?? []
  return [...SETTING_DEFINITIONS.map((definition) => definition.key), ...packKeys].filter((key) => !NEVER_PROPOSED.has(key))
}

const SHARE_OR_NULL = { type: ['string', 'null'], description: 'A whole number from 0 to 100, "" for none, or null to leave it.' } as const
const COLOUR_OR_NULL: StrictSchema = {
  type: ['string', 'null'],
  description: `A swatch by its code, ${SWATCHES.map((swatch) => `${swatch.hex} ${swatch.name}`).join(', ')}, or "" for its bucket's colour, or null to leave it.`,
}
const COLOUR_OR_BUCKET: StrictSchema = {
  ...COLOUR_OR_NULL,
  description: `A swatch by its code, ${SWATCHES.map((swatch) => `${swatch.hex} ${swatch.name}`).join(', ')}, or null for its bucket's colour.`,
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
  const classRoles = new Set(classes.map((taxClass) => taxClass.role))
  return knownRoles(installedPack().workbook?.categoryRoles ?? []).filter((role) => !classRoles.has(role))
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
  const about = `How Kuna counts the category for profit tax and VAT, as Settings, Categories offers it under Counts as. ${classesInWords(classes)}`
  return { taxClass: keeps ? { type: ['string', 'null'], enum: [...roles, null], description: `${about} Null keeps the class it has.` } : { type: 'string', enum: roles, description: about } }
}

/** A class an operating category with no VAT may carry, for the example, or null while the pack has none. */
function exampleClass(classes: readonly CategoryClass[]): string | null {
  return classes.find((taxClass) => taxClass.buckets.includes('operating') && taxClass.vat.includes('none'))?.role ?? null
}

function operationsOf(keys: readonly string[], classes: readonly CategoryClass[]): readonly AssistantOperation[] {
  const exampleTaxClass = exampleClass(classes)
  const others = otherRoles(classes)
  const roles: StrictSchema = { type: 'array', items: { type: 'string', enum: others }, description: 'The roles that carry no tax class, or an empty list for none.' }
  const rolesOrNull: StrictSchema = {
    type: ['string', 'null'],
    description: `The roles that carry no tax class, comma separated, from ${others.join(', ')}. "" for none, or null to leave them.`,
  }
  return [
    {
      name: 'set-setting',
      about:
        "A setting's value on Settings, General or Invoicing, Clients, Billing and invoice terms, for the keys listed here, checked as those forms check it. Blank clears it. billing_client is a client's short name. A card warns on a value that says where money or mail goes, and on currency and number_locale, which change how every amount reads. The invoice folder is picked only in Google's window, so link /company/invoicing?tab=clients for it.",
      input: inputOf({ key: { type: 'string', enum: [...keys] }, value: TEXT }),
      refs: {},
      creates: null,
      alone: false,
      example: { key: 'company_name', value: 'Example Studio d.o.o.' },
    },
    {
      name: 'remove-setting',
      about: 'Takes a key off the settings that nothing in Kuna reads, as Settings, General lists them. Import profiles go through delete-import-profile.',
      input: inputOf({ key: TEXT }),
      refs: {},
      creates: null,
      alone: false,
      example: { key: 'old_key' },
    },
    {
      name: 'add-category',
      about:
        'A new category as Settings, Categories adds it: a short name in lower case with hyphens, a family, a bucket, its tax class while the pack has classes, the other roles, VAT, a colour, and an owner share while owner pay is on. The class decides which VAT and buckets fit. It goes one to a card, and a later card files rows into it.',
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
        'Deletes a category, as Settings, Categories deletes it.',
        "into is the category its ledger rows, split parts and rules move to in the same change, each row keeping who filed it and taking that category's owner share, or null for a category nothing names.",
        "A category the pack's records name, such as an owner advance, a plan row or a year-end konto line, is refused until those name another.",
      ].join(' '),
      input: inputOf({ category: TEXT, into: TEXT_OR_NULL }),
      refs: { category: CATEGORY, into: CATEGORY },
      creates: null,
      alone: false,
      example: { category: 'category', into: 'category-other' },
    },
    {
      name: 'add-account',
      about: 'A new bank account as Settings, Accounts adds it: a short name in lower case with hyphens, a name on screen, its IBAN, and its currency or "" for the books\' own.',
      input: inputOf({ account: TEXT, label: TEXT, iban: TEXT, currency: TEXT }),
      refs: {},
      creates: ACCOUNT,
      alone: false,
      example: { account: 'savings', label: 'Savings', iban: 'HR1210010051863000160', currency: '' },
    },
    {
      name: 'change-account',
      about: "Changes an account's short name, name on screen, IBAN or currency. An account ledger rows name keeps its short name and IBAN. Null leaves a field as it is.",
      input: inputOf({ account: TEXT, name: TEXT_OR_NULL, label: TEXT_OR_NULL, iban: TEXT_OR_NULL, currency: TEXT_OR_NULL }),
      refs: { account: ACCOUNT },
      creates: null,
      alone: false,
      example: { account: 'account', name: null, label: 'Main account', iban: null, currency: null },
    },
    {
      name: 'delete-account',
      about: 'Deletes an account no ledger row names.',
      input: inputOf({ account: TEXT }),
      refs: { account: ACCOUNT },
      creates: null,
      alone: false,
      example: { account: 'account-unused' },
    },
  ]
}

function textOrKept(value: string | null, kept: string): string {
  return value === null ? kept : value
}

/** The drafts as the categories tab would save them, each made into a record, or why the tab would refuse them. */
function madeOrRefused<R>(errors: ReadonlyMap<number, Partial<Record<string, string>>>, made: readonly MadeDraft<R>[]): readonly { readonly saved: number | null; readonly record: R }[] {
  const refusals = [...errors.values()].flatMap((found) => Object.entries(found).map(([name, reason]) => `${name}: ${reason}`))
  if (refusals.length > 0) throw new StepRefused(refusals.join(' '))
  return made.map((draft) => {
    if ('refused' in draft) throw new StepRefused(draft.refused)
    return draft
  })
}

/** Saves the categories as Settings, Categories saves its editor's rows, after its checks, with the rows a new default fills. */
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
  return new StepRefused(`Pick how Kuna counts "${slug}" in taxClass, one of these. ${classesInWords(classes)}`)
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
  const kept = categoryUsesAfterMove(recordsOfKind).get(slug)
  if (kept !== undefined) throw new StepRefused(`That category is still named by ${kept.join(', ')}, which a move leaves. Change those first.`)
  const category = recordsOf(records.categories).find((record) => record.slug === slug)
  if (category === undefined) throw new StepRefused('That category is no longer in the books.')
  deleteCategoryInto(card.unit, records, category, into.slug, card.workbook.categories)
}

/** Saves the accounts as Settings, Accounts saves its editor's rows, after its checks. */
function writeAccounts(card: CompanyCard, edit: (drafts: readonly AccountDraft[]) => readonly AccountDraft[]): void {
  const records = card.records()
  const stored: readonly StoredRecord<unknown>[] = storedOf(records.accounts)
  const drafts = edit(accountDraftsOf(stored))
  const used = new Set(accountUses((kind) => recordsOfKindIn(records, kind)).keys())
  writeDrafts(card.unit.of(ACCOUNT_WRITES), stored, madeOrRefused(accountDraftErrors(drafts, used), accountsOfDrafts(stored, drafts)))
}

function accountAt(drafts: readonly AccountDraft[], slug: string): number {
  const at = drafts.findIndex((draft) => draft.savedName.trim().toLowerCase() === slug)
  if (at < 0) throw new StepRefused('That account is no longer in the books.')
  return at
}

function addAccount(card: CompanyCard, step: ProposalStep): void {
  const field = fieldsOf(step)
  const slug = String(field['account']).trim().toLowerCase()
  writeAccounts(card, (drafts) => [...drafts, { saved: null, savedName: '', account: slug, label: field['label'], iban: field['iban'], currency: field['currency'] }])
  card.made(step.as, slug)
}

function changeAccount(card: CompanyCard, step: ProposalStep): void {
  const field = fieldsOf(step)
  const slug = card.idOf(field['account']).toLowerCase()
  writeAccounts(card, (drafts) => {
    const at = accountAt(drafts, slug)
    const before = drafts[at]!
    const after: AccountDraft = {
      ...before,
      account: textOrKept(field['name'], before.account),
      label: textOrKept(field['label'], before.label),
      iban: textOrKept(field['iban'], before.iban),
      currency: textOrKept(field['currency'], before.currency),
    }
    return drafts.map((draft, place) => (place === at ? after : draft))
  })
}

function deleteAccount(card: CompanyCard, step: ProposalStep): void {
  const slug = card.idOf(fieldsOf(step)['account']).toLowerCase()
  if (accountUses((kind) => recordsOfKindIn(card.records(), kind)).has(slug)) throw new StepRefused('Ledger rows name that account, so it stays.')
  writeAccounts(card, (drafts) => drafts.filter((_, place) => place !== accountAt(drafts, slug)))
}

/** Core's settings and the installed pack's values, as the records hold them. */
function settingsIn(records: WorkbookRecords) {
  return readSettingsTab(recordsOf(records.settings), installedPack().workbook?.settings ?? null)
}

/** A key's value as its settings form saves it, or why the form refuses it. A client named in the billing terms is one on the clients tab, as the form offers only those. */
function savedValue(card: CompanyCard, key: string, value: string): string {
  if (key === BILLING_CLIENT_KEY && !recordsOf(card.records().clients).some((client) => client.slug === value.trim())) throw new StepRefused(`${key}: ${value} is not a client on the clients tab.`)
  const { settings, packValues } = settingsIn(card.records())
  const core = SETTING_DEFINITIONS.find((definition) => definition.key === key)
  if (core !== undefined) {
    const applied = core.apply(settings, value)
    if (typeof applied === 'string') throw new StepRefused(`${key}: ${applied}`)
    return core.valueOf(applied)
  }
  const pack = installedPack().workbook?.settings.definitions.find((definition) => definition.key === key)
  if (pack === undefined || packValues === null) throw new StepRefused('Only a person sets that key, on its own screen.')
  const applied = pack.apply(packValues, value)
  if (typeof applied === 'string') throw new StepRefused(`${key}: ${applied}`)
  return pack.valueOf(applied)
}

/** Sets a key as Settings, General and the invoicing terms form do, each value checked as the form checks it. Blank clears it. */
function setSetting(card: CompanyCard, step: ProposalStep): void {
  const field = fieldsOf(step)
  const key = String(field['key'])
  const value = String(field['value'])
  if (!proposedKeys().includes(key)) throw new StepRefused('Only a person sets that key, on its own screen.')
  setSettings(card.unit, card.records().settings, [{ key, value: value.trim() === '' ? '' : savedValue(card, key, value) }])
  if (key === 'currency' || key === 'number_locale') card.note({ noun: SETTING_RECORDS.noun, note: { label: settingName(key, {}), text: words.everyFigure[key], tone: 'warning' } })
}

/** Refuses the card when its settings together break a rule the settings forms keep across fields, such as an amount with no item, unless the books broke it already. */
function refuseWhatTheFormsRefuse(card: CompanyCard): void {
  const before = settingsErrors(settingsIn(card.books.records).settings)
  const introduced = Object.entries(settingsErrors(settingsIn(card.records()).settings)).filter(([field, problem]) => before[field as keyof typeof before] !== problem)
  if (introduced.length > 0) throw new StepRefused(introduced.map(([, problem]) => problem).join(' '))
}

function removeSetting(card: CompanyCard, step: ProposalStep): void {
  const key = String(fieldsOf(step)['key']).trim().toLowerCase()
  const settings = card.records().settings
  const unread = unreadSettingKeys(recordsOf(settings), installedPack().workbook?.settings ?? null)
  if (key.startsWith(IMPORT_PROFILE_PREFIX)) throw new StepRefused('An import profile goes through delete-import-profile.')
  if (unread.get(key) !== 1) throw new StepRefused('Only a key nothing in Kuna reads, held by one row, is taken off.')
  removeSettings(card.unit, settings, [key])
}

const PLANS: Readonly<Record<string, (card: CompanyCard, step: ProposalStep) => void>> = {
  'set-setting': setSetting,
  'remove-setting': removeSetting,
  'add-category': addCategory,
  'change-category': changeCategory,
  'delete-category': deleteCategory,
  'add-account': addAccount,
  'change-account': changeAccount,
  'delete-account': deleteAccount,
}

/** What the chat can do to Company's settings, categories and accounts, through the settings screens' own drafts and writes. */
export function settingsOperations(): CompanyOperationSet {
  return {
    operations: operationsOf(proposedKeys(), packClasses()),
    planStep: (card, step) => PLANS[step.operation]!(card, step),
    finish: refuseWhatTheFormsRefuse,
  }
}
