/**
 * What the visual check's screen and flow lists share: the widths it renders at, the named sets of widths a flow runs at,
 * the day the fake build seeds its prices for and the Croatian money format.
 */

import { pricesDay } from '../../src/apps/investments/prices/application/pricesUpdate.ts'

/**
 * Every screen renders at each width. A width with a `theme` renders in that theme only, since the
 * layout does not change with the theme. `cardFlow` collapses and expands a card on each screen.
 */
export const VIEWPORTS = [
  { name: 'phone', width: 360, height: 780, cardFlow: true },
  { name: 'phone-large', width: 430, height: 932, cardFlow: true },
  { name: 'small-tablet', width: 640, height: 960, theme: 'light' },
  { name: 'tablet', width: 768, height: 1024, alignedCards: true, theme: 'dark' },
  { name: 'tablet-wide', width: 1024, height: 1366, alignedCards: true, theme: 'light' },
  { name: 'laptop', width: 1280, height: 800, alignedCards: true, theme: 'dark' },
  { name: 'desktop', width: 1440, height: 900, alignedCards: true, cardFlow: true },
  { name: 'wide', width: 1920, height: 1080, alignedCards: true, theme: 'dark' },
  { name: 'wider', width: 2560, height: 1440, alignedCards: true, theme: 'light' },
  // The expanded sidebar beside the docked chat: at its narrowest, where the owner first met it, and on a wide monitor.
  { name: 'docked-narrowest', width: 1264, height: 900, alignedCards: true, theme: 'light', chatDocked: true },
  { name: 'docked-laptop', width: 1390, height: 900, alignedCards: true, theme: 'dark', chatDocked: true },
  { name: 'docked-wide', width: 1920, height: 1080, alignedCards: true, theme: 'light', chatDocked: true },
]

/** The day the fake build seeds its prices for, so the expected figures are the ones on screen. */
export const INVESTMENTS_DAY = pricesDay(new Date().toISOString())
export const CROATIAN_MONEY = { currency: 'EUR', locale: 'hr-HR' }

/** The dialog flows run at every width, so the uneven form row rule sees each dialog as every width lays it out. */
export const EVERY_VIEWPORT = VIEWPORTS.filter((viewport) => !viewport.chatDocked).map((viewport) => viewport.name)
/** The menu flows run at the widths where a menu's text wraps differently, so the text overlap rule sees every picker open. */
export const MENU_VIEWPORTS = ['phone', 'small-tablet', 'tablet-wide', 'desktop']
/** The widths where the sidebar's states and the docked chat trade room. */
export const SIDEBAR_VIEWPORTS = ['tablet-wide', 'laptop', 'desktop', 'wide']
/** The widths a design review looks at, for the flows that shoot what it needs. */
export const DESIGN_REVIEW_VIEWPORTS = ['phone', 'small-tablet', 'tablet-wide', 'desktop']
