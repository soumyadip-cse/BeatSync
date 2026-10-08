# Frontend architecture

Status: technology recommendation; no dependencies have been added.

## Recommended stack

- **TypeScript** for explicit contracts shared across audio analysis, lighting, UI, and serial encoding.
- **React** for the eventual dashboard panels, controls, player, lyrics, and device status.
- **Vite** for local development and production bundling.
- Native **Web Audio API** and **Web Serial API** for the browser-local real-time path. Check target-browser support and permission flow before implementation; Web Serial is not available in every browser and requires a secure context.
- **Canvas 2D** for high-rate waveform and spectrum drawing if DOM/SVG updates do not meet performance needs.
- **Three.js with React Three Fiber** only for the optional galaxy environment. It is a renderer, not a required part of the functional pipeline.

The sources support these roles: [React components](https://react.dev/learn/your-first-component), [Vite guide](https://vite.dev/guide/), [React Three Fiber](https://r3f.docs.pmnd.rs/), [Web Audio AnalyserNode](https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode), and [Web Serial](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API).

## Runtime separation

The audio engine produces compact, timestamped `AudioAnalysis` values and optional visualization arrays. The lighting engine consumes the compact values and configuration to emit `LightingFrame`. A serial adapter sends frames and receives device status. Application state exposes the latest measurements, calculated frame, and device connection/status for presentation.

Keep audio/lighting frame updates outside broad React component state at audio callback frequency. Publish sampled display state at a UI-appropriate rate and draw charts with Canvas when needed. UI controls send configuration changes into the relevant engine; they do not implement mapping or packet encoding.

The 3D layer consumes presentation state such as playback activity, sampled energy, and theme settings. It must not read FFT buffers, calculate LED states, or construct serial messages. Keep it isolated under `frontend/three/` and load it only if the user experience needs it.

## Suggested frontend areas

```text
frontend/
  app/                 composition and application state
  audio/sources/       song and future microphone adapters
  audio/analysis/      Web Audio features and diagnostics
  lighting/            deterministic N-output mapper
  serial/              Web Serial connection and encoder adapter
  visualizer/          waveform/spectrum presentation
  lyrics/              lyric timing and display
  components/ pages/   React dashboard presentation
  three/               optional isolated 3D background
  types/               stable boundary contracts
```

This is a responsibility map, not a request to create source code now. The existing README placeholders can gain implementation as each boundary is prototyped.

## Backend and database

Do not route audio, FFT data, lighting frames, or serial traffic through a server. Backend/database remain inactive in the first local prototype. Add persistence only after identifying a concrete need such as user-managed lyrics, saved presets, device profiles, or settings. Accounts and cloud sync are later options, not prerequisites for local audio-to-light operation.

## Visual direction

Use the provided reference description as a future presentation target: dark cinematic galaxy/space background, glass panels, restrained neon accents, animated visualization, sliders, lighting controls, lyrics, and truthful Arduino status. Until the image is present in the workspace, this is a written direction rather than a verified visual asset. Never display placeholder device/audio values as live measurements.
