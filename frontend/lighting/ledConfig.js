// Compatibility exports for the current dashboard and experiment references.
// Pin-specific data lives in the hardware profile; the lighting engine imports
// frequency bands from audio/audioConfig.js and has no dependency on this file.
import { ARDUINO_10_LED_PROFILE } from "../hardware/Arduino10LedProfile.js";

export { FREQUENCY_BANDS } from "../audio/audioConfig.js";
export { ARDUINO_10_LED_PROFILE, DIGITAL_THRESHOLD, SERIAL_BAUD_RATE } from "../hardware/Arduino10LedProfile.js";
export const LED_LAYOUT = Object.freeze(ARDUINO_10_LED_PROFILE.channels.map((channel) => Object.freeze({
  ...channel,
  led: channel.index + 1,
})));
