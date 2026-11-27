import { fieldsOf } from './companyCard'
import { settingName } from './settingNames'
import type { CompanyCard, CompanyOperationSet } from './companyCard'
import { words } from './words'
import { installedPack } from '../../packs/packContribution'
import { removeSettings, setSettings } from '../../settings/application/settingWrites'
import {
  CLIENT_PAYMENTS_PLACED_KEY,
  STATEMENTS_MAIL_READ_TO_KEY,
  PERSON_PAYEES_KEY,
  SETTING_DEFINITIONS,
  STATEMENTS_MAIL_KEY,
  booleanOf,
  TRIP_FOLDER_KEY,
  readSettingsTab,
  settingsErrors,
  unreadSettingKeys,
} from '../../settings/domain/settings'
import { SETTING_RECORDS } from '../../workbook/domain/coreKinds'
import type { WorkbookRecords } from '../../workbook/domain/readWorkbook'
import type { AssistantOperation, ProposalStep } from '../../../../shared/app/assistantOperations'
import { TEXT, inputOf } from '../../../../shared/app/operationInput'
import { StepRefused } from '../../../../shared/app/proposedWrites'
import { recordsOf } from '../../../../shared/storage/domain/recordsRead'

const BILLING_CLIENT_KEY = 'billing_client'

/**
 * The keys no card sets. Kuna's version marker and the review label are the owner's. The payees flagged as people are the chat's
 * own guard. The invoice and travel orders folders need Google's picker. The bank's mail address needs Google's consent,
 * so the chat links their screen, and so does turning the bank's mail on, though the chat may turn it off. The subject of the bank's mail needs none, so a card sets it.
 */
const NEVER_PROPOSED: ReadonlySet<string> = new Set([
  'template_version',
  CLIENT_PAYMENTS_PLACED_KEY,
  STATEMENTS_MAIL_READ_TO_KEY,
  'review_label',
  PERSON_PAYEES_KEY,
  'invoice_folder_id',
  TRIP_FOLDER_KEY,
  'statements_mail_from',
])

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

function operationsOf(keys: readonly string[]): readonly AssistantOperation[] {
  return [
    {
      name: 'set-setting',
      about:
        "A setting's value on Settings, General or Invoicing, Clients, Billing and invoice terms, for the keys listed here, checked as those forms check it. Blank clears it. billing_client is a client's short name. A card warns on a value that says where money or mail goes, and on currency and number_locale, which change how every amount reads. The invoice folder is picked only in Google's window, so link /company/invoicing?tab=clients for it. statements_mail may be set to FALSE to stop reading the bank's mail. Turning it on asks Google's consent, so link /company/settings#mail for it.",
      input: inputOf({ key: { type: 'string', enum: [...keys] }, value: TEXT }),
      refs: {},
      creates: null,
      alone: false,
      example: { key: 'company_name', value: 'Example Studio d.o.o.' },
    },
    {
      name: 'remove-setting',
      about: 'Takes a key off the settings that nothing in Kuna reads, as Settings, General lists them.',
      input: inputOf({ key: TEXT }),
      refs: {},
      creates: null,
      alone: false,
      example: { key: 'old_key' },
    },
  ]
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
  if (key === STATEMENTS_MAIL_KEY && booleanOf(value) !== false)
    throw new StepRefused("Turning the bank's statement mail on asks Google's consent. Link /company/settings#mail and leave it to the person.")
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
  if (unread.get(key) !== 1) throw new StepRefused('Only a key nothing in Kuna reads, held by one row, is taken off.')
  removeSettings(card.unit, settings, [key])
}

const PLANS: Readonly<Record<string, (card: CompanyCard, step: ProposalStep) => void>> = {
  'set-setting': setSetting,
  'remove-setting': removeSetting,
}

/** What the chat can do to Company's settings, through the settings forms' own checks and writes. */
export function settingsOperations(): CompanyOperationSet {
  return {
    operations: operationsOf(proposedKeys()),
    planStep: (card, step) => PLANS[step.operation]!(card, step),
    finish: refuseWhatTheFormsRefuse,
  }
}
