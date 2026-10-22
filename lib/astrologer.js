// One birthday in, one 2-3 sentence reading out.

import Anthropic from '@anthropic-ai/sdk';

// Errors whose message is safe to show in the browser; the server hides all others.
export class UserFacingError extends Error {}

const MODEL = 'claude-haiku-5-5';
const SYSTEM_PROMPT = "You are a concise astrologist. Provide a 2-3 sentence response to a user's astrological information (Western and Chinese) based on their date of birth. Plain language. Never add information that is outside of the scope of the astrology.";

let client; // created on first call so importing this module needs no API key

// isoDate is a validated "YYYY-MM-DD" string. Returns { reading, usage: { input, output } }.
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
  return { reading, usage: { input: res.usage.input_tokens, output: res.usage.output_tokens } };
}
