import { FREQUENCY_BANDS } from "../audio/audioConfig.js";
import { ARDUINO_10_LED_PROFILE, DIGITAL_THRESHOLD } from "../hardware/Arduino10LedProfile.js";

const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));

function prepareCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(rect.width * ratio));
  const height = Math.max(1, Math.round(rect.height * ratio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const context = canvas.getContext("2d");
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { context, width: rect.width, height: rect.height };
}

export class DashboardVisuals {
  constructor(documentRef = document, hardwareProfile = ARDUINO_10_LED_PROFILE) {
    this.document = documentRef;
    this.hardwareProfile = hardwareProfile;
    this.spectrumCanvas = documentRef.querySelector("#spectrumCanvas");
    this.waveformCanvas = documentRef.querySelector("#waveformCanvas");
    this.ring = documentRef.querySelector("#sculptureRing");
    this.latestFrame = [];
    this.latestHardwareFrame = Array(hardwareProfile.physicalChannels).fill(0);
    this.logicalTiles = [];
    this.logicalSculptureLeds = [];
    this.hardwareTiles = [];
    this._buildBands();
    this._buildHardwareDisplays();
    this.setLedCount(10);
  }

  setLedCount(count) {
    const total = Math.max(1, Math.floor(Number(count) || 1));
    this.latestFrame = Array(total).fill(0);
    const twin = this.document.querySelector("#ledTwin");
    twin.replaceChildren();
    this.logicalTiles = [];
    this.logicalSculptureLeds = [];
    twin.setAttribute("aria-label", total + " logical LED values");
    for (let index = 0; index < total; index += 1) {
      const tile = this.document.createElement("div");
      tile.className = "twin-led twin-led--logical";
      tile.dataset.index = String(index);
      const lamp = this.document.createElement("span");
      lamp.className = "twin-led__lamp";
      const label = this.document.createElement("span");
      label.className = "twin-led__label";
      label.textContent = "L" + index;
      const value = this.document.createElement("b");
      value.textContent = "0";
      tile.valueNode = value;
      tile.append(lamp, label, value);
      twin.append(tile);
      this.logicalTiles.push(tile);
    }

    this.ring.replaceChildren();
    for (let index = 0; index < total; index += 1) {
      const led = this.document.createElement("span");
      led.className = "sculpture-led sculpture-led--logical";
      led.style.setProperty("--led-index", String(index));
      led.style.setProperty("--angle", (index * 360 / total) + "deg");
      led.dataset.index = String(index);
      led.title = "Logical LED L" + index;
      this.ring.append(led);
      this.logicalSculptureLeds.push(led);
    }
    const label = this.document.querySelector("#logicalCountLabel");
    if (label) label.textContent = "LOGICAL LEDS: " + total;
    const title = this.document.querySelector("#twin-heading");
    if (title) title.textContent = total + " Logical LEDs";
    const axis = this.document.querySelector(".sculpture-axis--y");
    if (axis) axis.textContent = total + " LOGICAL OUTPUTS";
  }

  _buildHardwareDisplays() {
    const hardwareTwin = this.document.querySelector("#hardwareTwin");
    if (hardwareTwin) {
      hardwareTwin.replaceChildren();
      this.hardwareTiles = [];
      hardwareTwin.setAttribute("aria-label", this.hardwareProfile.physicalChannels + " physical Arduino output values");
      for (const channel of this.hardwareProfile.channels) {
        const tile = this.document.createElement("div");
        tile.className = "hardware-led";
        tile.dataset.index = String(channel.index);
        const lamp = this.document.createElement("i");
        lamp.className = "hardware-led__lamp";
        const title = this.document.createElement("b");
        title.textContent = "L" + channel.index + " · " + channel.pin;
        const mode = this.document.createElement("small");
        mode.textContent = channel.mode === "PWM" ? "PWM" : "DIGITAL";
        const value = this.document.createElement("span");
        value.textContent = "0";
        tile.valueNode = value;
        tile.append(lamp, title, mode, value);
        hardwareTwin.append(tile);
        this.hardwareTiles.push(tile);
      }
    }
    this._buildPinMap();
    this.setHardwareFrame(this.latestHardwareFrame);
  }

  _buildBands() {
    const bandMeters = this.document.querySelector("#bandMeters");
    const bandSummary = this.document.querySelector("#bandSummary");
    bandMeters.replaceChildren();
    bandSummary.replaceChildren();
    for (const band of FREQUENCY_BANDS) {
      const meter = this.document.createElement("div");
      meter.className = "band-meter";
      meter.innerHTML = `<span>${band.name}</span><div class="band-meter__track"><i style="--band-color:${band.color}"></i></div><b>--</b>`;
      meter.dataset.band = band.key;
      bandMeters.append(meter);

      const compact = this.document.createElement("div");
      compact.className = "band-summary__row";
      compact.innerHTML = `<span>${band.name}</span><span class="band-summary__track"><i style="--band-color:${band.color}"></i></span><b>--</b>`;
      compact.dataset.band = band.key;
      bandSummary.append(compact);
    }
  }

  _buildPinMap() {
    const pinMap = this.document.querySelector("#pinMap");
    if (!pinMap) return;
    pinMap.replaceChildren();
    for (const channel of this.hardwareProfile.channels) {
      const row = this.document.createElement("div");
      const mode = channel.mode === "PWM" ? "PWM" : "DIGITAL ≥" + DIGITAL_THRESHOLD;
      row.innerHTML = "<b>L" + channel.index + "</b><span>C" + channel.column + " " + channel.color + "</span><code>" + channel.pin + "</code><small>" + mode + "</small>";
      pinMap.append(row);
    }
  }

  setFrame(values, { audioTimeSeconds = 0 } = {}) {
    this.latestFrame = values.map((value) => Math.max(0, Math.min(255, Math.round(value))));
    const output = this.document.querySelector("#currentFrame");
    if (output) output.textContent = this.latestFrame.join(",");
    const mode = this.document.querySelector("#frameModeLabel");
    if (mode) mode.textContent = "LIVE LOGICAL";
    const caption = this.document.querySelector("#frameCaption");
    if (caption) caption.textContent = "CURRENT LOGICAL FRAME · " + this.latestFrame.length + " VALUES";
    this.ring.style.setProperty("--song-rotation", (((audioTimeSeconds * 5) % 360) + 360) % 360 + "deg");

    for (let index = 0; index < this.latestFrame.length; index += 1) {
      const value = this.latestFrame[index];
      const tile = this.logicalTiles[index];
      const sculpture = this.logicalSculptureLeds[index];
      tile?.style.setProperty("--led-level", String(value / 255));
      if (tile?.valueNode) tile.valueNode.textContent = String(value);
      sculpture?.style.setProperty("--led-level", String(value / 255));
    }
  }

  setHardwareFrame(values, { transmitted = false } = {}) {
    this.latestHardwareFrame = values.map((value) => Math.max(0, Math.min(255, Math.round(value))));
    const output = this.document.querySelector("#hardwareFrame");
    if (output) output.textContent = this.latestHardwareFrame.join(",");
    const status = this.document.querySelector("#hardwareFrameStatus");
    if (status) status.textContent = transmitted ? "LAST FRAME ACCEPTED BY WEB SERIAL · NO DEVICE ACK" : "PREVIEW ONLY · NOT TRANSMITTED";
    const mode = this.document.querySelector("#hardwareModeLabel");
    if (mode) mode.textContent = transmitted ? "LAST TRANSMITTED" : "MAPPED PREVIEW";

    for (let index = 0; index < this.latestHardwareFrame.length; index += 1) {
      const value = this.latestHardwareFrame[index];
      const tile = this.hardwareTiles[index];
      tile?.style.setProperty("--led-level", String(value / 255));
      if (tile?.valueNode) tile.valueNode.textContent = String(value);
    }
  }

  setBandValues(bands) {
    for (const band of FREQUENCY_BANDS) {
      const value = clamp01(bands?.[band.key]);
      const meters = this.document.querySelectorAll(`[data-band="${band.key}"]`);
      for (const meter of meters) {
        const fill = meter.querySelector("i");
        const output = meter.querySelector("b");
        if (fill) fill.style.width = (value * 100) + "%";
        if (output) output.textContent = value.toFixed(2);
      }
    }
  }

  draw(analysis) {
    if (!analysis) return;
    this.drawSpectrum(analysis.spectrum, analysis.sampleRate, analysis.fftSize);
    this.drawWaveform(analysis.waveform);
  }

  drawSpectrum(spectrum, sampleRate, fftSize) {
    const { context, width, height } = prepareCanvas(this.spectrumCanvas);
    context.clearRect(0, 0, width, height);
    if (!spectrum || !sampleRate || !fftSize) return;
    const count = 76;
    const minHz = 40;
    const maxHz = Math.min(20000, sampleRate / 2);
    const binHz = sampleRate / fftSize;
    const barGap = 3;
    const barWidth = Math.max(1, (width - (count - 1) * barGap) / count);
    const gradient = context.createLinearGradient(0, height, width, 0);
    gradient.addColorStop(0, "#29c8df");
    gradient.addColorStop(0.48, "#167fe8");
    gradient.addColorStop(0.78, "#168dca");
    gradient.addColorStop(1, "#65edda");
    context.fillStyle = gradient;
    for (let index = 0; index < count; index += 1) {
      const startHz = minHz * ((maxHz / minHz) ** (index / count));
      const endHz = minHz * ((maxHz / minHz) ** ((index + 1) / count));
      const startBin = Math.max(1, Math.floor(startHz / binHz));
      const endBin = Math.min(spectrum.length, Math.max(startBin + 1, Math.ceil(endHz / binHz)));
      let maxValue = 0;
      for (let bin = startBin; bin < endBin; bin += 1) maxValue = Math.max(maxValue, spectrum[bin]);
      const normalized = maxValue / 255;
      const barHeight = Math.max(2, normalized * (height - 8));
      const x = index * (barWidth + barGap);
      context.globalAlpha = 0.58 + normalized * 0.42;
      context.fillRect(x, height - barHeight, barWidth, barHeight);
      context.globalAlpha = 0.14 + normalized * 0.22;
      context.fillRect(x, height - barHeight, barWidth, 3);
    }
    context.globalAlpha = 1;
  }

  drawWaveform(waveform) {
    const { context, width, height } = prepareCanvas(this.waveformCanvas);
    context.clearRect(0, 0, width, height);
    if (!waveform) return;
    const mid = height / 2;
    const gradient = context.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, "#35c2f0");
    gradient.addColorStop(0.5, "#2589e8");
    gradient.addColorStop(1, "#58e8d4");
    context.strokeStyle = gradient;
    context.shadowColor = "rgba(36, 174, 230, 0.68)";
    context.shadowBlur = 8;
    context.lineWidth = 1.4;
    context.beginPath();
    for (let index = 0; index < waveform.length; index += 1) {
      const x = (index / (waveform.length - 1)) * width;
      const y = mid - waveform[index] * height * 0.43;
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.stroke();
    context.shadowBlur = 0;
    context.globalAlpha = 0.1;
    context.fillStyle = gradient;
    context.lineTo(width, mid);
    context.lineTo(0, mid);
    context.closePath();
    context.fill();
    context.globalAlpha = 1;
  }

  setPlayback(active) {
    this.document.querySelector("#sculptureStage").classList.toggle("is-playing", active);
  }
}
