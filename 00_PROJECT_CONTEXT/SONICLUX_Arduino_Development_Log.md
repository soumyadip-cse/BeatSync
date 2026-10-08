# SONICLUX — Arduino Development Log

## Project Overview

**SONICLUX** is a Physics Innovative Project designed to visualize music/sound using an Arduino-controlled LED system.

Current prototype:
- Arduino UNO R4 WiFi
- Individual LEDs
- PWM brightness control
- Python-to-Arduino Serial communication
- FFT-based audio analysis
- Current physical test: **3 LEDs**

Core concept:

```text
SONG
  ↓
Audio waveform
  ↓
FFT / Frequency analysis
  ↓
Bass / Mid / Treble
  ↓
Brightness values
  ↓
Serial communication
  ↓
Arduino
  ↓
PWM
  ↓
LEDs react to music
```

---

# 1. Arduino Board

**Board:** Arduino UNO R4 WiFi

Arduino's role:
1. Receive brightness values from the computer.
2. Parse the received values.
3. Convert them into PWM outputs.
4. Control LED brightness.

---

# 2. Initial 5-LED Prototype

The initial prototype used 5 individual LEDs.

| LED | Arduino Pin |
|---|---:|
| LED 1 | D3 |
| LED 2 | D5 |
| LED 3 | D6 |
| LED 4 | D9 |
| LED 5 | D10 |

Each LED uses its own resistor.

Basic wiring:

```text
Arduino Pin
    ↓
 Resistor
    ↓
 LED long leg (+)
 LED short leg (-)
    ↓
   GND
```

---

# 3. Sequential LED Test

A sequential ON/OFF test was performed.

This verified:
- Arduino output pins
- LED wiring
- Individual LED control
- Basic hardware operation

---

# 4. PWM Brightness Test

PWM was then tested using:

```cpp
analogWrite(pin, brightness);
```

Brightness range:

```text
0   → OFF
255 → Maximum brightness
```

Example:

```cpp
analogWrite(ledPin, 20);
analogWrite(ledPin, 80);
analogWrite(ledPin, 150);
analogWrite(ledPin, 255);
analogWrite(ledPin, 0);
```

The LEDs were successfully faded between dim and bright states.

---

# 5. Independent LED Brightness Tests

Individual LEDs were tested at different brightness levels.

Examples included:
- LED 2 at minimum while the others were at maximum.
- LED 2 at maximum while the others were at minimum.

This confirmed independent PWM control.

---

# 6. Serial Monitor Brightness Test

Serial input was used to control LED brightness manually.

Values such as:

```text
50
150
255
0
```

were tested.

System:

```text
Serial input
     ↓
 Arduino
     ↓
 PWM
     ↓
 LED brightness
```

---

# 7. Multi-LED Serial Communication

The Arduino was then programmed to receive multiple brightness values as CSV data.

Example:

```text
209,255,138,178,151
```

Arduino code:

```cpp
int leds[] = {3, 5, 6, 9, 10};

void setup() {
  Serial.begin(9600);

  for (int i = 0; i < 5; i++) {
    pinMode(leds[i], OUTPUT);
  }
}

void loop() {
  if (Serial.available() > 0) {
    String data = Serial.readStringUntil('\n');

    int values[5];
    int start = 0;

    for (int i = 0; i < 5; i++) {
      int comma = data.indexOf(',', start);

      if (comma == -1) {
        comma = data.length();
      }

      values[i] = data.substring(start, comma).toInt();
      start = comma + 1;
    }

    for (int i = 0; i < 5; i++) {
      values[i] = constrain(values[i], 0, 255);
      analogWrite(leds[i], values[i]);
    }
  }
}
```

Interpretation:

```text
209,255,138,178,151

LED 1 → 209
LED 2 → 255
LED 3 → 138
LED 4 → 178
LED 5 → 151
```

This became the foundation for computer-controlled music visualization.

---

# 8. Python → Arduino Communication

Python was introduced to automatically calculate and send LED brightness values.

Current Arduino connection:

```python
arduino = serial.Serial("COM3", 9600)
```

**Current Arduino COM port: COM3**

All current SONICLUX Python programs should use COM3 unless the Arduino port is changed.

---

# 9. Audio Visualization Concept

The project then moved from manually generated values to real audio analysis.

The intended pipeline became:

```text
Song
 ↓
Audio waveform
 ↓
FFT
 ↓
Frequency bands
 ↓
Brightness values
 ↓
Arduino
 ↓
LEDs
```

The audio was analyzed using Python libraries including:
- librosa
- numpy
- pyserial

---

# 10. Frequency Bands

The initial 5-band concept used:

| Band | Frequency |
|---|---|
| Bass | 20–250 Hz |
| Low-Mid | 250–500 Hz |
| Mid | 500–2000 Hz |
| High-Mid | 2000–6000 Hz |
| Treble | 6000–20000 Hz |

FFT successfully produced different magnitude values for the frequency bands.

---

# 11. Beat Detection

Beat detection was added using librosa.

The test produced:

```text
Estimated tempo: 103.359375 BPM
Beats detected: 103
```

This confirmed that the song's rhythmic information could be detected and used for LED effects.

---

# 12. First FFT → Arduino Prototype

FFT band magnitudes were converted to brightness values from 0–255.

Example:

```text
209,255,138,178,151
```

The values were transmitted to Arduino through Serial.

This successfully demonstrated:

```text
Song
 ↓
FFT
 ↓
Frequency energy
 ↓
Numbers
 ↓
Serial
 ↓
Arduino
 ↓
LED brightness
```

---

# 13. SONICLUX V2

V2 introduced:
- Log compression
- Normalization
- Smoothing
- Beat pulse

Smoothing used the concept:

```python
smoothed = previous + factor * (target - previous)
```

A beat pulse was added to make LEDs react more strongly on detected beats.

The first V2 test showed that the pulse was too aggressive and frequently pushed values toward 255.

This led to further tuning.

---

# 14. SONICLUX V3

V3 improved the visualization using:
- Lower normal brightness target
- Reduced beat pulse
- Weighted beat pulse
- Smoothing
- Log compression

Beat pulse weighting:

```python
pulse_effect = np.array([
    pulse * 1.00,
    pulse * 0.80,
    pulse * 0.60,
    pulse * 0.40,
    pulse * 0.25
])
```

This made lower frequencies receive a stronger beat response than higher frequencies.

V3 successfully ran and generated changing values such as:

```text
BEAT ⚡ 21.8 [119, 144, 121, 85, 44]
BEAT ⚡ 22.4 [152, 153, 105, 61, 27]
BEAT ⚡ 23.0 [159, 150, 106, 69, 31]
```

---

# 15. 3-LED Prototype

For easier physical testing, the project was simplified to 3 LEDs.

Current mapping:

| Function | LED | Arduino Pin |
|---|---|---:|
| Bass | LED 1 | D3 |
| Mid | LED 2 | D5 |
| Treble | LED 3 | D6 |

Architecture:

```text
          SONICLUX
             │
             ↓
            FFT
             │
      ┌──────┼──────┐
      ↓      ↓      ↓
    BASS     MID   TREBLE
      │       │      │
      ↓       ↓      ↓
     D3      D5     D6
      │       │      │
     LED     LED    LED
```

---

# 16. Current 3-LED Arduino Code

```cpp
int leds[] = {3, 5, 6};

void setup() {
  Serial.begin(9600);

  for (int i = 0; i < 3; i++) {
    pinMode(leds[i], OUTPUT);
  }
}

void loop() {

  if (Serial.available() > 0) {

    String data = Serial.readStringUntil('\n');

    int values[3];
    int start = 0;

    for (int i = 0; i < 3; i++) {

      int comma = data.indexOf(',', start);

      if (comma == -1) {
        comma = data.length();
      }

      values[i] = data.substring(start, comma).toInt();

      start = comma + 1;
    }

    for (int i = 0; i < 3; i++) {

      values[i] = constrain(values[i], 0, 255);

      analogWrite(leds[i], values[i]);
    }
  }
}
```

---

# 17. 3-LED Hardware Fade Test

A temporary Arduino test was performed where all three LEDs:

```text
Dim
 ↓
Gradually brighten
 ↓
Maximum brightness
 ↓
Gradually dim
 ↓
Repeat
```

The test **worked successfully**.

This confirmed that:
- The three LEDs are correctly wired.
- PWM works.
- Brightness can visibly change.
- The physical LED hardware is not the main cause of the earlier constant-looking behavior.

---

# 18. SONICLUX V4 — 3 LED Mode

V4 changed the analysis to three bands:

```text
Bass   → 20–250 Hz
Mid    → 250–4000 Hz
Treble → 4000–20000 Hz
```

Current Python-to-Arduino architecture:

```text
Song
 ↓
FFT
 ↓
Bass / Mid / Treble
 ↓
Dynamic normalization
 ↓
Smoothing
 ↓
Beat pulse
 ↓
3 brightness values
 ↓
COM3
 ↓
Arduino
 ↓
D3 / D5 / D6
 ↓
3 LEDs
```

V4 successfully ran.

Example output:

```text
BEAT ⚡ 5.7 [255, 151, 39]
BEAT ⚡ 6.3 [255, 138, 39]
BEAT ⚡ 6.8 [255, 129, 39]
BEAT ⚡ 7.4 [255, 135, 39]
BEAT ⚡ 8.0 [255, 123, 39]
BEAT ⚡ 10.2 [255, 103, 109]
BEAT ⚡ 10.8 [255, 122, 51]
BEAT ⚡ 11.3 [255, 99, 53]
```

This confirmed that the Python system is successfully generating three separate brightness values and sending them to Arduino.

---

# 19. Current Technical Issue

The current V4 values show that Bass frequently reaches:

```text
255
```

while Treble is often much lower.

Example:

```text
[255, 151, 39]
[255, 138, 39]
[255, 129, 39]
```

Therefore, the bass LED can appear almost constantly bright.

The next software improvement is **not simply increasing brightness**.

Instead, the project needs:
- Independent Bass/Mid/Treble scaling
- Better dynamic range
- More visible changes
- Controlled beat response
- Better smoothing
- More natural visual movement

---

# 20. Current Project Status

### Completed

- [x] Arduino UNO R4 WiFi setup
- [x] Individual LED control
- [x] Sequential LED test
- [x] PWM brightness control
- [x] Independent LED brightness tests
- [x] Serial Monitor brightness control
- [x] Multi-value CSV Serial communication
- [x] Python → Arduino communication
- [x] 5-LED prototype
- [x] 3-LED prototype
- [x] Bass/Mid/Treble mapping
- [x] FFT audio analysis
- [x] Beat detection
- [x] Smoothing
- [x] Beat pulse
- [x] Physical LED fade test
- [x] COM3 communication

---

# 21. Next Development Stage

The immediate goal is to improve the 3-LED visualization before adding more LEDs.

Target:

```text
SONG
 ↓
FFT
 ↓
Independent Bass / Mid / Treble
 ↓
Per-band dynamic scaling
 ↓
Smoothing
 ↓
Beat response
 ↓
PWM brightness
 ↓
3 LEDs
```

The three LEDs should visibly react differently to the music rather than remaining nearly constant.

---

# 22. Future Expansion

After the 3-LED prototype is visually satisfactory:

```text
3 LEDs
 ↓
5 LEDs
 ↓
larger LED array
 ↓
50–60+ individual LEDs
```

The final project is intended to use **individual LEDs**, not WS2812B LED strips.

For a large number of LEDs, suitable LED drivers, shift registers, multiplexing, or other expansion hardware will be considered instead of connecting every LED directly to Arduino GPIO pins.

---

# 23. Project Physics + Technology

SONICLUX combines:

- Physics of sound waves
- Audio sampling
- Digital signal processing
- FFT
- Frequency analysis
- Beat detection
- Arduino
- PWM
- Serial communication
- Real-time visualization

Core idea:

```text
SOUND → DATA → VISUALIZATION
```

The LEDs act as a physical visualization of information contained in music.

---

## Current Milestone

> The Arduino UNO R4 WiFi successfully controls 3 LEDs through PWM, and Python successfully analyzes a song using FFT/beat detection and sends brightness values to the Arduino through COM3.

## Next Milestone

> Make Bass, Mid, and Treble produce clearly visible, dynamic, and musically responsive changes on the three LEDs before scaling the system to a larger LED array.
