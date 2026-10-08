export const FFT_SIZE = 2048;
export const FFT_SMOOTHING = 0.65;
export const ANALYSIS_UI_INTERVAL_MS = 80;
export const DEFAULT_SERIAL_INTERVAL_MS = 67;

export const FREQUENCY_BANDS = Object.freeze([
  { key: "bass", name: "Bass", minHz: 40, maxHz: 250, color: "#35c7df" },
  { key: "lowMid", name: "Low-Mid", minHz: 250, maxHz: 500, color: "#168dff" },
  { key: "mid", name: "Mid", minHz: 500, maxHz: 2000, color: "#286fdb" },
  { key: "highMid", name: "High-Mid", minHz: 2000, maxHz: 6000, color: "#19c8d1" },
  { key: "treble", name: "Treble", minHz: 6000, maxHz: 20000, color: "#69e9d4" },
]);

export const LIGHTING_PRESETS = Object.freeze({
  balanced: { label: "Balanced", sensitivity: 1, intensity: 0.72, attack: 0.035, release: 0.2, beatBoost: 1.1, transientBoost: 1.2, beatThreshold: 0.13, transientThreshold: 0.14 },
  pulse: { label: "Pulse", sensitivity: 1, intensity: 0.78, attack: 0.025, release: 0.42, beatBoost: 1.05, transientBoost: 0.9, beatThreshold: 0.14, transientThreshold: 0.16 },
  concert: { label: "Concert", sensitivity: 1.1, intensity: 0.9, attack: 0.025, release: 0.34, beatBoost: 1.2, transientBoost: 1.15, beatThreshold: 0.13, transientThreshold: 0.15 },
  chill: { label: "Chill", sensitivity: 0.85, intensity: 0.56, attack: 0.09, release: 0.65, beatBoost: 0.35, transientBoost: 0.4, beatThreshold: 0.2, transientThreshold: 0.22 },
  "bass-heavy": { label: "Bass Heavy", sensitivity: 1, intensity: 0.8, attack: 0.03, release: 0.32, beatBoost: 1.05, transientBoost: 0.8, beatThreshold: 0.14, transientThreshold: 0.18 },
  spectrum: { label: "Spectrum", sensitivity: 1, intensity: 0.72, attack: 0.055, release: 0.3, beatBoost: 0.35, transientBoost: 0.55, beatThreshold: 0.18, transientThreshold: 0.2 },
});

export const DEFAULT_LIGHTING_CONFIG = Object.freeze({
  preset: "balanced",
  sensitivity: 1,
  intensity: 0.72,
  attack: 0.035,
  release: 0.2,
  beatBoost: 1.1,
  transientBoost: 1.2,
  beatThreshold: 0.13,
  transientThreshold: 0.14,
  outputScales: null,
  mode: "hybrid",
  serialIntervalMs: DEFAULT_SERIAL_INTERVAL_MS,
});
