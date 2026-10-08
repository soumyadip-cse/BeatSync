# Media playback isolation experiment

A minimal native media playback diagnostic. It does not use Web Audio, Web Serial, Arduino, timers, or playback automation.

## Open locally

Open `index.html` directly in a browser:

`D:\my project works\websites\Beat Synk\experiments\media-playback-isolation\index.html`

Choose an audio or video file. The page displays the file name, MIME type, and size, then assigns a local object URL to the native `<audio controls>` element. Use the browser's native controls to play or pause it.

## Diagnostics

The page displays current time, duration, and a status of PLAYING, PAUSED, ENDED, or ERROR. The event panel and browser console record media events with the media element's current state. The panel retains the newest 20 events first.

The application calls `load()` only when a new file is selected. It does not automatically call `play()` or `pause()`, change `currentTime`, or attempt recovery. It does not create an AudioContext or analyser and has no playback timer or animation loop.
