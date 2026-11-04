import type { Asset } from './asset'
import type { Valuation } from './valuation'
import { recordKind } from '../../../../shared/storage/domain/recordKind'

export const ASSET_RECORDS = recordKind<Asset>('asset', {
  en: { one: 'asset', many: 'assets', article: 'an' },
  hr: { one: 'stavka imovine', of: 'stavke imovine', few: 'stavke imovine', other: 'stavki imovine', gender: 'feminine' },
})
export const VALUATION_RECORDS = recordKind<Valuation>('valuation', {
  en: { one: 'valuation', many: 'valuations', article: 'a' },
  hr: { one: 'procjena', of: 'procjene', few: 'procjene', other: 'procjena', gender: 'feminine' },
})
