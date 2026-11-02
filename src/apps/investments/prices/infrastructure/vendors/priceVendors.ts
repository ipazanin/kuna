import { alphaVantage } from './alphaVantage'
import { ecb } from './ecb'
import { finnhub } from './finnhub'
import { twelveData } from './twelveData'
import type { PriceVendor } from '../../application/priceVendor'

/** The vendors Kuna fetches closes, rates and facts from, in the order Settings lists them and a search asks them. */
export const PRICE_VENDORS: readonly PriceVendor[] = [twelveData, finnhub, alphaVantage, ecb]
