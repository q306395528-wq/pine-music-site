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
  { title: "夜行列车", artist: "Pine Studio", src: demoWav([261.63, 329.63, 392, 329.63, 440, 392, 329.63, 293.66]), cover: "cover-purple", durationLabel: "00:08", genre: "轻音乐" },
  { title: "暖色落日", artist: "Chyan Waves", src: demoWav([440, 329.63, 392, 329.63, 293.66, 329.63, 392, 440]), cover: "cover-sunset", durationLabel: "00:08", genre: "流行" },
  { title: "城市灯火", artist: "Pine Studio", src: demoWav([329.63, 392, 493.88, 392, 329.63, 293.66, 329.63, 392]), cover: "cover-blue", durationLabel: "00:08", genre: "电子" },
];

const playlists = [
  ["流行音乐榜", "392.6万", "cover-1"],
  ["热歌榜", "287.4万", "cover-2"],
  ["新歌速递", "152.3万", "cover-3"],
  ["夜行电子", "312.8万", "cover-4"],
  ["KTV必点榜", "226.7万", "cover-5"],
  ["网络热歌榜", "185.4万", "cover-6"],
];

const $ = (selector) => document.querySelector(selector);
const audio = $("#audio");
let tracks = [...fallbackTracks];
let index = 0;
let shuffle = false;
let repeat = false;
let liked = false;

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
    title: song.title,
    artist: song.artist || "未知歌手",
    src: song.src,
    cover: song.cover || ["cover-purple", "cover-sunset", "cover-blue"][songIndex % 3],
    durationLabel: song.duration || song.durationLabel || "--:--",
    genre: song.genre || "云端音乐",
  };
}

function loadTrack(nextIndex, shouldPlay = false) {
  if (!tracks.length) return;
  index = (nextIndex + tracks.length) % tracks.length;
  const track = tracks[index];
  audio.src = track.src;
  ["bottomTitle", "sideTitle"].forEach((id) => { $(`#${id}`).textContent = track.title; });
  ["bottomArtist", "sideArtist"].forEach((id) => { $(`#${id}`).textContent = track.artist; });
  setCover($("#bottomCover"), track.cover);
  setCover($("#sideCover"), track.cover);
  renderQueue();
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
  const data = tracks.filter((track) => `${track.title} ${track.artist} ${track.genre}`.toLowerCase().includes(normalizedQuery));
  const grid = $("#recommendGrid");
  grid.innerHTML = data.length
    ? data.map((track) => `<article class="recommend-card" data-index="${tracks.indexOf(track)}">
        <div class="card-cover ${escapeHtml(track.cover)}"><button class="play-chip" aria-label="播放">▶</button></div>
        <div class="card-meta"><strong>${escapeHtml(track.title)}</strong><span>${escapeHtml(track.artist)} · ${escapeHtml(track.genre)}</span></div>
      </article>`).join("")
    : '<div class="empty-state">没有找到匹配的音乐</div>';
  grid.querySelectorAll(".recommend-card").forEach((card) => {
    card.addEventListener("click", () => loadTrack(Number(card.dataset.index), true));
  });
}

function renderPlaylists(query = "") {
  const grid = $("#playlistGrid");
  const data = playlists.filter(([title]) => title.toLowerCase().includes(query.toLowerCase()));
  grid.innerHTML = data.length
    ? data.map(([title, count, cover]) => `<article class="playlist-card"><div class="playlist-cover ${cover}"><button class="play-chip">▶</button></div><strong>${title}</strong><span>▷ ${count}</span></article>`).join("")
    : '<div class="empty-state">没有找到匹配的歌单</div>';
  grid.querySelectorAll(".playlist-card").forEach((card) => {
    card.addEventListener("click", () => { shuffle = true; nextTrack(); toast("已开始随机播放"); });
  });
}

function renderQueue() {
  $("#queueCount").textContent = tracks.length;
  $("#queueList").innerHTML = tracks.map((track, trackIndex) => `<div class="queue-item ${trackIndex === index ? "active" : ""}" data-index="${trackIndex}">
      <span class="queue-index">${trackIndex === index ? "▮▮" : trackIndex + 1}</span>
      <div><strong>${escapeHtml(track.title)}</strong><small>${escapeHtml(track.artist)}</small></div>
      <span class="queue-duration">${escapeHtml(track.durationLabel || "--:--")}</span>
    </div>`).join("");
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
audio.addEventListener("play", () => { $("#playBtn").textContent = $("#sidePlay").textContent = "Ⅱ"; });
audio.addEventListener("pause", () => { $("#playBtn").textContent = $("#sidePlay").textContent = "▶"; });
audio.addEventListener("loadedmetadata", () => { $("#durationTime").textContent = $("#sideDuration").textContent = fmt(audio.duration); });
audio.addEventListener("timeupdate", () => {
  const progress = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
  $("#progressBar").value = progress;
  $("#sideProgressFill").style.width = `${progress}%`;
  $("#currentTime").textContent = $("#sideCurrent").textContent = fmt(audio.currentTime);
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
  liked = !liked;
  $("#bottomHeart").textContent = liked ? "♥" : "♡";
  $("#heartBtn").style.color = liked ? "#fb7185" : "#aab2c1";
  toast(liked ? "已添加到我喜欢" : "已取消收藏");
}

$("#bottomHeart").addEventListener("click", toggleLike);
$("#heartBtn").addEventListener("click", toggleLike);
$("#muteBtn").addEventListener("click", () => {
  audio.muted = !audio.muted;
  $("#muteBtn").textContent = audio.muted ? "×" : "◖";
});
$("#queueToggle").addEventListener("click", () => toast("桌面端右侧为播放列表"));
$("#clearQueue").addEventListener("click", () => {
  if (!tracks.length) return;
  tracks = [tracks[index]];
  index = 0;
  renderSongs($("#searchInput").value);
  renderQueue();
  toast("已保留当前歌曲");
});
$("#newPlaylist").addEventListener("click", () => toast("已新建一个空歌单"));
$("#searchInput").addEventListener("input", (event) => {
  renderSongs(event.target.value);
  renderPlaylists(event.target.value);
});

document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    $("#searchInput").focus();
  } else if (event.code === "Space" && document.activeElement.tagName !== "INPUT") {
    event.preventDefault();
    togglePlay();
  }
});

document.querySelectorAll(".main-nav .nav-item").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".main-nav .nav-item").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    toast(`已切换到：${button.dataset.section}`);
  });
});

document.querySelectorAll("#genreTabs button").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("#genreTabs button").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    toast(`流派：${button.textContent}`);
  });
});

$("#filePicker").addEventListener("change", async (event) => {
  const files = [...event.target.files];
  event.target.value = "";
  if (!files.length) return;
  await uploadFiles(files);
});

loadTrack(0);
renderSongs();
renderPlaylists();
renderQueue();
syncCloud({ notify: false });
