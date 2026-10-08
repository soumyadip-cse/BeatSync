# Lighting engine boundary

`LightingEngine.js` receives analyzed bands, overall energy, frame timestamp, and configurable controls. It returns exactly N values in the 0–255 range plus beat/transient diagnostics. Optional `outputScales` can dim or boost individual logical positions without tying the engine to a physical pin. The engine has no DOM, audio element, serial writer, pin number, or backend dependency.

The deterministic model combines an absolute loudness reference with adaptive band-relative energy so steady input does not normalize itself to full brightness; short rising-energy pulses; bass fast/slow envelope difference, confidence, and refractory timing; and separate attack/release smoothing. Five bands are interpolated across output positions with adjacent-band mixing. Presets adjust one shared configuration. BPM is returned only after enough stable beat intervals; otherwise the value is `null`.

The physical ten-output wiring and digital/PWM behavior live separately in `hardware/Arduino10LedProfile.js`. This permits 8/10/20/50/256 logical output tests without changing the engine. Automated tests exercise quiet, steady, transient, beat, smoothing, determinism, and output length; music quality and actual LED motion still require listening and hardware acceptance tests.
