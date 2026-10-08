import { FFT_SIZE, FFT_SMOOTHING, FREQUENCY_BANDS } from "./audioConfig.js";

function rmsForRange(data, binFrequency, minHz, maxHz) {
  const nyquist = binFrequency * data.length;
  const start = Math.max(1, Math.floor(minHz / binFrequency));
  const end = Math.min(data.length, Math.ceil(Math.min(maxHz, nyquist) / binFrequency));
  if (end <= start) return 0;
  let sum = 0;
  for (let index = start; index < end; index += 1) {
    const amplitude = data[index] / 255;
    sum += amplitude * amplitude;
  }
  return Math.sqrt(sum / (end - start));
}

export class AudioAnalyzer {
  constructor({ audioContextFactory = null } = {}) {
    this.audioContextFactory = audioContextFactory;
    this.context = null;
    this.analyser = null;
    this.monitorGain = null;
    this.mediaElement = null;
    this.mediaSource = null;
    this.streamSource = null;
    this.activeSource = null;
    this.frequencyData = null;
    this.waveformData = null;
    this.sourceType = "none";
  }

  async _ensureGraph() {
    if (!this.context) {
      const AudioContextClass = this.audioContextFactory || window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) throw new Error("This browser does not support the Web Audio API.");
      this.context = new AudioContextClass();
      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = FFT_SIZE;
      this.analyser.smoothingTimeConstant = FFT_SMOOTHING;
      this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
      this.waveformData = new Float32Array(this.analyser.fftSize);
      this.monitorGain = this.context.createGain();
      this.monitorGain.gain.value = 1;
      this.analyser.connect(this.monitorGain);
      this.monitorGain.connect(this.context.destination);
    }
    if (this.context.state === "suspended") await this.context.resume();
  }

  async connectMedia(audioElement) {
    await this._ensureGraph();
    if (this.mediaElement && this.mediaElement !== audioElement) {
      throw new Error("AudioAnalyzer can own only one media element source per AudioContext.");
    }
    if (!this.mediaSource) {
      this.mediaElement = audioElement;
      this.mediaSource = this.context.createMediaElementSource(audioElement);
    }
    if (this.activeSource && this.activeSource !== this.mediaSource) {
      try { this.activeSource.disconnect(this.analyser); } catch { /* Already disconnected. */ }
    }
    if (this.activeSource !== this.mediaSource) this.mediaSource.connect(this.analyser);
    this.activeSource = this.mediaSource;
    this.monitorGain.gain.value = 1;
    this.sourceType = "media";
    return this.context;
  }

  async connectStream(stream) {
    await this._ensureGraph();
    if (!stream?.getAudioTracks?.().some((track) => track.readyState === "live")) {
      throw new Error("The microphone stream has no live audio track.");
    }
    if (this.activeSource) {
      try { this.activeSource.disconnect(this.analyser); } catch { /* Already disconnected. */ }
    }
    if (this.streamSource) {
      try { this.streamSource.disconnect(); } catch { /* Already disconnected. */ }
    }
    this.streamSource = this.context.createMediaStreamSource(stream);
    this.streamSource.connect(this.analyser);
    this.activeSource = this.streamSource;
    // Keep the analyser graph pulled without monitoring the microphone through speakers.
    this.monitorGain.gain.value = 0;
    this.sourceType = "microphone";
    return this.context;
  }

  disconnectSource() {
    if (this.activeSource) {
      try { this.activeSource.disconnect(this.analyser); } catch { /* Already disconnected. */ }
    }
    if (this.streamSource) {
      try { this.streamSource.disconnect(); } catch { /* Already disconnected. */ }
      this.streamSource = null;
    }
    this.activeSource = null;
    this.sourceType = "none";
    if (this.monitorGain) this.monitorGain.gain.value = 0;
  }

  read({ mediaElement = null, sourceType = this.sourceType } = {}) {
    if (!this.analyser || !this.context || !this.activeSource) return null;
    this.analyser.getByteFrequencyData(this.frequencyData);
    this.analyser.getFloatTimeDomainData(this.waveformData);
    const binFrequency = this.context.sampleRate / this.analyser.fftSize;
    const bands = Object.fromEntries(FREQUENCY_BANDS.map((band) => [
      band.key,
      rmsForRange(this.frequencyData, binFrequency, band.minHz, band.maxHz),
    ]));
    const overallEnergy = rmsForRange(this.frequencyData, binFrequency, 40, 20000);
    let waveformSquareSum = 0;
    for (const sample of this.waveformData) waveformSquareSum += sample * sample;

    const isMedia = sourceType === "media" && mediaElement;
    return {
      audioTimeSeconds: isMedia ? mediaElement.currentTime : null,
      durationSeconds: isMedia && Number.isFinite(mediaElement.duration) ? mediaElement.duration : null,
      sourceType,
      sampleRate: this.context.sampleRate,
      fftSize: this.analyser.fftSize,
      overallEnergy,
      waveformRms: Math.sqrt(waveformSquareSum / this.waveformData.length),
      bands,
      spectrum: this.frequencyData,
      waveform: this.waveformData,
    };
  }

  get state() {
    return this.context?.state || "not created";
  }
}
