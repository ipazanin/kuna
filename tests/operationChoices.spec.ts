import { describe, expect, it } from 'vitest'

import { ASSETS_OPERATIONS } from '../src/apps/assets/assistant/operations/assetsOperations'
import { companyOperations } from '../src/apps/company/assistant/operations/companyOperations'
import { hrDooOperations } from '../src/apps/company/packs/hr-doo/assistant/operations/packOperations'
import { INVESTMENTS_OPERATIONS } from '../src/apps/investments/assistant/operations/investmentsOperations'
import { LOANS_OPERATIONS } from '../src/apps/loans/assistant/operations/loansOperations'
import { SPENDING_OPERATIONS } from '../src/apps/spending/assistant/operations/spendingOperations'
import { schemaProblems } from '../src/shared/ai/domain/strictSchema'
import type { StrictSchema } from '../src/shared/ai/domain/strictSchema'
import type { AssistantOperation } from '../src/shared/app/assistantOperations'
import { kunaOperations } from '../src/shell/assistant/kunaOperations'
import type { KunaDevice } from '../src/shell/assistant/kunaOperations'
import { deskPorts } from './fixtures/companyDesk'

const DEVICE = { apps: () => [{ id: 'company', name: 'Company' }] } as unknown as KunaDevice

/** Every app's operations, Company's with the pack's, by the app's id. */
const APPS: readonly (readonly [string, readonly AssistantOperation[]])[] = [
  ['spending', SPENDING_OPERATIONS],
  ['company', companyOperations(deskPorts({ pack: hrDooOperations(() => false) }))],
  ['loans', LOANS_OPERATIONS],
  ['investments', INVESTMENTS_OPERATIONS],
  ['assets', ASSETS_OPERATIONS],
  ['kuna', kunaOperations(DEVICE)],
]

const NOT_A_CHOICE = 'not-a-choice'

/** A field whose values are a closed set, by its path in the input, with the values it allows. */
interface ClosedField {
  readonly path: readonly (string | number)[]
  readonly allowed: readonly (string | null)[]
}

/** The fields of an input with an enum, a list's items read through the example's first item, or an enum list's items as the list. */
function closedFields(schema: StrictSchema, example: unknown, path: readonly (string | number)[] = []): ClosedField[] {
  if ('enum' in schema && schema.enum !== undefined) return [{ path, allowed: schema.enum }]
  if (schema.type === 'object') {
    const held = (example ?? {}) as Readonly<Record<string, unknown>>
    return Object.entries(schema.properties).flatMap(([name, property]) => closedFields(property, held[name], [...path, name]))
  }
  if (schema.type === 'array') {
    if ('enum' in schema.items && schema.items.enum !== undefined) return [{ path: [...path, 0], allowed: schema.items.enum }]
    return Array.isArray(example) && example.length > 0 ? closedFields(schema.items, example[0], [...path, 0]) : []
  }
  return []
}

/** The example with the value at the path in place, a list given one item when it holds none. */
function withValue(example: unknown, path: readonly (string | number)[], value: unknown): unknown {
  const [step, ...rest] = path
  if (step === undefined) return value
  if (typeof step === 'number') {
    const list = Array.isArray(example) ? [...(example as unknown[])] : []
    list[step] = withValue(list[step], rest, value)
    return list
  }
  return { ...(example as Readonly<Record<string, unknown>>), [step]: withValue((example as Readonly<Record<string, unknown>>)[step], rest, value) }
}

const CASES = APPS.flatMap(([app, operations]) =>
  operations.flatMap((operation) => closedFields(operation.input, operation.example).map((field) => [`${app}/${operation.name}.${field.path.join('.')}`, operation, field] as const)),
)

describe('every closed set an operation takes', () => {
  it('is found in every app', () => {
    expect(new Set(CASES.map(([name]) => name.split('/')[0]))).toEqual(new Set(APPS.map(([app]) => app)))
  })

  it.each(CASES)('refuses a value outside it and names every value it allows: %s', (_name, operation, field) => {
    const problems = schemaProblems(withValue(operation.example, field.path, NOT_A_CHOICE), operation.input)

    const refusal = problems.find((problem) => problem.startsWith(field.path.join('.')))
    expect(refusal, problems.join(' | ')).toBeDefined()
    for (const allowed of field.allowed) expect(refusal).toContain(allowed === null ? 'null' : allowed)
  })
})
