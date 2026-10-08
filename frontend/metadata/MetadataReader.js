const ID3_FIELDS = Object.freeze({
  TIT2: "title", TT2: "title",
  TPE1: "artist", TP1: "artist",
  TALB: "album", TAL: "album",
  TPE2: "albumArtist", TP2: "albumArtist",
  TRCK: "trackNumber", TRK: "trackNumber",
  TCON: "genre", TCO: "genre",
});

function syncSafeInteger(bytes, offset) {
  return ((bytes[offset] & 0x7f) << 21)
    | ((bytes[offset + 1] & 0x7f) << 14)
    | ((bytes[offset + 2] & 0x7f) << 7)
    | (bytes[offset + 3] & 0x7f);
}

function decodeText(frame) {
  if (!frame.length) return "";
  const encoding = frame[0];
  let payload = frame.subarray(1);
  while (payload.length && payload[payload.length - 1] === 0) payload = payload.subarray(0, payload.length - 1);
  const labels = { 0: "iso-8859-1", 1: "utf-16", 2: "utf-16be", 3: "utf-8" };
  try {
    return new TextDecoder(labels[encoding] || "utf-8").decode(payload).split("\u0000")[0].trim();
  } catch {
    return "";
  }
}

export function parseId3Tags(buffer) {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 10 || String.fromCharCode(...bytes.subarray(0, 3)) !== "ID3") return {};
  const version = bytes[3];
  if (version < 2 || version > 4) return {};
  const tagSize = syncSafeInteger(bytes, 6);
  const end = Math.min(bytes.length, 10 + tagSize);
  const tags = {};
  let offset = 10;

  while (offset < end) {
    const headerLength = version === 2 ? 6 : 10;
    if (offset + headerLength > end) break;
    const frameId = String.fromCharCode(...bytes.subarray(offset, offset + (version === 2 ? 3 : 4)));
    if (!frameId.trim() || frameId[0] === "\0") break;
    const size = version === 2
      ? (bytes[offset + 3] << 16) | (bytes[offset + 4] << 8) | bytes[offset + 5]
      : version === 4
        ? syncSafeInteger(bytes, offset + 4)
        : ((bytes[offset + 4] << 24) | (bytes[offset + 5] << 16) | (bytes[offset + 6] << 8) | bytes[offset + 7]) >>> 0;
    offset += headerLength;
    if (!size || offset + size > end) break;
    const key = ID3_FIELDS[frameId];
    if (key && !tags[key]) tags[key] = decodeText(bytes.subarray(offset, offset + size));
    offset += size;
  }

  return tags;
}

export function parseFilenameMetadata(filename) {
  const name = String(filename || "").replace(/\.[^.]+$/, "").replace(/[._]+/g, " ").trim();
  const split = name.match(/^(.+?)\s+-\s+(.+)$/);
  return split
    ? { title: split[2].trim(), artist: split[1].trim(), album: "" }
    : { title: name, artist: "", album: "" };
}

export async function readMediaMetadata(file, durationSeconds = null) {
  const fallback = parseFilenameMetadata(file?.name);
  let tags = {};
  const isMp3 = /\.mp3$/i.test(file?.name || "") || /audio\/(mpeg|mp3)/i.test(file?.type || "");
  if (isMp3 && file?.slice) {
    try {
      const header = new Uint8Array(await file.slice(0, 10).arrayBuffer());
      if (header.length >= 10 && String.fromCharCode(...header.subarray(0, 3)) === "ID3") {
        const length = Math.min(16 * 1024 * 1024, 10 + syncSafeInteger(header, 6));
        tags = parseId3Tags(await file.slice(0, length).arrayBuffer());
      }
    } catch {
      // Tags are optional. Filename and media duration remain usable.
    }
  }

  return {
    title: tags.title || fallback.title,
    artist: tags.artist || fallback.artist,
    album: tags.album || "",
    albumArtist: tags.albumArtist || "",
    trackNumber: tags.trackNumber || "",
    genre: tags.genre || "",
    duration: Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds : null,
    source: Object.keys(tags).length ? "ID3 + filename" : "filename",
  };
}

