export function bestAcoustIdMatch(payload, minimumScore = 0.8) {
  if (payload?.status !== "ok" || !Array.isArray(payload.results)) return null;
  const results = payload.results
    .filter((item) => Number(item.score) >= minimumScore)
    .sort((a, b) => Number(b.score) - Number(a.score));
  const match = results[0];
  const recording = match?.recordings?.[0];
  if (!match || !recording?.id) return null;
  return {
    score: Number(match.score),
    recordingId: recording.id,
    title: recording.title || "",
    artist: recording.artists?.map((item) => item.name).filter(Boolean).join(", ") || "",
    album: recording.releases?.[0]?.title || "",
  };
}

export class AcoustIdService {
  constructor({ fetchImpl = fetch, endpoint = "/api/acoustid/lookup" } = {}) {
    this.fetchImpl = fetchImpl;
    this.endpoint = endpoint;
  }

  async lookup({ fingerprint, durationSeconds }, { signal } = {}) {
    const response = await this.fetchImpl(this.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ fingerprint, duration: Math.round(durationSeconds) }),
      signal,
    });
    if (response.status === 503) return { state: "UNAVAILABLE", match: null, reason: "AcoustID is not configured on the local server." };
    if (response.status === 429) return { state: "UNAVAILABLE", match: null, reason: "AcoustID rate limit reached." };
    if (!response.ok) throw new Error("AcoustID lookup returned HTTP " + response.status + ".");
    const payload = await response.json();
    const match = bestAcoustIdMatch(payload);
    return match
      ? { state: "IDENTIFIED", match }
      : { state: "NO_MATCH", match: null, reason: "No confident AcoustID match was returned." };
  }
}

