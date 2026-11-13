/**
 * A JSON schema in the subset both adapters accept for strict output and strict tools: objects with every property
 * required and no others, arrays, strings with an optional enum, integers, numbers, booleans and null, and a type list
 * such as `["number", "null"]`, with an optional enum that lists null too, or `["array", "null"]` with its items. No
 * recursion, no references, no formats.
 */
export type StrictSchema =
  | {
      readonly type: 'object'
      readonly properties: Readonly<Record<string, StrictSchema>>
      readonly required: readonly string[]
      readonly additionalProperties: false
      readonly description?: string
    }
  | { readonly type: 'array'; readonly items: StrictSchema; readonly description?: string }
  | { readonly type: 'string'; readonly enum?: readonly string[]; readonly description?: string }
  | { readonly type: 'integer' | 'number' | 'boolean' | 'null'; readonly description?: string }
  | { readonly type: readonly ('string' | 'number' | 'null')[]; readonly enum?: readonly (string | null)[]; readonly description?: string }

/** What in the value does not match the schema, each as a path and what is wrong, such as `suggestions.0.row is not one of a, b`. Empty when it matches. */
export function schemaProblems(value: unknown, schema: StrictSchema, path = ''): string[] {
  const at = path === '' ? 'The answer' : path
  if ('items' in schema && Array.isArray(schema.type)) {
    return value === null ? [] : schemaProblems(value, { type: 'array', items: schema.items }, path)
  }
  if (Array.isArray(schema.type)) {
    if (!schema.type.some((type) => (type === 'null' ? value === null : typeof value === type && (type !== 'number' || Number.isFinite(value))))) return [`${at} is not ${schema.type.join(' or ')}`]
    const allowed = 'enum' in schema ? schema.enum : undefined
    return allowed === undefined || allowed.includes(value as string | null) ? [] : [notAllowed(at, allowed)]
  }
  switch (schema.type) {
    case 'object': {
      if (value === null || typeof value !== 'object' || Array.isArray(value)) return [`${at} is not an object`]
      const record = value as Record<string, unknown>
      const missing = schema.required.filter((key) => !Object.hasOwn(record, key)).map((key) => `${join(path, key)} is missing`)
      const extra = Object.keys(record)
        .filter((key) => !Object.hasOwn(schema.properties, key))
        .map((key) => `${join(path, key)} is not asked for`)
      const inner = Object.entries(schema.properties).flatMap(([key, property]) => (Object.hasOwn(record, key) ? schemaProblems(record[key], property, join(path, key)) : []))
      return [...missing, ...extra, ...inner]
    }
    case 'array':
      return Array.isArray(value) ? value.flatMap((entry, index) => schemaProblems(entry, schema.items, join(path, String(index)))) : [`${at} is not a list`]
    case 'string':
      if (typeof value !== 'string') return [`${at} is not text`]
      return schema.enum === undefined || schema.enum.includes(value) ? [] : [notAllowed(at, schema.enum)]
    case 'integer':
      return Number.isInteger(value) ? [] : [`${at} is not a whole number`]
    case 'number':
      return typeof value === 'number' && Number.isFinite(value) ? [] : [`${at} is not a number`]
    case 'boolean':
      return typeof value === 'boolean' ? [] : [`${at} is not true or false`]
    case 'null':
      return value === null ? [] : [`${at} is not null`]
    default:
      throw new TypeError(`${at} has a schema Kuna does not check.`)
  }
}

/** A value outside an enum, with every value the enum allows so a model can pick one on its next try, and none of what it wrote. */
function notAllowed(at: string, allowed: readonly (string | null)[]): string {
  return `${at} is not one of ${allowed.map((choice) => (choice === null ? 'null' : choice)).join(', ')}`
}

function join(path: string, key: string): string {
  return path === '' ? key : `${path}.${key}`
}
