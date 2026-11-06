/**
 * A JSON schema in the subset both adapters accept for strict output and strict tools: objects with every property
 * required and no others, arrays, strings with an optional enum, integers, numbers, booleans and null, and a type list
 * such as `["number", "null"]`. No recursion, no references, no formats.
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
  | { readonly type: readonly ('string' | 'number' | 'null')[]; readonly description?: string }

/** What in the value does not match the schema, each as a path and what is wrong, such as `suggestions.0.row is not one of the allowed values`. Empty when it matches. */
export function schemaProblems(value: unknown, schema: StrictSchema, path = ''): string[] {
  const at = path === '' ? 'The answer' : path
  if (Array.isArray(schema.type)) {
    return schema.type.some((type) => (type === 'null' ? value === null : typeof value === type && (type !== 'number' || Number.isFinite(value)))) ? [] : [`${at} is not ${schema.type.join(' or ')}`]
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
      return schema.enum === undefined || schema.enum.includes(value) ? [] : [`${at} is not one of the allowed values`]
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

function join(path: string, key: string): string {
  return path === '' ? key : `${path}.${key}`
}
