import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { companyAssistant } from '../src/apps/company/assistant/companyAssistant'
import { HR_DOO_ASSISTANT } from '../src/apps/company/packs/hr-doo/assistant/hrDooAssistant'
import { recategorisation } from '../src/apps/company/transactions/domain/verdictChanges'
import { REVIEW_LINK } from '../src/apps/company/transactions/presentation/transactionsLinks'
import { en, hr } from '../src/apps/company/transactions/presentation/words'
import { ledger } from './fixtures/ledger'

const presentation = (file: string) => readFileSync(join(import.meta.dirname, '..', 'src/apps/company/transactions/presentation', file), 'utf8')

describe("asking the chat from Company's To review", () => {
  const item = presentation('ReviewQueueItem.vue')
  const queue = presentation('ReviewQueue.vue')

  it('keeps the queue’s own words on its header button and tags the queue as the To review place', () => {
    expect(queue).toContain('<AskChatButton :label="words.tabs.review" :text="words.review.suggestCategories"')
    expect(queue).toMatch(/about: \{ kind: 'place', app: COMPANY_APP, route: REVIEW_LINK \}/)
    expect([en.review.suggestCategories, hr.review.suggestCategories]).toEqual(['Suggest categories', 'Predloži kategorije'])
    expect(queue).toContain("'card',\n  words.review.suggestCategoriesTask,")
    expect([en.review.suggestCategoriesTask, hr.review.suggestCategoriesTask]).toEqual([
      'Suggest categories for the rows waiting on To review.',
      'Predloži kategorije za retke koji čekaju na kartici Za provjeru.',
    ])
  })

  it('names the To review place for the chat, so a tag on the queue reaches the model', () => {
    const places = companyAssistant(HR_DOO_ASSISTANT, { status: () => 'none', workbook: () => null, records: () => null }, () => []).places
    expect(places.map((place) => place.route)).toContain(REVIEW_LINK)
  })

  it('tags an opened row as its ledger record, named by its day and account and never by its counterparty or amount', () => {
    expect(item).toMatch(/about: \{ kind: 'record', app: COMPANY_APP, recordKind: LEDGER_RECORDS\.name, id: props\.transaction\.id \}/)
    expect(item).toContain('<AskChatButton :label="rowName"')
    expect(item).toContain('v-bind="marked"')
    expect(item).toContain('const rowName = computed(() => `${dayLabel(props.transaction.date)}, ${names.value.account(props.transaction.account)}`)')
  })

  it('files a row picked by hand under the owner’s review label, so nothing new is stored', () => {
    const [row] = ledger([{ date: '2026-08-08', amount: -38.9, counterparty: 'GADGET CORNER', category: 'card-purchase-unknown', flaggedBy: 'ai' }])
    expect(recategorisation(row!, 'equipment', { reviewLabel: 'ivan' })).toEqual({ id: row!.id, verdict: { category: 'equipment', flaggedBy: 'ivan' } })
    expect(queue).toContain('@recategorise="recategorise(entry.transaction, $event)"')
  })
})
