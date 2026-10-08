#include <stdlib.h>
#include <string.h>

// Frame order is paired by physical column: red, green, then the next column.
// PWM: D3, D5, D6, D9, D10, D11. Digital threshold channels: D2, D4, D7, D8.
const uint8_t LED_COUNT = 10;
const uint8_t LED_PINS[LED_COUNT] = {2, 7, 3, 8, 4, 9, 5, 10, 6, 11};
const uint8_t PWM_CHANNELS[LED_COUNT] = {0, 0, 1, 0, 0, 1, 1, 1, 1, 1};
const int DIGITAL_THRESHOLD = 128;
const unsigned long STARTUP_STEP_MS = 250;
const unsigned long STARTUP_ALL_ON_MS = 250;
const size_t FRAME_BUFFER_SIZE = 48;

uint8_t ledValues[LED_COUNT] = {0};
char frameBuffer[FRAME_BUFFER_SIZE];
size_t frameLength = 0;
bool frameOverflow = false;

void writeChannel(uint8_t index, int value) {
  value = constrain(value, 0, 255);
  ledValues[index] = (uint8_t)value;
  if (PWM_CHANNELS[index]) {
    analogWrite(LED_PINS[index], value);
  } else {
    digitalWrite(LED_PINS[index], value >= DIGITAL_THRESHOLD ? HIGH : LOW);
  }
}

void turnAllOff() {
  for (uint8_t index = 0; index < LED_COUNT; index++) {
    writeChannel(index, 0);
  }
}

bool parseFrame(char *line, int values[LED_COUNT]) {
  char *cursor = line;

  for (uint8_t index = 0; index < LED_COUNT; index++) {
    char *end = nullptr;
    const long parsed = strtol(cursor, &end, 10);
    if (end == cursor) return false;

    values[index] = (int)constrain(parsed, 0L, 255L);
    if (index < LED_COUNT - 1) {
      if (*end != ',') return false;
      cursor = end + 1;
    } else if (*end != '\0') {
      return false;
    }
  }

  return true;
}

void applyFrame(const int values[LED_COUNT]) {
  // Validate the complete frame before changing any output.
  for (uint8_t index = 0; index < LED_COUNT; index++) {
    writeChannel(index, values[index]);
  }
}

void processFrame(char *line) {
  int values[LED_COUNT];
  if (parseFrame(line, values)) {
    applyFrame(values);
  }
}

void runStartupTest() {
  turnAllOff();
  for (uint8_t index = 0; index < LED_COUNT; index++) {
    writeChannel(index, 255);
    delay(STARTUP_STEP_MS);
  }
  int allOn[LED_COUNT];
  for (uint8_t index = 0; index < LED_COUNT; index++) allOn[index] = 255;
  applyFrame(allOn);
  delay(STARTUP_ALL_ON_MS);
  turnAllOff();
}

void setup() {
  Serial.begin(115200);
  for (uint8_t index = 0; index < LED_COUNT; index++) {
    pinMode(LED_PINS[index], OUTPUT);
  }
  turnAllOff();
  runStartupTest();
}

void loop() {
  while (Serial.available() > 0) {
    const char incoming = (char)Serial.read();

    if (incoming == '\r') continue;

    if (incoming == '\n') {
      if (!frameOverflow && frameLength > 0) {
        frameBuffer[frameLength] = '\0';
        processFrame(frameBuffer);
      }
      frameLength = 0;
      frameOverflow = false;
      continue;
    }

    if (!frameOverflow) {
      if (frameLength < FRAME_BUFFER_SIZE - 1) {
        frameBuffer[frameLength++] = incoming;
      } else {
        frameOverflow = true;
      }
    }
  }
}
