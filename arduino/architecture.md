# Arduino architecture

## Current implementation status

One candidate UNO R4 WiFi sketch exists at `firmware/BeatSync10LedTest/BeatSync10LedTest.ino`. It implements the temporary ten-integer CSV/newline protocol at 115200 baud. Its code has not been physically revalidated in this integration pass. This is separate from the future COBS/CRC message proposal in `../serial-protocol/message-format.md`.

## Responsibilities and boundary

Arduino firmware receives complete frames, validates exactly ten values before applying them, clamps to 0–255, and drives the pin profile. Audio capture, FFT, song interpretation, logical N-to-10 mapping, lyric lookup, dashboard, and metadata remain in the browser/application. The firmware provides no acknowledgement packet; a Web Serial stream write is not proof of physical LED state.

Current pin order: D2, D7, D3, D8, D4, D9, D5, D10, D6, D11. D2/D4/D7/D8 are digital-only and use threshold 128. D3/D5/D6/D9/D10/D11 support PWM. The sketch has a startup all-off/cumulative/all-on sequence, but resistor, current, polarity, and board limits must be checked on the actual bench before an all-on state.

The larger versioned binary parser, device status/ACK, configurable physical pixel driver, and timeout failsafe remain future work. They are not silently assumed by the active temporary implementation.
