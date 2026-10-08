# BeatSync - Compressed Project Handoff

**Updated:** 2026-10-06  
**Workspace:** `D:\my project works\websites\Beat Synk`  
**Purpose:** One compact source of project idea, history, architecture, experiments, current state, and next steps.

## 1. Project idea

BeatSync is a music-reactive Arduino lighting system with a browser dashboard. Its motto is **“Music is converted into data; data is converted into light.”** A song is played on the computer; browser audio analysis extracts useful signal features; a deterministic lighting mapper turns those features into N configurable LED states; values travel over USB serial to Arduino, which renders them on physical lights. The dashboard should show genuine playback, analysis, connection, and lighting state.

The first goal is reliable audio-to-light behavior, then the full polished website. The intended future UI is dark/futuristic/galaxy-themed and may include track metadata, lyrics, waveform/spectrum, analysis metrics, and a visual representation of the physical LEDs. **AI/ML is not needed in the real-time core.**

## 2. Target architecture and project rules

```text
Song file / future microphone
  -> browser source adapter
  -> Web Audio analysis (waveform, FFT, bands, amplitude/energy, beat/onset)
  -> deterministic lighting engine (configuration + history -> N LED states)
  -> independent Web Serial transport
  -> separate Arduino firmware / LED driver
  -> physical LEDs

Separate persistent app path, only when needed:
UI <-> backend <-> database (metadata, lyrics, presets, configurations, settings)
```

- Real-time analysis and LED frame updates remain local in the frontend; never route them through the backend/database.
- Keep source capture, audio analysis, lighting engine, UI, serial transport, and Arduino responsibilities separate.
- Song Mode and future Microphone Mode use different source adapters feeding the same downstream pipeline.
- LED count is configuration (`N`), not hard-coded in the lighting engine. The project brief targets an 8-20 LED prototype and possible 50+ addressable LEDs later; current proof uses one LED.
- Do not invent simulated measurements, add dependencies, or implement large subsystems before interfaces and hardware assumptions are understood.
- Verify exact board, LED, driver, power, browser, and serial assumptions. Test subsystem boundaries independently and record results.
- Architecture changes belong in `00_PROJECT_CONTEXT/team-decisions.md` with date, rationale, evidence, proposer, and status.

## 3. Project history (keep eras distinct)

1. **Initial idea:** disco-style LEDs controlled by Arduino.
2. **SONICLUX prototype history:** development log records Arduino UNO R4 WiFi, individual LEDs, PWM, a Python/librosa FFT/beat analysis prototype, and serial control. It documents an earlier five-LED layout and later three-LED test, with COM3/9600 in the Python/Arduino examples. These are historical records; they are not the current browser experiment's configuration.
3. **BeatSync architecture/workspace:** project structure and research notes were organized around a local browser pipeline, configurable N-LED lighting engine, independent serial transport, separated Arduino subsystem, and future dashboard. Several architecture details remain proposals, not implemented choices.
4. **First verified current hardware proof:** Arduino UNO R4 WiFi, one ordinary LED, current-limiting resistor, LED on PWM D9, cathode to GND. Existing firmware accepts integer brightness through `Serial.parseInt()` and calls `analogWrite(D9, value)`. Digital on/off and PWM values 0-255 were verified.
5. **Browser serial proof:** plain HTML/CSS/JavaScript page connected to Arduino over Web Serial at 115200 baud and sent newline-delimited integers. The full manual slider-to-LED 0-255 path was verified.
6. **Audio/serial integration and investigation:** the browser FFT path works with serial disabled; enabling automatic serial output was associated with audio pausing around 38-42 seconds. Isolated tests and diagnostic modes narrowed the trigger to the serial-enabled production path; the underlying cause is still not proven.

## 4. What exists in the workspace

- `00_PROJECT_CONTEXT/`: master project PDF, preserved SONICLUX Arduino log, research log, architecture and team decisions.
- `01_RESEARCH/`: system/audio/frontend/lighting/LED mapping/beat/hardware/serial architecture and FFT mapping notes.
- `frontend/`: screenshot-led, dependency-free dashboard implementation with local audio/analysis/lighting/serial modules, canvas charts, and a CSS 3D sculpture. Physical full-song output still needs testing.
- `arduino/firmware/BeatSync10LedTest/`: separate 10-output UNO R4 WiFi firmware. Backend/database remain documentation-only; other architecture folders still contain scaffold notes.
- `experiments/web-serial-led-control/`: working proof page (`index.html`, `style.css`, `app.js`, `README.md`) combining manual slider serial control and optional audio FFT-to-LED output; see current implementation below.
- `experiments/web-serial-led-control/audio-only.html/.js`: temporary selectable Web Audio routing tests, Modes 1-4.
- `experiments/web-serial-led-control/analysis-only.html/.js`: temporary Mode 5 page adds the BeatSync FFT loop without serial, for playback comparison. Static syntax validation was performed; a new measured runtime result was not reported.
- `experiments/media-playback-isolation/`: isolated native `<audio>` playback page and `test-audio.mp3` fixture (a byte-identical copy made from the original `.mpeg` source with `.mp3` extension).
- Other experiment folders (`fft`, `audio-analysis`, `led-mapping`, `hardware`) hold README/design scaffolding.
- `BEATSYNC_PROJECT_HANDOFF.md`: this summary.

**Documentation caveat:** earlier sections record the one-LED and 10-LED experiments as they developed. The latest dashboard implementation and its pending hardware verification are recorded in section 12.

## 5. Browser experiments and current dashboard

The former single-LED `0-255` manual Web Serial path was verified. The current experiment has since advanced to the 10-value CSV frame and 10-channel firmware described in section 11. The new dashboard under `frontend/` is a separate application that uses the same local Web Audio / Web Serial architecture and 10-value frame shape. Neither the new frontend nor the 10-LED full-song physical output is verified until the hardware test is completed.

The previous serial-enabled pause investigation remains relevant: at the old 50 ms cadence, audio paused near 38-42 seconds while serial diagnostics showed successful writes, no overlaps, and no observed backpressure. Reducing the experiment cadence to 250 ms did not yet have a reported full-song result. The exact cause remains unresolved.

## 6. Confirmed playback test matrix

| Test | Result reported by project owner |
|---|---|
| Native media playback, no Web Audio | Continues beyond 90 s. |
| Web Audio source -> destination | Continues beyond 90 s. |
| Web Audio source -> Analyser -> destination, no FFT loop | Continues beyond 90 s. |
| Real BeatSync FFT + `requestAnimationFrame`, serial output OFF | Continues beyond 90 s. |
| Real BeatSync FFT + serial output ON (old faster cadence) | Audio pauses around 38-42 s. Hundreds of writes succeeded; no overlaps/backpressure observed. |
| Latest-value/coalescing serial writer | Owner confirmed it did not eliminate the pause. |
| 250 ms automatic-send interval | Code updated and syntax checked; playback result is **pending**. |

Earlier pause snapshots showed audio time near 39.87 s, FFT RMS around 129.32, calculated brightness 255, no write failures/overlaps, and connection CONNECTED. Native isolation worked to at least 1:28. The media fixture is about 238.576 s (3:59), and a byte-identical `.mp3` copy did not change the Web Audio routing-only result. Changing file extension alone was not the solution.

## 7. Proposed architecture vs implemented prototype

The architecture notes propose versioned serial frames, COBS/CRC, addressable RGB pixels, and React/TypeScript/Vite as possible future directions. **These are not the current implementation or frozen decisions.** The 10-LED experiment/dashboard use ten comma-separated integer values and newline. The initial verified manual milestone remains the earlier one-LED integer protocol.

## 8. Not done / open engineering work

- Re-test automatic serial output at the new 250 ms cadence on the same ~4-minute media file; record whether it passes 40 s, 90 s, and full duration, and LED responsiveness.
- If it still pauses, collect aligned media event history, `pause()` wrapper data, serial send timestamps/counts, and console errors during one run. Determine whether browser/serial scheduling or another path is causal before changing firmware/protocol.
- The production app currently mixes diagnostics with its experiment UI; after the serial issue is resolved, establish stable module boundaries: source adapter, audio analysis output, lighting frame/config, serial transport, UI.
- Measure audio features with silence, tones/sweeps, and representative music; choose banding, normalization, smoothing/attack/release, beat/onset behavior, and mapping based on evidence.
- Prove multiple independent LED states and configurable N; choose final LED technology, driver, power, wiring, output count, layout, and safety budget before scaling.
- Define and test the final serial protocol, update cadence, latency/drop behavior, reconnect behavior, and safe state on lost frames. The current 10-value CSV/newline frame is still a temporary proof protocol; the earlier single-LED proof used one integer per line.
- Validate the newly implemented dashboard against browser playback and physical 10-LED output, then tune its analysis and mapping from recorded evidence. Backend/database are future persistent-data features only; microphone mode remains a later source adapter.
- Record validated decisions/results in `team-decisions.md`, research notes, and integration test records. Existing README architecture status should eventually be reconciled with current experiments.

## 9. Useful entry points

- Project brief: `00_PROJECT_CONTEXT/BeatSync_Project_Master_Context_v1.pdf`
- Prior hardware/software history: `00_PROJECT_CONTEXT/SONICLUX_Arduino_Development_Log.md`
- Current serial/FFT proof: `experiments/web-serial-led-control/README.md` and `app.js`
- Audio-only FFT diagnostic: `experiments/web-serial-led-control/analysis-only.html`
- Routing diagnostic Modes 1-4: `experiments/web-serial-led-control/audio-only.html`
- Native media baseline: `experiments/media-playback-isolation/index.html`
- Architecture decisions: `00_PROJECT_CONTEXT/team-decisions.md`, `00_PROJECT_CONTEXT/architecture-decisions.md`, `01_RESEARCH/`

## 10. Immediate next step

The immediate next step has since moved from the one-LED cadence check to the 10-LED hardware proof described in section 11. The 250 ms cadence remains in use; first validate wiring with the firmware startup/manual sequence, then run the full media test and record milestones and diagnostics.

## 11. Latest continuation: 10-LED proof implementation (2026-10-05)

The owner supplied the actual 10-LED pin map and requested transition from the single-LED test to a temporary 10-output synchronization proof. The existing `web-serial-led-control` experiment has a ten-output preview labeled LED1/L0 through LED10/L9, uniform and custom manual output, a one-hot 10-LED test sequence, a dedicated simultaneous test frame, five configurable frequency-band RMS features, weighted deterministic LED mapping, 0.38/0.12 attack/release coefficients, deterministic transient boosts, and a 250 ms CSV-frame cadence. Band features use fixed full-scale normalization; treble extends to 20 kHz subject to Nyquist. Browser frames are ten comma-separated 0-255 values plus newline; the single-writer/coalescing path sends at most one active write and one latest pending frame. Connection-attempt diagnostics now expose request/open/writer phases. JavaScript syntax validation passes; physical music synchronization remains unverified.

Added `arduino/firmware/BeatSync10LedTest/BeatSync10LedTest.ino`: 115200 baud, `uint8_t ledValues[10]`, exact ten-value line parsing, D2-D11 outputs in red/green column order, PWM on D3/D5/D6/D9/D10/D11, digital threshold 128 on D2/D4/D7/D8, startup all-off then cumulative LED1-LED10 (250 ms each), all-on 250 ms, then all-off. Added experiment and firmware README instructions. Arduino official docs were checked for UNO R4 WiFi PWM pins and 8 mA safe GPIO current; resistor values must be verified against that rating before the all-on test. JavaScript syntax validation passes; Arduino CLI is unavailable, and browser/physical tests remain pending. A workspace scan found only this `.ino` sketch, with no other active D9-only firmware. Treat this only as an implemented candidate for the **10-LED browser-to-Arduino synchronization proof**, not as physically verified.

Current requested next action: open/upload the firmware sketch in Arduino IDE, confirm the startup sequence, run the manual one-hot test and the exact simultaneous frame `255,180,160,140,120,100,80,60,40,20` to validate all outputs, then run audio with serial enabled at 250 ms on the full ~4-minute track and record whether it passes 40 s, 90 s, and end-of-file. The exact serial-enabled playback pause cause remains unresolved.

## 12. Dashboard implementation (2026-10-05)

The owner supplied `BEATSYNC_CODEX_PROMPT.md` and the galaxy dashboard reference image and explicitly requested the final frontend. The existing `frontend/` contained documentation only, not a reusable dashboard codebase. A dependency-free static dashboard now lives at `frontend/index.html` and `frontend/styles.css`, coordinated by `frontend/app.js`; independent modules implement local file selection, Web Audio analysis, deterministic N-value lighting, Web Serial, canvas charts, local timed LRC lyrics, and a CSS 3D 10-LED sculpture. It follows the reference's dark galaxy, glass-panel, dense monitoring layout. No song, Arduino, BPM, lyric, or sensor readings are invented. When serial is off it labels the values as preview; on successful writes the virtual twin/sculpture use the exact transmitted frame. Since the firmware has no acknowledgements, transmitted is not reported as hardware-measured.

The dashboard uses the same temporary 10-integer CSV/newline protocol at 115200 baud, a 250 ms default maximum output rate, one active writer with a replaceable latest pending frame, and the physical 10-channel pin configuration. Its audio-to-light curve and onset response were retuned after evidence showed ordinary band values were clipping at 255; physical output still needs verification. Timed local `.LRC` files can be loaded and synchronized to the selected song. No firmware or prior experiment files were changed for the dashboard. Open `http://localhost:8000/frontend/` from the existing local server for the dashboard.

## 13. Integrated BeatSync foundation update (2026-10-06)

The current implementation details are in the updated root README and `frontend/ARCHITECTURE.md`. Keep the historical sections above as the development record; this section supersedes their “local LRC only,” fixed logical count, and dashboard default-cadence statements.

- The existing `frontend/` remains plain HTML/CSS/JavaScript ES modules. No React migration or runtime package was added. Run `npm start` and open `http://localhost:8000/`.
- `AudioAnalyzer` reuses one context/media source/analyser and buffers; song and explicit microphone adapters produce the same measured feature shape. Microphone access requires a browser permission gesture and does not run song identification.
- `LightingEngine` now accepts logical counts from 1 to 256, uses five frequency bands, absolute plus adaptive normalization, onset pulses, bass beat confidence/refractory logic, optional stable BPM, per-output interpolation, and attack/release/preset controls. Synthetic tests caught and corrected a self-normalizing envelope that had driven steady signals too bright.
- `Arduino10LedProfile` resamples N logical values to the current ten physical channels. D2/D4/D7/D8 are digital threshold outputs at 128; D3/D5/D6/D9/D10/D11 are PWM.
- The serial frame remains exactly ten comma-separated integers plus newline at 115200 baud. Default dashboard cadence is 100 ms. There is one active writer and at most one replaceable latest frame. Serial does not block the analysis loop. The firmware does not acknowledge output.
- The lyrics panel now reads local MP3 ID3 fields / filename fallback, searches LRCLIB asynchronously, permits title/artist correction, handles synced and plain lyrics, reports no-match/unavailable states, and still accepts user `.LRC` files. Its 40-title catalog is metadata-only. The loopback Node server serves the app and relays metadata lookup requests only; it does not receive audio or frames.
- `ACOUSTID_CLIENT_KEY` is read from an ignored `.env` after copying `.env.example`; no key is included. A compatible `BeatSyncChromaprint.fingerprintFile` implementation is still required and is not bundled, so fingerprint lookup reports unavailable by default.
- Current automated tests cover audio-source/analyzer mocks, lighting dynamics, hardware map, serial coalescing and connection cases, metadata/LRC/API service logic, catalog, and HTML selector IDs. Unit tests and syntax checks do not prove browser codec behavior, external service results, device serial behavior, or physical LEDs.
- Browser visualization was not inspected because no browser target was available in the tool session. No Arduino was physically available. The prior serial-enabled audio pause around 38–42 seconds remains unresolved; one-write coalescing and slower experimental cadence are not proof of a fix.

**Current next task:** open the dashboard in supported Chromium, test local media, lyrics and mic controls, then run the complete ten-LED hardware sequence with serial off/on and the 238.6-second file. Record actual pause/event/write/LED observations at 40 seconds, 90 seconds, and end-of-track in `integration/hardware-tests/README.md`.
