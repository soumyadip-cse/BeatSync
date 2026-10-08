# Integration test plan

## Test setup

- BeatSync dashboard on `http://localhost:8000/` from `npm start`.
- Current supported Chromium browser; confirm `navigator.serial` exists.
- Arduino UNO R4 WiFi with the separate ten-LED firmware flashed.
- Ten discrete LEDs with safe series resistors; confirm D2,D7,D3,D8,D4,D9,D5,D10,D6,D11 order. Close Arduino Serial Monitor.
- User-provided media with known duration (preferably over four minutes) and a separate local `.LRC` fixture if available.
- Record browser, operating system, board/firmware revision, media type/length, and whether the physical board is connected for each run.

## Boundary sequence

1. **Media/source:** select a known local audio file, verify the metadata, play/pause/seek, load a second file, and confirm the first object URL is discarded on source cleanup. Repeat with a video container carrying audio.
2. **Analysis only:** leave serial output disabled; verify current time advances, FFT/band meters/waveform/RMS update, and the logical frame changes. Listen for audio through the browser. Observe at 40 seconds, 90 seconds, and end-of-track.
3. **Lighting dynamics:** compare a quiet section and a loud section; check transient band, bass beat confidence/count, attack, natural release, and movement from low to high bands. BPM may be `—` until stable intervals are observed.
4. **Serial manual:** connect from the button at 115200; exercise all-off, all-on, one-hot sequential, and `255,180,160,140,120,100,80,60,40,20`. Check physical pin order and distinguish PWM from digital switching.
5. **Serial music:** restart the same file, enable audio-to-Arduino, and observe the music-reactive frame at 40 seconds, 90 seconds, and end-of-track. Record whether media remains playing, analysis frames continue, serial write errors remain zero, active writes stay at most one, and the newest physical LED frame changes. Repeat after disconnecting the board.
6. **Long playback:** repeat step 5 on the same 238.6-second reference file and retain event history/connection diagnostics. A failure is not considered fixed unless the browser media event history and physical output both continue through end-of-file.
7. **Mic/source switching:** start microphone only with explicit permission; confirm FFT/lighting uses the same engine. Stop mic, choose a song, seek, and change tracks. Confirm no duplicate RAF or live stream remains.
8. **Lyrics:** confirm tagged or filename title/artist auto lookup; correct metadata manually and search; verify synced cue changes on playback and seek, plain lyrics are unsynchronized, and no-match/network-failure states are visible.

## Record results

For each case add date/time, test input, expected result, observed result, pass/fail, and any diagnostics to `integration/hardware-tests/README.md`. Do not mark a browser write as physical LED acknowledgement. Automated code tests are necessary but do not replace this plan.
