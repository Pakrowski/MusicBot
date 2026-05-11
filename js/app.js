const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); tg.setBackgroundColor('#000'); tg.setHeaderColor('#000'); }

const API_BASE = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
  ? location.origin : null;

const $ = id => document.getElementById(id);

/* ─── DOM refs ─────────────────────────────────────────────── */
const searchInput     = $('searchInput'),   clearBtn        = $('clearBtn');
const placeholder     = $('placeholder'),   spinnerWrap     = $('spinnerWrap');
const resultsList     = $('resultsList');
const recentSection   = $('recentSection'), recentHoriz     = $('recentHoriz');
const recentList      = $('recentList'),    homePlaceholder = $('homePlaceholder');
const favTrackList    = $('favTrackList'),  favsEmpty       = $('favsEmpty');
const favScrollWrap   = $('favScrollWrap'), favHorizList    = $('favHorizList');
const favCountEl      = $('favCount'),      playlistCountEl = $('playlistCount');
const miniPlayer      = $('miniPlayer'),    miniProgressFill= $('miniProgressFill');
const miniArt         = $('miniArt'),       miniArtPh       = $('miniArtPh');
const miniTitle       = $('miniTitle'),     miniArtist      = $('miniArtist');
const miniFavBtn      = $('miniFavBtn'),    miniPlayBtn     = $('miniPlayBtn');
const iconPlay        = $('iconPlay'),      iconPause       = $('iconPause');
const profileAva      = $('profileAva'),    profileName     = $('profileName');
const statRecent      = $('statRecent'),    statFavs        = $('statFavs');
const audio           = $('audio');
const tabBar          = $('tabBar'),        glassSlider     = $('glassSlider');
const searchIsland    = $('searchIsland');

/* ─── State ────────────────────────────────────────────────── */
const S = {
  tracks:   [],
  idx:      -1,
  playing:  false,
  favs:     new Map(),   // yt_id → track
  recent:   [],          // recently played, max 10
  playlists:[],
  timer:    null,
};

/* ─── Utils ────────────────────────────────────────────────── */
const esc = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const fmt = s => { if (!s) return ''; const m = Math.floor(s/60); return `${m}:${String(Math.floor(s%60)).padStart(2,'0')}`; };
const haptic = t => tg?.HapticFeedback?.impactOccurred(t);
const delay  = ms => new Promise(r => setTimeout(r, ms));

/* ─── Keyboard / viewport ──────────────────────────────────── */
function updateKeyboardOffset() {
  const vv = window.visualViewport;
  if (!vv) return;
  const kbH = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
  document.documentElement.style.setProperty('--keyboard-h', kbH + 'px');
}
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', updateKeyboardOffset, { passive: true });
  window.visualViewport.addEventListener('scroll', updateKeyboardOffset, { passive: true });
}

/* ─── Profile ──────────────────────────────────────────────── */
const u = tg?.initDataUnsafe?.user;
if (u) {
  profileName.textContent = u.first_name || u.username || 'Пользователь';
  profileAva.textContent  = (u.first_name || u.username || '?')[0].toUpperCase();
}

/* ─── Tabs ─────────────────────────────────────────────────── */
const tabBtns = [...document.querySelectorAll('.tab-btn')];

function switchTab(tabId, activeBtn) {
  tabBtns.forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-page').forEach(p => p.classList.remove('active'));
  searchIsland.classList.remove('active');
  $(tabId).classList.add('active');

  if (activeBtn) {
    activeBtn.classList.add('active');
  } else {
    searchIsland.classList.add('active');
    setTimeout(() => searchInput.focus(), 120);
  }

  if (tabId === 'tabCollection') renderCollection();
  if (tabId === 'tabHome')       renderHome();
  if (tabId === 'tabProfile')    renderProfile();
  haptic('light');
}

tabBtns.forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab, btn)));
searchIsland.addEventListener('click', () => switchTab('tabSearch', null));

/* ─── Swipe drag on pill ───────────────────────────────────── */
let dragOn = false, dragOver = null;

function btnAtX(x) {
  return tabBtns.find(b => { const r = b.getBoundingClientRect(); return x >= r.left && x <= r.right; }) || null;
}

tabBar.addEventListener('touchstart', () => { dragOn = true; dragOver = null; }, { passive: true });
tabBar.addEventListener('touchmove', e => {
  if (!dragOn) return;
  const over = btnAtX(e.touches[0].clientX);
  if (over && over !== dragOver) {
    dragOver = over;
    /* Live preview: temporarily mark button as active */
    tabBtns.forEach(b => b.classList.remove('active'));
    over.classList.add('active');
    haptic('light');
  }
}, { passive: true });
tabBar.addEventListener('touchend', e => {
  if (!dragOn) return; dragOn = false;
  const over = btnAtX(e.changedTouches[0].clientX) || dragOver;
  if (over) switchTab(over.dataset.tab, over);
  else {
    /* Restore active state if swipe cancelled */
    const curr = document.querySelector('.tab-page.active');
    if (curr) {
      const btn = tabBtns.find(b => b.dataset.tab === curr.id);
      if (btn) btn.classList.add('active');
    }
  }
  dragOver = null;
}, { passive: true });
tabBar.addEventListener('touchcancel', () => {
  dragOn = false; dragOver = null;
  /* Restore */
  const curr = document.querySelector('.tab-page.active');
  if (curr) { const b = tabBtns.find(b => b.dataset.tab === curr.id); if (b) b.classList.add('active'); }
}, { passive: true });

/* ─── Track item HTML ──────────────────────────────────────── */
function trackItemHTML(t, i, activeIdx) {
  const on = S.favs.has(t.yt_id);
  return `
  <div class="track-item${activeIdx === i ? ' active' : ''}" data-i="${i}">
    ${t.thumbnail
      ? `<img class="track-thumb" src="${esc(t.thumbnail)}" alt="" loading="lazy">`
      : `<div class="track-thumb-ph"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M9 19V6l12-3v13M9 19c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm12 0c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zM9 10l12-3"/></svg></div>`}
    <div class="track-meta">
      <div class="track-title">${esc(t.title)}</div>
      <div class="track-sub">${esc(t.artist)}${t.duration ? ' · ' + fmt(t.duration) : ''}</div>
    </div>
    <button class="track-fav${on ? ' on' : ''}" data-id="${esc(t.yt_id)}" data-i="${i}">
      <svg viewBox="0 0 24 24" fill="${on ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
    </button>
  </div>`;
}

function renderTracks(container, tracks, activeIdx) {
  if (!tracks.length) { container.innerHTML = ''; return; }
  container.innerHTML = tracks.map((t, i) => trackItemHTML(t, i, activeIdx)).join('');
  container.querySelectorAll('.track-item').forEach(el =>
    el.addEventListener('click', e => { if (e.target.closest('.track-fav')) return; pick(parseInt(el.dataset.i), tracks); })
  );
  container.querySelectorAll('.track-fav').forEach(btn =>
    btn.addEventListener('click', e => { e.stopPropagation(); toggleFav(btn.dataset.id, parseInt(btn.dataset.i), tracks, btn); haptic('light'); })
  );
}

function horizItemHTML(t) {
  return `
  <div class="horiz-item" data-id="${esc(t.yt_id)}">
    ${t.thumbnail
      ? `<img class="horiz-art" src="${esc(t.thumbnail)}" alt="" loading="lazy">`
      : `<div class="horiz-art-ph"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M9 19V6l12-3v13M9 19c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm12 0c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zM9 10l12-3"/></svg></div>`}
    <div class="horiz-name">${esc(t.title)}</div>
    <div class="horiz-artist">${esc(t.artist)}</div>
  </div>`;
}

/* ─── Pick / play ──────────────────────────────────────────── */
function pick(i, tracks) {
  const t = (tracks || S.tracks)[i];
  if (!t) return;
  S.idx = i; S.tracks = tracks || S.tracks;

  /* add to recent (deduplicated, max 10) */
  S.recent = [t, ...S.recent.filter(x => x.yt_id !== t.yt_id)].slice(0, 10);

  resultsList.querySelectorAll('.track-item').forEach((el, j) => el.classList.toggle('active', j === i));
  showMiniPlayer(t);
  haptic('medium');

  if (tg && !t.yt_id.startsWith('m')) {
    tg.sendData(JSON.stringify({ yt_id: t.yt_id, title: t.title, artist: t.artist }));
    return;
  }
  if (API_BASE && !t.yt_id.startsWith('m')) {
    audio.src = `${API_BASE}/stream/audio/${t.yt_id}`;
    audio.load(); audio.play().catch(() => {});
    setPlay(true);
  }
}

/* ─── Mini player ──────────────────────────────────────────── */
function showMiniPlayer(t) {
  miniPlayer.style.display = '';
  miniTitle.textContent  = t.title  || '';
  miniArtist.textContent = t.artist || '';
  const on = S.favs.has(t.yt_id);
  miniFavBtn.classList.toggle('on', on);
  miniFavBtn.querySelector('svg').setAttribute('fill', on ? 'currentColor' : 'none');
  if (t.thumbnail) { miniArt.src = t.thumbnail; miniArt.style.display = ''; miniArtPh.style.display = 'none'; }
  else             { miniArt.style.display = 'none'; miniArtPh.style.display = ''; }
}

function setPlay(v) {
  S.playing = v;
  iconPlay.style.display  = v ? 'none' : '';
  iconPause.style.display = v ? '' : 'none';
}

miniPlayBtn.addEventListener('click', () => {
  S.playing ? audio.pause() : audio.play().catch(() => {});
  setPlay(!S.playing); haptic('light');
});
miniFavBtn.addEventListener('click', () => {
  const t = S.tracks[S.idx]; if (t) { toggleFav(t.yt_id, S.idx, S.tracks, null); haptic('light'); }
});
audio.addEventListener('timeupdate', () => {
  miniProgressFill.style.width = audio.duration ? (audio.currentTime / audio.duration * 100) + '%' : '0%';
});
audio.addEventListener('ended', () => setPlay(false));

/* ─── Fav ──────────────────────────────────────────────────── */
function toggleFav(ytId, i, tracks, btnEl) {
  const t = (tracks || S.tracks)[i]; if (!t) return;
  const on = S.favs.has(ytId);
  if (on) S.favs.delete(ytId); else S.favs.set(ytId, t);
  const nowOn = !on;

  if (btnEl) { btnEl.classList.toggle('on', nowOn); btnEl.querySelector('svg').setAttribute('fill', nowOn ? 'currentColor' : 'none'); }
  if (S.tracks[S.idx]?.yt_id === ytId) {
    miniFavBtn.classList.toggle('on', nowOn);
    miniFavBtn.querySelector('svg').setAttribute('fill', nowOn ? 'currentColor' : 'none');
  }
  /* live-refresh collection if open */
  if ($('tabCollection').classList.contains('active')) renderCollection();
  /* update profile stats */
  statFavs.textContent = S.favs.size;
}

/* ─── Home ─────────────────────────────────────────────────── */
function renderHome() {
  statRecent.textContent = S.recent.length;
  if (!S.recent.length) {
    recentSection.style.display = 'none';
    homePlaceholder.style.display = '';
    return;
  }
  homePlaceholder.style.display = 'none';
  recentSection.style.display = '';
  recentHoriz.innerHTML = S.recent.slice(0, 10).map(horizItemHTML).join('');
  recentHoriz.querySelectorAll('.horiz-item').forEach(el =>
    el.addEventListener('click', () => {
      const t = S.recent.find(x => x.yt_id === el.dataset.id);
      if (t) pick(0, [t]);
    })
  );
  renderTracks(recentList, S.recent, -1);
}

/* ─── Collection ───────────────────────────────────────────── */
function renderCollection() {
  const favArr = [...S.favs.values()];
  favCountEl.textContent   = favArr.length + (favArr.length === 1 ? ' трек' : favArr.length < 5 ? ' трека' : ' треков');
  statFavs.textContent     = favArr.length;
  favsEmpty.style.display  = favArr.length ? 'none' : '';
  playlistCountEl.textContent = S.playlists.length;

  if (favArr.length) {
    favScrollWrap.style.display = '';
    favHorizList.innerHTML = favArr.slice(0, 10).map(horizItemHTML).join('');
    favHorizList.querySelectorAll('.horiz-item').forEach(el =>
      el.addEventListener('click', () => {
        const t = S.favs.get(el.dataset.id); if (t) pick(0, [t]);
      })
    );
  } else {
    favScrollWrap.style.display = 'none';
  }
  renderTracks(favTrackList, favArr, -1);
}

/* ─── Profile ──────────────────────────────────────────────── */
function renderProfile() {
  statRecent.textContent = S.recent.length;
  statFavs.textContent   = S.favs.size;
}

/* ─── Search ───────────────────────────────────────────────── */
searchInput.addEventListener('input', () => {
  const q = searchInput.value.trim();
  clearBtn.style.display = q ? '' : 'none';
  clearTimeout(S.timer);
  if (!q) { resetSearch(); return; }
  S.timer = setTimeout(() => doSearch(q), 360);
});
clearBtn.addEventListener('click', () => {
  searchInput.value = ''; clearBtn.style.display = 'none';
  resetSearch(); searchInput.focus();
});

function resetSearch() {
  placeholder.style.display = '';
  spinnerWrap.style.display = 'none';
  resultsList.innerHTML = '';
  S.tracks = [];
}

async function doSearch(q) {
  placeholder.style.display = 'none';
  spinnerWrap.style.display = '';
  resultsList.innerHTML = '';
  let tracks = [];
  if (API_BASE) {
    try { tracks = (await (await fetch(`${API_BASE}/search/?q=${encodeURIComponent(q)}`)).json()).results || []; }
    catch { tracks = mock(q); }
  } else {
    await delay(350); tracks = mock(q);
  }
  spinnerWrap.style.display = 'none';
  S.tracks = tracks;
  renderTracks(resultsList, tracks, S.idx);
}

function mock(q) {
  return ['Drake','The Weeknd','Travis Scott','Kendrick Lamar','Post Malone','21 Savage'].map((a, i) => ({
    yt_id: `m${i}`,
    title: i === 0 ? q : `${q} (${['remix','live','acoustic','extended','radio edit','original'][i]})`,
    artist: a, duration: 175 + i * 18, thumbnail: '',
  }));
}

/* ─── Playlists ────────────────────────────────────────────── */
$('addPlaylistItem').addEventListener('click', () => {
  if (tg) tg.showPopup({ title: 'Новый плейлист', message: 'Функция доступна после подключения сервера.', buttons: [{ type: 'ok' }] });
  haptic('light');
});

/* ─── Auto-search from URL ?q= ────────────────────────────── */
(function () {
  const q = new URLSearchParams(location.search).get('q');
  if (!q) return;
  searchInput.value = q; clearBtn.style.display = '';
  switchTab('tabSearch', null);
  doSearch(q);
})();
