export const SERIAL_BAUD_RATE = 115200;
export const DIGITAL_THRESHOLD = 128;

export const ARDUINO_10_LED_PROFILE = Object.freeze({
  id: "CURRENT_10_LED_UNO_R4_WIFI",
  name: "UNO R4 WiFi · 10 discrete LEDs",
  logicalChannels: null,
  physicalChannels: 10,
  pins: Object.freeze(["D2", "D7", "D3", "D8", "D4", "D9", "D5", "D10", "D6", "D11"]),
  channels: Object.freeze([
    { index: 0, column: 1, color: "red", pin: "D2", mode: "digital" },
    { index: 1, column: 1, color: "green", pin: "D7", mode: "digital" },
    { index: 2, column: 2, color: "red", pin: "D3", mode: "PWM" },
    { index: 3, column: 2, color: "green", pin: "D8", mode: "digital" },
    { index: 4, column: 3, color: "red", pin: "D4", mode: "digital" },
    { index: 5, column: 3, color: "green", pin: "D9", mode: "PWM" },
    { index: 6, column: 4, color: "red", pin: "D5", mode: "PWM" },
    { index: 7, column: 4, color: "green", pin: "D10", mode: "PWM" },
    { index: 8, column: 5, color: "red", pin: "D6", mode: "PWM" },
    { index: 9, column: 5, color: "green", pin: "D11", mode: "PWM" },
  ].map(Object.freeze)),
});

const clampByte = (value) => Math.max(0, Math.min(255, Math.round(Number(value) || 0)));

export function mapLogicalToPhysical(logicalValues, profile = ARDUINO_10_LED_PROFILE) {
  if (!Array.isArray(logicalValues) || logicalValues.length === 0) {
    throw new TypeError("A logical frame must contain at least one LED value.");
  }

  const logical = logicalValues.map(clampByte);
  const count = profile.physicalChannels;
  const mapped = Array.from({ length: count }, (_, index) => {
    const position = count === 1 ? 0 : (index / (count - 1)) * (logical.length - 1);
    const lower = Math.floor(position);
    const upper = Math.min(logical.length - 1, lower + 1);
    const amount = position - lower;
    return clampByte(logical[lower] + (logical[upper] - logical[lower]) * amount);
  });

  return mapped.map((value, index) => profile.channels[index].mode === "PWM"
    ? value
    : value >= DIGITAL_THRESHOLD ? 255 : 0);
}

export function normalizePhysicalFrame(values, profile = ARDUINO_10_LED_PROFILE) {
  if (!Array.isArray(values) || values.length !== profile.physicalChannels) {
    throw new RangeError(`Expected exactly ${profile.physicalChannels} physical LED values.`);
  }
  return values.map((value, index) => {
    const byte = clampByte(value);
    return profile.channels[index].mode === "PWM" ? byte : byte >= DIGITAL_THRESHOLD ? 255 : 0;
  });
}
