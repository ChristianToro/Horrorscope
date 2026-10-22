// One birthday in, one random historical death on the same month/day out,
// from Wikipedia's "On This Day" feed.

const FEED = 'https://en.wikipedia.org/api/rest_v1/feed/onthisday/deaths';
const USER_AGENT = 'CelestialBirthdayReader/1.0 (local coursework demo)'; // Wikimedia asks for a descriptive UA

const deathsByDay = new Map(); // "MM-DD" -> usable entries; at most 366 keys

// isoDate is a validated "YYYY-MM-DD" string.
// Returns { name, year, text, description, extract, thumbnail, url }, or null if the feed fails.
export async function getHistoricalDeath(isoDate) {
  const [, mm, dd] = isoDate.split('-');
  try {
    let deaths = deathsByDay.get(`${mm}-${dd}`);
    if (!deaths) {
      const res = await fetch(`${FEED}/${mm}/${dd}`, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`Wikipedia responded ${res.status}`);
      deaths = ((await res.json()).deaths ?? []).filter((d) => d.pages?.[0]?.extract);
      if (!deaths.length) throw new Error('no deaths with a summary');
      deathsByDay.set(`${mm}-${dd}`, deaths);
    }

    const { text, year, pages: [page] } = deaths[Math.floor(Math.random() * deaths.length)];
    return {
      name: page.normalizedtitle ?? page.titles?.normalized ?? text.split(',')[0],
      year,
      text,
      description: page.description ?? null,
      extract: page.extract,
      thumbnail: allowed(page.thumbnail?.source, 'https://thumb.wikimedia.org/', 'https://upload.wikimedia.org/'),
      url: allowed(page.content_urls?.desktop?.page, 'https://en.wikipedia.org/'),
    };
  } catch (err) {
    console.error(`[wikimedia] ${mm}/${dd}: ${err.message}`);
    return null;
  }
}

// Only pass through URLs the CSP and the page expect.
function allowed(url, ...prefixes) {
  return typeof url === 'string' && prefixes.some((p) => url.startsWith(p)) ? url : null;
}
