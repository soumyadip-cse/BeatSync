const memoryCache = new Map();
let nextMusicBrainzRequestAt = 0;
let nextAcoustIdRequestAt = 0;

async function waitForRateSlot(kind, intervalMs) {
  const now = Date.now();
  const nextAt = kind === "musicbrainz" ? nextMusicBrainzRequestAt : nextAcoustIdRequestAt;
  const slotAt = Math.max(now, nextAt);
  if (kind === "musicbrainz") nextMusicBrainzRequestAt = slotAt + intervalMs;
  else nextAcoustIdRequestAt = slotAt + intervalMs;
  const delay = slotAt - now;
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
}

function sendJson(res, status, value, headers = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    ...headers,
  });
  res.end(JSON.stringify(value));
}

function cachePut(key, value, max = 500) {
  memoryCache.set(key, value);
  while (memoryCache.size > max) memoryCache.delete(memoryCache.keys().next().value);
}

async function readJson(request, limit = 2 * 1024 * 1024) {
  if (request.body && typeof request.body === "object") return request.body;
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > limit) throw Object.assign(new Error("Request body is too large."), { statusCode: 413 });
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, { ...options, signal: options.signal || AbortSignal.timeout(12000) });
  const bodyText = await response.text();
  let body;
  try { body = bodyText ? JSON.parse(bodyText) : null; } catch { body = { message: "Upstream returned an invalid JSON response." }; }
  return { response, body };
}

async function handleLyrics(url, res) {
  const action = url.pathname.endsWith("/search") ? "search" : "lookup";
  const params = new URLSearchParams();
  const allowed = action === "lookup"
    ? ["track_name", "artist_name", "album_name", "duration"]
    : ["track_name", "artist_name", "album_name", "q"];
  for (const key of allowed) {
    const value = url.searchParams.get(key);
    if (value && value.length <= 200) params.set(key, value);
  }
  if (action === "lookup" && (!params.has("track_name") || !params.has("artist_name"))) {
    sendJson(res, 400, { message: "track_name and artist_name are required." });
    return;
  }
  if (action === "search" && !params.has("track_name") && !params.has("q")) {
    sendJson(res, 400, { message: "track_name or q is required." });
    return;
  }

  const cacheKey = "lyrics:" + action + ":" + params.toString();
  const cached = memoryCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    sendJson(res, cached.status, cached.body);
    return;
  }

  try {
    const upstreamUrl = "https://lrclib.net/api/" + (action === "lookup" ? "get" : "search") + "?" + params;
    const { response: upstream, body } = await fetchJson(upstreamUrl, {
      headers: { Accept: "application/json", "User-Agent": "BeatSync/0.2 (local metadata lookup)" },
    });
    if (upstream.status === 429) {
      sendJson(res, 429, body || { message: "LRCLIB rate limit reached." }, { "Retry-After": upstream.headers.get("retry-after") || "30" });
      return;
    }
    if (upstream.ok || upstream.status === 404) {
      cachePut(cacheKey, { status: upstream.status, body, expiresAt: Date.now() + (upstream.status === 404 ? 30 * 60_000 : 6 * 60 * 60_000) });
    }
    sendJson(res, upstream.status, body);
  } catch (error) {
    sendJson(res, 502, { message: error.message || "LRCLIB request failed." });
  }
}

async function handleAcoustId(req, res) {
  const key = process.env.ACOUSTID_CLIENT_KEY || "";
  if (!key.trim()) {
    sendJson(res, 503, { message: "ACOUSTID_CLIENT_KEY is not configured in server environment." });
    return;
  }
  let input;
  try { input = await readJson(req); } catch (error) {
    sendJson(res, error.statusCode || 400, { message: error.message || "Invalid JSON request." });
    return;
  }
  const duration = Math.round(Number(input.duration));
  const fingerprint = String(input.fingerprint || "");
  if (!Number.isFinite(duration) || duration <= 0 || !fingerprint || fingerprint.length > 100_000) {
    sendJson(res, 400, { message: "A valid audio duration and fingerprint are required." });
    return;
  }

  const cacheKey = "acoustid:" + duration + ":" + fingerprint;
  const cached = memoryCache.get(cacheKey);
  if (cached) {
    sendJson(res, 200, cached);
    return;
  }
  try {
    await waitForRateSlot("acoustid", 350);
    const body = new URLSearchParams({
      client: key.trim(),
      duration: String(duration),
      fingerprint,
      meta: "recordings",
      format: "json",
    });
    const { response: upstream, body: result } = await fetchJson("https://api.acoustid.org/v2/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body,
    });
    if (upstream.status === 429) {
      sendJson(res, 429, result || { message: "AcoustID rate limit reached." }, { "Retry-After": upstream.headers.get("retry-after") || "30" });
      return;
    }
    if (!upstream.ok || result?.status !== "ok") {
      sendJson(res, 502, { message: "AcoustID returned an unsuccessful lookup." });
      return;
    }
    cachePut(cacheKey, result, 100);
    sendJson(res, 200, result);
  } catch (error) {
    sendJson(res, 502, { message: error.message || "AcoustID request failed." });
  }
}

async function handleMusicBrainz(recordingId, res) {
  if (!/^[0-9a-f-]{36}$/i.test(recordingId)) {
    sendJson(res, 400, { message: "Invalid MusicBrainz recording ID." });
    return;
  }
  const cacheKey = "musicbrainz:" + recordingId;
  const cached = memoryCache.get(cacheKey);
  if (cached) {
    sendJson(res, 200, cached);
    return;
  }
  try {
    await waitForRateSlot("musicbrainz", 1100);
    const upstreamUrl = "https://musicbrainz.org/ws/2/recording/" + recordingId + "?fmt=json&inc=artists+releases";
    const { response: upstream, body } = await fetchJson(upstreamUrl, {
      headers: {
        Accept: "application/json",
        "User-Agent": "BeatSync/0.2 (local metadata relay)",
      },
    });
    if (upstream.status === 503) {
      sendJson(res, 503, { message: "MusicBrainz is temporarily rate limiting this lookup." }, { "Retry-After": upstream.headers.get("retry-after") || "1" });
      return;
    }
    if (upstream.ok || upstream.status === 404) cachePut(cacheKey, body, 500);
    sendJson(res, upstream.status, body);
  } catch (error) {
    sendJson(res, 502, { message: error.message || "MusicBrainz request failed." });
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, "http://127.0.0.1");
  if (req.method === "GET" && url.pathname.includes("/api/lyrics/")) {
    await handleLyrics(url, res);
    return;
  }
  if (req.method === "POST" && url.pathname.includes("/api/acoustid/lookup")) {
    await handleAcoustId(req, res);
    return;
  }
  if (req.method === "GET" && url.pathname.includes("/api/musicbrainz/recording/")) {
    const recordingId = url.pathname.split("/").filter(Boolean).pop();
    await handleMusicBrainz(recordingId, res);
    return;
  }

  sendJson(res, 404, { message: "API route not found." });
}
