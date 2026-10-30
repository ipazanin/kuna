// The only code that touches Apps Script. The job itself is build/PriceJob.js, made by `npm run build:price-job`.

const DAILY_HOUR = 6

/** The daily run, which the trigger calls and which runs once from the editor after setup. */
function runPrices() {
  const properties = PropertiesService.getScriptProperties()
  const now = new Date()
  const log = KunaPriceJob.runPriceJob(
    {
      fetch(url, headers) {
        const response = UrlFetchApp.fetch(url, { headers, muteHttpExceptions: true })
        return { status: response.getResponseCode(), text: response.getContentText('UTF-8') }
      },
      readFile(fileId) {
        return DriveApp.getFileById(fileId).getBlob().getDataAsString('UTF-8')
      },
      writeFile(fileId, text) {
        DriveApp.getFileById(fileId).setContent(text)
      },
      property(name) {
        const value = properties.getProperty(name)
        return value === null || value.trim() === '' ? null : value.trim()
      },
      pause(milliseconds) {
        Utilities.sleep(milliseconds)
      },
    },
    { at: now.toISOString(), day: Utilities.formatDate(now, 'Europe/Zagreb', 'yyyy-MM-dd') },
  )
  log.forEach((line) => console.log(line))
}

/** Replaces any trigger of runPrices with one a day between 06:00 and 07:00 Zagreb time. */
function installDailyTrigger() {
  ScriptApp.getProjectTriggers()
    .filter((trigger) => trigger.getHandlerFunction() === 'runPrices')
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger))
  ScriptApp.newTrigger('runPrices').timeBased().everyDays(1).atHour(DAILY_HOUR).inTimezone('Europe/Zagreb').create()
}
