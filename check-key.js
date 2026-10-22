// Verifies ANTHROPIC_API_KEY with one tiny request. Never prints the key.
// Run: npm run check-key

import Anthropic from '@anthropic-ai/sdk';

try { process.loadEnvFile(); } catch { /* no .env: rely on real env vars */ }

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('❌ ANTHROPIC_API_KEY is not set. Copy .env.example to .env and paste your key in.');
  process.exit(1);
}

const client = new Anthropic({ maxRetries: 0 });

try {
  const res = await client.messages.create({
    model: 'claude-haiku-5-5',
    max_tokens: 1000,
    output_config: { effort: 'low' },
    messages: [{ role: 'user', content: 'Reply with the single word: ok' }],
  });
  console.log(`✅ API key works — model ${res.model}, ${res.usage.input_tokens} in / ${res.usage.output_tokens} out tokens.`);
} catch (err) {
  if (err instanceof Anthropic.AuthenticationError) console.error('❌ 401: the API key is invalid or revoked.');
  else if (err instanceof Anthropic.PermissionDeniedError) console.error('❌ 403: the key lacks permission for this model.');
  else if (err instanceof Anthropic.RateLimitError) console.error('❌ 429: rate limited or out of credit.');
  else if (err instanceof Anthropic.APIConnectionError) console.error('❌ Could not reach the API (network problem).');
  else if (err instanceof Anthropic.APIError) console.error(`❌ ${err.status}: ${err.message}`);
  else throw err;
  process.exit(1);
}
