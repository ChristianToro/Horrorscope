# Plan: "Horrify" the Celestial Birthday Reader

## Context

The landing page stays exactly as it is and works as a decoy. When the user submits a birthday, a jump scare plays. The screen then fades to black, "...you have died..." appears slowly, and a gothic crypt screen fades in over `public/assets/sananthropis-haunted-house-7508035_1920.jpg`. The page is dark and the cursor works as a candle that lights it. A modal shows three sections:

1. **Horoscope**: a darker reading of the **Western sign only** (the user dropped the Chinese zodiac).
2. **Historical death**: a random person who died on the same month/day, from Wikipedia's "On This Day" feed, with photo and link.
3. **Dark omen**: ties the horoscope and that death together.

Decisions made with the user:
- Use the drafted system prompt, Western only (this replaces the "verbatim user prompt").
- Pick a random death each time.
- The jump scare is an inline SVG ghoul plus a shriek synthesized with Web Audio, so no new asset files.
- Show the death's photo and a link to the article.

Verified: `GET https://en.wikipedia.org/api/rest_v1/feed/onthisday/deaths/MM/DD` works (about 90 entries). Each entry is `{text, year, pages:[{normalizedtitle, description, extract, thumbnail.source, content_urls.desktop.page}]}`. There is no cause of death, so "details" means description plus summary.

## Server

### New `lib/wikimedia.js`: `getHistoricalDeath(isoDate)`
- Fetch the `rest_v1` deaths URL for the date's MM/DD using built-in `fetch`, a descriptive `User-Agent` (Wikimedia policy) and `AbortSignal.timeout(8000)`.
- Cache the parsed list in an in-memory `Map` keyed by `MM-DD` (at most 366 keys), so each day is fetched from Wikipedia once per server run.
- Keep only entries that have `pages[0].extract`, then pick one at random. Return `{ name, year, text, description, extract, thumbnail, url }`.
- Allow `thumbnail` only if it starts with `https://upload.wikimedia.org/`, and `url` only if it starts with `https://en.wikipedia.org/`. Otherwise use `null`.
- On any failure, log it and return `null`. Wikipedia being down shouldn't break the reading.

### `lib/astrologer.js`
- `getReading(isoDate, death)` returns `{ horoscope, omen, usage }`.
- **New SYSTEM_PROMPT** (approved draft, Western only):
  > You are a gothic fortune-teller of grim omens. You are given a person's date of birth and a historical figure who died on that same calendar day. horoscope: 2-3 sentences on their Western zodiac sign, told in a dark, ominous tone. omen: 2-3 sentences of foreboding that weave their sign together with the historical death. Plain language. Never invent facts about the historical figure beyond what you are given. Keep it eerie, not graphic: no gore, no self-harm, no real threats.
- The user message keeps the long-form plus ISO date. After it comes a `<historical_death>` block with name, year, text, description and extract. If `death` is null, it says no death was found and asks for the omen to come from the sign alone.
- Keep `MODEL = 'claude-haiku-5-5'` and `effort: 'low'`. Add structured output: `output_config: { effort: 'low', format: { type: 'json_schema', schema } }`. The schema is `{horoscope: string, omen: string}`, both required, with `additionalProperties: false`. Haiku 5.5 supports this per the claude-api skill, so no zod dependency is needed.
- Keep the existing SDK error mapping and the `stop_reason === 'refusal'` check before reading content. Then `JSON.parse` the joined text blocks. A parse failure (for example from truncation) or an empty field throws the existing `UserFacingError` "Couldn't read the stars…".

### `server.js`
- Import `getHistoricalDeath` with the same dynamic import, after `.env` loads.
- Route: `const death = await getHistoricalDeath(birthday); const { horoscope, omen, usage } = await getReading(birthday, death);` then `send(res, 200, { horoscope, death, omen })`. The `[reading]` log line adds the death's name. Token usage stays out of the response.
- `TYPES`: add `.jpg` → `image/jpeg` and `.svg` → `image/svg+xml`. Without these the background image is served as `application/octet-stream` while `nosniff` is set.
- CSP: add `img-src 'self' https://upload.wikimedia.org`. `'self'` must be listed explicitly, because a specific `img-src` replaces `default-src` for images. Everything else stays as it is. Web Audio and the inline SVG need no CSP changes. The SVG must use presentation attributes (`fill=`) and no `style=""`, because `style-src 'self'` blocks inline style attributes. Setting styles from JS through `element.style` is allowed.
- `isValidBirthday`, the rate limiter and the path guard stay unchanged.

## Front end

### `public/index.html`
- The landing `<main class="card">` stays as it is. Remove the old `#result` section.
- Add hidden layers after it:
  - `#scare`: a full-screen overlay holding the inline SVG ghoul (hollow eyes, gaping jagged mouth, gaunt face).
  - `#void`: a black fade layer containing `<p id="death-message" aria-live="assertive">...you have died...</p>`.
  - `#crypt`: the background image layer, the `#darkness` candle overlay, a small `#flame` that follows the pointer, and `<section id="omen-modal" role="dialog" aria-labelledby>`. The modal has three `<article>`s: Horoscope (`#horoscope`); Historical Death (`#death-name`, `#death-year`, `#death-desc`, `#death-extract`, `<img id="death-photo">`, `<a id="death-link" target="_blank" rel="noopener">`); Dark Omen (`#omen`). It also has `#crypt-error` and a **"Rise again"** button that reloads the page.
- Extend the Google Fonts link with `IM Fell English` for the crypt body text. Google Fonts is already allowed by the CSP.

### `public/app.js`
- Keep the min/max and validation code. On submit:
  1. Start `fetch('/api/reading')` right away and don't await it yet. Create an `AudioContext` inside the handler, since the user gesture allows audio.
  2. `jumpScare()` (~1.5s): show `#scare`, add the lunge, shake and flash classes, and call `shriek(ctx)`. The shriek is a few detuned sawtooth oscillators sweeping roughly 700→1600 Hz plus band-passed white noise, with a sharp attack and decay over ~1.2s and peak gain kept moderate (~0.5).
  3. Hide the landing card. Fade `#void` to black (~1.5s), then fade in "...you have died..." one letter at a time over ~4s.
  4. Fade in `#crypt` (background plus darkness) and start the candle.
  5. `await` the fetch. Fill the modal using `textContent` only, and set `img.src`/`a.href` only from the server's validated URLs. Hide the photo/link if they're null. If `death` is null, show "The archives are silent." Fade the modal in and move focus to its heading.
  6. On fetch error, show the modal with only `#crypt-error` (the same messages as now, e.g. "Could not reach the server.") and the Rise again button.
- Write a small `wait(ms)` promise helper. CSS classes drive the transitions.
- **Candle:** `pointermove` stores x/y. A `requestAnimationFrame` loop writes `--x`, `--y` and a flickering `--r` (base radius ± small random jitter) to `#darkness` and positions `#flame`. With no pointer yet (touch devices), the light starts at the center, and touch moves it.

### `public/style.css`
- Keep the landing styles. Add gothic tokens: near-black `#07060a`, bone `#d9cdb4`, blood `#8a0f14`, ember `#ff9a3c`, tarnished gold.
- `#crypt`: the background image (`cover`, slightly desaturated and dark).
- `#darkness`: `radial-gradient(circle var(--r) at var(--x) var(--y), transparent, rgba(0,0,0,.65) 60%, rgba(0,0,0,.96))` with a faint warm ember glow at the center. `cursor: none` on the crypt, and `#flame` is a small CSS teardrop flame.
- The modal sits above the darkness so it stays readable. It's styled as dark parchment with a blood-red border, Cinzel headings and IM Fell body text. Three sections stack on phones (`max-width` with a 16px gutter and scrolling inside the modal).
- Keyframes: `lunge` (scale 0.2→1.6), `shake`, `flash` (red/black, **at most 3 flashes per second**, WCAG 2.3.1), and slow fades.
- `prefers-reduced-motion: reduce`: no shake or flashing. The ghoul fades in and holds briefly, and the candle doesn't flicker. Sound still plays.

## Docs
- **CLAUDE.md**: update Project (horror flow; Western only), Architecture (new request flow through `lib/wikimedia.js`; response `{horoscope, death, omen}`; CSP `img-src`; `.jpg`/`.svg` types) and the Claude API decisions (the system prompt is now the approved gothic draft; structured JSON output). The cusp limitation still applies.
- **README.md**: status, plus a manual test checklist for the new flow.
- **PROMPT-HISTORY.md**: the `prompt-history` skill isn't installed in this session, so add an entry by hand in the file's existing format.
- Commit the untracked `public/assets/` image together with the changes (on `feature/horrify`, only when asked).

## Deviation found during implementation

Most feed thumbnails (88 of 93 for 03/05) are served from `https://thumb.wikimedia.org/`, not `upload.wikimedia.org`. Both hosts are allowlisted in `lib/wikimedia.js` and in the CSP `img-src`.

## Verification
1. `npm start`, then `curl -s -X POST localhost:3000/api/reading -H 'content-type: application/json' -d '{"birthday":"1994-03-05"}'` returns `{horoscope, death:{name,…}, omen}`, the horoscope names Pisces and no Chinese sign, and the omen mentions the dead person. Run it twice to see a different death.
2. `-d '{"birthday":"1994-02-30"}'` still returns 400. `curl -I localhost:3000/assets/sananthropis-haunted-house-7508035_1920.jpg` shows `image/jpeg` and the new CSP.
3. Null-death path: `node -e` imports `getReading` with `death=null` and gets a valid omen.
4. Browser (via the `run` skill or by hand): the landing page looks the same; on submit the ghoul and shriek play, then the fade to black, the slow message, and the crypt with the candle following the cursor. The modal shows three sections, the photo loads and the console has no CSP violations. Rise again resets. Also check phone width, reduced-motion emulation, and a stopped server (the error path).
