import { describe, expect, it } from 'vitest'

import { TranscribedRefused, transcribedReferences, transcribedStatement } from '../src/apps/company/imports/domain/importedStatement'
import { transcribedRefusalText } from '../src/apps/company/imports/presentation/dryRunWords'
import { statementTies } from '../src/shared/money/statementTies'
import { moneyFromCents } from '../src/shared/money/money'
import { civil } from './fixtures/ledger'

const OPENING = moneyFromCents(905_000)
const AMOUNTS = [moneyFromCents(120_000), moneyFromCents(-8_750), moneyFromCents(45_500)]

describe("a printed statement's balances, in Company's ledger", () => {
  it('tie when the opening plus every entry is the closing', () => {
    expect(statementTies({ opening: OPENING, amounts: AMOUNTS, closing: moneyFromCents(1_061_750) })).toEqual({ kind: 'ties' })
  })

  it('refuse a statement a cent off, naming the gap', () => {
    const tie = statementTies({ opening: OPENING, amounts: AMOUNTS, closing: moneyFromCents(1_061_749) })
    if (tie.kind !== 'off') throw new Error('expected the statement to be off')

    expect(tie.gap).toBe(moneyFromCents(-1))
    const rows = AMOUNTS.map((amount, at) => ({ date: civil(`2026-10-0${at + 1}`), amount, counterparty: 'Acme', counterpartyIban: '', description: '' }))
    const refused = (() => {
      try {
        transcribedStatement('main', 'main, October', OPENING, moneyFromCents(1_061_749), rows, 'ask')
      } catch (failure) {
        if (failure instanceof TranscribedRefused) return failure.refusal
      }
      return null
    })()
    expect(refused).toEqual({ kind: 'does-not-tie', opening: OPENING, rows: moneyFromCents(156_750), reached: moneyFromCents(1_061_750), closing: moneyFromCents(1_061_749), gap: moneyFromCents(1) })
    expect(transcribedRefusalText(refused!)).toBe(
      'The statement does not add up: the opening balance €9,050.00 and its entries €1,567.50 reach €10,617.50, but the printed closing balance is €10,617.49, €0.01 apart.',
    )
  })
})

describe('the references of transcribed entries', () => {
  const entries = [
    { date: civil('2031-04-02'), amount: moneyFromCents(-240), counterparty: 'Café on the square' },
    { date: civil('2031-04-02'), amount: moneyFromCents(-240), counterparty: 'CAFE ON THE SQUARE' },
  ]

  it('are the same when the statement is read twice, and tell equal entries apart', () => {
    const references = transcribedReferences('main', entries)

    expect(transcribedReferences('main', entries)).toEqual(references)
    expect(references).toHaveLength(2)
    expect(references[0]).not.toBe(references[1])
    expect(references.every((reference) => reference.startsWith('read-'))).toBe(true)
  })

  it('stay the same when a second read spells the counterparty differently', () => {
    const reread = entries.map((entry) => ({ ...entry, counterparty: 'Cafe on the sq.' }))

    expect(transcribedReferences('main', reread)).toEqual(transcribedReferences('main', entries))
  })

  it('differ by account', () => {
    expect(transcribedReferences('main', entries)).not.toEqual(transcribedReferences('savings', entries))
  })
})
