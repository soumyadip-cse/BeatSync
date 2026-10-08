# Dashboard visualizer

`DashboardVisuals.js` presents measured waveform/spectrum data, normalized frequency meters, a data-driven logical LED view for 1–256 outputs, a ten-channel physical-profile preview, and a CSS 3D sculpture. Logical and physical counts are labeled separately. The virtual display is derived from the engine frame and the same mapped ten-value frame that goes to serial; preview and last writer-accepted frames are labeled distinctly. The firmware has no ACK, so the display does not claim physical measurement.
