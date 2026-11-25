import type { CivilDate } from '../../../../../../shared/calendar/civilDate'
import type { Rule, RuleCondition } from '../../../../rules/domain/rule'
import { CONTRIBUTION_ACCOUNTS } from '../../domain/salaries/contributionAccounts'
import { hasVersionOn, ruleValue } from '../../ruleset/ruleset'

/** What a payment's description holds, folded as the rules read it, when it pays interest on a late payment rather than the tax or contribution itself. */
const INTEREST_FRAGMENT = 'KAMAT'

/**
 * The category rules that file a year's payments to the state, from the Naputak in force on the
 * day, or none before the ruleset has one. Each waits for the owner to confirm its first match and
 * names its source in its note. Pillar I shares the state budget's account with VAT and profit
 * tax, so it goes by its revenue code, and pillar II and health insurance by their own accounts.
 * Interest on a late payment goes to the same account under the same code, so a rule ahead of each
 * files a payment whose description says interest as late payment interest, which payroll and
 * accruals leave alone.
 */
export function startingRules(on: CivilDate): Rule[] {
  if (!hasVersionOn('hr.state.revenue-codes', on)) {
    return []
  }
  const { value: codes, version } = ruleValue('hr.state.revenue-codes', on)
  const source = `Naputak ${version.validFrom.slice(0, 4)} (NN ${version.sources[0]!.nn[0]})`
  const model = codes.model.text
  const byCode = (code: string): RuleCondition => ({ column: 'revenue_code', code })
  const byAccount = (iban: string): RuleCondition => ({ column: 'counterparty_iban', iban })
  const rules: readonly [id: string, condition: RuleCondition, category: string, note: string][] = [
    ['state-vat', byCode(codes.vatCode.text), 'vat', `${source}: VAT, revenue code ${codes.vatCode.text}, model ${model}`],
    [
      'state-profit-tax',
      byCode(codes.profitTaxCode.text),
      'corporate-income-tax',
      `${source}: profit tax, what the Naputak calls "porez na dobit", revenue code ${codes.profitTaxCode.text}, model ${model}`,
    ],
    [
      'state-pension-pillar-one',
      byCode(codes.pensionPillarOneCode.text),
      'payroll-contributions',
      `${source}: pension insurance pillar I on a salary, revenue code ${codes.pensionPillarOneCode.text}, model ${model}`,
    ],
    [
      'state-pension-pillar-two',
      byAccount(CONTRIBUTION_ACCOUNTS.pensionPillarTwo),
      'payroll-contributions',
      `${source}: pension insurance pillar II, account ${CONTRIBUTION_ACCOUNTS.pensionPillarTwo}`,
    ],
    ['state-health-insurance', byAccount(CONTRIBUTION_ACCOUNTS.health), 'payroll-contributions', `${source}: health insurance, account ${CONTRIBUTION_ACCOUNTS.health}`],
  ]
  const withInterest = rules.flatMap(([id, condition, category, note]) => [
    {
      id: `${id}-interest`,
      conditions: [condition, { column: 'description_contains', fragment: INTEREST_FRAGMENT } as const],
      category: 'late-payment-interest',
      note: `${note}, interest on a late payment`,
    },
    { id, conditions: [condition], category, note },
  ])
  return withInterest.map(({ id, conditions, category, note }, index) => ({
    id,
    order: (index + 1) * 10,
    enabled: true,
    conditions: [{ column: 'direction', direction: 'debit' }, ...conditions],
    category,
    confidence: 'review',
    note,
  }))
}
