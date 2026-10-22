# Celestial Birthday Reader

A one-page site with a celestial dark theme. Enter your birthday and Claude replies with a short reading: your Western zodiac sign, your Chinese zodiac and related astrological details, in 2–3 sentences.

The front end is plain HTML, CSS and JavaScript. A small Node server handles the Claude API call so your API key never reaches the browser.

## Status

- ✅ The app is built and serves the page.
- ✅ Date validation, error handling and the path-traversal guard were tested with a fake key.
- ✅ The API key works: a live reading came back from Claude Haiku 5.5.
- ✅ The Chinese New Year edge case passed. For 1990-01-20 the reading gave Aquarius / Earth Snake, correctly placing the date before Lunar New Year (Jan 27, 1990).

## Requirements

- Node.js **21.7+**, needed for `process.loadEnvFile()`. Built with v24.
- An Anthropic API key from https://console.anthropic.com/

## Setup

```bash
npm install
cp .env.example .env     # then paste your key after ANTHROPIC_API_KEY=
npm run check-key        # verifies the key with one tiny request
npm start                # http://localhost:3000
```

### `.env`

| Variable | Required | Default | Notes |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | yes | — | Never committed (`.env` is gitignored) |
| `PORT` | no | `3000` | |
| `HOST` | no | `127.0.0.1` | Local only by default. Set `0.0.0.0` only for a trusted LAN demo, because every reading spends API credit. |

## Verifying your API key

`npm run check-key` sends one short request to Claude Haiku 5.5 and prints the result. It never prints the key.

| Output | Meaning |
|---|---|
| `✅ API key works — model …, N in / N out tokens.` | The key is good |
| `❌ ANTHROPIC_API_KEY is not set` | There's no `.env`, or the variable is empty |
| `❌ 401` | The key is invalid or revoked |
| `❌ 403` | The key lacks permission for the model |
| `❌ 429` | You're rate-limited or out of credit |
| `❌ Could not reach the API` | Network problem |

## How it works

```
browser (public/)  ──POST /api/reading {birthday}──▶  server.js  ──▶  lib/astrologer.js  ──▶  Claude API
                   ◀────────── {reading} ───────────                                         (claude-haiku-5-5)
```

1. `public/app.js` checks the date (1900 through today) and POSTs it as `YYYY-MM-DD`.
2. `server.js` validates it again. It must be a real calendar date, from 1900 through today; anything else gets a 400. Each IP is limited to 10 readings per minute.
3. `lib/astrologer.js` sends the date to Claude Haiku 5.5 at `effort: "low"` with this system prompt:

   > You are a concise astrologist. Provide a 2-3 sentence response to a user's astrological information (Western and Chinese) based on their date of birth. Plain language. Never add information that is outside of the scope of the astrology.

4. `server.js` logs each reading's token usage to its console, in the form `[reading] 1994-03-05 — N in / N out tokens`. The browser only gets the reading.
5. The reading is shown with `textContent`, so HTML from the model can't run in the page. API errors (bad key, rate limit, network, refusal) become short, friendly messages. Anything unexpected shows as `internal error`, and the details are logged on the server.

## API

`POST /api/reading`

```bash
curl -s -X POST localhost:3000/api/reading \
  -H 'content-type: application/json' \
  -d '{"birthday":"1994-03-05"}'
```

| Status | Body |
|---|---|
| 200 | `{ "reading": "..." }` |
| 400 | `{ "error": "Enter a real date between 1900 and today." }` |
| 429 | `{ "error": "Too many readings, try again in a minute." }` |
| 500 | `{ "error": "<friendly message or 'internal error'>" }` |

## Project structure

```
.
├── server.js          # static file server + POST /api/reading, security headers, rate limit
├── check-key.js       # npm run check-key: one-shot API key verification
├── lib/
│   └── astrologer.js  # Claude call: model, system prompt, error mapping
├── public/
│   ├── index.html     # birthday form + result card
│   ├── style.css      # celestial dark theme, twinkling starfield
│   └── app.js         # form handling, fetch, rendering
├── .env.example       # template for .env
└── PLAN.md            # original implementation plan
```

## Design

- **Palette:** a deep navy-to-indigo radial gradient (`#0b0d1f` to `#1a1240`), starlight text `#e8e6ff`, gold accent `#f5c66b` and violet accent `#9b8cff`.
- **Starfield:** CSS-only dots on `body::before` with a slow twinkle. The animation stops when the user has `prefers-reduced-motion` set.
- **Type:** Cinzel (Google Fonts) for headings and the system sans-serif for body text.
- **Layout:** a frosted-glass card that adapts down to phone width, with visible focus rings.

## Manual test checklist

- [ ] `npm run check-key` prints ✅
- [ ] 1994-03-05 gives Pisces / Dog (Wood)
- [ ] After a reading, the server console shows `[reading] <date> — N in / N out tokens`
- [x] 1990-01-20 gives Snake, not Horse (the date is before Chinese New Year)
- [ ] A future date or an empty field shows an error
- [ ] Stopping the server and submitting shows "Could not reach the server."
- [ ] The layout works at phone width
