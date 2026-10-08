# Microphone mode - future phase

Add microphone capture only after Song Mode is stable. Capture runs locally in the frontend and acts as a separate source adapter feeding the same Web Audio analysis, lighting engine, and Web Serial path as songs.

Future work must cover user permission, input selection, gain, echo/feedback behavior, and cleanup when capture stops. Microphone audio must not be routed through backend services. No microphone code is implemented.
