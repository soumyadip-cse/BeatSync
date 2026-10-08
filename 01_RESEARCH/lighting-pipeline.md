# Lighting pipeline architecture

## Boundary

The lighting engine receives a compact `AudioAnalysis`, user-selected `LightingConfig`, the previous engine state, and elapsed time. It returns a hardware-neutral `LightingFrame` and the next engine state. It does not read audio, touch React/HTML/CSS, open Web Serial, know Arduino pins, or call the backend.

Conceptual function:

```text
stepLighting(previousState, analysis, config, deltaSeconds)
  -> { frame: LightingFrame, nextState }
```

This is a deterministic reducer: the same inputs and previous state produce the same result. Smoothing and moving phases require explicit state, so describing the engine as a stateless function would be misleading.

## Proposed models

```text
LightingConfig {
  ledCount: positive integer N
  layout: linear | circular | matrix
  mode: spectrum | pulse | wave | hybrid
  sensitivity: [0, 1]
  brightnessLimit: [0, 1]
  attackSeconds: positive number
  releaseSeconds: positive number
}

LightingFrame {
  frameId: monotonic integer
  audioTimeSeconds: time associated with source analysis
  leds: array of exactly N LedState values
}

LedState {
  intensity: [0, 1]
  color: optional { r, g, b }, each [0, 1]
}
```

The array length is authoritative; consumers reject a frame whose length does not match active configuration. A monochrome output uses `intensity`; RGB hardware uses `color * intensity`, bounded by `brightnessLimit`. The output is a snapshot, not an instruction to blink at an audio frequency.

Pattern name, phase, and speed are internal engine state/configuration in the first protocol version. The engine resolves them into per-LED output values before producing a frame. This keeps firmware and serial transport from needing the browser's animation algorithm. If future MCU-local effects are needed, define them as a separate optional command rather than adding UI or pattern semantics to every LED state.

## Update and failure behavior

The engine can compute at an initial target near 30 frames per second, independently of the browser's higher-rate render loop. It retains per-band attack/release values, clamps outputs, and resets or eases state on pause/disconnect according to explicit configuration. The eventual UI may render a calculated frame while disconnected, but labels it as a preview until device acceptance is known.
