# LED mapping

## Scope

Define how measured audio features become `N` independent LED states. `N` is configuration, not a compile-time constant buried in the algorithm.

## Candidate strategies

- Band zones: allocate LED positions to frequency bands.
- Spectrum position: interpolate band or bin energy across a linear, circular, or matrix layout.
- Hybrid: combine band energy with overall energy, beat events, and time-based patterns.

These are options from the project context, not selected behavior.

## Open questions

- What state does each LED need: brightness only, RGB color, phase, or pattern metadata?
- How will neighboring LEDs differ while remaining musically meaningful?
- How will sensitivity, brightness cap, smoothing, and beat response interact?
- What mapping produces visibly different simultaneous states at the agreed MVP count?

Validate the mapping without hardware first, then compare calculated frames with physical output.
