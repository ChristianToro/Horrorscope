# Celestial Birthday Reader

A gothic-horror prank disguised as a friendly astrology site. The landing page looks like a celestial birthday reader. When you submit your birthday:

1. A creepy face lunges at the screen with a synthesized shriek and red flashes.
2. The page fades to black and **"...you have died..."** appears one letter at a time.
3. A haunted house fades in. The page is dark, and your cursor is a candle that lights it.
4. A modal shows three sections:
   - a dark **horoscope** for your Western sign
   - a **historical death**: someone who died on your birthday's month and day, with their portrait and a Wikipedia link
   - a **dark omen** that ties the two together

The front end is plain HTML, CSS and JavaScript. A small Node server calls Claude and Wikipedia, so your API key never reaches the browser.

## Status

- ✅ The horror redesign is built (see `PLAN-HORROR.md`).
- ✅ It was checked in headless Chrome at 1280×800 and 390×844: scare → black → message → crypt → modal. The candle follows the cursor, the portrait loads with no CSP violations, and there's no horizontal scroll on phones.
- ✅ The live structured-output reading works: Pisces only (no Chinese sign), and the omen mentions the historical figure.
- ✅ Date validation, error handling and the path-traversal guard are unchanged and still pass.
- ✅ The shriek plays in a real browser (confirmed by the user).

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
browser (public/)  ──POST /api/reading {birthday}──▶  server.js ──▶ lib/wikimedia.js  ──▶  Wikipedia "On This Day" (deaths)
                                                                └─▶ lib/astrologer.js ──▶  Claude API (claude-haiku-5-5)
                   ◀────── {horoscope, death, omen} ──
```

1. `public/app.js` checks the date (1900 through today), starts the POST, and plays the haunting while the request runs.
2. `server.js` validates the date again. It must be a real calendar date, from 1900 through today; anything else gets a 400. Each IP is limited to 10 readings per minute.
3. `lib/wikimedia.js` fetches that month/day's deaths from Wikipedia, caches the list in memory, and picks a random entry that has a summary. If Wikipedia fails, `death` is `null` and the reading still works.
4. `lib/astrologer.js` sends the date and the death to Claude Haiku 5.5 at `effort: "low"`, using structured output (`{horoscope, omen}`) and this system prompt:

   > You are a gothic fortune-teller of grim omens. You are given a person's date of birth and a historical figure who died on that same calendar day. horoscope: 2-3 sentences on their Western zodiac sign, told in a dark, ominous tone. omen: 2-3 sentences of foreboding that weave their sign together with the historical death. Plain language. Never invent facts about the historical figure beyond what you are given. Keep it eerie, not graphic: no gore, no self-harm, no real threats.

5. `server.js` logs each reading as `[reading] 1994-03-05 — <death name> — N in / N out tokens`. The browser never sees token counts.
6. Everything is shown with `textContent`, so HTML from the model or Wikipedia can't run in the page. API errors (bad key, rate limit, network, refusal) become short messages in the crypt. Anything unexpected shows as `internal error`, and the details are logged on the server.

## API

`POST /api/reading`

```bash
curl -s -X POST localhost:3000/api/reading \
  -H 'content-type: application/json' \
  -d '{"birthday":"1994-03-05"}'
```

| Status | Body |
|---|---|
| 200 | `{ "horoscope": "...", "omen": "...", "death": { "name", "year", "text", "description", "extract", "thumbnail", "url" } \| null }` |
| 400 | `{ "error": "Enter a real date between 1900 and today." }` |
| 429 | `{ "error": "Too many readings, try again in a minute." }` |
| 500 | `{ "error": "<friendly message or 'internal error'>" }` |

## Project structure

```
.
├── server.js          # static file server + POST /api/reading, security headers, rate limit
├── check-key.js       # npm run check-key: one-shot API key verification
├── lib/
│   ├── astrologer.js  # Claude call: model, system prompt, JSON schema, error mapping
│   └── wikimedia.js   # Wikipedia "On This Day" deaths: fetch, cache, random pick
├── public/
│   ├── index.html     # decoy form, scare image, crypt + omen modal
│   ├── style.css      # celestial decoy theme + gothic crypt theme
│   ├── app.js         # submit → scare → fade → message → crypt → modal; shriek; candle
│   └── assets/        # haunted-house background, scare face, candle cursors
├── .env.example       # template for .env
├── PLAN.md            # original implementation plan
└── PLAN-HORROR.md     # horror redesign plan
```

## Design

- **Decoy:** unchanged. A navy-to-indigo gradient, gold and violet accents, a twinkling CSS starfield, Cinzel headings and a frosted-glass card.
- **Jump scare:** `assets/scary-anime-white-creepy-face-77575efixwlhmwp1.webp` lunges (scale 0.15→1.5) and shakes over red flashes. Flashes are kept under 3 per second (WCAG 2.3.1). The shriek is detuned sawtooth oscillators sweeping 700→1600 Hz with vibrato plus band-passed noise, all generated with Web Audio, so there are no audio files.
- **Crypt:** a near-black palette with bone text `#d9cdb4`, blood red `#8a0f14`, ember `#ff9a3c` and tarnished gold. The background is the desaturated haunted house. A steady `radial-gradient` darkness layer opens around the cursor. The pointer is a native candle cursor (`assets/candle-cursor.svg`, clicking at the flame tip), and it switches to a haloed candle (`candle-cursor-lit.svg`) over links and buttons. On touch devices the light starts in the center and follows taps.
- **Type:** Cinzel for headings and IM Fell English for the crypt text (Google Fonts).
- **Reduced motion:** no shake or flashing. The face simply appears, and the message still fades in.

## Manual test checklist

- [ ] `npm run check-key` prints ✅
- [x] 1994-03-05 gives a Pisces horoscope with no Chinese sign
- [x] After a reading, the server console shows `[reading] <date> — <name> — N in / N out tokens`
- [x] The jump scare's shriek plays (real browser, sound on)
- [x] Scare → black → "...you have died..." → crypt → modal plays in order
- [x] The candle light follows the cursor and holds still
- [ ] The candle cursor shows, and turns haloed over "Rise again" and the Wikipedia link (real browser; headless screenshots don't draw the cursor)
- [x] The historical death shows a portrait and link with no CSP errors in the console
- [x] Submitting the same date twice gives different deaths
- [ ] A future date or an empty field shows an error on the decoy, with no scare
- [ ] Stopping the server and submitting shows "The spirits are silent: Could not reach the server."
- [ ] "Rise again" returns to the decoy
- [x] The layout works at phone width
- [ ] Reduced-motion mode (OS setting) has no flashing or shake
