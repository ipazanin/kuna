import type { HubFigures } from '../../../../shared/app/appContribution'
import { shownPack } from '../../packs/packContribution'
import { presentedWorkbook } from '../../transactions/application/presentedWorkbook'
import { newestBookingOf } from '../../workbook/domain/workbook'
import type { Workbook } from '../../workbook/domain/workbook'
import { words } from './words'

/** What the owner could take out of the company on its newest booking, kept apart from the personal sum, or why there is no such figure. */
export function companyHubFigures(workbook: Workbook): HubFigures {
  const booked = presentedWorkbook(workbook)
  const asOf = newestBookingOf(booked.transactions)
  if (asOf === null) return { parts: [], notes: [words.noBooking] }
  const takeOut = shownPack(booked.settings).ownerTakeOut(booked, asOf)
  if (takeOut === null) return { parts: [], notes: [words.ownerPayOff] }
  if (takeOut.kind === 'missing') return { parts: [], notes: [takeOut.reason] }
  const { kind: _kind, ...part } = takeOut
  return { parts: [part], notes: [] }
}
