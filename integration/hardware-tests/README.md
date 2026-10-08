# Physical hardware verification log

Use this file only for directly observed results. The dashboard's frame preview and successful `writer.write()` are not evidence that a physical LED lit.

## Current test configuration

- Board: Arduino UNO R4 WiFi
- Firmware: `arduino/firmware/BeatSync10LedTest/BeatSync10LedTest.ino`
- Baud: 115200
- Frame: exactly 10 CSV integers `L0..L9\n`
- Physical outputs: L0 D2 digital; L1 D7 digital; L2 D3 PWM; L3 D8 digital; L4 D4 digital; L5 D9 PWM; L6 D5 PWM; L7 D10 PWM; L8 D6 PWM; L9 D11 PWM.
- Digital threshold: `<128` off, `>=128` on. PWM values use the 0–255 range.
- Wiring/current safety: verify one correctly rated series resistor per LED and the board current limit before all-on tests. Do not infer wiring safety from this software profile.

## Procedure

1. Flash the documented sketch and observe its startup test: all-off, cumulative outputs, all-on, all-off. Record physical order and any missing/faint LEDs.
2. Close Arduino Serial Monitor. Start BeatSync (`npm start`), open localhost in Chromium, and select **Connect Arduino**. Confirm the port opens before enabling output.
3. Send all-off, all-on, one-hot per channel, and `255,180,160,140,120,100,80,60,40,20`. Compare every channel with the physical mapping table.
4. Run media with serial disabled for at least 90 seconds. Confirm playback and logical LED preview move.
5. Restart the same media, connect the board, enable serial, and observe beyond 40 seconds, 90 seconds, and end-of-track (~238.6 seconds for the reference file). Note audio state, analysis frame count, serial writes/errors/pending count, and actual LED behavior.
6. Repeat with a board disconnect during playback, then user reconnect. Confirm audio continues and the UI reports state accurately.

## Results

No physical retest was performed during the current software implementation pass. Keep this status until the above steps are run on the actual board:

| Date | Board / firmware | Test and media | Observed result | Pass/fail |
| --- | --- | --- | --- | --- |
| Pending | UNO R4 WiFi / ten-LED sketch | Awaiting owner-run physical verification | Not yet observed | Pending |

