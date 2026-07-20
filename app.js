const baseTracks = [
  {
    title: "夜行列车",
    artist: "Pine Studio",
    src: "night_train.wav",
    cover: "cover-purple",
    durationLabel: "00:08",
    genre: "轻音乐",
    desc: "夜色与列车的温柔节奏"
  },
  {
    title: "暖色落日",
    artist: "Chyan Waves",
    src: "warm_sunset.wav",
    cover: "cover-sunset",
    durationLabel: "00:08",
    genre: "流行",
    desc: "适合黄昏与慢慢散步"
  },
  {
    title: "城市灯火",
    artist: "Pine Studio",
    src: "city_lights.wav",
    cover: "cover-blue",
    durationLabel: "00:08",
    genre: "电子",
    desc: "轻快、清晰、带一点霓虹"
  }
];

const playlistData = [
  ["流行音乐榜","392.6万","cover-1"],
  ["热歌榜","287.4万","cover-2"],
  ["新歌速递","152.3万","cover-3"],
  ["夜行电子","312.8万","cover-4"],
  ["KTV必点榜","226.7万","cover-5"],
  ["网络热歌榜","185.4万","cover-6"]
];

let tracks = [...baseTracks];
let currentIndex = 0;
let isShuffle = false;
let isRepeat = false;
let liked = false;

const $ = s => document.querySelector(s);
const audio = $("#audio");
const playBtn = $("#playBtn");
const sidePlay = $("#sidePlay");
const progressBar = $("#progressBar");
const volumeBar = $("#volumeBar");
const toast = $("#toast");

function toastMsg(msg){
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(window.__toast);
  window.__toast = setTimeout(()=>toast.classList.remove("show"),1800);
}
function fmt(sec){
  if (!Number.isFinite(sec)) return "00:00";
  const m = Math.floor(sec/60).toString().padStart(2,"0");
  const s = Math.floor(sec%60).toString().padStart(2,"0");
  return `${m}:${s}`;
}
function setCoverClass(el, cls){
  [...el.classList].filter(c=>c.startsWith("cover-")).forEach(c=>el.classList.remove(c));
  el.classList.add(cls);
}
function loadTrack(index, autoplay=false){
  if(!tracks.length) return;
  currentIndex = (index + tracks.length) % tracks.length;
  const t = tracks[currentIndex];
  audio.src = t.src;
  $("#bottomTitle").textContent = t.title;
  $("#bottomArtist").textContent = t.artist;
  $("#sideTitle").textContent = t.title;
  $("#sideArtist").textContent = t.artist;
  setCoverClass($("#bottomCover"), t.cover);
  setCoverClass($("#sideCover"), t.cover);
  renderQueue();
  if(autoplay) audio.play().catch(()=>{});
}
function togglePlay(){
  if(!tracks.length) return;
  if(!audio.src) loadTrack(currentIndex);
  if(audio.paused) audio.play().catch(()=>toastMsg("浏览器阻止了自动播放，请再次点击"));
  else audio.pause();
}
function nextTrack(){
  if(!tracks.length) return;
  if(isShuffle) currentIndex = Math.floor(Math.random()*tracks.length);
  else currentIndex = (currentIndex + 1) % tracks.length;
  loadTrack(currentIndex,true);
}
function prevTrack(){
  if(!tracks.length) return;
  currentIndex = (currentIndex - 1 + tracks.length) % tracks.length;
  loadTrack(currentIndex,true);
}
function updatePlayIcons(){
  const icon = audio.paused ? "▶" : "Ⅱ";
  playBtn.textContent = icon;
  sidePlay.textContent = icon;
}
function renderRecommend(filter=""){
  const grid = $("#recommendGrid");
  const data = tracks.filter(t => `${t.title} ${t.artist} ${t.genre}`.toLowerCase().includes(filter.toLowerCase()));
  if(!data.length){
    grid.innerHTML = `<div class="empty-state">没有找到匹配的音乐</div>`;
    return;
  }
  grid.innerHTML = data.map(t=>{
    const realIndex = tracks.indexOf(t);
    return `<article class="recommend-card" data-index="${realIndex}">
      <div class="card-cover ${t.cover}">
        <button class="play-chip" aria-label="播放">▶</button>
      </div>
      <div class="card-meta">
        <strong>${t.title}</strong>
        <span>${t.artist} · ${t.genre}</span>
      </div>
    </article>`;
  }).join("");
  grid.querySelectorAll(".recommend-card").forEach(card=>{
    card.addEventListener("click",()=>loadTrack(Number(card.dataset.index),true));
  });
}
function renderPlaylists(filter=""){
  const grid = $("#playlistGrid");
  const data = playlistData.filter(p=>p[0].toLowerCase().includes(filter.toLowerCase()));
  if(!data.length){
    grid.innerHTML = `<div class="empty-state">没有找到匹配的歌单</div>`;
    return;
  }
  grid.innerHTML = data.map(([title,count,cover])=>`
    <article class="playlist-card">
      <div class="playlist-cover ${cover}"><button class="play-chip">▶</button></div>
      <strong>${title}</strong><span>▷ ${count}</span>
    </article>`).join("");
  grid.querySelectorAll(".playlist-card").forEach(card=>{
    card.addEventListener("click",()=>{ isShuffle=true; nextTrack(); toastMsg("已开始随机播放"); });
  });
}
function renderQueue(){
  $("#queueCount").textContent = tracks.length;
  $("#queueList").innerHTML = tracks.map((t,i)=>`
    <div class="queue-item ${i===currentIndex?"active":""}" data-index="${i}">
      <span class="queue-index">${i===currentIndex?"▮▮":i+1}</span>
      <div><strong>${t.title}</strong><small>${t.artist}</small></div>
      <span class="queue-duration">${t.durationLabel || "--:--"}</span>
    </div>`).join("");
  document.querySelectorAll(".queue-item").forEach(item=>{
    item.addEventListener("click",()=>loadTrack(Number(item.dataset.index),true));
  });
}
function searchAll(){
  const q = $("#searchInput").value.trim();
  renderRecommend(q);
  renderPlaylists(q);
}

audio.volume = Number(volumeBar.value);
audio.addEventListener("play",updatePlayIcons);
audio.addEventListener("pause",updatePlayIcons);
audio.addEventListener("loadedmetadata",()=>{
  $("#durationTime").textContent = fmt(audio.duration);
  $("#sideDuration").textContent = fmt(audio.duration);
});
audio.addEventListener("timeupdate",()=>{
  const pct = audio.duration ? (audio.currentTime/audio.duration)*100 : 0;
  progressBar.value = pct;
  $("#sideProgressFill").style.width = pct+"%";
  $("#currentTime").textContent = fmt(audio.currentTime);
  $("#sideCurrent").textContent = fmt(audio.currentTime);
});
audio.addEventListener("ended",()=>{
  if(isRepeat){ audio.currentTime=0; audio.play(); }
  else nextTrack();
});
progressBar.addEventListener("input",()=>{
  if(audio.duration) audio.currentTime = Number(progressBar.value)/100 * audio.duration;
});
volumeBar.addEventListener("input",()=>audio.volume=Number(volumeBar.value));

[playBtn,sidePlay].forEach(b=>b.addEventListener("click",togglePlay));
["#nextBtn","#sideNext"].forEach(s=>$(s).addEventListener("click",nextTrack));
["#prevBtn","#sidePrev"].forEach(s=>$(s).addEventListener("click",prevTrack));
$("#heroPlay").addEventListener("click",()=>loadTrack(0,true));
$("#shuffleAll").addEventListener("click",()=>{isShuffle=true;nextTrack();toastMsg("已开启随机播放")});
$("#searchInput").addEventListener("input",searchAll);
document.addEventListener("keydown",e=>{
  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"){
    e.preventDefault();$("#searchInput").focus();
  }
  if(e.code==="Space" && document.activeElement.tagName!=="INPUT"){e.preventDefault();togglePlay();}
});

function toggleShuffle(){
  isShuffle=!isShuffle;
  ["#shuffleBtn","#sideShuffle"].forEach(s=>$(s).style.color=isShuffle?"#c4b5fd":"");
  toastMsg(isShuffle?"已开启随机播放":"已关闭随机播放");
}
function toggleRepeat(){
  isRepeat=!isRepeat;
  ["#repeatBtn","#sideRepeat"].forEach(s=>$(s).style.color=isRepeat?"#c4b5fd":"");
  toastMsg(isRepeat?"已开启单曲循环":"已关闭单曲循环");
}
["#shuffleBtn","#sideShuffle"].forEach(s=>$(s).addEventListener("click",toggleShuffle));
["#repeatBtn","#sideRepeat"].forEach(s=>$(s).addEventListener("click",toggleRepeat));

function toggleLike(){
  liked=!liked;
  $("#bottomHeart").textContent=liked?"♥":"♡";
  $("#heartBtn").style.color=liked?"#fb7185":"#aab2c1";
  toastMsg(liked?"已添加到我喜欢":"已取消收藏");
}
$("#bottomHeart").addEventListener("click",toggleLike);
$("#heartBtn").addEventListener("click",toggleLike);

$("#muteBtn").addEventListener("click",()=>{
  audio.muted=!audio.muted;
  $("#muteBtn").textContent=audio.muted?"×":"◖";
});
$("#queueToggle").addEventListener("click",()=>toastMsg("桌面端右侧为播放列表"));
$("#clearQueue").addEventListener("click",()=>{
  if(!tracks.length) return;
  tracks=[tracks[currentIndex]];
  currentIndex=0;
  renderRecommend($("#searchInput").value);
  renderQueue();
  toastMsg("已保留当前歌曲");
});
$("#newPlaylist").addEventListener("click",()=>toastMsg("已新建一个空歌单"));
document.querySelectorAll(".nav-item").forEach(btn=>{
  btn.addEventListener("click",()=>{
    document.querySelectorAll(".main-nav .nav-item").forEach(x=>x.classList.remove("active"));
    if(btn.closest(".main-nav")) btn.classList.add("active");
    if(btn.dataset.section) toastMsg(`已切换到：${btn.dataset.section}`);
  });
});
document.querySelectorAll("#genreTabs button").forEach(btn=>{
  btn.addEventListener("click",()=>{
    document.querySelectorAll("#genreTabs button").forEach(x=>x.classList.remove("active"));
    btn.classList.add("active");
    toastMsg(`流派：${btn.textContent}`);
  });
});
$("#filePicker").addEventListener("change",e=>{
  const files=[...e.target.files];
  if(!files.length) return;
  files.forEach((file,idx)=>{
    tracks.push({
      title:file.name.replace(/\.[^/.]+$/,"") ,
      artist:"本地音乐",
      src:URL.createObjectURL(file),
      cover:["cover-purple","cover-sunset","cover-blue"][idx%3],
      durationLabel:"本地",
      genre:"本地音乐",
      desc:"来自你的电脑"
    });
  });
  renderRecommend($("#searchInput").value);
  renderQueue();
  toastMsg(`已导入 ${files.length} 首本地音乐`);
});
loadTrack(0);
renderRecommend();
renderPlaylists();
renderQueue();
