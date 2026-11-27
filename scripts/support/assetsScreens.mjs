/**
 * The visual check's Assets screens, with the ids of the sample Assets file's assets and the figures they must show.
 */

import { fakeLoansDocument } from '../../src/apps/loans/workbook/infrastructure/fake/fakeLoans.ts'
import { LOANS_DOCUMENT } from '../../src/apps/loans/workbook/infrastructure/loansDocument.ts'
import { yoursCaption } from '../../src/apps/assets/home/presentation/assetsHubFigures.ts'
import { houseIndexOfAnswer } from '../../src/apps/assets/houseIndex/infrastructure/dzsHouseIndex.ts'
import { FAKE_HOUSE_INDEX_ANSWER } from '../../src/apps/assets/houseIndex/infrastructure/fake/fakeHouseIndex.ts'
import { assetLoansOf } from '../../src/apps/assets/loans/application/assetLoans.ts'
import { assetsOnDay, assetsTotal } from '../../src/apps/assets/values/domain/assetsOnDay.ts'
import { valueCaption } from '../../src/apps/assets/values/presentation/valueCaption.ts'
import { ASSETS_DOCUMENT } from '../../src/apps/assets/workbook/infrastructure/assetsDocument.ts'
import { fakeAssetsDocument } from '../../src/apps/assets/workbook/infrastructure/fake/fakeAssets.ts'
import { bankLoansOf } from '../../src/apps/loans/facts.ts'
import { today } from '../../src/shared/calendar/civilDate.ts'
import { formatMoney } from '../../src/shared/money/moneyFormat.ts'
import { MADE_UP_ANTHROPIC_KEY } from './chatFlows.mjs'
import { CROATIAN_MONEY, INVESTMENTS_DAY } from './visualCommon.mjs'

/** The ids of the sample Assets file's flat, linked to the sample Home loan, and its car, `?assets=sample`. */
const SAMPLE_FLAT = 'fa4e2000-0000-4000-8000-000000000001'
export const SAMPLE_CAR = 'fa4e2000-0000-4000-8000-000000000002'
/** The sample's inherited plot, whose notary a row of `?spending=assets` paid as part of what it cost. */
const SAMPLE_PLOT = 'fa4e2000-0000-4000-8000-000000000004'
/** The flat on the coast of the co-owned Assets set, still yours at a half. */
const SEASIDE_FLAT = 'fa4e2000-0000-4000-8000-000000000005'
export const FAKE_HOUSE_INDEX = houseIndexOfAnswer(FAKE_HOUSE_INDEX_ANSWER)

/** The sample Assets file and the sample Loans file's bank loans as Assets reads them, on the check's day. */
export function fakeAssets(set = 'sample') {
  const at = `${INVESTMENTS_DAY}T09:00:00.000Z`
  const meta = { id: 'visual', source: 'browser', title: 'visual', syncedAt: at }
  return {
    book: ASSETS_DOCUMENT.read({ meta, document: fakeAssetsDocument(at, set) }).workbook,
    loans: assetLoansOf(bankLoansOf(LOANS_DOCUMENT.read({ meta, document: fakeLoansDocument(at) }).workbook, today())),
  }
}

/**
 * The sample Assets file's figures, worked out with the functions its screens call: what the assets are worth beside the
 * sample Loans file and alone, the flat with what is owed on the Home loan and what is yours, the flat at its price
 * while the index fails, and the car by the customs table. Money comes in English and in Croatian.
 */
function fakeAssetsShows() {
  const { book, loans } = fakeAssets()
  const total = assetsTotal(book, today(), FAKE_HOUSE_INDEX, loans)
  const [flat, car] = assetsOnDay(book, today(), FAKE_HOUSE_INDEX, loans)
  const both = (cents) => ({ english: formatMoney(cents), croatian: formatMoney(cents, 'negative', CROATIAN_MONEY) })
  return {
    total: both(total.value),
    alone: both(assetsTotal(book, today(), FAKE_HOUSE_INDEX, null).value),
    yours: yoursCaption(total.yoursAfter),
    flat: { value: both(flat.value.cents), caption: valueCaption(flat.value), owed: both(flat.equity.owed), yours: both(flat.equity.yours), price: both(flat.asset.price) },
    car: { value: both(car.value.cents), caption: valueCaption(car.value) },
  }
}

export const ASSETS = fakeAssetsShows()

export const assetsScreens = [
  {
    name: 'assets-settings-assist',
    query: 'assets=sample&loans=sample',
    hash: '#/assets/settings?tab=assistant',
    title: 'Settings',
    charts: 0,
    ready: '[data-testid="assist-allowed"][data-allowed="false"]',
    stored: { 'kuna.secret.anthropic': MADE_UP_ANTHROPIC_KEY },
    shows: [
      'Uses your Anthropic key, straight from this browser.',
      'Kuna asks once in each chat before it reads your records and sends to Anthropic.',
      'records and figures from Assets the chat asks for',
    ],
    cards: false,
  },
  {
    name: 'assets-settings-assist-croatian',
    query: 'assets=sample&loans=sample&lang=hr',
    hash: '#/assets/settings?tab=assistant',
    title: 'Postavke',
    charts: 0,
    ready: '[data-testid="assist-allowed"][data-allowed="false"]',
    stored: { 'kuna.secret.anthropic': MADE_UP_ANTHROPIC_KEY },
    shows: [
      'Koristi vaš ključ za Anthropic, izravno iz ovog preglednika.',
      'Kuna jednom u svakom razgovoru pita prije nego što pročita vaše zapise i pošalje ih tvrtki Anthropic.',
      'zapisi i iznosi iz aplikacije Imovina',
    ],
    cards: false,
  },
]

export const assetsSourceScreens = [
  { name: 'assets-start', hash: '#/assets', title: 'Assets', charts: 0, shows: ['Where the Assets file lives', 'A new file on Google Drive', 'My file on Google Drive'], cards: false },
  {
    name: 'assets-start-croatian',
    query: 'lang=hr',
    hash: '#/assets',
    title: 'Imovina',
    charts: 0,
    shows: ['Gdje se čuva datoteka imovine', 'Nova datoteka na Google Driveu', 'Moja datoteka na Google Driveu'],
    cards: false,
  },
  { name: 'assets-overview-empty', query: 'assets=drive', hash: '#/assets', title: 'Overview', charts: 0, shows: ['No assets yet', 'Add an asset', 'kuna-assets.json'], cards: false },
  {
    name: 'assets-overview-empty-croatian',
    query: 'assets=drive&lang=hr',
    hash: '#/assets',
    title: 'Pregled',
    charts: 0,
    shows: ['Još nema imovine', 'Dodaj imovinu', 'kuna-assets.json'],
    cards: false,
  },
  {
    name: 'assets-overview',
    query: 'assets=sample&loans=sample',
    hash: '#/assets',
    title: 'Overview',
    charts: 0,
    shows: ['Assets value', ASSETS.total.english, ASSETS.yours, ASSETS.flat.value.english, ASSETS.car.value.english, 'No value yet', '1 asset without a value'],
    cards: false,
  },
  {
    name: 'assets-overview-croatian',
    query: 'assets=sample&loans=sample&lang=hr',
    hash: '#/assets',
    title: 'Pregled',
    charts: 0,
    shows: ['Vrijednost imovine', ASSETS.total.croatian, ASSETS.flat.value.croatian, ASSETS.car.value.croatian, 'Još nema vrijednosti', '1 stavka imovine bez vrijednosti'],
    cards: false,
  },
  {
    name: 'assets-flat',
    query: 'assets=sample&loans=sample',
    hash: `#/assets/asset?asset=${SAMPLE_FLAT}`,
    title: 'Flat in Zagreb',
    charts: 0,
    shows: [ASSETS.flat.value.english, ASSETS.flat.caption, 'Owed on the Home loan', ASSETS.flat.owed.english, 'Yours after the loan', ASSETS.flat.yours.english, 'Valuations'],
    lacks: ['Your part'],
  },
  {
    name: 'assets-flat-croatian',
    query: 'assets=sample&loans=sample&lang=hr',
    hash: `#/assets/asset?asset=${SAMPLE_FLAT}`,
    title: 'Flat in Zagreb',
    charts: 0,
    shows: [ASSETS.flat.value.croatian, 'preračunato na', 'Dug po kreditu „Home loan”', ASSETS.flat.owed.croatian, 'Vaše nakon kredita', ASSETS.flat.yours.croatian, 'Procjene'],
  },
  {
    name: 'assets-flat-no-loans',
    query: 'assets=sample',
    hash: `#/assets/asset?asset=${SAMPLE_FLAT}`,
    title: 'Flat in Zagreb',
    charts: 0,
    shows: [ASSETS.flat.value.english, ASSETS.flat.caption],
  },
  {
    name: 'assets-flat-loan-gone',
    query: 'assets=loan-gone&loans=sample',
    hash: `#/assets/asset?asset=${SAMPLE_FLAT}`,
    title: 'Flat in Zagreb',
    charts: 0,
    shows: [ASSETS.flat.value.english, 'Its loan is no longer in Loans'],
  },
  {
    name: 'assets-flat-index-failed',
    query: 'assets=sample&loans=sample&index=failed',
    hash: `#/assets/asset?asset=${SAMPLE_FLAT}`,
    title: 'Flat in Zagreb',
    charts: 0,
    shows: [ASSETS.flat.price.english, 'Price paid on 15 Mar 2025', 'The DZS index did not load, so flats show their valuation or the price paid.'],
  },
  {
    name: 'assets-flat-loans-opening',
    query: 'assets=sample&loans=opening',
    hash: `#/assets/asset?asset=${SAMPLE_FLAT}`,
    title: 'Flat in Zagreb',
    charts: 0,
    shows: [ASSETS.flat.value.english, 'Waiting for Loans to open'],
  },
  {
    name: 'assets-flat-index-opening',
    query: 'assets=sample&loans=sample&index=opening',
    hash: `#/assets/asset?asset=${SAMPLE_FLAT}`,
    title: 'Flat in Zagreb',
    charts: 0,
    ready: '[data-testid="asset-value-waiting"]',
  },
  {
    name: 'assets-overview-index-opening-croatian',
    query: 'assets=sample&loans=sample&index=opening&lang=hr',
    hash: '#/assets',
    title: 'Pregled',
    charts: 0,
    ready: '[data-testid="assets-value-waiting"]',
    shows: 'Čeka se indeks DZS-a',
    cards: false,
  },
  {
    name: 'assets-car',
    query: 'assets=sample&loans=sample',
    hash: `#/assets/asset?asset=${SAMPLE_CAR}`,
    title: 'Family car',
    charts: 0,
    shows: [ASSETS.car.value.english, ASSETS.car.caption, 'First registration'],
  },
  {
    name: 'assets-car-linked',
    query: 'assets=sample&loans=sample&spending=assets',
    hash: `#/assets/asset?asset=${SAMPLE_CAR}`,
    title: 'Family car',
    charts: 0,
    shows: ['What it earned and cost', 'So far this year', 'Of its value'],
  },
  {
    name: 'assets-car-linked-croatian',
    query: 'assets=sample&loans=sample&spending=assets&lang=hr',
    hash: `#/assets/asset?asset=${SAMPLE_CAR}`,
    title: 'Family car',
    charts: 0,
    shows: ['Zarada i troškovi', 'Ova godina do sada', 'Od vrijednosti'],
  },
  {
    name: 'assets-plot-paid',
    query: 'assets=sample&loans=sample&spending=assets',
    hash: `#/assets/asset?asset=${SAMPLE_PLOT}`,
    title: 'Plot by the sea',
    charts: 0,
    shows: ['Paid from your accounts'],
  },
  {
    name: 'assets-plot-paid-croatian',
    query: 'assets=sample&loans=sample&spending=assets&lang=hr',
    hash: `#/assets/asset?asset=${SAMPLE_PLOT}`,
    title: 'Plot by the sea',
    charts: 0,
    shows: ['Plaćeno s vaših računa'],
  },
  {
    name: 'assets-car-croatian',
    query: 'assets=sample&loans=sample&lang=hr',
    hash: `#/assets/asset?asset=${SAMPLE_CAR}`,
    title: 'Family car',
    charts: 0,
    shows: [ASSETS.car.value.croatian, 'Procjena prema carinskoj tablici', 'Prva registracija'],
  },
  {
    name: 'assets-flat-co-owned',
    query: 'assets=co-owned&loans=co-owned',
    hash: `#/assets/asset?asset=${SAMPLE_FLAT}`,
    title: 'Flat in Zagreb',
    charts: 0,
    shows: ['Your part', 'From the start', '50%', 'All of it', 'Bought out my brother'],
  },
  {
    name: 'assets-flat-co-owned-croatian',
    query: 'assets=co-owned&loans=co-owned&lang=hr',
    hash: `#/assets/asset?asset=${SAMPLE_FLAT}`,
    title: 'Flat in Zagreb',
    charts: 0,
    shows: ['Vaš dio', 'Od početka', 'Sve'],
  },
  {
    name: 'assets-seaside-co-owned',
    query: 'assets=co-owned&loans=co-owned',
    hash: `#/assets/asset?asset=${SEASIDE_FLAT}`,
    title: 'Flat on the coast',
    charts: 0,
    shows: ['Your part', '50% of the value', 'Owed on the Home loan', 'Your part of', 'Yours after the loan', 'From the start'],
  },
  {
    name: 'assets-seaside-co-owned-croatian',
    query: 'assets=co-owned&loans=co-owned&lang=hr',
    hash: `#/assets/asset?asset=${SEASIDE_FLAT}`,
    title: 'Flat on the coast',
    charts: 0,
    shows: ['Vaš dio', 'vrijednosti', 'Dug po kreditu „Home loan”', 'Vaš dio duga od', 'Vaše nakon kredita', 'Od početka'],
  },
  {
    name: 'assets-seaside-co-owned-loan-whole',
    query: 'assets=co-owned&loans=one-loan',
    hash: `#/assets/asset?asset=${SEASIDE_FLAT}`,
    title: 'Flat on the coast',
    charts: 0,
    shows: ['Your part', 'Owed on the Home loan', 'its loan counts whole until you give the loan your part in Loans'],
  },
  {
    name: 'assets-seaside-co-owned-loan-whole-croatian',
    query: 'assets=co-owned&loans=one-loan&lang=hr',
    hash: `#/assets/asset?asset=${SEASIDE_FLAT}`,
    title: 'Flat on the coast',
    charts: 0,
    shows: ['Vaš dio', 'Dug po kreditu „Home loan”', 'računa u cijelosti dok mu u Kreditima ne upišete svoj dio'],
  },
  {
    name: 'assets-overview-co-owned',
    query: 'assets=co-owned&loans=co-owned',
    hash: '#/assets',
    title: 'Overview',
    charts: 0,
    shows: ['Assets value', 'Flat in Zagreb', 'Flat on the coast', 'Family car', 'Your 50% of', 'Assets you own with others count at your part.'],
    cards: false,
  },
  {
    name: 'assets-overview-co-owned-croatian',
    query: 'assets=co-owned&loans=co-owned&lang=hr',
    hash: '#/assets',
    title: 'Pregled',
    charts: 0,
    shows: ['Vrijednost imovine', 'Flat in Zagreb', 'Flat on the coast', 'Family car', 'Vaš dio 50', 'Imovina koju posjedujete s drugima računa se po vašem dijelu.'],
    cards: false,
  },
  { name: 'assets-opening', query: 'assets=opening', hash: '#/assets', title: 'Overview', charts: 0, ready: '[data-testid="assets-loading"]', cards: false },
  { name: 'assets-failed', query: 'assets=failed', hash: '#/assets', title: 'Overview', charts: 0, cards: false },
  {
    name: 'assets-settings',
    query: 'assets=drive',
    hash: '#/assets/settings',
    title: 'Settings',
    charts: 0,
    ready: '[data-testid="assets-books-card"] [data-testid="drive-file-place"] a',
    shows: ['Assets file', 'kuna-assets.json', 'Switch storage'],
    cards: false,
  },
  {
    name: 'assets-settings-croatian',
    query: 'assets=drive&lang=hr',
    hash: '#/assets/settings',
    title: 'Postavke',
    charts: 0,
    ready: '[data-testid="assets-books-card"] [data-testid="drive-file-place"] a',
    shows: ['Datoteka imovine', 'kuna-assets.json', 'Promijeni mjesto'],
    cards: false,
  },
  {
    name: 'assets-settings-browser',
    query: 'fake=browser&assets=browser',
    hash: '#/assets/settings',
    title: 'Settings',
    charts: 0,
    shows: ['Assets file', 'Fake Assets file', 'Some changes are in no exported file yet'],
    cards: false,
  },
]
