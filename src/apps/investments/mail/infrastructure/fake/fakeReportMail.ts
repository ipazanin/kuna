import { sampleFlexReport } from './sampleFlexReport'
import type { SampleFlexShape } from './sampleFlexReport'
import { addDays, today } from '../../../../../shared/calendar/civilDate'
import type { Mailbox } from '../../../../../shared/mail-filing/application/mailFiling'
import { fakeMailboxOf } from '../../../../../shared/mail-filing/infrastructure/fake/fakeMail'
import type { FakeMail } from '../../../../../shared/mail-filing/infrastructure/fake/fakeMail'

/** Two made-up daily mails whose files overlap by a day, as a rolling report's do. */
function reportMails(shape: SampleFlexShape): FakeMail[] {
  const now = today()
  const [first, second, third] = [addDays(now, -4), addDays(now, -3), addDays(now, -2)]
  const mail = (id: string, day: string, days: readonly string[]): FakeMail => ({
    id,
    subject: `Activity Flex ${day}`,
    at: `${day}T06:30:00Z`,
    attachments: [{ name: `activity-flex-${day}.xml`, content: JSON.stringify({ days, shape }) }],
    filed: false,
  })
  return [mail('flex-1', second, [first, second]), mail('flex-2', third, [second, third])]
}

/**
 * The fake build's Gmail for IBKR's report, for `?investments=mail`. `?fake=flex-unseen` adds rows of kinds no real report
 * has shown yet, `?fake=flex-misfit` mails a report without its Trades section, and `?fake=flex-none` finds no mail.
 */
export function fakeReportMailbox(variant: string | null): Mailbox {
  const shape: SampleFlexShape = variant === 'flex-unseen' ? 'unseen' : variant === 'flex-misfit' ? 'no-trades-section' : 'plain'
  return fakeMailboxOf(
    {
      mails: variant === 'flex-none' ? [] : reportMails(shape),
      failingSearchPhrase: '',
      bytesOf: (content) => {
        const { days, shape: fileShape } = JSON.parse(content) as { days: Parameters<typeof sampleFlexReport>[0]; shape: SampleFlexShape }
        return new TextEncoder().encode(sampleFlexReport(days, fileShape)).buffer as ArrayBuffer
      },
    },
    variant,
  )
}
