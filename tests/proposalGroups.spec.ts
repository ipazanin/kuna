import { describe, expect, it } from 'vitest'

import { TRANSACTION_WRITES } from '../src/apps/spending/entries/application/entryWrites'
import { proposalGroups } from '../src/shared/app/proposalGroups'
import type { ProposalDescriber, ProposedRecord } from '../src/shared/app/proposalGroups'
import { words } from '../src/shared/app/words'
import type { CheckedWrite, RuledChange } from '../src/shared/storage/application/recordWrites'
import type { RecordChange } from '../src/shared/storage/application/recordStorage'

const KIND = TRANSACTION_WRITES.kind
const RULES = TRANSACTION_WRITES as RuledChange['rules']

/** Shows every field as it is, and says a confirmed row moves when its category changes. */
const DESCRIBER: ProposalDescriber = {
  keptByKuna: new Set(),
  fieldName: (field) => field,
  shown: (_kind, field, record) => String(record[field]),
  label: (_kind, record) => String(record['payee']),
  warns: () => false,
  movesConfirmed: (_kind, before, after) => before['confirmed'] === true && before['category'] !== after['category'],
}

function checkedOf(...changes: RecordChange[]): CheckedWrite {
  return { title: 'A title', changes: changes.map((change) => ({ rules: RULES, change })), kinds: [KIND], written: [], found: [] }
}

const filed: ProposedRecord = { payee: 'Corner market', category: 'groceries', confirmed: true }

describe('the lines of a proposal', () => {
  it('leave off an add the values a new record holds unless a person sets them, and show them on a change', () => {
    const defaulted: ProposalDescriber = { ...DESCRIBER, defaultsOf: () => ({ confirmed: false }) }
    const added = { ...filed, confirmed: false }
    const groups = proposalGroups(checkedOf({ kind: KIND, verb: 'add', after: added }, { kind: KIND, verb: 'change', before: filed, after: added }), () => defaulted)

    expect(groups.map((group) => group.lines[0]!.fields.map((field) => field.name))).toEqual([['payee', 'category'], ['confirmed']])
  })

  it('show on a removal what the record held, as an add shows what it will hold, leaving off the defaults and what the label names', () => {
    const described: ProposalDescriber = { ...DESCRIBER, defaultsOf: () => ({ confirmed: false }), inLabel: () => new Set(['payee']) }
    const held = { ...filed, confirmed: false }
    const [group] = proposalGroups(checkedOf({ kind: KIND, verb: 'remove', before: held }), () => described)

    expect(group!.lines).toEqual([{ label: 'Corner market', fields: [{ name: 'category', before: 'groceries', after: null, warns: false }], warning: null }])
  })

  it('warn when a change files a confirmed row under another category', () => {
    const [group] = proposalGroups(checkedOf({ kind: KIND, verb: 'change', before: filed, after: { ...filed, category: 'eating-out' } }), () => DESCRIBER)

    expect(group!.lines[0]!.warning).toBe(words.confirmedRowMoves)
  })

  it('give no warning for a change that leaves the category, or without movesConfirmed', () => {
    const renamed: RecordChange = { kind: KIND, verb: 'change', before: filed, after: { ...filed, payee: 'Corner shop' } }
    const moved: RecordChange = { kind: KIND, verb: 'change', before: filed, after: { ...filed, category: 'eating-out' } }
    const { movesConfirmed: _left, ...plain } = DESCRIBER

    expect(proposalGroups(checkedOf(renamed), () => DESCRIBER)[0]!.lines[0]!.warning).toBeNull()
    expect(proposalGroups(checkedOf(moved), () => plain)[0]!.lines[0]!.warning).toBeNull()
  })

  it('never ask about an add or a removal', () => {
    const groups = proposalGroups(checkedOf({ kind: KIND, verb: 'add', after: filed }, { kind: KIND, verb: 'remove', before: filed }), () => DESCRIBER)

    expect(groups.flatMap((group) => group.lines.map((line) => line.warning))).toEqual([null, null])
  })
})
