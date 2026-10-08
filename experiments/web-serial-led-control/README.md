# BeatSync 10-LED Browser-to-Arduino Synchronization Proof

This is the existing plain HTML/CSS/JavaScript experiment extended from one LED to ten individual LEDs. It is a hardware synchronization proof, not the final dashboard. The physical 10-LED path still needs to pass the tests below before it can be called verified.

## Hardware and pin order

Board: **Arduino UNO R4 WiFi**. Each LED needs its own current-limiting resistor and its cathode returns to GND. The browser frame order is red, green within each physical column:

| Frame index | Browser LED | Physical LED | Pin | Output handling |
|---:|---|---|---|---|
| 0 | LED 1 | Column 1 red | D2 | Digital threshold |
| 1 | LED 2 | Column 1 green | D7 | Digital threshold |
| 2 | LED 3 | Column 2 red | D3 | PWM |
| 3 | LED 4 | Column 2 green | D8 | Digital threshold |
| 4 | LED 5 | Column 3 red | D4 | Digital threshold |
| 5 | LED 6 | Column 3 green | D9 | PWM |
| 6 | LED 7 | Column 4 red | D5 | PWM |
| 7 | LED 8 | Column 4 green | D10 | PWM |
| 8 | LED 9 | Column 5 red | D6 | PWM |
| 9 | LED 10 | Column 5 green | D11 | PWM |

PWM uses `analogWrite(value)` on D3, D5, D6, D9, D10, D11. D2, D4, D7, D8 are digital-only in this profile: values `>=128` become HIGH and values `<128` become LOW. No software PWM is simulated. The virtual preview shows the exact requested logical 0-255 value; digital-only physical outputs are binary. Arduino's UNO R4 WiFi guide lists the supported PWM pins and its datasheet specifies 8 mA safe current per GPIO. Verify the fitted resistor values keep each pin within its rating before powering all outputs. [UNO R4 WiFi pin/PWM guide](https://docs.arduino.cc/tutorials/uno-r4-wifi/cheat-sheet/), [UNO R4 WiFi datasheet](https://docs.arduino.cc/resources/datasheets/ABX00087-datasheet.pdf).

## Arduino firmware

Open `arduino/firmware/BeatSync10LedTest/BeatSync10LedTest.ino` in Arduino IDE and upload it to **Arduino UNO R4 WiFi**. It starts serial at 115200, sets D2-D11 as outputs, begins all off, then turns LEDs on cumulatively from LED1 through LED10 with 250 ms between steps. It holds all on for another 250 ms, then turns all LEDs off. It then accepts newline-terminated 10-integer frames. A line must contain exactly ten comma-separated values; invalid/incomplete lines are ignored. All ten values are parsed and clamped before outputs are changed.

Close Arduino Serial Monitor before using the browser because the serial port should have one owner at a time.

## Temporary serial frame protocol

The browser sends exactly ten decimal integer values in physical mapping order, separated by commas and terminated by newline:

```text
L0,L1,L2,L3,L4,L5,L6,L7,L8,L9\n
120,80,30,200,255,100,40,180,220,90\n
```

Every value is clamped to `0-255`. This simple CSV line protocol is for this experiment only. It is not the proposed future COBS/CRC/versioned protocol and does not preserve the old one-integer wire format. The browser opens the selected Web Serial port at 115200 baud. It permits one `writer.write()` at a time and retains at most one pending latest frame; a newer pending frame replaces an older unsent frame. The firmware sends no acknowledgements: a successful browser write means Web Serial accepted the bytes, so physical LED response must still be visually verified.

## Manual wiring/output test

1. Upload the firmware and verify its short sequential startup test, ending with all LEDs off.
2. Open this folder's `index.html` in a Web Serial-capable Chromium browser on localhost or HTTPS. Select **Connect Arduino** and choose the UNO R4 WiFi port.
3. Click **Run 10 LED Test**. It sends all-off, then LED1 through LED10 one at a time (each 255 and the other nine 0), all-on, then all-off. Check each physical LED against the virtual preview and pin table. Each preview label shows both LED number and L0-L9 frame index.
4. The **Uniform brightness** slider plus **Send to all LEDs** checks general frame transmission. Use `0`, `127`, `128`, and `255` to check digital thresholds and PWM endpoints. **Live uniform frame** sends while the slider moves.
5. The first one-hot frame in the sequence is `255,0,0,0,0,0,0,0,0,0`; the next is `0,255,0,0,0,0,0,0,0,0`, continuing through LED 10. The all-on frame is `255,255,255,255,255,255,255,255,255,255`. The separate **Test 10 LEDs Simultaneously** button sends exactly `255,180,160,140,120,100,80,60,40,20` in one frame; check all ten outputs from that single frame.
6. For a custom one-hot test, enter exactly ten comma-separated values in **Custom 10-value frame** (for example `255,0,0,0,0,0,0,0,0,0`) and choose **Send custom frame**. Invalid lengths or values outside 0-255 are rejected.

An all-on test draws current on all ten outputs at once. Only run it after checking resistor values and per-pin current against the board rating.

## Audio bands and ten-value mapping

The current audio graph remains `HTMLAudioElement -> MediaElementAudioSourceNode -> AnalyserNode -> AudioContext.destination`. FFT configuration remains `fftSize=2048`, `smoothingTimeConstant=0.65`; actual `AudioContext.sampleRate` determines the bin spacing. The existing full-range RMS reading and single-value brightness remain visible for comparison: RMS over 40-20,000 Hz (capped by Nyquist), multiplied by the sensitivity value and clamped to 0-255.

For the ten outputs, each band's stable energy is its RMS byte magnitude divided by 255. This fixed full-scale normalization preserves absolute loudness; no per-frame strongest-band normalization is used. Actual bin spacing is `audioContext.sampleRate / analyser.fftSize`, and available FFT bins cap the 20 kHz edge at the device's Nyquist frequency. Frequency edges are configurable in `app.js`:

| Band | Start | End |
|---|---:|---:|
| bass | 40 Hz | 250 Hz |
| low-mid | 250 Hz | 500 Hz |
| mid | 500 Hz | 2,000 Hz |
| high-mid | 2,000 Hz | 6,000 Hz |
| treble | 6,000 Hz | 20,000 Hz |

The 10 logical outputs are weighted from the five normalized bands and overall energy, then scaled by sensitivity and clamped to `0-255`:

```text
L0  = bass
L1  = bass * 0.70 + lowMid * 0.30
L2  = lowMid
L3  = lowMid * 0.55 + mid * 0.45
L4  = mid
L5  = mid * 0.55 + highMid * 0.45
L6  = highMid
L7  = highMid * 0.55 + treble * 0.45
L8  = treble
L9  = treble * 0.75 + overallEnergy * 0.25
```

Attack/release smoothing uses configurable per-frame coefficients `0.38` / `0.12`, adjusted for elapsed animation-frame time. A deterministic transient detector compares overall energy against a slowly moving two-second baseline and the previous frame; a detected transient creates a 350 ms decaying pulse. Per-LED peak boosts are `45,40,38,34,30,28,24,20,18,14`, so each output receives a different boost. These are initial tunable values, not a calibrated final lighting engine.

Automatic audio frames are sent every **250 ms** (about 4 frames/s), configurable as `SERIAL_FRAME_INTERVAL_MS` in `app.js`. This preserves the conservative cadence introduced during the earlier audio-pause investigation. Ten-value frames contain at most 40 ASCII bytes including newline, about 160 bytes/s at 4 frames/s. Previous serial-enabled runs paused around 38-42 seconds; the one-write/latest-frame strategy did not eliminate the pause. The result of the 250 ms test was not yet known when this README was updated. No pause/play/restart workaround is used.

## Browser audio synchronization test

1. Confirm the ten physical outputs with the manual test first.
2. Connect Arduino in the page; keep Serial Monitor closed.
3. Select the full local test media file, enable **Send audio to 10 LEDs**, and press the native audio Play control.
4. Verify browser playback, FFT/band values, ten logical preview values, sent frames, and physical outputs.
5. Observe beyond 40 seconds, beyond 90 seconds, and through end of file (the test file is about 3:59). Diagnostics mark 40 seconds, 90 seconds, and end reached. Record any pause event, current time, FFT, frame counts, write errors, writer overlap/backpressure, connection state, and last frame.

## Diagnostics and current status

The page preserves audio time, FFT RMS, calculated brightness, all five normalized bands, beat state, current and last-sent 10-value frames, connection state, analysis-loop state, send count, successful/failed writes, active writes, overlaps, peak active writes, backpressure observations, writer desired size, runtime errors, and newest 20 media events. It also shows frame size, last frame timestamp, and whether playback reached 40 s, 90 s, and `ended`. Connection attempts record request/open/writer phases and exact errors.

The custom frame control accepts exactly ten comma-separated integers from 0 to 255 for one-hot/manual channel checks. Previously confirmed: the one-LED browser manual serial path worked for 0-255; native audio, Web Audio routing, and FFT without serial continued beyond 90 seconds. Serial enabled at the previous faster rate coincided with a pause near 40 seconds; the precise cause is unresolved. The move to ten outputs is a **10-LED browser-to-Arduino synchronization proof** and is not physically verified until the owner completes the tests above.

### Actual test results

- Source implementation: present; `node --check app.js` passed after the latest changes.
- Arduino compile/upload and physical one-hot test: not run in this environment.
- Real-song browser-to-10-LED test at 250 ms, including 40 s / 90 s / full-duration milestones: not run in this environment. Do not treat the physical synchronization result as verified yet.

## Browser requirements

Web Serial requires browser support, a secure context (localhost is generally accepted), a user gesture to request the port, and permission to access the selected device. Use a supported Chromium-based browser.
