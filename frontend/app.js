import { AudioAnalyzer } from "./audio/AudioAnalyzer.js";
import { LocalSongSource } from "./audio/LocalSongSource.js";
import { MicrophoneSource } from "./audio/MicrophoneSource.js";
import { ANALYSIS_UI_INTERVAL_MS, DEFAULT_LIGHTING_CONFIG, LIGHTING_PRESETS } from "./audio/audioConfig.js";
import { ARDUINO_10_LED_PROFILE, DIGITAL_THRESHOLD, SERIAL_BAUD_RATE, mapLogicalToPhysical, normalizePhysicalFrame } from "./hardware/Arduino10LedProfile.js";
import { LightingEngine } from "./lighting/LightingEngine.js";
import { lyricIndexAt, parseLrc } from "./lyrics/LrcLyrics.js";
import { IdentificationService } from "./metadata/IdentificationService.js";
import { parseCsvFrame } from "./serial/SerialProtocol.js";
import { SerialTransport } from "./serial/SerialTransport.js";
import { DashboardVisuals } from "./visualizer/DashboardVisuals.js";

const $ = (selector) => document.querySelector(selector);
const audioPlayer = $("#audioPlayer");
const source = new LocalSongSource(audioPlayer);
const microphone = new MicrophoneSource();
const analyzer = new AudioAnalyzer();
const lightingEngine = new LightingEngine({ ledCount: Number($("#logicalLedCount")?.value || 10) });
const serial = new SerialTransport({ baudRate: SERIAL_BAUD_RATE, frameLength: ARDUINO_10_LED_PROFILE.physicalChannels });
const visuals = new DashboardVisuals(document, ARDUINO_10_LED_PROFILE);
const identification = new IdentificationService();

const config = {
  ...DEFAULT_LIGHTING_CONFIG,
  logicalLedCount: Number($("#logicalLedCount")?.value || 10),
  sensitivity: Number($("#sensitivity")?.value || DEFAULT_LIGHTING_CONFIG.sensitivity),
  intensity: Number($("#intensity")?.value || DEFAULT_LIGHTING_CONFIG.intensity),
  attack: Number($("#smoothing")?.value || DEFAULT_LIGHTING_CONFIG.attack),
  release: Number($("#smoothingRelease")?.value || DEFAULT_LIGHTING_CONFIG.release),
  beatBoost: Number($("#beatBoost")?.value || DEFAULT_LIGHTING_CONFIG.beatBoost),
  transientBoost: Number($("#transientBoost")?.value || DEFAULT_LIGHTING_CONFIG.transientBoost),
  beatThreshold: Number($("#beatThreshold")?.value || DEFAULT_LIGHTING_CONFIG.beatThreshold),
  transientThreshold: Number($("#transientThreshold")?.value || DEFAULT_LIGHTING_CONFIG.transientThreshold),
  mode: $("#visualMode")?.value || "hybrid",
  serialIntervalMs: Number($("#frameRate")?.value || DEFAULT_LIGHTING_CONFIG.serialIntervalMs),
};

let animationFrame = 0;
let analysisRunning = false;
let startAnalysisPromise = null;
let sourceMode = "none";
let lastSerialFrameAt = 0;
let lastUiUpdateAt = 0;
let currentAnalysis = null;
let currentLighting = null;
let analysisFrameCount = 0;
let lastRuntimeError = "";
let serialOutputEnabled = Boolean($("#audioToLed")?.checked);
let mediaEvents = [];
let sequenceToken = 0;
let activeIdentificationController = null;
let identificationSignature = "";
let testCatalog = null;
let selectedCatalogTrack = null;
let activeLyrics = null;
let pendingLocalLyrics = null;
const localLyricsByTrack = new Map();
const remoteLyricsByTrack = new Map();
let lastRenderedLyricIndex = -2;

const formatTime = (seconds) => {
  if (!Number.isFinite(seconds) || seconds < 0) return "--:--";
  const value = Math.floor(seconds);
  return String(Math.floor(value / 60)).padStart(2, "0") + ":" + String(value % 60).padStart(2, "0");
};

const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes)) return "unknown size";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
};

function setText(selector, value) {
  const element = $(selector);
  if (element) element.textContent = String(value);
}

function mediaBaseName(name) {
  return String(name || "").normalize("NFKC").toLocaleLowerCase().replace(/\.[^.]+$/, "").replace(/[\s_-]+/g, " ").trim();
}

function setLiveTag(selector, text, state = "") {
  const element = $(selector);
  if (!element) return;
  element.dataset.state = state;
  element.textContent = text;
}

function setAudioStatus(message) {
  setText("#audioStatus", message);
}

function updateClock() {
  const now = new Date();
  const clock = $("#localClock");
  if (clock) {
    clock.replaceChildren(document.createTextNode(now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })));
    const small = document.createElement("small");
    small.textContent = now.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
    clock.append(small);
  }
}

function renderConnectionLog() {
  const list = $("#connectionLog");
  if (!list) return;
  list.replaceChildren();
  for (const item of serial.diagnostics) {
    const row = document.createElement("li");
    row.textContent = new Date(item.at).toLocaleTimeString() + " · " + item.stage + (item.details ? " — " + item.details : "");
    list.append(row);
  }
  if (!serial.diagnostics.length) {
    const row = document.createElement("li");
    row.textContent = "Start a connection from this page.";
    list.append(row);
  }
  setText("#connectionPhase", serial.attemptPhase);
}

function renderMediaEvents() {
  const list = $("#mediaEventList");
  if (!list) return;
  list.replaceChildren();
  for (const event of mediaEvents) {
    const row = document.createElement("li");
    row.textContent = event.at + " · " + event.name + " · t=" + event.time + " / " + event.duration
      + " · paused=" + event.paused + " · ready=" + event.readyState + " · network=" + event.networkState
      + " · error=" + event.error;
    list.append(row);
  }
}

function recordMediaEvent(name) {
  const error = audioPlayer.error;
  mediaEvents.unshift({
    at: new Date().toLocaleTimeString(),
    elapsedMs: Math.round(performance.now()),
    name,
    time: Number.isFinite(audioPlayer.currentTime) ? audioPlayer.currentTime.toFixed(2) : "--",
    duration: Number.isFinite(audioPlayer.duration) ? audioPlayer.duration.toFixed(2) : "--",
    paused: audioPlayer.paused,
    ended: audioPlayer.ended,
    readyState: audioPlayer.readyState,
    networkState: audioPlayer.networkState,
    source: audioPlayer.currentSrc || "--",
    error: error ? String(error.code) + " " + (error.message || "") : "--",
    context: analyzer.state,
  });
  mediaEvents = mediaEvents.slice(0, 20);
  renderMediaEvents();
}

function updateConnectionUI(message = "") {
  const state = serial.status;
  const connected = serial.connected;
  const pill = $("#connectionPill");
  const serialStatus = $("#serialStatus");
  if (pill) pill.dataset.state = state.toLowerCase();
  if (serialStatus) serialStatus.dataset.state = state.toLowerCase();
  setText("#connectionLabel", state === "CONNECTED" ? "Arduino Connected" : state === "CONNECTING" ? "Connecting…" : state === "ERROR" ? "Connection Error" : "Arduino Disconnected");
  const statusLabel = serialStatus?.querySelector("b");
  if (statusLabel) statusLabel.textContent = state[0] + state.slice(1).toLowerCase();
  setText("#deviceLabel", connected ? "USB serial device selected" : "Not selected");
  setText("#deviceId", connected ? serial.deviceId : "--");
  const connectButton = $("#connectButton");
  if (connectButton) {
    connectButton.disabled = connected || state === "CONNECTING";
    connectButton.textContent = state === "CONNECTING" ? "Connecting…" : connected ? "Arduino Connected" : "Connect Arduino";
  }
  const disconnectButton = $("#disconnectButton");
  if (disconnectButton) disconnectButton.disabled = !connected;
  const manualSend = $("#sendCustomFrame");
  if (manualSend) manualSend.disabled = !connected;
  setText("#connectionPhase", serial.attemptPhase);
  setText("#footerState", connected ? "LOCAL AUDIO · USB SERIAL CONNECTED" : "LOCAL-ONLY AUDIO PIPELINE");
  if (message) setAudioStatus(message);
}

function renderSerialStats() {
  const stats = serial.stats;
  setText("#frameCount", stats.frameCount);
  setText("#writeSuccessCount", stats.successfulWrites);
  setText("#writeErrorCount", stats.failedWrites);
  setText("#lastSentFrame", stats.lastFrame ? stats.lastFrame.join(",") : "--");
  setText("#lastWriteTime", stats.lastWriteAt ? new Date(stats.lastWriteAt).toLocaleTimeString() : "--");
  setText("#rateReadout", Math.round(1000 / config.serialIntervalMs) + " frames / sec max");
  setText("#activeWrites", stats.activeWrites);
  setText("#writeOverlaps", stats.overlaps);
  setText("#peakWrites", stats.peakActiveWrites);
  setText("#backpressureCount", stats.backpressure);
  setText("#writePending", serial.pendingFrameCount ? "1 latest frame" : "none");
  setText("#runtimeError", serial.error ? serial.error.name + ": " + serial.error.message : lastRuntimeError || "--");
}

function renderPlaylist() {
  const playlist = $("#playlist");
  if (!playlist) return;
  playlist.replaceChildren();
  const query = ($("#catalogSearch")?.value || "").trim().toLocaleLowerCase();
  const results = source.tracks.filter((track) => {
    const metadata = track.metadata || {};
    return !query || [metadata.title, metadata.artist, track.name].filter(Boolean).join(" ").toLocaleLowerCase().includes(query);
  });
  setText("#localMediaCount", source.tracks.length + " local media");
  setText("#localLibraryCount", results.length + (results.length === 1 ? " item" : " items"));
  if (!source.tracks.length || !results.length) {
    const empty = document.createElement("div");
    empty.className = "empty-note";
    empty.textContent = !source.tracks.length
      ? "No local media yet. Add a music or video file from the dashboard."
      : "No local media matches this search.";
    playlist.append(empty);
    return;
  }
  for (const track of results) {
    const metadata = track.metadata || {};
    const item = document.createElement("button");
    item.type = "button";
    item.className = "playlist-track";
    const active = !selectedCatalogTrack && track.id === source.activeTrackId;
    item.classList.toggle("is-active", active);
    item.setAttribute("aria-pressed", String(active));
    const glyph = document.createElement("span");
    glyph.className = "playlist-track__glyph";
    glyph.textContent = active && !audioPlayer.paused ? "Ⅱ" : "♫";
    const text = document.createElement("span");
    text.className = "playlist-track__text";
    const name = document.createElement("b");
    name.textContent = metadata.title || track.name;
    const meta = document.createElement("small");
    const artist = metadata.artist || "Artist not set";
    const duration = Number.isFinite(track.duration) ? " · " + formatTime(track.duration) : "";
    meta.textContent = artist + " · " + (metadata.language || "Language not set") + " · USER UPLOAD · " + (track.type || "Local media") + duration;
    text.append(name, meta);
    const action = document.createElement("span");
    action.className = "playlist-track__action";
    action.textContent = "Select";
    item.append(glyph, text, action);
    item.addEventListener("click", () => {
      chooseTrack(track.id);
      showDashboard();
    });
    playlist.append(item);
  }
}

function resetMetrics() {
  currentAnalysis = null;
  currentLighting = null;
  setText("#playbackTime", "00:00 / --:--");
  setText("#audioTimeLabel", "00:00");
  setText("#elapsedMetric", "00:00");
  setText("#durationMetric", "--:-- total");
  setText("#bpmMetric", "—");
  setText("#energyMetric", "--%");
  setText("#beatMetric", "WAITING");
  setText("#beatSubtext", "No onset yet");
  setText("#beatConfidenceMetric", "—");
  setText("#beatCountMetric", "0");
  setText("#transientMetric", "—");
  setText("#sampleRateLabel", "Sample rate · -- Hz");
  setText("#bandSummaryStatus", "Bands appear after playback starts.");
  setText("#audioContextState", analyzer.state);
  visuals.setBandValues({});
  visuals.setFrame(Array(config.logicalLedCount).fill(0));
  visuals.setHardwareFrame(Array(ARDUINO_10_LED_PROFILE.physicalChannels).fill(0));
}

function chooseTrack(id) {
  sequenceToken += 1;
  selectedCatalogTrack = null;
  $("#playButton").disabled = false;
  audioPlayer.hidden = false;
  $("#trackAvailability").hidden = true;
  $("#trackAvailability").textContent = "";
  if (activeIdentificationController) activeIdentificationController.abort();
  identificationSignature = "";
  if (microphone.active) {
    analyzer.disconnectSource();
    microphone.stop();
  }
  stopAnalysis("Track selected. Press Play to start local analysis.");
  sourceMode = "music";
  const track = source.select(id);
  if (!track) return;
  lightingEngine.reset();
  resetMetrics();
  setText("#trackName", track.name);
  setText("#trackArtist", track.type + " · " + formatBytes(track.size) + " · local file");
  setText("#trackDuration", "--:--");
  setLiveTag("#playState", "LOADED", "ready");
  setLiveTag("#analysisState", "READY · PRESS PLAY", "ready");
  setText("#sourceLabel", track.type.startsWith("video/") ? "VIDEO FILE" : "LOCAL MEDIA");
  setAudioStatus("Loaded " + track.name + ". Metadata lookup runs in the background; playback stays local.");
  setText("#identificationStatus", "Waiting for media metadata…");
  if (pendingLocalLyrics && mediaBaseName(pendingLocalLyrics.name) === mediaBaseName(track.name)) {
    localLyricsByTrack.set(track.id, pendingLocalLyrics);
    pendingLocalLyrics = null;
  }
  renderLyricsForTrack(track);
  renderPlaylist();
  renderCatalog();
  visuals.setPlayback(false);
  if (audioPlayer.readyState >= 1) void identifyCurrentTrack(track);
}

function selectCatalogTrack(track) {
  sequenceToken += 1;
  if (activeIdentificationController) activeIdentificationController.abort();
  activeIdentificationController = null;
  identificationSignature = "";
  selectedCatalogTrack = track;
  if (microphone.active) {
    analyzer.disconnectSource();
    microphone.stop();
  }
  sourceMode = "none";
  stopAnalysis();
  audioPlayer.pause();
  audioPlayer.removeAttribute("src");
  audioPlayer.load();
  audioPlayer.hidden = true;
  $("#playButton").disabled = true;
  lightingEngine.reset();
  resetMetrics();
  setText("#trackName", track.title);
  setText("#trackArtist", track.artist + " · " + track.language);
  setText("#trackAvailability", "Metadata only · No local audio file attached");
  $("#trackAvailability").hidden = false;
  setText("#trackDuration", "--:--");
  setText("#sourceLabel", "TEST CATALOG");
  setLiveTag("#playState", "METADATA ONLY", "ready");
  setLiveTag("#analysisState", "NO LOCAL AUDIO", "ready");
  setText("#identificationStatus", "Metadata only. No local audio file is attached to this catalog entry.");
  setAudioStatus("Metadata only · No local audio file attached. Add a local media file to play, analyze, and control the lights.");
  renderLyricsForTrack(null);
  renderPlaylist();
  renderCatalog();
  visuals.setPlayback(false);
  showDashboard();
}

function updateTrackMetadataUI(track, metadata = track?.metadata) {
  if (!track || selectedCatalogTrack || track.id !== source.activeTrackId) return;
  setText("#trackName", metadata?.title || track.name);
  const titleInput = $("#lyricsTrackTitle");
  const artistInput = $("#lyricsTrackArtist");
  if (titleInput && !titleInput.matches(":focus")) titleInput.value = metadata?.title || "";
  if (artistInput && !artistInput.matches(":focus")) artistInput.value = metadata?.artist || "";
  const parts = [metadata?.artist, metadata?.album].filter(Boolean);
  const metadataLabel = metadata?.source ? " · " + metadata.source : "";
  setText("#trackArtist", (parts.join(" · ") || track.type) + metadataLabel + " · " + formatBytes(track.size));
  setText("#trackDuration", formatTime(track.duration));
  renderPlaylist();
}

function lyricSourceForTrack(track) {
  if (!track) return null;
  return localLyricsByTrack.get(track.id) || remoteLyricsByTrack.get(track.id) || null;
}

function renderLyricsForTrack(track) {
  activeLyrics = lyricSourceForTrack(track);
  lastRenderedLyricIndex = -2;
  const pill = $("#lyricsStatusPill");
  const fileName = $("#lyricsFileName");
  const plain = $("#lyricsPlain");
  if (plain) {
    plain.hidden = true;
    plain.textContent = "";
  }

  if (sourceMode === "microphone") {
    if (pill) pill.textContent = "NOT USED IN MIC MODE";
    if (fileName) fileName.textContent = "Microphone audio is not matched to songs or lyrics.";
    setText("#lyricsPrevious", "");
    setText("#lyricsCurrent", "Lyrics are off in microphone mode");
    setText("#lyricsNext", "");
  } else if (activeLyrics?.cues) {
    if (pill) pill.textContent = activeLyrics.origin === "LRCLIB" ? "LRCLIB · SYNCED" : "LOCAL · SYNCED";
    if (fileName) fileName.textContent = activeLyrics.name || "Timed lyrics follow media playback time.";
    renderLyricsAtTime(audioPlayer.currentTime || 0);
  } else if (activeLyrics?.plain) {
    if (pill) pill.textContent = "UNSYNCED · LRCLIB";
    if (fileName) fileName.textContent = "Plain lyrics are shown without playback synchronization.";
    setText("#lyricsPrevious", "");
    setText("#lyricsCurrent", "Plain lyrics · not time-synchronized");
    setText("#lyricsNext", "");
    if (plain) {
      plain.hidden = false;
      plain.textContent = activeLyrics.plain;
    }
  } else if (activeLyrics?.unavailable) {
    if (pill) pill.textContent = "NO LYRICS FOUND";
    if (fileName) fileName.textContent = "No lyric text was returned for this song. Try checking the title and artist, then search again.";
    setText("#lyricsPrevious", "");
    setText("#lyricsCurrent", "Lyrics are unavailable for this match");
    setText("#lyricsNext", "");
  } else if (pendingLocalLyrics) {
    if (pill) pill.textContent = "LOCAL LYRICS READY";
    if (fileName) fileName.textContent = pendingLocalLyrics.name + " · choose a matching local song to sync.";
    setText("#lyricsPrevious", "");
    setText("#lyricsCurrent", "Timed lyrics are ready");
    setText("#lyricsNext", "Select the matching song");
  } else {
    if (pill) pill.textContent = "LYRICS UNAVAILABLE";
    if (fileName) fileName.textContent = track ? "Looking for matching lyrics from local metadata…" : "Choose a song file to look for available lyrics.";
    setText("#lyricsPrevious", "");
    setText("#lyricsCurrent", track ? "Checking available lyrics…" : "Lyrics will appear here");
    setText("#lyricsNext", "");
  }
}

function renderLyricsAtTime(seconds) {
  if (!activeLyrics?.cues) return;
  const index = lyricIndexAt(activeLyrics.cues, seconds);
  if (index === lastRenderedLyricIndex) return;
  lastRenderedLyricIndex = index;
  setText("#lyricsPrevious", activeLyrics.cues[index - 1]?.text || "");
  setText("#lyricsCurrent", activeLyrics.cues[index]?.text || "Waiting for the first lyric line…");
  setText("#lyricsNext", activeLyrics.cues[index + 1]?.text || "");
}

async function loadLyricsFile(file) {
  const cues = parseLrc(await file.text());
  const base = mediaBaseName(file.name);
  const matching = source.tracks.find((track) => mediaBaseName(track.name) === base);
  const track = matching || source.activeTrack;
  const lyric = { name: file.name, cues, origin: "LOCAL" };
  if (track) localLyricsByTrack.set(track.id, lyric);
  else pendingLocalLyrics = lyric;
  renderLyricsForTrack(source.activeTrack);
  setText("#lyricsStatus", "Loaded " + cues.length + " timed lines from " + file.name + ".");
}

function storeAutomaticLyrics(track, result) {
  if (!track || result?.state !== "FOUND") {
    if (track && source.activeTrackId === track.id && !localLyricsByTrack.has(track.id)) {
      remoteLyricsByTrack.delete(track.id);
      activeLyrics = null;
      const status = result?.state === "UNAVAILABLE" ? result.reason : "Lyrics unavailable for this track.";
      setText("#lyricsFileName", status);
      setText("#lyricsStatusPill", result?.state === "UNAVAILABLE" ? "LOOKUP UNAVAILABLE" : "LYRICS UNAVAILABLE");
      setText("#lyricsCurrent", "Lyrics unavailable");
      setText("#lyricsPrevious", "");
      setText("#lyricsNext", "");
    }
    return;
  }

  const record = result.record || {};
  if (result.syncedLyrics) {
    try {
      remoteLyricsByTrack.set(track.id, {
        origin: "LRCLIB",
        name: (record.trackName || track.metadata?.title || track.name) + " · LRCLIB",
        cues: parseLrc(result.syncedLyrics),
      });
    } catch {
      remoteLyricsByTrack.set(track.id, { origin: "LRCLIB", plain: result.plainLyrics || "" });
    }
  } else {
    if (result.plainLyrics) {
      remoteLyricsByTrack.set(track.id, { origin: "LRCLIB", plain: result.plainLyrics });
    } else {
      remoteLyricsByTrack.set(track.id, { origin: "LRCLIB", unavailable: true });
    }
  }
  if (source.activeTrackId === track.id && sourceMode !== "microphone") renderLyricsForTrack(track);
}

async function identifyCurrentTrack(track) {
  if (!track || selectedCatalogTrack || sourceMode === "microphone") return;
  const signature = track.id + ":" + track.name + ":" + track.size + ":" + Math.round(track.duration || 0);
  if (signature === identificationSignature) return;
  identificationSignature = signature;
  if (activeIdentificationController) activeIdentificationController.abort();
  const controller = new AbortController();
  activeIdentificationController = controller;
  setText("#identificationStatus", "IDENTIFYING · reading local metadata");
  try {
    const result = await identification.identify(track, {
      signal: controller.signal,
      onState: (state) => {
        if (source.activeTrackId === track.id && sourceMode !== "microphone") {
          setText("#identificationStatus", state.message || state.state);
        }
      },
    });
    if (controller.signal.aborted || source.activeTrackId !== track.id) return;
    updateTrackMetadataUI(track, result.metadata);
    setText("#identificationStatus", result.state + " · " + result.message);
    if (result.lyrics) storeAutomaticLyrics(track, result.lyrics);
    else renderLyricsForTrack(track);
  } catch (error) {
    if (error?.name === "AbortError") return;
    setText("#identificationStatus", "UNAVAILABLE · " + (error.message || "Metadata lookup failed."));
    storeAutomaticLyrics(track, { state: "UNAVAILABLE", reason: error.message });
  }
}

async function searchLyricsByEnteredMetadata(track = source.activeTrack) {
  if (!track || sourceMode === "microphone") {
    setText("#lyricsStatus", "Choose a local song before searching for lyrics.");
    return;
  }
  const title = $("#lyricsTrackTitle")?.value.trim() || "";
  const artist = $("#lyricsTrackArtist")?.value.trim() || "";
  if (!title || !artist) {
    setText("#lyricsStatus", "Enter both a song title and artist to search.");
    setText("#lyricsStatusPill", "TITLE + ARTIST NEEDED");
    return;
  }
  if (activeIdentificationController) activeIdentificationController.abort();
  const controller = new AbortController();
  activeIdentificationController = controller;
  const metadata = { ...track.metadata, title, artist, duration: track.duration || track.metadata?.duration || null, source: "manual title and artist" };
  track.metadata = metadata;
  track.manualMetadataOverride = { title, artist };
  updateTrackMetadataUI(track, metadata);
  setText("#identificationStatus", "SEARCHING LRCLIB · " + title + " — " + artist);
  setText("#lyricsStatusPill", "SEARCHING LRCLIB");
  setText("#lyricsStatus", "Searching lyrics for " + title + " by " + artist + ".");
  const button = $("#findLyricsButton");
  if (button) button.disabled = true;
  try {
    const result = await identification.lyrics.lookup(metadata, { signal: controller.signal });
    if (controller.signal.aborted || source.activeTrackId !== track.id) return;
    setText("#identificationStatus", result.state + " · " + (result.reason || (result.state === "FOUND" ? "Matching lyrics found." : "No matching lyrics found.")));
    storeAutomaticLyrics(track, result);
  } catch (error) {
    if (error?.name === "AbortError") return;
    setText("#identificationStatus", "UNAVAILABLE · " + (error.message || "Lyrics lookup failed."));
    storeAutomaticLyrics(track, { state: "UNAVAILABLE", reason: error.message });
  } finally {
    if (button) button.disabled = false;
  }
}

function updatePlaybackLabels() {
  const active = source.activeTrack;
  if (sourceMode === "microphone") {
    setText("#playbackTime", "LIVE MICROPHONE");
    setText("#elapsedMetric", "LIVE");
    setText("#audioTimeLabel", "LIVE INPUT");
    setText("#durationMetric", "No media timeline");
    setText("#trackDuration", "LIVE");
    setText("#sourceLabel", "MICROPHONE");
    return;
  }
  const current = audioPlayer.currentTime;
  const duration = Number.isFinite(audioPlayer.duration) ? audioPlayer.duration : null;
  setText("#playbackTime", formatTime(current) + " / " + formatTime(duration));
  setText("#elapsedMetric", formatTime(current));
  setText("#audioTimeLabel", formatTime(current));
  setText("#durationMetric", formatTime(duration) + " total");
  setText("#trackDuration", formatTime(duration));
  if (active && duration && active.duration !== duration) {
    active.duration = duration;
    if (active.metadata && !active.metadata.duration) active.metadata.duration = duration;
    renderPlaylist();
    void identifyCurrentTrack(active);
  }
  renderLyricsAtTime(current);
}

function updateMeasurements(analysis, lighting) {
  const energyPercent = Math.round(lighting.overallEnergy * 100);
  setText("#energyMetric", energyPercent + "%");
  const energyBar = $("#energyBar");
  if (energyBar) energyBar.style.width = energyPercent + "%";
  setText("#bpmMetric", lighting.bpm === null ? "—" : lighting.bpm);
  setText("#beatMetric", lighting.beatDetected ? "BEAT" : lighting.beatStrength > 0.16 ? "PULSE" : "LISTENING");
  setText("#beatSubtext", "Pulse " + lighting.beatStrength.toFixed(2) + " · confidence " + lighting.beatConfidence.toFixed(2));
  setText("#beatConfidenceMetric", lighting.beatConfidence.toFixed(2));
  setText("#beatCountMetric", lighting.beatCount);
  setText("#transientMetric", lighting.transientDetected
    ? "DETECTED · " + (lighting.transientBand === null ? "BAND" : ["BASS", "LOW-MID", "MID", "HIGH-MID", "TREBLE"][lighting.transientBand]) + " " + lighting.transientStrength.toFixed(2)
    : "STRENGTH " + lighting.transientStrength.toFixed(2));
  setText("#sampleRateLabel", "Sample rate · " + analysis.sampleRate.toLocaleString() + " Hz");
  setText("#bandSummaryStatus", "Normalized measured FFT energy · no song semantics inferred.");
  visuals.setBandValues(lighting.bands);
  setLiveTag("#analysisState", sourceMode === "microphone" ? "MIC ANALYSIS LIVE" : "ANALYSIS LIVE · FFT " + analysis.fftSize, "active");
  setText("#audioContextState", analyzer.state);
  setText("#sourceTypeDiagnostic", sourceMode === "microphone" ? "Microphone" : "Local media");
  const rms = Number.isFinite(analysis.waveformRms) ? analysis.waveformRms : 0;
  setText("#audioRmsMetric", rms.toFixed(3));
  setText("#analysisFrameCount", analysisFrameCount);
}

function FREQUENCY_SUMMARY(bands) {
  return ["bass", "lowMid", "mid", "highMid", "treble"]
    .map((key) => key + " " + Number(bands[key] || 0).toFixed(2))
    .join(" · ");
}

function updateRangeOutputs() {
  setText("#sensitivityValue", config.sensitivity.toFixed(1) + "×");
  setText("#intensityValue", Math.round(config.intensity * 100) + "%");
  setText("#smoothingValue", Math.round(config.attack * 1000) + " ms");
  setText("#smoothingReleaseValue", Math.round(config.release * 1000) + " ms");
  setText("#beatBoostValue", Math.round(config.beatBoost * 100) + "%");
  setText("#transientBoostValue", Math.round(config.transientBoost * 100) + "%");
  setText("#beatThresholdValue", config.beatThreshold.toFixed(2));
  setText("#transientThresholdValue", config.transientThreshold.toFixed(2));
  setText("#frameRateValue", config.serialIntervalMs + " ms");
  setText("#serialRateHelp", "At most " + Math.round(1000 / config.serialIntervalMs) + " physical frames per second; only the newest unsent frame is kept.");
  setText("#rateReadout", Math.round(1000 / config.serialIntervalMs) + " frames / sec max");
}

function applyPreset(name) {
  const preset = LIGHTING_PRESETS[name];
  if (!preset) return;
  config.preset = name;
  config.mode = name === "pulse" ? "pulse" : name === "spectrum" ? "spectrum" : "hybrid";
  const visualMode = $("#visualMode");
  if (visualMode) visualMode.value = config.mode;
  for (const key of ["sensitivity", "intensity", "attack", "release", "beatBoost", "transientBoost", "beatThreshold", "transientThreshold"]) {
    config[key] = preset[key];
  }
  const controlMap = {
    sensitivity: "#sensitivity",
    intensity: "#intensity",
    attack: "#smoothing",
    release: "#smoothingRelease",
    beatBoost: "#beatBoost",
    transientBoost: "#transientBoost",
    beatThreshold: "#beatThreshold",
    transientThreshold: "#transientThreshold",
  };
  for (const [key, selector] of Object.entries(controlMap)) {
    const control = $(selector);
    if (control) control.value = String(config[key]);
  }
  updateRangeOutputs();
}

async function startAnalysisLoop() {
  if (startAnalysisPromise) return startAnalysisPromise;
  startAnalysisPromise = (async () => {
    try {
      if (sourceMode === "music") await analyzer.connectMedia(audioPlayer);
      if (sourceMode === "microphone" && !microphone.active) throw new Error("Microphone input is no longer active.");
      analysisRunning = true;
      visuals.setPlayback(true);
      setLiveTag("#playState", sourceMode === "microphone" ? "MICROPHONE LIVE" : "PLAYING", "active");
      setText("#audioContextState", analyzer.state);
      if (!animationFrame) animationFrame = requestAnimationFrame(analyzeFrame);
    } catch (error) {
      lastRuntimeError = error.name + ": " + error.message;
      setText("#runtimeError", lastRuntimeError);
      setLiveTag("#analysisState", "ANALYSIS ERROR", "error");
      setAudioStatus("Audio analysis could not start: " + error.message);
    } finally {
      startAnalysisPromise = null;
    }
  })();
  return startAnalysisPromise;
}

function stopAnalysis(reason = "", state = "PAUSED") {
  analysisRunning = false;
  if (animationFrame) cancelAnimationFrame(animationFrame);
  animationFrame = 0;
  visuals.setPlayback(false);
  if (sourceMode === "music") {
    setLiveTag("#playState", audioPlayer.ended ? "ENDED" : state, audioPlayer.ended ? "ended" : "ready");
    setLiveTag("#analysisState", audioPlayer.ended ? "TRACK ENDED" : "PAUSED", "ready");
  } else if (sourceMode === "microphone") {
    setLiveTag("#playState", "MICROPHONE STOPPED", "ready");
    setLiveTag("#analysisState", "ANALYSIS STOPPED", "ready");
  }
  if (reason) setAudioStatus(reason);
}

function analyzeFrame(timestamp) {
  animationFrame = 0;
  if (!analysisRunning) return;
  if (sourceMode === "music" && (audioPlayer.paused || audioPlayer.ended)) {
    stopAnalysis(audioPlayer.ended ? "Track ended." : "Audio paused.", audioPlayer.ended ? "ENDED" : "PAUSED");
    return;
  }
  if (sourceMode === "microphone" && !microphone.active) {
    stopAnalysis("Microphone stream ended. Check microphone permission and device state.", "STOPPED");
    return;
  }

  try {
    currentAnalysis = analyzer.read({
      mediaElement: sourceMode === "music" ? audioPlayer : null,
      sourceType: sourceMode === "microphone" ? "microphone" : "media",
    });
    if (!currentAnalysis) throw new Error("The audio analyzer has no connected source.");
    analysisFrameCount += 1;
    currentLighting = lightingEngine.step(currentAnalysis, timestamp, config);

    if (serialOutputEnabled && serial.connected && timestamp - lastSerialFrameAt >= config.serialIntervalMs) {
      lastSerialFrameAt = timestamp;
      const hardwareFrame = mapLogicalToPhysical(currentLighting.values, ARDUINO_10_LED_PROFILE);
      try {
        if (serial.sendLatest(hardwareFrame)) {
          visuals.setFrame(currentLighting.values, { audioTimeSeconds: currentLighting.analysisTimeSeconds });
          visuals.setHardwareFrame(hardwareFrame);
        }
      } catch (error) {
        lastRuntimeError = "Serial send: " + (error.message || "unknown error");
        setText("#runtimeError", lastRuntimeError);
      }
    }

    if (timestamp - lastUiUpdateAt >= ANALYSIS_UI_INTERVAL_MS) {
      lastUiUpdateAt = timestamp;
      updatePlaybackLabels();
      updateMeasurements(currentAnalysis, currentLighting);
      visuals.draw(currentAnalysis);
      const audioTime = Number.isFinite(currentAnalysis.audioTimeSeconds)
        ? currentAnalysis.audioTimeSeconds
        : currentLighting.analysisTimeSeconds;
      if (!serialOutputEnabled || !serial.connected) {
        visuals.setFrame(currentLighting.values, { audioTimeSeconds: audioTime });
        visuals.setHardwareFrame(mapLogicalToPhysical(currentLighting.values, ARDUINO_10_LED_PROFILE));
      }
      const message = sourceMode === "microphone"
        ? "Live microphone analysis is local. Song ID and lyrics are off in microphone mode."
        : serialOutputEnabled && serial.connected
          ? "Audio features update locally; serial output sends the newest mapped ten-channel frame."
          : serialOutputEnabled
            ? "Audio is analyzed locally. Connect Arduino to send the mapped ten-channel frame."
            : "Audio analysis is live. Arduino output is off; the virtual LEDs show the logical frame.";
      setAudioStatus(message);
      setText("#bandSummaryStatus", FREQUENCY_SUMMARY(currentLighting.bands));
    }
  } catch (error) {
    lastRuntimeError = (error?.name || "Error") + ": " + (error?.message || "Audio analysis failed");
    setText("#runtimeError", lastRuntimeError);
    setLiveTag("#analysisState", "ANALYSIS ERROR", "error");
    stopAnalysis("Analysis stopped after an error; media playback is not changed.");
    recordMediaEvent("analysis-error");
    return;
  }

  if (analysisRunning) animationFrame = requestAnimationFrame(analyzeFrame);
}

function renderDiagnostics() {
  setText("#audioContextState", analyzer.state);
  setText("#analysisFrameCount", analysisFrameCount);
  setText("#sourceTypeDiagnostic", sourceMode === "microphone" ? "Microphone" : sourceMode === "music" ? "Local media" : "None");
  renderSerialStats();
}

function sendPhysicalFrame(values, label = "Manual physical frame") {
  let frame;
  try {
    frame = normalizePhysicalFrame(values, ARDUINO_10_LED_PROFILE);
  } catch (error) {
    setAudioStatus(error.message);
    return false;
  }
  visuals.setHardwareFrame(frame, { transmitted: false });
  if (!serial.connected) {
    setAudioStatus(label + " is shown as preview only. Connect Arduino to transmit it.");
    return false;
  }
  const accepted = serial.sendLatest(frame);
  setAudioStatus(accepted ? label + " queued for Web Serial." : "The serial transport rejected this frame.");
  return accepted;
}

function sendSafeIdleFrame() {
  if (!serial.connected) return false;
  const logicalFrame = Array(config.logicalLedCount).fill(0);
  const hardwareFrame = Array(ARDUINO_10_LED_PROFILE.physicalChannels).fill(0);
  if (!serial.sendLatest(hardwareFrame)) return false;
  visuals.setFrame(logicalFrame);
  visuals.setHardwareFrame(hardwareFrame);
  return true;
}

function parseManualFrame(value) {
  const frame = parseCsvFrame(value, ARDUINO_10_LED_PROFILE.physicalChannels);
  if (!frame) throw new Error("Enter exactly 10 whole numbers separated by commas.");
  return normalizePhysicalFrame(frame, ARDUINO_10_LED_PROFILE);
}

function stopSequence() {
  sequenceToken += 1;
}

async function runSequentialTest() {
  stopSequence();
  const token = sequenceToken;
  for (let index = 0; index < ARDUINO_10_LED_PROFILE.physicalChannels; index += 1) {
    if (token !== sequenceToken) return;
    const frame = Array(ARDUINO_10_LED_PROFILE.physicalChannels).fill(0);
    frame[index] = 255;
    sendPhysicalFrame(frame, "Sequential physical LED test · L" + index);
    await new Promise((resolve) => setTimeout(resolve, 280));
  }
  if (token === sequenceToken) sendPhysicalFrame(Array(ARDUINO_10_LED_PROFILE.physicalChannels).fill(0), "All-off test");
}

function setActiveNavigation(activeLink) {
  document.querySelectorAll(".sidebar .side-link").forEach((link) => {
    const active = link === activeLink;
    link.classList.toggle("side-link--active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}

function showDashboard(activeLink = $(".sidebar .side-link[href='#home']")) {
  $("#libraryView").hidden = true;
  $("#home").hidden = false;
  setActiveNavigation(activeLink);
}

async function openLibrary() {
  try {
    if (!testCatalog) {
      const catalogModule = await import("./library/catalog.js");
      testCatalog = catalogModule.TEST_CATALOG;
    }
    $("#home").hidden = true;
    $("#libraryView").hidden = false;
    setActiveNavigation($("#libraryNavButton"));
    renderPlaylist();
    renderCatalog();
    $("#libraryHeading").focus({ preventScroll: true });
  } catch (error) {
    setAudioStatus("Music Library could not be opened: " + error.message);
  }
}

function renderCatalog() {
  const filter = ($("#catalogLanguage")?.value || "all").toLowerCase();
  const query = ($("#catalogSearch")?.value || "").trim().toLocaleLowerCase();
  const list = $("#catalogList");
  if (!list || !testCatalog) return;
  const results = testCatalog.filter((item) => {
    const languageMatch = filter === "all" || item.language.toLowerCase() === filter;
    const queryMatch = !query || (item.title + " " + item.artist).toLocaleLowerCase().includes(query);
    return languageMatch && queryMatch;
  });
  list.replaceChildren();
  if (!results.length) {
    const empty = document.createElement("div");
    empty.className = "empty-note";
    empty.textContent = "No catalog tracks match this search and language filter.";
    list.append(empty);
  }
  for (const item of results) {
    const row = document.createElement("article");
    row.className = "catalog-track";
    row.classList.toggle("is-selected", selectedCatalogTrack?.id === item.id);
    const title = document.createElement("b");
    title.className = "catalog-track__title";
    title.textContent = item.title;
    const artist = document.createElement("span");
    artist.className = "catalog-track__artist";
    artist.textContent = item.artist;
    const language = document.createElement("small");
    language.className = "catalog-track__source";
    language.textContent = item.language + " · TEST CATALOG · METADATA ONLY";
    const actions = document.createElement("div");
    actions.className = "catalog-track__actions";
    const selectTrack = document.createElement("button");
    selectTrack.type = "button";
    selectTrack.className = "button button--primary button--small";
    selectTrack.textContent = selectedCatalogTrack?.id === item.id ? "Selected" : "Select";
    selectTrack.setAttribute("aria-pressed", String(selectedCatalogTrack?.id === item.id));
    selectTrack.addEventListener("click", () => selectCatalogTrack(item));
    const useForLyrics = document.createElement("button");
    useForLyrics.type = "button";
    useForLyrics.className = "button button--outline button--small catalog-track__lyrics";
    useForLyrics.textContent = "Use to find lyrics";
    useForLyrics.addEventListener("click", () => {
      if (!source.activeTrack) {
        setText("#lyricsStatus", "Choose a local song first, then use this catalog entry to search its lyrics.");
        return;
      }
      $("#lyricsTrackTitle").value = item.title;
      $("#lyricsTrackArtist").value = item.artist;
      void searchLyricsByEnteredMetadata(source.activeTrack);
    });
    actions.append(selectTrack, useForLyrics);
    row.append(title, artist, language, actions);
    list.append(row);
  }
  setText("#catalogCount", results.length + " / " + testCatalog.length + " tracks");
}

function populateMicrophoneInputs() {
  const select = $("#microphoneInput");
  if (!select) return;
  const selected = select.value;
  microphone.listInputs().then((devices) => {
    select.replaceChildren();
    const automatic = document.createElement("option");
    automatic.value = "";
    automatic.textContent = "System default microphone";
    select.append(automatic);
    for (const [index, device] of devices.entries()) {
      const option = document.createElement("option");
      option.value = device.deviceId;
      option.textContent = device.label || "Microphone " + (index + 1);
      select.append(option);
    }
    if (devices.some((device) => device.deviceId === selected)) select.value = selected;
  }).catch((error) => {
    setText("#microphoneStatus", "Microphone list unavailable · " + error.message);
  });
}

async function startMicrophone() {
  try {
    setText("#microphoneStatus", "Requesting microphone permission…");
    const stream = await microphone.start($("#microphoneInput")?.value || "");
    if (!audioPlayer.paused) audioPlayer.pause();
    if (activeIdentificationController) activeIdentificationController.abort();
    sourceMode = "microphone";
    activeLyrics = null;
    await analyzer.connectStream(stream);
    lightingEngine.reset();
    resetMetrics();
    analysisFrameCount = 0;
    renderLyricsForTrack(source.activeTrack);
    setText("#microphoneStatus", "Microphone active · input stays in this browser.");
    setAudioStatus("Microphone permission granted. Live analysis starts locally; no song identification is used.");
    setLiveTag("#playState", "MICROPHONE READY", "ready");
    populateMicrophoneInputs();
    await startAnalysisLoop();
  } catch (error) {
    setText("#microphoneStatus", (error?.name || "Error") + " · " + (error?.message || "Microphone could not start."));
    setAudioStatus("Microphone did not start: " + (error?.message || "permission or device error"));
  }
}

function stopMicrophone() {
  stopAnalysis("Microphone stopped by the user.", "STOPPED");
  analyzer.disconnectSource();
  microphone.stop();
  sourceMode = "none";
  setText("#microphoneStatus", "Microphone stopped.");
  setLiveTag("#playState", source.activeTrack ? "LOADED" : "READY", "ready");
  setLiveTag("#analysisState", "WAITING FOR AUDIO", "ready");
  renderLyricsForTrack(source.activeTrack);
}

function onMediaReady() {
  if (selectedCatalogTrack) return;
  const track = source.activeTrack;
  if (!track) return;
  if (Number.isFinite(audioPlayer.duration)) track.duration = audioPlayer.duration;
  updateTrackMetadataUI(track);
  if (track.manualMetadataOverride) {
    track.metadata = { ...track.metadata, duration: track.duration || track.metadata?.duration || null };
  } else {
    void identifyCurrentTrack(track);
  }
}

function initializeEvents() {
  const audioFiles = $("#audioFiles");
  audioFiles.addEventListener("change", (event) => {
    const files = [...event.target.files];
    const lrcFiles = files.filter((file) => /\.lrc$/i.test(file.name));
    const mediaFiles = files.filter((file) => !/\.lrc$/i.test(file.name));
    for (const file of lrcFiles) void loadLyricsFile(file).catch((error) => setAudioStatus(error.message));
    const added = source.addFiles(mediaFiles);
    if (!added.length) {
      setAudioStatus(lrcFiles.length
        ? "Loaded local timed lyrics."
        : source.tracks.length >= source.maxTracks
          ? "Playlist limit reached (" + source.maxTracks + " local files). Reload to clear the current session."
          : "Choose a browser-supported audio or video file.");
      audioFiles.value = "";
      return;
    }
    renderPlaylist();
    chooseTrack(added[0].id);
    if (source.lastSkippedCount) {
      setAudioStatus(added.length + " media file(s) added; " + source.lastSkippedCount + " unsupported or over-limit file(s) skipped.");
    }
    audioFiles.value = "";
  });

  $("#lyricsFile").addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (file) void loadLyricsFile(file).catch((error) => setText("#lyricsStatus", error.message));
    event.target.value = "";
  });
  $("#findLyricsButton").addEventListener("click", () => void searchLyricsByEnteredMetadata());

  $("#connectButton").addEventListener("click", () => { void serial.connect(); });
  $("#disconnectButton").addEventListener("click", () => { void serial.disconnect(); });
  $("#audioToLed").addEventListener("change", (event) => {
    const wasEnabled = serialOutputEnabled;
    serialOutputEnabled = event.target.checked;
    lastSerialFrameAt = 0;
    if (wasEnabled && !serialOutputEnabled) sendSafeIdleFrame();
    setAudioStatus(serialOutputEnabled ? "Audio-to-Arduino output enabled. Connect Arduino to send frames." : "Audio-to-Arduino output is off; physical preview is not transmitted.");
  });

  $("#playButton").addEventListener("click", () => {
    if (selectedCatalogTrack) {
      setAudioStatus("Metadata only · No local audio file is attached. Choose a local media file to play this song.");
      return;
    }
    if (microphone.active) {
      analyzer.disconnectSource();
      microphone.stop();
      sourceMode = "none";
    }
    if (!source.activeTrack) {
      setAudioStatus("Choose a local audio/video file first.");
      return;
    }
    audioPlayer.play().catch((error) => setAudioStatus("Playback could not start: " + error.message));
  });
  $("#pauseButton").addEventListener("click", () => audioPlayer.pause());
  $("#stopButton").addEventListener("click", () => {
    audioPlayer.pause();
    if (Number.isFinite(audioPlayer.duration)) audioPlayer.currentTime = 0;
    stopAnalysis("Playback stopped by the user.", "STOPPED");
  });

  $("#startMicrophone").addEventListener("click", () => { void startMicrophone(); });
  $("#stopMicrophone").addEventListener("click", stopMicrophone);
  $("#microphoneInput").addEventListener("focus", populateMicrophoneInputs);

  $("#sendCustomFrame").addEventListener("click", () => {
    try {
      sendPhysicalFrame(parseManualFrame($("#customFrame").value), "Manual test frame");
    } catch (error) {
      setAudioStatus(error.message);
    }
  });
  $("#allOffButton").addEventListener("click", () => sendPhysicalFrame(Array(10).fill(0), "All-off test"));
  $("#allOnButton").addEventListener("click", () => sendPhysicalFrame(Array(10).fill(255), "All-on test"));
  $("#sequentialTestButton").addEventListener("click", () => { void runSequentialTest(); });
  $("#stopSequenceButton").addEventListener("click", stopSequence);
  $("#sendSingleLedButton").addEventListener("click", () => {
    const frame = Array(10).fill(0);
    const index = Math.max(0, Math.min(9, Number($("#manualLedIndex").value) || 0));
    frame[index] = Number($("#manualLedBrightness").value);
    sendPhysicalFrame(frame, "Single physical LED test · L" + index);
  });
  $("#manualLedIndex").addEventListener("change", (event) => {
    const mode = ARDUINO_10_LED_PROFILE.channels[Number(event.target.value)]?.mode;
    setText("#manualLedCapability", mode === "PWM" ? "This pin supports PWM brightness." : "Digital-only: values below 128 are OFF; values 128+ are ON.");
  });

  $("#logicalLedCount").addEventListener("change", (event) => {
    config.logicalLedCount = Number(event.target.value);
    lightingEngine.setLedCount(config.logicalLedCount);
    lightingEngine.reset();
    visuals.setLedCount(config.logicalLedCount);
    visuals.setFrame(Array(config.logicalLedCount).fill(0));
    setText("#logicalPhysicalLabel", "Logical LEDs: " + config.logicalLedCount + " · Physical Arduino outputs: 10 · resampled to the 10-channel profile.");
  });
  $("#lightingPreset").addEventListener("change", (event) => applyPreset(event.target.value));
  $("#sensitivity").addEventListener("input", (event) => { config.sensitivity = Number(event.target.value); updateRangeOutputs(); });
  $("#intensity").addEventListener("input", (event) => { config.intensity = Number(event.target.value); updateRangeOutputs(); });
  $("#smoothing").addEventListener("input", (event) => { config.attack = Number(event.target.value); updateRangeOutputs(); });
  $("#smoothingRelease").addEventListener("input", (event) => { config.release = Number(event.target.value); updateRangeOutputs(); });
  $("#beatBoost").addEventListener("input", (event) => { config.beatBoost = Number(event.target.value); updateRangeOutputs(); });
  $("#transientBoost").addEventListener("input", (event) => { config.transientBoost = Number(event.target.value); updateRangeOutputs(); });
  $("#beatThreshold").addEventListener("input", (event) => { config.beatThreshold = Number(event.target.value); updateRangeOutputs(); });
  $("#transientThreshold").addEventListener("input", (event) => { config.transientThreshold = Number(event.target.value); updateRangeOutputs(); });
  $("#frameRate").addEventListener("input", (event) => { config.serialIntervalMs = Number(event.target.value); updateRangeOutputs(); });
  $("#visualMode").addEventListener("change", (event) => { config.mode = event.target.value; });

  $("#catalogSearch").addEventListener("input", () => {
    renderCatalog();
    renderPlaylist();
  });
  $("#catalogLanguage").addEventListener("change", renderCatalog);
  const libraryNavButton = $("#libraryNavButton");
  libraryNavButton.addEventListener("click", (event) => {
    event.preventDefault();
    void openLibrary();
  });
  $("#openLibraryButton").addEventListener("click", () => void openLibrary());
  $("#closeLibraryButton").addEventListener("click", () => showDashboard());
  document.querySelectorAll(".sidebar .side-link[href^='#']:not(#libraryNavButton)").forEach((link) => {
    link.addEventListener("click", () => showDashboard(link));
  });
  $("#settingsJump").addEventListener("click", () => $("#lighting").scrollIntoView({ behavior: "smooth", block: "center" }));

  audioPlayer.addEventListener("play", () => {
    sourceMode = "music";
    if (microphone.active) {
      analyzer.disconnectSource();
      microphone.stop();
    }
    void startAnalysisLoop();
    setLiveTag("#playState", "PLAYING", "active");
    setLiveTag("#analysisState", "ANALYSIS STARTING", "active");
    renderPlaylist();
  });
  audioPlayer.addEventListener("pause", () => {
    if (selectedCatalogTrack) {
      stopAnalysis();
      setLiveTag("#playState", "METADATA ONLY", "ready");
      setLiveTag("#analysisState", "NO LOCAL AUDIO", "ready");
      setAudioStatus("Metadata only · No local audio file attached. Add a local media file to play, analyze, and control the lights.");
    } else {
      stopAnalysis(audioPlayer.ended ? "Track ended." : "Audio paused.", audioPlayer.ended ? "ENDED" : "PAUSED");
      if (serialOutputEnabled && !audioPlayer.ended) sendSafeIdleFrame();
    }
    renderPlaylist();
  });
  audioPlayer.addEventListener("ended", () => {
    if (selectedCatalogTrack) {
      stopAnalysis();
      setLiveTag("#playState", "METADATA ONLY", "ready");
      setLiveTag("#analysisState", "NO LOCAL AUDIO", "ready");
    } else {
      stopAnalysis("Track ended.", "ENDED");
      if (serialOutputEnabled) sendSafeIdleFrame();
    }
    renderPlaylist();
  });
  audioPlayer.addEventListener("loadedmetadata", onMediaReady);
  audioPlayer.addEventListener("durationchange", onMediaReady);
  audioPlayer.addEventListener("timeupdate", updatePlaybackLabels);
  audioPlayer.addEventListener("error", () => {
    if (selectedCatalogTrack) {
      setLiveTag("#playState", "METADATA ONLY", "ready");
      setLiveTag("#analysisState", "NO LOCAL AUDIO", "ready");
      setAudioStatus("Metadata only · No local audio file attached. Add a local media file to play, analyze, and control the lights.");
      return;
    }
    const error = audioPlayer.error;
    setLiveTag("#playState", "MEDIA ERROR", "error");
    setAudioStatus("Media playback error " + (error?.code || "") + (error?.message ? " · " + error.message : "."));
  });

  for (const name of ["loadstart", "loadedmetadata", "canplay", "playing", "play", "pause", "waiting", "stalled", "abort", "emptied", "error", "ended", "timeupdate", "progress", "seeking", "seeked", "durationchange", "ratechange", "volumechange"]) {
    audioPlayer.addEventListener(name, () => recordMediaEvent(name));
  }

  window.addEventListener("pagehide", () => {
    stopAnalysis();
    if (activeIdentificationController) activeIdentificationController.abort();
    source.dispose();
    analyzer.disconnectSource();
    microphone.stop();
  }, { once: true });

  serial.addEventListener("statechange", (event) => {
    updateConnectionUI(event.detail.message);
    renderDiagnostics();
  });
  serial.addEventListener("diagnostic", renderConnectionLog);
  serial.addEventListener("statschange", renderDiagnostics);
  serial.addEventListener("sent", (event) => {
    visuals.setHardwareFrame(event.detail.frame, { transmitted: true });
    renderSerialStats();
  });
  microphone.addEventListener("statechange", (event) => {
    const state = event.detail.state;
    setText("#microphoneStatus", state === "ACTIVE" ? "Microphone active · browser permission granted." : state === "PERMISSION_DENIED" ? "Microphone permission denied." : state === "REQUESTING_PERMISSION" ? "Requesting microphone permission…" : state === "ENDED" ? "Microphone input ended." : "Microphone " + state.toLowerCase().replaceAll("_", " ") + ".");
  });

  window.addEventListener("error", (event) => {
    lastRuntimeError = "Window error: " + (event.message || "Unknown runtime error");
    setText("#runtimeError", lastRuntimeError);
  });
  window.addEventListener("unhandledrejection", (event) => {
    if (event.reason?.name === "AbortError") return;
    lastRuntimeError = "Unhandled promise: " + (event.reason?.message || String(event.reason));
    setText("#runtimeError", lastRuntimeError);
  });
  window.addEventListener("beforeunload", () => {
    if (animationFrame) cancelAnimationFrame(animationFrame);
    analysisRunning = false;
    if (activeIdentificationController) activeIdentificationController.abort();
    microphone.stop();
    source.dispose();
  });

  updateRangeOutputs();
  updateClock();
  renderPlaylist();
  renderLyricsForTrack(null);
  updateConnectionUI();
  renderDiagnostics();
  window.setInterval(updateClock, 60_000);
}

initializeEvents();
