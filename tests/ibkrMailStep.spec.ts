import { describe, expect, it } from 'vitest'

import { words as refusalWords } from '../src/apps/investments/holdings/application/words'
import type { MailReportPlan } from '../src/apps/investments/mail/application/mailReports'
import type { MailedImport } from '../src/apps/investments/mail/application/reportImport'
import type { ReportNews } from '../src/apps/investments/mail/domain/mailReview'
import { MAIL_LIST_LINK, mailStepResult } from '../src/apps/investments/mail/presentation/mailStepResult'
import { words } from '../src/apps/investments/mail/presentation/words'
import { INVESTMENTS_OVERVIEW_ROUTE } from '../src/apps/investments/overview/presentation/investmentLinks'

const PLAN: MailReportPlan = {
  window: { from: 1_780_000_000_000, after: 'since' },
  query: 'from:(reports@broker.example.com) has:attachment',
  mails: [{ mail: { id: 'mail-1', subject: 'Activity Flex', date: 1_780_000_100_000 }, kind: 'read', file: { fileName: 'flex.xml', run: { kind: 'read', rows: [], asked: [] } } }],
}
const NOTHING_LEFT: ReportNews = { fresh: 0, changed: 0, asked: 0 }
const IMPORTED: MailedImport = { kind: 'imported', receipt: { title: 'Imported 4 records from the IBKR report', records: [] }, records: 4, keys: ['ibkr-activity-flex:a:1'] }

describe("the mail step's state", () => {
  it('is done, with Undo, once the report went in and nothing is left', () => {
    expect(mailStepResult(PLAN, IMPORTED, NOTHING_LEFT, 7)).toEqual({ kind: 'done', line: 'Read 1 mail: imported 4 records.', writeId: 7, link: MAIL_LIST_LINK })
  })

  it('is done with a link to the review when the rows went in and only a record whose figures changed is left', () => {
    expect(mailStepResult(PLAN, IMPORTED, { fresh: 0, changed: 1, asked: 0 }, 7)).toEqual({
      kind: 'done',
      line: 'Read 1 mail: imported 4 records, 1 changed since booked.',
      writeId: 7,
      link: { label: '1 record to review', to: INVESTMENTS_OVERVIEW_ROUTE },
    })
  })

  it('is done with a link to the review when the only rows left are those the person undid', () => {
    const result = mailStepResult(PLAN, { kind: 'waits', waits: [{ kind: 'undone' }] }, { fresh: 4, changed: 0, asked: 0 }, null)
    expect(result).toEqual({ kind: 'done', line: `Read 1 mail: 4 new for review. ${words.step.undoneKept}`, writeId: null, link: { label: '4 records to review', to: INVESTMENTS_OVERVIEW_ROUTE } })
  })

  it('waits with a link to the review while an account or a holding is to pick, saying what to do', () => {
    const result = mailStepResult(
      PLAN,
      {
        kind: 'waits',
        waits: [{ kind: 'account' }, { kind: 'instrument', symbols: ['DEF', 'DEF'] }, { kind: 'undone' }],
      },
      { fresh: 4, changed: 0, asked: 0 },
      null,
    )
    expect(result).toEqual({
      kind: 'waits',
      line: 'Read 1 mail: 4 new for review. Waits for you: pick an account and pick a holding for DEF.',
      writeId: null,
      link: { label: '4 records to review', to: INVESTMENTS_OVERVIEW_ROUTE },
    })
  })

  it('waits for rates it could not fetch', () => {
    expect(mailStepResult(PLAN, { kind: 'waits', waits: [{ kind: 'rates', currencies: ['USD'] }] }, { fresh: 2, changed: 0, asked: 0 }, null)).toMatchObject({
      kind: 'waits',
      line: 'Read 1 mail: 2 new for review. Waits for you: fetch the ECB rates of USD again.',
    })
  })

  it('says another device imported the report first when the write was refused for that', () => {
    expect(mailStepResult(PLAN, { kind: 'refused', reason: refusalWords.importKeyHeld }, NOTHING_LEFT, null)).toEqual({
      kind: 'waits',
      line: `Read 1 mail: nothing new. ${words.step.importedElsewhere}`,
      writeId: null,
      link: MAIL_LIST_LINK,
    })
  })

  it('fails while a file of the mail does not fit, whatever else is left', () => {
    const misfit: MailReportPlan = {
      ...PLAN,
      mails: [...PLAN.mails, { mail: { id: 'mail-2', subject: 'Activity Flex', date: 1_780_000_200_000 }, kind: 'misfit', fileName: 'other.xml', misfit: { kind: 'no-section', section: 'Trades' } }],
    }
    expect(mailStepResult(misfit, { kind: 'waits', waits: [{ kind: 'misfit' }] }, NOTHING_LEFT, null)).toMatchObject({ kind: 'failed', link: MAIL_LIST_LINK })
  })
})
