import type { AppContribution, CountedHubPart, HubPart, HubState } from '../../shared/app/appContribution'
import { installedApps } from '../routing/appRegistry'

/** An app as Net worth reads it: whether it is set up, its currency and its figures. */
export interface HubApp<Part extends HubPart> {
  readonly app: AppContribution
  readonly name: string
  readonly notSetUp: boolean
  readonly currency: string
  readonly figures: HubState<Part>
}

/** The app as Net worth reads it now. An app not set up has no figures. */
export function hubAppOf<Part extends HubPart>(app: AppContribution, figures: () => HubState<Part>): HubApp<Part> {
  const notSetUp = app.firstRun()
  return { app, name: app.name, notSetUp, currency: app.moneyFormat().currency, figures: notSetUp ? null : failedOnThrow(figures) }
}

/** An app whose figures throw shows as failed, so the other apps' figures still show. */
function failedOnThrow<Part extends HubPart>(figures: () => HubState<Part>): HubState<Part> {
  try {
    return figures()
  } catch (failure) {
    console.error(failure)
    return 'failed'
  }
}

/** The installed apps whose figures add up into the sum, each with a function that reads them now. */
export function countedHubApps(): readonly { readonly app: AppContribution; read(): HubApp<CountedHubPart> }[] {
  return installedApps().flatMap((app) => {
    const { hub } = app
    return hub?.counts === true ? [{ app, read: () => hubAppOf(app, () => hub.figures()) }] : []
  })
}

/** The installed apps whose figures sit beside the sum, such as the company's, each with a function that reads them now. */
export function apartHubApps(): readonly { readonly app: AppContribution; read(): HubApp<HubPart> }[] {
  return installedApps().flatMap((app) => {
    const { hub } = app
    return hub?.counts === false ? [{ app, read: () => hubAppOf(app, () => hub.figures()) }] : []
  })
}
