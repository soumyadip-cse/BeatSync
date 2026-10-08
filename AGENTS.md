# BeatSync project instructions

- Read `00_PROJECT_CONTEXT/BeatSync_Project_Master_Context_v1.pdf` and relevant project notes before major architectural changes.
- Keep the core audio-to-light behavior deterministic. Do not introduce AI or machine learning into the core system unless explicitly requested.
- The real-time audio pipeline runs locally in the frontend: source, Web Audio analysis, FFT/features, lighting engine, LED states, and Web Serial. Never route real-time audio analysis or the LED frame loop through the backend or database.
- Keep the lighting engine independent from UI presentation.
- Keep serial communication independent from the lighting engine.
- Keep Arduino firmware separate from frontend and backend code.
- Use the backend and database only for persistent/application-level data such as metadata, lyrics, presets, configurations, and settings. Accounts remain optional and future work.
- Song Mode and future Microphone Mode must use different source adapters feeding the same downstream analysis pipeline.
- Treat LED count as configuration. Do not hard-code a fixed count into the lighting engine.
- Do not implement large subsystems before their architecture and interfaces are understood. The current scope is architecture and documentation; do not add application implementation code until requested.
- Verify board, LED, driver, power, browser, and serial assumptions against the exact hardware/runtime before implementation.
- Do not modify unrelated files. Do not add dependencies until a concrete implementation need is approved.
- Test subsystems independently at their boundaries before integration or declaring them complete; record setup and observable results.
- Never present placeholder or simulated dashboard values as live audio or Arduino measurements.
- Record architecture changes in `00_PROJECT_CONTEXT/team-decisions.md` with date, rationale, evidence, proposer, and status. Preserve existing user files and prototype behavior unless asked to change them.
