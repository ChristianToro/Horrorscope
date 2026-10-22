const form = document.getElementById('birthday-form');
const input = document.getElementById('birthday');
const error = document.getElementById('error');
const landing = document.getElementById('landing');
const scare = document.getElementById('scare');
const crypt = document.getElementById('crypt');
const darkness = document.getElementById('darkness');
const message = document.getElementById('death-message');
const modal = document.getElementById('omen-modal');

const DEATH_MESSAGE = '...you have died...';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Local date, not UTC, so "today" matches the user's calendar.
const now = new Date();
input.max = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  error.hidden = true;

  const birthday = input.value;
  if (!birthday || birthday < input.min || birthday > input.max) {
    return showError('Enter a date between 1900 and today.');
  }

  // Start the reading now; the haunting below covers the wait.
  document.getElementById('submit').disabled = true;
  const reading = fetchReading(birthday);
  let audio;
  try { audio = new AudioContext(); } catch { /* no Web Audio: a silent scare */ }

  await jumpScare(audio);
  await wait(400);
  await descend();
  showOmen(await reading);
});

document.getElementById('rise').addEventListener('click', () => location.reload());

async function fetchReading(birthday) {
  try {
    const res = await fetch('/api/reading', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ birthday }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  } catch (err) {
    return { error: err instanceof TypeError ? 'Could not reach the server.' : err.message };
  }
}

async function jumpScare(audio) {
  scare.hidden = false;
  scare.classList.add('active');
  if (audio) shriek(audio);
  await wait(1500);
  scare.classList.remove('active');
  scare.hidden = true;
}

// A synthesized shriek: detuned sawtooths sweeping up, with vibrato and a hiss of noise.
function shriek(ctx) {
  ctx.resume();
  const t = ctx.currentTime;
  const end = t + 1.3;

  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, t);
  master.gain.exponentialRampToValueAtTime(0.5, t + 0.04);
  master.gain.exponentialRampToValueAtTime(0.0001, end);
  master.connect(ctx.destination);

  const vibrato = ctx.createOscillator();
  const vibratoDepth = ctx.createGain();
  vibrato.frequency.value = 18;
  vibratoDepth.gain.value = 60;
  vibrato.connect(vibratoDepth);

  for (const detune of [-30, 0, 25, 700]) {
    const osc = ctx.createOscillator();
    const voice = ctx.createGain();
    osc.type = 'sawtooth';
    osc.detune.value = detune;
    osc.frequency.setValueAtTime(700, t);
    osc.frequency.exponentialRampToValueAtTime(1600, t + 0.25);
    osc.frequency.exponentialRampToValueAtTime(900, end);
    vibratoDepth.connect(osc.frequency);
    voice.gain.value = detune === 700 ? 0.1 : 0.2;
    osc.connect(voice).connect(master);
    osc.start(t);
    osc.stop(end);
  }

  const noise = ctx.createBufferSource();
  noise.buffer = ctx.createBuffer(1, ctx.sampleRate * 1.3, ctx.sampleRate);
  const samples = noise.buffer.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
  const hiss = ctx.createBiquadFilter();
  hiss.type = 'bandpass';
  hiss.frequency.value = 2500;
  const hissGain = ctx.createGain();
  hissGain.gain.value = 0.4;
  noise.connect(hiss).connect(hissGain).connect(master);

  vibrato.start(t);
  vibrato.stop(end);
  noise.start(t);
}

// Fade to black, spell out the message, then let the crypt seep in.
async function descend() {
  crypt.hidden = false;
  crypt.getBoundingClientRect(); // commit the hidden state so the fade runs
  crypt.classList.add('black');
  await wait(2500);
  landing.hidden = true;

  const spoken = document.createElement('span');
  spoken.className = 'visually-hidden';
  spoken.textContent = DEATH_MESSAGE;
  message.append(spoken);
  [...DEATH_MESSAGE].forEach((ch, i) => {
    const letter = document.createElement('span');
    letter.className = 'ghost-letter';
    letter.setAttribute('aria-hidden', 'true');
    letter.textContent = ch;
    letter.style.animationDelay = `${i * 180}ms`;
    message.append(letter);
  });
  await wait(DEATH_MESSAGE.length * 180 + 1400);

  crypt.classList.add('revealed');
  lightCandle();
  await wait(3000);
}

function showOmen(data) {
  if (data.error) {
    document.getElementById('omen-sections').hidden = true;
    const cryptError = document.getElementById('crypt-error');
    cryptError.textContent = `The spirits are silent: ${data.error}`;
    cryptError.hidden = false;
  } else {
    document.getElementById('horoscope').textContent = data.horoscope;
    document.getElementById('omen').textContent = data.omen;
    fillDeath(data.death);
  }
  crypt.classList.add('settled');
  modal.hidden = false;
  document.getElementById('omen-title').focus({ preventScroll: true });
}

function fillDeath(death) {
  if (!death) {
    document.getElementById('death-extract').textContent = 'The archives are silent.';
    return;
  }
  document.getElementById('death-name').textContent = death.name;
  document.getElementById('death-year').textContent = `† ${death.year}`;
  document.getElementById('death-desc').textContent = death.description ?? '';
  document.getElementById('death-extract').textContent = death.extract;
  if (death.thumbnail) {
    const photo = document.getElementById('death-photo');
    photo.src = death.thumbnail;
    photo.alt = `Portrait of ${death.name}`;
    photo.hidden = false;
  }
  if (death.url) {
    const link = document.getElementById('death-link');
    link.href = death.url;
    link.hidden = false;
  }
}

// The cursor is a candle (see the crypt cursor in style.css): the darkness opens around it.
function lightCandle() {
  const follow = (e) => {
    darkness.style.setProperty('--x', `${e.clientX}px`);
    darkness.style.setProperty('--y', `${e.clientY}px`);
  };
  addEventListener('pointermove', follow);
  addEventListener('pointerdown', follow);
}

function showError(msg) {
  error.textContent = msg;
  error.hidden = false;
}
