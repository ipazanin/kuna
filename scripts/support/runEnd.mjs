/**
 * Runs a cleanup however the run ends: when the process exits, also through `process.exit` or an uncaught error, and on
 * Ctrl-C or a stop. The cleanup must be synchronous, since nothing asynchronous runs once the process is exiting.
 * Returns a function that runs it at once and takes it off, for a run that ends normally.
 */
export function whenRunEnds(cleanup) {
  let done = false
  const once = () => {
    if (done) return
    done = true
    process.off('exit', once)
    process.off('SIGINT', interrupted)
    process.off('SIGTERM', stopped)
    cleanup()
  }
  const interrupted = () => {
    once()
    process.exit(130)
  }
  const stopped = () => {
    once()
    process.exit(143)
  }
  process.on('exit', once)
  process.on('SIGINT', interrupted)
  process.on('SIGTERM', stopped)
  return once
}
