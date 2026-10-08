const fileInput = document.querySelector("#mediaFile");
const audioPlayer = document.querySelector("#audioPlayer");
const fileName = document.querySelector("#fileName");
const fileType = document.querySelector("#fileType");
const fileSize = document.querySelector("#fileSize");
const playbackStatus = document.querySelector("#playbackStatus");
const currentTimeOutput = document.querySelector("#currentTime");
const durationOutput = document.querySelector("#duration");
const eventHistory = document.querySelector("#eventHistory");

const recentEvents = [];
let objectUrl = null;

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
];

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "--:--";
  const wholeSeconds = Math.floor(seconds);
  const minutes = Math.floor(wholeSeconds / 60);
  const remainder = String(wholeSeconds % 60).padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function updateVisibleMediaState() {
  currentTimeOutput.value = formatTime(audioPlayer.currentTime);
  currentTimeOutput.textContent = currentTimeOutput.value;
  durationOutput.value = formatTime(audioPlayer.duration);
  durationOutput.textContent = durationOutput.value;

  let state = "PLAYING";
  if (audioPlayer.error) state = "ERROR";
  else if (audioPlayer.ended) state = "ENDED";
  else if (audioPlayer.paused) state = "PAUSED";

  playbackStatus.textContent = state;
  playbackStatus.dataset.state = state;
}

function captureMediaEvent(eventName) {
  const error = audioPlayer.error;
  const record = {
    event: eventName,
    timestamp: Number(performance.now().toFixed(2)),
    currentTime: Number.isFinite(audioPlayer.currentTime) ? Number(audioPlayer.currentTime.toFixed(3)) : null,
    duration: Number.isFinite(audioPlayer.duration) ? Number(audioPlayer.duration.toFixed(3)) : null,
    paused: audioPlayer.paused,
    ended: audioPlayer.ended,
    readyState: audioPlayer.readyState,
    networkState: audioPlayer.networkState,
    currentSrc: audioPlayer.currentSrc,
    errorCode: error?.code ?? null,
    errorMessage: error?.message || null,
  };

  recentEvents.unshift(record);
  recentEvents.splice(20);

  eventHistory.replaceChildren();
  for (const item of recentEvents) {
    const listItem = document.createElement("li");
    listItem.textContent = JSON.stringify(item);
    eventHistory.append(listItem);
  }

  console.log("Media playback event", record);
  updateVisibleMediaState();
}

for (const eventName of mediaEventNames) {
  audioPlayer.addEventListener(eventName, () => captureMediaEvent(eventName));
}

fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (!file) return;

  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = URL.createObjectURL(file);
  audioPlayer.src = objectUrl;
  audioPlayer.load();

  fileName.textContent = file.name;
  fileType.textContent = file.type || "(not provided)";
  fileSize.textContent = `${file.size} bytes`;
  updateVisibleMediaState();
});

updateVisibleMediaState();
