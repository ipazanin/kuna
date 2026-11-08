import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { recategorisation } from '../src/apps/company/transactions/domain/verdictChanges'
import { ledger } from './fixtures/ledger'

const presentation = (file: string) => readFileSync(join(import.meta.dirname, '..', 'src/apps/company/transactions/presentation', file), 'utf8')

describe('using a suggested category in the review queue', () => {
  const item = presentation('ReviewQueueItem.vue')
  const queue = presentation('ReviewQueue.vue')

  it('emits the same recategorise as picking the category by hand, with the suggested slug', () => {
    const use = item.slice(item.indexOf('data-testid="use-suggestion"'), item.indexOf('/>', item.indexOf('data-testid="use-suggestion"')))
    expect(use).toContain(`@click="emit('recategorise', suggestion.category)"`)
    expect(item).toContain("emit('recategorise', category)")
  })

  it('writes it through the queue’s one recategorise, which files the row with Undo and offers Make rule', () => {
    expect(queue).toContain('@recategorise="recategorise(entry.transaction, $event)"')
    expect(queue).toMatch(/async function recategorise[\s\S]*?recategorisation\(transaction, category, workbook\.settings\)[\s\S]*?follow: \{ label: words\.review\.makeRule/)
  })

  it('files the row under the owner’s review label, as a pick by hand does, so nothing new is stored', () => {
    const [row] = ledger([{ date: '2026-08-08', amount: -38.9, counterparty: 'GADGET CORNER', category: 'card-purchase-unknown', flaggedBy: 'ai' }])
    expect(recategorisation(row!, 'equipment', { reviewLabel: 'ivan' })).toEqual({ id: row!.id, verdict: { category: 'equipment', flaggedBy: 'ivan' } })
  })

  it('sends nothing while the employee switch holds back every row, and says so', () => {
    expect(queue).toMatch(/async function suggest[\s\S]*?sentRows\(input\)\.length > 0[\s\S]*?suggesting\.run/)
    expect(queue).toContain('heldBack.value ? assistWords.suggest.heldBack : null')
  })

  it('shows what a run spent whether or not it gave a draft', () => {
    expect(queue).toContain('result === null ? null : usageLine(result)')
  })
})
