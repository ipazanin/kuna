import ts from 'typescript'
import { describe, expect, it } from 'vitest'

import { chatReach, writeGraph } from './support/writePaths'

/**
 * The files whose `CardRecord` lists the records an app's confirm cards read, by app. Each card types its field names by that list,
 * so typecheck fails on a field with no name in either language, and this spec fails on a record the chat writes that no list holds.
 */
const CARD_FILES: ReadonlyMap<string, readonly string[]> = new Map([
  ['assets', ['src/apps/assets/assistant/operations/proposalLines.ts']],
  [
    'company',
    ['src/apps/company/assistant/operations/proposalLines.ts', 'src/apps/company/assistant/operations/invoicingLines.ts', 'src/apps/company/packs/hr-doo/assistant/operations/proposalLines.ts'],
  ],
  ['investments', ['src/apps/investments/assistant/operations/proposalLines.ts']],
  ['loans', ['src/apps/loans/assistant/operations/proposalLines.ts']],
  ['spending', ['src/apps/spending/assistant/operations/proposalLines.ts']],
])

const REACH = chatReach(writeGraph())
const WRITE_FILES = [...new Set([...REACH.values()].flatMap((reach) => [...reach.verbs.keys()].map((key) => key.split('#')[0]!)))]
const PROGRAM = ts.createProgram([...WRITE_FILES, ...[...CARD_FILES.values()].flat()], {
  strict: true,
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  allowArbitraryExtensions: true,
  noEmit: true,
})
const CHECKER = PROGRAM.getTypeChecker()

function sourceOf(file: string): ts.SourceFile {
  const source = PROGRAM.getSourceFile(file)
  if (source === undefined) throw new Error(`${file} is not in the program`)
  return source
}

/** The name of the record type a kind's write rules take, such as `StoredRow`. */
function writtenRecord(key: string): string {
  const [file, member] = key.split('#') as [string, string]
  const name = member.split('.')[0]!
  const declaration = sourceOf(file)
    .statements.flatMap((statement) => (ts.isVariableStatement(statement) ? [...statement.declarationList.declarations] : []))
    .find((candidate) => ts.isIdentifier(candidate.name) && candidate.name.text === name)
  if (declaration === undefined) throw new Error(`${file} declares no ${name}`)
  const record = CHECKER.getTypeArguments(CHECKER.getTypeAtLocation(declaration.name) as ts.TypeReference)[0]
  if (record === undefined) throw new Error(`${key} takes no record type`)
  return record.aliasSymbol?.name ?? record.getSymbol()?.name ?? CHECKER.typeToString(record)
}

/** The record types a card file's `CardRecord` lists, by the names it writes them with. */
function cardRecords(file: string): readonly string[] {
  const alias = sourceOf(file).statements.find((statement): statement is ts.TypeAliasDeclaration => ts.isTypeAliasDeclaration(statement) && statement.name.text === 'CardRecord')
  if (alias === undefined) throw new Error(`${file} declares no CardRecord`)
  const members = ts.isUnionTypeNode(alias.type) ? alias.type.types : [alias.type]
  return members.map((member) => member.getText())
}

describe('the confirm cards name every field of the records the chat writes', () => {
  it.each([...CARD_FILES])("lists each record %s's chat writes in a card's CardRecord", (app, files) => {
    const reach = REACH.get(app)!
    const written = [...new Set([...reach.verbs.keys()].filter((key) => !reach.ranBySync.has(key)).map(writtenRecord))].sort()
    const listed = new Set(files.flatMap(cardRecords))
    expect(written.length).toBeGreaterThan(0)
    expect(written.filter((record) => !listed.has(record))).toEqual([])
  })
})
