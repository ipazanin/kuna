/**
 * Waiting and pressing on a page, shared by the visual, touch and Firefox checks. It imports nothing from the app, so a
 * check run without the TypeScript loader can use it.
 */

export function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

/** Waits for the element to show, scrolls it to the middle and presses it with `press`, which clicks or taps a handle. */
export async function pressSelector(page, press, selector) {
  const handle = await page.waitForSelector(selector, { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error(`no visible ${selector} within 10 s`)
  })
  await handle.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await delay(200)
  await press(handle)
  return handle
}
