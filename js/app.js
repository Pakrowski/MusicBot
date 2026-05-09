/* ─── Telegram WebApp ──────────────────────────────────────── */
const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); tg.setBackgroundColor('#000000'); tg.setHeaderColor('#000000'); }

const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? window.location.origin
  : null;

/* ─── DOM ──────────────────────────────────────────────────── */
const searchInput   = document.getElementById('searchInput');
const clearBtn      = document.getElementById('clearBtn');
const placeholder   = document.getElementById('placeholder');
const spinnerWrap   = document.getElementById('spinnerWrap');
const resultsList   = document.getElementById('resultsList');
const bottomPlayer  = document.getElementById('bottomPlayer');
const playerArt     = document.getElementById('playerArt');
const playerArtPh   = document.getElementById('playerArtPh');
const playerTitle   = document.getElementById('playerTitle');
const playerArtist  = document.getElementById('playerArtist');
const playerFav     = document.getElementById('playerFav');
const playerPlayBtn = document.getElementById('playerPlayBtn');
const playerIconPlay= document.getElementById('playerIconPlay');
const playerIconPause=document.getElementById('playerIconPause');
const bgGradient    = document.getElementById('bgGradient');
const audio         = document.getElementById('audio');

/* ─── State ────────────────────────────────────────────────── */
const state = {
  tracks: [],
  currentIdx: -1,
  isPlaying: false,
  favs: new Set(),
  searchTimer: null,
};

/* ─── Utils ────────────────────────────────────────────────── */
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function fmt(s) {
  if (!s) return '';
  const m = Math.floor(s/60), sec = Math.floor(s%60);
  return `${m}:${sec.toString().padStart(2,'0')}`;
}

/* ─── Search ───────────────────────────────────────────────── */
searchInput.addEventListener('input', () => {
  const q = searchInput.value.trim();
  clearBtn.style.display = q ? '' : 'none';
  clearTimeout(state.searchTimer);
  if (!q) { showPlaceholder(); return; }
  state.searchTimer = setTimeout(() => search(q), 350);
});

clearBtn.addEventListener('click', () => {
  searchInput.value = '';
  clearBtn.style.display = 'none';
  showPlaceholder();
  searchInput.focus();
});

function showPlaceholder() {
  placeholder.style.display = '';
  spinnerWrap.style.display = 'none';
  resultsList.innerHTML = '';
  state.tracks = [];
}

async function search(q) {
  placeholder.style.display = 'none';
  spinnerWrap.style.display = '';
  resultsList.innerHTML = '';

  let tracks = [];

  if (API_BASE) {
    try {
      const res = await fetch(`${API_BASE}/search/?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      tracks = data.results || [];
    } catch { tracks = mockTracks(q); }
  } else {
    tracks = mockTracks(q);
  }

  spinnerWrap.style.display = 'none';
  state.tracks = tracks;
  renderList(tracks);
}

function mockTracks(q) {
  return [
    { yt_id:'m1', title: q, artist:'Artist One', duration:210, thumbnail:'' },
    { yt_id:'m2', title: q+' (remix)', artist:'Artist Two', duration:185, thumbnail:'' },
    { yt_id:'m3', title: q+' live', artist:'Artist Three', duration:240, thumbnail:'' },
    { yt_id:'m4', title: 'Best of '+q, artist:'Various', duration:195, thumbnail:'' },
    { yt_id:'m5', title: q+' acoustic', artist:'Artist Four', duration:220, thumbnail:'' },
  ];
}

/* ─── Render list ──────────────────────────────────────────── */
function renderList(tracks) {
  if (!tracks.length) {
    resultsList.innerHTML = '<div style="text-align:center;color:rgba(255,255,255,0.4);padding:40px 16px">Ничего не найдено</div>';
    return;
  }

  resultsList.innerHTML = tracks.map((t, i) => `
    <div class="track-item${state.currentIdx===i?' active':''}" data-i="${i}">
      ${t.thumbnail
        ? `<img class="track-thumb" src="${esc(t.thumbnail)}" alt="" loading="lazy">`
        : `<div class="track-thumb-ph"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg></div>`
      }
      <div class="track-info">
        <div class="track-title">${esc(t.title)}</div>
        <div class="track-meta">${esc(t.artist)}${t.duration ? ' · '+fmt(t.duration) : ''}</div>
      </div>
      <button class="track-fav${state.favs.has(t.yt_id)?' active':''}" data-id="${esc(t.yt_id)}" data-i="${i}">
        <svg viewBox="0 0 24 24" fill="${state.favs.has(t.yt_id)?'currentColor':'none'}" stroke="currentColor" stroke-width="2">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
      </button>
    </div>
  `).join('');

  /* Клик по треку */
  resultsList.querySelectorAll('.track-item').forEach(el => {
    el.addEventListener('click', e => {
      if (e.target.closest('.track-fav')) return;
      selectTrack(parseInt(el.dataset.i));
    });
  });

  /* Клик по сердечку */
  resultsList.querySelectorAll('.track-fav').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      toggleFav(btn.dataset.id, parseInt(btn.dataset.i), btn);
      if (tg) tg.HapticFeedback.impactOccurred('light');
    });
  });
}

/* ─── Select track ─────────────────────────────────────────── */
function selectTrack(idx) {
  const track = state.tracks[idx];
  if (!track) return;
  state.currentIdx = idx;

  /* Обновляем активный элемент в списке */
  resultsList.querySelectorAll('.track-item').forEach((el, i) => {
    el.classList.toggle('active', i === idx);
  });

  /* Показываем нижний плеер */
  updateBottomPlayer(track);

  /* Haptic */
  if (tg) tg.HapticFeedback.impactOccurred('medium');

  /* Отправляем данные обратно в бот — бот скачает и пришлёт аудио */
  if (tg && !track.yt_id.startsWith('m')) {
    tg.sendData(JSON.stringify({
      yt_id:  track.yt_id,
      title:  track.title,
      artist: track.artist,
    }));
    return; // Mini App закроется
  }

  /* Локальное воспроизведение (только при наличии API) */
  if (API_BASE && !track.yt_id.startsWith('m')) {
    audio.src = `${API_BASE}/stream/audio/${track.yt_id}`;
    audio.load();
    audio.play().catch(()=>{});
    setPlaying(true);
  }
}

/* ─── Bottom player ────────────────────────────────────────── */
function updateBottomPlayer(track) {
  bottomPlayer.style.display = '';
  playerTitle.textContent  = track.title  || '';
  playerArtist.textContent = track.artist || '';
  playerFav.classList.toggle('active', state.favs.has(track.yt_id));
  playerFav.querySelector('svg').setAttribute('fill', state.favs.has(track.yt_id) ? 'currentColor' : 'none');

  if (track.thumbnail) {
    playerArt.src = track.thumbnail;
    playerArt.style.display = '';
    playerArtPh.style.display = 'none';
    /* Меняем фоновый gradient под цвет обложки */
    bgGradient.style.background = `radial-gradient(ellipse 80% 60% at 50% 0%, rgba(100,60,180,0.4) 0%, #000 70%)`;
  } else {
    playerArt.style.display = 'none';
    playerArtPh.style.display = '';
  }
}

function setPlaying(v) {
  state.isPlaying = v;
  playerIconPlay.style.display  = v ? 'none' : '';
  playerIconPause.style.display = v ? '' : 'none';
}

playerPlayBtn.addEventListener('click', () => {
  if (state.isPlaying) { audio.pause(); setPlaying(false); }
  else { audio.play().catch(()=>{}); setPlaying(true); }
  if (tg) tg.HapticFeedback.impactOccurred('light');
});

playerFav.addEventListener('click', () => {
  const track = state.tracks[state.currentIdx];
  if (!track) return;
  toggleFav(track.yt_id, state.currentIdx, null);
  if (tg) tg.HapticFeedback.impactOccurred('light');
});

/* ─── Progress bar ─────────────────────────────────────────── */
audio.addEventListener('timeupdate', () => {
  const pct = audio.duration ? (audio.currentTime / audio.duration * 100) : 0;
  bottomPlayer.style.setProperty('--progress', pct + '%');
});
audio.addEventListener('ended', () => setPlaying(false));

/* ─── Fav ──────────────────────────────────────────────────── */
function toggleFav(ytId, idx, btnEl) {
  if (state.favs.has(ytId)) state.favs.delete(ytId);
  else state.favs.add(ytId);
  const active = state.favs.has(ytId);

  /* Кнопка в списке */
  if (btnEl) {
    btnEl.classList.toggle('active', active);
    btnEl.querySelector('svg').setAttribute('fill', active ? 'currentColor' : 'none');
  }
  /* Кнопка в плеере */
  if (state.currentIdx === idx) {
    playerFav.classList.toggle('active', active);
    playerFav.querySelector('svg').setAttribute('fill', active ? 'currentColor' : 'none');
  }
  /* Перерисовываем элемент в списке */
  const el = resultsList.querySelector(`.track-fav[data-i="${idx}"]`);
  if (el && !btnEl) {
    el.classList.toggle('active', active);
    el.querySelector('svg').setAttribute('fill', active ? 'currentColor' : 'none');
  }
}

/* ─── Авто-поиск из URL (?q=...) ──────────────────────────── */
(function initFromUrl() {
  const q = new URLSearchParams(window.location.search).get('q');
  if (!q) return;
  searchInput.value = q;
  clearBtn.style.display = '';
  search(q);
})();
