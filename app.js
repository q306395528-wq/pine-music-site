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
const LIKED_KEY = "pineMusicLiked";
let likedSet = new Set();
try { likedSet = new Set(JSON.parse(localStorage.getItem(LIKED_KEY) || "[]")); } catch (e) { /* ignore */ }

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
    title: humanize(song.title),
    artist: humanize(song.artist || "未知歌手"),
    file: song.file || song.src,
    src: song.src,
    cover: song.cover || ["cover-purple", "cover-sunset", "cover-blue"][songIndex % 3],
    durationLabel: song.duration || song.durationLabel || "--:--",
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
      box.scrollTo({ top: el.offsetTop - box.clientHeight / 2 + el.clientHeight / 2, behavior: "smooth" });
    }
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
  if (viewMode === "liked") data = data.filter(isLiked);
  const grid = $("#recommendGrid");
  const emptyText = viewMode === "liked" ? "还没有喜欢的歌曲，点封面右上角的 ♡ 添加" : "没有找到匹配的音乐";
  grid.innerHTML = data.length
    ? data.map((track) => {
        const i = tracks.indexOf(track);
        const liked = isLiked(track);
        return `<article class="recommend-card" data-index="${i}">
        <div class="card-cover ${escapeHtml(track.cover)}">
          <button class="card-like ${liked ? "liked" : ""}" data-index="${i}" aria-label="喜欢">${liked ? "♥" : "♡"}</button>
          <button class="play-chip" aria-label="播放">▶</button>
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
}

function reflectLike() {
  const on = isLiked(tracks[index]);
  $("#bottomHeart").textContent = on ? "♥" : "♡";
  $("#bottomHeart").style.color = on ? "#fb7185" : "";
  $("#heartBtn").textContent = on ? "♥" : "♡";
  $("#heartBtn").style.color = on ? "#fb7185" : "#aab2c1";
  const np = $("#npHeart");
  if (np) { np.textContent = on ? "♥" : "♡"; np.style.color = on ? "#fb7185" : ""; }
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
}

function setView(mode) {
  viewMode = mode;
  const heading = $("#recommendHeading");
  if (heading) heading.textContent = mode === "liked" ? "我喜欢的音乐" : "为你推荐";
  const kicker = $("#recommendKicker");
  if (kicker) kicker.textContent = mode === "liked" ? "MY LIKES" : "FOR YOU";
  const navAll = $("#navAll");
  const navLiked = $("#navLiked");
  if (navAll) navAll.classList.toggle("active", mode === "all");
  if (navLiked) navLiked.classList.toggle("active", mode === "liked");
  renderSongs($("#searchInput").value);
  const content = document.querySelector(".content");
  if (content) content.scrollTo({ top: 0, behavior: "smooth" });
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
    renderQueue();
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
audio.addEventListener("play", () => { $("#playBtn").textContent = $("#sidePlay").textContent = $("#npPlay").textContent = "Ⅱ"; });
audio.addEventListener("pause", () => { $("#playBtn").textContent = $("#sidePlay").textContent = $("#npPlay").textContent = "▶"; });
audio.addEventListener("loadedmetadata", () => { $("#durationTime").textContent = $("#sideDuration").textContent = $("#npDuration").textContent = fmt(audio.duration); });
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
$("#volumeBar").addEventListener("input", (event) => { audio.volume = Number(event.target.value); });
["#playBtn", "#sidePlay"].forEach((selector) => $(selector).addEventListener("click", togglePlay));
["#nextBtn", "#sideNext"].forEach((selector) => $(selector).addEventListener("click", nextTrack));
["#prevBtn", "#sidePrev"].forEach((selector) => $(selector).addEventListener("click", previousTrack));
$("#heroPlay").addEventListener("click", () => loadTrack(0, true));
$("#shuffleAll").addEventListener("click", () => { shuffle = true; nextTrack(); toast("已开启随机播放"); });

function toggleShuffle() {
  shuffle = !shuffle;
  ["#shuffleBtn", "#sideShuffle"].forEach((selector) => { $(selector).style.color = shuffle ? "#c4b5fd" : ""; });
  toast(shuffle ? "已开启随机播放" : "已关闭随机播放");
}

function toggleRepeat() {
  repeat = !repeat;
  ["#repeatBtn", "#sideRepeat"].forEach((selector) => { $(selector).style.color = repeat ? "#c4b5fd" : ""; });
  toast(repeat ? "已开启单曲循环" : "已关闭单曲循环");
}

["#shuffleBtn", "#sideShuffle"].forEach((selector) => $(selector).addEventListener("click", toggleShuffle));
["#repeatBtn", "#sideRepeat"].forEach((selector) => $(selector).addEventListener("click", toggleRepeat));

function toggleLike() {
  toggleLikeFor(tracks[index]);
}

$("#bottomHeart").addEventListener("click", toggleLike);
$("#heartBtn").addEventListener("click", toggleLike);
if ($("#npHeart")) $("#npHeart").addEventListener("click", toggleLike);
if ($("#navAll")) $("#navAll").addEventListener("click", () => setView("all"));
if ($("#navLiked")) $("#navLiked").addEventListener("click", () => setView("liked"));
$("#muteBtn").addEventListener("click", () => {
  audio.muted = !audio.muted;
  $("#muteBtn").textContent = audio.muted ? "×" : "◖";
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
renderQueue();
syncCloud({ notify: false });
