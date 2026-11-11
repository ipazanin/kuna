import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import * as company from '../src/apps/company/transactions/presentation/words'
import * as spending from '../src/apps/spending/entries/presentation/words'

const source = (file: string) => readFileSync(join(import.meta.dirname, '..', 'src/apps', file), 'utf8')

/** The markup of the element that carries the testid, up to the end of its opening tag. */
function tagOf(markup: string, testid: string): string {
  const at = markup.indexOf(`data-testid="${testid}"`)
  return markup.slice(markup.lastIndexOf('<', at), markup.indexOf('>', at) + 1)
}

describe("the person flag on Spending's entry", () => {
  const dialog = source('spending/entries/presentation/EntryDialog.vue')

  it('shows only for an entry whose saved payee is not blank, while an AI key is kept', () => {
    expect(dialog).toContain("const savedPayee = computed(() => props.entry?.payee.trim() ?? '')")
    expect(tagOf(dialog, 'spending-entry-person')).toContain(`v-if="savedPayee !== '' && assistKeyKept && kind !== 'transfer'"`)
  })

  it('reads as its reverse once the payee is flagged, by the same words in any order', () => {
    expect(dialog).toContain('flaggedAsPerson(store.state.workbook?.settings.personPayees ?? [], savedPayee.value)')
    expect(dialog).toContain(':label="payeeIsPerson ? words.dialog.asCompany : words.dialog.asPerson"')
  })

  it('writes the flag with its own key, through the write that keeps an Undo, and says each other spelling needs its own', () => {
    expect(dialog).toMatch(/async function treatPayee[\s\S]*?writes\.write\([\s\S]*?treatPayeeAsPerson\(unit, recordsOf\(records\.settings\), payeeName, asPerson\)[\s\S]*?key: 'person-payee'/)
    expect(dialog).toContain('{{ words.dialog.asPersonHelp }}')
    expect(spending.en.dialog.asPersonHelp).toContain('Flag each other spelling too')
    expect(spending.hr.dialog.asPersonHelp).toContain('svaki drugi način pisanja')
  })
})

describe("the person flag on Company's To review row", () => {
  const item = source('company/transactions/presentation/ReviewQueueItem.vue')
  const queue = source('company/transactions/presentation/ReviewQueue.vue')

  it('shows only for a row with a counterparty, while an AI key is kept', () => {
    expect(tagOf(item, 'review-person')).toContain(`v-if="transaction.counterparty.trim() !== '' && assistKeyKept"`)
  })

  it('reads as its reverse once the counterparty is flagged, by the same words in any order', () => {
    expect(queue).toContain(':person-counterparty="flaggedAsPerson(settings.personPayees, entry.transaction.counterparty)"')
    expect(item).toContain(':label="personCounterparty ? words.review.item.asCompany : words.review.item.asPerson"')
  })

  it('writes the flag for that row through the write that keeps an Undo, and says each other spelling needs its own', () => {
    expect(queue).toContain('@treat-counterparty="treatCounterparty(entry.transaction)"')
    expect(queue).toMatch(
      /async function treatCounterparty[\s\S]*?writes\.write\([\s\S]*?treatPayeeAsPerson\(unit, state\.records\?\.settings \?\? NO_RECORDS, counterparty, asPerson\)[\s\S]*?key: `person-\$\{transaction\.id\}`/,
    )
    expect(item).toContain('{{ words.review.item.asPersonHelp }}')
    expect(company.en.review.item.asPersonHelp).toContain('Flag each other spelling too')
    expect(company.hr.review.item.asPersonHelp).toContain('svaki drugi način pisanja')
  })
})
