function normalized(value) {
  return String(value || "").normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function scoreResult(candidate, metadata) {
  const title = normalized(candidate.trackName || candidate.name);
  const artist = normalized(candidate.artistName);
  const targetTitle = normalized(metadata.title);
  const targetArtist = normalized(metadata.artist);
  let score = 0;
  if (title && title === targetTitle) score += 0.62;
  else if (title && targetTitle && (title.includes(targetTitle) || targetTitle.includes(title))) score += 0.3;
  if (artist && artist === targetArtist) score += 0.38;
  else if (artist && targetArtist && (artist.includes(targetArtist) || targetArtist.includes(artist))) score += 0.18;
  if (metadata.album && normalized(candidate.albumName) === normalized(metadata.album)) score += 0.08;
  if (Number.isFinite(metadata.duration) && Number.isFinite(candidate.duration)) {
    if (Math.abs(metadata.duration - candidate.duration) <= 2) score += 0.08;
    else if (Math.abs(metadata.duration - candidate.duration) > 8) score -= 0.2;
  }
  return Math.max(0, Math.min(1, score));
}

export function selectLyricsMatch(results, metadata) {
  if (!Array.isArray(results) || !results.length) return null;
  const ranked = results
    .map((record) => ({ record, score: scoreResult(record, metadata) }))
    .sort((a, b) => b.score - a.score);
  return ranked[0].score >= 0.78 ? ranked[0].record : null;
}

export class LrcLibService {
  constructor({ fetchImpl = fetch, basePath = "/api/lyrics" } = {}) {
    this.fetchImpl = fetchImpl;
    this.basePath = basePath;
    this.cache = new Map();
    this.nextRequestAt = 0;
  }

  async lookup(metadata, { signal } = {}) {
    if (!metadata?.title || !metadata?.artist) return { state: "NO_MATCH", record: null, reason: "Title and artist are needed for lyric search." };
    const key = [metadata.title, metadata.artist, metadata.album, metadata.duration || ""].join("|").toLocaleLowerCase();
    if (this.cache.has(key)) return this.cache.get(key);

    const params = new URLSearchParams({
      track_name: metadata.title,
      artist_name: metadata.artist,
    });
    if (metadata.album) params.set("album_name", metadata.album);
    if (Number.isFinite(metadata.duration)) params.set("duration", String(Math.round(metadata.duration)));

    try {
      let response = await this._request(this.basePath + "/lookup?" + params, signal);
      if (response.status === 404 && params.has("duration")) {
        params.delete("duration");
        response = await this._request(this.basePath + "/lookup?" + params, signal);
      }

      let record = response.ok ? await response.json() : null;
      if (Array.isArray(record)) record = selectLyricsMatch(record, metadata);
      if (!record && (response.status === 404 || response.ok)) {
        const search = new URLSearchParams({ track_name: metadata.title, artist_name: metadata.artist });
        if (metadata.album) search.set("album_name", metadata.album);
        const searchResponse = await this._request(this.basePath + "/search?" + search, signal);
        if (searchResponse.status === 429) return { state: "UNAVAILABLE", record: null, reason: "LRCLIB rate limit reached. Try again later." };
        if (searchResponse.ok) record = selectLyricsMatch(await searchResponse.json(), metadata);
      }

      if (!record) {
        const result = response.status === 429
          ? { state: "UNAVAILABLE", record: null, reason: "LRCLIB rate limit reached. Try again later." }
          : { state: "NO_MATCH", record: null, reason: "No matching LRCLIB entry was found." };
        this._cacheResult(key, result);
        return result;
      }

      const result = {
        state: "FOUND",
        record,
        syncedLyrics: record.syncedLyrics || "",
        plainLyrics: record.plainLyrics || "",
        source: "LRCLIB",
      };
      this._cacheResult(key, result);
      return result;
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      return { state: "UNAVAILABLE", record: null, reason: error?.message || "Lyrics service unavailable." };
    }
  }

  async _request(url, signal) {
    if (signal?.aborted) throw signal.reason || new DOMException("Aborted", "AbortError");
    const now = Date.now();
    const requestAt = Math.max(now, this.nextRequestAt);
    this.nextRequestAt = requestAt + 300;
    const delay = requestAt - now;
    if (delay) await new Promise((resolve, reject) => {
      const finish = () => {
        signal?.removeEventListener("abort", abort);
        resolve();
      };
      const abort = () => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
        reject(signal.reason || new DOMException("Aborted", "AbortError"));
      };
      const timer = setTimeout(finish, delay);
      signal?.addEventListener("abort", abort, { once: true });
    });
    return this.fetchImpl(url, { signal, headers: { Accept: "application/json" } });
  }

  _cacheResult(key, value) {
    this.cache.set(key, value);
    while (this.cache.size > 200) this.cache.delete(this.cache.keys().next().value);
  }
}
