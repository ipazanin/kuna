import { syncRates } from '../application/pageRates'
import type { SyncStep } from '../../sync/application/sync'
import { listInWords } from '../../text/listInWords'
import { words } from './words'

/** The run the rates last synced in, by its start, so a later group of that run does not reach Drive again. */
let servedRun: string | null = null

/**
 * The rates step an app's sync group lists after its books, on while `wanted` holds. It merges this browser's rates
 * with the file on Drive, fetches what is due and writes what changed. Every app that needs rates lists it, and in one
 * run only the first group's step reaches Drive. A new file goes beside the app's file, `besideFileId`, while there is
 * no Kuna folder.
 */
export function ratesStep(wanted: () => boolean, besideFileId: () => string | null): SyncStep {
  return {
    id: 'rates',
    label: words.step.label,
    scopes: () => ['drive.file'],
    startLine: words.step.start,
    leftOutWhenOff: true,
    on: wanted,
    async run(_report, startedAt) {
      const fileId = besideFileId()
      if (servedRun === startedAt || fileId === null) {
        return { kind: 'done', line: words.step.unchanged, writeId: null, link: null }
      }
      const update = await syncRates(fileId)
      servedRun = startedAt
      if (typeof update.drive === 'object') {
        return { kind: 'failed', line: words.step.refused, link: null }
      }
      return update.failed.length > 0
        ? { kind: 'failed', line: words.step.failed, link: null }
        : { kind: 'done', line: words.step.done(listInWords(Object.keys(update.file.ecb).sort())), writeId: null, link: null }
    },
  }
}
