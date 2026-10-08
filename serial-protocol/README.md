# Host-to-Arduino serial contract

The active implementation is documented in [protocol.md](protocol.md): ten integer CSV fields, newline terminated, 115200 baud. [message-format.md](message-format.md) remains a possible future versioned COBS/CRC design and must not be described as active. The browser and firmware must be changed and validated together before replacing the temporary contract.
