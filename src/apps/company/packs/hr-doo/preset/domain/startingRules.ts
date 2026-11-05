import type { CivilDate } from '../../../../../../shared/calendar/civilDate'
import type { Rule, RuleCondition } from '../../../../rules/domain/rule'
import { CONTRIBUTION_ACCOUNTS } from '../../domain/salaries/contributionAccounts'
import { hasVersionOn, ruleValue } from '../../ruleset/ruleset'

/**
 * The category rules that file a year's payments to the state, from the Naputak in force on the
 * day, or none before the ruleset has one. Each waits for the owner to confirm its first match and
 * names its source in its note. Pillar I shares the state budget's account with VAT and profit
 * tax, so it goes by its revenue code, and pillar II and health insurance by their own accounts.
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
  return rules.map(([id, condition, category, note], index) => ({
    id,
    order: (index + 1) * 10,
    enabled: true,
    conditions: [{ column: 'direction', direction: 'debit' }, condition],
    category,
    confidence: 'review',
    note,
  }))
}
