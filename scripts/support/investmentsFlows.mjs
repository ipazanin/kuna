/**
 * Investments' flows that the visual and the touch check share: price keys, deleting its data, instruments, imports,
 * mail and the dialogs. `press` clicks or taps an element handle, and `shoot` takes a screenshot under a name. A failure
 * throws with what was missing.
 */

import { FAKE_KEY_SAVED_AT } from '../../src/shared/secrets/infrastructure/fake/fakeSecrets.ts'
import { en as writesEnglish, hr as writesCroatian } from '../../src/shared/storage/presentation/words.ts'
import { en as storageInfrastructureEnglish, hr as storageInfrastructureCroatian } from '../../src/shared/storage/infrastructure/words.ts'
import { en as workbookImportEnglish, hr as workbookImportCroatian } from '../../src/apps/investments/imports/presentation/words.ts'
import { en as storageEnglish } from '../../src/shared/storage/application/words.ts'
import { settleCharts } from './settleCharts.mjs'
import { delay, pressSelector, typeDay } from './pressing.mjs'
import {
  DELETE_WORDS,
  INVESTMENTS,
  SYNC_CARD,
  SYNC_STEPS,
  checkboxState,
  chooseOption,
  chooseStartingWith,
  controlLanded,
  controlSaving,
  controlShows,
  dialogGone,
  dismissToasts,
  dropFile,
  elementSays,
  exactly,
  failureInView,
  fill,
  firstRunAt,
  goTo,
  googleGrants,
  lookAtDialog,
  noToast,
  openKunaSettings,
  pageSays,
  pressButton,
  pressLabelled,
  restoreGoogleGrants,
  focusIsIn,
  savingControl,
  scrollIntoDialogView,
  setField,
  settingsShowFile,
  shootAt,
  shotInLanguage,
  stepSays,
  syncAndSettle,
  syncButton,
  toast,
  toastMatching,
  undo,
  undoIn,
} from './flowHelpers.mjs'

/** Investments, Settings, with saves that take seconds: the benchmark select shows the choice at once, with a spinner at full colour. */
export async function savesWaitingBenchmarkFlow(page, { press, shoot }) {
  const selector = '[data-testid="benchmark-choice"]'
  const trigger = await page.waitForSelector(selector, { visible: true, timeout: 10_000 })
  const { value: was } = await savingControl(page, selector)
  await trigger.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await delay(200)
  await press(trigger)
  const option = await page.waitForFunction(
    (current) => [...document.querySelectorAll('[role="option"]')].find((candidate) => candidate.textContent?.trim() !== current) ?? null,
    { timeout: 5_000 },
    was,
  )
  await press(option.asElement())
  await controlSaving(page, selector, was)
  await shoot(await shotInLanguage(page, 'saves-waiting-benchmark'))
  await controlLanded(page, selector)
  if ((await savingControl(page, selector)).value === was) throw new Error('the select went back after its save landed')
}

/**
 * The Investments first run with the company books on the fake Drive: Investments opens on it, a new file on the fake
 * Drive lands in its Kuna folder as kuna-investments.json, the Investments Overview says it holds no transactions yet, and the
 * Investments Settings names the file.
 */
export async function investmentsDriveFlow(page, { press, shoot, inspect }) {
  await firstRunAt(page, INVESTMENTS, 'home')
  await inspect?.('the Investments first run')
  await shoot('investments-start')
  await chooseOption(page, press, 'investments-start-home', 'A new file on Google Drive')
  await pressSelector(page, press, '[data-testid="investments-start-continue"]')
  await firstRunAt(page, INVESTMENTS, 'folder')
  const confirm = await page.waitForSelector('[data-testid="investments-start-folder-confirm"]', { visible: true, timeout: 10_000 })
  const said = await confirm.evaluate((element) => element.textContent ?? '')
  if (!said.includes('Kuna › investments') || !said.includes('kuna-investments.json')) throw new Error(`the folder confirm says "${said}", not its Kuna folder and kuna-investments.json`)
  await inspect?.('the Investments folder confirm')
  await shoot('investments-start-folder')
  await pressSelector(page, press, '[data-testid="investments-start-create"]')
  await toastMatching(page, /^Created kuna-investments\.json in My Drive › Kuna › investments$/)
  await firstRunAt(page, INVESTMENTS, 'overview')
  await pageSays(page, 'on Google Drive as kuna-investments.json', true)
  await inspect?.('the empty Investments Overview')
  await shoot('investments-overview')
  await dismissToasts(page)
  await settingsShowFile(page, press, INVESTMENTS, 'kuna-investments.json')
  await inspect?.('the Investments Settings')
  await shoot('investments-settings')
}

/** A made-up Twelve Data key the Prices card is given, whose whole text must never come back on screen. */
const MADE_UP_PRICE_KEY = 'made-up-twelve-data-key-7319'
const MADE_UP_FINNHUB_KEY = 'made-up-finnhub-key-5521'

/**
 * Investments Settings, Prices, on the sample: a Twelve Data key typed and saved shows only how it ends and empties its
 * field, Test asks the fake build's responder and says the key works, and Remove forgets it. A Finnhub key does the
 * same, its Test asking for a profile. Fetch now then finds every series up to date and nothing missing.
 */
export async function investmentsPriceKeyFlow(page, { press, shoot, inspect }) {
  const vendor = '[data-testid="investments-prices-card"] [data-vendor="twelvedata"]'
  await page.waitForSelector(`${vendor} [data-testid="price-vendor-key"]`, { visible: true, timeout: 10_000 })
  const input = await pressSelector(page, press, `${vendor} [data-testid="price-vendor-key"]`)
  await input.type(MADE_UP_PRICE_KEY)
  const fieldType = await page.$eval(`${vendor} [data-testid="price-vendor-key"]`, (element) => element.type)
  if (fieldType !== 'password') throw new Error(`the key field is type "${fieldType}", not password`)
  await inspect?.('a price vendor key typed')
  await pressSelector(page, press, `${vendor} [data-testid="price-vendor-save"]`)
  await pageSays(page, 'A key ending in 7319 is kept in this browser.', true)
  const left = await page.$eval(`${vendor} [data-testid="price-vendor-key"]`, (element) => element.value)
  if (left !== '') throw new Error(`the key field still holds "${left}" after Save`)
  const shown = await page.evaluate((key) => document.body.innerText.includes(key) || [...document.querySelectorAll('input')].some((element) => element.value === key), MADE_UP_PRICE_KEY)
  if (shown) throw new Error('the whole key came back on screen after Save')
  const kept = await page.evaluate(() => localStorage.getItem('kuna.secret.twelvedata'))
  if (kept !== MADE_UP_PRICE_KEY) throw new Error(`this browser keeps "${kept}" as the Twelve Data key`)
  await pressSelector(page, press, `${vendor} [data-testid="price-vendor-test"]`)
  await page
    .waitForFunction((selector) => document.querySelector(selector)?.textContent?.trim() === 'The key works.', { timeout: 10_000 }, `${vendor} [data-testid="price-vendor-test-result"]`)
    .catch(() => {
      throw new Error('Test against the fake responder does not say the key works')
    })
  await inspect?.('a price vendor key tested')
  await shoot('investments-price-key')
  await pressSelector(page, press, `${vendor} [data-testid="price-vendor-forget"]`)
  await pageSays(page, 'A key ending in 7319', false)
  const forgotten = await page.evaluate(() => localStorage.getItem('kuna.secret.twelvedata'))
  if (forgotten !== null) throw new Error('Remove left the key in this browser')

  const finnhub = '[data-testid="investments-prices-card"] [data-vendor="finnhub"]'
  const finnhubKey = await pressSelector(page, press, `${finnhub} [data-testid="price-vendor-key"]`)
  await finnhubKey.type(MADE_UP_FINNHUB_KEY)
  await pressSelector(page, press, `${finnhub} [data-testid="price-vendor-save"]`)
  await pageSays(page, 'A key ending in 5521 is kept in this browser.', true)
  await pressSelector(page, press, `${finnhub} [data-testid="price-vendor-test"]`)
  await page
    .waitForFunction((selector) => document.querySelector(selector)?.textContent?.trim() === 'The key works.', { timeout: 10_000 }, `${finnhub} [data-testid="price-vendor-test-result"]`)
    .catch(() => {
      throw new Error("Test of Finnhub's profile against the fake responder does not say the key works")
    })
  await inspect?.('a Finnhub key tested')
  await pressSelector(page, press, `${finnhub} [data-testid="price-vendor-forget"]`)
  await pageSays(page, 'A key ending in 5521', false)
  if ((await page.evaluate(() => localStorage.getItem('kuna.secret.finnhub'))) !== null) throw new Error('Remove left the Finnhub key in this browser')
  // Remove keeps when it happened, so the removal outdates an older save in another browser. The next flows start without it.
  await page.evaluate(() => {
    for (const vendor of ['twelvedata', 'finnhub']) localStorage.removeItem(`kuna.secret-changed.${vendor}`)
  })

  await pressSelector(page, press, '[data-testid="prices-fetch-now"]')
  await toastMatching(page, /^Prices fetched$/)
  // The sample's closes run to the last trading day, so the fetch asks for nothing and needs no key.
  await pageSays(page, 'Every series was up to date, 7 in all.', true)
  await pageSays(page, 'The last fetch got nothing for', false)
  await inspect?.('the prices fetched with nothing missing')
  await dismissToasts(page)
}

const TWELVE_DATA_ROW = '[data-testid="investments-prices-card"] [data-vendor="twelvedata"]'

/** Forgets the Twelve Data key and the time of its last change in this browser, so the next flows start without them. */
async function forgetTwelveDataKey(page) {
  await page.evaluate(() => {
    localStorage.removeItem('kuna.secret.twelvedata')
    localStorage.removeItem('kuna.secret-changed.twelvedata')
  })
}

/**
 * The Prices tab on the sample, whose app folder on the fake Drive holds a made-up Twelve Data key another browser saved at
 * 10:00 (`?keys=other-browser`): the sync on open takes it, and the card shows its ending and says each sync saves the keys
 * to the Google account. Removed here and synced, it stays removed, since the removal is newer than that save.
 */
export async function investmentsKeyFromOtherBrowserFlow(page, { press, shoot, inspect }) {
  await page.waitForSelector(`${TWELVE_DATA_ROW}[data-kept="true"]`, { timeout: 10_000 }).catch(() => {
    throw new Error('the sync on open did not take the key another browser saved')
  })
  await pageSays(page, 'A key ending in 8642 is kept in this browser.', true)
  await pageSays(page, 'Each sync saves them to your Google account, hidden from Drive, so every browser you sign in to gets them.', true)
  const [key, changedAt] = await page.evaluate(() => [localStorage.getItem('kuna.secret.twelvedata'), localStorage.getItem('kuna.secret-changed.twelvedata')])
  if (key !== 'made-up-twelve-data-key-8642' || changedAt !== FAKE_KEY_SAVED_AT) throw new Error(`this browser keeps the key "${key}" changed at ${changedAt}, not the other browser's`)
  await inspect?.('a key synced from another browser')
  await shoot('investments-key-synced')

  await pressSelector(page, press, `${TWELVE_DATA_ROW} [data-testid="price-vendor-forget"]`)
  await page.waitForSelector(`${TWELVE_DATA_ROW}[data-kept="false"]`, { timeout: 5_000 })
  await syncAndSettle(page, press)
  await delay(300)
  if (await page.$(`${TWELVE_DATA_ROW}[data-kept="true"]`)) throw new Error("the sync brought back the key removed here after the other browser's older save")
  const [control, removedAt] = await page.evaluate(() => [
    [...document.querySelectorAll('[data-testid="sync-status"]')].find((element) => element.offsetParent !== null)?.dataset.control ?? '',
    localStorage.getItem('kuna.secret-changed.twelvedata'),
  ])
  if (control !== 'ready') throw new Error(`the sync after the removal ended as "${control}", so the Keys step may not have saved it`)
  if (removedAt === null || removedAt <= FAKE_KEY_SAVED_AT) throw new Error(`this browser keeps the removal at ${removedAt}, not newer than the other browser's save`)
  await inspect?.('a key removed here and synced')
  await forgetTwelveDataKey(page)
}

/**
 * The Prices tab on the sample with a made-up Twelve Data key this browser saved at 10:00, whose app folder on the fake
 * Drive holds another browser's removal of it at 10:05 (`?keys=removed`): the sync on open removes it here too.
 */
export async function investmentsKeyRemovedElsewhereFlow(page, { inspect }) {
  await page.evaluate((at) => {
    localStorage.setItem('kuna.secret.twelvedata', 'made-up-twelve-data-key-0042')
    localStorage.setItem('kuna.secret-changed.twelvedata', at)
  }, FAKE_KEY_SAVED_AT)
  await page.goto(page.url().replace(/load=\d+/, `load=${Date.now()}`), { waitUntil: 'networkidle0' })
  await page.waitForSelector(`${TWELVE_DATA_ROW}[data-kept="false"]`, { timeout: 10_000 }).catch(() => {
    throw new Error('the sync on open kept the key another browser removed later')
  })
  await pageSays(page, 'A key ending in 0042', false)
  const [key, changedAt] = await page.evaluate(() => [localStorage.getItem('kuna.secret.twelvedata'), localStorage.getItem('kuna.secret-changed.twelvedata')])
  if (key !== null || changedAt !== '2026-10-30T10:05:00.000Z') throw new Error(`this browser keeps the key "${key}" changed at ${changedAt} after the other browser's removal`)
  await inspect?.("a key lost to another browser's removal")
  await forgetTwelveDataKey(page)
}

const FINNHUB_ROW = '[data-testid="investments-prices-card"] [data-vendor="finnhub"]'

/** Waits until the fake hidden folder holds only the secrets file, the sync having folded the old keys file into it and deleted it. */
async function onlySecretsFileLeft(page) {
  await page
    .waitForFunction(async () => (await window.kunaFakeHiddenFiles()).join() === 'kuna-secrets.json', { timeout: 10_000, polling: 200 })
    .catch(async () => {
      const left = await page.evaluate(() => window.kunaFakeHiddenFiles())
      throw new Error(`the hidden folder holds ${left.join(', ') || 'nothing'} after the sync, not kuna-secrets.json alone`)
    })
}

/**
 * The Prices tab on the sample, whose app folder on the fake Drive holds only the old keys file of the Investments file,
 * with a made-up Twelve Data key (`?keys=legacy`): the sync on open takes the key, writes it to the secrets file and
 * deletes the old file.
 */
export async function investmentsKeyLegacyFlow(page, { shoot, inspect }) {
  await page.waitForSelector(`${TWELVE_DATA_ROW}[data-kept="true"]`, { timeout: 10_000 }).catch(() => {
    throw new Error('the sync on open did not take the key the old keys file held')
  })
  await pageSays(page, 'A key ending in 5307 is kept in this browser.', true)
  await onlySecretsFileLeft(page)
  await inspect?.('a key taken from the old keys file')
  await shoot('investments-key-legacy')
  await forgetTwelveDataKey(page)
}

/**
 * The Prices tab on the sample, whose app folder holds both files (`?keys=legacy-and-new`): the secrets file with a
 * Twelve Data key saved at 10:00, and the old keys file with a newer Twelve Data key at 10:05 and a Finnhub key. The sync
 * on open keeps the newer key of each vendor, so both rows show the old file's keys, and only the secrets file is left.
 */
export async function investmentsKeyLegacyAndNewFlow(page, { shoot, inspect }) {
  await page.waitForSelector(`${FINNHUB_ROW}[data-kept="true"]`, { timeout: 10_000 }).catch(() => {
    throw new Error('the sync on open did not take the Finnhub key the old keys file held')
  })
  await pageSays(page, 'A key ending in 5307 is kept in this browser.', true)
  await pageSays(page, 'A key ending in 7720 is kept in this browser.', true)
  await pageSays(page, 'A key ending in 8642', false)
  await onlySecretsFileLeft(page)
  await inspect?.('the newer key of each vendor from both files')
  await shoot('investments-key-legacy-and-new')
  await forgetTwelveDataKey(page)
  await page.evaluate(() => {
    localStorage.removeItem('kuna.secret.finnhub')
    localStorage.removeItem('kuna.secret-changed.finnhub')
  })
}

const DELETE_DIALOG = '[data-testid="delete-data-dialog"]'

/** The IndexedDB databases this browser holds for Investments files, by name. */
async function investmentsDatabases(page) {
  return page.evaluate(async () => (await indexedDB.databases()).map((database) => database.name ?? '').filter((name) => name.startsWith('kuna-')))
}

/** Opens Delete this app's data on the app's Settings and waits for its dialog to name what it offers and what stays. */
async function openDeleteDialog(page, press, says) {
  await pressSelector(page, press, '[data-testid="delete-data"]')
  await elementSays(page, DELETE_DIALOG, says, 'the delete dialog does not name what it offers and what stays')
  await delay(300)
}

/**
 * Investments Settings on the sample on the fake Drive, whose secrets file another browser left in the app's hidden folder (`?keys=other-browser`),
 * so the sync on open brings a made-up Twelve Data key into this browser. The delete offers the Drive file, with the copy going along, and a backup,
 * and Cancel keeps the file. Delete then moves the file and its prices file to the bin, and this browser lands on the first run with its copy
 * and its prices gone, the vendor key still kept and the secrets file still in the hidden folder, since every app uses it.
 */
export function deleteDataDriveFlowIn(language) {
  const text = DELETE_WORDS[language]
  const says = [text.driveFile('kuna-investments.json'), text.driveFileGoesBeside('kuna-investments-prices.json'), text.staysDrive, text.otherBrowser]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    // A step before this one, with no Investments file on Drive, leaves needs without drive.appdata, and the silent token on open carries only those.
    await page.evaluate(() => localStorage.removeItem('kuna.google-needed'))
    await page.reload({ waitUntil: 'networkidle0' })
    await page
      .waitForFunction(() => localStorage.getItem('kuna.secret.twelvedata') !== null, { timeout: 10_000 })
      .catch(() => {
        throw new Error('the sync on open did not take the key another browser saved')
      })
    const grants = await googleGrants(page)
    const before = await investmentsDatabases(page)
    if (!before.some((name) => name.startsWith('kuna-prices-'))) throw new Error(`this browser keeps no prices of the sample, only ${before.join(', ')}`)
    await openDeleteDialog(page, press, says)
    await elementSays(page, '[role="dialog"]', [text.binRule], 'the dialog does not state the bin rule at its top')
    if ((await page.$('[data-testid="delete-data-copy-investments"]')) !== null) throw new Error('the copy still has a row of its own while the Drive file is ticked')
    await inspect?.('the delete asking first for a file on Drive')
    await shoot('delete-data-drive')
    await pressSelector(page, press, '[data-testid="delete-data-backup-investments"]')
    await page
      .waitForFunction((wanted) => document.querySelector('[data-testid="delete-data-backup-investments"]')?.textContent?.includes(wanted) === true, { timeout: 5_000 }, text.exported)
      .catch(() => {
        throw new Error('the export button does not say it downloaded')
      })
    if (
      !(await page.$eval(
        '[data-testid="delete-data-backup-investments"]',
        (button) => button.getAttribute('aria-label')?.includes('Ulaganja') || button.getAttribute('aria-label')?.includes('Investments'),
      ))
    )
      throw new Error('the export button does not name its app')
    await pressSelector(page, press, '[data-testid="delete-data-cancel"]')
    await dialogGone(page, DELETE_DIALOG)
    if ((await page.$('[data-testid="investments-books-card"]')) === null) throw new Error('Cancel left the Investments Settings')

    await openDeleteDialog(page, press, says)
    await pressSelector(page, press, '[data-testid="delete-data-confirm"]')
    await toastMatching(page, exactly(text.deleted(language === 'hr' ? 'Ulaganja' : 'Investments')))
    await firstRunAt(page, INVESTMENTS, 'home')
    const [choice, key] = await page.evaluate(() => [localStorage.getItem('kuna.workbook-file.investments'), localStorage.getItem('kuna.secret.twelvedata')])
    if (choice !== null) throw new Error(`this browser still names an Investments file after the delete: ${choice}`)
    if (key !== 'made-up-twelve-data-key-8642') throw new Error('the delete took the vendor key kept in this browser')
    const hidden = await page.evaluate(() => window.kunaFakeHiddenFiles())
    if (!hidden.includes('kuna-secrets.json')) throw new Error(`the delete took the secrets file from the hidden folder, which holds ${hidden.join(', ') || 'nothing'}`)
    const after = await investmentsDatabases(page)
    if (after.some((name) => name.startsWith('kuna-prices-'))) throw new Error(`the prices kept in this browser stayed after the delete: ${after.join(', ')}`)
    await inspect?.('the Investments first run after the delete')
    await shoot('delete-data-drive-done')
    await dismissToasts(page)
    await forgetTwelveDataKey(page)
    await restoreGoogleGrants(page, grants)
  }
}

/** The sample on the fake Drive with the Drive file unticked: only this browser forgets it, and a find on the first run opens the same file again. */
export async function deleteDataCopyFlow(page, { press, shoot, inspect }) {
  const text = DELETE_WORDS.en
  await page.waitForSelector('[data-testid="investments-books-card"]', { visible: true, timeout: 10_000 })
  const grants = await googleGrants(page)
  await openDeleteDialog(page, press, [text.driveFile('kuna-investments.json')])
  await pressSelector(page, press, '[data-testid="delete-data-drive-investments"]')
  await elementSays(page, DELETE_DIALOG, [text.driveCopyGoes, text.staysOnDrive], 'unticking the Drive file does not say the file stays')
  const copy = await checkboxState(page, 'delete-data-copy-investments')
  if (!copy.checked || copy.disabled) throw new Error('unticking the Drive file does not offer the copy')
  await delay(300)
  await inspect?.('the delete with only the copy ticked')
  await shoot('delete-data-copy')
  await pressSelector(page, press, '[data-testid="delete-data-copy-investments"]')
  const confirm = await page.$eval('[data-testid="delete-data-confirm"]', (button) => button.disabled)
  if (!confirm) throw new Error('Delete can be pressed with nothing ticked')
  await pressSelector(page, press, '[data-testid="delete-data-copy-investments"]')
  await pressSelector(page, press, '[data-testid="delete-data-confirm"]')
  await toastMatching(page, exactly(text.deleted('Investments')))
  await firstRunAt(page, INVESTMENTS, 'home')
  await dismissToasts(page)
  await restoreGoogleGrants(page, grants)
}

/** A file someone shared with the person (`?investments=given`): Drive refuses the bin, the dialog says so and stays, and the copy and the app go on as before. */
export function deleteDataGivenFlowIn(language) {
  const text = DELETE_WORDS[language]
  const refusal = language === 'hr' ? storageInfrastructureCroatian.trashRefused : storageInfrastructureEnglish.trashRefused
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await page.waitForSelector('[data-testid="investments-books-card"]', { visible: true, timeout: 10_000 })
    await openDeleteDialog(page, press, [text.driveFile('kuna-investments.json')])
    await pressSelector(page, press, '[data-testid="delete-data-confirm"]')
    await page.waitForSelector('[data-testid="delete-data-failed"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('a refused bin does not say so')
    })
    await elementSays(
      page,
      DELETE_DIALOG,
      [text.stillHere, refusal, text.lineGone.besideFile('kuna-investments-prices.json')],
      'the delete does not say Drive refused, the copy stays and the prices file can be restored',
    )
    if ((await page.$eval(DELETE_DIALOG, (dialog) => dialog.textContent)).includes(text.tryAgain)) throw new Error('the delete offers a retry that cannot work for a file only its owner can bin')
    await failureInView(page, 'delete-data-failed')
    await delay(300)
    await inspect?.('the delete refused for a file someone shared')
    await shoot('delete-data-given')
    const before = await page.evaluate(() => localStorage.getItem('kuna.workbook-file.investments'))
    if (before === null) throw new Error('a refused bin forgot the file')
    const databases = await investmentsDatabases(page)
    if (!databases.some((name) => name.startsWith('kuna-workbook-'))) throw new Error(`a refused bin deleted the copy, leaving ${databases.join(', ')}`)
    await pressSelector(page, press, '[data-testid="delete-data-cancel"]')
    await dialogGone(page, DELETE_DIALOG)
    if ((await page.$('[data-testid="investments-books-card"]')) === null) throw new Error('a refused bin left the Investments Settings')
  }
}

/**
 * The sample kept in this browser (`?investments=browser`), with a second tab open on its Overview: the delete offers only the file here, and once
 * confirmed the file and its prices are gone, this tab lands on the first run and the other tab follows it there by itself.
 */
export async function deleteDataBrowserFlow(page, { press, shoot, inspect }) {
  const text = DELETE_WORDS.en
  await page.waitForSelector('[data-testid="investments-books-card"]', { visible: true, timeout: 10_000 })
  const grants = await googleGrants(page)
  const before = await investmentsDatabases(page)
  for (const name of ['kuna-document-local-fake-investments', 'kuna-prices-local-fake-investments']) {
    if (!before.includes(name)) throw new Error(`this browser holds no ${name} before the delete, only ${before.join(', ')}`)
  }
  const otherTab = await page.browserContext().newPage()
  try {
    await otherTab.goto(page.url().replace('#/investments/settings', '#/investments'), { waitUntil: 'networkidle0' })
    await otherTab.waitForSelector('[data-testid="investments-cards"]', { visible: true, timeout: 10_000 })
    await page.bringToFront()
    await openDeleteDialog(page, press, [text.browserFile, text.staysHere, text.staysBrowser])
    if (!(await page.$eval('[data-testid="delete-data-confirm"]', (button) => button.disabled))) throw new Error('Delete can be pressed before a file kept in this browser is ticked')
    await pressSelector(page, press, '[data-testid="delete-data-copy-investments"]')
    await elementSays(page, DELETE_DIALOG, [text.forGood, text.browserFileGoes], 'ticking the file kept here does not say it goes for good')
    if ((await page.$('[data-testid="delete-data-drive-investments"]')) !== null) throw new Error('a file kept in this browser offers a Drive file')
    await inspect?.('the delete asking first for a file kept in this browser')
    await shoot('delete-data-browser')
    await pressSelector(page, press, '[data-testid="delete-data-confirm"]')
    await toastMatching(page, exactly(text.deleted('Investments')))
    await firstRunAt(page, INVESTMENTS, 'home')
    await firstRunAt(otherTab, INVESTMENTS, 'home').catch(() => {
      throw new Error('the other open tab did not notice the delete')
    })
  } finally {
    await otherTab.close()
  }
  const after = await investmentsDatabases(page)
  const left = after.filter((name) => name.endsWith('local-fake-investments'))
  if (left.length > 0) throw new Error(`the delete left ${left.join(', ')} in this browser`)
  if ((await page.evaluate(() => localStorage.getItem('kuna.workbook-file.investments'))) !== null) throw new Error('this browser still names the Investments file after the delete')
  await inspect?.('the Investments first run after deleting the file kept here')
  await dismissToasts(page)
  await restoreGoogleGrants(page, grants)
}

/**
 * Another device's Investments file in the Drive bin (`?investments=binned`), read longer ago than a sync on open waits:
 * the sync on open finds it there and stops, the sync control counts the problem, the books step says so and links to
 * the Settings, and the Settings' file card says Kuna stopped using the file beside Switch storage, and the delete offers only this browser's copy.
 */
export async function investmentsBinnedFlow(page, { press, shoot, inspect }) {
  const control = await controlShows(page, 'problems')
  if (control.label !== '1 problem') throw new Error(`the sync control says "${control.label}", not 1 problem`)
  await press(await syncButton(page))
  const group = `${SYNC_STEPS} [data-group="investments"]`
  await page
    .waitForFunction(
      (css, wanted) => [...document.querySelectorAll(css)].some((line) => line.offsetParent !== null && line.dataset.state === 'failed' && line.textContent?.includes(wanted)),
      { timeout: 10_000 },
      `${group} [data-step="books"]`,
      storageEnglish.inBin,
    )
    .catch(() => {
      throw new Error('the Investments books step does not fail with the file in the bin')
    })
  const skipped = await page.$$eval(`${group} [data-step]`, (lines) => lines.filter((line) => line.offsetParent !== null).map((line) => `${line.dataset.step}:${line.dataset.state}`))
  if (skipped.some((line) => /^(keys|prices):(?!skipped|off)/.test(line))) throw new Error(`a step after the books ran on a file in the bin: ${skipped.join(', ')}`)
  await delay(400)
  await inspect?.('the steps of a sync that found the file in the bin')
  await shoot('investments-binned-steps')
  await pressButton(page, press, `${group} [data-step="books"] a`, 'Settings')
  await page.waitForSelector('[data-testid="books-file-missing"]', { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error('the Investments Settings do not say Kuna stopped using the file in the bin')
  })
  await page
    .waitForFunction((css) => ![...document.querySelectorAll(css)].some((element) => element.offsetParent !== null), { timeout: 5_000 }, SYNC_STEPS)
    .catch(() => {
      throw new Error('the sync steps stayed open after their link to the Settings')
    })
  await delay(300)
  if ((await page.$('[data-testid="investments-switch-storage"]')) === null) throw new Error('the Investments Settings offer no Switch storage beside the file in the bin')
  await inspect?.('the Investments Settings on a file in the bin')
  await shoot('investments-binned-settings')
  await openDeleteDialog(page, press, [DELETE_WORDS.en.driveCopy, DELETE_WORDS.en.missingCopyGoes])
  if ((await page.$('[data-testid="delete-data-drive-investments"]')) !== null) throw new Error('the delete offers a Drive file already in the bin')
  await pressSelector(page, press, '[data-testid="delete-data-cancel"]')
  await dialogGone(page, DELETE_DIALOG)
}

/**
 * Investments Settings on the sample, with a made-up Twelve Data key kept: Add a benchmark opens the holding dialog,
 * whose search asks the fake responder for ABC, and picking its listing fills the symbol, the name, the type proposed
 * from the vendor's Common Stock, the exchange and the currency. Escape closes the dialog without saving.
 */
export function investmentsInstrumentSearchFlowIn(language) {
  const croatian = language === 'hr'
  const share = croatian ? 'Dionica' : 'Share'
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(croatian ? `${name}-${language}` : name)
    await page.evaluate(() => localStorage.setItem('kuna.secret.twelvedata', 'made-up-twelve-data-key-0042'))
    await pressSelector(page, press, '[data-testid="benchmark-add"]')
    await page.waitForSelector('[data-testid="instrument-search"]', { visible: true, timeout: 10_000 })
    await shoot('investments-instrument-search-empty')
    await fill(page, 'instrument-search-text', 'abc')
    await pressSelector(page, press, '[data-testid="instrument-search-button"]')
    await elementSays(page, '[data-testid="instrument-search-results"]', ['ABC · Example Tech', `NASDAQ · USD · ${share} · Twelve Data`], 'the search does not list the fake listing')
    await inspect?.('the listings a search found')
    await shoot('investments-instrument-search')
    await pressSelector(page, press, '[data-testid="instrument-search-result"]')
    const filled = await page.evaluate(() => ({
      symbol: document.querySelector('[data-testid="instrument-symbol"]')?.value,
      name: document.querySelector('[data-testid="instrument-name"]')?.value,
      exchange: document.querySelector('[data-testid="instrument-exchange"]')?.value,
    }))
    if (filled.symbol !== 'ABC' || filled.name !== 'Example Tech' || filled.exchange !== 'XNAS') throw new Error(`the pick filled ${JSON.stringify(filled)}`)
    await elementSays(page, '[data-testid="instrument-type"]', [share], 'the pick does not propose the type')
    await elementSays(page, '[data-testid="instrument-currency"]', ['USD'], 'the pick does not fill the currency')
    await shoot('investments-instrument-search-picked')
    await page.keyboard.press('Escape')
    await dialogGone(page, '[data-testid="instrument-form"]')
    // The import step after this one runs without keys, so its parent pick looks up no closes.
    await page.evaluate(() => localStorage.removeItem('kuna.secret.twelvedata'))
  }
}

export const investmentsInstrumentSearchFlow = investmentsInstrumentSearchFlowIn('en')

/**
 * Investments Settings on the sample: Add a benchmark opens the holding dialog, whose Price is menu turns it into a bond
 * priced in percent. The coupon and maturity appear, the type becomes Bond, and a save without them marks both.
 */
export function investmentsBondFlowIn(language) {
  const croatian = language === 'hr'
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(croatian ? `${name}-${language}` : name)
    await pressSelector(page, press, '[data-testid="benchmark-add"]')
    await page.waitForSelector('[data-testid="instrument-form"]', { visible: true, timeout: 10_000 })
    await delay(600)
    await shoot('investments-instrument-quoted-unit')
    await chooseStartingWith(page, press, '[data-testid="instrument-quoted"]', croatian ? 'Postotak nominale' : 'Percent of nominal')
    await elementSays(page, '[data-testid="instrument-type"]', [croatian ? 'Obveznica' : 'Bond'], 'the bond quoting does not set the type')
    await fill(page, 'instrument-name', 'Example Treasury Bond')
    await fill(page, 'instrument-symbol', 'EXB')
    await pressSelector(page, press, '[data-testid="instrument-save"]')
    await elementSays(page, '[data-testid="instrument-form"]', [croatian ? 'Odaberi datum' : 'Pick a date'], 'a bond without a maturity is not marked')
    await scrollIntoDialogView(page, '[data-testid="instrument-coupon"]')
    await inspect?.('the holding dialog for a bond without its coupon and maturity')
    await shoot('investments-instrument-quoted-bond-marked')
    await fill(page, 'instrument-coupon', croatian ? '3,5' : '3.5')
    await fill(page, 'instrument-maturity', '2030-03-02')
    await shoot('investments-instrument-quoted-bond')
    await page.keyboard.press('Escape')
    await dialogGone(page, '[data-testid="instrument-form"]')
  }
}

/**
 * Example World ETF, whose fund profile Alpha Vantage sent empty, warns on its Details card and in the checks of
 * Holdings. Don't fetch facts, focused and on the screen as the warning's Change opens the dialog, turned on and saved, puts a line with a way to Change on the card
 * in place of the warning and Ask again, and takes the holding off the checks' Fetched facts line.
 */
export function investmentsTypedFactsFlowIn(language) {
  const croatian = language === 'hr'
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(croatian ? `${name}-${language}` : name)
    await page.waitForSelector('[data-testid="holding-fact-problem"]', { visible: true, timeout: 10_000 })
    await pressSelector(page, press, '[data-testid="holding-fact-problem"] [data-testid="holding-fact-problem-change"]')
    await page.waitForSelector('[data-testid="instrument-form"]', { visible: true, timeout: 10_000 })
    const toggle = ':is([data-testid="instrument-typed-facts-only"][role="switch"], [data-testid="instrument-typed-facts-only"] [role="switch"])'
    await focusIsIn(page, toggle, 'the warning’s Change does not open the dialog at Don’t fetch facts')
    await delay(400)
    await shoot('investments-typed-facts-off')
    await pressSelector(page, press, toggle)
    await page.waitForFunction((selector) => document.querySelector(selector)?.getAttribute('aria-checked') === 'true', { timeout: 5_000 }, toggle)
    await inspect?.('the holding dialog with Don’t fetch facts on')
    await shoot('investments-typed-facts-on')
    await pressSelector(page, press, '[data-testid="instrument-save"]')
    await dialogGone(page, '[data-testid="instrument-form"]')
    await page
      .waitForFunction(() => document.querySelector('[data-testid="holding-fact-problem"]') === null, { timeout: 10_000 })
      .catch(() => {
        throw new Error('the fetched-facts warning stays on a holding set not to fetch its facts')
      })
    await page.waitForSelector('[data-testid="holding-typed-facts-only"] [data-testid="holding-typed-facts-change"]', { visible: true, timeout: 5_000 }).catch(() => {
      throw new Error('the Details card does not say its facts are typed only, with a way to Change')
    })
    // A phone's top bar covers a card scrolled to its start, so the shot centres the typed-only line with the card's title above it.
    await shootAt(page, shoot, '[data-testid="holding-typed-facts-only"]', 'investments-typed-facts-details')
    await page.evaluate(() => {
      location.hash = '#/investments/holdings#portfolio-checks'
    })
    await page.waitForSelector('[data-testid="portfolio-checks"]', { visible: true, timeout: 10_000 })
    const named = await page.$$eval('[data-testid="check-facts-holding"]', (links) => links.map((link) => link.textContent?.trim() ?? ''))
    if (named.includes('Example World ETF')) throw new Error('the checks still name a holding set not to fetch its facts')
    // The Fetched facts line still names the share whose profile Finnhub refused, without the fund.
    await shootAt(page, shoot, '[data-testid="check-facts"]', 'investments-typed-facts-checks')
  }
}

/**
 * A cursor a little beside the 8 Sep buy on Example Tech's daily Price chart still opens that buy's tooltip, though
 * a day on the long line is about a pixel wide. The buy dots are found by their colour on the canvas, then the
 * pointer moves out from inside the dot until the tooltip stops naming it.
 */
export async function investmentsHoldingDotHoverFlow(page, { inspect }) {
  const canvas = '[data-testid="holding-price-chart"] .chart-body canvas'
  await page.waitForSelector(canvas, { visible: true })
  await page.$eval(canvas, (element) => element.scrollIntoView({ block: 'center' }))
  await settleCharts(page)
  const readsTheBuy = async (x, y) => {
    await page.mouse.move(x, y)
    await delay(50)
    // A desktop chart's tooltip carries no class of Kuna's, so it is ECharts' own box inside the chart.
    const text = await page.evaluate(
      () => [...document.querySelectorAll('[data-testid="holding-price-chart"] .chart-body div')].find((box) => box.style.zIndex === '9999999' && box.style.display !== 'none')?.textContent ?? '',
    )
    return text.includes('Bought 3 units at $155.40') && !text.includes('Bought 5 units at $158.00') && !text.includes('Bought 2 units at $160.10')
  }
  const buyPixels = await page.$eval(canvas, (element) => {
    const colour = getComputedStyle(document.documentElement).getPropertyValue('--invest-buy').trim()
    const [red, green, blue] = [1, 3, 5].map((start) => parseInt(colour.slice(start, start + 2), 16))
    const box = element.getBoundingClientRect()
    const scale = element.width / box.width
    const pixels = element.getContext('2d').getImageData(0, 0, element.width, element.height).data
    const found = []
    for (let y = 0; y < element.height; y += 3) {
      for (let x = 0; x < element.width; x += 3) {
        const at = (y * element.width + x) * 4
        if (Math.abs(pixels[at] - red) + Math.abs(pixels[at + 1] - green) + Math.abs(pixels[at + 2] - blue) < 12) found.push({ x: box.x + x / scale, y: box.y + y / scale })
      }
    }
    // September's buys lie near the right end of the line.
    return found.sort((one, other) => other.x - one.x)
  })
  let inside = null
  for (const pixel of buyPixels) {
    if (await readsTheBuy(pixel.x, pixel.y)) {
      inside = pixel
      break
    }
  }
  if (inside === null) throw new Error(`no pointer on any of ${buyPixels.length} buy-coloured pixels opens the 8 Sep buy`)
  const lastReading = async (from, across, down) => {
    let last = from
    for (let step = 1; step <= 40; step += 1) {
      const next = { x: from.x + across * step, y: from.y + down * step }
      if (!(await readsTheBuy(next.x, next.y))) break
      last = next
    }
    return last
  }
  const middle = { x: inside.x, y: ((await lastReading(inside, 0, -1)).y + (await lastReading(inside, 0, 1)).y) / 2 }
  const reach = (await lastReading(middle, 1, 0)).x - (await lastReading(middle, -1, 0)).x
  // A 12 px dot is 12 px across, and a cursor should open it from a little past its edge on both sides.
  if (reach < 16) throw new Error(`a cursor opens the 8 Sep buy over ${reach} px across, so the dot is hard to point at`)
  await inspect?.('a cursor beside the 8 Sep buy')
}

/**
 * A chart's Compare with on the sample, first with no key and with a made-up Finnhub key, then with a made-up Twelve
 * Data key kept for the page's life: the search asks the fake responder for EXQ, the pick names it in a chip and in the
 * address, the chart then reads as change in percent, and the chip's Remove takes it away again. Then S&P 500 (SPY), one
 * of the funds the dialog names, does the same. The keys go before the flow ends, so the steps after it start clean.
 */
export function investmentsCompareFlowIn(card, shotName) {
  const chart = `[data-testid="${card}"]`
  const chartSays = (page) => page.$eval(`${chart} .chart-body [aria-label]`, (element) => element.getAttribute('aria-label') ?? '').catch(() => '')
  return async (page, { press, shoot, inspect }) => {
    try {
      // With no key of any vendor, Compare with still opens, its funds wait for a Twelve Data key with a link to the Prices settings, and the search is not offered.
      await page.evaluate(() =>
        Object.keys(localStorage)
          .filter((key) => key.startsWith('kuna.secret'))
          .forEach((key) => localStorage.removeItem(key)),
      )
      await page.reload({ waitUntil: 'networkidle0' })
      await pressSelector(page, press, `${chart} [data-testid="compare-open"]`)
      await page.waitForSelector('[data-testid="compare-funds"]', { visible: true, timeout: 10_000 })
      await delay(400)
      const offered = await page.$$eval('[data-testid="compare-fund"]', (buttons) => buttons.map((button) => button.disabled))
      if (offered.length !== 5 || offered.some((disabled) => !disabled)) throw new Error('the funds can be pressed without a Twelve Data key')
      await elementSays(
        page,
        '[data-testid="compare-funds-note"]',
        ['Add your Twelve Data key in the Prices settings to use these funds and the search.', 'Prices settings'],
        'the funds do not say that they and the search need a Twelve Data key',
      )
      if ((await page.$$('[data-testid="compare-funds-settings"]')).length !== 1) throw new Error('Compare with shows more than one way to the Prices settings')
      await page.waitForSelector('[data-testid="compare-funds-settings"]', { visible: true, timeout: 5_000 })
      if (await page.$('[data-testid="instrument-search"]')) throw new Error('the search is offered with no key to search with')
      await inspect?.('Compare with without a Twelve Data key')
      await shoot(`${shotName}-no-key`)
      await page.keyboard.press('Escape')
      await dialogGone(page, '[data-testid="compare-funds"]')

      // With another vendor's key the search is offered, and the funds still wait for a Twelve Data key with the one link.
      await page.evaluate(() => localStorage.setItem('kuna.secret.finnhub', 'made-up-finnhub-key-0042'))
      await page.reload({ waitUntil: 'networkidle0' })
      await pressSelector(page, press, `${chart} [data-testid="compare-open"]`)
      await page.waitForSelector('[data-testid="instrument-search"]', { visible: true, timeout: 10_000 })
      await delay(400)
      await elementSays(
        page,
        '[data-testid="compare-funds-note"]',
        ['No Twelve Data key in this browser. Add your Twelve Data key in the Prices settings.', 'Prices settings'],
        'the funds do not say that they need a Twelve Data key while another vendor has one',
      )
      if ((await page.$$('[data-testid="compare-funds-settings"]')).length !== 1) throw new Error('Compare with shows more than one way to the Prices settings')
      await inspect?.("Compare with with another vendor's key")
      await page.keyboard.press('Escape')
      await dialogGone(page, '[data-testid="compare-funds"]')
      await page.evaluate(() => localStorage.removeItem('kuna.secret.finnhub'))

      await page.evaluate(() => localStorage.setItem('kuna.secret.twelvedata', 'made-up-twelve-data-key-0042'))
      await page.reload({ waitUntil: 'networkidle0' })
      await pressSelector(page, press, `${chart} [data-testid="compare-open"]`)
      await page.waitForSelector('[data-testid="instrument-search"]', { visible: true, timeout: 10_000 })
      await fill(page, 'instrument-search-text', 'exq')
      await pressSelector(page, press, '[data-testid="instrument-search-button"]')
      await elementSays(page, '[data-testid="instrument-search-results"]', ['EXQ · Example Quality Fund', 'NASDAQ · USD'], 'the search does not list the fake listing')
      await inspect?.('the listings Compare with found')
      await shoot(`${shotName}-search`)
      await pressSelector(page, press, '[data-testid="instrument-search-result"]')
      await dialogGone(page, '[data-testid="instrument-search"]')
      await elementSays(page, `${chart} [data-testid="compare-chip"]`, ['EXQ'], 'the pick shows no chip')
      await page
        .waitForFunction(() => decodeURIComponent(window.location.hash).includes('compare=twelvedata:EXQ'), { timeout: 5_000 })
        .catch(() => {
          throw new Error('the pick is not kept in the address')
        })
      await elementSays(page, chart, ['Change since'], 'the chart does not say it shows the change since its first day')
      await page
        .waitForFunction((selector) => /EXQ [+−-]?[\d.,]+\s?%/.test(document.querySelector(selector)?.getAttribute('aria-label') ?? ''), { timeout: 10_000 }, `${chart} .chart-body [aria-label]`)
        .catch(async () => {
          throw new Error(`the chart does not read EXQ in percent, it says: ${await chartSays(page)}`)
        })
      await inspect?.('a chart compared with EXQ')
      await shoot(shotName)
      await pressSelector(page, press, `${chart} [data-testid="compare-chip"]`)
      await page
        .waitForFunction((selector) => !document.querySelector(selector), { timeout: 5_000 }, `${chart} [data-testid="compare-chip"]`)
        .catch(() => {
          throw new Error('Remove left the chip')
        })
      if ((await page.evaluate(() => window.location.hash)).includes('compare=')) throw new Error('Remove left the pick in the address')
      if ((await chartSays(page)).includes('EXQ')) throw new Error('Remove left the compared line on the chart')

      await pressSelector(page, press, `${chart} [data-testid="compare-open"]`)
      await page.waitForSelector('[data-testid="compare-funds"]', { visible: true, timeout: 10_000 })
      await delay(400)
      const funds = await page.$$eval('[data-testid="compare-fund"]', (buttons) => buttons.map((button) => button.textContent?.trim() ?? ''))
      if (funds.join(', ') !== 'S&P 500 (SPY), Dow Jones (DIA), Nasdaq-100 (QQQ), Nasdaq Composite (ONEQ), Gold (GLD)') throw new Error(`the dialog names the funds ${funds.join(', ')}`)
      await elementSays(page, '[data-testid="compare-funds-note"]', ['fund that tracks its index', 'without the dividends'], 'the dialog does not say what the funds are')
      await inspect?.('the funds Compare with names')
      await shoot(`${shotName}-funds`)
      await pressLabelled(page, press, '[data-testid="compare-funds"]', 'S&P 500 (SPY)')
      await dialogGone(page, '[data-testid="compare-funds"]')
      await elementSays(page, `${chart} [data-testid="compare-chip"]`, ['S&P 500 (SPY)'], 'the fund picked shows no chip with its name')
      await page
        .waitForFunction(() => decodeURIComponent(window.location.hash).includes('compare=twelvedata:SPY'), { timeout: 5_000 })
        .catch(() => {
          throw new Error('the fund picked is not kept in the address')
        })
      await page
        .waitForFunction(
          (selector) => /S&P 500 \(SPY\) [+−-]?[\d.,]+\s?%/.test(document.querySelector(selector)?.getAttribute('aria-label') ?? ''),
          { timeout: 10_000 },
          `${chart} .chart-body [aria-label]`,
        )
        .catch(async () => {
          throw new Error(`the chart does not read S&P 500 (SPY) in percent, it says: ${await chartSays(page)}`)
        })
      await shoot(`${shotName}-fund`)
      await pressSelector(page, press, `${chart} [data-testid="compare-chip"]`)
      await page
        .waitForFunction((selector) => !document.querySelector(selector), { timeout: 5_000 }, `${chart} [data-testid="compare-chip"]`)
        .catch(() => {
          throw new Error('Remove left the fund')
        })
    } finally {
      await page.evaluate(() => ['twelvedata', 'finnhub'].forEach((vendor) => localStorage.removeItem(`kuna.secret.${vendor}`)))
    }
  }
}

/**
 * The sample's world ETF in its holding dialog: a two-word country, a code in brackets and Not set typed into the Country
 * field, then a two-word country and a code in brackets typed into a new line of the fund's country mix, each picked with
 * Enter. Escape closes the dialog without saving.
 */
export async function investmentsCountrySearchFlow(page, { press, shoot, inspect }) {
  await goTo(page, `#/investments/holding?instrument=${SAMPLE_WORLD_ETF}`, 'Example World ETF')
  await pressSelector(page, press, '[data-testid="holding-change"]')
  await page.waitForSelector('[data-testid="instrument-form"]', { visible: true })
  const country = '[data-testid="instrument-country"]'
  await pickTyped(page, press, country, 'United Kingdom', 'United Kingdom (GB)', shoot)
  await pickTyped(page, press, country, '(US)', 'United States (US)')
  await inspect?.('the Country field with a country picked')
  await pickTyped(page, press, country, 'Not set', 'Not set')
  await pressLabelled(page, press, '[data-testid="instrument-mix-pick"]', 'By country or region')
  await pressSelector(page, press, '[data-testid="instrument-mix-add"]')
  const line = '[data-testid="instrument-mix-line"]:last-child [data-testid="instrument-mix-group"]'
  await pickTyped(page, press, line, 'South Korea', 'South Korea (KR)')
  await pickTyped(page, press, line, '(US)', 'United States (US)')
  await page.keyboard.press('Escape')
  await dialogGone(page, '[data-testid="instrument-form"]')
}

/** Opens a searchable list, types the query, waits for the first match to be the one wanted and highlighted, and picks it with Enter. */
async function pickTyped(page, press, trigger, query, wanted, shoot) {
  await pressSelector(page, press, trigger)
  await page.waitForSelector('[role="listbox"]', { visible: true })
  await delay(200)
  await page.keyboard.type(query)
  await page
    .waitForFunction(
      (label) => {
        const first = document.querySelector('[role="option"]')
        return first?.textContent?.trim() === label && first.hasAttribute('data-highlighted')
      },
      { timeout: 5_000 },
      wanted,
    )
    .catch(async () => {
      const listed = await page.$$eval('[role="option"]', (options) =>
        options.slice(0, 3).map((option) => `${option.textContent?.trim()}${option.hasAttribute('data-highlighted') ? ' (highlighted)' : ''}`),
      )
      throw new Error(`"${query}" does not put ${wanted} first and highlighted, the list starts ${JSON.stringify(listed)}`)
    })
  await shoot?.('investments-country-search')
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => !document.querySelector('[role="listbox"]'), { timeout: 5_000 })
  await elementSays(page, trigger, [wanted], `Enter after "${query}" does not pick ${wanted}`)
}

/**
 * Investments Settings, Prices, on the sample: three made-up CSV files of closes dropped at once on Import closes, two
 * matched to holdings by their names and one picked by hand, their dry run, and one import of all three.
 */
export function investmentsClosesImportFlowIn(language, files) {
  const croatian = language === 'hr'
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(croatian ? `${name}-${language}` : name)
    const input = await page.waitForSelector('[data-testid="investments-closes-import"] input[type="file"]', { timeout: 10_000 }).catch(() => {
      throw new Error('Import closes offers no file input')
    })
    await input.uploadFile(...files)
    await page
      .waitForFunction(() => document.querySelectorAll('[data-testid="closes-import-file"]').length === 3, { timeout: 10_000 })
      .catch(() => {
        throw new Error('the closes import does not list the three files dropped')
      })
    const adds = await page.$$eval('[data-testid="closes-import-adds"]', (lines) => lines.map((line) => line.textContent?.trim() ?? ''))
    if (adds.length !== 2) throw new Error(`the closes import matched ${adds.length} files by name, not 2`)
    await chooseStartingWith(page, press, '[data-testid="closes-import-holding"]', 'Example Index Fund')
    await page
      .waitForFunction(() => document.querySelectorAll('[data-testid="closes-import-adds"]').length === 3, { timeout: 5_000 })
      .catch(() => {
        throw new Error('picking a holding for the unmatched file gave it no dry run')
      })
    await inspect?.('the closes import dry run')
    await shoot('investments-closes-import')
    await pressSelector(page, press, '[data-testid="closes-import-confirm"]')
    await toastMatching(page, croatian ? /^Uvezene su cijene 3 pozicije$/ : /^Closes of 3 holdings imported$/)
    await page.waitForSelector('[data-testid="closes-import-file"]', { hidden: true, timeout: 5_000 })
    await dismissToasts(page)
  }
}

/** The made-up share in US dollars of the sample Investments file. */
const SAMPLE_INVESTMENT_SHARE = 'fa4e1000-0000-4000-8000-000000000010'
const SAMPLE_WORLD_ETF = 'fa4e1000-0000-4000-8000-000000000012'

/**
 * The transaction dialogs of the sample Investments file: a buy of a holding and its summary added, changed, deleted and
 * brought back with Undo, a sale beyond what the account holds refused in words, a new holding added from inside
 * the dialog with a price entered by hand for it, and a fund's own mix kept from saving until its lines add up to 100%.
 */
export async function investmentsEditorFlow(page, { press, shoot, inspect }) {
  const rows = () => page.evaluate(() => document.querySelectorAll('[data-testid="transaction-row"]').length)
  const before = await rows()

  await pressSelector(page, press, '[data-testid="transactions-add"]')
  await page.waitForSelector('[data-testid="transaction-form"]', { visible: true })
  await chooseStartingWith(page, press, '[data-testid="transaction-instrument"]', 'Example Tech')
  await chooseStartingWith(page, press, '[data-testid="transaction-account"]', 'Broker One')
  await fill(page, 'transaction-quantity', '2')
  await fill(page, 'transaction-price', '160')
  await fill(page, 'transaction-fees', '1')
  await elementSays(page, '[data-testid="transaction-summary"]', ['You pay', '$321.00', 'Afterwards you hold', 'Average cost'], 'the summary does not say what the buy pays')
  await inspect?.('a buy with its summary')
  await scrollIntoDialogView(page, '[data-testid="transaction-summary"]')
  await shoot('investments-add-buy')
  await pressSelector(page, press, '[data-testid="transaction-save"]')
  await toast(page, 'Buy added')
  await dialogGone(page, '[data-testid="transaction-form"]')
  if ((await rows()) !== before + 1) throw new Error('the buy is not listed')
  await dismissToasts(page)

  await pressSelector(page, press, '[data-testid="transaction-row"] [data-testid="transaction-edit"]')
  await page.waitForSelector('[data-testid="transaction-form"]', { visible: true })
  await fill(page, 'transaction-quantity', '3')
  await elementSays(page, '[data-testid="transaction-summary"]', ['$481.00'], 'the summary does not follow the changed units')
  await pressSelector(page, press, '[data-testid="transaction-save"]')
  await toast(page, 'Buy saved')
  await elementSays(page, '[data-testid="transaction-row"]', ['3 units at $160.00'], 'the changed buy is not listed')
  await dismissToasts(page)

  await pressSelector(page, press, '[data-testid="transaction-row"] [data-testid="transaction-edit"]')
  await pressSelector(page, press, '[data-testid="transaction-delete"]')
  await toast(page, 'Buy deleted')
  if ((await rows()) !== before) throw new Error('the deleted buy is still listed')
  await undo(page, press)
  if ((await rows()) !== before + 1) throw new Error('Undo did not bring the buy back')
  await inspect?.('Transactions after Undo')
  await shoot('investments-undo-delete')
  await dismissToasts(page)

  await pressSelector(page, press, '[data-testid="transactions-add"]')
  await page.waitForSelector('[data-testid="transaction-form"]', { visible: true })
  await pressLabelled(page, press, '[data-testid="transaction-happened"]', 'Sell')
  await chooseStartingWith(page, press, '[data-testid="transaction-instrument"]', 'Example Tech')
  await chooseStartingWith(page, press, '[data-testid="transaction-account"]', 'Broker Two')
  await fill(page, 'transaction-quantity', '1')
  await fill(page, 'transaction-price', '170')
  await elementSays(page, '[data-testid="transaction-beyond-held"]', ['The account holds fewer units on'], 'the summary does not warn of a sale beyond what is held')
  await scrollIntoDialogView(page, '[data-testid="transaction-beyond-held"]')
  await shoot('investments-sale-beyond-held')
  await pressSelector(page, press, '[data-testid="transaction-save"]')
  await toast(page, 'Not added')
  await elementSays(page, 'li[data-slot="base"]', ['The sale of "Example Tech" on', 'would sell more than its account holds that day'], 'the refusal does not say why')
  await dismissToasts(page)

  await pressLabelled(page, press, '[data-testid="transaction-happened"]', 'Price by hand')
  await pressSelector(page, press, '[data-testid="transaction-instrument-new"]')
  await page.waitForSelector('[data-testid="instrument-form"]', { visible: true })
  await fill(page, 'instrument-name', 'Example Bond Fund')
  await fill(page, 'instrument-symbol', 'EBF')
  await chooseStartingWith(page, press, '[data-testid="instrument-prices"]', 'Entered by hand')
  await inspect?.('the holding dialog over the transaction dialog')
  await shoot('investments-new-holding')
  await pressSelector(page, press, '[data-testid="instrument-save"]')
  await toast(page, 'Holding added')
  await dialogGone(page, '[data-testid="instrument-form"]')
  await dismissToasts(page)
  await elementSays(page, '[data-testid="transaction-instrument"]', ['Example Bond Fund'], 'the new holding is not picked')
  await fill(page, 'transaction-price', '10.25')
  await pressSelector(page, press, '[data-testid="transaction-save"]')
  await toast(page, 'Price by hand added')
  await elementSays(page, '[data-testid="transaction-row"]', ['Example Bond Fund', '€10.25'], 'the hand price is not listed')
  await dismissToasts(page)

  await goTo(page, `#/investments/holding?instrument=${SAMPLE_WORLD_ETF}`, 'Example World ETF')
  await pressSelector(page, press, '[data-testid="holding-change"]')
  await page.waitForSelector('[data-testid="instrument-form"]', { visible: true })
  await pressLabelled(page, press, '[data-testid="instrument-mix-pick"]', 'By country or region')
  await pressSelector(page, press, '[data-testid="instrument-mix-add"]')
  await chooseStartingWith(page, press, '[data-testid="instrument-mix-line"]:last-child [data-testid="instrument-mix-group"]', 'Asia and Pacific')
  await setField(await page.$('[data-testid="instrument-mix-line"]:last-child [data-testid="instrument-mix-percent"]'), '5')
  await elementSays(page, '[data-testid="instrument-mix-sum"]', ['Adds up to 105%'], 'the mix does not add up what is typed')
  await pressSelector(page, press, '[data-testid="instrument-save"]')
  await elementSays(page, '[data-testid="instrument-mix-whole"]', ['Lines that add up to 100%'], 'a mix that does not add up is not marked')
  await scrollIntoDialogView(page, '[data-testid="instrument-mix-whole"]')
  await shoot('investments-fund-mix-not-whole')
  await setField(await page.$('[data-testid="instrument-mix-line"]:first-child [data-testid="instrument-mix-percent"]'), '65')
  await elementSays(page, '[data-testid="instrument-mix-sum"]', ['Adds up to 100%'], 'the mix does not add up to 100% once fixed')
  await pressSelector(page, press, '[data-testid="instrument-save"]')
  await toast(page, 'Holding saved')
  await dialogGone(page, '[data-testid="instrument-form"]')
  await dismissToasts(page)
}

/**
 * Every Investments dialog with the sample file, opened and closed again: the transaction dialog on each kind of
 * record, a transaction changed, a holding, a fund's own mix by sector and by country, and an account.
 */
export function investmentsDialogsFlowIn(language) {
  const croatian = language === 'hr'
  const kinds = croatian
    ? [
        ['Dividenda ili kamata', 'income'],
        ['Uplata', 'cash'],
        ['Konverzija', 'exchange'],
        ['Prijenos', 'transfer'],
        ['Podjela', 'split'],
        ['Izdvajanje', 'spin-off'],
        ['Ručna cijena', 'price'],
      ]
    : [
        ['Dividend or interest', 'income'],
        ['Deposit', 'cash'],
        ['Exchange', 'exchange'],
        ['Transfer', 'transfer'],
        ['Split', 'split'],
        ['Spin-off', 'spin-off'],
        ['Price by hand', 'price'],
      ]
  return async (page, { press, shoot: shootAs }) => {
    const shoot = (name) => shootAs(croatian ? `${name}-${language}` : name)
    await pressSelector(page, press, '[data-testid="transactions-add"]')
    await page.waitForSelector('[data-testid="transaction-form"]', { visible: true })
    await chooseStartingWith(page, press, '[data-testid="transaction-instrument"]', 'Example Tech')
    await delay(300)
    await shoot('dialog-investments-buy')
    for (const [label, name] of kinds) {
      await pressLabelled(page, press, '[data-testid="transaction-happened"]', label)
      await shoot(`dialog-investments-${name}`)
      if (name === 'transfer') {
        await pressLabelled(page, press, '[data-testid="transaction-moves"]', croatian ? 'Novac' : 'Cash')
        await scrollIntoDialogView(page, '[data-testid="transaction-amount"]')
        await shoot('dialog-investments-transfer-cash')
      }
    }
    await page.keyboard.press('Escape')
    await dialogGone(page, '[data-testid="transaction-form"]')
    await lookAtDialog(page, press, shoot, '[data-testid="transaction-row"] [data-testid="transaction-edit"]', '[data-testid="transaction-form"]', 'dialog-investments-change')
    await goTo(page, `#/investments/holding?instrument=${SAMPLE_INVESTMENT_SHARE}`, 'Example Tech')
    await lookAtDialog(page, press, shoot, '[data-testid="holding-change"]', '[data-testid="instrument-form"]', 'dialog-investments-instrument')
    await goTo(page, `#/investments/holding?instrument=${SAMPLE_WORLD_ETF}`, 'Example World ETF')
    await pressSelector(page, press, '[data-testid="holding-change"]')
    await page.waitForSelector('[data-testid="instrument-mix"]', { visible: true })
    await scrollIntoDialogView(page, '[data-testid="instrument-mix"]')
    await shoot('dialog-investments-instrument-mix')
    await pressLabelled(page, press, '[data-testid="instrument-mix-pick"]', croatian ? 'Po državi ili regiji' : 'By country or region')
    await scrollIntoDialogView(page, '[data-testid="instrument-mix"]')
    await shoot('dialog-investments-instrument-mix-country')
    await page.keyboard.press('Escape')
    await dialogGone(page, '[data-testid="instrument-form"]')
    await goTo(page, `#/investments/holding?instrument=${SAMPLE_INVESTMENT_SHARE}`, 'Example Tech')
    await lookAtDialog(page, press, shoot, '[data-testid="holding-add-transaction"]', '[data-testid="transaction-form"]', 'dialog-investments-holding-buy')
    await goTo(page, '#/investments/settings', croatian ? 'Postavke' : 'Settings')
    await lookAtDialog(page, press, shoot, '[data-testid="account-edit"]', '[data-testid="account-form"]', 'dialog-investments-account')
    // The same account taking IBKR's mailed report asks its start day.
    await pressSelector(page, press, '[data-testid="account-edit"]')
    await page.waitForSelector('[data-testid="account-form"]', { visible: true, timeout: 10_000 })
    await pressSelector(page, press, '[data-testid="account-rows-from"] [data-value="mail"]')
    await page.waitForSelector('[data-testid="account-starts-on"]', { visible: true, timeout: 5_000 }).catch(() => {
      throw new Error('an account taking the mailed report asks no start day')
    })
    await delay(300)
    await shoot('dialog-investments-account-mail')
    // The list of where its rows come from, with a later source added that takes over on a day of its own.
    await pressSelector(page, press, '[data-testid="account-source-add"]')
    await scrollIntoDialogView(page, '[data-testid="account-source-add"]')
    await delay(300)
    await shoot('dialog-investments-account-mail-sources')
    await pressSelector(page, press, '[data-testid="account-source-remove"]')
    // A start day in a filed tax year is refused under the field once Save is pressed.
    await typeDay(await page.$('[data-testid="account-starts-on"]'), '2024-03-01')
    await pressSelector(page, press, '[data-testid="account-save"]')
    await elementSays(page, '[data-testid="account-form"]', ['2024'], 'the start day in a filed tax year is not refused under its field')
    await delay(300)
    await shoot('dialog-investments-account-filed')
    if (await page.$('[data-testid="account-handover"]')) throw new Error('a refused start day still warns of the rows saving takes out')
    // A start day in an open year over rows typed by hand warns of the rows that go, listed by day, what they are and their euros.
    await typeDay(await page.$('[data-testid="account-starts-on"]'), '2026-01-02')
    await page.waitForSelector('[data-testid="account-handover"] li', { visible: true, timeout: 5_000 }).catch(() => {
      throw new Error('giving open days to the mailed report lists no row that goes')
    })
    await scrollIntoDialogView(page, '[data-testid="account-handover"]')
    await delay(300)
    await shoot('dialog-investments-account-handover')
    // A day after the account's last row by hand goes in, and the list says where its rows come from.
    await typeDay(await page.$('[data-testid="account-starts-on"]'), '2099-01-04')
    await pressSelector(page, press, '[data-testid="account-save"]')
    await dialogGone(page, '[data-testid="account-form"]')
    await elementSays(
      page,
      '[data-testid="investments-accounts"]',
      [croatian ? 'Izvješće IBKR-a poštom od' : 'IBKR report by mail from'],
      'the accounts list does not say the account takes the mailed report',
    )
    await shootAt(page, shoot, await page.$('[data-testid="investments-accounts"]'), 'investments-accounts-mail')
  }
}

export const investmentsDialogsFlow = investmentsDialogsFlowIn('en')

/** Waits for the screen header's line to hold the text, such as the prices fetch under way. */
async function headerSays(page, text, failure, timeout = 10_000) {
  await page
    .waitForFunction((wanted) => document.querySelector('[data-testid="screen-title"]')?.parentElement?.querySelector('p')?.textContent?.includes(wanted) ?? false, { timeout }, text)
    .catch(async () => {
      const said = await page.evaluate(() => document.querySelector('[data-testid="screen-title"]')?.parentElement?.querySelector('p')?.textContent?.trim())
      throw new Error(`${failure}, it says: ${said ?? 'nothing'}`)
    })
}

/** Waits for the workbook import's dialog to show a step. */
async function importStep(page, step) {
  await page.waitForSelector(`[data-testid="workbook-import"][data-step="${step}"]`, { visible: true, timeout: 10_000 }).catch(async () => {
    const shown = await page.evaluate(() => document.querySelector('[data-testid="workbook-import"]')?.getAttribute('data-step'))
    throw new Error(`the workbook import shows ${shown ?? 'no'} step, not ${step}`)
  })
  await delay(300)
}

/** Opens the workbook import from the Overview and drops the made-up workbook on it. */
async function dropWorkbook(page, press, path) {
  await pressSelector(page, press, '[data-testid="investments-import"]')
  await importStep(page, 'file')
  await dropFile(page, path)
  await page.waitForSelector('[data-testid="import-loaded"]', { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error('the workbook import did not read the made-up workbook')
  })
}

async function importSummarySays(page, text) {
  await elementSays(page, '[data-testid="import-dry-run-summary"]', [text], `the import's dry run does not say "${text}"`)
}

/** Steps through the workbook import to its dry run, past the steps a workbook already in Kuna leaves. */
async function toDryRun(page, press) {
  for (let step = 0; step < 4 && (await page.$('[data-testid="workbook-import"][data-step="dry-run"]')) === null; step += 1) {
    await pressSelector(page, press, '[data-testid="workbook-import-next"]')
    await delay(300)
  }
  await importStep(page, 'dry-run')
}

/**
 * The Investments import of the made-up workbook into an empty file with the fake prices: the file, the accounts, a
 * holding's guess opened, the spin-off's parent picked with its share proposed, the dry run with the debit interest
 * worth a look, and Import. Then either Undo takes it all back to the empty Overview, or the same workbook again adds
 * nothing and a copy with its first deposit edited shows the deposit in Kuna beside the edited one, kept unless ticked.
 */
export function investmentsImportFlowIn(language, { workbook: path, edited }, { undoing = false } = {}) {
  const croatian = language === 'hr'
  const text = croatian ? workbookImportCroatian : workbookImportEnglish
  const firstSummary = croatian ? 'Dodaje 21 zapis, a novo je: 3 računa i 4 pozicije.' : 'Adds 21 records, with 3 accounts and 4 holdings new.'
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(croatian ? `${name}-${language}` : name)
    await page.waitForSelector('[data-testid="investments-empty"]', { visible: true, timeout: 10_000 })
    // A made-up Alpha Vantage key, so the fake vendor lists the made-up workbook's split.
    await page.evaluate(() => localStorage.setItem('kuna.secret.alphavantage', 'MADEUPKEY01'))
    await pressSelector(page, press, '[data-testid="investments-import"]')
    await importStep(page, 'file')
    if ((await page.$('[data-testid="import-template-download"]')) === null) throw new Error('the workbook import offers no template download')
    await inspect?.('the workbook import before a file')
    await shoot('investments-import-file')
    await page.keyboard.press('Escape')
    await dialogGone(page, '[data-testid="workbook-import"]')

    await dropWorkbook(page, press, path)
    await page.waitForSelector('[data-testid="import-listed-splits"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('the workbook import lists no split Alpha Vantage found')
    })
    await inspect?.('the workbook read')
    await shoot('investments-import-file-read')
    await pressSelector(page, press, '[data-testid="workbook-import-next"]')
    await importStep(page, 'accounts')
    await inspect?.('the accounts step')
    await shoot('investments-import-accounts')
    await pressSelector(page, press, '[data-testid="workbook-import-next"]')
    await importStep(page, 'instruments')
    await pressSelector(page, press, '[data-testid="import-instrument-edit"]')
    await page.waitForSelector('[data-testid="import-instrument-name"]', { visible: true, timeout: 5_000 })
    await inspect?.('the holdings step with a guess open')
    await shoot('investments-import-instruments')
    await pressSelector(page, press, '[data-testid="workbook-import-next"]')
    await importStep(page, 'questions')
    await chooseStartingWith(page, press, '[data-testid="import-spin-off-parent"]', 'ABC')
    await page
      .waitForFunction(() => document.querySelector('[data-testid="import-spin-off-share"]')?.value !== '', { timeout: 5_000 })
      .catch(() => {
        throw new Error('picking the parent proposed no cost share')
      })
    await inspect?.('the questions step')
    await shoot('investments-import-questions')
    await pressSelector(page, press, '[data-testid="workbook-import-next"]')
    await importStep(page, 'dry-run')
    await importSummarySays(page, firstSummary)
    for (const group of ['new', 'waiting', 'skipped']) {
      if ((await page.$(`[data-testid="import-group-${group}"]`)) === null) throw new Error(`the dry run has no ${group} group`)
    }
    if ((await page.$('[data-testid="import-group-look"] [data-testid="import-reversals"]')) === null) throw new Error('the dry run does not list the debit interest worth a look')
    await inspect?.('the dry run')
    await shoot('investments-import-dry-run')
    // A made-up Twelve Data key, so the fetch after the import asks for NewCo and meets the fake vendor's minute limit once.
    await page.evaluate(() => localStorage.setItem('kuna.secret.twelvedata', 'made-up-twelve-data-key-0042'))
    await pressSelector(page, press, '[data-testid="workbook-import-confirm"]')
    await toast(page, text.imported)
    await dialogGone(page, '[data-testid="workbook-import"]')
    await page.waitForSelector('[data-testid="investments-cards"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('the Overview shows no figures after the import')
    })
    await headerSays(
      page,
      croatian ? 'Twelve Data: dopušta 8 u minuti, čeka se' : 'Twelve Data allows 8 a minute, waiting',
      'the Overview does not say the fetch after the import waits for Twelve Data',
    )
    await inspect?.('the Overview fetching after the import')
    await shoot('investments-import-fetching')
    await headerSays(page, croatian ? 'Stanje na zatvaranju' : 'At the close of', 'the Overview does not go back to its close once the fetch after the import is done', 30_000)
    await inspect?.('the Overview after the import')

    if (undoing) {
      await undoIn(page, press, { writes: croatian ? writesCroatian : writesEnglish })
      await page.waitForSelector('[data-testid="investments-empty"]', { visible: true, timeout: 10_000 }).catch(() => {
        throw new Error('Undo did not take the import back to the empty Overview')
      })
      await dismissToasts(page)
      await forgetImportKeys(page)
      return
    }
    await dismissToasts(page)
    await dropWorkbook(page, press, path)
    await toDryRun(page, press)
    await importSummarySays(page, text.dryRun.addsNothing)
    await inspect?.('the same workbook again')
    await shoot('investments-import-again')
    await page.keyboard.press('Escape')
    await dialogGone(page, '[data-testid="workbook-import"]')

    await dropWorkbook(page, press, edited)
    await toDryRun(page, press)
    await importSummarySays(page, croatian ? 'Dodaje 1 zapis.' : 'Adds 1 record.')
    const gone = await page.waitForSelector('[data-testid="import-gone"] [data-testid="import-gone-now"]', { visible: true, timeout: 5_000 }).catch(() => {
      throw new Error('the dry run does not show the edited deposit beside the one in Kuna')
    })
    await shootAt(page, shoot, gone, 'investments-import-edited')
    if ((await page.$('[data-testid="import-gone-kept"]')) === null) throw new Error('the edited deposit does not say that both count while it is kept')
    await pressSelector(page, press, '[data-testid="import-gone-delete"]')
    await importSummarySays(page, croatian ? 'Briše 1 zapis kojeg više nema u radnoj knjizi.' : 'It deletes 1 record gone from the workbook.')
    await page.waitForSelector('[data-testid="import-gone-kept"]', { hidden: true, timeout: 5_000 }).catch(() => {
      throw new Error('the edited deposit still says both count once it is ticked')
    })
    await page.keyboard.press('Escape')
    await dialogGone(page, '[data-testid="workbook-import"]')
    await forgetImportKeys(page)
  }
}

/**
 * IBKR's report by mail on the sample: a sync reads two overlapping made-up mails, Overview offers the review, the first
 * asks for the account, and Accept writes it all with one Undo. With `?fake=flex-unseen` the kinds no real report has shown
 * stop and ask, one is left out for good, and with `?fake=flex-misfit` the step fails and Settings says why.
 */
export function investmentsMailFlowIn(language, variant = 'plain') {
  const croatian = language === 'hr'
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(croatian ? `${name}-${language}` : name)
    await syncAndSettle(page, press)
    if (variant === 'misfit') {
      await page.goto(page.url().replace(/#.*$/, '#/investments/settings?tab=general#mail'), { waitUntil: 'networkidle0' })
      await page.waitForSelector('[data-testid="investments-mail"]', { visible: true, timeout: 10_000 })
      await syncAndSettle(page, press)
      await page.waitForSelector('[data-testid="investments-mail"] [data-testid="mail-entry"][data-entry="misfit"]', { visible: true, timeout: 10_000 }).catch(() => {
        throw new Error('the settings card does not say the report no longer fits')
      })
      await inspect?.('a report that does not fit')
      await shoot('investments-mail-misfit')
      return
    }
    const banner = await page.waitForSelector('[data-testid="mail-report-review"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('the Overview offers no review after the sync read the report')
    })
    await shootAt(page, shoot, banner, `investments-mail-review-${variant}`)
    await pressSelector(page, press, '[data-testid="mail-report-open"]')
    await importStep(page, 'accounts')
    if (variant === 'typed') {
      // Two of the report's rows are typed by hand into Broker One, so Kuna suggests it.
      await page.waitForSelector('[data-testid="import-account-likely"]', { visible: true, timeout: 5_000 }).catch(() => {
        throw new Error('the accounts step does not say which account the rows look like')
      })
    } else {
      // A new account of the report asks from which day the report brings its rows.
      if ((await page.$('[data-testid="import-account-starts-on"]')) !== null) await shoot(`investments-mail-account-new-${variant}`)
      await chooseStartingWith(page, press, '[data-testid="import-account-choice"]', 'Broker One')
    }
    await inspect?.('the account of the report')
    await shoot(`investments-mail-account-${variant}`)
    await pressSelector(page, press, '[data-testid="workbook-import-next"]')
    if (variant === 'typed') {
      await importStep(page, 'questions')
      const rows = await page.$$('[data-testid="import-look-alikes"] [data-testid="question"]')
      if (rows.length !== 2) throw new Error(`the questions step asks about ${rows.length} rows like records Kuna has, not 2`)
      await inspect?.('the rows like records Kuna has')
      await shoot('investments-mail-look-alikes')
      // The first row is the deposit Kuna has, and the second another withdrawal.
      const answer = async (row, button) => press((await page.$$(`[data-testid="import-look-alikes"] [data-testid="question"]:nth-child(${row}) [data-testid="question-choice"] button`))[button])
      await answer(1, 1)
      await answer(2, 2)
      await delay(300)
      const pressed = await page.$$eval('[data-testid="import-look-alikes"] [data-testid="question-choice"] button[aria-pressed="true"]', (buttons) =>
        buttons.map((button) => button.textContent.trim()),
      )
      if (pressed.length !== 2 || pressed[0] === pressed[1]) throw new Error(`the answers to the rows like records Kuna has did not hold: ${pressed.join(', ')}`)
      await inspect?.('the rows like records Kuna has, answered')
      await shoot('investments-mail-look-alikes-answered')
      await pressSelector(page, press, '[data-testid="workbook-import-next"]')
    }
    if (variant === 'unseen') {
      await importStep(page, 'questions')
      const rows = await page.$$('[data-testid="import-asked"] [data-testid="question"]')
      // Each of the two mails adds six unseen rows on its own first day, so twelve rows are asked about, each once.
      if (rows.length !== 12) throw new Error(`the questions step asks about ${rows.length} rows, not 12`)
      await inspect?.('the rows not seen yet')
      await shoot('investments-mail-asked')
      const cancelledBooks = await page.$$eval(
        '[data-testid="import-asked"] [data-testid="question"]',
        (questions) => questions.filter((row) => row.textContent?.includes('BUY (Ca.)') && row.querySelector('[data-testid="import-asked-book"]') !== null).length,
      )
      if (cancelledBooks !== 0) throw new Error('a cancelled buy offers Book, which would book it as a new buy')
      for (const section of ['Trades', 'Transfers', 'Corporate Actions']) {
        const book = await page.evaluateHandle(
          (wanted) =>
            [...document.querySelectorAll('[data-testid="import-asked"] [data-testid="question"]')]
              .filter((row) => row.textContent?.includes(wanted))
              .map((row) => row.querySelector('[data-testid="import-asked-book"]'))
              .find((button) => button !== null) ?? null,
          section,
        )
        if (book.asElement() === null) throw new Error(`a row of ${section} not seen yet offers no Book`)
        await press(book.asElement())
        await page.waitForSelector('[data-testid="transaction-form"]', { visible: true, timeout: 10_000 }).catch(() => {
          throw new Error(`Book on a row of ${section} opens no form`)
        })
        // The form fades in over the import dialog, so the picture waits for it to finish.
        await delay(500)
        await inspect?.(`the form a row of ${section} starts`)
        await shoot(`investments-mail-book-${section.toLowerCase().replace(' ', '-')}`)
        await page.keyboard.press('Escape')
        await page.waitForSelector('[data-testid="transaction-form"]', { hidden: true, timeout: 10_000 })
      }
      const leaveOut = await page.$('[data-testid="import-asked"] [data-testid="question-choice"] button:last-child')
      if (leaveOut === null) throw new Error('a row not seen yet offers no way to leave it out')
      await press(leaveOut)
      await pressSelector(page, press, '[data-testid="workbook-import-next"]')
    }
    await importStep(page, 'dry-run')
    if ((await page.$('[data-testid="import-group-gone"]')) !== null) throw new Error('a rolling report lists records as gone')
    if ((await page.$('[data-testid="import-group-new"]')) === null) throw new Error('the review shows nothing new')
    if (variant === 'unseen' && (await page.$('[data-testid="import-group-asked"]')) === null) throw new Error('the review does not list the rows held back')
    await inspect?.('the review')
    await shoot(`investments-mail-dry-run-${variant}`)
    if (variant === 'typed') {
      const inKuna = await page.waitForSelector('[data-testid="import-group-in-kuna"]', { visible: true, timeout: 5_000 }).catch(() => {
        throw new Error('the review does not list the row matched to a record Kuna has')
      })
      await shootAt(page, shoot, inKuna, 'investments-mail-dry-run-typed-in-kuna', { block: 'start' })
    }
    await pressSelector(page, press, '[data-testid="workbook-import-confirm"]')
    await dialogGone(page, '[data-testid="workbook-import"]')
    if (variant === 'plain') {
      await page.waitForSelector('[data-testid="mail-report-review"]', { hidden: true, timeout: 10_000 }).catch(() => {
        throw new Error('the Overview still offers the review once it is accepted')
      })
      await inspect?.('the Overview after Accept')
      if (!croatian) {
        await undoIn(page, press, { writes: writesEnglish })
        await page.waitForSelector('[data-testid="mail-report-review"]', { visible: true, timeout: 10_000 }).catch(() => {
          throw new Error('Undo did not bring the review back')
        })
      }
    }
    await dismissToasts(page)
  }
}

/**
 * IBKR's report by mail imported by a sync with nothing to ask. With `known`, the sync writes it with no toast and its step
 * says what went in, with Undo on the step, which brings the review back, and the next sync leaves those rows for the
 * person. With `symbol`, a holding that matches by its symbol alone holds the report back, and the review warns on it until
 * another holding is picked.
 */
export function investmentsMailAutoFlowIn(language, variant) {
  const croatian = language === 'hr'
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(croatian ? `${name}-${language}` : name)
    await syncAndSettle(page, press)
    if (variant === 'known') {
      await noToast(page, 'a sync that imported the report showed a toast')
      if ((await page.$('[data-testid="mail-report-review"]')) !== null) throw new Error('the Overview still offers the review after the sync imported the report')
      await openKunaSettings(page)
      await stepSays(page, SYNC_CARD, 'ibkr-mail', 'done', croatian ? /uvezeno je 30 zapisa/ : /imported 30 records/)
      await inspect?.('the step that imported the report')
      await shoot('investments-mail-imported-step')
      await pressSelector(page, press, `${SYNC_CARD} ${SYNC_STEPS} [data-step="ibkr-mail"] [data-testid="sync-step-undo"]`)
      await page.evaluate(() => {
        window.location.hash = '#/investments'
      })
      await page.waitForSelector('[data-testid="mail-report-review"]', { visible: true, timeout: 10_000 }).catch(() => {
        throw new Error('Undo on the step did not bring the review back')
      })
      await dismissToasts(page)
      await syncAndSettle(page, press)
      await openKunaSettings(page)
      await stepSays(page, SYNC_CARD, 'ibkr-mail', 'done', croatian ? /poništili/ : /you undid/)
      await inspect?.('the step after Undo, which leaves the rows for the review')
      await shoot('investments-mail-undone-step')
      return
    }
    await pressSelector(page, press, '[data-testid="mail-report-open"]')
    await importStep(page, 'instruments')
    const warned = await page.waitForSelector('[data-testid="import-instrument-match"]', { visible: true, timeout: 5_000 }).catch(() => {
      throw new Error('the holdings step does not warn on a holding that matches by its symbol alone')
    })
    await inspect?.('the holding that matches by symbol')
    await shootAt(page, shoot, warned, 'investments-mail-symbol-only')
    const choices = await page.$$('[data-testid="import-instrument-choice"]')
    const last = choices.at(-1)
    if (last === undefined) throw new Error('the holdings step offers no choice')
    await press(last)
    // Another holding Kuna has, the third choice after the one offered and New holding. A new holding's guess would show the report's English description on a Croatian screen.
    const option = await page.waitForFunction(() => document.querySelectorAll('[role="option"]')[2] ?? null, { timeout: 5_000 })
    await press(option.asElement())
    await page.waitForSelector('[data-testid="import-instrument-match"]', { hidden: true, timeout: 5_000 }).catch(() => {
      throw new Error('the warning stays once another holding is picked')
    })
    await inspect?.('the holding once another one is picked')
    await shoot('investments-mail-symbol-other')
  }
}

/**
 * A Flex report saved by hand, dropped on Upload a report in the report's card: one that no longer fits says why, and the
 * made-up report opens the same review as a mailed one, whose Accept writes it with one Undo.
 */
export function investmentsMailUploadFlowIn(language, { flexReport, misfit }) {
  const croatian = language === 'hr'
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(croatian ? `${name}-${language}` : name)
    const upload = await page.waitForSelector('[data-testid="mail-report-upload"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('the card of the report offers no upload')
    })
    const input = await upload.$('input[type="file"]')
    await input.uploadFile(misfit)
    const failed = await page.waitForSelector('[data-testid="mail-report-upload-failed"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('a report that does not fit did not say why')
    })
    await shootAt(page, shoot, failed, 'investments-mail-upload-misfit')
    await input.uploadFile(flexReport)
    await page.waitForSelector('[data-testid="workbook-import"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('the uploaded report opened no review')
    })
    await delay(300)
    await inspect?.('the review of an uploaded report')
    await shoot('investments-mail-upload-review')
    await toDryRun(page, press)
    if ((await page.$('[data-testid="import-group-new"]')) === null) throw new Error('the review of the uploaded report shows nothing new')
    await shoot('investments-mail-upload-dry-run')
    await pressSelector(page, press, '[data-testid="workbook-import-confirm"]')
    await dialogGone(page, '[data-testid="workbook-import"]')
    await undoIn(page, press, { writes: croatian ? writesCroatian : writesEnglish })
    await dismissToasts(page)
  }
}

/** The report's card on the sample with the reader off: switched on, it says its filters are not confirmed. */
export function investmentsMailCardFlowIn(language) {
  const croatian = language === 'hr'
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(croatian ? `${name}-${language}` : name)
    const card = await page.waitForSelector('[data-testid="investments-mail"]', { visible: true, timeout: 10_000 })
    await card.evaluate((element) => element.scrollIntoView({ block: 'start' }))
    await page.waitForSelector('[data-testid="investments-mail-senders"] input', { visible: true, timeout: 5_000 }).catch(() => {
      throw new Error('the card of the report did not open from its link')
    })
    if ((await page.$('[data-testid="investments-mail-unconfirmed"]')) === null) throw new Error('the card does not say its filters are not confirmed')
    await pressSelector(page, press, '[data-testid="investments-mail-on"]')
    await inspect?.('the card of the report, switched on')
    await shoot('investments-mail-card')
  }
}

/** Forgets the made-up keys the import flow kept, so the next flows at this width start without them and without a Keys step. */
async function forgetImportKeys(page) {
  await page.evaluate(() => {
    for (const vendor of ['alphavantage', 'twelvedata']) {
      localStorage.removeItem(`kuna.secret.${vendor}`)
      localStorage.removeItem(`kuna.secret-changed.${vendor}`)
    }
  })
}

/** A file with its history not said to be complete: Overview's set-up line says tax figures are out, Tax holds them back, and My history is complete brings them on. */
export async function investmentsHistoryFlow(page, { press, shoot, inspect }) {
  await page.waitForSelector('[data-testid="getting-set-up"] [data-line="history"]', { visible: true, timeout: 10_000 })
  await inspect?.('the set-up line of a file whose history is not complete')
  const holdingSaysTaxFree = async () => {
    await goTo(page, '#/investments/holdings', 'Holdings')
    await pressSelector(page, press, '[data-testid="holdings-rows"] a[data-testid="holding-row"]')
    await page.waitForSelector('[data-testid="holding-facts"]', { visible: true, timeout: 10_000 })
    return page.evaluate(() => ['holding-facts', 'holding-lots'].some((testId) => document.querySelector(`[data-testid="${testId}"]`)?.textContent?.toLowerCase().includes('tax-free') === true))
  }
  const saleSaysTax = async () => {
    await goTo(page, '#/investments/transactions', 'Transactions')
    await pressSelector(page, press, '[data-testid="transactions-add"]')
    await page.waitForSelector('[data-testid="transaction-form"]', { visible: true })
    await pressLabelled(page, press, '[data-testid="transaction-happened"]', 'Sell')
    await chooseStartingWith(page, press, '[data-testid="transaction-instrument"]', 'Example Tech')
    await chooseStartingWith(page, press, '[data-testid="transaction-account"]', 'Broker One')
    await fill(page, 'transaction-quantity', '2')
    await fill(page, 'transaction-price', '160')
    await page.waitForSelector('[data-testid="transaction-summary"]', { visible: true, timeout: 10_000 })
    await delay(300)
    const says = await page.$eval('[data-testid="transaction-summary"]', (summary) => summary.textContent?.includes('Tax on this sale') === true)
    await page.keyboard.press('Escape')
    await dialogGone(page, '[data-testid="transaction-form"]')
    return says
  }
  if (await holdingSaysTaxFree()) throw new Error('a holding page says what turns tax-free before the history is complete')
  if (await saleSaysTax()) throw new Error('a sale says its tax before the history is complete')
  await goTo(page, '#/investments', 'Overview')
  await pressSelector(page, press, '[data-line="history"] a')
  await page.waitForSelector('[data-testid="tax-history"]', { visible: true, timeout: 10_000 })
  await shoot('investments-tax-history')
  await pressLabelled(page, press, '[data-testid="tax-tabs"]', 'Abroad')
  await page
    .waitForFunction(() => !document.querySelector('[data-testid="tax-history"]'), { timeout: 10_000 })
    .catch(() => {
      throw new Error('income from abroad waits for the history, though it reads no buys')
    })
  await pressLabelled(page, press, '[data-testid="tax-tabs"]', 'Year')
  await pressSelector(page, press, '[data-testid="tax-history-confirm"]')
  await page
    .waitForFunction(() => !document.querySelector('[data-testid="tax-history"]'), { timeout: 10_000 })
    .catch(() => {
      throw new Error('My history is complete did not bring the tax figures on')
    })
  if (!(await holdingSaysTaxFree())) throw new Error('a holding page leaves out what turns tax-free once the history is complete')
  if (!(await saleSaysTax())) throw new Error('a sale leaves out its tax once the history is complete')
  await goTo(page, '#/investments/settings', 'Settings')
  await pressSelector(page, press, '[data-testid="history-not-complete"]')
  await page
    .waitForFunction(() => !document.querySelector('[data-testid="investments-history"]'), { timeout: 10_000 })
    .catch(() => {
      throw new Error('My history is not complete yet did not take the answer back')
    })
  await goTo(page, '#/investments/tax', 'Tax')
  await page.waitForSelector('[data-testid="tax-history"]', { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error('Tax on sales still shows after the answer was taken back')
  })
}

/** Add what I hold now on the sample before its history is said complete: one buy writes one deposit too, cash ends where it was, and one Undo takes both. */
export async function investmentsAddHeldFlow(page, { press, shoot, inspect }) {
  await pressSelector(page, press, '[data-testid="investments-add-held"]')
  await page.waitForSelector('[data-testid="transaction-form"]', { visible: true, timeout: 10_000 })
  if (await page.$('[data-testid="transaction-happened"]')) throw new Error('adding what you hold offers more than a buy')
  await delay(300)
  await elementSays(page, '[role="dialog"]', ['Kuna also adds a deposit'], 'the dialog does not say it adds a deposit')
  await inspect?.('the dialog of what you hold')
  await shoot('investments-add-held')
  await chooseStartingWith(page, press, '[data-testid="transaction-instrument"]', 'Example World')
  await chooseStartingWith(page, press, '[data-testid="transaction-account"]', 'Broker One')
  await fill(page, 'transaction-quantity', '1')
  await fill(page, 'transaction-price', '100')
  await pressSelector(page, press, '[data-testid="transaction-save"]')
  await toast(page, 'Buy added')
  await goTo(page, '#/investments/transactions', 'Transactions')
  await elementSays(page, '[data-testid="transactions"]', ['+€100.00', '−€100.00'], 'the deposit was not written with the buy')
  await undo(page, press)
  await delay(500)
  const leftBehind = await page.$eval('[data-testid="transactions"]', (list) => list.textContent?.includes('+€100.00') === true || list.textContent?.includes('−€100.00') === true)
  if (leftBehind) throw new Error('one Undo left the buy or its deposit behind')
  await dismissToasts(page)
}
