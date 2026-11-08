import type { StrictSchema } from '../../../../shared/ai/domain/strictSchema'

/** A yearly rate as the bank writes it, which the screens' own rate parser reads. */
export const RATE: StrictSchema = { type: 'string', description: 'A yearly percent as the bank writes it, such as 3.18, with at most four decimals.' }
export const RATE_OR_NULL: StrictSchema = { type: ['string', 'null'], description: 'A yearly percent such as 3.18, or null to leave it.' }
