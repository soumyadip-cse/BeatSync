export class MusicBrainzService {
  constructor({ fetchImpl = fetch, endpoint = "/api/musicbrainz/recording" } = {}) {
    this.fetchImpl = fetchImpl;
    this.endpoint = endpoint;
    this.cache = new Map();
  }

  async recording(recordingId, { signal } = {}) {
    if (!/^[0-9a-f-]{36}$/i.test(String(recordingId || ""))) {
      throw new TypeError("A valid MusicBrainz recording ID is required.");
    }
    if (this.cache.has(recordingId)) return this.cache.get(recordingId);
    const response = await this.fetchImpl(this.endpoint + "/" + encodeURIComponent(recordingId), { signal });
    if (!response.ok) throw new Error("MusicBrainz metadata lookup returned HTTP " + response.status + ".");
    const data = await response.json();
    const metadata = {
      title: data.title || "",
      artist: data["artist-credit"]?.map((credit) => credit.name || credit.artist?.name).filter(Boolean).join(", ") || "",
      album: data.releases?.[0]?.title || "",
      duration: Number.isFinite(data.length) ? data.length / 1000 : null,
      recordingId,
      source: "MusicBrainz",
    };
    this.cache.set(recordingId, metadata);
    while (this.cache.size > 500) this.cache.delete(this.cache.keys().next().value);
    return metadata;
  }
}
