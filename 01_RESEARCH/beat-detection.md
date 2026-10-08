# Beat and energy detection

## Scope

Specify energy/onset features and transient events separately from continuous frequency-band values. AI/ML is not required for the core detector.

## Starting approach from the project context

Compare short-term energy with a recent moving reference. A positive jump may produce an onset event; tune a threshold and refractory period to reduce duplicate triggers.

## Open questions

- Which energy feature and history length work across different genres?
- What threshold and refractory period avoid repeated triggers on one event?
- Should tempo estimation be separate from onset detection?
- How should a beat affect brightness without saturating the output?
- What labeled clips or manual observations will be used to measure false and missed detections?

Record test inputs and counts; do not describe a detector as reliable from one song alone.
