import type { CivilDate } from '../../../../../../shared/calendar/civilDate'
import type { RecordProblem } from '../../../../../../shared/storage/domain/recordsRead'
import { plural } from '../../../../../../shared/text/translation'
import { classFindings } from '../../../../settings/domain/categoryClasses'
import { words as settingsWords } from '../../../../settings/presentation/words'
import { displayName } from '../../../../workbook/domain/displayName'
import { categoryIdOf } from '../../../../workbook/domain/workbook'
import type { Category } from '../../../../workbook/domain/workbook'
import { CATEGORY_CLASSES, taxClassOf } from '../domain/taxClassOf'
import { classNameOf, words } from './classWords'

/**
 * What the categories still have to settle before each counts one way: one line naming every
 * category with no tax class, and a line for each with two, or with a VAT treatment or bucket its
 * class does not take. Each names the category, class, treatment and bucket as the screens show
 * them, with the class's shares in force on the day.
 */
export function categoriesToSort(categories: readonly Category[], on: CivilDate): RecordProblem[] {
  const nameOf = (role: string): string => {
    const taxClass = taxClassOf(role)
    return taxClass === null ? role : classNameOf(taxClass, role, on)
  }
  const vatName = (treatment: string): string => Object.entries(settingsWords.categories.vatTreatments).find(([value]) => value === treatment)?.[1] ?? treatment
  const unclassed: string[] = []
  const lines: RecordProblem[] = []
  for (const category of categories) {
    const line = (reason: string): RecordProblem => ({ id: categoryIdOf(category), label: displayName(category.slug, category.label), reason })
    for (const finding of classFindings(category, CATEGORY_CLASSES)) {
      switch (finding.kind) {
        case 'unclassed':
          unclassed.push(displayName(category.slug, category.label))
          break
        case 'classes':
          lines.push(line(words.toSort.classes(finding.roles.map(nameOf))))
          break
        case 'vat':
          lines.push(line(words.toSort.vat(nameOf(finding.taxClass.role), finding.taxClass.vat.map(vatName), vatName(category.vat))))
          break
        case 'bucket':
          lines.push(
            line(words.toSort.bucket(nameOf(finding.taxClass.role), finding.taxClass.buckets.map(settingsWords.categories.bucketChoice), settingsWords.categories.bucketChoice(category.bucket))),
          )
          break
      }
    }
  }
  return unclassed.length === 0 ? lines : [{ id: null, label: words.toSort.unclassedLabel, reason: plural(words.toSort.unclassed(unclassed), unclassed.length) }, ...lines]
}
