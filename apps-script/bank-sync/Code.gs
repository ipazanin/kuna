/**
 * Relays Kuna's calls to Enable Banking, since a page cannot reach api.enablebanking.com itself. Kuna signs each call with
 * the person's own key and passes the token first, with the session ids a call needs. The script keeps nothing: no key, no
 * session and nothing a bank answers. It cuts each answer down to the fields Kuna reads, and `bankFields` answers names
 * and counts, never a value.
 *
 * `psuUserAgent` is the browser's user agent on a fetch a person started. Any such header tells the bank the person is
 * there, which lifts the limit of four unattended reads a day.
 */

const API = 'https://api.enablebanking.com'
const COUNTRY = 'HR'
const MAX_PAGES = 500
const DAYS_COUNTED = 89
const FIELDS_USER_AGENT = 'Kuna bank sync, what your banks send'

/** The fixed codes `bankFields` counts by name. Anything else counts as other, so no text from a bank reaches the answer. */
const COUNTED_CODES = {
  status: ['BOOK', 'PDNG', 'HOLD', 'CNCL', 'OTHR', 'RJCT', 'SCHD'],
  credit_debit_indicator: ['CRDT', 'DBIT'],
  balance_type: ['CLAV', 'CLBD', 'FWAV', 'INFO', 'ITAV', 'ITBD', 'OPAV', 'OPBD', 'OTHR', 'PRCD', 'VALU', 'XPCD'],
  cash_account_type: ['CACC', 'CARD', 'CASH', 'LOAN', 'OTHR', 'SVGS'],
}

/** The application the token was signed for, as Kuna checks it before keeping its key. */
function application(token) {
  const found = call_(token, 'get', '/application')
  return { name: found.name ?? '', environment: found.environment ?? '', redirectUrls: found.redirect_urls ?? [], active: found.active === true }
}

/** Starts a bank's approval for as long as the bank allows, and says where to send the tab. */
function startLink(token, bank, redirectUrl, state) {
  const aspsp = call_(token, 'get', `/aspsps?country=${COUNTRY}`).aspsps.find((candidate) => candidate.name === bank)
  if (aspsp === undefined) throw new Error(`Enable Banking lists no ${bank} in ${COUNTRY}`)
  const validUntil = new Date(Date.now() + (aspsp.maximum_consent_validity - 60) * 1000).toISOString()
  const started = call_(token, 'post', '/auth', { body: { access: { valid_until: validUntil }, aspsp: { name: bank, country: COUNTRY }, state, redirect_url: redirectUrl, psu_type: 'personal' } })
  return { url: started.url }
}

/** Trades the code the bank came back with for a session, and answers only its id, its bank and how long it lasts. Kuna closes the session it replaces. */
function finishLink(token, code) {
  const session = call_(token, 'post', '/sessions', { body: { code } })
  return { sessionId: session.session_id, bank: session.aspsp.name, validUntil: session.access.valid_until }
}

/** A bank that allows one session has already ended the old one, so a refusal here changes nothing. */
function closeSession(token, sessionId) {
  try {
    call_(token, 'delete', `/sessions/${sessionId}`)
  } catch (refusal) {
    return
  }
}

/**
 * Each session's accounts, which restricted mode cuts down to the accounts linked in Enable Banking's panel. `sessions` are
 * Kuna's, as `[{ bank, sessionId }]`. One bank failing is that bank's answer, and leaves the others theirs.
 */
function accounts(token, sessions, psuUserAgent) {
  return sessions.map(({ bank, sessionId }) => {
    try {
      const session = call_(token, 'get', `/sessions/${sessionId}`)
      return { bank, status: session.status, accounts: session.status === 'AUTHORIZED' ? session.accounts.map((uid) => accountOf_(token, uid, psuUserAgent)) : [] }
    } catch (failure) {
      return { bank, status: 'FAILED', reason: failure.message, accounts: [] }
    }
  })
}

/** What Kuna drafts an account from. Never `name`, which Enable Banking fills with the holder's own name. */
function accountOf_(token, uid, psuUserAgent) {
  const details = call_(token, 'get', `/accounts/${uid}/details`, { psuUserAgent })
  return {
    uid,
    iban: details.account_id?.iban ?? '',
    currency: details.currency,
    product: details.product ?? null,
    details: details.details ?? null,
    cashAccountType: details.cash_account_type ?? null,
    usage: details.usage ?? null,
    identificationHash: details.identification_hash ?? null,
  }
}

/** Every page of an account's transactions from the day. A page may be empty and still name a next one, so only a missing key ends the list. */
function transactions(token, accountUid, from, strategy, psuUserAgent) {
  return bankRows_(token, accountUid, from, strategy, psuUserAgent).map(transactionOf_)
}

function bankRows_(token, accountUid, from, strategy, psuUserAgent) {
  const found = []
  let continuationKey = null
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const query = [`date_from=${from}`, `strategy=${strategy}`, ...(continuationKey === null ? [] : [`continuation_key=${encodeURIComponent(continuationKey)}`])]
    const answer = call_(token, 'get', `/accounts/${accountUid}/transactions?${query.join('&')}`, { psuUserAgent })
    found.push(...(answer.transactions ?? []))
    continuationKey = answer.continuation_key ?? null
    if (continuationKey === null) return found
  }
  throw new Error(`The bank was still naming a next page after ${MAX_PAGES} pages`)
}

/** What the bank says an account holds, one line for each kind of balance it keeps. */
function balances(token, accountUid, psuUserAgent) {
  return (call_(token, 'get', `/accounts/${accountUid}/balances`, { psuUserAgent }).balances ?? []).map((balance) => ({
    amount: balance.balance_amount?.amount ?? '',
    currency: balance.balance_amount?.currency ?? '',
    type: balance.balance_type ?? '',
  }))
}

function transactionOf_(transaction) {
  return {
    reference: transaction.entry_reference ?? null,
    amount: transaction.transaction_amount?.amount ?? '',
    currency: transaction.transaction_amount?.currency ?? '',
    direction: transaction.credit_debit_indicator ?? '',
    status: transaction.status,
    bookedOn: transaction.booking_date ?? null,
    valueOn: transaction.value_date ?? null,
    madeOn: transaction.transaction_date ?? null,
    creditorName: transaction.creditor?.name ?? null,
    creditorIban: transaction.creditor_account?.iban ?? null,
    debtorName: transaction.debtor?.name ?? null,
    debtorIban: transaction.debtor_account?.iban ?? null,
    remittance: transaction.remittance_information ?? [],
    exchangeRate: transaction.exchange_rate?.exchange_rate ?? null,
  }
}

/**
 * For each session, the names of the fields Enable Banking returns and how many records carry each, for each account's
 * last 89 days. It never answers an amount, a name, an IBAN, an id or any text from a bank, only counts and the fixed codes
 * in `COUNTED_CODES`.
 */
function bankFields(token, sessions) {
  return sessions.map(({ bank, sessionId }) => {
    const session = call_(token, 'get', `/sessions/${sessionId}`)
    return { bank, session: fieldCounts_([session]), accounts: (session.accounts ?? []).map((uid) => accountFields_(token, uid)) }
  })
}

function accountFields_(token, uid) {
  const options = { psuUserAgent: FIELDS_USER_AGENT }
  const details = call_(token, 'get', `/accounts/${uid}/details`, options)
  const balanceRows = call_(token, 'get', `/accounts/${uid}/balances`, options).balances ?? []
  const from = new Date(Date.now() - DAYS_COUNTED * 86400000).toISOString().slice(0, 10)
  const rows = bankRows_(token, uid, from, 'default', FIELDS_USER_AGENT)
  return {
    details: { singleCurrency: details.currency !== 'XXX', hasIban: Boolean(details.account_id?.iban), fields: fieldCounts_([details]), codes: codeCounts_([details]) },
    balances: { count: balanceRows.length, fields: fieldCounts_(balanceRows), codes: codeCounts_(balanceRows) },
    transactions: { count: rows.length, fields: fieldCounts_(rows), codes: codeCounts_(rows), days: dayCounts_(rows) },
  }
}

/** How many of the records carry each field, nested fields as `parent.child` and lists as `name[]`, with empty fields left out. */
function fieldCounts_(records) {
  const counts = {}
  const count = (name, field) => {
    if (field === null || field === undefined || field === '') return
    if (Array.isArray(field)) field.forEach((inList) => count(`${name}[]`, inList))
    else if (typeof field === 'object') Object.keys(field).forEach((inner) => count(`${name}.${inner}`, field[inner]))
    else counts[name] = (counts[name] ?? 0) + 1
  }
  records.forEach((record) => Object.keys(record).forEach((name) => count(name, record[name])))
  return counts
}

/** How many records hold each fixed code, as `status BOOK`. */
function codeCounts_(records) {
  const counts = {}
  records.forEach((record) =>
    Object.keys(COUNTED_CODES)
      .filter((field) => record[field] !== undefined && record[field] !== null)
      .forEach((field) => {
        const name = `${field} ${COUNTED_CODES[field].includes(record[field]) ? record[field] : 'other'}`
        counts[name] = (counts[name] ?? 0) + 1
      }),
  )
  return counts
}

/** How the rows' days are written: how many carry a time, and how many were made on another day than they booked. */
function dayCounts_(rows) {
  const withTime = (field) => rows.filter((row) => String(row[field] ?? '').includes('T')).length
  const madeOnAnotherDay = rows.filter((row) => row.transaction_date && row.booking_date && String(row.transaction_date).slice(0, 10) !== String(row.booking_date).slice(0, 10)).length
  return { bookingDateWithTime: withTime('booking_date'), transactionDateWithTime: withTime('transaction_date'), valueDateWithTime: withTime('value_date'), madeOnAnotherDay }
}

function call_(token, method, path, { body, psuUserAgent } = {}) {
  const response = UrlFetchApp.fetch(API + path, {
    method,
    muteHttpExceptions: true,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', ...(psuUserAgent ? { 'Psu-User-Agent': psuUserAgent } : {}) },
    ...(body === undefined ? {} : { contentType: 'application/json', payload: JSON.stringify(body) }),
  })
  const status = response.getResponseCode()
  const answer = JSON.parse(response.getContentText() || '{}')
  if (status >= 400) throw new Error(`Enable Banking answered ${status}: ${answer.error ?? ''} ${answer.message ?? ''}`.trim())
  return answer
}
