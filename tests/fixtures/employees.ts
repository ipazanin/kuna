import type { Employee } from '../../src/packs/hr-doo/domain/employees/employees'
import { employeeOfFields } from '../../src/packs/hr-doo/domain/employees/employeesReading'
import type { RecordFields } from '../../src/features/workbook/domain/recordFields'
import { storedFieldsOfValues } from '../../src/features/workbook/domain/storedFields'

/** A made-up director living in Zagreb, in pillar II, employed from 2025, read from its row as the employees tab holds it. */
export function director(changes: RecordFields = {}): Employee {
  return employeeOfFields(storedFieldsOfValues({ employee: 'dora', name: 'Dora Example', residence_city: 'Zagreb', pension_pillar_2: true, from: '2025-01-01', director: true, ...changes }))
}
