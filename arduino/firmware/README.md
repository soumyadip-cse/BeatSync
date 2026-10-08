# Current 10-LED synchronization firmware

Open `BeatSync10LedTest/BeatSync10LedTest.ino` in Arduino IDE, select Arduino UNO R4 WiFi, and upload. The sketch configures D2,D7,D3,D8,D4,D9,D5,D10,D6,D11 at 115200 baud. It applies the documented digital threshold of 128 to D2/D4/D7/D8 and `analogWrite()` to the six PWM channels.

The serial parser buffers a complete newline-delimited CSV record, requires exactly ten integer values, clamps each to 0–255, and ignores invalid/incomplete frames. Startup is all off, a cumulative channel test at 250 ms per step, all on for 250 ms, then all off. This code does not emit an acknowledgement packet.

Before running an all-on state, verify all ten LEDs have correctly rated current-limiting resistors and the board's GPIO/power constraints. The owner still needs to run the startup/manual/music tests in `integration/hardware-tests/README.md`; source code and automated tests cannot verify wiring or physical output.
