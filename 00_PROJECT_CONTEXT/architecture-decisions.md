# BeatSync architecture decisions

Status: architecture baseline and proposals for the first local browser-to-Arduino prototype. This is not implementation or hardware validation. Changes to the system architecture should also be recorded in `team-decisions.md` with date, rationale, evidence, proposer, and status.

## Decisions and recommendations

| Area | Current decision / recommendation | Status and evidence |
|---|---|---|
| Frontend | Recommend TypeScript + React + Vite for the eventual dashboard. Use browser APIs for real-time work; add no dependencies until implementation is authorized. | Recommendation; supported by the rich interactive dashboard direction and official framework/API documentation. |
| Audio | Local browser graph using Web Audio. Song and future microphone are source adapters feeding the same analysis pipeline. Emit compact timestamped `AudioAnalysis`; waveform/spectrum arrays are optional presentation diagnostics. | Adopted architecture constraint from owner instructions and project context. |
| Lighting | Deterministic engine independent of UI, source capture, serial, and Arduino. Consume analysis + config + previous temporal state; output exactly N hardware-neutral LED states. | Adopted boundary; algorithm details await measured mapping experiment. |
| N-LED mapping | Keep N configurable. Proposed stages are band extraction, independent normalization, attack/release smoothing, mapping to N spatial positions, effects, and clamping. Compare band zones, spectrum interpolation, and hybrid mapping. | Architecture proposed; no mapper selected by measurement yet. Do not freeze arbitrary band boundaries. |
| Serial | Browser Web Serial adapter; versioned bounded messages with framing, length checks, sequence, and CRC. Current proposal is COBS + zero delimiter and CONFIG/FRAME/STATUS/ACK/ERROR types. | Proposal only. CRC parameters, byte order, maximum size, format, rate, browser, and failsafe need resolution and bench tests. |
| Arduino | Validate protocol records, own device config and latest bounded frame, render through a driver abstraction, report status, and enter a defined safe state on loss. No FFT, audio capture, mapping, or UI. | Adopted responsibility boundary; no firmware or hardware validated here. |
| Hardware | Use three ordinary low-current LED outputs for the smallest first proof if compatible with the verified board/driver. Provisional long-term direction: individually addressable RGB pixels for 8–50+ independent color outputs. | Recommendation, not final hardware selection. The development log is historical evidence; exact board, LEDs, wiring, driver, supply, logic-level compatibility, and current budget remain unverified. |
| Microphone | Add later as a distinct browser source adapter into the same Web Audio and lighting pipeline. | Adopted architecture constraint; microphone is out of first prototype scope. |
| Backend/database | Keep inactive in the first local prototype. Later use only for persistent needs such as lyrics, presets, device profiles, and settings. Never route live analysis or frame delivery through them. | Adopted owner/project constraint; no framework, database, or schema selected. |
| 3D/UI | Treat the galaxy/space theme and any Three.js/React Three Fiber scene as presentation only. It consumes sampled application state and contains no FFT, lighting, or serial logic. | Recommendation based on the described reference direction; no scene implemented. |

## First end-to-end prototype

One local song file enters the browser audio graph; the analyzer emits RMS, candidate frequency bands, and beat/onset strength; the lighting engine maps them to three independent mono LED values; the serial adapter transmits frames; Arduino applies them to three physical outputs. Begin with observable debug state, not the premium dashboard. Prove each boundary separately, then integrate. The exact board, driver, wiring, and protocol must be chosen before physical integration. This description is a target, not a claim that the hardware works.

Acceptance evidence should show: analysis responds differently to silence, known tones/sweeps, and music; three output values vary independently and remain bounded; serial records are validated and applied atomically; malformed records do not alter output; loss of valid frames reaches the selected safe state; and actual end-to-end response is measured on the chosen hardware. Expand software mapping tests to N=8, 20, and 50 before scaling the physical array.

## Open engineering questions

1. Which browser and operating system are the supported Web Serial target?
2. Which exact board revision, LED device, driver/library, layout, supply, connectors, protection, and data-level interface will be used?
3. Is the first physical proof discrete monochrome LEDs or a small addressable RGB chain?
4. What audio sample/FFT sizes, band edges/statistics, normalization reference, onset rule, and smoothing values perform well on representative audio?
5. Which N-mapping strategy best meets responsiveness and visual separation criteria?
6. Should frames carry mono intensity or RGB per LED, and which effects are host-rendered versus MCU-rendered?
7. Confirm protocol version, byte order, CRC parameters, max N, baud, update cadence, status cadence, timeout, and safe output behavior.
8. What lyrics source and local persistence are needed? Does a backend/database have a concrete first release use?
9. What latency, dropped-frame, and reconnect behavior counts as acceptable?

## Exact next task after architecture

Design and run an isolated audio → FFT → frequency-band → N-LED mapping experiment. Use silence, known tones/sweeps, and representative prerecorded music; compare candidate mappings with per-band normalization and configurable attack/release; record plots/observations and pass criteria. Keep dashboard, microphone, serial, Arduino firmware, and database implementation out of that experiment. Once the mapping is evidenced, lock its `AudioAnalysis`/`LightingFrame` interface and proceed to the three-output browser-to-Arduino prototype.

## Related documents

- [Complete system flow](../01_RESEARCH/system-architecture.md)
- [Audio model and pipeline](../01_RESEARCH/audio-pipeline.md)
- [Lighting pipeline](../01_RESEARCH/lighting-pipeline.md)
- [N-LED mapping choices](../01_RESEARCH/n-led-mapping-architecture.md)
- [Serial proposal](../01_RESEARCH/serial-architecture.md)
- [Hardware direction](../01_RESEARCH/hardware-architecture.md)
- [Frontend direction](../01_RESEARCH/frontend-architecture.md)
- [Frontend layer boundaries](../frontend/ARCHITECTURE.md)
- [Arduino responsibilities](../arduino/architecture.md)
