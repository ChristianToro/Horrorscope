// One birthday and one historical death in, a dark horoscope and an omen out.

import Anthropic from '@anthropic-ai/sdk';

// Errors whose message is safe to show in the browser; the server hides all others.
export class UserFacingError extends Error {}

const MODEL = 'claude-haiku-5-5';
const SYSTEM_PROMPT = "You are a gothic fortune-teller of grim omens. You are given a person's date of birth and a historical figure who died on that same calendar day. horoscope: 2-3 sentences on their Western zodiac sign, told in a dark, ominous tone. omen: 2-3 sentences of foreboding that weave their sign together with the historical death. Plain language. Never invent facts about the historical figure beyond what you are given. Keep it eerie, not graphic: no gore, no self-harm, no real threats.";

const SCHEMA = {
  type: 'object',
  properties: { horoscope: { type: 'string' }, omen: { type: 'string' } },
  required: ['horoscope', 'omen'],
  additionalProperties: false,
};

let client; // created on first call so importing this module needs no API key

// isoDate is a validated "YYYY-MM-DD" string; death is from getHistoricalDeath() or null.
// Returns { horoscope, omen, usage: { input, output } }.
export async function getReading(isoDate, death) {
  client ??= new Anthropic(); // reads ANTHROPIC_API_KEY
  const longDate = new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
  });
  const deathBlock = death
    ? `<historical_death>\nName: ${death.name}\nDied: ${death.year}\nSummary line: ${death.text}\nDescription: ${death.description ?? 'unknown'}\nBiography: ${death.extract}\n</historical_death>`
    : 'No historical death was found for this day. Draw the omen from the sign alone.';

  let res;
  try {
    res = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `My date of birth is ${longDate} (${isoDate}).\n\n${deathBlock}` }],
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) throw new UserFacingError('The server API key is invalid.');
    if (err instanceof Anthropic.RateLimitError) throw new UserFacingError('Too many readings right now, try again in a minute.');
    if (err instanceof Anthropic.APIConnectionError) throw new UserFacingError('Could not reach the stars (network error).');
    throw err;
  }

  if (res.stop_reason === 'refusal') throw new UserFacingError("Couldn't read the stars for that date, try another.");
  let parsed;
  try {
    parsed = JSON.parse(res.content.filter((b) => b.type === 'text').map((b) => b.text).join(''));
  } catch { /* truncated or empty output: handled below */ }
  const horoscope = parsed?.horoscope?.trim();
  const omen = parsed?.omen?.trim();
  if (!horoscope || !omen) throw new UserFacingError("Couldn't read the stars for that date, try another.");
  return { horoscope, omen, usage: { input: res.usage.input_tokens, output: res.usage.output_tokens } };
}
