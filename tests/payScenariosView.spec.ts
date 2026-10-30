import { describe, expect, it } from 'vitest'

import { tracedFigure } from '../src/apps/company/packs/hr-doo/domain/payroll/payrollArithmetic'
import { warningText } from '../src/apps/company/packs/hr-doo/presentation/payScenarios/payScenariosView'
import { civil, euros } from './fixtures/ledger'

const figure = (amount: number) => tracedFigure('Figure', euros(amount), 'plan', [])

describe('warningText', () => {
  it('words every warning with its figures', () => {
    expect([
      warningText({ kind: 'below-floor', agreed: euros(1000), floor: figure(1295.45) }),
      warningText({ kind: 'cap-exceeded', item: 'occasional-gift', paid: figure(900), cap: figure(700), excess: figure(200) }),
      warningText({ kind: 'salary-dropped', grant: 'startup-grant', from: civil('2027-07-01'), requiredUntil: civil('2027-09-14'), atRisk: figure(2500) }),
      warningText({ kind: 'dividend-above-capacity', dividend: figure(50_000), distributable: figure(37_700.64) }),
      warningText({ kind: 'net-assets-below-capital', netAssetsAfter: figure(-9799.36), shareCapital: figure(2500) }),
      warningText({ kind: 'cash-short', cashAfter: figure(-5000) }),
    ]).toEqual([
      'The salary of €1,000.00 a month is below the director floor of €1,295.45, so the payroll pays the floor.',
      'An occasional gift of €900.00 is over its yearly cap of €700.00. The €200.00 over it is taxed as salary.',
      'The salary stops on 1 Jul 2027, but startup-grant requires the employment until 14 Sep 2027. Its terms can claw back €2,500.00 then.',
      'The dividend of €50,000.00 is above the €37,700.64 the year can pay out.',
      'After the payout, net assets fall to €9,799.36 below zero, under the share capital of €2,500.00.',
      'Cash would not cover the year: €5,000.00 short after the owner pay, the corporate tax and the dividend paid in cash.',
    ])
  })
})
