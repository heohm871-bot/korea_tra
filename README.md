# K-Spotlight

## Cloudflare Pages deploy
- Framework preset: `None`
- Build command: `npm run build:pages`
- Build output directory: `.`

## Firebase runtime config
- `firebase-runtime-config.js` is loaded at runtime.
- `npm run build:pages` generates `firebase-runtime-config.js` from env vars.
- Expected env vars:
  - `FIREBASE_API_KEY`
  - `FIREBASE_AUTH_DOMAIN`
  - `FIREBASE_PROJECT_ID`
  - `FIREBASE_STORAGE_BUCKET`
  - `FIREBASE_MESSAGING_SENDER_ID`
  - `FIREBASE_APP_ID`

## i18n QA
- Manual checklist: `docs/i18n-test-checklist.md`
