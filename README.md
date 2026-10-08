# BeatSync

**Music is converted into data; data is converted into light.** BeatSync plays a user-selected local song or video, analyzes its audio in the browser, turns measured signal features into a logical LED frame, and can send a mapped frame to an Arduino over USB serial.

## Run it

Requirements: Node.js 20 or later and a current Chromium-based browser for Web Serial. The project has no npm runtime dependencies.

```powershell
npm start
```

Open <http://localhost:8000/>. Run the tests with `npm test`. The server binds to loopback only. The static frontend also works at `/frontend/`.

## Use the dashboard

1. Add local audio or a video that contains an audio track. The browser must support that file's codec. The selected media stays in the browser; the playlist is capped at 100 files per page session and its object URLs are released when the page exits.
2. Use the native player controls to play it. The dashboard shows measured FFT bands, waveform/RMS, energy, beat confidence, transient events, and the logical LED frame.
3. Keep **Send FFT brightness to Arduino** off to preview; enable it only after connecting the board. Press **Connect Arduino** and select the correct USB port. Close Arduino Serial Monitor first.
4. Choose a logical LED count. The dashboard can render N logical values; the current hardware adapter resamples them to the ten physical outputs and marks those counts separately.
5. If a file has incomplete tags, enter the correct title and artist in the lyrics panel or choose a metadata-only catalog entry to search for lyrics. Synced lyrics follow media time; plain lyrics are clearly marked unsynchronized. A local `.LRC` file is also supported.
6. Microphone Mode is started explicitly by the user, requests browser microphone permission, and uses the same analysis and lighting engine. Song identification and lyrics are off in microphone mode.

## Current architecture

```text
Local song/video ─┐
                  ├─> Web Audio -> waveform/FFT/bands/RMS -> deterministic lighting engine -> N logical LEDs
Microphone ───────┘                                                               │
                                 virtual display <- logical frame                 ├─> mapped 10-channel frame
                                                                                  └─> bounded Web Serial -> UNO R4 -> discrete LEDs
```

The audio source adapters, analyzer, lighting engine, hardware profile, serial transport, and UI are separate modules. The lighting engine receives measured features and returns N logical byte values; it does not know pin numbers or touch the DOM. Audio analysis stays in `frontend/` and never waits for serial writes. A serial failure must not pause media playback.

The small Node service in `backend/dev-server.js` serves the page and relays only metadata/lyrics lookups that need same-origin access, a MusicBrainz User-Agent, or the server-only AcoustID key. It does not receive raw audio, run analysis, or transmit LED frames. It uses an in-memory lookup cache and there is no database, account system, or persistence layer.

## Lighting and hardware

The deterministic lighting engine combines overall energy, five frequency regions, recent-level adaptation, transient/onset pulses, bass beat confidence, a refractory interval, attack/release smoothing, global intensity, optional per-output scaling, and one shared set of presets. BPM is reported only when enough consistent beat intervals exist. Frequency regions are Bass 40–250 Hz, Low-Mid 250–500 Hz, Mid 500–2,000 Hz, High-Mid 2,000–6,000 Hz, and Treble 6,000–20,000 Hz capped by the analyzer's available bins.

Current physical order for the UNO R4 WiFi profile:

| Logical channel | Pin | Output capability |
| --- | --- | --- |
| L0 | D2 | Digital, threshold 128 |
| L1 | D7 | Digital, threshold 128 |
| L2 | D3 | PWM |
| L3 | D8 | Digital, threshold 128 |
| L4 | D4 | Digital, threshold 128 |
| L5 | D9 | PWM |
| L6 | D5 | PWM |
| L7 | D10 | PWM |
| L8 | D6 | PWM |
| L9 | D11 | PWM |

The current ten discrete LEDs therefore include **four digital-only outputs and six PWM outputs**. Digital outputs switch off below 128 and on at or above 128; only the six PWM pins provide variable 0–255 brightness. A future addressable/driver profile can change the hardware adapter without changing the N-output lighting engine. Verify resistor values, board current limits, LED polarity, and power before an all-on physical test.

The current experimental serial frame remains ten comma-separated integers terminated by newline, at 115200 baud. For example: `255,180,160,140,120,100,80,60,40,20\n`. It is not the separate proposed COBS/CRC protocol in `serial-protocol/message-format.md`. The browser sends at a configurable cadence (100 ms/10 frames per second by default), permits one active write and one replaceable latest pending frame, and discards stale queued values. The firmware does not acknowledge the applied LED state; UI write success is not physical measurement.

## Lyrics and identification

The browser reads MP3 ID3 title/artist/album tags when present and falls back to the filename. LRCLIB lookup runs asynchronously through the loopback metadata relay; exact title/artist results are checked before display. Users can correct missing or inaccurate tags in the lyrics panel or load a local timed `.LRC` file. The 40-track catalog is metadata-only; it contains no bundled song files or full lyrics. If there is no match or the service is unavailable, the UI says so.

To enable the AcoustID branch, copy `.env.example` to `.env`, put the replaceable key after `ACOUSTID_CLIENT_KEY=`, and restart `npm start`. Keep `.env` private; it is ignored by Git. No key is included in this workspace. **Automatic fingerprint lookup also requires a compatible browser Chromaprint provider** exposing `globalThis.BeatSyncChromaprint.fingerprintFile(file, { signal })`; that provider is not bundled. Without it, tag/filename-based LRCLIB search and manual lyric search still work, and the UI reports fingerprint identification as unavailable. The provider sends a derived fingerprint (not the raw song file) to AcoustID through the local relay.

## Diagnostics and verification status

The dashboard shows real media time/state, AudioContext state, measured RMS/bands, analysis frames, serial state, successful/failed writes, active/pending writes, backpressure observations, the last sent frame, and media event history. It does not invent live readings or claim a board acknowledgement.

Automated tests cover local source cleanup, microphone stream cleanup, analyzer graph reuse and features, lighting dynamics and N output sizes, hardware mapping and digital threshold, bounded latest-frame serial behavior/reconnect/cancel, metadata/LRC/lookup services, catalog counts, and dashboard DOM ID contracts. These are code-level tests; they do not substitute for a real browser/device run.

**The physical 10-LED music test has not been verified in this pass.** A historical problem remains: audio can pause around 38–42 seconds when serial output is enabled, while the same media and the FFT-only test continued. A previous reduction to 4 frames per second and latest-frame coalescing did not prove the issue fixed. Follow `integration/test-plans/README.md` and record the actual outcomes at 40 seconds, 90 seconds, and end-of-track before declaring long-playback stability.

## Useful project references

- [Project handoff](BEATSYNC_PROJECT_HANDOFF.md)
- [Frontend architecture](frontend/ARCHITECTURE.md)
- [Current serial protocol](serial-protocol/protocol.md)
- [Hardware test plan](integration/hardware-tests/README.md)
- [Architecture and team decisions](00_PROJECT_CONTEXT/team-decisions.md)
- [Preserved experiments](experiments/README.md)

This integration pass adds no media or lyrics. The earlier owner-requested test fixture at `experiments/media-playback-isolation/test-audio.mp3` is preserved as a diagnostic file; verify reuse rights before republishing the workspace. Existing hardware experiments and firmware remain separate from the dashboard.
