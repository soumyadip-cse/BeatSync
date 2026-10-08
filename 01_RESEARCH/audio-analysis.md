# Audio analysis

## Scope

Describe the audio input and source-independent measurements used by the lighting system. Song playback is first; microphone capture is a later input adapter.

## Known direction

The current architecture specifies browser-local Web Audio analysis of waveform and frequency data. The supplied development log reports an earlier Python/librosa prototype; its source is not in this workspace. The Python record is historical and does not change the current browser target.

## Questions to answer

- What sample rate and analysis window are available at runtime?
- Which time-domain measure represents overall energy, and how is it calibrated?
- Which features are shared between song and microphone input?
- What attack/release or smoothing times create responsive but stable values?
- How will analysis be tested with tones, sweeps, silence, and varied music?

Record the actual input, settings, and observed values in `../00_PROJECT_CONTEXT/research-log.md`.
