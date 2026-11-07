import { language } from '../../text/language'
import type { EnglishForms, Translation } from '../../text/translation'
import type { RecipeMisfit } from './recipe'

// Croatian addresses the reader as vi, written lowercase inside a sentence. A recipe is recept and a file datoteka.
// These say only what does not fit. How to fix the document is the recipe's owner's to say.

export const en = {
  /** Why a count of files does not fit, with the files as the subject. */
  misfit: (_count: number, misfit: RecipeMisfit, recipe: string): EnglishForms => {
    switch (misfit.kind) {
      case 'not-readable':
        return { one: `It cannot be read as ${recipe}`, other: `They cannot be read as ${recipe}` }
      case 'no-root':
        return { one: `It does not start with ${misfit.root}, as ${recipe} does`, other: `They do not start with ${misfit.root}, as ${recipe} does` }
      case 'no-section':
        return { one: `It has no section ${misfit.section}, which ${recipe} has`, other: `They have no section ${misfit.section}, which ${recipe} has` }
      case 'no-column':
        return {
          one: `Its section ${misfit.section} has no field ${misfit.column}, which ${recipe} has`,
          other: `Their section ${misfit.section} has no field ${misfit.column}, which ${recipe} has`,
        }
    }
  },
}

export const hr: Translation<typeof en> = {
  misfit: (_count, misfit, recipe) => {
    switch (misfit.kind) {
      case 'not-readable':
        return { one: `Ne može se pročitati kao ${recipe}`, few: `Ne mogu se pročitati kao ${recipe}`, other: `Ne mogu se pročitati kao ${recipe}` }
      case 'no-root':
        return { one: `Ne počinje s ${misfit.root}, kao ${recipe}`, few: `Ne počinju s ${misfit.root}, kao ${recipe}`, other: `Ne počinju s ${misfit.root}, kao ${recipe}` }
      case 'no-section':
        return {
          one: `Nema odjeljka ${misfit.section}, koji ${recipe} ima`,
          few: `Nemaju odjeljka ${misfit.section}, koji ${recipe} ima`,
          other: `Nemaju odjeljka ${misfit.section}, koji ${recipe} ima`,
        }
      case 'no-column':
        return {
          one: `Odjeljak ${misfit.section} nema polja ${misfit.column}, koje ${recipe} ima`,
          few: `Odjeljak ${misfit.section} u njima nema polja ${misfit.column}, koje ${recipe} ima`,
          other: `Odjeljak ${misfit.section} u njima nema polja ${misfit.column}, koje ${recipe} ima`,
        }
    }
  },
}

export const words = language === 'hr' ? hr : en
