import test from "node:test";
import assert from "node:assert/strict";
import { parseLrc, lyricIndexAt } from "../lyrics/LrcLyrics.js";
import { parseFilenameMetadata, readMediaMetadata } from "../metadata/MetadataReader.js";
import { LrcLibService, selectLyricsMatch } from "../metadata/LrcLibService.js";
import { bestAcoustIdMatch } from "../metadata/AcoustIdService.js";
import { MusicBrainzService } from "../metadata/MusicBrainzService.js";
import { TEST_CATALOG } from "../library/catalog.js";

test("LRC parser supports multiple timestamps, offset, and playback lookup", () => {
  const cues = parseLrc("[offset:-100]\n[00:01.20][00:02.50]First line\n[00:03.000]Second line");
  assert.deepEqual(cues.map((cue) => Number(cue.time.toFixed(2))), [1.1, 2.4, 2.9]);
  assert.equal(lyricIndexAt(cues, 2.6), 1);
  assert.equal(lyricIndexAt(cues, 0.9), -1);
  assert.throws(() => parseLrc("plain text without timestamps"), /No timed lyric lines/);
});

test("media metadata prefers ID3 tags and falls back to a filename", async () => {
  assert.deepEqual(parseFilenameMetadata("The Artist - The Song.mp3"), { title: "The Song", artist: "The Artist", album: "" });
  const payload = new Uint8Array([3, ...new TextEncoder().encode("BeatSync demo")]);
  const frame = new Uint8Array(10 + payload.length);
  frame.set(new TextEncoder().encode("TIT2"), 0);
  new DataView(frame.buffer).setUint32(4, payload.length);
  frame.set(payload, 10);
  const tagSize = frame.length;
  const syncSafe = [(tagSize >> 21) & 127, (tagSize >> 14) & 127, (tagSize >> 7) & 127, tagSize & 127];
  const fileBytes = new Uint8Array(10 + tagSize);
  fileBytes.set(new TextEncoder().encode("ID3"), 0);
  fileBytes[3] = 3;
  fileBytes.set(syncSafe, 6);
  fileBytes.set(frame, 10);
  const file = new Blob([fileBytes], { type: "audio/mpeg" });
  Object.defineProperty(file, "name", { value: "Artist - filename.mp3" });
  const metadata = await readMediaMetadata(file, 123.4);
  assert.equal(metadata.title, "BeatSync demo");
  assert.equal(metadata.artist, "Artist");
  assert.equal(metadata.duration, 123.4);
  assert.equal(metadata.source, "ID3 + filename");
});

test("lyrics results require a high-confidence title and artist match", () => {
  const metadata = { title: "Blinding Lights", artist: "The Weeknd", duration: 200 };
  assert.equal(selectLyricsMatch([{ trackName: "Blinding Lights", artistName: "The Weeknd", duration: 200 }], metadata)?.trackName, "Blinding Lights");
  assert.equal(selectLyricsMatch([{ trackName: "Blinding Lights", artistName: "Different Artist", duration: 200 }], metadata), null);
});

test("LRCLIB service handles synced lyrics, no match, and network failure", async () => {
  const metadata = { title: "Song", artist: "Artist", duration: 180 };
  const success = new LrcLibService({ fetchImpl: async () => new Response(JSON.stringify({
    trackName: "Song", artistName: "Artist", duration: 180,
    syncedLyrics: "[00:01.00]Hello", plainLyrics: "Hello",
  }), { status: 200 }) });
  const found = await success.lookup(metadata);
  assert.equal(found.state, "FOUND");
  assert.equal(found.syncedLyrics, "[00:01.00]Hello");

  let call = 0;
  const noMatch = new LrcLibService({ fetchImpl: async () => {
    call += 1;
    return call < 3 ? new Response("{}", { status: 404 }) : new Response("[]", { status: 200 });
  } });
  assert.equal((await noMatch.lookup(metadata)).state, "NO_MATCH");
  assert.equal(call, 3);

  const offline = new LrcLibService({ fetchImpl: async () => { throw new TypeError("offline"); } });
  const unavailable = await offline.lookup(metadata);
  assert.equal(unavailable.state, "UNAVAILABLE");
  assert.match(unavailable.reason, /offline/);
});

test("AcoustID filters low-confidence results and MusicBrainz maps recording metadata", async () => {
  assert.equal(bestAcoustIdMatch({ status: "ok", results: [{ score: 0.4, recordings: [{ id: "low" }] }] }), null);
  assert.equal(bestAcoustIdMatch({ status: "ok", results: [{ score: 0.93, recordings: [{ id: "recording-id", title: "Song", artists: [{ name: "Artist" }] }] }] })?.recordingId, "recording-id");
  const service = new MusicBrainzService({ fetchImpl: async () => new Response(JSON.stringify({
    title: "Song", length: 182000, "artist-credit": [{ name: "Artist" }], releases: [{ title: "Album" }],
  }), { status: 200, headers: { "Content-Type": "application/json" } }) });
  const metadata = await service.recording("12345678-1234-1234-1234-123456789abc");
  assert.deepEqual({ title: metadata.title, artist: metadata.artist, album: metadata.album, duration: metadata.duration }, { title: "Song", artist: "Artist", album: "Album", duration: 182 });
});

test("catalog is metadata only and contains eight entries for each requested language", () => {
  assert.equal(TEST_CATALOG.length, 40);
  for (const language of ["English", "Hindi", "Punjabi", "Bhojpuri", "Bengali"]) {
    assert.equal(TEST_CATALOG.filter((track) => track.language === language).length, 8);
  }
  assert.ok(TEST_CATALOG.every((track) => track.mediaBundled === false && track.durationSeconds === null));
});
