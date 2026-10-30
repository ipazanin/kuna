const CHART_CANVASES = '.chart-body canvas, .donut-ring canvas'

/**
 * Waits until ECharts has finished animating bars and rings in, so a screenshot or a tap sees where they
 * land: every chart canvas shows the same picture at two looks in a row, 100 ms apart.
 */
export async function settleCharts(page) {
  await page.waitForFunction(
    (selector) => {
      const canvases = [...document.querySelectorAll(selector)]
      const pictures = canvases.map((canvas) => canvas.toDataURL()).join()
      const settled = canvases.length > 0 && pictures === window.__kunaChartPictures
      window.__kunaChartPictures = pictures
      return settled
    },
    { polling: 100, timeout: 10_000 },
    CHART_CANVASES,
  )
}
