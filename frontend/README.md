# BeatSync dashboard frontend

This is the project's existing dashboard: plain HTML/CSS/JavaScript ES modules with no UI framework or runtime package dependencies. Start the loopback server from the repository root with `npm start`, then open `http://localhost:8000/`.

## Modules

- `app.js`: user actions, playback/source state, display updates, and composition of the modules.
- `audio/LocalSongSource.js`: user-selected audio/video files and object URL cleanup; selection loads but does not autoplay.
- `audio/MicrophoneSource.js`: explicit `getUserMedia` acquisition/device selection and stream cleanup.
- `audio/AudioAnalyzer.js`: one cached media-element source, reusable FFT/waveform buffers, measured bands/RMS, and source switching.
- `audio/audioConfig.js`: FFT, frequency-band, serial cadence, and preset defaults.
- `lighting/LightingEngine.js`: deterministic configurable-N mapping, normalized bands, event pulses, beat confidence/BPM support, and attack/release smoothing. It contains no physical pin mapping or DOM operations.
- `hardware/Arduino10LedProfile.js`: current ten physical output order, PWM capability, digital threshold, N-to-10 resampling, and physical frame normalization.
- `serial/SerialProtocol.js` and `SerialTransport.js`: ten-integer CSV/newline frames and explicitly user-initiated Web Serial with one active write plus one replaceable pending latest frame.
- `metadata/`: ID3/filename metadata, LRCLIB matching, optional Chromaprint injection, AcoustID matching, and MusicBrainz resolution.
- `lyrics/LrcLyrics.js`: timed LRC parsing and lookup of the active cue using media time.
- `library/catalog.js`: 40 metadata-only titles (eight each in English, Hindi, Punjabi, Bhojpuri, and Bengali).
- `visualizer/DashboardVisuals.js`: measured canvas plots, logical LED view, physical profile preview, and CSS sculpture.
- `tests/`: Node built-in tests for the subsystem boundaries and UI ID contract.

## Behaviors and honest limits

Song and microphone adapters share `AudioAnalyzer` and `LightingEngine`; microphone mode does not perform song identification. Real FFT, waveform, and playback measurements appear only after a source is active. Logical count is configurable independently from the current ten physical outputs. Four UNO pins are digital-only at threshold 128; six support PWM. The hardware preview is mapped from the same logical frame that the sender uses.

The serial transport rate is configurable, defaults to 100 ms, and does not await a write inside the animation-frame loop. The queue is bounded to one active write and one latest pending frame. The firmware has no acknowledgement, so the UI distinguishes a browser write from measured physical state.

The page uses the local `backend/dev-server.js` only for LRCLIB/MusicBrainz/AcoustID lookup relay. It receives no audio and is not in the analysis, lighting, or LED-frame path. AcoustID needs a local `.env` key **and** an injected Chromaprint provider; no provider or key is bundled. Tag/filename lookup, manual title/artist lyric search, and user-selected `.LRC` remain available without it.

Run the code-level tests from root with `npm test`. They do not verify browser autoplay/codec behavior, actual Web Serial hardware, long playback, or physical LED response. See the root README and integration test plan before running the physical proof.
