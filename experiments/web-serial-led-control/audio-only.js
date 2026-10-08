const fileInput = document.querySelector("#audioFile");
const audioPlayer = document.querySelector("#audioPlayer");
const selectedFile = document.querySelector("#selectedFile");
const testModeSelect = document.querySelector("#testMode");
const prepareButton = document.querySelector("#prepareMode");
const setupStatus = document.querySelector("#setupStatus");
const modeName = document.querySelector("#modeName");
const graphConnections = document.querySelector("#graphConnections");
const playbackStatus = document.querySelector("#playbackStatus");
const currentTimeOutput = document.querySelector("#currentTime");
const durationOutput = document.querySelector("#duration");
const pausedState = document.querySelector("#pausedState");
const endedState = document.querySelector("#endedState");
const readyState = document.querySelector("#readyState");
const networkState = document.querySelector("#networkState");
const currentSrc = document.querySelector("#currentSrc");
const mediaErrorCode = document.querySelector("#mediaErrorCode");
const mediaErrorMessage = document.querySelector("#mediaErrorMessage");
const graphStatus = document.querySelector("#graphStatus");
const contextState = document.querySelector("#contextState");
const eventHistory = document.querySelector("#eventHistory");

const recentEvents = [];
const pauseWrapperCalls = [];
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

const modeDefinitions = {
  native: {
    name: "MODE 1 - Native only",
    connections: "HTMLAudioElement only; no AudioContext or source node",
  },
  "source-only": {
    name: "MODE 2 - MediaElementAudioSourceNode only",
    connections: "HTMLAudioElement -> MediaElementAudioSourceNode -> nowhere",
  },
  "source-destination": {
    name: "MODE 3 - Source to Destination",
    connections: "HTMLAudioElement -> MediaElementAudioSourceNode -> AudioContext.destination",
  },
  "source-analyser-destination": {
    name: "MODE 4 - Source to Analyser to Destination",
    connections: "HTMLAudioElement -> MediaElementAudioSourceNode -> AnalyserNode -> AudioContext.destination (no FFT reads)",
  },
};

let objectUrl = null;
let audioContext = null;
let mediaSource = null;
let analyser = null;
let isPrepared = false;

const originalPause = HTMLMediaElement.prototype.pause;
HTMLMediaElement.prototype.pause = function (...args) {
  const pauseCall = {
    timestampMs: performance.now(),
    currentTime: this.currentTime,
    element: this,
    stack: new Error().stack,
    matchedToPauseEvent: false,
  };

  if (this === audioPlayer) {
    pauseWrapperCalls.push(pauseCall);
    pauseWrapperCalls.splice(20);
  }

  console.warn("HTMLMediaElement.pause() called", {
    element: this,
    currentTime: this.currentTime,
    stack: pauseCall.stack,
  });
  return originalPause.apply(this, args);
};

window.addEventListener("unload", () => {
  HTMLMediaElement.prototype.pause = originalPause;
});

function formatTime(value) {
  return Number.isFinite(value) ? `${value.toFixed(3)} s` : "--";
}

function updateMediaState() {
  const error = audioPlayer.error;
  currentTimeOutput.textContent = formatTime(audioPlayer.currentTime);
  durationOutput.textContent = formatTime(audioPlayer.duration);
  pausedState.textContent = String(audioPlayer.paused);
  endedState.textContent = String(audioPlayer.ended);
  readyState.textContent = String(audioPlayer.readyState);
  networkState.textContent = String(audioPlayer.networkState);
  currentSrc.textContent = audioPlayer.currentSrc || "(empty)";
  mediaErrorCode.textContent = error?.code == null ? "--" : String(error.code);
  mediaErrorMessage.textContent = error?.message || "--";
  contextState.textContent = audioContext?.state || "NOT CREATED";

  if (error) playbackStatus.textContent = "ERROR";
  else if (audioPlayer.ended) playbackStatus.textContent = "ENDED";
  else if (audioPlayer.paused) playbackStatus.textContent = "PAUSED";
  else playbackStatus.textContent = "PLAYING";
}

function pauseEventCorrelation(eventName) {
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
    pauseWrapperCalledBeforeEvent: Boolean(call),
    pauseWrapperCalledImmediatelyBefore: ageMs !== null && ageMs <= 1000,
    pauseWrapperCallAgeMs: ageMs,
    pauseWrapperCallStack: call?.stack || null,
  };
}

function renderHistory() {
  eventHistory.replaceChildren();
  for (const record of recentEvents) {
    const item = document.createElement("li");
    item.textContent = JSON.stringify(record);
    eventHistory.append(item);
  }
}

function recordMediaEvent(eventName) {
  const error = audioPlayer.error;
  const pauseInfo = pauseEventCorrelation(eventName);
  const record = {
    event: eventName,
    performanceNowMs: Number(performance.now().toFixed(2)),
    mode: modeDefinitions[testModeSelect.value]?.name || "not selected",
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
    pauseCall: pauseInfo,
  };

  recentEvents.unshift(record);
  recentEvents.splice(20);
  renderHistory();
  console.log("Web Audio routing media event", record);
  updateMediaState();
}

async function prepareSelectedMode() {
  const mode = testModeSelect.value;
  if (!modeDefinitions[mode]) {
    setupStatus.textContent = "Select a test mode first.";
    return;
  }
  if (!fileInput.files?.[0] || !audioPlayer.currentSrc) {
    setupStatus.textContent = "Select the test media file first.";
    return;
  }
  if (!audioPlayer.paused) {
    setupStatus.textContent = "Playback is already active. Reload and prepare the mode before pressing Play.";
    return;
  }

  setupStatus.textContent = "Preparing selected routing mode...";
  testModeSelect.disabled = true;
  fileInput.disabled = true;
  prepareButton.disabled = true;

  try {
    if (mode === "native") {
      graphStatus.textContent = "NOT CREATED (native playback only)";
      contextState.textContent = "NOT CREATED";
    } else {
      audioContext = new AudioContext();
      mediaSource = audioContext.createMediaElementSource(audioPlayer);

      if (mode === "source-only") {
        graphStatus.textContent = "MediaElementAudioSourceNode created; no connections";
      } else if (mode === "source-destination") {
        mediaSource.connect(audioContext.destination);
        graphStatus.textContent = "MediaElementAudioSourceNode connected to destination";
      } else if (mode === "source-analyser-destination") {
        analyser = audioContext.createAnalyser();
        mediaSource.connect(analyser);
        analyser.connect(audioContext.destination);
        graphStatus.textContent = "Source -> AnalyserNode -> destination; no FFT reads";
      }

      audioContext.addEventListener("statechange", () => {
        contextState.textContent = audioContext.state;
        recordMediaEvent("AudioContext statechange");
      });
      if (audioContext.state === "suspended") await audioContext.resume();
    }

    isPrepared = true;
    modeName.textContent = modeDefinitions[mode].name;
    graphConnections.textContent = modeDefinitions[mode].connections;
    testModeSelect.disabled = true;
    fileInput.disabled = true;
    prepareButton.disabled = true;
    setupStatus.textContent = "Prepared. Press Play using the native audio controls.";
    updateMediaState();
  } catch (error) {
    graphStatus.textContent = `SETUP ERROR: ${error.message || "unknown error"}`;
    contextState.textContent = audioContext?.state || "NOT CREATED";
    setupStatus.textContent = "Mode setup failed. Reload before attempting another mode.";
    console.error("Web Audio routing mode setup failed", error);
  }
}

for (const eventName of mediaEventNames) {
  audioPlayer.addEventListener(eventName, () => recordMediaEvent(eventName));
}

audioPlayer.addEventListener("play", () => {
  if (!isPrepared) setupStatus.textContent = "Playback began before mode preparation; reload for a controlled run.";
});

fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (!file) return;

  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = URL.createObjectURL(file);
  audioPlayer.src = objectUrl;
  audioPlayer.load();
  selectedFile.textContent = `${file.name} | ${file.type || "type not provided"} | ${file.size} bytes`;
  updateMediaState();
});

prepareButton.addEventListener("click", prepareSelectedMode);
updateMediaState();
