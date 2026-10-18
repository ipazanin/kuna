/**
 * Imports an xlsx workbook through the app's file reader and workbook reader, exports it in the
 * template format, imports the export again, and fails unless both imports read the same workbook.
 * It prints counts only, never a row or a figure, so it is safe to run on a real export.
 *
 *   npm run check:round-trip -- --workbook <path to export.xlsx>
 */

import { isDeepStrictEqual } from 'node:util'
import { readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'

import { readWorkbookFile, writeWorkbookFile } from '../src/features/workbook/infrastructure/workbookFile.ts'
import { readWorkbook } from '../src/features/workbook/infrastructure/workbookReader.ts'

const { values: options } = parseArgs({ options: { workbook: { type: 'string' } } })
if (options.workbook === undefined) {
  console.error('Usage: npm run check:round-trip -- --workbook <path to export.xlsx>')
  process.exit(2)
}

const META = { id: 'round-trip', source: 'excel', title: 'round trip', syncedAt: '2026-01-01T00:00:00.000Z', ledgerSheetId: null, lastExportedAt: null, unexportedSince: null, missingTabs: [] }

function contentOf(tabs) {
  const { transactions, categories, accounts, rules, invoices, clients, ownerAdvances, settings, problems } = readWorkbook({ meta: META, ...tabs })
  return { transactions, categories, accounts, rules, invoices, clients, ownerAdvances, settings, problems }
}

const imported = await readWorkbookFile(readFileSync(options.workbook))
const first = contentOf(imported.tabs)
const exported = await writeWorkbookFile(imported.tabs, readWorkbook({ meta: META, ...imported.tabs }))
const reimported = await readWorkbookFile(exported)
const second = contentOf(reimported.tabs)

const sections = ['transactions', 'categories', 'accounts', 'rules', 'invoices', 'clients', 'ownerAdvances', 'problems']
for (const section of sections) {
  const same = isDeepStrictEqual(first[section], second[section])
  console.log(`${section.padEnd(13)} ${String(first[section].length).padStart(5)} -> ${String(second[section].length).padStart(5)}  ${same ? 'same' : 'DIFFERENT'}`)
}
const sameSettings = isDeepStrictEqual(first.settings, second.settings)
console.log(`${'settings'.padEnd(13)} ${sameSettings ? 'same' : 'DIFFERENT'}`)
console.log(`missing tabs on import: ${imported.missingTabs.join(', ') || 'none'}; after export: ${reimported.missingTabs.join(', ') || 'none'}`)

const allSame = sameSettings && sections.every((section) => isDeepStrictEqual(first[section], second[section]))
console.log(allSame ? '\nround trip: same workbook' : '\nround trip: DIFFERENT')
process.exitCode = allSame ? 0 : 1
