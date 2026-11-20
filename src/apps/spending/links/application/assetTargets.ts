import type { AssetsOfApp, PublishedAsset } from '../../../../shared/app/assetTargets'
import type { RuleAssets } from '../domain/linkFiling'
import type { AppTargets, TargetsOfApp } from '../domain/linkTarget'
import type { ShownTarget } from './linkTargets'

/** An asset as Spending reads it, with the link and the page Assets gives it. */
function assetTargetOf({ link, name, kind, bought, to }: PublishedAsset): ShownTarget {
  return { kind: 'asset', link, name, assetKind: kind, bought, to }
}

/** Each app's assets as records a row can link to, under the app's id, each with its own wait, failure or not set up. */
export function assetTargetsFrom(published: readonly AssetsOfApp[]): readonly TargetsOfApp<ShownTarget>[] {
  return published.map(({ app, assets }): TargetsOfApp<ShownTarget> => {
    const targets: AppTargets<ShownTarget> = assets === null || typeof assets === 'string' ? assets : assets.map(assetTargetOf)
    return { app, targets }
  })
}

let readAssets: () => readonly AssetsOfApp[] = () => []

/** Keeps how Spending reads the assets other apps publish, which `app.ts` takes from what the shell hands over as Spending installs. */
export function readAssetsThrough(read: () => readonly AssetsOfApp[]): void {
  readAssets = read
}

/** The assets of every app that keeps them, as records a row can link to. */
export function assetTargets(): readonly TargetsOfApp<ShownTarget>[] {
  return assetTargetsFrom(readAssets())
}

/** The apps that keep assets, whose links a rule's rows take whether or not the app can be read, and the assets of those that can. */
export function ruleAssets(): RuleAssets {
  const apps = assetTargets()
  return { apps: apps.map(({ app }) => app), targets: apps.flatMap(({ targets }) => (targets === null || typeof targets === 'string' ? [] : targets)) }
}
