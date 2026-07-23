function demoWav(notes) {
  const sampleRate = 8000;
  const samplesPerNote = sampleRate;
  const dataLength = notes.length * samplesPerNote;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);
  const write = (offset, text) => [...text].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
  write(0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  write(36, "data");
  view.setUint32(40, dataLength, true);
  for (let i = 0; i < dataLength; i += 1) {
    const noteIndex = Math.min(notes.length - 1, Math.floor(i / samplesPerNote));
    const noteSample = i % samplesPerNote;
    const frequency = notes[noteIndex];
    const envelope = Math.max(0, Math.min(1, noteSample / (sampleRate * 0.03), (samplesPerNote - noteSample) / (sampleRate * 0.12)));
    const time = i / sampleRate;
    const wave = (Math.sin(2 * Math.PI * frequency * time) * 0.65 + Math.sin(4 * Math.PI * frequency * time) * 0.18) * envelope;
    view.setUint8(44 + i, Math.max(0, Math.min(255, Math.round(128 + wave * 95))));
  }
  return URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
}

const fallbackTracks = [
  { title: "夜行列车", artist: "Pine Studio", src: demoWav([261.63, 329.63, 392, 329.63, 440, 392, 329.63, 293.66]), cover: "cover-purple", durationLabel: "00:08", genre: "轻音乐", demo: true },
  { title: "暖色落日", artist: "Chyan Waves", src: demoWav([440, 329.63, 392, 329.63, 293.66, 329.63, 392, 440]), cover: "cover-sunset", durationLabel: "00:08", genre: "流行", demo: true },
  { title: "城市灯火", artist: "Pine Studio", src: demoWav([329.63, 392, 493.88, 392, 329.63, 293.66, 329.63, 392]), cover: "cover-blue", durationLabel: "00:08", genre: "电子", demo: true },
];

const $ = (selector) => document.querySelector(selector);
const audio = $("#audio");

// 苹果风格 SVG 图标（SF Symbols 风）；用 currentColor 继承按钮颜色，1em 随字号缩放
const ICONS = {
  play: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M7.5 4.8v14.4a1 1 0 0 0 1.53.85l11.2-7.2a1 1 0 0 0 0-1.7L9.03 3.95A1 1 0 0 0 7.5 4.8Z"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M8.2 4.2A1.6 1.6 0 0 0 6.6 5.8v12.4a1.6 1.6 0 0 0 3.2 0V5.8A1.6 1.6 0 0 0 8.2 4.2Zm7.6 0a1.6 1.6 0 0 0-1.6 1.6v12.4a1.6 1.6 0 0 0 3.2 0V5.8a1.6 1.6 0 0 0-1.6-1.6Z"/></svg>',
  backward: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M6 5.6a1 1 0 0 1 2 0v4.5l9.4-5.7A1 1 0 0 1 19 5.2v13.6a1 1 0 0 1-1.6.85L8 13.9v4.5a1 1 0 0 1-2 0Z"/></svg>',
  forward: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M18 5.6a1 1 0 0 0-2 0v4.5L6.6 4.4A1 1 0 0 0 5 5.2v13.6a1 1 0 0 0 1.6.85L16 13.9v4.5a1 1 0 0 0 2 0Z"/></svg>',
  shuffle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h3.6c1 0 2 .5 2.6 1.4l4.6 6.2c.6.9 1.6 1.4 2.6 1.4H21"/><path d="M3 18h3.6c1 0 2-.5 2.6-1.4l.9-1.2"/><path d="M14 8.6l.8-1.2c.6-.9 1.6-1.4 2.6-1.4H21"/><path d="m18.5 3 2.5 3-2.5 3"/><path d="m18.5 12 2.5 3-2.5 3"/></svg>',
  repeat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m17 2.5 3 3-3 3"/><path d="M20 5.5H8.5A4.5 4.5 0 0 0 4 10v.8"/><path d="m7 21.5-3-3 3-3"/><path d="M4 18.5h11.5A4.5 4.5 0 0 0 20 14v-.8"/></svg>',
  volume: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path fill="currentColor" stroke="none" d="M4 9.5v5h3.5L13 19V5L7.5 9.5Z"/><path d="M16.5 8.8a4.5 4.5 0 0 1 0 6.4"/><path d="M19 6a8 8 0 0 1 0 12"/></svg>',
  muted: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path fill="currentColor" stroke="none" d="M4 9.5v5h3.5L13 19V5L7.5 9.5Z"/><path d="m17 9.5 5 5M22 9.5l-5 5"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h11"/></svg>',
  heart: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 20.7 4.3 13a4.7 4.7 0 0 1 6.65-6.65l1.05 1.05 1.05-1.05A4.7 4.7 0 0 1 19.7 13Z"/></svg>',
  heartOutline: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><path d="M12 20.2 4.75 13a4.35 4.35 0 0 1 6.15-6.15l1.1 1.1 1.1-1.1A4.35 4.35 0 0 1 19.25 13Z"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5.5v13M5.5 12h13"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L18.4 9.6a1.9 1.9 0 0 0-2.7-2.7L5 17.6Z"/><path d="m13.5 6.5 2.7 2.7"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-3.8-3.8"/></svg>',
  all: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V6l11-2v12" fill="none"/><circle cx="6" cy="18" r="2.6" fill="currentColor" stroke="none"/><circle cx="17" cy="16" r="2.6" fill="currentColor" stroke="none"/></svg>',
  upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V4"/><path d="m7.5 8.5 4.5-4.5 4.5 4.5"/><path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15"/></svg>',
  playlist: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h11M4 12h11M4 17h7"/><circle cx="18" cy="16" r="2.4" fill="currentColor" stroke="none"/><path d="M20.4 16V9l-3 1" stroke-linejoin="round"/></svg>',
};
function iconMarkup(name) { return ICONS[name] || ""; }
function applyIcons(root) {
  (root || document).querySelectorAll("[data-icon]").forEach((el) => { el.innerHTML = iconMarkup(el.dataset.icon); });
}

let tracks = [...fallbackTracks];
let index = 0;
let shuffle = false;
let repeat = false;
const coverCache = new Map();
const lyricsCache = new Map();
let lyricLines = [];
let activeLyric = -1;
let lyricsToken = 0;
let currentPanel = "queue";
let viewMode = "all";
let playlists = [];
const LIKED_KEY = "pineMusicLiked";
let likedSet = new Set();
try { likedSet = new Set(JSON.parse(localStorage.getItem(LIKED_KEY) || "[]")); } catch (e) { /* ignore */ }

// 时长持久化：读到一次就存本地，下次秒显（键用文件名）
const DURATIONS_KEY = "pineMusicDurations";
let durationStore = {};
try { durationStore = JSON.parse(localStorage.getItem(DURATIONS_KEY) || "{}"); } catch (e) { /* ignore */ }
function saveDuration(file, seconds) {
  if (!file || !Number.isFinite(seconds) || seconds <= 0) return;
  const label = fmt(seconds);
  if (durationStore[file] === label) return;
  durationStore[file] = label;
  try { localStorage.setItem(DURATIONS_KEY, JSON.stringify(durationStore)); } catch (e) { /* ignore */ }
  const track = tracks.find((item) => item.file === file);
  if (track) track.durationLabel = label;
  const i = track ? tracks.indexOf(track) : -1;
  if (i >= 0) {
    document.querySelectorAll(`#queueList .queue-item[data-index="${i}"] .queue-duration, #npQueue .queue-item[data-index="${i}"] .queue-duration`)
      .forEach((el) => { el.textContent = label; });
  }
}
// 后台逐个读取时长（只加载文件头，不下整首），节流并发
function prefetchDurations() {
  const pending = tracks.filter((t) => !t.demo && t.file && !durationStore[t.file] && (!t.durationLabel || t.durationLabel === "--:--"));
  let i = 0;
  const run = () => {
    if (i >= pending.length) return;
    const track = pending[i++];
    const probe = new Audio();
    probe.preload = "metadata";
    let settled = false;
    const finish = () => { if (settled) return; settled = true; probe.removeAttribute("src"); run(); };
    probe.addEventListener("loadedmetadata", () => { saveDuration(track.file, probe.duration); finish(); });
    probe.addEventListener("error", finish);
    setTimeout(finish, 9000);
    probe.src = track.src;
  };
  for (let k = 0; k < 3; k += 1) run();
}

// 封面持久化：每首歌只向 iTunes 查一次，之后从本地读取，避免每次刷新都发几十个请求触发限流
const COVERS_KEY = "pineMusicCovers";
let coverStore = {};
try { coverStore = JSON.parse(localStorage.getItem(COVERS_KEY) || "{}"); } catch (e) { /* ignore */ }
function saveCover(key, url) {
  if (!url) return;
  coverStore[key] = url;
  try { localStorage.setItem(COVERS_KEY, JSON.stringify(coverStore)); } catch (e) { /* ignore */ }
}

// 限制并发，降低突发请求触发 iTunes 限流的概率
let coverInFlight = 0;
const coverQueue = [];
function acquireCoverSlot() {
  return new Promise((resolve) => {
    const run = () => { if (coverInFlight < 4) { coverInFlight += 1; resolve(); } else coverQueue.push(run); };
    run();
  });
}
function releaseCoverSlot() {
  coverInFlight -= 1;
  const next = coverQueue.shift();
  if (next) setTimeout(next, 180);
}

// 很多文件名是无空格的拼接（AllFallsDown、EminemDido），驼峰拆词后既好看又便于搜索
function humanize(text) {
  return String(text || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Za-z])([（(])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

// 为封面/歌词匹配构造干净的搜索词：标题去括号/噪声词，歌手只取前两个词作主歌手
function searchTerms(track) {
  const title = humanize(track.title)
    .replace(/[（(【\[].*?[)）\]】]/g, " ")
    .replace(/\b(official|video|audio|lyrics?|explicit|mv|hd|hq|remaster(ed)?)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = humanize(track.artist).split(/\s+/).filter(Boolean);
  return { title, primaryArtist: words.slice(0, 2).join(" ") };
}

function likeKey(track) {
  return track ? (track.file || track.src || `${track.artist}|${track.title}`) : "";
}
function isLiked(track) {
  return likedSet.has(likeKey(track));
}
function persistLiked() {
  try { localStorage.setItem(LIKED_KEY, JSON.stringify([...likedSet])); } catch (e) { /* ignore */ }
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character]);
}

function fmt(seconds) {
  if (!Number.isFinite(seconds)) return "00:00";
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;
}

function toast(message, duration = 2000) {
  const element = $("#toast");
  element.textContent = message;
  element.classList.add("show");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => element.classList.remove("show"), duration);
}

function setCover(element, coverClass) {
  [...element.classList].filter((className) => className.startsWith("cover-")).forEach((className) => element.classList.remove(className));
  element.classList.add(coverClass || "cover-purple");
}

function normalizeCloudSong(song, songIndex) {
  if (!song?.src || !song?.title) return null;
  return {
    title: song.manual ? song.title : humanize(song.title),
    artist: song.manual ? (song.artist || "未知歌手") : humanize(song.artist || "未知歌手"),
    manual: !!song.manual,
    file: song.file || song.src,
    src: song.src,
    cover: song.cover || ["cover-purple", "cover-sunset", "cover-blue"][songIndex % 3],
    durationLabel: durationStore[song.file || song.src] || (song.duration && song.duration !== "--:--" ? song.duration : "") || song.durationLabel || "--:--",
    genre: song.genre || "云端音乐",
  };
}

function paintCoverEl(element, track) {
  if (!element || !track) return;
  if (track.coverUrl) {
    element.style.backgroundImage = `url("${track.coverUrl}")`;
    element.style.backgroundSize = "cover";
    element.style.backgroundPosition = "center";
    element.classList.add("has-image");
  } else {
    element.style.backgroundImage = "";
    element.classList.remove("has-image");
    setCover(element, track.cover);
  }
}

function trackKey(track) {
  return `${(track.artist || "").toLowerCase()}${(track.title || "").toLowerCase()}`;
}

function repaintCurrentCover() {
  const track = tracks[index];
  if (!track) return;
  paintCoverEl($("#sideCover"), track);
  paintCoverEl($("#bottomCover"), track);
  if (!$("#nowPlaying").hidden) paintNowPlaying();
  updateMediaSession();
}

function refreshCardCovers() {
  document.querySelectorAll("#recommendGrid .recommend-card").forEach((card) => {
    const track = tracks[Number(card.dataset.index)];
    const cover = card.querySelector(".card-cover");
    if (track && cover) paintCoverEl(cover, track);
  });
}

// 懒加载封面：卡片滚动进入视口才去查，避免一次性对 iTunes 发起几十个请求
let cardObserver = null;
function observeCard(card) {
  if (!cardObserver) {
    cardObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        cardObserver.unobserve(entry.target);
        const track = tracks[Number(entry.target.dataset.index)];
        if (track) ensureArtwork(track);
      });
    }, { rootMargin: "250px" });
  }
  cardObserver.observe(card);
}

// iTunes 不发 CORS 头，但支持 JSONP；走浏览器自己的 IP 可避开 Worker 共享 IP 的限流
function itunesJsonp(term) {
  return new Promise((resolve) => {
    const name = `__pineCover${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
    const script = document.createElement("script");
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      delete window[name];
      script.remove();
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), 4000);
    window[name] = (data) => finish(data);
    script.onerror = () => finish(null);
    script.src = `https://itunes.apple.com/search?term=${term}&entity=song&limit=1&callback=${name}`;
    document.head.appendChild(script);
  });
}

function artworkFrom(data) {
  const art = data && data.results && data.results[0] && data.results[0].artworkUrl100;
  return art ? art.replace(/\/\d+x\d+bb\.(jpg|png)$/i, "/600x600bb.$1") : null;
}

// 预加载一张图，成功返回其 URL，失败返回 null（用于验证封面地址是否真的有图）
function tryLoadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    const timer = setTimeout(() => { img.src = ""; resolve(null); }, 7000);
    img.onload = () => { clearTimeout(timer); resolve(img.naturalWidth > 0 ? src : null); };
    img.onerror = () => { clearTimeout(timer); resolve(null); };
    img.src = src;
  });
}

// 依次尝试候选封面地址（MusicBrainz/CoverArtArchive 并非每个 release 都有图），返回第一个能加载的
async function firstLoadable(candidates) {
  for (const src of candidates || []) {
    const ok = await tryLoadImage(src);
    if (ok) return ok;
  }
  return null;
}

async function ensureArtwork(track) {
  if (!track || track.demo || track.coverUrl || track.coverTried) return;
  track.coverTried = true;
  const key = trackKey(track);
  if (coverStore[key]) {
    track.coverUrl = coverStore[key];
  } else if (coverCache.has(key)) {
    track.coverUrl = coverCache.get(key) || null;
  } else {
    const { title, primaryArtist } = searchTerms(track);
    const queries = [];
    if (primaryArtist && title) queries.push(`${primaryArtist} ${title}`);
    if (title) queries.push(title);
    let cover = null;
    await acquireCoverSlot();
    try {
      // 首选 iTunes（一步到位、清晰），失败则用 MusicBrainz→CoverArtArchive（Worker 可达，浏览器能加载图）
      for (const query of queries) {
        cover = artworkFrom(await itunesJsonp(encodeURIComponent(query)));
        if (cover) break;
      }
      if (!cover) {
        const params = new URLSearchParams({ artist: primaryArtist, title });
        const response = await fetch(`/api/cover?${params}`);
        const payload = await response.json();
        cover = await firstLoadable(payload.candidates);
      }
    } catch (error) {
      console.warn("Cover fetch failed", error);
    } finally {
      releaseCoverSlot();
    }
    track.coverUrl = cover;
    coverCache.set(key, cover);
    saveCover(key, cover);
  }
  if (track.coverUrl) {
    repaintCurrentCover();
    refreshCardCovers();
  }
}

function parseLrc(text) {
  const stampRe = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    const body = line.replace(stampRe, "").trim();
    if (!body) continue;
    let match;
    stampRe.lastIndex = 0;
    while ((match = stampRe.exec(line)) !== null) {
      const frac = match[3] ? Number((match[3] + "00").slice(0, 3)) / 1000 : 0;
      out.push({ time: Number(match[1]) * 60 + Number(match[2]) + frac, text: body });
    }
  }
  return out.sort((a, b) => a.time - b.time);
}

function lyricBoxes() {
  return [$("#lyricsBox"), $("#npLyrics")].filter(Boolean);
}

function boxIsVisible(box) {
  if (box.hidden) return false;
  return box.id === "npLyrics" ? !$("#nowPlaying").hidden : currentPanel === "lyrics";
}

function switchNpPanel(panel) {
  const isQueue = panel === "queue";
  $("#npLyrics").hidden = isQueue;
  $("#npQueue").hidden = !isQueue;
  $("#npTabLyrics").classList.toggle("active", !isQueue);
  $("#npTabQueue").classList.toggle("active", isQueue);
  if (isQueue) {
    const active = $("#npQueue").querySelector(".queue-item.active");
    if (active) active.scrollIntoView({ block: "center" });
  } else {
    activeLyric = -1;
    updateLyric(audio.currentTime);
  }
}

function renderLyricsMessage(message, plain = false) {
  const html = plain
    ? message.split(/\r?\n/).map((line) => `<p>${escapeHtml(line) || "&nbsp;"}</p>`).join("")
    : `<div class="lyrics-hint">${escapeHtml(message)}</div>`;
  lyricBoxes().forEach((box) => {
    box.classList.toggle("plain", plain);
    box.innerHTML = html;
  });
}

function renderLyricLines() {
  const html = lyricLines.map((line, i) => `<p data-i="${i}">${escapeHtml(line.text) || "&nbsp;"}</p>`).join("");
  lyricBoxes().forEach((box) => {
    box.classList.remove("plain");
    box.innerHTML = html;
  });
}

// 自写平滑滚动：浏览器的 scroll-behavior:smooth / scrollTo({behavior}) 在部分环境不生效，改用 RAF
function smoothScrollTop(el, target) {
  const start = el.scrollTop;
  const dist = target - start;
  if (Math.abs(dist) < 2 || document.hidden) { el.scrollTop = target; return; }
  const duration = 380;
  const t0 = performance.now();
  el.__scrollToken = (el.__scrollToken || 0) + 1;
  const token = el.__scrollToken;
  const step = (now) => {
    if (el.__scrollToken !== token) return;
    const p = Math.min(1, (now - t0) / duration);
    const ease = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
    el.scrollTop = start + dist * ease;
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function updateLyric(time) {
  if (!lyricLines.length) return;
  let target = -1;
  for (let i = 0; i < lyricLines.length; i += 1) {
    if (lyricLines[i].time <= time + 0.15) target = i;
    else break;
  }
  if (target === activeLyric) return;
  activeLyric = target;
  lyricBoxes().forEach((box) => {
    box.querySelectorAll("p.active").forEach((p) => p.classList.remove("active"));
    const el = target >= 0 ? box.querySelector(`p[data-i="${target}"]`) : null;
    if (!el) return;
    el.classList.add("active");
    if (boxIsVisible(box)) {
      smoothScrollTop(box, el.offsetTop - box.clientHeight / 2 + el.clientHeight / 2);
    }
  });
}

// Media Session：让 iPhone 锁屏/控制中心、安卓通知栏、桌面媒体控件显示封面与信息、响应硬件控制
function updateMediaSession() {
  if (!("mediaSession" in navigator) || !("MediaMetadata" in window)) return;
  const track = tracks[index];
  if (!track) return;
  const artwork = track.coverUrl
    ? [
        { src: track.coverUrl, sizes: "512x512", type: "image/jpeg" },
        { src: track.coverUrl, sizes: "256x256", type: "image/jpeg" },
      ]
    : [];
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title || "未知歌曲",
      artist: track.artist || "未知歌手",
      album: "Pine Music",
      artwork,
    });
  } catch (e) { /* ignore */ }
}

function updatePositionState() {
  if (!("mediaSession" in navigator) || !navigator.mediaSession.setPositionState) return;
  if (!audio.duration || !Number.isFinite(audio.duration)) return;
  try {
    navigator.mediaSession.setPositionState({
      duration: audio.duration,
      playbackRate: audio.playbackRate || 1,
      position: Math.min(audio.currentTime, audio.duration),
    });
  } catch (e) { /* ignore */ }
}

function setupMediaSession() {
  if (!("mediaSession" in navigator)) return;
  const ms = navigator.mediaSession;
  const bind = (action, handler) => { try { ms.setActionHandler(action, handler); } catch (e) { /* 部分动作不支持 */ } };
  bind("play", () => audio.play());
  bind("pause", () => audio.pause());
  bind("previoustrack", () => previousTrack());
  bind("nexttrack", () => nextTrack());
  // 不注册 seekbackward/seekforward：否则 iOS 锁屏会用 ±10 秒按钮取代上/下一首。
  // 保留 seekto 以支持进度条拖动（不与上/下一首冲突）。
  bind("seekto", (d) => {
    if (!d) return;
    if (d.fastSeek && "fastSeek" in audio) { audio.fastSeek(d.seekTime); return; }
    if (audio.duration) audio.currentTime = d.seekTime;
  });
}

function paintNowPlaying() {
  const track = tracks[index];
  if (!track) return;
  $("#npTitle").textContent = track.title;
  $("#npArtist").textContent = track.artist;
  paintCoverEl($("#npCover"), track);
  const bg = $("#npBg");
  bg.style.backgroundImage = track.coverUrl ? `url("${track.coverUrl}")` : "";
}

function openNowPlaying() {
  if (!tracks.length) return;
  paintNowPlaying();
  reflectLike();
  $("#nowPlaying").hidden = false;
  document.body.classList.add("np-open");
  switchNpPanel("lyrics");
}

function closeNowPlaying() {
  $("#nowPlaying").hidden = true;
  document.body.classList.remove("np-open");
}

async function loadLyrics(track) {
  const token = (lyricsToken += 1);
  lyricLines = [];
  activeLyric = -1;
  const apply = (data) => {
    if (token !== lyricsToken) return;
    lyricLines = data && data.synced ? parseLrc(data.synced) : [];
    if (lyricLines.length) renderLyricLines();
    else if (data && data.plain) renderLyricsMessage(data.plain, true);
    else renderLyricsMessage("暂无歌词");
  };
  if (track.demo) { renderLyricsMessage("暂无歌词"); return; }
  const key = trackKey(track);
  if (lyricsCache.has(key)) { apply(lyricsCache.get(key)); return; }
  renderLyricsMessage("正在加载歌词…");
  try {
    const { title, primaryArtist } = searchTerms(track);
    const params = new URLSearchParams({ artist: primaryArtist, title });
    const response = await fetch(`/api/lyrics?${params}`);
    const data = await response.json();
    lyricsCache.set(key, data);
    apply(data);
  } catch (error) {
    if (token === lyricsToken) renderLyricsMessage("歌词加载失败");
  }
}

function switchPanel(panel) {
  currentPanel = panel;
  const isLyrics = panel === "lyrics";
  $("#queueList").hidden = isLyrics;
  $("#lyricsBox").hidden = !isLyrics;
  $("#tabQueue").classList.toggle("active", !isLyrics);
  $("#tabLyrics").classList.toggle("active", isLyrics);
  $("#clearQueue").style.visibility = isLyrics ? "hidden" : "";
  if (isLyrics) {
    activeLyric = -1;
    updateLyric(audio.currentTime);
  }
}

function loadTrack(nextIndex, shouldPlay = false) {
  if (!tracks.length) return;
  index = (nextIndex + tracks.length) % tracks.length;
  const track = tracks[index];
  audio.src = track.src;
  ["bottomTitle", "sideTitle"].forEach((id) => { $(`#${id}`).textContent = track.title; });
  ["bottomArtist", "sideArtist"].forEach((id) => { $(`#${id}`).textContent = track.artist; });
  paintCoverEl($("#bottomCover"), track);
  paintCoverEl($("#sideCover"), track);
  if (!$("#nowPlaying").hidden) paintNowPlaying();
  reflectLike();
  renderQueue();
  updateMediaSession();
  ensureArtwork(track);
  loadLyrics(track);
  if (shouldPlay) audio.play().catch(() => toast("请再次点击播放"));
}

function togglePlay() {
  if (!audio.src) loadTrack(index);
  if (audio.paused) audio.play().catch(() => toast("请再次点击播放"));
  else audio.pause();
}

function nextTrack() {
  loadTrack(shuffle ? Math.floor(Math.random() * tracks.length) : index + 1, true);
}

function previousTrack() {
  loadTrack(index - 1, true);
}

function renderSongs(query = "") {
  const normalizedQuery = query.toLowerCase();
  let data = tracks.filter((track) => `${track.title} ${track.artist} ${track.genre}`.toLowerCase().includes(normalizedQuery));
  const pl = currentPlaylist();
  if (viewMode === "liked") data = data.filter(isLiked);
  else if (pl) { const set = new Set(pl.files); data = data.filter((t) => set.has(t.file)); }
  const grid = $("#recommendGrid");
  const emptyText = pl ? "这个歌单还没有歌，点歌曲封面左下角的 ＋ 加入"
    : (viewMode === "liked" ? "还没有喜欢的歌曲，点封面右上角的 ♡ 添加" : "没有找到匹配的音乐");
  grid.innerHTML = data.length
    ? data.map((track) => {
        const i = tracks.indexOf(track);
        const liked = isLiked(track);
        return `<article class="recommend-card" data-index="${i}">
        <div class="card-cover ${escapeHtml(track.cover)}">
          <button class="card-like ${liked ? "liked" : ""}" data-index="${i}" aria-label="喜欢">${liked ? iconMarkup("heart") : iconMarkup("heartOutline")}</button>
          <button class="card-edit" data-index="${i}" aria-label="编辑信息" title="编辑歌名/歌手">${iconMarkup("edit")}</button>
          <button class="card-add" data-index="${i}" aria-label="加入歌单" title="加入歌单">${iconMarkup("plus")}</button>
          <button class="play-chip" aria-label="播放">${iconMarkup("play")}</button>
        </div>
        <div class="card-meta"><strong>${escapeHtml(track.title)}</strong><span>${escapeHtml(track.artist)} · ${escapeHtml(track.genre)}</span></div>
      </article>`;
      }).join("")
    : `<div class="empty-state">${emptyText}</div>`;
  if (cardObserver) cardObserver.disconnect();
  grid.querySelectorAll(".recommend-card").forEach((card) => {
    const track = tracks[Number(card.dataset.index)];
    const cover = card.querySelector(".card-cover");
    if (track && cover) paintCoverEl(cover, track);
    if (track) {
      const key = trackKey(track);
      // 已缓存的立即解析并绘制（无网络）；未缓存的滚动进入视口时再查，避免一次性发几十个请求触发限流
      if (track.coverUrl || coverStore[key] || coverCache.has(key)) ensureArtwork(track);
      else observeCard(card);
    }
    card.addEventListener("click", () => loadTrack(Number(card.dataset.index), true));
  });
  grid.querySelectorAll(".card-like").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleLikeFor(tracks[Number(btn.dataset.index)]);
    });
  });
  grid.querySelectorAll(".card-edit").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      openEditDialog(tracks[Number(btn.dataset.index)]);
    });
  });
  grid.querySelectorAll(".card-add").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      openAddToPlaylist(tracks[Number(btn.dataset.index)], btn);
    });
  });
}

let guessTracks = [];
function pickGuess() {
  const pool = tracks.filter((track) => !track.demo);
  guessTracks = [...pool].sort(() => Math.random() - 0.5).slice(0, 5);
}

function renderGuess() {
  const grid = $("#guessGrid");
  if (!grid) return;
  if (!guessTracks.length) pickGuess();
  grid.innerHTML = guessTracks.length
    ? guessTracks.map((track) => {
        const i = tracks.indexOf(track);
        const liked = isLiked(track);
        return `<article class="recommend-card" data-index="${i}">
        <div class="card-cover ${escapeHtml(track.cover)}">
          <button class="card-like ${liked ? "liked" : ""}" data-index="${i}" aria-label="喜欢">${liked ? iconMarkup("heart") : iconMarkup("heartOutline")}</button>
          <button class="card-edit" data-index="${i}" aria-label="编辑信息" title="编辑歌名/歌手">${iconMarkup("edit")}</button>
          <button class="card-add" data-index="${i}" aria-label="加入歌单" title="加入歌单">${iconMarkup("plus")}</button>
          <button class="play-chip" aria-label="播放">${iconMarkup("play")}</button>
        </div>
        <div class="card-meta"><strong>${escapeHtml(track.title)}</strong><span>${escapeHtml(track.artist)} · ${escapeHtml(track.genre)}</span></div>
      </article>`;
      }).join("")
    : '<div class="empty-state">上传更多歌曲，这里会给你惊喜</div>';
  grid.querySelectorAll(".recommend-card").forEach((card) => {
    const track = tracks[Number(card.dataset.index)];
    const cover = card.querySelector(".card-cover");
    if (track && cover) paintCoverEl(cover, track);
    if (track) ensureArtwork(track);
    card.addEventListener("click", () => loadTrack(Number(card.dataset.index), true));
  });
  grid.querySelectorAll(".card-like").forEach((btn) => {
    btn.addEventListener("click", (event) => { event.stopPropagation(); toggleLikeFor(tracks[Number(btn.dataset.index)]); });
  });
  grid.querySelectorAll(".card-edit").forEach((btn) => {
    btn.addEventListener("click", (event) => { event.stopPropagation(); openEditDialog(tracks[Number(btn.dataset.index)]); });
  });
  grid.querySelectorAll(".card-add").forEach((btn) => {
    btn.addEventListener("click", (event) => { event.stopPropagation(); openAddToPlaylist(tracks[Number(btn.dataset.index)], btn); });
  });
}

function reflectLike() {
  const on = isLiked(tracks[index]);
  const html = on ? iconMarkup("heart") : iconMarkup("heartOutline");
  ["#bottomHeart", "#heartBtn", "#npHeart"].forEach((sel) => {
    const el = $(sel);
    if (!el) return;
    el.innerHTML = html;
    el.classList.toggle("liked", on);
  });
}

function toggleLikeFor(track) {
  if (!track) return;
  const key = likeKey(track);
  if (likedSet.has(key)) likedSet.delete(key);
  else likedSet.add(key);
  persistLiked();
  reflectLike();
  toast(likedSet.has(key) ? "已添加到我喜欢" : "已取消收藏");
  renderSongs($("#searchInput").value);
  renderGuess();
}

let editingFile = null;
function openEditDialog(track) {
  if (!track || !track.file) return;
  editingFile = track.file;
  $("#editTitle").value = track.title;
  $("#editArtist").value = track.artist === "未知歌手" ? "" : track.artist;
  $("#editModal").hidden = false;
  $("#editTitle").focus();
  $("#editTitle").select();
}

function closeEditDialog() {
  $("#editModal").hidden = true;
  editingFile = null;
}

async function saveEdit() {
  if (!editingFile) return;
  const title = $("#editTitle").value.trim();
  const artist = $("#editArtist").value.trim();
  if (!title) { toast("歌名不能为空"); return; }
  let password = sessionStorage.getItem("pineMusicUploadPassword") || "";
  if (!password) password = window.prompt("请输入密码（与上传密码相同）") || "";
  if (!password) return;
  const file = editingFile;
  try {
    const response = await fetch("/api/meta", {
      method: "POST",
      headers: { "content-type": "application/json", "X-Upload-Password": password },
      body: JSON.stringify({ file, title, artist }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) sessionStorage.removeItem("pineMusicUploadPassword");
      throw new Error(payload.error || `保存失败（${response.status}）`);
    }
    sessionStorage.setItem("pineMusicUploadPassword", password);
    // 本地即时更新，避免整页重置播放；同时用新名字重新匹配封面
    const track = tracks.find((item) => item.file === file);
    if (track) {
      track.title = title;
      track.artist = artist || "未知歌手";
      track.manual = true;
      track.coverUrl = null;
      track.coverTried = false;
      renderSongs($("#searchInput").value);
      renderQueue();
      if (tracks[index] && tracks[index].file === file) {
        ["bottomTitle", "sideTitle", "npTitle"].forEach((id) => { if ($(`#${id}`)) $(`#${id}`).textContent = track.title; });
        ["bottomArtist", "sideArtist", "npArtist"].forEach((id) => { if ($(`#${id}`)) $(`#${id}`).textContent = track.artist; });
      }
      ensureArtwork(track);
    }
    closeEditDialog();
    toast("已保存");
  } catch (error) {
    toast(error.message || "保存失败", 4000);
  }
}

function currentPlaylist() {
  if (!viewMode.startsWith("playlist:")) return null;
  return playlists.find((p) => p.id === viewMode.slice(9)) || null;
}

function setView(mode) {
  viewMode = mode;
  const heading = $("#recommendHeading");
  const kicker = $("#recommendKicker");
  const pl = mode.startsWith("playlist:") ? playlists.find((p) => p.id === mode.slice(9)) : null;
  if (heading) heading.textContent = pl ? pl.name : (mode === "liked" ? "我喜欢的音乐" : "为你推荐");
  if (kicker) kicker.textContent = pl ? "PLAYLIST" : (mode === "liked" ? "MY LIKES" : "FOR YOU");
  const navAll = $("#navAll");
  const navLiked = $("#navLiked");
  if (navAll) navAll.classList.toggle("active", mode === "all");
  if (navLiked) navLiked.classList.toggle("active", mode === "liked");
  document.querySelectorAll("#playlistNav .playlist-item").forEach((item) => {
    item.classList.toggle("active", mode === "playlist:" + item.dataset.id);
  });
  renderSongs($("#searchInput").value);
  const content = document.querySelector(".content");
  if (content) content.scrollTo({ top: 0, behavior: "smooth" });
}

function renderPlaylistNav() {
  const nav = $("#playlistNav");
  if (!nav) return;
  nav.innerHTML = playlists.length
    ? playlists.map((p) => `<button class="nav-item playlist-item ${viewMode === "playlist:" + p.id ? "active" : ""}" data-id="${p.id}">
        <span class="pl-icon nav-ico">${iconMarkup("playlist")}</span><span class="pl-name">${escapeHtml(p.name)}</span><span class="pl-count">${p.files.length}</span>
      </button>`).join("")
    : '<div class="pl-empty">点上方 ＋ 新建歌单</div>';
  nav.querySelectorAll(".playlist-item").forEach((item) => {
    item.addEventListener("click", () => setView("playlist:" + item.dataset.id));
    item.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      deletePlaylist(item.dataset.id);
    });
  });
}

async function savePlaylists() {
  let password = sessionStorage.getItem("pineMusicUploadPassword") || "";
  if (!password) password = window.prompt("请输入密码（与上传密码相同）") || "";
  if (!password) return false;
  try {
    const response = await fetch("/api/playlists", {
      method: "POST",
      headers: { "content-type": "application/json", "X-Upload-Password": password },
      body: JSON.stringify({ playlists }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) sessionStorage.removeItem("pineMusicUploadPassword");
      throw new Error(payload.error || `保存失败（${response.status}）`);
    }
    sessionStorage.setItem("pineMusicUploadPassword", password);
    return true;
  } catch (error) {
    toast(error.message || "保存失败", 4000);
    return false;
  }
}

async function loadPlaylists() {
  try {
    const response = await fetch(`/api/playlists?v=${Date.now()}`, { cache: "no-store" });
    const data = await response.json();
    playlists = Array.isArray(data.playlists) ? data.playlists : [];
  } catch (error) {
    playlists = [];
  }
  renderPlaylistNav();
}

async function createPlaylist(withFile) {
  const name = (window.prompt("新歌单名称") || "").trim();
  if (!name) return;
  const pl = { id: `pl_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, name, files: withFile ? [withFile] : [], created: Date.now() };
  playlists.push(pl);
  renderPlaylistNav();
  const ok = await savePlaylists();
  if (ok) toast(`已创建歌单「${name}」`);
  else { playlists = playlists.filter((p) => p.id !== pl.id); renderPlaylistNav(); }
}

async function deletePlaylist(id) {
  const pl = playlists.find((p) => p.id === id);
  if (!pl) return;
  if (!window.confirm(`删除歌单「${pl.name}」？（歌曲本身不会被删除）`)) return;
  const backup = playlists;
  playlists = playlists.filter((p) => p.id !== id);
  if (viewMode === "playlist:" + id) setView("all");
  renderPlaylistNav();
  const ok = await savePlaylists();
  if (ok) toast("已删除歌单");
  else { playlists = backup; renderPlaylistNav(); }
}

function closeAddMenu() {
  document.querySelectorAll(".pl-menu").forEach((m) => m.remove());
}

function openAddToPlaylist(track, anchor) {
  closeAddMenu();
  if (!track || !track.file) return;
  const menu = document.createElement("div");
  menu.className = "pl-menu";
  menu.innerHTML = `<div class="pl-menu-title">加入歌单</div>` +
    playlists.map((p) => {
      const inIt = p.files.includes(track.file);
      return `<button class="pl-menu-item ${inIt ? "on" : ""}" data-id="${p.id}"><span>${inIt ? "✓" : "＋"}</span>${escapeHtml(p.name)}</button>`;
    }).join("") +
    `<button class="pl-menu-item pl-menu-new" data-new="1"><span>＋</span>新建歌单…</button>`;
  document.body.appendChild(menu);
  const rect = anchor.getBoundingClientRect();
  menu.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - menu.offsetWidth - 8))}px`;
  menu.style.top = `${Math.min(rect.bottom + 6, window.innerHeight - menu.offsetHeight - 8)}px`;
  menu.querySelectorAll(".pl-menu-item").forEach((item) => {
    item.addEventListener("click", async (event) => {
      event.stopPropagation();
      closeAddMenu();
      if (item.dataset.new) { await createPlaylist(track.file); return; }
      const pl = playlists.find((p) => p.id === item.dataset.id);
      if (!pl) return;
      const idx = pl.files.indexOf(track.file);
      if (idx >= 0) pl.files.splice(idx, 1); else pl.files.push(track.file);
      renderPlaylistNav();
      if (viewMode.startsWith("playlist:")) renderSongs($("#searchInput").value);
      const ok = await savePlaylists();
      if (ok) toast(idx >= 0 ? "已移出歌单" : `已加入「${pl.name}」`);
    });
  });
  setTimeout(() => document.addEventListener("click", closeAddMenu, { once: true }), 0);
}

function renderQueue() {
  const html = tracks.map((track, trackIndex) => `<div class="queue-item ${trackIndex === index ? "active" : ""}" data-index="${trackIndex}">
      <span class="queue-index">${trackIndex === index ? "▮▮" : trackIndex + 1}</span>
      <div><strong>${escapeHtml(track.title)}</strong><small>${escapeHtml(track.artist)}</small></div>
      <span class="queue-duration">${escapeHtml(track.durationLabel || "--:--")}</span>
    </div>`).join("");
  $("#queueCount").textContent = $("#npQueueCount").textContent = tracks.length;
  [$("#queueList"), $("#npQueue")].forEach((box) => { if (box) box.innerHTML = html; });
  document.querySelectorAll(".queue-item").forEach((item) => {
    item.addEventListener("click", () => loadTrack(Number(item.dataset.index), true));
  });
}

async function syncCloud({ notify = true } = {}) {
  try {
    const response = await fetch(`/api/songs?v=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const cloudTracks = Array.isArray(payload.songs)
      ? payload.songs.map(normalizeCloudSong).filter(Boolean)
      : [];
    if (!cloudTracks.length) {
      if (notify) toast("云端还没有音乐");
      return;
    }
    tracks = cloudTracks;
    index = 0;
    loadTrack(0);
    renderSongs($("#searchInput").value);
    pickGuess();
    renderGuess();
    renderQueue();
    setTimeout(prefetchDurations, 1500);
    if (notify) toast(`已同步 ${tracks.length} 首云端音乐`);
  } catch (error) {
    console.warn("Cloud music sync failed", error);
    if (notify) toast("云端音乐暂时读取失败，已保留试听音乐");
  }
}

async function uploadFiles(files) {
  let password = sessionStorage.getItem("pineMusicUploadPassword") || "";
  if (!password) password = window.prompt("请输入音乐上传密码") || "";
  if (!password) return;

  let uploaded = 0;
  for (const file of files) {
    toast(`正在上传 ${uploaded + 1}/${files.length}：${file.name}`, 60000);
    const form = new FormData();
    form.append("file", file);
    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        headers: { "X-Upload-Password": password },
        body: form,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 401) sessionStorage.removeItem("pineMusicUploadPassword");
        throw new Error(payload.error || `上传失败（${response.status}）`);
      }
      uploaded += 1;
      sessionStorage.setItem("pineMusicUploadPassword", password);
    } catch (error) {
      toast(error.message || "上传失败", 5000);
      return;
    }
  }

  toast(`上传完成，共 ${uploaded} 首`);
  await syncCloud({ notify: false });
}

audio.volume = 0.72;
applyIcons();
reflectMute();
setupMediaSession();
function reflectPlayIcon() {
  const html = audio.paused ? iconMarkup("play") : iconMarkup("pause");
  ["#playBtn", "#npPlay"].forEach((sel) => { if ($(sel)) $(sel).innerHTML = html; });
}
audio.addEventListener("play", () => {
  reflectPlayIcon();
  if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "playing";
  updateMediaSession();
  updatePositionState();
});
audio.addEventListener("pause", () => {
  reflectPlayIcon();
  if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "paused";
});
audio.addEventListener("loadedmetadata", () => {
  $("#durationTime").textContent = $("#sideDuration").textContent = $("#npDuration").textContent = fmt(audio.duration);
  const track = tracks[index];
  if (track && track.file) saveDuration(track.file, audio.duration);
  updatePositionState();
});
audio.addEventListener("timeupdate", () => {
  const progress = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
  $("#progressBar").value = progress;
  $("#sideProgressFill").style.width = $("#npProgressFill").style.width = `${progress}%`;
  $("#currentTime").textContent = $("#sideCurrent").textContent = $("#npCurrent").textContent = fmt(audio.currentTime);
  updateLyric(audio.currentTime);
});
audio.addEventListener("ended", () => {
  if (repeat) { audio.currentTime = 0; audio.play(); }
  else nextTrack();
});
audio.addEventListener("error", () => toast("这首音乐暂时无法播放，请检查文件格式"));

$("#progressBar").addEventListener("input", (event) => {
  if (audio.duration) audio.currentTime = Number(event.target.value) / 100 * audio.duration;
});
function setVolume(value) {
  const v = Math.min(1, Math.max(0, Number(value)));
  audio.volume = v;
  if (audio.muted && v > 0) { audio.muted = false; reflectMute(); }
  $("#volumeBar").value = v;
  if ($("#npVolume")) $("#npVolume").value = v;
}
function reflectMute() {
  const html = audio.muted || audio.volume === 0 ? iconMarkup("muted") : iconMarkup("volume");
  ["#muteBtn", "#npMute"].forEach((sel) => { if ($(sel)) $(sel).innerHTML = html; });
}
$("#volumeBar").addEventListener("input", (event) => setVolume(event.target.value));
if ($("#npVolume")) $("#npVolume").addEventListener("input", (event) => setVolume(event.target.value));
if ($("#npMute")) $("#npMute").addEventListener("click", () => { audio.muted = !audio.muted; reflectMute(); });
$("#playBtn").addEventListener("click", togglePlay);
$("#nextBtn").addEventListener("click", nextTrack);
$("#prevBtn").addEventListener("click", previousTrack);
$("#heroPlay").addEventListener("click", () => loadTrack(0, true));
$("#shuffleAll").addEventListener("click", () => { shuffle = true; nextTrack(); toast("已开启随机播放"); });

const SHUFFLE_BTNS = ["#shuffleBtn", "#npShuffle"];
const REPEAT_BTNS = ["#repeatBtn", "#npRepeat"];

function toggleShuffle() {
  shuffle = !shuffle;
  SHUFFLE_BTNS.forEach((selector) => { if ($(selector)) $(selector).style.color = shuffle ? "#c4b5fd" : ""; });
  toast(shuffle ? "已开启随机播放" : "已关闭随机播放");
}

function toggleRepeat() {
  repeat = !repeat;
  REPEAT_BTNS.forEach((selector) => { if ($(selector)) $(selector).style.color = repeat ? "#c4b5fd" : ""; });
  toast(repeat ? "已开启单曲循环" : "已关闭单曲循环");
}

SHUFFLE_BTNS.forEach((selector) => { if ($(selector)) $(selector).addEventListener("click", toggleShuffle); });
REPEAT_BTNS.forEach((selector) => { if ($(selector)) $(selector).addEventListener("click", toggleRepeat); });

function toggleLike() {
  toggleLikeFor(tracks[index]);
}

$("#bottomHeart").addEventListener("click", toggleLike);
$("#heartBtn").addEventListener("click", toggleLike);
if ($("#npHeart")) $("#npHeart").addEventListener("click", toggleLike);
if ($("#navAll")) $("#navAll").addEventListener("click", () => setView("all"));
if ($("#navLiked")) $("#navLiked").addEventListener("click", () => setView("liked"));
if ($("#createPlaylistBtn")) $("#createPlaylistBtn").addEventListener("click", () => createPlaylist());
if ($("#guessRefresh")) $("#guessRefresh").addEventListener("click", () => { pickGuess(); renderGuess(); toast("已换一批"); });
if ($("#bottomQueueBtn")) $("#bottomQueueBtn").addEventListener("click", () => { openNowPlaying(); switchNpPanel("queue"); });
if ($("#sideSeek")) $("#sideSeek").addEventListener("click", (event) => {
  const rect = event.currentTarget.getBoundingClientRect();
  if (audio.duration) audio.currentTime = ((event.clientX - rect.left) / rect.width) * audio.duration;
});
$("#editSave").addEventListener("click", saveEdit);
$("#editCancel").addEventListener("click", closeEditDialog);
$("#editModal").addEventListener("click", (event) => { if (event.target.id === "editModal") closeEditDialog(); });
$("#editTitle").addEventListener("keydown", (event) => { if (event.key === "Enter") saveEdit(); });
$("#editArtist").addEventListener("keydown", (event) => { if (event.key === "Enter") saveEdit(); });
$("#muteBtn").addEventListener("click", () => {
  audio.muted = !audio.muted;
  reflectMute();
});
$("#clearQueue").addEventListener("click", () => {
  if (!tracks.length) return;
  tracks = [tracks[index]];
  index = 0;
  renderSongs($("#searchInput").value);
  renderQueue();
  toast("已保留当前歌曲");
});
$("#sideCover").addEventListener("click", openNowPlaying);
$("#bottomCover").addEventListener("click", openNowPlaying);
$("#npClose").addEventListener("click", closeNowPlaying);
$("#npTabLyrics").addEventListener("click", () => switchNpPanel("lyrics"));
$("#npTabQueue").addEventListener("click", () => switchNpPanel("queue"));
$("#npPlay").addEventListener("click", togglePlay);
$("#npNext").addEventListener("click", nextTrack);
$("#npPrev").addEventListener("click", previousTrack);
$("#tabQueue").addEventListener("click", () => switchPanel("queue"));
$("#tabLyrics").addEventListener("click", () => switchPanel("lyrics"));
$("#searchInput").addEventListener("input", (event) => renderSongs(event.target.value));

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !$("#nowPlaying").hidden) {
    closeNowPlaying();
  } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    $("#searchInput").focus();
  } else if (event.code === "Space" && document.activeElement.tagName !== "INPUT") {
    event.preventDefault();
    togglePlay();
  }
});

$("#filePicker").addEventListener("change", async (event) => {
  const files = [...event.target.files];
  event.target.value = "";
  if (!files.length) return;
  await uploadFiles(files);
});

loadTrack(0);
renderSongs();
renderGuess();
renderQueue();
loadPlaylists();
syncCloud({ notify: false });
