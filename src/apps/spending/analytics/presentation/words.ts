import { language } from '../../../../shared/text/language'
import { withFullStop } from '../../../../shared/text/withFullStop'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence.

export const en = {
  spent: 'Spent',
  income: 'Income',
  saved: 'Saved to investments',
  savingsRate: 'Savings rate',
  groups: {
    span: (first: string, last: string) => `Spending by group each month from ${first} to ${last}.`,
    most: (month: string, amount: string) => `The most was ${amount} in ${month}.`,
    running: (month: string) => `${month} is still filling.`,
    nothing: 'Nothing spent in these months.',
  },
  flow: {
    span: (first: string, last: string) => `Income, spending and money saved to investments each month from ${first} to ${last}, with the savings rate.`,
    month: (month: string, income: string, spent: string, saved: string) => `In ${month} income was ${income}, spending ${spent}, and ${saved} went to investments.`,
    rate: (rate: string) => `The savings rate was ${rate}.`,
    noRate: 'With no income there is no savings rate.',
    running: (month: string) => `${month} is still filling.`,
    monthHeading: 'Month',
  },
}

export const hr: Translation<typeof en> = {
  spent: 'Potrošeno',
  income: 'Prihodi',
  saved: 'Prijenos u ulaganja',
  savingsRate: 'Stopa štednje',
  groups: {
    span: (first, last) => `Potrošnja po skupinama za svaki mjesec od ${first} do ${last}.`,
    most: (month, amount) => `Najviše je bilo ${amount} u mjesecu ${withFullStop(month)}`,
    running: (month) => `Mjesec ${month} još traje.`,
    nothing: 'U ovim mjesecima nema potrošnje.',
  },
  flow: {
    span: (first, last) => `Prihodi, potrošnja i prijenos u ulaganja za svaki mjesec od ${first} do ${last}, sa stopom štednje.`,
    month: (month, income, spent, saved) => `U mjesecu ${month} prihodi su bili ${income}, potrošnja ${spent}, a u ulaganja je otišlo ${saved}.`,
    rate: (rate) => `Stopa štednje bila je ${rate}.`,
    noRate: 'Bez prihoda nema stope štednje.',
    running: (month) => `Mjesec ${month} još traje.`,
    monthHeading: 'Mjesec',
  },
}

export const words = language === 'hr' ? hr : en
