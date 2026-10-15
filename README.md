# Ledgerboard

Company finance dashboards over a Google Sheet of bank transactions. The Sheet stays the system of record.
The app reads it with the user's own Google token, keeps a copy in IndexedDB, and computes every
figure in the browser. There is no backend. It deploys to GitHub Pages at
`https://ipazanin.github.io/ledgerboard/`.

The app asks Google for one scope only, `drive.file`, which covers files the user picks in the
Google Picker or that the app creates. The access token lives in memory and is never stored.

## Development

```sh
npm install
npm run dev            # http://localhost:5173/ledgerboard/, talks to Google
npm run dev:fake       # same app on a small synthetic workbook, no Google needed
npm run check          # typecheck and unit tests
npm run build          # production build into dist/, then checks no dev-only code shipped
npm run build:fake     # fake-mode build into dist-fake/, for the visual check
npm run preview:fake -- --port 4173
npm run check:visual   # every screen at four widths in local Chrome, screenshots in visual-check/
```

In development only, `#/spike` holds one button per Google step (sign in, pick, read, write,
folder listing, xlsx export, silent token renewal). Each logs a timestamped line on the page and
in the console with the prefix `[spike]`. The route does not exist in a production build.

## Google configuration

Three variables, read at build time:

| Variable | What it is |
|---|---|
| `VITE_GOOGLE_CLIENT_ID` | OAuth web client ID from the Cloud project |
| `VITE_GOOGLE_API_KEY` | API key restricted to the Picker API and the app's origins |
| `VITE_GOOGLE_PROJECT_NUMBER` | Cloud project number, which the Picker uses as its app ID |

For development, put them in `.env.local`, which git ignores. For the deployed build, set them as
repository Actions variables. The deploy workflow passes them to `npm run build`. A fork hosted on
its own GitHub Pages needs its own Cloud project and its own three values, because the OAuth client
only accepts the origins it was created for. None of them is a
secret, because all three end up in the page anyway. A missing one fails the first Google call
with an error that names it.

## Content Security Policy

GitHub Pages cannot set headers, so the policy is a `<meta>` tag in `index.html`. Scripts may load
only from this origin and from Google's two script hosts, frames only from Google's Picker and
sign-in hosts, and requests go only to the Sheets and Drive APIs. Styles allow `'unsafe-inline'`
because Nuxt UI writes its colour variables into an inline `<style>`, and the Google Picker and
Identity Services libraries inject their own. Without it the Picker dialog loses its layout. The
dev server adds `ws://localhost:*` for hot reload.

## Licence

MIT
