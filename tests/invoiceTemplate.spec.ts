import { describe, expect, it } from 'vitest'

import { templateOfText, templateProblems, textOfTemplate } from '../src/apps/company/invoicing/domain/invoiceTemplate'

const STORED = 'Software development | Development\nMaintenance in {month} | Hosting | Support'

describe("a client's invoice lines", () => {
  it('read one line per line of the field, the text first and each plan item after a |, and write the same text back', () => {
    const template = templateOfText(`${STORED}\n\n`)

    expect(template).toEqual([
      { text: 'Software development', items: ['Development'] },
      { text: 'Maintenance in {month}', items: ['Hosting', 'Support'] },
    ])
    expect(textOfTemplate(template)).toBe(STORED)
    expect(templateOfText('  ')).toEqual([])
  })

  it('take a last line that names no plan item, since it sums every item no line names', () => {
    expect(templateProblems(templateOfText('Software services for {month}'))).toEqual([])
    expect(templateProblems(templateOfText(STORED))).toEqual([])
  })

  it('name each line that has no text, a word in braces other than {month}, or no plan item before the last line', () => {
    expect(templateProblems(templateOfText(' | Development\nCosts for {week} | Travel\nMaintenance\nRest'))).toEqual([
      { kind: 'blank-text', line: 0 },
      { kind: 'unknown-tokens', line: 1, tokens: ['{week}'] },
      { kind: 'no-items', line: 2 },
    ])
  })

  it('refuse a plan item on two lines', () => {
    expect(templateProblems(templateOfText('Development | Development\nMaintenance | Hosting | Development'))).toEqual([{ kind: 'item-twice', line: 1, item: 'Development' }])
  })

  it('refuse a | or a line break inside a line or a plan item, which would split it when stored', () => {
    expect(
      templateProblems([
        { text: 'Design | build', items: ['Development'] },
        { text: 'Maintenance', items: ['Hosting\nSupport'] },
      ]),
    ).toEqual([
      { kind: 'separator', line: 0 },
      { kind: 'separator', line: 1 },
    ])
  })
})
