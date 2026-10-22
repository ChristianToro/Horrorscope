# Prompt History

This document records meaningful development interactions between the user and
AI coding agents working on this project. It focuses on requests, outcomes,
implementation decisions, verification, and human-agent collaboration rather
than preserving a raw conversation transcript.

Generated code is included verbatim when reasonably concise. Extensive
implementations are referenced through their canonical repository files.

> This file is an engineering collaboration record, not a source of truth for
> application behavior. The repository itself remains authoritative.

---

## Session: 2026-10-19

**Objective:** Verify the user's Anthropic API key by building a vanilla HTML/CSS/JS birthday-to-astrology page that calls Claude.

### Interaction 1 — Initial request and planning

**User Prompt**

> I need to verify if my Anthropic API key is working properly.
>
> Here is the task: We are to make a very simple single page site in vanilla js, html, css. On the page will be form fields for a user to enter their birthday. The ai api call will then supply: zodiac sign, chinese zodiac, and other astrological information to the user. Color scheme will be celestial dark mode.
>
> system prompt: You are a concise astrologist. Provide a 2-3 sentence response to a user's astrological information (Western and Chinese) based on their date of birth. Plain language. Never add information that is outside of the scope of the astrology.

**Agent Outcome**

Ran in plan mode. `week_6/day_1` was empty and `ANTHROPIC_API_KEY` wasn't set in the shell. The user's earlier project `~/Next_Chapter/chatbot` already had a working pattern to reuse: a zero-dependency `node:http` server, `process.loadEnvFile()`, `@anthropic-ai/sdk` and static files in `public/`. The agent asked three questions and wrote a plan around the answers. The plan also included a standalone `check-key` script so the key could be tested without going through the UI.

**Collaboration**

The user made all three decisions:
- **Key source:** a new `.env` in `day_1` that the user fills in. The agent never sees or handles the key.
- **Architecture:** a tiny Node server rather than browser-only calls. With browser-only calls, the key would be visible in DevTools.
- **Model:** Claude Haiku 5.5 (`claude-haiku-5-5`), chosen over the default Opus 5.5 and over Sonnet 5.5.

### Interaction 2 — Plan saved and implemented

**User Prompt**

> write this plan as PLAN.md at the root of this project. Then, execute in manual mode

**Agent Outcome**

The user rejected the agent's plan-approval request and gave this instruction instead. The agent copied the plan to `PLAN.md` and built the app with each file write approved by the user ("manual mode"). Then it ran `npm install`.

**Rationale**

- **Model call:** effort is set to `low` explicitly, because Haiku 5.5 defaults to `medium` and the reply is only 2–3 sentences. Thinking is left at its default, since disabling it isn't the recommended route on current models.
- **Errors:** `stop_reason: "refusal"` is checked before reading content, because Haiku has no server-side fallback. SDK errors are caught by specific class and turned into friendly `UserFacingError` messages. Anything unexpected shows as `internal error`.
- **Date handling:** the server re-validates the date (must be a real calendar date, 1900 through today). The prompt sends both the long-form and ISO date so month and day can't be swapped.
- **Fonts:** the Content Security Policy copied from `chatbot` was widened to allow Google Fonts, which the Cinzel heading font needs.
- **Rendering:** the reading is shown with `textContent`, so HTML from the model can't run in the page.

**Generated Code**

`lib/astrologer.js`

```javascript
// One birthday in, one 2-3 sentence reading out.

import Anthropic from '@anthropic-ai/sdk';

// Errors whose message is safe to show in the browser; the server hides all others.
export class UserFacingError extends Error {}

const MODEL = 'claude-haiku-5-5';
const SYSTEM_PROMPT = "You are a concise astrologist. Provide a 2-3 sentence response to a user's astrological information (Western and Chinese) based on their date of birth. Plain language. Never add information that is outside of the scope of the astrology.";

let client; // created on first call so importing this module needs no API key

// isoDate is a validated "YYYY-MM-DD" string.
export async function getReading(isoDate) {
  client ??= new Anthropic(); // reads ANTHROPIC_API_KEY
  const longDate = new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
  });

  let res;
  try {
    res = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      output_config: { effort: 'low' },
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `My date of birth is ${longDate} (${isoDate}).` }],
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) throw new UserFacingError('The server API key is invalid.');
    if (err instanceof Anthropic.RateLimitError) throw new UserFacingError('Too many readings right now, try again in a minute.');
    if (err instanceof Anthropic.APIConnectionError) throw new UserFacingError('Could not reach the stars (network error).');
    throw err;
  }

  if (res.stop_reason === 'refusal') throw new UserFacingError("Couldn't read the stars for that date, try another.");
  const reading = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
  if (!reading) throw new UserFacingError("Couldn't read the stars for that date, try another.");
  return reading;
}
```

**Changes**

- [`PLAN.md`](PLAN.md): the approved plan.
- [`package.json`](package.json): ESM, `@anthropic-ai/sdk ^0.128.0`, scripts `start` and `check-key`.
- [`.env.example`](.env.example), [`.gitignore`](.gitignore): key template; `.env` and `node_modules/` are ignored.
- [`check-key.js`](check-key.js): one tiny Haiku request. Prints ✅ with token usage, or the cause of a failure (401/403/429/network). Never prints the key.
- [`lib/astrologer.js`](lib/astrologer.js): the Claude call (above).
- [`server.js`](server.js): serves `public/` and handles `POST /api/reading`. Binds 127.0.0.1, rate-limits to 10 requests per minute per IP, blocks path traversal and sends security headers. Key symbols: `isValidBirthday()`, `rateLimited()`.
- [`public/index.html`](public/index.html), [`public/style.css`](public/style.css), [`public/app.js`](public/app.js): date form, celestial dark theme (navy/indigo gradient, gold and violet accents, CSS starfield whose twinkle stops under `prefers-reduced-motion`, Cinzel headings) and the code that sends the request and shows the reading.

**Verification**

- `npm install` added 7 packages with 0 vulnerabilities. The agent confirmed the SDK exports all five error classes used.
- `npm run check-key` correctly reported that `ANTHROPIC_API_KEY` wasn't set (no `.env` existed yet).
- The agent started the server with a fake key and used curl to test it:
  - `"nope"`, `2999-01-01`, `1899-12-31` and `2023-02-30` all returned 400.
  - A valid date returned `"The server API key is invalid."`, so the authentication error path works end to end.
  - `/` and `/style.css` returned 200, and `/../server.js` returned 403.
- No real API call was made at this stage.

### Interaction 3 — README

**User Prompt**

> write a README.md file for this project in its current state

**Agent Outcome**

Wrote `README.md`. It covers:
- project status, honestly noting that the key hadn't been verified yet
- setup commands and a table of `.env` settings
- what each `check-key` message means
- a request-flow diagram and the exact system prompt
- the `/api/reading` contract
- the file tree and design notes
- a manual test checklist

Before writing, the agent checked that no `.env` with a key existed yet, so the status section would be accurate.

**Changes**

- [`README.md`](README.md): created.

### Interaction 4 — Live reading confirms the key and the lunar-year edge case

**User Prompt**

> Here is the output from the manual check of 1-20-1990:
>
> You are a Western Aquarius, born under the air sign ruled by Uranus, which suggests independence, originality, and a strong interest in ideas. Under the Chinese zodiac, your birth falls before the Lunar New Year on January 27, 1990, so you are a Snake (Earth Snake), a sign associated with wisdom, intuition, and a thoughtful, private nature.

**Agent Outcome**

The live reading confirmed that the API key works end to end. The agent checked the reading:
- **Chinese zodiac:** correct. Lunar New Year 1990 was January 27, so January 20 belongs to 1989, the Earth Snake year.
- **Western sign:** Aquarius is reasonable, but January 20, 1990 is a cusp date. The Sun entered Aquarius at about 08:00 UTC that day, so an earlier birth time would make the person a Capricorn. The app collects no birth time, so the model can't resolve this.
- **Format:** two sentences in plain language that stay on astrology, which matches the system prompt.

The agent updated `README.md`: both pending status lines are now ✅ and the 1990-01-20 checklist item is ticked.

**Changes**

- [`README.md`](README.md): Status section and manual test checklist updated.

**Verification**

This was a manual browser test run by the user. The agent didn't observe `npm run check-key` being run. The 1994-03-05 (Pisces / Wood Dog) check is still open. The agent offered an optional birth-time field for cusp dates; the user hasn't decided.

### Interaction 5 — CLAUDE.md via /init

**User Prompt**

> /init

**Agent Outcome**

Created `CLAUDE.md`. It covers:
- the commands (`npm start`, `npm run check-key`, a curl smoke test) and the `.env` settings
- the request flow and how it spans `public/app.js`, `server.js`, `lib/astrologer.js` and `check-key.js`
- that dates are validated twice, how errors become `UserFacingError`, and that the CSP allows Google Fonts
- the user's Claude API choices: Haiku 5.5, low effort and the verbatim system prompt
- the cusp-date limitation

It also adds the `prompt-history` opt-in line, so later sessions keep this log without being asked.

**Rationale**

The CLAUDE.md marks the model, effort and system prompt as user decisions, so future sessions don't "upgrade" them on their own. It doesn't list files, since they're easy to discover.

**Changes**

- [`CLAUDE.md`](CLAUDE.md): created.

**Collaboration**

The user ran `/init` right after the agent pointed out that this project had no `prompt-history` opt-in. The opt-in line follows the wording in the user's `chatbot` project.

**Verification**

None; this was documentation only.

---

## Session: 2026-10-20

**Objective:** Show how many tokens each reading spends.

### Interaction 6 — Token usage in the server log

**User Prompt**

> Display the token usage from an AI API call for this application

**Agent Outcome**

Ran in plan mode. The agent asked where the numbers should appear: on the page, in the server log, or both. Then it made the change.
- `getReading()` now returns `{ reading, usage: { input, output } }` instead of a bare string. The model, effort and system prompt are unchanged.
- `server.js` adds the counts to its existing log line, `[reading] <date> — N in / N out tokens`, using the same wording as `check-key.js`. The HTTP response is still `{ reading }`, so `public/app.js` and the CSP didn't change.

**Rationale**

- Only input and output tokens are logged. Nothing is cached, because the system prompt is far below the cache minimum, so the cache fields would always be 0.
- `output_tokens` already includes any thinking tokens, so it is the full billed output.

**Collaboration**

The user chose **server log only** over showing the counts on the page.

**Changes**

- [`lib/astrologer.js`](lib/astrologer.js): `getReading()` returns `{ reading, usage }`.
- [`server.js`](server.js): destructures the result and logs the token counts.
- [`CLAUDE.md`](CLAUDE.md), [`README.md`](README.md): document the return shape and the log line, and add a checklist item.

**Verification**

- `node --check` passes on both files.
- With the server running, `1994-02-30` still returns 400 and writes no `[reading]` line.
- The success path wasn't run, because it spends API credit. The user's next live reading will confirm the log line.

---

## Session: 2026-10-22

**Objective:** Turn the astrology reader into a gothic-horror prank, with the landing page kept as a decoy.

### Interaction 7 — Planning the horror redesign

**User Prompt**

> We are going to change the nature of the application and horrify the experience for users.
>
> The landing page will remain the way it is, and act as a decoy. Users will select their birthday. Once submitted, a frightening jump scare should occur, then the page will fade to black, and slowly display the message "...you have died..." with the picture in `/assets/sananthropis-haunted-house-7508035_1920.jpg` will serve as the background for the page.
>
> Gothic horror will be the theme: dark colors. The page should have a dark tint, and the user's cursor will act as a candle/light source to illuminate the page based on cursor location.
>
> The resulting modal will have three sections: horoscope, historical death and details, and a dark omen. Leverage the wikimedia's API On This Day to retrieve a historical death and its details. The horoscope should take on a darker tone. The dark omen should incorporate the user's horoscope and the historical death.

**Agent Outcome**

Ran in plan mode. The agent probed both Wikimedia endpoints, chose `en.wikipedia.org/api/rest_v1/feed/onthisday/deaths/MM/DD`, and confirmed its response shape. Each entry has `text`, `year` and `pages[0]` with a description, extract, thumbnail and URL. The feed has no cause of death. The agent also noticed that the image sat in untracked `public/assets/`, and that `server.js` would serve `.jpg` as `application/octet-stream`.

**Collaboration**

CLAUDE.md marks the system prompt as the user's verbatim wording, so the agent asked before replacing it. The user's decisions:
- **System prompt:** use the agent's gothic draft, but with the Chinese zodiac removed (Western only).
- **Historical death:** random each time, instead of the death closest to the birth year.
- **Jump scare:** a drawn SVG ghoul plus a shriek synthesized with Web Audio, so no asset files.
- **Death media:** show the Wikipedia portrait and a link (needs a CSP `img-src` change).

### Interaction 8 — Plan saved and implemented

**User Prompt**

> write this plan as PLAN-HORROR.md at the repo root, then execute in manual mode

**Agent Outcome**

The user rejected the plan-approval request and gave this instruction instead, as in Interaction 2. The agent copied the plan to `PLAN-HORROR.md` and built it with each step approved by the user.

**Rationale**

- **One Claude call:** structured output (`output_config.format` with a `json_schema` of `{horoscope, omen}`) returns both texts in one request, at the same model and the same `effort: "low"`. Refusal is still checked before parsing, and a parse failure becomes the existing `UserFacingError`.
- **Wikipedia on the server:** browsers can't set a `User-Agent`, the CSP stays tight, and the death has to reach Claude anyway. A failed lookup returns `null`, so the reading still works.
- **The haunting covers latency:** the fetch starts on submit, and the ~12-second sequence usually finishes after the reading has arrived.
- **CSP constraints:** `style-src 'self'` blocks `style=""` attributes, so the SVG uses presentation attributes and JS sets styles only through `element.style`.
- **Safety:** red flashes are capped under 3 per second (WCAG 2.3.1), `prefers-reduced-motion` removes the shake, flashing and flicker, and the shriek's peak gain is moderate.

**Changes**

- [`PLAN-HORROR.md`](PLAN-HORROR.md): the approved plan, plus a note on the thumbnail-host deviation.
- [`lib/wikimedia.js`](lib/wikimedia.js): new. `getHistoricalDeath(isoDate)` fetches, caches per day, picks at random and allowlists URLs by host.
- [`lib/astrologer.js`](lib/astrologer.js): the new system prompt, `getReading(isoDate, death)` returning `{horoscope, omen, usage}`, and the JSON schema.
- [`server.js`](server.js): calls the death lookup, returns `{horoscope, death, omen}`, adds the death to the log line, adds `.jpg`/`.svg` to the MIME types, and adds CSP `img-src 'self' https://thumb.wikimedia.org https://upload.wikimedia.org`.
- [`public/index.html`](public/index.html), [`public/style.css`](public/style.css), [`public/app.js`](public/app.js): the decoy is unchanged. Added: the ghoul SVG, the crypt layers, the candle, the three-section modal, "Rise again", and the scare/shriek/descend/candle code.
- [`CLAUDE.md`](CLAUDE.md), [`README.md`](README.md): the new flow, the prompt decision, the CSP and the checklist.

**Verification**

- `node --check` passes on all JS files.
- The Wikipedia module returned different random deaths for 1994-03-05 and `null` for an impossible date.
- The server returned `image/jpeg` for the background, sent the new CSP, and still returned 400 for `1994-02-30`, `2999-01-01` and `nope`.
- Three live readings (Haiku, about 550–610 input and 220–230 output tokens each) returned Pisces-only horoscopes. Each omen wove in the dead figure (Ranuccio I Farnese, Richard Kiley, Geoff Edwards).
- Headless Chrome was driven over the DevTools protocol at 1280×800 and 390×844. That caught two bugs, both fixed:
  - spaces in "...you have died..." collapsed inside the inline-block letter spans (fixed with `white-space: pre`)
  - portraits never showed, because 88 of 93 thumbnails come from `thumb.wikimedia.org`, which wasn't allowlisted
- After the fixes, the portrait loaded with no CSP violations, and phone width had no horizontal scroll. The only 404 was the existing missing `favicon.ico`.
- Not verified: the shriek actually playing (headless has no audio and the test submit had no real user gesture), reduced-motion mode, the stopped-server error path, and "Rise again".

### Interaction 9 — Commit, swap the scare image, steady the candle cursor

**User Prompt**

> the skriek played. I want to use a different asset instead of the ghoul: use the `scary-anime...` asset instead, change nothing else.
>
> The candle-cursor bounces too much: it should be still and more indicative to help a user figure out where they can click. It currently is unclear of where the cursor is.
>
> commit the previous changes, and then commit each adjustment separately

**Agent Outcome**

The user confirmed that the shriek plays in a real browser.

1. **Commit of the previous work:** `96d2d99` contains the Interaction 8 redesign and the haunted-house image. The new `.webp` was left out so it could ship with its own change.
2. **Scare image:** the inline SVG ghoul is replaced by `<img class="ghoul" src="assets/scary-anime-white-creepy-face-77575efixwlhmwp1.webp" alt="">`. The `ghoul` class is kept, so the existing size, lunge, shake, flash and reduced-motion CSS all apply unchanged.

**Rationale**

The only change outside the markup is `'.webp': 'image/webp'` in `server.js#TYPES`. Without it the image is served as `application/octet-stream` while `nosniff` is on. The image is a portrait close-up on near-black, so at the existing `min(80vw, 70vh)` width and 1.5× scale the face fills a 1280×800 screen without retuning.

**Changes**

- [`public/index.html`](public/index.html): the SVG is replaced by the image.
- [`server.js`](server.js): `.webp` MIME type added.
- `public/assets/scary-anime-white-creepy-face-77575efixwlhmwp1.webp`: added (supplied by the user).
- [`CLAUDE.md`](CLAUDE.md), [`README.md`](README.md): SVG mentions replaced, and the shriek is checked off.

**Verification**

Staged in headless Chrome by un-hiding `#scare` from JS, with no form submit and no API call. The image was served `200 image/webp` and loaded at 506px wide. The full-scale screenshot shows the face filling the screen over the black backdrop.

**Agent Outcome (continued): steady, readable candle cursor**

3. **Candle cursor:** three things caused the "bounce":
   - a random per-frame jitter on the light radius
   - a `scale` animation on the drawn flame
   - the real pointer being hidden (`cursor: none`) while a JS-positioned flame sat about 24px above the actual click point, a frame behind

   All three are removed: the `#flame` element, its CSS and keyframes, the `requestAnimationFrame` loop and the `stillMotion` check. `lightCandle()` now just writes `--x/--y` on `pointermove`/`pointerdown`, and `--r` stays at 220px. The pointer is a real CSS cursor: `assets/candle-cursor.svg` everywhere in the crypt, and `assets/candle-cursor-lit.svg` (brighter flame plus a halo ring) over `a` and `button`, both with the hotspot at the flame tip (`16 1`) and falling back to `auto`/`pointer`.

**Rationale**

The OS draws native cursors, so they track the pointer without lag and can't bounce. A distinct hover cursor answers "where can I click" directly. The SVG cursors are same-origin files rather than `data:` URIs, so the existing `img-src 'self'` CSP covers them, and `.svg` was already in `TYPES`.

**Changes**

- [`public/assets/candle-cursor.svg`](public/assets/candle-cursor.svg), [`public/assets/candle-cursor-lit.svg`](public/assets/candle-cursor-lit.svg): new 32×32 cursors with a dark outline so they show on both light and dark areas.
- [`public/index.html`](public/index.html): `#flame` removed.
- [`public/app.js`](public/app.js): `lightCandle()` simplified; the `flame` and `stillMotion` constants removed.
- [`public/style.css`](public/style.css): crypt `cursor: url(...)` rules added; the `.flame` styles, `flame-dance` keyframes and `cursor: none` removed.
- [`CLAUDE.md`](CLAUDE.md), [`README.md`](README.md): candle behavior updated, with a note not to go back to a drawn flame.

**Verification**

- Staged the crypt in headless Chrome with stub data (no API call). Six `--r` samples over 0.7s were all `220px`. Screenshots show the light hole centered on the moved pointer.
- The computed `cursor` is `url(candle-cursor.svg) 16 1, auto` on text and `url(candle-cursor-lit.svg) 16 1, pointer` on the Rise again button. Both SVGs are served `200 image/svg+xml` and decode at 32×32.
- Rendered both icons at 6× on black and on bone: both are legible.
- Not verified: how the OS-drawn cursor looks in a real browser, since headless screenshots don't include the cursor.

**Collaboration**

The user confirmed that the shriek plays and supplied the replacement scare image, with the instruction to "change nothing else". They also asked for the commits to be split: the previous work first, then one commit per adjustment.
