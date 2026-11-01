import type { FundMixLine } from './fundMix'
import { decimalField, groupField, mixGroupOf, namedInstrument, percentField } from './investmentFields'
import { FUND_MIX_RECORDS, INSTRUMENT_RECORDS } from './investmentKinds'
import { FUND_MIXES } from './mixGroup'
import { words } from './words'
import { withIdField } from '../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import { filledFields } from '../../../../shared/storage/domain/recordFields'
import { keyOfRecordId } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { ownId } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'

export function fundMixLineOf(fields: StoredFields, id: RecordId | null): FundMixLine {
  return {
    id: ownId(id),
    instrument: namedInstrument(fields, 'instrument'),
    slice: mixGroupOf(fields, FUND_MIXES),
    percent: percentField(fields, 'percent'),
  }
}

export const FUND_MIX_CODEC: RecordCodec<FundMixLine> = withIdField(FUND_MIX_RECORDS, words.labels.share, fundMixLineOf, (line) =>
  filledFields({
    instrument: keyOfRecordId(INSTRUMENT_RECORDS, line.instrument),
    mix: line.slice.mix,
    group: groupField(line.slice),
    percent: decimalField(line.percent),
  }),
)
