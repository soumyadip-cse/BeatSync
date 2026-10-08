# Hardware notes

## Supplied prototype history

The SONICLUX log reports an Arduino UNO R4 WiFi controlling three ordinary LEDs on D3, D5, and D6, with serial input at 9600 baud on COM3. It also records an earlier five-LED pin map. These details are reported by the log and have not been independently verified from source code or a wiring diagram in this workspace.

## Scalability

The master context recommends researching addressable RGB pixels for larger arrays and treating power delivery as a separate design problem. The development log says the final project should use individual LEDs and considers driver hardware for expansion. This difference is unresolved; do not order or wire a larger system based only on these notes.

## Verify before implementation

- Exact board revision and pin capabilities.
- LED type, forward current, resistor values, driver limits, and common-ground requirements.
- External supply voltage/current and protection for the chosen LED hardware.
- Whether the current three-LED setup is still available and its wiring.
- Safe maximum brightness and expected current at the target count.
