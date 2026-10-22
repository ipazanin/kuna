/**
 * A screenshot of the whole page. Puppeteer's default capture beyond the viewport first shrinks the
 * window to 1 px, which makes every chart on the page lay itself out a few pixels wide and still be
 * growing back when the picture is taken. Growing the viewport to the page's height instead keeps
 * every chart at its real width.
 */
export function screenshotWholePage(page, path) {
  return page.screenshot({ path, fullPage: true, captureBeyondViewport: false })
}
