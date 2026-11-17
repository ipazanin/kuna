import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const ROOT = join(import.meta.dirname, '..')

/** Where a Company item record is spelt out field by field: its reader and `newItemRecord`. */
const BUILDER = 'src/apps/company/workbook/domain/splitsReading.ts'

/** The fields that make an object an item record of Company's items tab. */
const ITEM_FIELDS: readonly string[] = ['row', 'amount', 'category', 'note', 'ownerShare', 'invoice', 'labels', 'id']

/** The script of a source file, a Vue file's script blocks joined. */
function scriptOf(path: string): string {
  const text = readFileSync(join(ROOT, path), 'utf8')
  if (!path.endsWith('.vue')) return text
  return [...text.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((match) => match[1]).join('\n')
}

/** Each object literal of an item record's fields and no other, which spreads none, by its line. */
function itemLiterals(path: string): number[] {
  const source = ts.createSourceFile(path, scriptOf(path), ts.ScriptTarget.Latest, true)
  const lines: number[] = []
  const visit = (node: ts.Node) => {
    if (ts.isObjectLiteralExpression(node) && !node.properties.some(ts.isSpreadAssignment)) {
      const names = new Set(node.properties.flatMap((property) => (property.name !== undefined && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) ? [property.name.text] : [])))
      if (names.size === ITEM_FIELDS.length && ITEM_FIELDS.every((field) => names.has(field))) lines.push(source.getLineAndCharacterOfPosition(node.getStart()).line + 1)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return lines
}

describe('a Company item record', () => {
  it('is spelt out field by field only where the items tab is read and where a new item is built, so no writer drops a field it does not set', () => {
    const files = readdirSync(join(ROOT, 'src'), { recursive: true, encoding: 'utf8' })
      .filter((name) => /\.(ts|vue)$/.test(name))
      .map((name) => join('src', name))
      .filter((path) => path !== BUILDER)

    expect(files.flatMap((path) => itemLiterals(path).map((line) => `${path}:${line}`))).toEqual([])
    expect(itemLiterals(BUILDER).length).toBeGreaterThan(0)
  })
})
