/* ─── Telegram WebApp ──────────────────────────────────────── */
const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready(); tg.expand();
  tg.setBackgroundColor('#0a0010');
  tg.setHeaderColor('#0a0010');
}

const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? window.location.origin : null;

/* ─── DOM ──────────────────────────────────────────────────── */
const $ = id => document.getElementById(id);
const searchInput  = $('searchInput');
const clearBtn     = $('clearBtn');
const placeholder  = $('placeholder');
const spinnerWrap  = $('spinnerWrap');
const resultsList  = $('resultsList');
const favsList     = $('favsList');
const favsPlaceholder = $('favsPlaceholder');
const miniPlayer   = $('miniPlayer');
const miniArt      = $('miniArt');
const miniArtPh    = $('miniArtPh');
const miniTitle    = $('miniTitle');
const miniArtist   = $('miniArtist');
const miniFavBtn   = $('miniFavBtn');
const miniPlayBtn  = $('miniPlayBtn');
const iconPlay     = $('iconPlay');
const iconPause    = $('iconPause');
const miniProgress = $('miniProgress');
const profileName  = $('profileName');
const profileAvatar= $('profileAvatar');
const audio        = $('audio');

/* ─── State ────────────────────────────────────────────────── */
const state = {
  tracks: [], currentIdx: -1,
  isPlaying: false,
  favs: new Map(),   // yt_id → track
  searchTimer: null,
};

/* ─── Utils ────────────────────────────────────────────────── */
const esc  = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const fmt  = s => { if(!s) return ''; const m=Math.floor(s/60); return `${m}:${Math.floor(s%60).toString().padStart(2,'0')}`; };
const haptic = t => tg?.HapticFeedback?.impactOccurred(t);

/* ─── Profile ──────────────────────────────────────────────── */
if (tg?.initDataUnsafe?.user) {
  const u = tg.initDataUnsafe.user;
  profileName.textContent = u.first_name || u.username || 'Пользователь';
  profileAvatar.textContent = (u.first_name||'?')[0].toUpperCase();
}

/* ─── Tabs ─────────────────────────────────────────────────── */
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-page').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
    haptic('light');
    if (btn.dataset.tab === 'tabFavs') renderFavs();
  });
});

/* ─── Search ───────────────────────────────────────────────── */
searchInput.addEventListener('input', () => {
  const q = searchInput.value.trim();
  clearBtn.style.display = q ? '' : 'none';
  clearTimeout(state.searchTimer);
  if (!q) { showPlaceholder(); return; }
  state.searchTimer = setTimeout(() => search(q), 380);
});

clearBtn.addEventListener('click', () => {
  searchInput.value = ''; clearBtn.style.display = 'none';
  showPlaceholder(); searchInput.focus();
});

function showPlaceholder() {
  placeholder.style.display = ''; spinnerWrap.style.display = 'none';
  resultsList.innerHTML = ''; state.tracks = [];
}

async function search(q) {
  placeholder.style.display = 'none';
  spinnerWrap.style.display = ''; resultsList.innerHTML = '';

  let tracks = [];
  if (API_BASE) {
    try {
      const r = await fetch(`${API_BASE}/search/?q=${encodeURIComponent(q)}`);
      tracks = (await r.json()).results || [];
    } catch { tracks = mockTracks(q); }
  } else {
    await new Promise(r => setTimeout(r, 400));
    tracks = mockTracks(q);
  }

  spinnerWrap.style.display = 'none';
  state.tracks = tracks;
  renderList(tracks);
}

function mockTracks(q) {
  const artists = ['Drake','The Weeknd','Kendrick Lamar','Travis Scott','Post Malone'];
  return Array.from({length:6}, (_,i) => ({
    yt_id: `m${i}`, title: i===0 ? q : `${q} — вариант ${i+1}`,
    artist: artists[i % artists.length], duration: 180+i*15, thumbnail:'',
  }));
}

/* ─── Render list ──────────────────────────────────────────── */
function trackHTML(t, i, activeIdx) {
  const isFav = state.favs.has(t.yt_id);
  return `
  <div class="track-item${activeIdx===i?' active':''}" data-i="${i}">
    ${t.thumbnail
      ? `<img class="track-thumb" src="${esc(t.thumbnail)}" alt="" loading="lazy">`
      : `<div class="track-thumb-ph"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg></div>`}
    <div class="track-info">
      <div class="track-title">${esc(t.title)}</div>
      <div class="track-meta">${esc(t.artist)}${t.duration?' · '+fmt(t.duration):''}</div>
    </div>
    <button class="track-fav${isFav?' active':''}" data-id="${esc(t.yt_id)}" data-i="${i}">
      <svg viewBox="0 0 24 24" fill="${isFav?'currentColor':'none'}" stroke="currentColor" stroke-width="2">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
    </button>
  </div>`;
}

function bindList(container, tracks) {
  container.querySelectorAll('.track-item').forEach(el => {
    el.addEventListener('click', e => {
      if (e.target.closest('.track-fav')) return;
      selectTrack(parseInt(el.dataset.i), tracks);
    });
  });
  container.querySelectorAll('.track-fav').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      toggleFav(btn.dataset.id, parseInt(btn.dataset.i), tracks, btn);
      haptic('light');
    });
  });
}

function renderList(tracks) {
  if (!tracks.length) {
    resultsList.innerHTML = '<div style="text-align:center;color:rgba(255,255,255,0.35);padding:48px 16px;font-size:15px">Ничего не найдено</div>';
    return;
  }
  resultsList.innerHTML = tracks.map((t,i) => trackHTML(t,i,state.currentIdx)).join('');
  bindList(resultsList, tracks);
}

function renderFavs() {
  const tracks = [...state.favs.values()];
  favsPlaceholder.style.display = tracks.length ? 'none' : '';
  favsList.innerHTML = tracks.map((t,i) => trackHTML(t,i,-1)).join('');
  bindList(favsList, tracks);
}

/* ─── Select track ─────────────────────────────────────────── */
function selectTrack(idx, tracks) {
  const track = (tracks || state.tracks)[idx];
  if (!track) return;
  state.currentIdx = idx; state.tracks = tracks || state.tracks;

  resultsList.querySelectorAll('.track-item').forEach((el,i) => el.classList.toggle('active', i===idx));
  updateMiniPlayer(track);
  haptic('medium');

  /* Отправляем в бот → бот пришлёт аудио в чат */
  if (tg && !track.yt_id.startsWith('m')) {
    tg.sendData(JSON.stringify({ yt_id: track.yt_id, title: track.title, artist: track.artist }));
    return;
  }

  /* Локальное воспроизведение */
  if (API_BASE && !track.yt_id.startsWith('m')) {
    audio.src = `${API_BASE}/stream/audio/${track.yt_id}`;
    audio.load(); audio.play().catch(()=>{});
    setPlaying(true);
  }
}

/* ─── Mini player ──────────────────────────────────────────── */
function updateMiniPlayer(track) {
  miniPlayer.style.display = '';
  miniTitle.textContent  = track.title  || '';
  miniArtist.textContent = track.artist || '';

  const isFav = state.favs.has(track.yt_id);
  miniFavBtn.classList.toggle('fav-active', isFav);
  miniFavBtn.querySelector('svg').setAttribute('fill', isFav ? 'currentColor' : 'none');
  miniFavBtn.querySelector('svg').setAttribute('stroke', isFav ? 'currentColor' : 'currentColor');

  if (track.thumbnail) {
    miniArt.src = track.thumbnail; miniArt.style.display = '';
    miniArtPh.style.display = 'none';
  } else {
    miniArt.style.display = 'none'; miniArtPh.style.display = '';
  }
}

function setPlaying(v) {
  state.isPlaying = v;
  iconPlay.style.display  = v ? 'none' : '';
  iconPause.style.display = v ? '' : 'none';
}

miniPlayBtn.addEventListener('click', () => {
  if (state.isPlaying) { audio.pause(); setPlaying(false); }
  else { audio.play().catch(()=>{}); setPlaying(true); }
  haptic('light');
});

miniFavBtn.addEventListener('click', () => {
  const t = state.tracks[state.currentIdx]; if(!t) return;
  toggleFav(t.yt_id, state.currentIdx, state.tracks, null);
  haptic('light');
});

audio.addEventListener('timeupdate', () => {
  const pct = audio.duration ? audio.currentTime/audio.duration*100 : 0;
  miniProgress.style.width = pct + '%';
});
audio.addEventListener('ended', () => setPlaying(false));

/* ─── Fav ──────────────────────────────────────────────────── */
function toggleFav(ytId, idx, tracks, btnEl) {
  const track = (tracks||state.tracks)[idx];
  if (!track) return;
  const active = state.favs.has(ytId);
  if (active) state.favs.delete(ytId);
  else state.favs.set(ytId, track);
  const nowActive = !active;

  const update = el => {
    if (!el) return;
    el.classList.toggle('active', nowActive);
    el.querySelector('svg').setAttribute('fill', nowActive ? 'currentColor' : 'none');
  };
  update(btnEl);

  /* обновляем кнопку в мини-плеере если этот трек играет */
  if (state.tracks[state.currentIdx]?.yt_id === ytId) {
    miniFavBtn.classList.toggle('fav-active', nowActive);
    miniFavBtn.querySelector('svg').setAttribute('fill', nowActive ? 'currentColor' : 'none');
  }
}

/* ─── Авто-поиск из URL ────────────────────────────────────── */
(function init() {
  const q = new URLSearchParams(window.location.search).get('q');
  if (!q) return;
  searchInput.value = q; clearBtn.style.display = '';
  search(q);
})();
