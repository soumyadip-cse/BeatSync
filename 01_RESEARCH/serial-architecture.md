# Serial architecture

Status: protocol proposal for review; not implemented or hardware-validated.

## Boundary

The lighting engine emits a hardware-neutral `LightingFrame`. A frontend serial adapter converts that frame into a versioned wire message and uses the browser Web Serial API. Arduino validates each complete message and renders accepted state. Neither the lighting engine nor UI constructs packets. Web Serial requires a secure context and user permission, and browser support is limited; choose and verify the target browser before implementation ([MDN Web Serial API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API)).

## Proposed framing

Use binary messages framed as COBS-encoded records separated by `0x00`. COBS keeps the delimiter out of the encoded body. The decoded record starts with a fixed header and ends in CRC-16/CCITT:

| Field | Size | Purpose |
|---|---:|---|
| protocolVersion | 1 byte | Reject unsupported contracts |
| messageType | 1 byte | CONFIG, FRAME, PING, STATUS, ACK, or ERROR |
| sequence | 2 bytes | Detect stale/missing frames and correlate replies |
| ledCount | 1 byte | Configured outputs; zero where not applicable |
| pixelFormat | 1 byte | MONO8 or RGB8 for frame payloads |
| payloadLength | 2 bytes | Exact payload size in bytes |
| payload | variable | Message-specific fields |
| crc16 | 2 bytes | Integrity check over header and payload |

For a FRAME, payload length must equal `ledCount * channelsPerLed`; one channel is used for MONO8 and three for RGB8. Maximum message size is a protocol constant derived from a configured maximum LED count and format. A proposal of 255 LEDs gives at most 765 payload bytes plus 10 fixed decoded bytes; confirm the MCU's RAM budget before adopting this maximum. COBS overhead grows with record size; bound it using the selected encoder and include the zero delimiter in the transport buffer limit.

At 50 RGB LEDs, a frame is 150 payload bytes, 160 decoded bytes, at most 161 COBS bytes, plus the delimiter: at most 162 transmitted bytes. At 30 frames/s this is 4,860 bytes/s, roughly 48,600 bit/s with 8N1 framing, below a proposed 115,200 baud link. Actual throughput, buffering, and latency must be measured on the chosen board and browser.

## Message behavior

- `CONFIG`: LED count, format, brightness limit, and selected hardware profile. ACK only after validation and successful configuration.
- `FRAME`: sequence plus exactly N mono intensities or N RGB colors. Frames are applied atomically; an invalid frame must not partially update LEDs.
- `PING`: optional explicit liveness request while idle.
- `STATUS`: device readiness, configured count/format, last applied sequence, and fault flags.
- `ACK` / `ERROR`: correlated command result or a compact error code. Do not ACK every streaming frame; periodic STATUS and sequence tracking provide liveness without doubling traffic.

The first prototype should target 30 frames/s, configurable after measurement. Sequence wrap is modulo 65,536. A frame's host audio timestamp is useful for local diagnostics but need not be sent to the MCU in every frame; add it only if measured synchronization needs justify the bytes and clock semantics.

## Validation and recovery

The decoder collects bytes until the delimiter, bounds the encoded record before buffering, decodes COBS, then checks minimum length, version, message type, exact payload length, LED count, format, channel ranges, and CRC. Reject malformed, truncated-at-timeout, oversized, unsupported, or stale records with an error counter; never apply their payload. Configuration changes are accepted only when dimensions fit the selected hardware profile and buffer.

On connection, the host opens the user-selected port, negotiates/configures, waits for an ACK/STATUS, and only then reports `ready`. On disconnect or repeated invalid input, stop sending and display a fault. A proposed MCU failsafe is to fade/off after 500 ms without a valid frame; this timeout and transition need bench testing and owner approval before firmware behavior is frozen. Reconnect must send CONFIG and a fresh full FRAME before streaming resumes.

## Decisions still open

Confirm CRC parameters and byte order, supported LED maximum, mono versus RGB for the first build, brightness and pattern ownership, exact update rate, timeout, status cadence, serial baud, target browser, and the concrete hardware profile. The previous newline CSV format in the development log is historical and not the scalable proposal.

## References

- [MDN Web Serial API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API)
- [BeatSync master context](../00_PROJECT_CONTEXT/BeatSync_Project_Master_Context_v1.pdf)
