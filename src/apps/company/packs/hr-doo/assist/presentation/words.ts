import { language } from '../../../../../../shared/text/language'
import type { Translation } from '../../../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.

export const en = {
  explain: {
    title: 'Explain',
    sends: "The figure's build-up, its amounts and the rules it rests on",
    employees: 'Include figures that name employees',
    employeesWarning: (provider: string) => `This figure names employees. Explaining it sends their names and pay to ${provider}.`,
    checked: (day: string) => `Rules checked on ${day}`,
  },
}

export const hr: Translation<typeof en> = {
  explain: {
    title: 'Objasni',
    sends: 'Razradu iznosa, njegove iznose i pravila na kojima počiva',
    employees: 'Uključi iznose koji navode zaposlenike',
    employeesWarning: (provider) => `Ovaj iznos navodi zaposlenike. Objašnjenje šalje njihova imena i plaće pružatelju ${provider}.`,
    checked: (day) => `Pravila provjerena ${day}`,
  },
}

export const words = language === 'hr' ? hr : en
