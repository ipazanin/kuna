import { isDefinedBucket } from './bucket'
import type { DefinedBucket } from './bucket'

/** What each bucket is called in Croatian. */
export const CROATIAN_BUCKET_NAMES: Readonly<Record<DefinedBucket, string>> = {
  income: 'Prihodi',
  operating: 'Poslovni rashodi',
  taxes: 'Porezi',
  'owner-pay': 'Isplate vlasniku',
  financing: 'Financiranje',
  neutral: 'Neutralno',
}

/** A bucket's Croatian name, or what the file holds for a bucket the app does not know. */
export function croatianBucketName(bucket: string): string {
  return isDefinedBucket(bucket) ? CROATIAN_BUCKET_NAMES[bucket] : bucket
}

/** A bucket as a Croatian sentence names it, its name in quotes. */
export function croatianBucket(bucket: string): string {
  return `„${croatianBucketName(bucket)}”`
}
