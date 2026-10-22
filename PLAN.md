# Celestial Birthday Reader + API key check

## Context
You want to (1) confirm your Anthropic API key works and (2) build a one-page site in vanilla HTML/CSS/JS. On the page, someone enters their birthday and Claude replies with their Western zodiac sign, Chinese zodiac and a short astrological reading. The page uses a celestial dark theme.

`week_6/day_1` is empty and `ANTHROPIC_API_KEY` isn't set in the shell. The plan follows the pattern from `~/Next_Chapter/chatbot`: a zero-dependency `node:http` server, `process.loadEnvFile()` and `@anthropic-ai/sdk`, with static files served from `public/`. The key stays on the server.

Your choices: a new `.env` in `day_1` (you paste the key in yourself), a tiny Node server, and **Claude Haiku 5.5** (`claude-haiku-5-5`).

## Files (all new, in `/home/torosanctum/Next_Chapter/week_6/day_1/`)

| File | Purpose |
|---|---|
| `package.json` | `"type": "module"`, dep `@anthropic-ai/sdk`, scripts `start` (`node server.js`) and `check-key` (`node check-key.js`) |
| `.env.example` | `ANTHROPIC_API_KEY=sk-ant-...`, `PORT=3000` |
| `.gitignore` | `.env`, `node_modules/` |
| `check-key.js` | **Key verification.** Sends one tiny Haiku request and prints `✅ API key works (model, tokens used)` or a clear failure: 401 = invalid key, 403 = no permission, 429 = rate limit or no credit, connection error = network. Never prints the key. |
| `lib/astrologer.js` | `getReading(birthday)`: calls Claude with the system prompt (verbatim, below) and returns the text |
| `server.js` | Serves `public/` and handles `POST /api/reading`. Copies the chatbot pattern: binds to 127.0.0.1, path-traversal guard, simple per-IP rate limit, security headers |
| `public/index.html` | Form with a date input (`type="date"`, max = today) and a submit button, plus a result card |
| `public/style.css` | Celestial dark mode (details below) |
| `public/app.js` | Validates the date, POSTs JSON, shows a loading state, renders the reply with `textContent` (no innerHTML) and shows errors |

## Claude call (`lib/astrologer.js`)
- `new Anthropic()` reads `ANTHROPIC_API_KEY` from `.env` via `process.loadEnvFile()` in `server.js` and `check-key.js`.
- `client.messages.create({ model: "claude-haiku-5-5", max_tokens: 2000, output_config: { effort: "low" }, system: SYSTEM_PROMPT, messages: [{ role: "user", content: \`My date of birth is ${isoDate} (${longFormDate}).\` }] })`
  - Effort is set to `low` explicitly because Haiku 5.5 defaults to `medium` and a 2–3 sentence answer doesn't need more.
  - The long-form date (for example "March 5, 1994") avoids month/day confusion.
- System prompt, verbatim:
  > You are a concise astrologist. Provide a 2-3 sentence response to a user's astrological information (Western and Chinese) based on their date of birth. Plain language. Never add information that is outside of the scope of the astrology.
- Check `stop_reason`. If it's `"refusal"` (Haiku has no server-side fallback), return a friendly "couldn't read the stars" message. Otherwise join the `text` blocks.
- Errors are caught from most to least specific: `Anthropic.AuthenticationError` → "server API key is invalid", then `RateLimitError`, `APIError`, `APIConnectionError`. The server sends only a short safe message to the browser.

## Server validation (`POST /api/reading`)
- Body is `{ birthday: "YYYY-MM-DD" }`. The server checks the format with a regex, confirms it parses to a real date, requires the year to be ≥ 1900 and rejects dates in the future. Anything else gets a 400.
- Only `{ reading }` is sent back to the browser.

## Celestial dark mode (`style.css`)
- CSS variables: deep navy/indigo background (`#0b0d1f` to `#1a1240` radial gradient), starlight text `#e8e6ff`, gold accent `#f5c66b`, soft violet `#9b8cff`.
- Starfield is drawn with layered `radial-gradient` dots on `body::before`, with a slow twinkle animation that's turned off under `prefers-reduced-motion`.
- Glassy card (`backdrop-filter: blur`, translucent border), a serif display font for the title (Google Fonts "Cinzel") and system sans for body text.
- Responsive with a 16px gutter on mobile, visible focus rings and AA contrast.

## Steps for you
1. `cp .env.example .env` and paste your key into `.env` (I won't see or handle it).
2. `npm install`

## Verification
1. **Key check:** run `npm run check-key`. It should print ✅ with token usage. If it fails, the message names the cause (401 means the key is invalid or was revoked, and so on).
2. **Server:** run `npm start`, then `curl -s -X POST localhost:3000/api/reading -H 'content-type: application/json' -d '{"birthday":"1994-03-05"}'`. Expect a 2–3 sentence reading that mentions Pisces and Dog (Wood). Also confirm that `{"birthday":"2999-01-01"}` and `{"birthday":"nope"}` return 400.
3. **Browser:** open http://localhost:3000, submit a date and check the loading state, the rendered reading, the error state (stop the server and submit again) and the mobile layout.
4. **Edge case:** try a birthday near Chinese New Year (for example 1990-01-20, which should give Snake rather than Horse) to check the model handles the lunar cutoff.
