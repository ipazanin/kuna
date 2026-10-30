import { alphaVantage } from './alphaVantage'
import { ecb } from './ecb'
import { twelveData } from './twelveData'
import type { PriceVendor } from '../../application/priceVendor'

/** The vendors Kuna fetches closes and rates from, in the order Settings lists them. */
export const PRICE_VENDORS: readonly PriceVendor[] = [twelveData, alphaVantage, ecb]
