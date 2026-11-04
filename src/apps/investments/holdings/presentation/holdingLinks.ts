import type { HoldingFigures } from '../domain/holding'
import type { PortfolioFigures } from '../domain/portfolioFigures'
import type { Instrument } from '../../workbook/domain/instrument'
import { INSTRUMENT_RECORDS } from '../../workbook/domain/investmentKinds'
import { keyOfRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'

export const HOLDINGS_ROUTE = '/investments/holdings'
export const HOLDING_ROUTE = '/investments/holding'

/** A holding's page as a path with its query, which names the instrument by its bare UUID in `?instrument=`, so a sync step's link takes it too. */
export function holdingLink(instrument: Instrument): string {
  return `${HOLDING_ROUTE}?instrument=${keyOfRecordId(INSTRUMENT_RECORDS, instrument.id)}`
}

/** The holding the page's `?instrument=` names, or null when the file has no instrument by that id. */
export function holdingNamed(figures: PortfolioFigures, key: unknown): HoldingFigures | null {
  return typeof key === 'string' ? (figures.holdings.find((holding) => holding.instrument.id === recordIdOf(INSTRUMENT_RECORDS, key)) ?? null) : null
}
