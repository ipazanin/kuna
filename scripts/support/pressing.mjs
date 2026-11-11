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

/**
 * Types a day as YYYY-MM-DD into a DayField the way a person does, segment by segment. The year goes first and the day
 * last, so a day such as the 31st is never cut to fit the month the field held before.
 */
export async function typeDay(field, day) {
  const [year, month, date] = day.split('-')
  for (const [part, digits] of [
    ['year', year],
    ['month', month],
    ['day', date],
  ]) {
    const segment = await field.$(`[data-segment="${part}"]`)
    if (segment === null) throw new Error(`the day field has no ${part} segment`)
    await segment.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await segment.click()
    await field.frame.page().keyboard.type(digits)
  }
}
