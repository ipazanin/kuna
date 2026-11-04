import { ASSET_KINDS, HOUSE_REGIONS } from './asset'
import type { Asset } from './asset'
import { ASSET_RECORDS } from './assetKinds'
import { labelWords, withIdField } from '../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import { amountText, filledFields } from '../../../../shared/storage/domain/recordFields'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { optionalDate, optionalMoney, ownId, refuse, requiredChoice, textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'
import { words as storedWords } from '../../../../shared/storage/domain/words'
import { words } from './words'

/** A bare UUID, as Loans keeps the id of a bank loan. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function assetOf(fields: StoredFields, id: RecordId | null): Asset {
  const name = textOf(fields.name)
  if (name === '') refuse(storedWords.reasons.none('name', ''))
  const kind = requiredChoice(fields, 'kind', ASSET_KINDS, 'kind of asset')
  const bought = optionalDate(fields, 'bought')
  const price = optionalMoney(fields, 'price')
  if (price !== null && price <= 0) refuse(storedWords.reasons.notAboveZero('price'))
  if (price !== null && bought === null) refuse(words.priceWithoutBought)
  if (fields.region !== undefined && kind !== 'home') refuse(words.regionNotHome)
  if (fields.first_registration !== undefined && kind !== 'car') refuse(words.registrationNotCar)
  const loan = textOf(fields.loan)
  if (loan !== '' && !UUID.test(loan)) refuse(words.notALoan(loan))
  return {
    id: ownId(id),
    name,
    kind,
    bought,
    price,
    region: fields.region === undefined ? null : requiredChoice(fields, 'region', HOUSE_REGIONS),
    firstRegistration: optionalDate(fields, 'first_registration'),
    loan: loan === '' ? null : loan,
    note: textOf(fields.note),
  }
}

export const ASSET_CODEC: RecordCodec<Asset> = withIdField(
  ASSET_RECORDS,
  (fields) => labelWords([textOf(fields.name)]),
  assetOf,
  (asset) =>
    filledFields({
      name: asset.name,
      kind: asset.kind,
      bought: asset.bought,
      price: asset.price === null ? null : amountText(asset.price),
      region: asset.region,
      first_registration: asset.firstRegistration,
      loan: asset.loan,
      note: asset.note,
    }),
)
