import test from "node:test";
import assert from "node:assert/strict";
import { AudioAnalyzer } from "../audio/AudioAnalyzer.js";
import { LocalSongSource } from "../audio/LocalSongSource.js";
import { MicrophoneSource } from "../audio/MicrophoneSource.js";

test("media analyser creates one graph/source, reads FFT bands, and keeps waveform RMS", async () => {
  let sourceNodes = 0;
  let analyserNodes = 0;
  class FakeAudioContext {
    constructor() { this.state = "suspended"; this.sampleRate = 48000; this.destination = {}; }
    async resume() { this.state = "running"; }
    createAnalyser() {
      analyserNodes += 1;
      return {
        fftSize: 2048,
        smoothingTimeConstant: 0.65,
        get frequencyBinCount() { return this.fftSize / 2; },
        connect() {},
        getByteFrequencyData(data) { data.fill(48); },
        getFloatTimeDomainData(data) { data.fill(0.25); },
      };
    }
    createGain() { return { gain: { value: 1 }, connect() {} }; }
    createMediaElementSource() { sourceNodes += 1; return { connect() {}, disconnect() {} }; }
  }
  const analyzer = new AudioAnalyzer({ audioContextFactory: FakeAudioContext });
  const audio = { currentTime: 12.5, duration: 180 };
  await analyzer.connectMedia(audio);
  await analyzer.connectMedia(audio);
  const analysis = analyzer.read({ mediaElement: audio, sourceType: "media" });
  assert.equal(sourceNodes, 1);
  assert.equal(analyserNodes, 1);
  assert.equal(analyzer.state, "running");
  assert.equal(analysis.fftSize, 2048);
  assert.equal(analysis.sampleRate, 48000);
  assert.equal(analysis.audioTimeSeconds, 12.5);
  assert.ok(analysis.bands.bass > 0);
  assert.equal(analysis.waveformRms, 0.25);
});

test("local song source selects audio/video files, does not autoplay, and revokes object URLs", () => {
  const revoked = [];
  const calls = { pause: 0, load: 0, play: 0 };
  const audio = {
    pause() { calls.pause += 1; },
    load() { calls.load += 1; },
    play() { calls.play += 1; },
  };
  const urlApi = {
    createObjectURL(file) { return "blob:test/" + file.name; },
    revokeObjectURL(url) { revoked.push(url); },
  };
  const source = new LocalSongSource(audio, { urlApi });
  const audioFile = new Blob(["audio"], { type: "audio/mpeg" });
  Object.defineProperty(audioFile, "name", { value: "artist - song.mp3" });
  const videoFile = new Blob(["video"], { type: "video/mp4" });
  Object.defineProperty(videoFile, "name", { value: "video.mp4" });
  const unsupported = new Blob(["data"], { type: "application/octet-stream" });
  Object.defineProperty(unsupported, "name", { value: "readme.bin" });
  const added = source.addFiles([audioFile, videoFile, unsupported]);
  assert.equal(added.length, 2);
  assert.equal(source.select(added[0].id), added[0]);
  assert.equal(audio.src, "blob:test/artist - song.mp3");
  assert.equal(calls.load, 1);
  assert.equal(calls.play, 0);
  source.dispose();
  assert.deepEqual(revoked, added.map((track) => track.url));

  const capped = new LocalSongSource(audio, { urlApi, maxTracks: 1 });
  assert.equal(capped.addFiles([audioFile, videoFile]).length, 1);
  assert.equal(capped.lastSkippedCount, 1);
  capped.dispose();
});

test("microphone adapter requests raw input and stops its stream cleanly", async () => {
  const audioTrack = new EventTarget();
  audioTrack.readyState = "live";
  let stopped = false;
  audioTrack.stop = () => { stopped = true; audioTrack.readyState = "ended"; };
  const stream = { getAudioTracks: () => [audioTrack], getTracks: () => [audioTrack] };
  let requested;
  const source = new MicrophoneSource({ mediaDevices: {
    async getUserMedia(options) { requested = options; return stream; },
    async enumerateDevices() { return [{ kind: "audioinput", deviceId: "mic1" }]; },
  } });
  assert.deepEqual((await source.listInputs()).map((device) => device.deviceId), ["mic1"]);
  assert.equal(await source.start("mic1"), stream);
  assert.equal(requested.audio.deviceId.exact, "mic1");
  assert.equal(requested.audio.echoCancellation, false);
  assert.equal(requested.audio.noiseSuppression, false);
  assert.equal(requested.audio.autoGainControl, false);
  assert.equal(source.active, true);
  source.stop();
  assert.equal(stopped, true);
  assert.equal(source.active, false);
  assert.equal(source.state, "IDLE");
});
