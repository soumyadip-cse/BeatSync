const statusElement = document.querySelector("#status");
const messageElement = document.querySelector("#message");
const connectButton = document.querySelector("#connectButton");
const connectionDiagnosticsElement = document.querySelector("#connectionDiagnostics");
const brightnessInput = document.querySelector("#brightness");
const brightnessValue = document.querySelector("#brightnessValue");
const sendButton = document.querySelector("#sendButton");
const customFrameInput = document.querySelector("#customFrame");
const customFrameButton = document.querySelector("#customFrameButton");
const testButton = document.querySelector("#testButton");
const simultaneousButton = document.querySelector("#simultaneousButton");
const testStatusElement = document.querySelector("#testStatus");
const liveToggle = document.querySelector("#liveToggle");
const virtualLedGrid = document.querySelector("#virtualLedGrid");
const logicalFrameElement = document.querySelector("#logicalFrame");
const audioFileInput = document.querySelector("#audioFile");
const audioPlayer = document.querySelector("#audioPlayer");
const audioToLedToggle = document.querySelector("#audioToLedToggle");
const fftGainInput = document.querySelector("#fftGain");
const fftGainValue = document.querySelector("#fftGainValue");
const audioStatusElement = document.querySelector("#audioStatus");
const fftRmsElement = document.querySelector("#fftRms");
const fftBrightnessElement = document.querySelector("#fftBrightness");
const bandReadingsElement = document.querySelector("#bandReadings");
const debugSummaryElement = document.querySelector("#debugSummary");
const debugAudioTimeElement = document.querySelector("#debugAudioTime");
const debugBrightnessElement = document.querySelector("#debugBrightness");
const debugLastSendTimestampElement = document.querySelector("#debugLastSendTimestamp");
const debugSendCountElement = document.querySelector("#debugSendCount");
const debugSuccessCountElement = document.querySelector("#debugSuccessCount");
const debugFailedCountElement = document.querySelector("#debugFailedCount");
const debugConnectionStateElement = document.querySelector("#debugConnectionState");
const debugAnalysisLoopElement = document.querySelector("#debugAnalysisLoop");
const debugLastSentValueElement = document.querySelector("#debugLastSentValue");
const debugLastSentFrameElement = document.querySelector("#debugLastSentFrame");
const debugFrameSizeElement = document.querySelector("#debugFrameSize");
const debugActiveWritesElement = document.querySelector("#debugActiveWrites");
const debugWriteOverlapsElement = document.querySelector("#debugWriteOverlaps");
const debugPeakWritesElement = document.querySelector("#debugPeakWrites");
const debugBackpressureElement = document.querySelector("#debugBackpressure");
const debugDesiredSizeElement = document.querySelector("#debugDesiredSize");
const debugMilestonesElement = document.querySelector("#debugMilestones");
const debugRuntimeErrorElement = document.querySelector("#debugRuntimeError");
const debugCurrentFrameElement = document.querySelector("#debugCurrentFrame");
const debugBandValuesElement = document.querySelector("#debugBandValues");
const debugBeatStateElement = document.querySelector("#debugBeatState");
const mediaEventsList = document.querySelector("#mediaEventsList");

const LED_CHANNELS = [
  { name: "LED 1", color: "red", pin: "D2", output: "digital" },
  { name: "LED 2", color: "green", pin: "D7", output: "digital" },
  { name: "LED 3", color: "red", pin: "D3", output: "PWM" },
  { name: "LED 4", color: "green", pin: "D8", output: "digital" },
  { name: "LED 5", color: "red", pin: "D4", output: "digital" },
  { name: "LED 6", color: "green", pin: "D9", output: "PWM" },
  { name: "LED 7", color: "red", pin: "D5", output: "PWM" },
  { name: "LED 8", color: "green", pin: "D10", output: "PWM" },
  { name: "LED 9", color: "red", pin: "D6", output: "PWM" },
  { name: "LED 10", color: "green", pin: "D11", output: "PWM" },
];

const FREQUENCY_BANDS = [
  { name: "bass", minHz: 40, maxHz: 250 },
  { name: "lowMid", minHz: 250, maxHz: 500 },
  { name: "mid", minHz: 500, maxHz: 2000 },
  { name: "highMid", minHz: 2000, maxHz: 6000 },
  { name: "treble", minHz: 6000, maxHz: 20000 },
];

const LED_MIX_WEIGHTS = [
  [1, 0, 0, 0, 0, 0],
  [0.7, 0.3, 0, 0, 0, 0],
  [0, 1, 0, 0, 0, 0],
  [0, 0.55, 0.45, 0, 0, 0],
  [0, 0, 1, 0, 0, 0],
  [0, 0, 0.55, 0.45, 0, 0],
  [0, 0, 0, 1, 0, 0],
  [0, 0, 0, 0.55, 0.45, 0],
  [0, 0, 0, 0, 1, 0],
  [0, 0, 0, 0, 0.75, 0.25],
];
const BEAT_BOOST_VALUES = [45, 40, 38, 34, 30, 28, 24, 20, 18, 14];

const FFT_SIZE = 2048;
const FFT_SMOOTHING = 0.65;
const MIN_FREQUENCY_HZ = 40;
const MAX_FREQUENCY_HZ = 20000;
const DIGITAL_THRESHOLD = 128;
const SERIAL_FRAME_INTERVAL_MS = 250;
const ATTACK_ALPHA = 0.38;
const RELEASE_ALPHA = 0.12;
const BEAT_BASELINE_SECONDS = 2.0;
const BEAT_PULSE_SECONDS = 0.35;
const BEAT_MIN_RISE = 0.04;
const BEAT_RELATIVE_RISE = 0.65;
const MANUAL_TEST_HOLD_MS = 350;

const mediaEventHistory = [];
const mediaEventNames = [
  "loadstart", "loadedmetadata", "canplay", "playing", "play", "pause",
  "waiting", "stalled", "abort", "emptied", "error", "ended", "timeupdate", "progress",
];

let port = null;
let writer = null;
let activeWritePromise = null;
let serialPumpPromise = null;
let pendingFrame = null;
let connectionClosing = false;
let connectionAttemptInProgress = false;
let connectionAttemptLog = [];
let connectionAttemptPhase = "idle";
let manualTestRunning = false;
const encoder = new TextEncoder();
let audioContext = null;
let analyser = null;
let audioSource = null;
let spectrumData = null;
let analysisFrame = 0;
let lastSerialSendAt = 0;
let lastAudioStatusAt = 0;
let currentAudioUrl = null;
let latestAudioTime = 0;
let latestFftRms = 0;
let latestCalculatedBrightness = 0;
let lastSerialSendTimestamp = null;
let lastSuccessfulFrameTimestamp = null;
let lastAnalysisFrameAt = 0;
let analysisLoopRunning = false;
let analysisStopReason = "not started";
let frameSendCount = 0;
let successfulFrameWriteCount = 0;
let failedFrameWriteCount = 0;
let lastSentFrame = null;
let lastFrameSizeBytes = null;
let activeWriteCount = 0;
let writeOverlapCount = 0;
let peakActiveWriteCount = 0;
let backpressureObservationCount = 0;
let lastWriterDesiredSize = null;
let lastRuntimeError = null;
let latestLedFrame = Array(LED_CHANNELS.length).fill(0);
let smoothedLedValues = Array(LED_CHANNELS.length).fill(0);
let previousAnalysisTimestamp = null;
let previousOverallEnergy = 0;
let overallEnergyBaseline = 0;
let beatPulse = 0;
let latestBandValues = Array(FREQUENCY_BANDS.length).fill(0);
let audioMilestones = { reached40: false, reached90: false, reachedEnd: false };

function createLedPreview() {
  for (let column = 0; column < 5; column += 1) {
    const columnElement = document.createElement("div");
    columnElement.className = "led-column";
    columnElement.setAttribute("aria-label", `Column ${column + 1}`);

    for (let row = 0; row < 2; row += 1) {
      const ledIndex = column * 2 + row;
      const channel = LED_CHANNELS[ledIndex];
      const channelElement = document.createElement("div");
      channelElement.className = "led-channel";
      const led = document.createElement("span");
      led.className = `led-dot led-${channel.color}`;
      led.setAttribute("aria-hidden", "true");
      const label = document.createElement("span");
      label.className = "led-label";
      const labelName = document.createElement("strong");
      labelName.textContent = `${channel.name} / L${ledIndex}`;
      const labelPin = document.createElement("span");
      labelPin.textContent = `${channel.pin} / ${channel.output}`;
      label.append(labelName, labelPin);
      const value = document.createElement("output");
      value.id = `ledValue${ledIndex}`;
      value.textContent = "0";
      channelElement.append(led, label, value);
      columnElement.append(channelElement);
    }

    virtualLedGrid.append(columnElement);
  }
}

let ledElements = [];

function setStatus(status, message) {
  statusElement.textContent = status;
  statusElement.className = `status status-${status.toLowerCase()}`;
  messageElement.textContent = message;
  updateDebugPanel();
}

function updateDebugPanel() {
  const now = performance.now();
  const analysisAge = lastAnalysisFrameAt ? now - lastAnalysisFrameAt : null;
  const analysisState = analysisLoopRunning
    ? (analysisAge !== null && analysisAge > 1000 ? `STALE (${Math.round(analysisAge)} ms)` : "RUNNING")
    : `STOPPED (${analysisStopReason})`;
  const serialState = !audioToLedToggle.checked
    ? "IDLE"
    : !writer
      ? "NO WRITER"
      : lastSuccessfulFrameTimestamp && now - lastSuccessfulFrameTimestamp < 1500
        ? "RUNNING"
        : "NO RECENT FRAME";
  const frameText = lastSentFrame ? lastSentFrame.join(",") : "--";
  const bandText = latestBandValues.map((value) => value.toFixed(2)).join(" / ");

  debugAudioTimeElement.textContent = `${latestAudioTime.toFixed(2)} s`;
  debugBrightnessElement.textContent = String(latestCalculatedBrightness);
  debugLastSendTimestampElement.textContent = lastSerialSendTimestamp || "--";
  debugSendCountElement.textContent = String(frameSendCount);
  debugSuccessCountElement.textContent = String(successfulFrameWriteCount);
  debugFailedCountElement.textContent = String(failedFrameWriteCount);
  debugConnectionStateElement.textContent = writer ? statusElement.textContent : `${statusElement.textContent} / NO WRITER`;
  debugAnalysisLoopElement.textContent = analysisState;
  debugLastSentFrameElement.textContent = frameText;
  debugLastSentValueElement.textContent = lastSentFrame ? String(lastSentFrame.at(-1)) : "--";
  debugFrameSizeElement.textContent = lastFrameSizeBytes === null ? "--" : `${lastFrameSizeBytes} bytes`;
  debugActiveWritesElement.textContent = String(activeWriteCount);
  debugWriteOverlapsElement.textContent = String(writeOverlapCount);
  debugPeakWritesElement.textContent = String(peakActiveWriteCount);
  debugBackpressureElement.textContent = String(backpressureObservationCount);
  debugDesiredSizeElement.textContent = lastWriterDesiredSize === null ? "--" : String(lastWriterDesiredSize);
  debugMilestonesElement.textContent = `${audioMilestones.reached40 ? "Yes" : "No"} / ${audioMilestones.reached90 ? "Yes" : "No"} / ${audioMilestones.reachedEnd ? "Yes" : "No"}`;
  debugRuntimeErrorElement.textContent = lastRuntimeError || "--";
  debugCurrentFrameElement.textContent = latestLedFrame.join(",");
  debugBandValuesElement.textContent = bandText;
  debugBeatStateElement.textContent = beatPulse > 0.15 ? `BEAT (${beatPulse.toFixed(2)})` : "IDLE";
  debugSummaryElement.textContent = `AUDIO ANALYSIS: ${analysisState} | SERIAL OUTPUT: ${serialState} | FRAMES: ${frameSendCount} | WRITE ERRORS: ${failedFrameWriteCount}`;
}

function setAudioStatus(message) {
  audioStatusElement.textContent = message;
}

function setPreviewFrame(values) {
  latestLedFrame = values.map(clampBrightness);
  logicalFrameElement.textContent = `Current logical frame: ${latestLedFrame.join(",")}`;
  for (let index = 0; index < latestLedFrame.length; index += 1) {
    const value = latestLedFrame[index];
    const level = value / 255;
    ledElements[index].led?.style.setProperty("--led-level", String(level));
    ledElements[index].value.textContent = String(value);
  }
}

function clampBrightness(value) {
  return Math.max(0, Math.min(255, Math.round(Number(value) || 0)));
}

function updateManualBrightnessDisplay() {
  const value = clampBrightness(brightnessInput.value);
  brightnessValue.value = String(value);
  brightnessValue.textContent = String(value);
}

function updateGainDisplay() {
  fftGainValue.value = `${Number(fftGainInput.value).toFixed(1)}x`;
  fftGainValue.textContent = fftGainValue.value;
}

function mediaEventCategory(eventName, ended) {
  if (eventName === "pause") return ended ? "pause event while ended === true" : "pause event while ended === false";
  if (eventName === "error") return "error event";
  if (eventName === "stalled" || eventName === "waiting") return `${eventName} event`;
  if (eventName === "emptied" || eventName === "loadstart") return `${eventName} source/element reset event`;
  return "media lifecycle event";
}

function renderMediaEvents() {
  mediaEventsList.replaceChildren();
  for (const event of mediaEventHistory) {
    const item = document.createElement("li");
    item.textContent = JSON.stringify(event);
    mediaEventsList.append(item);
  }
}

function recordMediaEvent(eventName) {
  const mediaError = audioPlayer.error;
  const snapshot = {
    eventName,
    category: mediaEventCategory(eventName, audioPlayer.ended),
    performanceNowMs: Number(performance.now().toFixed(2)),
    currentTime: Number.isFinite(audioPlayer.currentTime) ? Number(audioPlayer.currentTime.toFixed(3)) : null,
    duration: Number.isFinite(audioPlayer.duration) ? Number(audioPlayer.duration.toFixed(3)) : null,
    paused: audioPlayer.paused,
    ended: audioPlayer.ended,
    readyState: audioPlayer.readyState,
    networkState: audioPlayer.networkState,
    currentSrc: audioPlayer.currentSrc,
    errorCode: mediaError?.code ?? null,
    errorMessage: mediaError?.message || null,
    audioContextState: audioContext?.state || null,
  };
  mediaEventHistory.unshift(snapshot);
  mediaEventHistory.splice(20);
  renderMediaEvents();
  console.log("BeatSync media event", snapshot);
}

function resolvePendingFrame(frame, result) {
  if (frame?.resolve) frame.resolve(result);
}

function sendFrame(values, { updateStatus = false, source = "manual" } = {}) {
  const frameValues = values.map(clampBrightness);
  setPreviewFrame(frameValues);

  if (!writer || connectionClosing) {
    if (updateStatus) setStatus("ERROR", "The serial writer is unavailable. Connect Arduino again.");
    return Promise.resolve(false);
  }

  if (pendingFrame) resolvePendingFrame(pendingFrame, false);
  return new Promise((resolve) => {
    pendingFrame = { values: frameValues, updateStatus, source, resolve };
    startSerialPump();
  });
}

function startSerialPump() {
  if (serialPumpPromise || !pendingFrame || !writer || connectionClosing) return;
  const pump = drainSerialFrames();
  serialPumpPromise = pump;
  void pump.then(() => {
    if (serialPumpPromise === pump) serialPumpPromise = null;
    startSerialPump();
  }, (error) => {
    if (serialPumpPromise === pump) serialPumpPromise = null;
    if (pendingFrame) resolvePendingFrame(pendingFrame, false);
    pendingFrame = null;
    failedFrameWriteCount += 1;
    console.error("BeatSync serial frame sender failed", error);
    void closeConnection().then(() => setStatus("ERROR", `Send failed: ${error.message || "the serial sender stopped unexpectedly"}`));
  });
}

async function drainSerialFrames() {
  while (pendingFrame && writer && !connectionClosing) {
    const nextFrame = pendingFrame;
    pendingFrame = null;
    const frameText = nextFrame.values.join(",");
    const encodedFrame = encoder.encode(`${frameText}\n`);
    const activeWriter = writer;
    frameSendCount += 1;
    lastSerialSendTimestamp = new Date().toISOString();
    lastFrameSizeBytes = encodedFrame.byteLength;
    activeWriteCount = 1;
    peakActiveWriteCount = Math.max(peakActiveWriteCount, activeWriteCount);

    try {
      lastWriterDesiredSize = activeWriter.desiredSize;
      if (lastWriterDesiredSize !== null && lastWriterDesiredSize <= 0) backpressureObservationCount += 1;
    } catch {
      lastWriterDesiredSize = null;
    }

    let writeError = null;
    try {
      activeWritePromise = activeWriter.write(encodedFrame);
      await activeWritePromise;
      successfulFrameWriteCount += 1;
      lastSentFrame = nextFrame.values;
      lastSuccessfulFrameTimestamp = performance.now();
    } catch (error) {
      failedFrameWriteCount += 1;
      pendingFrame = null;
      writeError = error;
      console.error("BeatSync serial frame write failed", error);
    } finally {
      activeWritePromise = null;
      activeWriteCount = 0;
      updateDebugPanel();
    }

    resolvePendingFrame(nextFrame, !writeError);
    if (writeError) {
      await closeConnection();
      setStatus("ERROR", `Send failed: ${writeError.message || "the port disconnected"}`);
      return;
    }
    if (nextFrame.updateStatus) setStatus("CONNECTED", `Sent 10 LED values: ${frameText}.`);
  }
}

async function closeConnection() {
  connectionClosing = true;
  if (pendingFrame) resolvePendingFrame(pendingFrame, false);
  pendingFrame = null;
  if (activeWritePromise) {
    try {
      await activeWritePromise;
    } catch {
      // A disconnect may reject an in-progress write.
    }
  }
  if (writer) {
    try {
      writer.releaseLock();
    } catch {
      // The writer may already have been released.
    }
    writer = null;
  }
  if (port) {
    const closingPort = port;
    port = null;
    try {
      await closingPort.close();
    } catch {
      // The device may already be disconnected.
    }
  }
  sendButton.disabled = true;
  customFrameInput.disabled = true;
  customFrameButton.disabled = true;
  testButton.disabled = true;
  simultaneousButton.disabled = true;
  connectButton.disabled = connectionAttemptInProgress;
  updateDebugPanel();
}

function recordConnectionDiagnostic(stage, details = {}) {
  const entry = {
    time: new Date().toISOString(),
    elapsedMs: Math.round(performance.now()),
    stage,
    ...details,
  };
  connectionAttemptLog.unshift(entry);
  connectionAttemptLog = connectionAttemptLog.slice(0, 30);
  connectionDiagnosticsElement.textContent = connectionAttemptLog
    .map((item) => `${item.time} | ${item.stage}${item.details ? ` | ${item.details}` : ""}`)
    .join("\n");
  console.info("BeatSync Web Serial connection", entry);
}

function getPortInfo(selectedPort) {
  try {
    const info = selectedPort.getInfo?.();
    return info ? JSON.stringify(info) : "unavailable";
  } catch (error) {
    return `unavailable (${error?.name || "Error"}: ${error?.message || "unknown error"})`;
  }
}

async function connectArduino() {
  if (connectionAttemptInProgress) return;
  connectionAttemptInProgress = true;
  connectionAttemptLog = [];
  connectionAttemptPhase = "starting";
  connectionDiagnosticsElement.textContent = "Connection attempt started.";
  connectButton.disabled = true;
  setStatus("CONNECTING", "Preparing the serial connection.");
  recordConnectionDiagnostic("connection attempt started");

  let selectedPort = null;
  let selectedWriter = null;
  if (!("serial" in navigator)) {
    const error = new Error("Web Serial is not supported in this browser.");
    error.name = "NotSupportedError";
    recordConnectionDiagnostic("final connection state", { details: `DISCONNECTED; ${error.name}: ${error.message}` });
    setStatus("DISCONNECTED", error.message);
    connectionAttemptPhase = "failed";
    connectionAttemptInProgress = false;
    connectButton.disabled = false;
    return;
  }

  try {
    if (port || writer || activeWritePromise || pendingFrame) {
      connectionAttemptPhase = "stale connection cleanup";
      recordConnectionDiagnostic("stale connection cleanup started");
      await closeConnection();
      recordConnectionDiagnostic("stale connection cleanup completed");
      connectButton.disabled = true;
    }

    connectionAttemptPhase = "requestPort";
    setStatus("CONNECTING", "Choose the Arduino COM port in the browser dialog.");
    recordConnectionDiagnostic("requestPort() started");
    try {
      selectedPort = await navigator.serial.requestPort();
      recordConnectionDiagnostic("requestPort() resolved", { details: `port info: ${getPortInfo(selectedPort)}` });
    } catch (error) {
      recordConnectionDiagnostic("requestPort() rejected", { details: `${error?.name || "Error"}: ${error?.message || "unknown error"}` });
      throw error;
    }

    connectionAttemptPhase = "port.open";
    recordConnectionDiagnostic("port.open() started", { details: `baudRate: 115200; port info: ${getPortInfo(selectedPort)}` });
    try {
      await selectedPort.open({ baudRate: 115200 });
      recordConnectionDiagnostic("port.open() resolved");
    } catch (error) {
      recordConnectionDiagnostic("port.open() rejected", { details: `${error?.name || "Error"}: ${error?.message || "unknown error"}` });
      throw error;
    }

    if (!selectedPort.writable) {
      throw new Error("The selected port has no writable stream.");
    }

    connectionAttemptPhase = "writer.getWriter";
    recordConnectionDiagnostic("writer.getWriter() started");
    try {
      selectedWriter = selectedPort.writable.getWriter();
      recordConnectionDiagnostic("writer.getWriter() resolved");
    } catch (error) {
      recordConnectionDiagnostic("writer.getWriter() rejected", { details: `${error?.name || "Error"}: ${error?.message || "unknown error"}` });
      throw error;
    }

    port = selectedPort;
    writer = selectedWriter;
    connectionClosing = false;
    sendButton.disabled = false;
    customFrameInput.disabled = false;
    customFrameButton.disabled = false;
    testButton.disabled = false;
    simultaneousButton.disabled = false;
    setStatus("CONNECTED", "UNO R4 WiFi is ready for 10-value frames at 115200 baud.");
    connectionAttemptPhase = "connected";
    recordConnectionDiagnostic("final connection state", { details: "CONNECTED" });
  } catch (error) {
    const errorName = error?.name || "Error";
    const errorMessage = error?.message || "unknown error";
    const failedAt = connectionAttemptPhase;
    recordConnectionDiagnostic("connection error", { details: `${errorName}: ${errorMessage}; failed at ${failedAt}` });
    connectionAttemptPhase = "failed";
    sendButton.disabled = true;
    customFrameInput.disabled = true;
    customFrameButton.disabled = true;
    testButton.disabled = true;
    simultaneousButton.disabled = true;
    setStatus("DISCONNECTED", errorName === "NotFoundError"
      ? "Port selection was cancelled."
      : `Connection failed at ${failedAt}: ${errorName}: ${errorMessage}`);
    try {
      if (selectedWriter) selectedWriter.releaseLock();
    } catch (cleanupError) {
      recordConnectionDiagnostic("writer cleanup error", { details: `${cleanupError?.name || "Error"}: ${cleanupError?.message || "unknown error"}` });
    }
    if (writer === selectedWriter) writer = null;
    if (port === selectedPort) port = null;
    if (selectedPort) {
      try {
        await selectedPort.close();
        recordConnectionDiagnostic("failed port cleanup completed");
      } catch (cleanupError) {
        recordConnectionDiagnostic("port cleanup error", { details: `${cleanupError?.name || "Error"}: ${cleanupError?.message || "unknown error"}` });
      }
    }
    recordConnectionDiagnostic("final connection state", { details: `DISCONNECTED; ${errorName}: ${errorMessage}` });
  } finally {
    connectionAttemptInProgress = false;
    connectButton.disabled = Boolean(writer && port);
    if (!writer || !port) {
      sendButton.disabled = true;
      customFrameInput.disabled = true;
      customFrameButton.disabled = true;
      testButton.disabled = true;
      simultaneousButton.disabled = true;
    }
  }
}

function findBandRms(byteFrequencyData, binFrequency, minHz, maxHz) {
  const firstBin = Math.max(1, Math.floor(minHz / binFrequency));
  const lastBin = Math.min(byteFrequencyData.length, Math.ceil(maxHz / binFrequency));
  let squareSum = 0;
  let sampleCount = 0;
  for (let bin = firstBin; bin < lastBin; bin += 1) {
    const magnitude = byteFrequencyData[bin];
    squareSum += magnitude * magnitude;
    sampleCount += 1;
  }
  return sampleCount ? Math.sqrt(squareSum / sampleCount) : 0;
}

function mapAudioToLedTargets(bandValues, overallEnergy, sensitivity) {
  const features = [...bandValues, overallEnergy];
  return LED_MIX_WEIGHTS.map((weights) => {
    const normalizedEnergy = weights.reduce((sum, weight, index) => sum + weight * features[index], 0);
    return clampBrightness(normalizedEnergy * 255 * sensitivity);
  });
}

function updateBeatPulse(overallEnergy, timestamp) {
  const deltaSeconds = previousAnalysisTimestamp === null
    ? 1 / 60
    : Math.max(0, Math.min(0.1, (timestamp - previousAnalysisTimestamp) / 1000));
  if (overallEnergyBaseline === null) {
    overallEnergyBaseline = overallEnergy;
    previousOverallEnergy = overallEnergy;
    beatPulse = 0;
    return false;
  }

  const riseThreshold = Math.max(BEAT_MIN_RISE, overallEnergyBaseline * BEAT_RELATIVE_RISE);
  const detected = overallEnergy - overallEnergyBaseline >= riseThreshold
    && overallEnergy >= previousOverallEnergy * 1.12;
  beatPulse = detected ? 1 : beatPulse * Math.exp(-deltaSeconds / BEAT_PULSE_SECONDS);
  const baselineAmount = 1 - Math.exp(-deltaSeconds / BEAT_BASELINE_SECONDS);
  overallEnergyBaseline += (overallEnergy - overallEnergyBaseline) * baselineAmount;
  previousOverallEnergy = overallEnergy;
  return detected;
}

function smoothLedTargets(targets, timestamp) {
  const deltaSeconds = previousAnalysisTimestamp === null
    ? 1 / 60
    : Math.max(0, Math.min(0.1, (timestamp - previousAnalysisTimestamp) / 1000));
  previousAnalysisTimestamp = timestamp;

  return targets.map((target, index) => {
    const alpha = target > smoothedLedValues[index] ? ATTACK_ALPHA : RELEASE_ALPHA;
    const amount = 1 - Math.pow(1 - alpha, deltaSeconds * 60);
    smoothedLedValues[index] += (target - smoothedLedValues[index]) * amount;
    return clampBrightness(smoothedLedValues[index]);
  });
}

function updateAudioMilestones() {
  const time = audioPlayer.currentTime;
  if (time >= 40) audioMilestones.reached40 = true;
  if (time >= 90) audioMilestones.reached90 = true;
  updateDebugPanel();
}

function analyzeAudioFrame(now) {
  if (!analyser || audioPlayer.paused || audioPlayer.ended) {
    analysisStopReason = !analyser ? "analyser unavailable" : audioPlayer.ended ? "audio ended" : "audio paused";
    stopAnalysisLoop(analysisStopReason);
    return;
  }

  analysisLoopRunning = true;
  lastAnalysisFrameAt = now;
  latestAudioTime = audioPlayer.currentTime;
  analyser.getByteFrequencyData(spectrumData);

  const binFrequency = audioContext.sampleRate / analyser.fftSize;
  const rms = findBandRms(spectrumData, binFrequency, MIN_FREQUENCY_HZ, MAX_FREQUENCY_HZ);
  const sensitivity = Number(fftGainInput.value);
  latestFftRms = rms;
  latestCalculatedBrightness = clampBrightness(rms * sensitivity);
  fftRmsElement.textContent = rms.toFixed(2);
  fftBrightnessElement.value = String(latestCalculatedBrightness);
  fftBrightnessElement.textContent = String(latestCalculatedBrightness);

  const bandValues = FREQUENCY_BANDS.map((band) => findBandRms(spectrumData, binFrequency, band.minHz, band.maxHz) / 255);
  const overallEnergy = rms / 255;
  latestBandValues = bandValues;
  updateBeatPulse(overallEnergy, now);
  const targets = mapAudioToLedTargets(bandValues, overallEnergy, sensitivity)
    .map((target, index) => clampBrightness(target + BEAT_BOOST_VALUES[index] * beatPulse));
  const currentFrame = smoothLedTargets(targets, now);
  bandReadingsElement.textContent = `Bands (0-255 normalized × sensitivity): bass ${Math.round(bandValues[0] * 255 * sensitivity)} | low-mid ${Math.round(bandValues[1] * 255 * sensitivity)} | mid ${Math.round(bandValues[2] * 255 * sensitivity)} | high-mid ${Math.round(bandValues[3] * 255 * sensitivity)} | treble ${Math.round(bandValues[4] * 255 * sensitivity)}`;

  if (audioToLedToggle.checked && writer && now - lastSerialSendAt >= SERIAL_FRAME_INTERVAL_MS) {
    lastSerialSendAt = now;
    void sendFrame(currentFrame, { source: "audio" });
  } else if (!audioToLedToggle.checked || !writer) {
    setPreviewFrame(currentFrame);
  }

  updateAudioMilestones();
  if (now - lastAudioStatusAt >= 500) {
    lastAudioStatusAt = now;
    setAudioStatus(`Playing | FFT RMS ${Math.round(rms)} | 10 logical LED values ${audioToLedToggle.checked && writer ? "sent over serial" : "preview only"}.`);
  }
  updateDebugPanel();
  analysisFrame = requestAnimationFrame(analyzeAudioFrame);
}

function stopAnalysisLoop(reason = "stopped or paused") {
  if (analysisFrame) cancelAnimationFrame(analysisFrame);
  analysisFrame = 0;
  analysisLoopRunning = false;
  analysisStopReason = reason;
  updateDebugPanel();
}

async function startAudioAnalysis() {
  try {
    if (!analyser) {
      audioContext = new AudioContext();
      analyser = audioContext.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      analyser.smoothingTimeConstant = FFT_SMOOTHING;
      spectrumData = new Uint8Array(analyser.frequencyBinCount);
      audioSource = audioContext.createMediaElementSource(audioPlayer);
      audioSource.connect(analyser);
      analyser.connect(audioContext.destination);
    }
    if (audioContext.state === "suspended") await audioContext.resume();
    stopAnalysisLoop("restarting for playback");
    previousAnalysisTimestamp = null;
    previousOverallEnergy = 0;
    overallEnergyBaseline = null;
    beatPulse = 0;
    analysisFrame = requestAnimationFrame(analyzeAudioFrame);
  } catch (error) {
    audioToLedToggle.checked = false;
    lastRuntimeError = error?.message || "Audio analysis could not start.";
    setAudioStatus(`Audio analysis failed: ${lastRuntimeError}`);
  }
}

function releaseAudioFile() {
  stopAnalysisLoop("media source changed");
  if (currentAudioUrl) URL.revokeObjectURL(currentAudioUrl);
  currentAudioUrl = null;
}

function sleep(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

async function runTenLedTest() {
  if (!writer || manualTestRunning) return;
  if (!audioPlayer.paused) {
    testStatusElement.textContent = "Pause audio before running the wiring sequence.";
    return;
  }
  manualTestRunning = true;
  testButton.disabled = true;
  simultaneousButton.disabled = true;
  sendButton.disabled = true;
  customFrameInput.disabled = true;
  customFrameButton.disabled = true;
  brightnessInput.disabled = true;
  liveToggle.disabled = true;
  audioToLedToggle.disabled = true;
  testStatusElement.textContent = "Running: all off, LED 1 through LED 10, all on, all off.";
  const off = Array(LED_CHANNELS.length).fill(0);
  const sequence = [off];
  for (let index = 0; index < LED_CHANNELS.length; index += 1) {
    const oneLed = Array(LED_CHANNELS.length).fill(0);
    oneLed[index] = 255;
    sequence.push(oneLed);
  }
  sequence.push(Array(LED_CHANNELS.length).fill(255), off);

  try {
    for (let index = 0; index < sequence.length; index += 1) {
      const sent = await sendFrame(sequence[index], { updateStatus: false, source: "manual-test" });
      if (!sent) throw new Error("A test frame was not written successfully.");
      testStatusElement.textContent = `Test frame ${index + 1}/${sequence.length} sent: ${sequence[index].join(",")}`;
      await sleep(MANUAL_TEST_HOLD_MS);
    }
    testStatusElement.textContent = "Sequence sent. Confirm each physical LED and the PWM/digital behavior.";
  } catch (error) {
    testStatusElement.textContent = `Test stopped: ${error.message}`;
  } finally {
    manualTestRunning = false;
    testButton.disabled = !writer;
    simultaneousButton.disabled = !writer;
    sendButton.disabled = !writer;
    customFrameInput.disabled = !writer;
    customFrameButton.disabled = !writer;
    brightnessInput.disabled = false;
    liveToggle.disabled = false;
    audioToLedToggle.disabled = false;
  }
}

async function runSimultaneousLedTest() {
  if (!writer || manualTestRunning) return;
  if (!audioPlayer.paused) {
    testStatusElement.textContent = "Pause audio before running the simultaneous output test.";
    return;
  }
  const values = [255, 180, 160, 140, 120, 100, 80, 60, 40, 20];
  manualTestRunning = true;
  simultaneousButton.disabled = true;
  testButton.disabled = true;
  sendButton.disabled = true;
  customFrameInput.disabled = true;
  customFrameButton.disabled = true;
  brightnessInput.disabled = true;
  liveToggle.disabled = true;
  audioToLedToggle.disabled = true;
  try {
    const sent = await sendFrame(values, { updateStatus: false, source: "simultaneous-test" });
    testStatusElement.textContent = sent
      ? `Simultaneous test frame sent: ${values.join(",")}. Check all ten physical outputs.`
      : "Simultaneous test frame failed; inspect connection and write-error diagnostics.";
  } finally {
    manualTestRunning = false;
    simultaneousButton.disabled = !writer;
    testButton.disabled = !writer;
    sendButton.disabled = !writer;
    customFrameInput.disabled = !writer;
    customFrameButton.disabled = !writer;
    brightnessInput.disabled = false;
    liveToggle.disabled = false;
    audioToLedToggle.disabled = false;
  }
}

function recordCurrentMediaEvent(eventName) {
  if (eventName === "ended") audioMilestones.reachedEnd = true;
  const error = audioPlayer.error;
  const event = {
    eventName,
    performanceNowMs: Number(performance.now().toFixed(2)),
    currentTime: Number.isFinite(audioPlayer.currentTime) ? Number(audioPlayer.currentTime.toFixed(3)) : null,
    duration: Number.isFinite(audioPlayer.duration) ? Number(audioPlayer.duration.toFixed(3)) : null,
    paused: audioPlayer.paused,
    ended: audioPlayer.ended,
    readyState: audioPlayer.readyState,
    networkState: audioPlayer.networkState,
    currentSrc: audioPlayer.currentSrc,
    errorCode: error?.code ?? null,
    errorMessage: error?.message || null,
    audioContextState: audioContext?.state || null,
  };
  mediaEventHistory.unshift(event);
  mediaEventHistory.splice(20);
  renderMediaEvents();
  console.log("BeatSync media event", event);
  updateDebugPanel();
}

function initializeEvents() {
  brightnessInput.addEventListener("input", () => {
    updateManualBrightnessDisplay();
    const values = Array(LED_CHANNELS.length).fill(clampBrightness(brightnessInput.value));
    setPreviewFrame(values);
    if (liveToggle.checked) void sendFrame(values, { source: "manual-live" });
  });
  sendButton.addEventListener("click", () => {
    const values = Array(LED_CHANNELS.length).fill(clampBrightness(brightnessInput.value));
    void sendFrame(values, { updateStatus: true, source: "manual" });
  });
  customFrameButton.addEventListener("click", () => {
    if (manualTestRunning) return;
    const parts = customFrameInput.value.split(",").map((part) => part.trim());
    if (parts.length !== LED_CHANNELS.length || parts.some((part) => !/^\d+$/.test(part) || Number(part) > 255)) {
      testStatusElement.textContent = "Enter exactly 10 comma-separated whole numbers from 0 to 255.";
      customFrameInput.focus();
      return;
    }
    const values = parts.map(Number);
    testStatusElement.textContent = `Sending custom frame: ${values.join(",")}`;
    void sendFrame(values, { updateStatus: true, source: "manual-custom" });
  });
  testButton.addEventListener("click", runTenLedTest);
  simultaneousButton.addEventListener("click", runSimultaneousLedTest);
  connectButton.addEventListener("click", connectArduino);
  fftGainInput.addEventListener("input", updateGainDisplay);
  audioToLedToggle.addEventListener("change", () => {
    lastSerialSendAt = 0;
    if (audioToLedToggle.checked && !writer) setAudioStatus("Audio mapping is enabled, but Arduino is not connected. Values are preview only.");
    else if (audioToLedToggle.checked) setAudioStatus("Audio-to-10-LED output enabled. Press Play to stream frames.");
    else setAudioStatus("Audio output disabled. FFT values remain visible as a preview.");
  });
  audioFileInput.addEventListener("change", () => {
    const file = audioFileInput.files?.[0];
    if (!file) return;
    releaseAudioFile();
    currentAudioUrl = URL.createObjectURL(file);
    audioPlayer.src = currentAudioUrl;
    audioPlayer.load();
    audioMilestones = { reached40: false, reached90: false, reachedEnd: false };
    smoothedLedValues = Array(LED_CHANNELS.length).fill(0);
    setPreviewFrame(smoothedLedValues);
    setAudioStatus(`Loaded ${file.name}. Play it to calculate ten logical LED values.`);
    updateDebugPanel();
  });
  audioPlayer.addEventListener("play", startAudioAnalysis);
  audioPlayer.addEventListener("pause", () => stopAnalysisLoop("audio paused"));
  audioPlayer.addEventListener("ended", () => {
    audioMilestones.reachedEnd = true;
    stopAnalysisLoop("audio ended");
    setAudioStatus("Playback ended.");
  });
  audioPlayer.addEventListener("timeupdate", updateAudioMilestones);
  for (const eventName of mediaEventNames) audioPlayer.addEventListener(eventName, () => recordCurrentMediaEvent(eventName));

  if ("serial" in navigator) {
    navigator.serial.addEventListener("disconnect", (event) => {
      if (event.port === port) {
        void closeConnection();
        setStatus("ERROR", "Arduino disconnected.");
      }
    });
  } else {
    setStatus("ERROR", "Web Serial is not supported in this browser.");
  }

  window.addEventListener("error", (event) => {
    lastRuntimeError = event.message || "uncaught browser error";
    console.error("BeatSync runtime error", event.error || event.message);
    updateDebugPanel();
  });
  window.addEventListener("unhandledrejection", (event) => {
    lastRuntimeError = event.reason?.message || String(event.reason || "unhandled promise rejection");
    console.error("BeatSync unhandled promise rejection", event.reason);
    updateDebugPanel();
  });
}

createLedPreview();
ledElements = LED_CHANNELS.map((_, index) => ({
  led: document.querySelector(`#ledValue${index}`)?.previousElementSibling?.previousElementSibling,
  value: document.querySelector(`#ledValue${index}`),
}));
initializeEvents();
updateManualBrightnessDisplay();
updateGainDisplay();
setPreviewFrame(latestLedFrame);
updateDebugPanel();
setInterval(updateDebugPanel, 250);
