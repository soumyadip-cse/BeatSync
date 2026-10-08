import { FREQUENCY_BANDS } from "../audio/audioConfig.js";

const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));
const clampByte = (value) => Math.max(0, Math.min(255, Math.round(value)));
const alphaFor = (dt, seconds) => 1 - Math.exp(-dt / Math.max(0.001, seconds));

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export class LightingEngine {
  constructor({ ledCount = 10 } = {}) {
    this.setLedCount(ledCount);
    this.reset();
  }

  setLedCount(ledCount) {
    const count = Math.floor(Number(ledCount));
    if (!Number.isFinite(count) || count < 1 || count > 256) {
      throw new RangeError("Logical LED count must be between 1 and 256.");
    }
    this.ledCount = count;
    this.previousValues = Array(count).fill(0);
    this.ledPulses = Array(count).fill(0);
  }

  reset() {
    this.previousValues = Array(this.ledCount).fill(0);
    this.ledPulses = Array(this.ledCount).fill(0);
    this.bandFloors = Array(FREQUENCY_BANDS.length).fill(0.02);
    this.bandPeaks = Array(FREQUENCY_BANDS.length).fill(0.2);
    this.bandFast = Array(FREQUENCY_BANDS.length).fill(0);
    this.bandSlow = Array(FREQUENCY_BANDS.length).fill(0);
    this.transientPulses = Array(FREQUENCY_BANDS.length).fill(0);
    this.overallFloor = 0.005;
    this.overallPeak = 0.2;
    this.overallFast = 0;
    this.overallSlow = 0;
    this.beatPulse = 0;
    this.beatConfidence = 0;
    this.beatTimes = [];
    this.lastBeatAt = -Infinity;
    this.lastTimestamp = null;
    this.elapsedSeconds = 0;
    this.hasPreviousFrame = false;
    this.previousNormalizedBands = Array(FREQUENCY_BANDS.length).fill(0);
  }

  step(analysis, timestamp, config = {}) {
    const now = Number.isFinite(timestamp) ? timestamp : 0;
    const dt = this.lastTimestamp === null ? 1 / 60 : Math.max(0, Math.min(0.1, (now - this.lastTimestamp) / 1000));
    this.lastTimestamp = now;
    this.elapsedSeconds += dt;

    const rawBands = FREQUENCY_BANDS.map((band) => clamp01(analysis?.bands?.[band.key]));
    const overallRaw = clamp01(analysis?.overallEnergy);

    if (!this.hasPreviousFrame) {
      this.bandFloors = [...rawBands];
      this.bandPeaks = rawBands.map((value) => Math.max(0.2, value + 0.16));
      this.bandFast = [...rawBands];
      this.bandSlow = [...rawBands];
      this.overallFloor = overallRaw;
      this.overallPeak = Math.max(0.2, overallRaw + 0.16);
      this.overallFast = overallRaw;
      this.overallSlow = overallRaw;
    }

    // Track the recent sound bed and a slower-falling local peak. A compressed
    // absolute term keeps sound audible; the adaptive term adds musical contrast.
    const normalizedBands = rawBands.map((raw, index) => {
      const floor = this.bandFloors[index];
      this.bandFloors[index] += (raw - floor) * alphaFor(dt, raw > floor ? 1.8 : 3.2);
      const peakTau = raw > this.bandPeaks[index] ? 0.22 : 3.4;
      this.bandPeaks[index] += (raw - this.bandPeaks[index]) * alphaFor(dt, peakTau);

      const headroom = Math.max(0.3, this.bandPeaks[index] - this.bandFloors[index]);
      const contrast = clamp01((raw - this.bandFloors[index] - 0.035) / headroom);
      const compressedEnergy = Math.pow(raw, 0.82);
      return clamp01(compressedEnergy * 0.48 + contrast * 0.52);
    });

    this.overallFloor += (overallRaw - this.overallFloor) * alphaFor(dt, overallRaw > this.overallFloor ? 1.8 : 3.2);
    this.overallPeak += (overallRaw - this.overallPeak) * alphaFor(dt, overallRaw > this.overallPeak ? 0.22 : 3.4);
    const overallHeadroom = Math.max(0.3, this.overallPeak - this.overallFloor);
    const overallContrast = clamp01((overallRaw - this.overallFloor - 0.035) / overallHeadroom);
    const overallEnergy = clamp01(Math.pow(overallRaw, 0.82) * 0.48 + overallContrast * 0.52);

    // Fast envelopes compared with slow adaptive baselines provide positive
    // spectral flux: steady sound settles, while new attacks rise above it.
    const bandOnsets = rawBands.map((raw, index) => {
      this.bandFast[index] += (raw - this.bandFast[index]) * alphaFor(dt, 0.045);
      this.bandSlow[index] += (raw - this.bandSlow[index]) * alphaFor(dt, 0.42);
      this.transientPulses[index] *= Math.exp(-dt / 0.2);
      const rise = Math.max(0, this.bandFast[index] - this.bandSlow[index]);
      const noiseGate = 0.012;
      const reference = Math.max(0.045, this.bandPeaks[index] * 0.18);
      const signalGate = clamp01((raw - 0.035) / 0.2);
      return clamp01((rise - noiseGate) / reference) * signalGate;
    });

    this.overallFast += (overallRaw - this.overallFast) * alphaFor(dt, 0.045);
    this.overallSlow += (overallRaw - this.overallSlow) * alphaFor(dt, 0.42);
    const overallRise = Math.max(0, this.overallFast - this.overallSlow);
    const overallTransient = clamp01((overallRise - 0.014) / Math.max(0.055, this.overallPeak * 0.18));

    let transientBand = bandOnsets.indexOf(Math.max(...bandOnsets));
    let transientStrength = Math.max(...bandOnsets);
    if (overallTransient > transientStrength) {
      transientStrength = overallTransient;
      transientBand = bandOnsets.indexOf(Math.max(...bandOnsets));
    }
    const transientThreshold = Math.max(0, Number(config.transientThreshold ?? 0.16));
    const transientDetected = this.hasPreviousFrame && transientStrength >= transientThreshold;
    if (transientDetected && transientBand >= 0) {
      this.transientPulses[transientBand] = Math.max(this.transientPulses[transientBand], transientStrength);
    } else {
      transientBand = null;
    }

    const bassRaw = rawBands[0] || 0;
    const bassRise = Math.max(0, this.bandFast[0] - this.bandSlow[0]);
    const bassReference = Math.max(0.055, this.bandPeaks[0] * 0.18);
    const bassSignalGate = clamp01((bassRaw - 0.055) / 0.22);
    const beatConfidence = clamp01((bassRise - 0.014) / bassReference) * bassSignalGate;
    const minBeatInterval = Math.max(0.2, Number(config.beatMinInterval ?? 0.26));
    const beatThreshold = Math.max(0, Number(config.beatThreshold ?? 0.2));
    const beatDetected = this.hasPreviousFrame
      && beatConfidence >= beatThreshold
      && this.elapsedSeconds - this.lastBeatAt >= minBeatInterval;

    if (beatDetected) {
      this.lastBeatAt = this.elapsedSeconds;
      this.beatTimes.push(this.elapsedSeconds);
      this.beatTimes = this.beatTimes.filter((time) => this.elapsedSeconds - time <= 12).slice(-16);
      this.beatPulse = Math.max(this.beatPulse, beatConfidence);
    } else {
      this.beatPulse *= Math.exp(-dt / 0.24);
    }
    // Confidence is the current onset evidence, not only a remembered value
    // from frames that already crossed the beat threshold.
    this.beatConfidence = beatConfidence;

    const sensitivity = Math.max(0, Number(config.sensitivity ?? 1));
    const intensity = clamp01(config.intensity ?? 0.72);
    const beatBoost = Math.max(0, Number(config.beatBoost ?? 0.95));
    const transientBoost = Math.max(0, Number(config.transientBoost ?? 1));
    const attack = Math.max(0.01, Number(config.attack ?? 0.035));
    const release = Math.max(0.02, Number(config.release ?? 0.28));
    const pulseDecay = Math.max(0.06, Number(config.pulseDecay ?? 0.22));
    const preset = config.preset || "balanced";
    const mode = config.mode || "hybrid";
    const outputScales = Array.isArray(config.outputScales) ? config.outputScales : null;
    const values = new Array(this.ledCount);

    for (let index = 0; index < this.ledCount; index += 1) {
      const position = this.ledCount === 1 ? 2 : (index / (this.ledCount - 1)) * (FREQUENCY_BANDS.length - 1);
      const lower = Math.floor(position);
      const upper = Math.min(FREQUENCY_BANDS.length - 1, lower + 1);
      const mix = position - lower;
      let spectral = normalizedBands[lower] * (1 - mix) + normalizedBands[upper] * mix;
      const neighbor = normalizedBands[Math.max(0, lower - 1)] * 0.12 + normalizedBands[Math.min(4, upper + 1)] * 0.12;
      spectral = clamp01(spectral * 0.78 + neighbor);

      if (preset === "bass-heavy") spectral = clamp01(spectral * (1 + (1 - position / 4) * 0.42));
      let level = mode === "pulse" ? spectral * 0.42 + overallEnergy * 0.58 : spectral * 0.82 + overallEnergy * 0.18;
      if (mode === "wave") {
        const phase = ((this.elapsedSeconds * 0.72 - index / this.ledCount) % 1 + 1) % 1;
        const wave = Math.max(0, 1 - Math.abs(phase - 0.5) * 2);
        level = level * 0.78 + wave * overallEnergy * 0.22;
      }

      const shaped = Math.pow(clamp01(level * sensitivity), 1.16);
      const transientSpatialPulse = this.transientPulses.reduce((sum, pulse, bandIndex) => {
        const distance = Math.abs(position - bandIndex);
        return sum + pulse * Math.max(0, 1 - distance / 1.55);
      }, 0);
      const bassBias = Math.exp(-position * 0.72);
      const pulseTarget = this.beatPulse * beatBoost * bassBias * 320
        + Math.min(1, transientSpatialPulse) * transientBoost * 300;
      this.ledPulses[index] = Math.max(
        this.ledPulses[index] * Math.exp(-dt / pulseDecay),
        pulseTarget,
      );

      const configuredScale = Number(outputScales?.[index]);
      const outputScale = Number.isFinite(configuredScale) ? Math.max(0, Math.min(2, configuredScale)) : 1;
      const baseBrightness = shaped * intensity * 255;
      const eventBrightness = this.ledPulses[index] * intensity;
      const target = clampByte((baseBrightness + eventBrightness) * outputScale);
      const tau = target > this.previousValues[index] ? attack : release;
      const smoothed = this.previousValues[index] + (target - this.previousValues[index]) * alphaFor(dt, tau);
      this.previousValues[index] = smoothed;
      values[index] = clampByte(smoothed);
    }

    this.previousNormalizedBands = normalizedBands;
    this.hasPreviousFrame = true;

    return {
      values,
      rawBands: Object.fromEntries(FREQUENCY_BANDS.map((band, index) => [band.key, rawBands[index]])),
      bands: Object.fromEntries(FREQUENCY_BANDS.map((band, index) => [band.key, normalizedBands[index]])),
      overallEnergy,
      overallRms: overallRaw,
      transientDetected,
      transientStrength: clamp01(transientStrength),
      transientBand,
      beatDetected,
      beatConfidence: this.beatConfidence,
      beatCount: this.beatTimes.length,
      beatStrength: this.beatPulse,
      bpm: this.estimateBpm(),
      analysisTimeSeconds: Number.isFinite(analysis?.audioTimeSeconds) ? analysis.audioTimeSeconds : this.elapsedSeconds,
    };
  }

  estimateBpm() {
    if (this.beatTimes.length < 4) return null;
    const intervals = [];
    for (let index = 1; index < this.beatTimes.length; index += 1) {
      const interval = this.beatTimes[index] - this.beatTimes[index - 1];
      if (interval >= 0.3 && interval <= 1.5) intervals.push(interval);
    }
    if (intervals.length < 3) return null;
    const center = median(intervals);
    const dispersion = median(intervals.map((interval) => Math.abs(interval - center)));
    if (dispersion / center > 0.18) return null;
    return Math.round(60 / center);
  }
}
