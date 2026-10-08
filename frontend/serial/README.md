# Browser serial transport

`SerialProtocol.js` normalizes byte values and encodes the current temporary frame as exactly ten comma-separated integers plus newline. Baud is 115200. `SerialTransport.js` requires a user button action to call `requestPort()`, opens the selected port, acquires one writer, and reports detailed connection/write state.

At most one `writer.write()` is outstanding. While it is pending, later frames replace a single pending slot; stale frames are discarded. The sender cadence is configurable in the UI and defaults to 100 ms. The requestAnimationFrame loop never awaits serial. Disconnects, cancelled selection, stale port cleanup, port-open errors, and rejected writes are reported and reset the UI state.

The firmware currently sends no ACK. The dashboard can confirm stream write success, not physical LED state. Run the full setup in `serial-protocol/protocol.md` and `integration/hardware-tests/README.md` before treating the ten-channel path as verified.
