import type { EmployeeFacts } from '../../src/packs/hr-doo/domain/payroll/incomeTax'

/** A synthetic employed director living in Zagreb, in pillar II, with no dependants and no birth year set. */
export const ZAGREB_RESIDENT: EmployeeFacts = {
  residenceCity: 'Zagreb',
  pensionPillarTwo: true,
  dependants: 0,
  birthYear: null,
}
