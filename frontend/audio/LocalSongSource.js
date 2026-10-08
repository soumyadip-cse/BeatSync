export class LocalSongSource {
  constructor(audioElement, { urlApi = URL, maxTracks = 100 } = {}) {
    this.audio = audioElement;
    this.urlApi = urlApi;
    this.maxTracks = Math.max(1, Math.floor(Number(maxTracks) || 100));
    this.lastSkippedCount = 0;
    this.tracks = [];
    this.activeTrackId = null;
    this.nextId = 1;
  }

  addFiles(fileList) {
    const added = [];
    this.lastSkippedCount = 0;
    for (const file of fileList) {
      if (this.tracks.length >= this.maxTracks) {
        this.lastSkippedCount += 1;
        continue;
      }
      const extension = file.name.split(".").pop()?.toLowerCase() || "";
      const supportedContainer = ["mp3", "mpeg", "mpga", "wav", "wave", "m4a", "mp4", "ogg", "oga", "opus", "webm", "aac", "flac", "mov", "mkv"].includes(extension);
      if (!file.type.startsWith("audio/") && !file.type.startsWith("video/") && !supportedContainer) {
        this.lastSkippedCount += 1;
        continue;
      }
      const track = {
        id: this.nextId++,
        file,
        name: file.name,
        type: file.type || "Media file · " + extension.toUpperCase(),
        size: file.size,
        url: this.urlApi.createObjectURL(file),
        duration: null,
        metadata: null,
      };
      this.tracks.push(track);
      added.push(track);
    }
    return added;
  }

  select(trackId) {
    const track = this.tracks.find((item) => item.id === Number(trackId));
    if (!track) return null;
    this.audio.pause();
    this.activeTrackId = track.id;
    this.audio.src = track.url;
    this.audio.load();
    return track;
  }

  get activeTrack() {
    return this.tracks.find((track) => track.id === this.activeTrackId) || null;
  }

  getNextTrack() {
    if (!this.tracks.length) return null;
    const currentIndex = this.tracks.findIndex((track) => track.id === this.activeTrackId);
    return this.tracks[(currentIndex + 1 + this.tracks.length) % this.tracks.length];
  }

  dispose() {
    this.audio.pause();
    for (const track of this.tracks) this.urlApi.revokeObjectURL(track.url);
    this.tracks = [];
    this.activeTrackId = null;
  }
}
