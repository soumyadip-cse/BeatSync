import { createServer } from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT || 8000);
const ALLOWED_STATIC_ROOTS = new Set(["frontend", "assets", "experiments"]);
const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};
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

try {
  const envText = await fs.readFile(path.join(ROOT, ".env"), "utf8");
  for (const line of envText.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
} catch {
  // A local .env is optional; AcoustID remains clearly unavailable without it.
}

function sendJson(response, status, value, headers = {}) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers });
  response.end(JSON.stringify(value));
}

function cachePut(key, value, max = 500) {
  memoryCache.set(key, value);
  while (memoryCache.size > max) memoryCache.delete(memoryCache.keys().next().value);
}

async function readJson(request, limit = 2 * 1024 * 1024) {
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

async function handleLyrics(url, response) {
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
    sendJson(response, 400, { message: "track_name and artist_name are required." });
    return;
  }
  if (action === "search" && !params.has("track_name") && !params.has("q")) {
    sendJson(response, 400, { message: "track_name or q is required." });
    return;
  }

  const cacheKey = "lyrics:" + action + ":" + params.toString();
  const cached = memoryCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    sendJson(response, cached.status, cached.body);
    return;
  }

  try {
    const upstreamUrl = "https://lrclib.net/api/" + (action === "lookup" ? "get" : "search") + "?" + params;
    const { response: upstream, body } = await fetchJson(upstreamUrl, {
      headers: { Accept: "application/json", "User-Agent": "BeatSync/0.2 (local metadata lookup)" },
    });
    if (upstream.status === 429) {
      sendJson(response, 429, body || { message: "LRCLIB rate limit reached." }, { "Retry-After": upstream.headers.get("retry-after") || "30" });
      return;
    }
    if (upstream.ok || upstream.status === 404) {
      cachePut(cacheKey, { status: upstream.status, body, expiresAt: Date.now() + (upstream.status === 404 ? 30 * 60_000 : 6 * 60 * 60_000) });
    }
    sendJson(response, upstream.status, body);
  } catch (error) {
    sendJson(response, 502, { message: error.message || "LRCLIB request failed." });
  }
}

async function handleAcoustId(request, response) {
  const key = process.env.ACOUSTID_CLIENT_KEY || "";
  if (!key.trim()) {
    sendJson(response, 503, { message: "ACOUSTID_CLIENT_KEY is not configured in the local .env file." });
    return;
  }
  let input;
  try { input = await readJson(request); } catch (error) {
    sendJson(response, error.statusCode || 400, { message: error.message || "Invalid JSON request." });
    return;
  }
  const duration = Math.round(Number(input.duration));
  const fingerprint = String(input.fingerprint || "");
  if (!Number.isFinite(duration) || duration <= 0 || !fingerprint || fingerprint.length > 100_000) {
    sendJson(response, 400, { message: "A valid audio duration and fingerprint are required." });
    return;
  }

  const cacheKey = "acoustid:" + duration + ":" + fingerprint;
  const cached = memoryCache.get(cacheKey);
  if (cached) {
    sendJson(response, 200, cached);
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
      sendJson(response, 429, result || { message: "AcoustID rate limit reached." }, { "Retry-After": upstream.headers.get("retry-after") || "30" });
      return;
    }
    if (!upstream.ok || result?.status !== "ok") {
      sendJson(response, 502, { message: "AcoustID returned an unsuccessful lookup." });
      return;
    }
    cachePut(cacheKey, result, 100);
    sendJson(response, 200, result);
  } catch (error) {
    sendJson(response, 502, { message: error.message || "AcoustID request failed." });
  }
}

async function handleMusicBrainz(recordingId, response) {
  if (!/^[0-9a-f-]{36}$/i.test(recordingId)) {
    sendJson(response, 400, { message: "Invalid MusicBrainz recording ID." });
    return;
  }
  const cacheKey = "musicbrainz:" + recordingId;
  const cached = memoryCache.get(cacheKey);
  if (cached) {
    sendJson(response, 200, cached);
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
      sendJson(response, 503, { message: "MusicBrainz is temporarily rate limiting this lookup." }, { "Retry-After": upstream.headers.get("retry-after") || "1" });
      return;
    }
    if (upstream.ok || upstream.status === 404) cachePut(cacheKey, body, 500);
    sendJson(response, upstream.status, body);
  } catch (error) {
    sendJson(response, 502, { message: error.message || "MusicBrainz request failed." });
  }
}

async function serveStatic(pathname, response, method = "GET") {
  let relative;
  try { relative = decodeURIComponent(pathname); } catch {
    sendJson(response, 400, { message: "Invalid URL encoding." });
    return;
  }
  if (relative === "/") {
    response.writeHead(302, { Location: "/frontend/" });
    response.end();
    return;
  }
  const segments = relative.replace(/^\/+/, "").split(/[\\/]/);
  if (segments.some((item) => item.startsWith("."))) {
    sendJson(response, 404, { message: "Not found." });
    return;
  }
  let filePath;
  if (ALLOWED_STATIC_ROOTS.has(segments[0])) {
    filePath = path.resolve(ROOT, ...segments);
  } else {
    filePath = path.resolve(ROOT, "frontend", ...segments);
  }
  if (!filePath.startsWith(ROOT + path.sep)) {
    sendJson(response, 403, { message: "Forbidden." });
    return;
  }
  try {
    const stat = await fs.stat(filePath);
    if (stat.isDirectory()) filePath = path.join(filePath, "index.html");
    const data = await fs.readFile(filePath);
    response.writeHead(200, {
      "Content-Type": CONTENT_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(method === "HEAD" ? undefined : data);
  } catch {
    if (response.headersSent) {
      response.destroy();
      return;
    }
    sendJson(response, 404, { message: "Not found." });
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, "http://127.0.0.1");
  if (request.method === "GET" && url.pathname.startsWith("/api/lyrics/")) {
    await handleLyrics(url, response);
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/acoustid/lookup") {
    await handleAcoustId(request, response);
    return;
  }
  if (request.method === "GET" && url.pathname.startsWith("/api/musicbrainz/recording/")) {
    await handleMusicBrainz(url.pathname.split("/").at(-1), response);
    return;
  }
  if (request.method === "GET" || request.method === "HEAD") {
    await serveStatic(url.pathname, response, request.method);
    return;
  }
  sendJson(response, 405, { message: "Method not allowed." }, { Allow: "GET, HEAD, POST" });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("BeatSync local app: http://localhost:" + PORT + "/");
  console.log("AcoustID configuration: " + (process.env.ACOUSTID_CLIENT_KEY ? "loaded" : "not set; fingerprint lookup unavailable"));
});
