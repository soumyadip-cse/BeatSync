# Team decisions

Architecture, mapping, hardware, protocol, and cadence decisions are recorded with date, rationale, evidence, proposer, and status. Historical decisions are retained when later work supersedes them.

## D-001: Keep host analysis, lighting mapping, transport, firmware, and UI modular

- Date: 2026-10-03
- Status: Current constraint.
- Decision: Keep these responsibilities separate and communicate through documented data boundaries.
- Rationale: This supports independent testing, configurable LED count, and downstream reuse for microphone input.
- Evidence: Supplied project master context; subsequent modular implementation and boundary tests.
- Proposed by: Project master context; recorded during workspace setup.

## D-002: Run the real-time pipeline locally in the browser

- Date: 2026-10-03
- Status: Current constraint.
- Decision: Song and microphone source adapters feed browser Web Audio, lighting, virtual display, and Web Serial. Metadata lookups may use the local Node relay; raw audio, analysis, and LED frames do not.
- Rationale: Keep the response local and prevent metadata/backend work from entering the real-time loop.
- Evidence: Explicit project-owner instructions; architecture and modules keep the audio/lighting/serial frame path frontend-local.
- Proposed by: Project owner.

## D-003: Keep the documented binary protocol as a proposal until it is implemented

- Date: 2026-10-03
- Status: COBS/CRC message format remains a future proposal; temporary CSV protocol is active.
- Decision: Preserve the current 10-value CSV/newline contract in browser and firmware until a replacement is jointly implemented and tested. Keep any future binary framing proposal clearly labeled as such.
- Rationale: Avoid silent incompatibility with the existing serial firmware.
- Evidence: Current 10-LED sketch and sender both use ten CSV integers and newline at 115200 baud.
- Proposed by: Project owner; recorded during architecture documentation.

## D-004: Build the screenshot-led dashboard with native modules

- Date: 2026-10-05
- Status: Implemented; the separate 10-LED experiment remains preserved.
- Decision: Use dependency-free HTML/CSS/JavaScript ES modules under `frontend/`, with a blue/sea-blue galaxy dashboard, canvas charts, and CSS 3D sculpture. Do not migrate to React or Three.js for appearance alone.
- Rationale: Match the owner-supplied dashboard reference and keep the existing browser architecture.
- Evidence: Owner request and reference image; dashboard code in `frontend/`.
- Proposed by: Project owner.

## D-005: First dashboard tuning pass for clipping and local timed lyrics

- Date: 2026-10-05
- Status: Historical tuning superseded by D-006 for shared band normalization and lyric sources; screenshot evidence remains valid.
- Decision: Reduce sensitivity, shape band values before intensity scaling, retain 250 ms cadence in the separate LED experiment, and initially support user-selected local `.LRC` files.
- Rationale: Owner-supplied capture showed many outputs clamped at 255 and an empty lyrics card. Digital-only outputs at/above 128 were held on.
- Evidence: Screenshot/video and firmware threshold; the physical response was not reverified at that time.
- Proposed by: Project owner.

## D-006: Integrate the configurable music-lighting foundation in the current dashboard

- Date: 2026-10-06
- Status: Implemented and code-level tested; browser/device and physical acceptance pending.
- Decision: Use a deterministic configurable-N engine that combines measured absolute loudness with adaptive band-relative energy, transient pulses, bass beat confidence/refractory timing, interpolation, optional per-output scaling, presets, and attack/release. Separate the current ten-channel profile and N-to-10 resampling. Keep serial at one active write plus one replaceable latest frame, default 100 ms, and never await I/O in the audio loop. Add explicit microphone source mode, ID3/filename metadata, asynchronous LRCLIB and manual lyric lookup, local synced `.LRC`, a metadata-only 40-entry catalog, and optional AcoustID/MusicBrainz fingerprint resolution. The small loopback server handles metadata lookup only and does not receive audio or LED frames.
- Rationale: Deliver the owner-requested integration in the existing site, address saturated/stale-looking outputs and blank lyrics, and keep the software/hardware boundaries intact.
- Evidence: Owner's 2026-10-06 comprehensive request; existing ten-channel sketch/profile; deterministic synthetic input checks; 20 Node tests passing. No browser, live API, USB board, or physical LED verification was available. The historical serial-enabled audio pause around 38–42 seconds remains unresolved.
- Proposed by: Project owner; implemented by Codex for review.

## D-007: Multi-target static and cloud deployment configuration (GitHub Pages, Vercel, Netlify)

- Date: 2026-10-08
- Status: Implemented and tested.
- Decision: Add root entrypoint redirection, .nojekyll flag, relative asset paths, vercel.json, netlify.toml, and modular serverless api/ handler. The core real-time audio and serial architecture remains 100% frontend-local and deterministic.
- Rationale: Enables zero-friction hosting on GitHub Pages, Vercel, and Netlify while preserving local dev-server and test workflows.
- Evidence: 20/20 unit tests pass; dev-server redirect verified; GitHub Pages live asset verification; Vercel and Netlify configurations added.
- Proposed by: Project owner request.

## D-008: Website name change to Spectrasync

- Date: 2026-10-09
- Status: Implemented and deployed.
- Decision: Rebrand user-facing website title, headers, hero tags, and footer from BeatSync to Spectrasync to resolve naming collision with an existing third-party service. All core deterministic real-time audio, lighting engine, hardware profiles, and serial communication remain completely untouched.
- Rationale: Project owner identified an existing site named beatsynk and requested updating website branding to Spectrasync without changing any underlying code.
- Evidence: Project owner request; verified unchanged audio/serial architecture and tests.
- Proposed by: Project owner.

## Current open acceptance items

- Verify local media playback/codec handling, seeks, actual LRCLIB results, synced/plain/no-match lyrics, microphone permission, and source switching in a supported browser.
- Verify wiring, current limits/resistors, physical channel order, and actual brightness on the UNO R4 WiFi.
- Repeat full-song playback with serial off and on and the board disconnected; record media events and actual LEDs at 40 seconds, 90 seconds, and end-of-file. Do not mark the historic pause resolved before that test passes.
- Select/license a compatible Chromaprint provider before enabling the optional AcoustID fallback; the integration hook exists, the provider is not bundled.
- Select any persistence/database only if a specific saved-data requirement is approved.

