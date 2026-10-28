/**
 * The accounts the contributions on a salary are paid into, as the Naputak on paying budget
 * revenues names them for 2026 (NN 18/26, heads II, IV and V) and named them for 2023 (NN 13/23).
 * Pillar I goes to the state budget. Income tax goes to an account of the employee's city, so it
 * has no account here.
 */
export const CONTRIBUTION_ACCOUNTS = {
  pensionPillarOne: 'HR1210010051863000160',
  pensionPillarTwo: 'HR7610010051700036001',
  health: 'HR6510010051550100001',
} as const
