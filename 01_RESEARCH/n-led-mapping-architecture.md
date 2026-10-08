# N-LED mapping architecture

## Principle

FFT bin count and physical LED count are different dimensions. Reduce the spectrum to a small feature vector, then map that vector into an output array of configurable length `N`. The same algorithm should handle 3, 8, 20, or 50 LEDs without changing its core code.

## Processing stages

1. **Extract bands:** group bins using boundaries selected by listening/tests. The five labels bass, low-mid, mid, high-mid, and treble are useful initial features, but the prior Python boundaries are historical starting points, not final browser settings.
2. **Normalize independently:** maintain an appropriate floor and slowly adapting ceiling for each band. Compress dynamic range and clamp to `[0,1]`; this directly addresses the logged bass saturation. Preserve a calibration preset so comparisons are reproducible.
3. **Smooth:** use different attack and release time constants. A fast attack catches transients; a slower release avoids flicker. Values must be tuned from measured tracks rather than chosen by taste alone.
4. **Map features to positions:** define each LED's normalized position from its layout. Interpolate between band anchors or use a log-frequency position to create a spectrum response. This produces `N` values from a fixed number of audio features.
5. **Add controlled motion:** optionally combine the spectral base with a beat transient, travelling wave, or pulse. Derive phase from elapsed time/beat events and LED position. Neighbor influence can soften adjacent values but must not collapse the whole array into one identical output.
6. **Apply output limits:** sensitivity, global brightness cap, and channel/hardware profile clamp the resulting frame before transport.

## Candidate strategies

- **Band zones:** divide LEDs among frequency bands. It is easy to explain and test; identical outputs within a zone can look static unless position offsets are added.
- **Spectrum-to-position:** interpolate spectral energy along the LED layout. It reads like an equalizer and scales naturally; it needs careful normalization and smoothing.
- **Hybrid feature mapping (recommended first experiment):** use band energy for each LED's base, overall RMS for global response, and beat strength for a short transient overlay. Add spatial phase/neighbor influence only after the base mapping works.

The first experiment should compare band-zones and spectrum-to-position using the same recorded `AudioAnalysis` sequence. Then test hybrid changes one at a time. Do not add randomness to create apparent independence; differences should follow audio features and LED position.

## Frequency ranges are open

Do not freeze the old 20-250 / 250-500 / 500-2000 / 2000-6000 / 6000-20000 Hz ranges yet. The useful lower/upper bins depend on actual sample rate and FFT size, and human hearing is not linear in frequency. Compare linear and logarithmic ranges with tones/sweeps and multiple music samples. Record false emphasis, missing bands, and saturation.

## Acceptance path

First prove three independently varying outputs in software, using a stable input and a recorded frame sequence. Then confirm the mapper produces exactly `N` values for 8, 20, and 50 without hard-coded branches. Only after those checks should physical hardware scale beyond the first three outputs.
