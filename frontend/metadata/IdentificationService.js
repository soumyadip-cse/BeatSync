import { readMediaMetadata } from "./MetadataReader.js";
import { createAudioFingerprint } from "./FingerprintProvider.js";
import { AcoustIdService } from "./AcoustIdService.js";
import { LrcLibService } from "./LrcLibService.js";
import { MusicBrainzService } from "./MusicBrainzService.js";

export class IdentificationService {
  constructor({ lyrics = new LrcLibService(), acoustId = new AcoustIdService(), musicBrainz = new MusicBrainzService(), fingerprint = createAudioFingerprint } = {}) {
    this.lyrics = lyrics;
    this.acoustId = acoustId;
    this.musicBrainz = musicBrainz;
    this.fingerprint = fingerprint;
    this.cache = new Map();
  }

  async identify(track, { signal, onState = () => {} } = {}) {
    const key = String(track.id) + ":" + track.file.name + ":" + track.file.size + ":" + Math.round(track.duration || 0);
    if (this.cache.has(key)) return this.cache.get(key);
    onState({ state: "IDENTIFYING", message: "Reading local media tags…" });

    let metadata = await readMediaMetadata(track.file, track.duration);
    track.metadata = metadata;
    let lyricResult = { state: "NO_MATCH", record: null, reason: "No lyrics searched yet." };
    if (metadata.title && metadata.artist) {
      onState({ state: "IDENTIFYING", message: "Checking LRCLIB for matching lyrics…" });
      lyricResult = await this.lyrics.lookup(metadata, { signal });
      if (lyricResult.state === "FOUND") {
        const result = { state: "IDENTIFIED", metadata, lyrics: lyricResult, message: "File metadata matched an LRCLIB entry." };
        this.cache.set(key, result);
        return result;
      }
    }

    const fingerprint = await this.fingerprint(track.file, { signal }).catch((error) => {
      if (error?.name === "AbortError") throw error;
      return { available: false, reason: error?.message || "Fingerprint could not be generated." };
    });
    if (!fingerprint.available) {
      const hasTags = Boolean(metadata.title && metadata.artist);
      const state = lyricResult.state === "UNAVAILABLE" ? "UNAVAILABLE" : hasTags ? "IDENTIFIED" : "NO_MATCH";
      const message = lyricResult.state === "UNAVAILABLE"
        ? lyricResult.reason
        : hasTags
          ? "Using local " + metadata.source + " metadata. " + lyricResult.reason
          : "No title/artist tags were found. " + fingerprint.reason;
      const result = { state, metadata, lyrics: lyricResult, message };
      this.cache.set(key, result);
      return result;
    }

    onState({ state: "IDENTIFYING", message: "Matching audio fingerprint with AcoustID…" });
    try {
      const lookup = await this.acoustId.lookup(fingerprint, { signal });
      if (!lookup.match) {
        const result = { state: lookup.state, metadata, lyrics: lyricResult, message: lookup.reason };
        this.cache.set(key, result);
        return result;
      }
      const resolved = await this.musicBrainz.recording(lookup.match.recordingId, { signal });
      metadata = { ...metadata, ...resolved, source: "MusicBrainz via AcoustID", confidence: lookup.match.score };
      track.metadata = metadata;
      onState({ state: "IDENTIFIED", message: "Identified with " + Math.round(lookup.match.score * 100) + "% AcoustID confidence." });
      lyricResult = await this.lyrics.lookup(metadata, { signal });
      const result = {
        state: "IDENTIFIED",
        metadata,
        lyrics: lyricResult,
        message: lyricResult.state === "FOUND" ? "Fingerprint match and lyrics found." : "Fingerprint match; no lyrics found.",
      };
      this.cache.set(key, result);
      return result;
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      return { state: "UNAVAILABLE", metadata, lyrics: lyricResult, message: error?.message || "Song identification service unavailable." };
    }
  }
}
