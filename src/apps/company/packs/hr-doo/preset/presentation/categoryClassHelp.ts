import type { CivilDate } from '../../../../../../shared/calendar/civilDate'
import type { CategoryClassHelp } from '../../../packContribution'
import { ruleLink } from '../../ruleset/presentation/taxRuleLinks'
import { taxClassOf } from '../domain/taxClassOf'
import { classNameOf, words } from './classWords'

/** The help for the class a role carries: its name and sentence with the law's shares on the day, and a link to the rule it rests on. */
export function categoryClassHelp(role: string, on: CivilDate): CategoryClassHelp | null {
  const taxClass = taxClassOf(role)
  if (taxClass === null) {
    return null
  }
  const name = classNameOf(taxClass, role, on)
  return { name, sentence: words.countsAs(name), link: { label: words.ruleLink, to: ruleLink(taxClass.addBack ?? taxClass.rules[0]!) } }
}
