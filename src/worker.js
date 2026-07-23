const MUSIC_PREFIX = "pine-music/";
const OVERRIDES_KEY = "meta-overrides.json";
const PLAYLISTS_KEY = "playlists.json";
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const AUDIO_EXTENSIONS = new Set(["mp3", "m4a", "wav", "ogg", "aac", "flac"]);
const LRC_UA = "PineMusic/1.0 (+https://pine-music-site.q306395528.workers.dev)";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function extensionOf(name) {
  return name.includes(".") ? name.split(".").pop().toLowerCase() : "";
}

function cleanFileName(name) {
  const cleaned = name
    .normalize("NFKC")
    .replace(/[\\/]/g, "-")
    .replace(/[^\p{L}\p{N}\s._()\-]+/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, 180);
}

function titleCase(value) {
  return value
    .trim()
    .split(/\s+/)
    .map((part) => part ? part.charAt(0).toUpperCase() + part.slice(1) : part)
    .join(" ");
}

function inferMetadata(fileName) {
  const stem = fileName.replace(/\.[^.]+$/, "").replace(/[_]+/g, " ").trim();
  const separator = stem.indexOf("-");
  if (separator > 0) {
    return {
      artist: titleCase(stem.slice(0, separator)),
      title: titleCase(stem.slice(separator + 1)),
    };
  }
  return { artist: "未知歌手", title: titleCase(stem) || "未命名歌曲" };
}

function encodePath(path) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function songFromObject(object) {
  const file = object.key.slice(MUSIC_PREFIX.length);
  const inferred = inferMetadata(file);
  const metadata = object.customMetadata || {};
  return {
    title: metadata.title || inferred.title,
    artist: metadata.artist || inferred.artist,
    genre: metadata.genre || "云端音乐",
    duration: metadata.duration || "--:--",
    cover: metadata.cover || "cover-purple",
    file,
    src: `/api/music/${encodePath(file)}`,
    size: object.size,
    uploaded: object.uploaded ? new Date(object.uploaded).toISOString() : null,
  };
}

async function listSongs(env) {
  const objects = [];
  let cursor;
  do {
    const page = await env.MUSIC_BUCKET.list({
      prefix: MUSIC_PREFIX,
      cursor,
      limit: 1000,
      include: ["httpMetadata", "customMetadata"],
    });
    objects.push(...page.objects);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);

  const overrides = await loadOverrides(env);
  return objects
    .filter((object) => AUDIO_EXTENSIONS.has(extensionOf(object.key)))
    .sort((a, b) => new Date(b.uploaded || 0) - new Date(a.uploaded || 0))
    .map(songFromObject)
    .map((song) => {
      const override = overrides[song.file];
      if (!override) return song;
      return {
        ...song,
        title: override.title || song.title,
        artist: override.artist || song.artist,
        manual: true,
      };
    });
}

// 手动修改的歌名/歌手存在一个独立的小 JSON 里（按文件名索引），不必重传音频
async function loadOverrides(env) {
  try {
    const object = await env.MUSIC_BUCKET.get(OVERRIDES_KEY);
    if (!object) return {};
    return JSON.parse(await object.text()) || {};
  } catch {
    return {};
  }
}

async function handleMeta(request, env) {
  if (!env.UPLOAD_PASSWORD) return json({ error: "尚未设置上传密码 UPLOAD_PASSWORD" }, 503);
  const password = request.headers.get("x-upload-password") || "";
  if (password !== env.UPLOAD_PASSWORD) return json({ error: "密码错误" }, 401);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "请求格式错误" }, 400);
  }
  const file = String(body.file || "").trim();
  const title = String(body.title || "").trim().slice(0, 120);
  const artist = String(body.artist || "").trim().slice(0, 120);
  if (!file || !title) return json({ error: "歌名不能为空" }, 400);
  const overrides = await loadOverrides(env);
  overrides[file] = { title, artist };
  await env.MUSIC_BUCKET.put(OVERRIDES_KEY, JSON.stringify(overrides), {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
  });
  return json({ success: true });
}

async function loadPlaylists(env) {
  try {
    const object = await env.MUSIC_BUCKET.get(PLAYLISTS_KEY);
    if (!object) return [];
    const data = JSON.parse(await object.text());
    return Array.isArray(data) ? data : (Array.isArray(data.playlists) ? data.playlists : []);
  } catch {
    return [];
  }
}

async function handlePlaylistsSave(request, env) {
  if (!env.UPLOAD_PASSWORD) return json({ error: "尚未设置上传密码 UPLOAD_PASSWORD" }, 503);
  const password = request.headers.get("x-upload-password") || "";
  if (password !== env.UPLOAD_PASSWORD) return json({ error: "密码错误" }, 401);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "请求格式错误" }, 400);
  }
  const input = Array.isArray(body.playlists) ? body.playlists : [];
  const clean = input.slice(0, 200).map((p) => ({
    id: String(p && p.id || "").slice(0, 40),
    name: String(p && p.name || "歌单").slice(0, 60),
    files: Array.isArray(p && p.files) ? p.files.slice(0, 3000).map((f) => String(f).slice(0, 300)) : [],
    created: Number(p && p.created) || Date.now(),
  })).filter((p) => p.id && p.name);
  await env.MUSIC_BUCKET.put(PLAYLISTS_KEY, JSON.stringify(clean), {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
  });
  return json({ success: true, playlists: clean });
}

async function handleUpload(request, env) {
  if (!env.UPLOAD_PASSWORD) {
    return json({ error: "尚未设置上传密码 UPLOAD_PASSWORD" }, 503);
  }

  const form = await request.formData();
  const password = request.headers.get("x-upload-password") || String(form.get("password") || "");
  if (password !== env.UPLOAD_PASSWORD) {
    return json({ error: "上传密码错误" }, 401);
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return json({ error: "没有选择音乐文件" }, 400);
  }
  if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
    return json({ error: "单个文件必须小于 50MB" }, 413);
  }

  const fileName = cleanFileName(file.name);
  const ext = extensionOf(fileName);
  if (!fileName || !AUDIO_EXTENSIONS.has(ext)) {
    return json({ error: "仅支持 MP3、M4A、WAV、OGG、AAC、FLAC" }, 415);
  }

  const inferred = inferMetadata(fileName);
  const title = String(form.get("title") || inferred.title).trim().slice(0, 120);
  const artist = String(form.get("artist") || inferred.artist).trim().slice(0, 120);
  const genre = String(form.get("genre") || "云端音乐").trim().slice(0, 50);
  const duration = String(form.get("duration") || "--:--").trim().slice(0, 20);
  const cover = String(form.get("cover") || "cover-purple").trim().slice(0, 40);
  const key = `${MUSIC_PREFIX}${fileName}`;

  await env.MUSIC_BUCKET.put(key, file.stream(), {
    httpMetadata: {
      contentType: file.type || "audio/mpeg",
      cacheControl: "public, max-age=3600",
    },
    customMetadata: { title, artist, genre, duration, cover },
  });

  const object = await env.MUSIC_BUCKET.head(key);
  return json({ success: true, song: songFromObject(object) }, 201);
}

async function handleMusic(request, env, pathname) {
  let file;
  try {
    file = decodeURIComponent(pathname.slice("/api/music/".length));
  } catch {
    return json({ error: "文件路径无效" }, 400);
  }
  if (!file || file.includes("..") || file.startsWith("/")) {
    return json({ error: "文件路径无效" }, 400);
  }

  const key = `${MUSIC_PREFIX}${file}`;
  const rangeHeader = request.headers.get("range");
  const object = await env.MUSIC_BUCKET.get(
    key,
    rangeHeader ? { range: request.headers } : undefined,
  );
  if (!object) return json({ error: "音乐不存在" }, 404);

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("accept-ranges", "bytes");
  headers.set("cache-control", "public, max-age=3600");

  let status = 200;
  if (object.range && "offset" in object.range && "length" in object.range) {
    const start = object.range.offset;
    const end = start + object.range.length - 1;
    headers.set("content-range", `bytes ${start}-${end}/${object.size}`);
    headers.set("content-length", String(object.range.length));
    status = 206;
  } else {
    headers.set("content-length", String(object.size));
  }

  return new Response(request.method === "HEAD" ? null : object.body, { status, headers });
}

// iTunes 从 Worker 出口被限流（429），Deezer 对数据中心 IP 清空数据，
// 唯有 MusicBrainz 可从 Worker 稳定访问；它的配图在 CoverArtArchive 上，
// 浏览器能直接加载。这里用 MB 拿到候选 release，返回若干 CAA 封面地址，
// 由浏览器逐个尝试（没有配图的会 404，跳过即可）。
async function mbJson(path) {
  try {
    const res = await fetch(`https://musicbrainz.org/ws/2/${path}`, {
      headers: { accept: "application/json", "user-agent": LRC_UA },
      cf: { cacheTtl: 604800, cacheEverything: true },
    });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

async function handleCover(url) {
  const artist = (url.searchParams.get("artist") || "").trim();
  const title = (url.searchParams.get("title") || "").trim();
  if (!title) return json({ cover: null, candidates: [] });
  const artistClause = artist ? ` AND artist:"${artist}"` : "";
  try {
    // 并行查专辑组(release-group)和录音(recording)。release-group 的 front 命中率更高，排前面。
    const [rgData, recData] = await Promise.all([
      mbJson(`release-group/?query=${encodeURIComponent(`releasegroup:"${title}"${artistClause}`)}&fmt=json&limit=8`),
      mbJson(`recording/?query=${encodeURIComponent(`recording:"${title}"${artistClause}`)}&fmt=json&limit=8`),
    ]);
    const rgCandidates = [...new Set((rgData && rgData["release-groups"] || []).map((g) => g.id).filter(Boolean))]
      .slice(0, 8).map((id) => `https://coverartarchive.org/release-group/${id}/front-500`);
    const relIds = [];
    for (const rec of (recData && recData.recordings) || []) {
      for (const rel of rec.releases || []) if (rel && rel.id) relIds.push(rel.id);
    }
    const relCandidates = [...new Set(relIds)].slice(0, 12)
      .map((id) => `https://coverartarchive.org/release/${id}/front-500`);
    const candidates = [...rgCandidates, ...relCandidates];
    return json({ cover: candidates[0] || null, candidates });
  } catch {
    return json({ cover: null, candidates: [] });
  }
}

async function handleLyrics(url) {
  const artist = (url.searchParams.get("artist") || "").trim();
  const title = (url.searchParams.get("title") || "").trim();
  if (!title) return json({ synced: "", plain: "" });
  const query = encodeURIComponent(`${title} ${artist}`.trim());
  try {
    const res = await fetch(`https://lrclib.net/api/search?q=${query}`, {
      headers: { accept: "application/json", "user-agent": LRC_UA },
      cf: { cacheTtl: 604800, cacheEverything: true },
    });
    if (!res.ok) return json({ synced: "", plain: "" });
    const list = await res.json();
    if (!Array.isArray(list) || !list.length) return json({ synced: "", plain: "" });
    const withSync = list.find((item) => item && item.syncedLyrics);
    const withPlain = list.find((item) => item && item.plainLyrics);
    return json({
      synced: (withSync && withSync.syncedLyrics) || "",
      plain: (withSync && withSync.plainLyrics) || (withPlain && withPlain.plainLyrics) || "",
    });
  } catch {
    return json({ synced: "", plain: "" });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/status" && request.method === "GET") {
      return json({
        ok: true,
        uploadPasswordConfigured: Boolean(env.UPLOAD_PASSWORD),
        musicBucketConfigured: Boolean(env.MUSIC_BUCKET),
      });
    }
    if (url.pathname === "/api/songs" && request.method === "GET") {
      return json({ songs: await listSongs(env) });
    }
    if (url.pathname === "/api/cover" && request.method === "GET") {
      return handleCover(url);
    }
    if (url.pathname === "/api/lyrics" && request.method === "GET") {
      return handleLyrics(url);
    }
    if (url.pathname === "/api/upload" && request.method === "POST") {
      return handleUpload(request, env);
    }
    if (url.pathname === "/api/meta" && request.method === "POST") {
      return handleMeta(request, env);
    }
    if (url.pathname === "/api/playlists" && request.method === "GET") {
      return json({ playlists: await loadPlaylists(env) });
    }
    if (url.pathname === "/api/playlists" && request.method === "POST") {
      return handlePlaylistsSave(request, env);
    }
    if (url.pathname.startsWith("/api/music/") && ["GET", "HEAD"].includes(request.method)) {
      return handleMusic(request, env, url.pathname);
    }
    if (url.pathname.startsWith("/api/")) {
      return json({ error: "接口不存在" }, 404);
    }

    // HTML 不缓存，否则用户拿到旧页面、里面的资源版本号也就永远更新不了；
    // JS/CSS 靠 ?v= 版本号做缓存失效，可以放心长缓存。
    const response = await env.ASSETS.fetch(request);
    const type = response.headers.get("content-type") || "";
    const headers = new Headers(response.headers);
    if (type.includes("text/html")) {
      headers.set("cache-control", "no-store");
    } else if (url.searchParams.has("v")) {
      headers.set("cache-control", "public, max-age=31536000, immutable");
    }
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  },
};
