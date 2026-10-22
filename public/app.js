const form = document.getElementById('birthday-form');
const input = document.getElementById('birthday');
const button = document.getElementById('submit');
const result = document.getElementById('result');
const reading = document.getElementById('reading');
const error = document.getElementById('error');

// Local date, not UTC, so "today" matches the user's calendar.
const now = new Date();
input.max = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  error.hidden = true;
  result.hidden = true;

  const birthday = input.value;
  if (!birthday || birthday < input.min || birthday > input.max) {
    return showError('Enter a date between 1900 and today.');
  }

  button.disabled = true;
  button.textContent = 'Reading the stars…';
  try {
    const res = await fetch('/api/reading', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ birthday }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    reading.textContent = data.reading;
    result.hidden = false;
  } catch (err) {
    showError(err instanceof TypeError ? 'Could not reach the server.' : err.message);
  } finally {
    button.disabled = false;
    button.textContent = 'Read the stars';
  }
});

function showError(msg) {
  error.textContent = msg;
  error.hidden = false;
}
