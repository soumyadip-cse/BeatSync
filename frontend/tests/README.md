# Frontend boundary tests

Run from repository root with `npm test` (Node's built-in `node:test`; no test packages are installed).

The suite covers source selection/object URL cleanup/no autoplay, AudioAnalyzer graph reuse and measured feature output using a fake AudioContext, microphone constraints/cleanup, deterministic N-output lighting with quiet/steady/transient/beat sequences, digital/PWM hardware mapping, CSV parsing/clamping, SerialTransport open/cancel/disconnect/reconnect/latest-frame coalescing/no overlaps, ID3/filename parsing, LRCLIB match/no-match/network failure, MusicBrainz mapping, AcoustID confidence filtering, LRC seek indexing, catalog composition, and static dashboard selector IDs.

These tests verify code boundaries, not a real browser's supported codecs, browser permission prompts, live API match quality, Web Serial hardware, Arduino parsing, long playback, or physical LEDs. Those remain in the manual plans under `integration/`.
