export const INVESTMENTS_OVERVIEW_ROUTE = '/investments'
/** The Investments first run, with its step in the query. */
export const INVESTMENTS_START_ROUTE = '/investments/start'
export const INVESTMENTS_SETTINGS_ROUTE = '/investments/settings'
/** The General tab of the Investments Settings, named in the address so a link opens it whichever tab was open. */
export const INVESTMENTS_GENERAL_ROUTE = `${INVESTMENTS_SETTINGS_ROUTE}?tab=general`
/** The Prices tab of the Investments Settings, with the vendors' keys and the last fetch. */
export const INVESTMENTS_PRICES_ROUTE = `${INVESTMENTS_SETTINGS_ROUTE}?tab=prices`
/** The Checks tab of the Investments Settings, with each portfolio check's threshold and switch. */
export const INVESTMENTS_CHECKS_ROUTE = `${INVESTMENTS_SETTINGS_ROUTE}?tab=checks`
/** The Assistant tab of the Investments Settings, which says whether the chat asks before it reads. */
export const INVESTMENTS_ASSISTANT_ROUTE = `${INVESTMENTS_SETTINGS_ROUTE}?tab=assistant`

/** The Overview's Portfolio checks, opened even when this device folded them. */
export const PORTFOLIO_CHECKS_ROUTE = `${INVESTMENTS_OVERVIEW_ROUTE}#portfolio-checks`
