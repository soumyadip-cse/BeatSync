# Active temporary serial protocol

The dashboard and `arduino/firmware/BeatSync10LedTest/` currently use the same newline-delimited ten-integer CSV frame at **115200 baud**. `serial-protocol/message-format.md` is a future COBS/CRC proposal and is not used by either current component.

## Frame

```text
L0,L1,L2,L3,L4,L5,L6,L7,L8,L9\n
```

Each field is a decimal integer in `[0,255]`; exactly ten comma-separated fields and a terminating line feed are required. Example:

```text
255,180,160,140,120,100,80,60,40,20\n
```

The browser encodes through `frontend/serial/SerialProtocol.js`. The firmware buffers a complete line, parses exactly ten values, clamps to bytes, and applies the profile. Malformed or incomplete lines are ignored rather than applied as partial frames. There is no device ACK, status packet, checksum, or binary framing in this temporary protocol.

## Physical UNO R4 WiFi output order

| Frame index | Pin | Capability |
| --- | --- | --- |
| L0 | D2 | Digital; OFF below 128, ON at/above 128 |
| L1 | D7 | Digital; OFF below 128, ON at/above 128 |
| L2 | D3 | PWM |
| L3 | D8 | Digital; OFF below 128, ON at/above 128 |
| L4 | D4 | Digital; OFF below 128, ON at/above 128 |
| L5 | D9 | PWM |
| L6 | D5 | PWM |
| L7 | D10 | PWM |
| L8 | D6 | PWM |
| L9 | D11 | PWM |

There are ten physical LEDs, four digital-only outputs, and six PWM outputs. Digital pins do not produce intermediate PWM brightness. Verify safe current/resistors and the exact board wiring before the all-on test.

## Sender behavior and checks

Web Serial is opened only from the **Connect Arduino** button. The browser sends at a configurable interval (100 ms/10 fps default). It permits one active write plus one replaceable latest frame; it never waits for serial in the audio/animation loop. A successful `writer.write()` is not proof of physical output because this firmware sends no acknowledgement.

Run `npm test` for protocol/queue boundary tests. For physical validation, close Arduino Serial Monitor, flash the separate sketch, connect the correct port, test all-off/all-on/one-hot frames, and then run audio for over four minutes with output enabled. Record the 40 s, 90 s, and end-of-file results in `integration/hardware-tests/README.md`.
