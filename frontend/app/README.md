# Frontend application shell

`../app.js` coordinates the dashboard UI with the local song source, Web Audio analyzer, lighting engine, serial adapter, and visualizer. Keep those subsystem boundaries independent; the DOM layer renders sampled state and routes user actions.
