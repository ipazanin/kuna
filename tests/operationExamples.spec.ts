import { describe, expect, it } from 'vitest'

import { schemaProblems } from '../src/shared/ai/domain/strictSchema'
import { APP_OPERATIONS } from './fixtures/appOperations'

const OPERATIONS = [...APP_OPERATIONS].flatMap(([app, operations]) => operations.map((operation) => [`${app}/${operation.name}`, operation] as const))

describe("every operation's example", () => {
  it.each(OPERATIONS)('passes its own input schema as written, a spec swapping only the records it names for refs: %s', (_name, operation) => {
    expect(schemaProblems(operation.example, operation.input)).toEqual([])
  })
})
