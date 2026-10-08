# Hardware architecture

Status: recommendation for investigation; no board, LED part, wiring, or supply has been verified in this workspace.

## Output choices

### Individual ordinary LEDs

Useful for the first three-output bench prototype and for simple one-channel-per-emitter installations. Each LED needs current limiting. The MCU should drive only a small, verified load within its GPIO ratings. For more channels, use an external multi-channel LED/PWM driver selected for the LED current and required refresh behavior. A shift register alone does not provide per-channel PWM. Keep the hardware driver behind an Arduino `LedDriver` interface so firmware policy does not depend on the exact chip.

### Addressable RGB pixels

For the eventual 8–50+ independently colored outputs, individually addressable RGB pixels (for example, WS2812-compatible devices) are the provisional direction. One data chain carries per-pixel colors, reducing the number of MCU control pins and naturally matching an N-pixel `LightingFrame`. The pixels may be modules or a strip; packaging and layout remain open. Arduino renders the latest accepted buffer through the selected library/driver.

## Power and signal boundaries

Do not power a large LED array from an Arduino GPIO or assume the board's 5 V rail can supply it. The Adafruit guide uses up to 60 mA per RGB pixel as a full-white planning bound: 50 pixels therefore imply about 3 A at 5 V before design margin. Use an appropriately rated external supply, common ground between board and LED supply, suitable wire and connectors, and power injection where the exact layout requires it. Add protection and data-line conditioning according to the exact LED and board datasheets. A series data resistor and supply capacitor are common WS2812 setup recommendations, but final values and placement must follow the chosen parts and wiring ([Adafruit NeoPixel power guide](https://learn.adafruit.com/adafruit-neopixel-uberguide/powering-neopixels)).

For the historically reported UNO R4 WiFi, official documentation identifies PWM-capable pins D3, D5, D6, D9, D10, and D11; its datasheet gives 8 mA as the safe GPIO current. Those are board-specific constraints, not permission to drive a high-current array directly ([UNO R4 cheat sheet](https://docs.arduino.cc/tutorials/uno-r4-wifi/cheat-sheet/), [datasheet](https://docs.arduino.cc/resources/datasheets/ABX00087-datasheet.pdf)). Verify logic-level compatibility between the exact MCU and LED data input. The UNO R4 WiFi includes a separate 3.3 V ESP32-S3 module, so the board's subsystem voltage details matter when selecting the data path.

## Hardware profile

The eventual configuration should describe board/transport, LED driver type, pixel format, output count, pin or data channel, color order, brightness/current cap, and any driver-specific timing. Keep count configurable in software, but enforce a validated maximum based on MCU memory, driver limits, and power design. Software support for 50 outputs does not establish that a particular physical installation is safe.

## Prototype path

Begin with three low-current ordinary LEDs on a verified board and resistors if reproducing the documented historical style. For the final expandable RGB direction, separately validate one addressable pixel, then a short chain, then calculate and test the intended full supply and wiring. The exact board and LED hardware are still unresolved; do not treat the development log's historical setup as present or working.

## References

- [Adafruit NeoPixel Überguide: powering](https://learn.adafruit.com/adafruit-neopixel-uberguide/powering-neopixels)
- [Arduino UNO R4 WiFi cheat sheet](https://docs.arduino.cc/tutorials/uno-r4-wifi/cheat-sheet/)
- [Arduino UNO R4 WiFi datasheet](https://docs.arduino.cc/resources/datasheets/ABX00087-datasheet.pdf)
- [BeatSync development log](../00_PROJECT_CONTEXT/SONICLUX_Arduino_Development_Log.md)
