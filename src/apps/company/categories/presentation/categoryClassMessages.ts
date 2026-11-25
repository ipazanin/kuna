import { classFindings } from '../domain/categoryClasses'
import { classChanged, classedFieldsOf } from '../domain/categoryDrafts'
import type { CategoryDraft, CategoryField } from '../domain/categoryDrafts'
import type { CategoryClass } from '../../workbook/domain/packPart'
import { words } from './words'

/** What fields hold and what the editor calls it, so a message names a class, a VAT treatment and a bucket as the editor's menus show them. */
export interface ClassNaming {
  className(role: string): string
  treatment(treatment: string): string
  bucket(bucket: string): string
}

export type ClassField = CategoryField | 'class'

/** Messages by the draft's position, each on its field. */
export type ClassMessages = ReadonlyMap<number, Partial<Record<ClassField, string>>>

/**
 * What the editor says about the pack's classes, by the draft's position. A row added, or changed in
 * its roles, VAT or bucket, has an error on the field to change, which keeps Save off. A row left as
 * it was saved has the same words as a hint, so the tab still saves before every row has a class.
 */
export function categoryClassMessages(
  drafts: readonly CategoryDraft[],
  baseline: readonly CategoryDraft[],
  classes: readonly CategoryClass[],
  naming: ClassNaming,
): { readonly errors: ClassMessages; readonly hints: ClassMessages } {
  const errors = new Map<number, Partial<Record<ClassField, string>>>()
  const hints = new Map<number, Partial<Record<ClassField, string>>>()
  drafts.forEach((draft, index) => {
    const changed = classChanged(draft, baseline)
    const messages: Partial<Record<ClassField, string>> = {}
    for (const finding of classFindings(classedFieldsOf(draft), classes)) {
      switch (finding.kind) {
        case 'unclassed':
          messages.class = changed ? words.categories.classes.pick : words.categories.classes.notClassified
          break
        case 'classes':
          messages.class = words.categories.classes.oneClass(finding.roles.map(naming.className))
          break
        case 'vat':
          messages.vat = words.categories.classes.vat(finding.taxClass.vat.map(naming.treatment))
          break
        case 'bucket':
          messages.bucket = words.categories.classes.bucket(finding.taxClass.buckets.map(naming.bucket))
          break
      }
    }
    if (Object.keys(messages).length > 0) (changed ? errors : hints).set(index, messages)
  })
  return { errors, hints }
}
