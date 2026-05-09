/* ─── Telegram WebApp Init ─────────────────────────────────── */
const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
  tg.setHeaderColor('#000000');
  tg.setBackgroundColor('#000000');
}

// Когда появится сервер — вставь его URL сюда:
// const API_BASE = 'https://your-server.com';
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? window.location.origin
  : null; // GitHub Pages — API пока недоступен, работаем с мок-данными

/* ─── State ────────────────────────────────────────────────── */
const state = {
  queue: [],
  currentIndex: -1,
  isPlaying: false,
  isShuffle: false,
  isRepeat: false,
  isFav: false,
  searchTimeout: null,
};

/* ─── DOM ──────────────────────────────────────────────────── */
const audio       = document.getElementById('audioPlayer');
const bgBlur      = document.getElementById('bgBlur');
const artwork     = document.getElementById('artwork');
const artworkImg  = document.getElementById('artworkImg');
const trackTitle  = document.getElementById('trackTitle');
const trackArtist = document.getElementById('trackArtist');
const btnPlay     = document.getElementById('btnPlay');
const iconPlay    = document.getElementById('iconPlay');
const iconPause   = document.getElementById('iconPause');
const btnPrev     = document.getElementById('btnPrev');
const btnNext     = document.getElementById('btnNext');
const btnShuffle  = document.getElementById('btnShuffle');
const btnRepeat   = document.getElementById('btnRepeat');
const btnFav      = document.getElementById('btnFav');
const btnSearch   = document.getElementById('btnSearch');
const btnBack     = document.getElementById('btnBack');
const searchPanel = document.getElementById('searchPanel');
const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');
const progressBar = document.getElementById('progressBar');
const progressFill= document.getElementById('progressFill');
const progressThumb=document.getElementById('progressThumb');
const timeElapsed = document.getElementById('timeElapsed');
const timeDuration= document.getElementById('timeDuration');
const volumeSlider= document.getElementById('volumeSlider');
const queueList   = document.getElementById('queueList');
const trackInfo   = document.querySelector('.track-info');

/* Rebuild track-info to show title+artist stacked */
trackInfo.innerHTML = `
  <div class="track-meta">
    <div class="track-title" id="trackTitle">Выбери трек</div>
    <div class="track-artist" id="trackArtist">—</div>
  </div>
  <button class="fav-btn" id="btnFav">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  </button>`;

const $title  = document.getElementById('trackTitle');
const $artist = document.getElementById('trackArtist');
const $fav    = document.getElementById('btnFav');
$fav.addEventListener('click', toggleFav);

/* ─── Helpers ──────────────────────────────────────────────── */
function fmt(sec) {
  if (!sec || isNaN(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function setAccentFromImage(img) {
  /* Simple: rely on CSS gradient animation; could use Canvas for real color extraction */
}

/* ─── Player Logic ─────────────────────────────────────────── */
async function loadTrack(index) {
  const track = state.queue[index];
  if (!track) return;
  state.currentIndex = index;

  $title.textContent  = track.title  || 'Загрузка...';
  $artist.textContent = track.artist || '';

  if (track.thumbnail) {
    artworkImg.src = '';
    artworkImg.classList.remove('loaded');
    artworkImg.onload = () => artworkImg.classList.add('loaded');
    artworkImg.src = track.thumbnail;
  } else {
    artworkImg.classList.remove('loaded');
  }

  if (API_BASE && track.yt_id && !track.yt_id.startsWith('mock')) {
    audio.src = `${API_BASE}/stream/audio/${track.yt_id}`;
    audio.load();
    setPlaying(true);
  } else {
    // Без сервера — просто показываем UI без воспроизведения
    setPlaying(false);
    $title.textContent = track.title;
  }

  renderQueue();
}

function setPlaying(playing) {
  state.isPlaying = playing;
  if (playing) {
    audio.play().catch(() => {});
    iconPlay.style.display  = 'none';
    iconPause.style.display = '';
    artwork.classList.add('playing');
  } else {
    audio.pause();
    iconPlay.style.display  = '';
    iconPause.style.display = 'none';
    artwork.classList.remove('playing');
  }
}

function playNext() {
  if (!state.queue.length) return;
  let next = state.currentIndex + 1;
  if (state.isShuffle) next = Math.floor(Math.random() * state.queue.length);
  if (next >= state.queue.length) next = state.isRepeat ? 0 : -1;
  if (next >= 0) loadTrack(next);
  else setPlaying(false);
}

function playPrev() {
  if (audio.currentTime > 3) { audio.currentTime = 0; return; }
  let prev = state.currentIndex - 1;
  if (prev < 0) prev = state.queue.length - 1;
  loadTrack(prev);
}

function toggleFav() {
  state.isFav = !state.isFav;
  $fav.classList.toggle('active', state.isFav);
  if (tg) tg.HapticFeedback.impactOccurred('light');
}

/* ─── Progress ─────────────────────────────────────────────── */
audio.addEventListener('timeupdate', () => {
  const pct = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
  progressFill.style.width = pct + '%';
  progressThumb.style.setProperty('--pct', pct + '%');
  timeElapsed.textContent  = fmt(audio.currentTime);
  timeDuration.textContent = fmt(audio.duration);
});

audio.addEventListener('ended', playNext);
audio.addEventListener('error', () => {
  $title.textContent = 'Ошибка загрузки';
  setPlaying(false);
});

let dragging = false;
progressBar.addEventListener('mousedown',  startDrag);
progressBar.addEventListener('touchstart', startDrag, { passive: true });

function startDrag(e) {
  dragging = true;
  seekTo(e);
  document.addEventListener('mousemove', onDrag);
  document.addEventListener('touchmove', onDrag, { passive: true });
  document.addEventListener('mouseup',  endDrag);
  document.addEventListener('touchend', endDrag);
}
function onDrag(e)  { if (dragging) seekTo(e); }
function endDrag()  { dragging = false; document.removeEventListener('mousemove', onDrag); document.removeEventListener('mouseup', endDrag); }

function seekTo(e) {
  const rect = progressBar.getBoundingClientRect();
  const x    = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
  const pct  = Math.max(0, Math.min(1, x / rect.width));
  if (audio.duration) audio.currentTime = pct * audio.duration;
}

/* ─── Volume ───────────────────────────────────────────────── */
audio.volume = parseFloat(volumeSlider.value);
volumeSlider.addEventListener('input', () => { audio.volume = volumeSlider.value; });

/* ─── Controls ─────────────────────────────────────────────── */
btnPlay.addEventListener('click', () => {
  if (state.currentIndex < 0 && state.queue.length) { loadTrack(0); return; }
  setPlaying(!state.isPlaying);
  if (tg) tg.HapticFeedback.impactOccurred('medium');
});

btnPrev.addEventListener('click', () => { playPrev(); if (tg) tg.HapticFeedback.impactOccurred('light'); });
btnNext.addEventListener('click', () => { playNext(); if (tg) tg.HapticFeedback.impactOccurred('light'); });

btnShuffle.addEventListener('click', () => {
  state.isShuffle = !state.isShuffle;
  btnShuffle.classList.toggle('active', state.isShuffle);
});

btnRepeat.addEventListener('click', () => {
  state.isRepeat = !state.isRepeat;
  btnRepeat.classList.toggle('active', state.isRepeat);
});

/* ─── Search ───────────────────────────────────────────────── */
btnSearch.addEventListener('click', () => {
  const visible = searchPanel.style.display !== 'none';
  searchPanel.style.display = visible ? 'none' : 'flex';
  if (!visible) setTimeout(() => searchInput.focus(), 50);
});

btnBack.addEventListener('click', () => {
  if (searchPanel.style.display !== 'none') {
    searchPanel.style.display = 'none';
  } else if (tg) {
    tg.close();
  }
});

searchInput.addEventListener('input', () => {
  clearTimeout(state.searchTimeout);
  const q = searchInput.value.trim();
  if (!q) { searchResults.innerHTML = ''; return; }
  state.searchTimeout = setTimeout(() => doSearch(q), 400);
});

async function doSearch(query) {
  searchResults.innerHTML = '<div class="spinner"></div>';

  if (!API_BASE) {
    // Мок-данные для теста дизайна без сервера
    const mock = [
      { yt_id: 'mock1', title: 'Blinding Lights', artist: 'The Weeknd', duration: 200, thumbnail: '' },
      { yt_id: 'mock2', title: 'Starboy', artist: 'The Weeknd', duration: 230, thumbnail: '' },
      { yt_id: 'mock3', title: 'Save Your Tears', artist: 'The Weeknd', duration: 215, thumbnail: '' },
      { yt_id: 'mock4', title: query + ' — результат 1', artist: 'Artist One', duration: 180, thumbnail: '' },
      { yt_id: 'mock5', title: query + ' — результат 2', artist: 'Artist Two', duration: 195, thumbnail: '' },
    ];
    setTimeout(() => renderSearchResults(mock), 300);
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/search/?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    renderSearchResults(data.results || []);
  } catch {
    searchResults.innerHTML = '<div style="color:rgba(255,255,255,0.4);text-align:center;padding:12px">Ошибка поиска</div>';
  }
}

function renderSearchResults(tracks) {
  if (!tracks.length) {
    searchResults.innerHTML = '<div style="color:rgba(255,255,255,0.4);text-align:center;padding:12px">Ничего не найдено</div>';
    return;
  }
  searchResults.innerHTML = tracks.map((t, i) => `
    <div class="result-item" data-index="${i}">
      ${t.thumbnail
        ? `<img class="result-thumb" src="${t.thumbnail}" alt="" loading="lazy">`
        : `<div class="result-thumb-placeholder"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg></div>`
      }
      <div class="result-info">
        <div class="result-title">${esc(t.title)}</div>
        <div class="result-artist">${esc(t.artist)}</div>
      </div>
      <div class="result-dur">${fmt(t.duration)}</div>
    </div>
  `).join('');

  searchResults.querySelectorAll('.result-item').forEach((el, i) => {
    el.addEventListener('click', () => {
      state.queue = tracks;
      loadTrack(i);
      searchPanel.style.display = 'none';
      if (tg) tg.HapticFeedback.impactOccurred('light');
    });
  });
}

/* ─── Queue Render ─────────────────────────────────────────── */
function renderQueue() {
  const upcoming = state.queue
    .map((t, i) => ({ t, i }))
    .filter(({ i }) => i !== state.currentIndex)
    .slice(0, 10);

  if (!upcoming.length) { queueList.innerHTML = ''; return; }

  queueList.innerHTML = upcoming.map(({ t, i }) => `
    <div class="queue-item" data-index="${i}">
      ${t.thumbnail
        ? `<img class="queue-thumb" src="${t.thumbnail}" alt="" loading="lazy">`
        : `<div class="queue-thumb-ph"></div>`
      }
      <div class="queue-info">
        <div class="queue-title-text">${esc(t.title)}</div>
        <div class="queue-artist-text">${esc(t.artist)}</div>
      </div>
      <div class="queue-dur">${fmt(t.duration)}</div>
    </div>
  `).join('');

  queueList.querySelectorAll('.queue-item').forEach(el => {
    el.addEventListener('click', () => {
      loadTrack(parseInt(el.dataset.index));
      if (tg) tg.HapticFeedback.impactOccurred('light');
    });
  });
}

function esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ─── Init from URL param ──────────────────────────────────── */
(async () => {
  const params  = new URLSearchParams(window.location.search);
  const trackId = params.get('track');
  if (!trackId) return;

  try {
    const res  = await fetch(`${API_BASE}/stream/info/${trackId}`);
    const info = await res.json();
    state.queue = [info];
    loadTrack(0);
  } catch {
    $title.textContent = 'Ошибка загрузки трека';
  }
})();
