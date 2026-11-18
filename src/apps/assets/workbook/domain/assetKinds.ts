import type { Asset } from './asset'
import type { AssetShare } from './assetShare'
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
export const ASSET_SHARE_RECORDS = recordKind<AssetShare>('asset-share', {
  en: { one: 'share change', many: 'share changes', article: 'a' },
  hr: { one: 'promjena udjela', of: 'promjene udjela', few: 'promjene udjela', other: 'promjena udjela', gender: 'feminine' },
})
