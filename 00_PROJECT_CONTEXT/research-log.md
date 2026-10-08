# Research and experiment log

Use one entry per investigation or hardware/software experiment. Separate established facts from assumptions and proposals.

## Entry template

- Date:
- Question:
- Source or hardware/software setup:
- Procedure and input:
- Observed output:
- Result: verified / failed / inconclusive
- Limitations:
- Integration recommendation:
- References:
- Proposer or tester:

## Initial workspace review - 2026-10-03

- Result: The workspace had no project source files or configuration files. The supplied master context PDF and SONICLUX development log were copied into this directory from the user's Downloads folder.
- Limitation: The log records prototype results, but no source code, wiring diagram, or raw measurements were present to reproduce them.
- Follow-up: Bring the prototype source and exact hardware setup into the project before claiming a reproducible baseline.

## Integrated dashboard foundation - 2026-10-06

- Question: Can the existing dashboard support configurable music-reactive lighting, lyrics/metadata lookup, microphone input, and the current ten-output profile without moving the real-time path to a backend or replacing the frontend?
- Source or setup: Existing vanilla frontend, `AudioAnalyzer`, 10-LED UNO R4 profile/sketch, temporary 115200-baud CSV protocol, supplied BeatSync master PDF/history, and owner-provided integration prompt.
- Procedure and input: Inspected the current modules and history; implemented source/hardware/metadata boundaries; used deterministic synthetic quiet, steady, transient, and periodic-bass sequences; ran `npm test` and per-file Node syntax checks.
- Observed output: Steady synthetic input exposed self-normalization to full scale in the earlier adaptive envelope. Mixing an absolute loudness reference with the adaptive relative term preserved headroom; synthetic bass events then produced measurable transient/beat events and a 100 BPM estimate. Serial tests observed maximum one active write and replacement of pending frames with the newest. Final `npm test` result: 20 passed, 0 failed; Node syntax checks: 29 JavaScript files passed.
- Result: Code-level boundaries verified by Node tests. Dashboard/browser playback, external lyric API response, USB/Arduino operation, and physical LEDs were not observed.
- Limitations: UI browser surface was unavailable in the tool session; no physical hardware was accessible. The historical serial-enabled media pause near 38–42 seconds remains unresolved, and the optional Chromaprint provider is not bundled.
- Integration recommendation: Use the current localhost dashboard, run the manual sequence in `../integration/test-plans/README.md`, retain media event history, and record real 40 s, 90 s, and end-of-track outcomes before claiming full-song stability.
- References: `frontend/ARCHITECTURE.md`, `serial-protocol/protocol.md`, `integration/hardware-tests/README.md`, and team decision D-006.
- Proposer or tester: Project owner request; implementation and Node tests by Codex on 2026-10-06.
