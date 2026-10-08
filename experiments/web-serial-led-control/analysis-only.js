const fileInput = document.querySelector("#audioFile");
const audioPlayer = document.querySelector("#audioPlayer");
const currentTimeOutput = document.querySelector("#currentTime");
const fftRmsOutput = document.querySelector("#fftRms");
const brightnessOutput = document.querySelector("#brightness");
const frameCountOutput = document.querySelector("#frameCount");
const lastAnalysisTimestampOutput = document.querySelector("#lastAnalysisTimestamp");
const eventHistory = document.querySelector("#eventHistory");

const FFT_SIZE = 2048;
const FFT_SMOOTHING = 0.65;
const MIN_FREQUENCY_HZ = 40;
const MAX_FREQUENCY_HZ = 10000;
const FFT_GAIN = 2;
const PAUSE_CALL_IMMEDIATE_WINDOW_MS = 1000;

const mediaEventNames = [
  "loadstart",
  "loadedmetadata",
  "canplay",
  "playing",
  "play",
  "pause",
  "waiting",
  "stalled",
  "abort",
  "emptied",
  "error",
  "ended",
  "timeupdate",
  "progress",
  "suspend",
  "seeking",
  "seeked",
  "durationchange",
  "ratechange",
  "volumechange",
];

const recentEvents = [];
const pauseWrapperCalls = [];
let objectUrl = null;
let audioContext = null;
let mediaSource = null;
let analyser = null;
let spectrumData = null;
let analysisFrameRequest = 0;
let analysisFrameCount = 0;

const originalPause = HTMLMediaElement.prototype.pause;
HTMLMediaElement.prototype.pause = function (...args) {
  const call = {
    timestampMs: performance.now(),
    currentTime: this.currentTime,
    element: this,
    stack: new Error().stack,
    matchedToPauseEvent: false,
  };

  if (this === audioPlayer) {
    pauseWrapperCalls.push(call);
    pauseWrapperCalls.splice(20);
  }

  console.warn("HTMLMediaElement.pause() called", {
    element: this,
    currentTime: this.currentTime,
    stack: call.stack,
  });
  return originalPause.apply(this, args);
};

window.addEventListener("unload", () => {
  HTMLMediaElement.prototype.pause = originalPause;
});

function correlatePauseCall(eventName) {
  if (eventName !== "pause") return null;

  const now = performance.now();
  let call = null;
  for (let index = pauseWrapperCalls.length - 1; index >= 0; index -= 1) {
    if (!pauseWrapperCalls[index].matchedToPauseEvent) {
      call = pauseWrapperCalls[index];
      call.matchedToPauseEvent = true;
      break;
    }
  }

  const ageMs = call ? Number((now - call.timestampMs).toFixed(2)) : null;
  return {
    wrapperCalledBeforePauseEvent: Boolean(call),
    wrapperCalledImmediatelyBeforePauseEvent: ageMs !== null && ageMs <= PAUSE_CALL_IMMEDIATE_WINDOW_MS,
    wrapperCallAgeMs: ageMs,
    wrapperCallStack: call?.stack || null,
  };
}

function recordMediaEvent(eventName) {
  const error = audioPlayer.error;
  const record = {
    event: eventName,
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
    pauseCall: correlatePauseCall(eventName),
  };

  recentEvents.unshift(record);
  recentEvents.splice(20);
  eventHistory.replaceChildren();
  for (const event of recentEvents) {
    const item = document.createElement("li");
    item.textContent = JSON.stringify(event);
    eventHistory.append(item);
  }
  console.log("Mode 5 media event", record);
}

function setupAudioGraph() {
  if (analyser) return;

  audioContext = new AudioContext();
  analyser = audioContext.createAnalyser();
  analyser.fftSize = FFT_SIZE;
  analyser.smoothingTimeConstant = FFT_SMOOTHING;
  spectrumData = new Uint8Array(analyser.frequencyBinCount);
  mediaSource = audioContext.createMediaElementSource(audioPlayer);
  mediaSource.connect(analyser);
  analyser.connect(audioContext.destination);

  console.log("Mode 5 Web Audio graph connected", {
    graph: "HTMLAudioElement -> MediaElementAudioSourceNode -> AnalyserNode -> AudioContext.destination",
    audioContextState: audioContext.state,
    fftSize: FFT_SIZE,
    smoothingTimeConstant: FFT_SMOOTHING,
    frequencyRangeHz: [MIN_FREQUENCY_HZ, MAX_FREQUENCY_HZ],
    brightnessGain: FFT_GAIN,
  });
  audioContext.addEventListener("statechange", () => {
    console.log("Mode 5 AudioContext state change", audioContext.state);
  });
}

function stopAnalysisLoop(reason) {
  if (analysisFrameRequest) cancelAnimationFrame(analysisFrameRequest);
  analysisFrameRequest = 0;
  console.log("Mode 5 analysis loop stopped", { reason, audioTime: audioPlayer.currentTime });
}

function analyzeAudioFrame(timestamp) {
  if (!analyser || audioPlayer.paused || audioPlayer.ended) {
    stopAnalysisLoop(!analyser ? "analyser unavailable" : audioPlayer.ended ? "audio ended" : "audio paused");
    return;
  }

  analysisFrameCount += 1;
  analyser.getByteFrequencyData(spectrumData);

  const binFrequency = audioContext.sampleRate / analyser.fftSize;
  const firstBin = Math.max(1, Math.floor(MIN_FREQUENCY_HZ / binFrequency));
  const lastBin = Math.min(spectrumData.length, Math.ceil(MAX_FREQUENCY_HZ / binFrequency));
  let squareSum = 0;
  let samples = 0;

  for (let bin = firstBin; bin < lastBin; bin += 1) {
    const magnitude = spectrumData[bin];
    squareSum += magnitude * magnitude;
    samples += 1;
  }

  const fftRms = samples > 0 ? Math.sqrt(squareSum / samples) : 0;
  const brightness = Math.max(0, Math.min(255, Math.round(fftRms * FFT_GAIN)));

  currentTimeOutput.textContent = `${audioPlayer.currentTime.toFixed(2)} s`;
  fftRmsOutput.textContent = fftRms.toFixed(2);
  brightnessOutput.textContent = String(brightness);
  frameCountOutput.textContent = String(analysisFrameCount);
  lastAnalysisTimestampOutput.textContent = `${timestamp.toFixed(2)} ms`;

  analysisFrameRequest = requestAnimationFrame(analyzeAudioFrame);
}

async function startAnalysisOnPlay() {
  try {
    setupAudioGraph();
    if (audioContext.state === "suspended") await audioContext.resume();
    analysisFrameCount = 0;
    analysisFrameRequest = requestAnimationFrame(analyzeAudioFrame);
  } catch (error) {
    console.error("Mode 5 analysis startup exception", error);
  }
}

for (const eventName of mediaEventNames) {
  audioPlayer.addEventListener(eventName, () => recordMediaEvent(eventName));
}

audioPlayer.addEventListener("play", () => {
  startAnalysisOnPlay();
});
audioPlayer.addEventListener("pause", () => stopAnalysisLoop("audio paused"));
audioPlayer.addEventListener("ended", () => stopAnalysisLoop("audio ended"));

fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (!file || !audioPlayer.paused) return;

  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = URL.createObjectURL(file);
  audioPlayer.src = objectUrl;
  audioPlayer.load();
});

window.addEventListener("error", (event) => {
  console.error("Mode 5 JavaScript runtime exception", event.message, event.error);
});
window.addEventListener("unhandledrejection", (event) => {
  console.error("Mode 5 unhandled promise rejection", event.reason);
});

console.log("Mode 5 diagnostic ready. Select a file and press native Play.");
