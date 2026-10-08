# End-to-end acceptance

The browser/software chain is implemented, and isolated unit tests run with `npm test`. The end-to-end acceptance still requires the real browser, selected media, Web Serial port, exact UNO R4 firmware, and ten wired LEDs. Do not use generated frames or code-level tests as a substitute for observed physical behavior.

Use the reproducible cases and result table in `../hardware-tests/README.md`. Record whether media time and analysis continue with serial disabled, serial enabled, and the board disconnected; verify LEDs by pin; test the full 238.6-second reference duration if available. The known historical serial-enabled pause near 38–42 seconds remains open until this test is completed and recorded.
