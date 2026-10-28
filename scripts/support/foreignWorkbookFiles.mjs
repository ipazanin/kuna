import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { crc32, deflateRawSync } from 'node:zlib'
import * as XLSX from 'xlsx'

/**
 * xlsx files the app did not write, made up from scratch: a filled-in template laid out the way a
 * person would in Excel, and the single sheet a bank exports. SheetJS writes the sheets, and the
 * zip is packed again with Node's zlib. The app's own export packs with SheetJS's deflate, which a
 * reader can decode by a shorter path than the deflate Excel and Google Sheets use.
 */
export const FOREIGN_WORKBOOK_FILES = [
  {
    name: 'excel-style-template.xlsx',
    sheets: {
      // Tab names in any letter case, columns in another order, an extra column and an extra tab.
      Ledger: [
        ['date', 'account', 'amount', 'balance', 'counterparty', 'description', 'category', 'my_note'],
        [new Date(Date.UTC(2026, 0, 5)), 'main', 1200, 5200, 'Example Client Ltd', 'Invoice 2025-12', 'revenue', 'paid on time'],
        [new Date(Date.UTC(2026, 0, 9)), 'main', -35.5, 5164.5, 'Example Telecom', 'Phone bill, Čakovec office', 'telecom', ''],
        [new Date(Date.UTC(2026, 1, 2)), 'savings', 500, 1500, 'Own transfer', 'To savings', 'transfer', ''],
      ],
      Categories: [
        ['category', 'family', 'bucket'],
        ['revenue', 'income', 'income'],
        ['telecom', 'operating', 'operating'],
        ['transfer', 'internal', 'neutral'],
      ],
      Accounts: [
        ['account', 'iban'],
        ['main', 'HR1200000000000000001'],
        ['savings', 'HR1200000000000000002'],
      ],
      Settings: [
        ['key', 'value'],
        ['company_name', 'Made Up Studio'],
        ['currency', 'EUR'],
      ],
      'Read me': [['Filled in by hand in a spreadsheet program.']],
    },
    expected: { transactions: 3, accounts: ['main', 'savings'], categories: 3, problems: 0 },
  },
  {
    name: 'bank-export.xlsx',
    sheets: {
      Promet: [
        ['Datum', 'Opis', 'Iznos', 'Stanje'],
        [new Date(Date.UTC(2026, 0, 5)), 'Uplata, Example Client Ltd', 1200, 5200],
        [new Date(Date.UTC(2026, 0, 9)), 'Isplata, Example Telecom', -35.5, 5164.5],
      ],
    },
    expected: { refusal: 'The file has no tab called "ledger", so it is not a Kuna workbook.' },
  },
]

/** The bytes of one of the files above. */
export function foreignWorkbookBytes(file) {
  const book = XLSX.utils.book_new()
  for (const [tab, grid] of Object.entries(file.sheets)) {
    const sheet = XLSX.utils.aoa_to_sheet(grid, { cellDates: true, dateNF: 'dd/mm/yyyy' })
    XLSX.utils.book_append_sheet(book, sheet, tab)
  }
  book.Props = { Title: 'Made-up workbook', Author: 'Nobody' }
  const written = XLSX.write(book, { type: 'buffer', bookType: 'xlsx', bookSST: true })
  return repackedWithZlib(written)
}

/** Writes every file above into a folder and returns their paths with what an import should show. */
export function writeForeignWorkbookFiles(directory) {
  return FOREIGN_WORKBOOK_FILES.map((file) => {
    const path = join(directory, file.name)
    writeFileSync(path, foreignWorkbookBytes(file))
    return { ...file, path }
  })
}

function repackedWithZlib(xlsxBytes) {
  const container = XLSX.CFB.read(xlsxBytes, { type: 'buffer' })
  const entries = container.FileIndex.flatMap((entry, index) => {
    const name = container.FullPaths[index].replace(/^[^/]*\//, '')
    // SheetJS keeps a marker entry of its own, which no other writer puts in the zip.
    return entry.type === 2 && !name.startsWith('\u0001') ? [{ name, content: Buffer.from(entry.content) }] : []
  })
  entries.sort((first, second) => Number(second.name === '[Content_Types].xml') - Number(first.name === '[Content_Types].xml'))

  const localParts = []
  const centralParts = []
  let offset = 0
  for (const { name, content } of entries) {
    const fileName = Buffer.from(name, 'utf8')
    const deflated = deflateRawSync(content)
    const checksum = crc32(content)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(8, 8)
    local.writeUInt16LE(0x21, 12)
    local.writeUInt32LE(checksum, 14)
    local.writeUInt32LE(deflated.length, 18)
    local.writeUInt32LE(content.length, 22)
    local.writeUInt16LE(fileName.length, 26)
    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(8, 10)
    central.writeUInt16LE(0x21, 14)
    central.writeUInt32LE(checksum, 16)
    central.writeUInt32LE(deflated.length, 20)
    central.writeUInt32LE(content.length, 24)
    central.writeUInt16LE(fileName.length, 28)
    central.writeUInt32LE(offset, 42)
    localParts.push(local, fileName, deflated)
    centralParts.push(central, fileName)
    offset += local.length + fileName.length + deflated.length
  }
  const centralDirectory = Buffer.concat(centralParts)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(centralDirectory.length, 12)
  end.writeUInt32LE(offset, 16)
  return new Uint8Array(Buffer.concat([...localParts, centralDirectory, end]))
}
