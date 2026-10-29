/**
 * Opens an xlsx workbook as the app's document, writes the document as text and reads it back,
 * exports it as xlsx in the template format, and opens that export as a document again. Fails
 * unless both documents hold the same records and read as the same workbook, and the workbook is
 * the one the xlsx file itself reads as. It prints counts only, never a row or a figure, so it is
 * safe to run on a real export.
 *
 *   npm run check:round-trip -- --workbook <path to export.xlsx>
 */

import { isDeepStrictEqual } from 'node:util'
import { readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'

import { decodeDocument, encodeDocument } from '../src/shared/storage/infrastructure/documentFormat.ts'
import { COMPANY_APP, readDocument } from '../src/apps/company/workbook/infrastructure/companyDocument.ts'
import { documentOfTabs, tabsOfDocument } from '../src/apps/company/workbook/infrastructure/spreadsheetDocument.ts'
import { readSnapshot } from '../src/apps/company/workbook/infrastructure/spreadsheetTab.ts'
import { readWorkbookFile, writeWorkbookFile } from '../src/apps/company/workbook/infrastructure/workbookFile.ts'
import { hrDooWorkbook } from '../src/apps/company/packs/hr-doo/domain/hrDooPart.ts'
import { installHrDooPack } from './support/installPack.mjs'

installHrDooPack()

const { values: options } = parseArgs({ options: { workbook: { type: 'string' } } })
if (options.workbook === undefined) {
  console.error('Usage: npm run check:round-trip -- --workbook <path to export.xlsx>')
  process.exit(2)
}

const AT = '2026-01-01T00:00:00.000Z'
const IDENTITY = { id: 'round-trip', source: 'browser', title: 'round trip', syncedAt: AT }

const SECTIONS = [
  'transactions',
  'categories',
  'accounts',
  'rules',
  'invoices',
  'clients',
  'billingPlan',
  'ownerAdvances',
  'splits',
  'assets',
  'grants',
  'yearEndLines',
  'planLines',
  'payScenarios',
  'dismissals',
  'problems',
]

/** The value with every ledger row's id left out, the one field the move gives a row, so the workbook the xlsx file reads as compares with the document's. */
function withoutRowIds(value) {
  if (Array.isArray(value)) return value.map(withoutRowIds)
  if (value === null || typeof value !== 'object' || value instanceof Map || value instanceof Set) return value
  return Object.fromEntries(Object.entries(value).flatMap(([key, field]) => (key === 'rowId' ? [] : [[key, withoutRowIds(field)]])))
}

function contentOf(workbook) {
  const books = hrDooWorkbook(workbook)
  return Object.fromEntries([...SECTIONS, 'settings', 'companyFacts'].map((section) => [section, books[section]]))
}

/** The document an xlsx file opens as, written as the file holds it and read back. */
async function documentOfXlsx(bytes) {
  const { tabs, missingTabs } = await readWorkbookFile(bytes)
  return { tabs, missingTabs, document: decodeDocument(encodeDocument(documentOfTabs(COMPANY_APP, tabs, AT))) }
}

const opened = await documentOfXlsx(readFileSync(options.workbook))
const asXlsx = withoutRowIds(contentOf(readSnapshot({ meta: { ...IDENTITY, lastExportedAt: null, unexportedSince: null }, ...opened.tabs }).workbook))
const first = readDocument(IDENTITY, opened.document).workbook
const exported = await writeWorkbookFile(tabsOfDocument(opened.document), first)
const reopened = await documentOfXlsx(exported)
const second = readDocument(IDENTITY, reopened.document).workbook

const firstContent = contentOf(first)
const secondContent = contentOf(second)
const asDocument = withoutRowIds(contentOf(first))
for (const section of SECTIONS) {
  const same = isDeepStrictEqual(firstContent[section], secondContent[section]) && isDeepStrictEqual(asXlsx[section], asDocument[section])
  console.log(
    `${section.padEnd(19)} ${String(asXlsx[section].length).padStart(5)} -> ${String(firstContent[section].length).padStart(5)} -> ${String(secondContent[section].length).padStart(5)}  ${same ? 'same' : 'DIFFERENT'}`,
  )
}
const sameSettings = ['settings', 'companyFacts'].every((section) => isDeepStrictEqual(firstContent[section], secondContent[section]) && isDeepStrictEqual(asXlsx[section], asDocument[section]))
console.log(`${'settings'.padEnd(19)} ${sameSettings ? 'same' : 'DIFFERENT'}`)

const kinds = [...new Set([...Object.keys(opened.document.records), ...Object.keys(reopened.document.records)])]
let sameRecords = true
for (const kind of kinds) {
  const before = opened.document.records[kind] ?? []
  const after = reopened.document.records[kind] ?? []
  const same = isDeepStrictEqual(before, after)
  sameRecords &&= same
  console.log(`${kind.padEnd(27)} ${String(before.length).padStart(5)} -> ${String(after.length).padStart(5)} records  ${same ? 'same' : 'DIFFERENT'}`)
}
const ledger = opened.document.records['ledger-row'] ?? []
const ledgerIds = new Set(ledger.map((record) => record.id))
const everyRowHasItsId = ledger.every((record) => typeof record.id === 'string' && record.id !== '') && ledgerIds.size === ledger.length
console.log(`ledger rows with an id of their own: ${ledgerIds.size} of ${ledger.length}`)
console.log(`missing tabs on import: ${opened.missingTabs.join(', ') || 'none'}; after export: ${reopened.missingTabs.join(', ') || 'none'}`)

const allSame =
  sameSettings &&
  sameRecords &&
  everyRowHasItsId &&
  SECTIONS.every((section) => isDeepStrictEqual(firstContent[section], secondContent[section]) && isDeepStrictEqual(asXlsx[section], asDocument[section]))
console.log(allSame ? '\nround trip: same workbook' : '\nround trip: DIFFERENT')
process.exitCode = allSame ? 0 : 1
