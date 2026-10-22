# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Use the `prompt-history` skill to maintain PROMPT-HISTORY.md — invoke it at the
start of the session and keep it updated as work progresses.

## Project

Celestial Birthday Reader: a one-page vanilla HTML/CSS/JS site. The user enters a birthday and Claude returns a 2–3 sentence Western + Chinese zodiac reading. A small Node server holds the API key so it never reaches the browser.

## Commands

```bash
npm install
npm run check-key   # one tiny Claude request; verifies ANTHROPIC_API_KEY (never prints it)
npm start           # http://127.0.0.1:3000
```

There is no build step, linter or test suite. To check the API by hand:

```bash
curl -s -X POST localhost:3000/api/reading -H 'content-type: application/json' -d '{"birthday":"1994-03-05"}'
```

Config lives in `.env`, read by `process.loadEnvFile()`, which needs Node ≥ 21.7. Settings: `ANTHROPIC_API_KEY` (required), `PORT` (default 3000) and `HOST` (default `127.0.0.1`; keep it local, because every reading spends API credit). The user fills in `.env` themselves. Don't read it or echo the key.

## Architecture

The request flow is `public/app.js` → `POST /api/reading {birthday: "YYYY-MM-DD"}` → `server.js` → `lib/astrologer.js#getReading()` → Claude → `{reading}`. `getReading()` returns `{reading, usage}`. `server.js` logs the token usage on its `[reading]` line and sends only `reading` to the browser; token counts are deliberately kept out of the UI.

- **`server.js`** has zero dependencies (`node:http`). It serves `public/` with a path-traversal guard and handles the single API route. It loads `.env` *before* dynamically importing `lib/astrologer.js`.
- **Date validation happens twice.** `app.js` sets the form's min/max (1900 to today, local time). `server.js#isValidBirthday()` is the real gate: it checks the format, rejects impossible dates like Feb 30 by round-tripping through `toISOString()`, and enforces the same range.
- **`lib/astrologer.js`** owns everything about Claude: model, system prompt and error mapping. It creates the client lazily, so importing the module doesn't need a key. It sends the date in both long-form and ISO so month and day can't be swapped.
- **Errors:** only a `UserFacingError` message reaches the browser. Any other error shows as `internal error`, and the details are logged on the server. The SDK's `AuthenticationError`, `RateLimitError` and `APIConnectionError`, and `stop_reason: "refusal"`, are all converted to `UserFacingError`.
- **Security:** headers in `server.js` include a Content Security Policy that allows Google Fonts (`fonts.googleapis.com` / `fonts.gstatic.com`) for the Cinzel heading font. Any new external asset needs a CSP update. The reading is rendered with `textContent`, never `innerHTML`.
- **`check-key.js`** stands alone (`maxRetries: 0`) and uses the same model as the app. Keep the two in sync if the model changes.

## Claude API decisions (user-chosen — don't change without asking)

- The model is `claude-haiku-5-5`. The user picked it over Opus and Sonnet.
- The request uses `output_config: { effort: "low" }`. Haiku 5.5 defaults to `medium`, and a 2–3 sentence reply doesn't need more. Thinking is left at its default.
- The system prompt in `lib/astrologer.js` is the user's wording, verbatim. Don't edit it without being asked.
- Haiku has no server-side refusal fallback, so check `stop_reason` before reading content.

## Known limitation

Only a date is collected. Western-sign cusp dates (for example 1990-01-20) depend on the time of birth, so the model's answer can be off for people born on those days. An optional birth-time field was offered to the user but hasn't been decided.

## Docs in this directory

- `PLAN.md` is the original implementation plan.
- `README.md` is the user-facing setup and status, including a manual test checklist.
- `PROMPT-HISTORY.md` is the engineering log kept by the `prompt-history` skill.
