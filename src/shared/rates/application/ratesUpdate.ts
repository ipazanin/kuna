import type { RatesDrive, RatesUpdatePorts } from './ratesPorts'
import { ecbRatesDue, withEcbAnswer } from '../domain/ratesDemand'
import type { RatesDemand } from '../domain/ratesDemand'
import { decodeRatesFile, emptyRatesFile, encodeRatesFile, sameRates } from '../domain/ratesFile'
import type { RatesFile, RatesFileRefusal } from '../domain/ratesFile'
import { mergeRates } from '../domain/ratesMerge'
import type { CurrencyCode } from '../../money/currencyCode'

/** The rates file on Drive to merge with, and the app's file a new one goes beside while there is no Kuna folder. */
export interface RatesOnDrive {
  readonly drive: RatesDrive
  readonly besideFileId: string
}

/**
 * What an update did: the file now in this browser, the currencies whose fetch failed, and how Drive went: not asked,
 * left alone, written, or holding a file Kuna cannot read, which it leaves as it is.
 */
export interface RatesUpdate {
  readonly file: RatesFile
  readonly failed: readonly CurrencyCode[]
  readonly drive: 'none' | 'unchanged' | 'sent' | { readonly refused: RatesFileRefusal }
}

/**
 * The one writer of the rates file. It merges this browser's copy with the file on Drive when given one, fetches what
 * the demand lacks, and writes each copy only when its rates changed.
 */
export async function updateRates(ports: RatesUpdatePorts, demand: RatesDemand, onDrive: RatesOnDrive | null): Promise<RatesUpdate> {
  const here = (await ports.cache.read()) ?? emptyRatesFile()
  const fileId = onDrive === null ? null : await onDrive.drive.find()
  const read = onDrive === null || fileId === null ? null : decodeRatesFile(await onDrive.drive.download(fileId))
  const there = read?.kind === 'read' ? read.file : null

  let file = there === null ? here : mergeRates(here, there)
  const failed: CurrencyCode[] = []
  const today = ports.today()
  for (const ask of ecbRatesDue(file, demand, today)) {
    const answer = await ports.ecbRates(ask.currency, ask.askFrom)
    if (answer.kind === 'rates') {
      file = withEcbAnswer(file, ask, answer.rates, today)
    } else {
      failed.push(ask.currency)
    }
  }

  const kept = sameRates(here, file) ? here : { ...file, writtenAt: ports.now() }
  if (kept !== here) await ports.cache.replace(kept)
  if (onDrive === null) return { file: kept, failed, drive: 'none' }
  if (read?.kind === 'refused') return { file: kept, failed, drive: { refused: read.reason } }
  // A file holding no rates is not worth making.
  if (sameRates(there ?? emptyRatesFile(), kept)) return { file: kept, failed, drive: 'unchanged' }
  const text = encodeRatesFile(kept)
  await (fileId === null ? onDrive.drive.create(text, onDrive.besideFileId) : onDrive.drive.overwrite(fileId, text))
  return { file: kept, failed, drive: 'sent' }
}
