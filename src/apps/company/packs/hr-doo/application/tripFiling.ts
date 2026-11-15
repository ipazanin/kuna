import { yearOf } from '../../../../../shared/calendar/civilDate'
import { fileOnDrive, locateFiling } from '../../../documents/application/driveFiling'
import type { DriveFile, FilingDrive } from '../../../documents/application/driveFiling'
import type { Trip } from '../domain/trips/trip'

/**
 * Files a travel order's documents on Drive, in the folder of its issue year under the travel orders folder. Each goes over the file
 * of its name, since an order is printed again from the books after a change. A year folder the app cannot see opens the Picker on
 * the travel orders folder, and when none is picked the app makes it.
 */
export async function fileTripDocuments(drive: FilingDrive, rootId: string, trip: Pick<Trip, 'issued'>, files: readonly DriveFile[]): Promise<void> {
  const year = String(yearOf(trip.issued))
  for (const file of files) {
    const path = { folders: [year], fileName: file.name }
    const found = await locateFiling(drive, rootId, path, new Set())
    const located = found.kind === 'found' ? found : await locateFiling(drive, rootId, path, new Set([year]))
    if (located.kind === 'hidden') throw new RangeError(`The year folder ${year} was neither found nor made.`)
    await fileOnDrive(drive, { target: located.target }, file, true)
  }
}
