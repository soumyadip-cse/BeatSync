# Arduino subsystem

Arduino firmware remains separate from the dashboard's audio analysis, lighting engine, metadata service, and serial transport. The current physical profile targets an UNO R4 WiFi and ten ordinary discrete LEDs using the pin order in `../serial-protocol/protocol.md`.

The active synchronization sketch is `firmware/BeatSync10LedTest/BeatSync10LedTest.ino`. It uses the temporary ten-byte-value CSV/newline format at 115200 baud. It is a candidate for owner-run hardware validation; its startup and end-to-end music behavior have not been physically retested as part of this software pass. See `integration/hardware-tests/README.md` before assuming its outputs or power design are verified.
