# Proposed message format

Status: proposal, pending implementation and bench validation.

## Decoded record

| Field | Bytes | Notes |
|---|---:|---|
| protocolVersion | 1 | Reject unsupported versions |
| messageType | 1 | CONFIG, FRAME, PING, STATUS, ACK, ERROR |
| sequence | 2 | Unsigned modulo-65,536 counter |
| ledCount | 1 | 0 for messages that do not address pixels |
| pixelFormat | 1 | MONO8 or RGB8 |
| payloadLength | 2 | Little-endian proposed; confirm before freeze |
| payload | variable | Defined by message type |
| crc16 | 2 | CRC-16/CCITT over header and payload; parameters open |

Each decoded record is COBS-encoded and followed by `0x00`. For `FRAME`, payload length must be exactly `ledCount` for MONO8 or `3 * ledCount` for RGB8. Every channel is an unsigned 8-bit value. A separate brightness cap is sent in CONFIG and enforced by the renderer.

## Message payloads (proposal)

- `CONFIG`: format, brightness cap, hardware profile ID, and optional capabilities. LED count is in the header.
- `FRAME`: N mono intensities or N RGB triplets in LED index order.
- `PING`: optional host clock/nonce for link checks while not streaming.
- `STATUS`: ready/fault flags, active profile, and last applied sequence.
- `ACK`: acknowledged command type and sequence.
- `ERROR`: rejected command type, sequence, and compact error code.

Exact capability IDs, flags, byte order, error enumeration, and hardware-profile semantics are open. See [protocol architecture](../01_RESEARCH/serial-architecture.md). Do not implement against this proposal until the owner resolves the open fields and confirms memory/power limits.
