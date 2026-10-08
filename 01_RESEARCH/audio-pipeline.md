# Audio pipeline architecture

## Source adapters

Song Mode uses a browser media element or user-selected local audio file connected to an `AudioContext`. Future Microphone Mode requests a `MediaStream` and connects it to the same analysis graph. The adapters differ only at the source boundary; they do not fork the analysis or lighting pipeline. Microphone permission, gain, echo, and teardown are separate future tests.

## Analysis stages

1. Read the actual runtime sample rate from `AudioContext`; do not assume 44.1 or 48 kHz.
2. Use an `AnalyserNode` for time-domain and frequency-domain data. Its `frequencyBinCount` is half its `fftSize`; `fftSize`, decibel scaling, and smoothing are analysis configuration, not frozen values.
3. Convert time-domain samples to RMS for a normalized overall-energy feature.
4. Aggregate frequency bins into named ranges, then normalize each range independently so strong bass does not pin every bass output at maximum.
5. Detect onsets/beat events separately from continuous band energy. Keep tempo estimation optional; a stable BPM estimate is not required for the first mapper.
6. Emit a compact `AudioAnalysis` to the lighting engine. Provide waveform and frequency arrays separately as short-lived visualization diagnostics; do not send raw bins over serial.

Approximate bin center frequency is `k * sampleRate / fftSize`, with bin spacing `sampleRate / fftSize`. The window duration is approximately `fftSize / sampleRate`. These equations expose a resolution/response tradeoff; compare candidate sizes with known tones and real music before selecting one. At 48 kHz, for example, 2048 samples span about 42.7 ms and 4096 span about 85.3 ms. These are observation windows, not guaranteed end-to-end latency.

## Proposed compact model

```text
AudioAnalysis {
  frameId: monotonic integer
  audioTimeSeconds: AudioContext time for this analysis frame
  rms: normalized overall energy in [0, 1]
  bands: {
    bass, lowMid, mid, highMid, treble: normalized [0, 1]
  }
  beat: { detected: boolean, strength: [0, 1] }
}
```

`bands` are calibrated feature values, not raw FFT magnitudes. Keep the chosen calibration profile and its test evidence in research notes. Do not include both amplitude and RMS as duplicate signals. `tempo`, `waveform`, and `frequencyBins` are omitted from this core object: tempo is optional, and raw arrays belong in a separate diagnostics stream for visualization.

## Constraints and risks

The browser audio context may use a different sample rate than expected. Autoplay/user-gesture policies, file decoding, microphone permission, and Web Serial browser support need runtime checks. Web Serial is limited to supporting browsers and secure contexts; local development and deployment origin must be chosen accordingly. The audio engine is local-only; no audio is uploaded to the backend.

References: [MDN AnalyserNode](https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode), [MDN Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API), [MDN Web Serial API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API).
