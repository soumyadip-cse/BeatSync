const TIMESTAMP_PATTERN = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;

export function parseLrc(text) {
  const source = String(text || "").replace(/^\uFEFF/, "");
  if (source.length > 2_000_000) throw new RangeError("The LRC file exceeds the 2 MB parsing limit.");
  const lines = source.split(/\r?\n/);
  if (lines.length > 20_000) throw new RangeError("The LRC file exceeds the 20,000-line parsing limit.");
  const offsetLine = lines.find((line) => /^\[offset\s*:/i.test(line));
  const offsetMs = offsetLine ? Number(offsetLine.match(/\[offset\s*:\s*(-?\d+)\s*\]/i)?.[1] || 0) : 0;
  const cues = [];

  for (const line of lines) {
    const tags = [...line.matchAll(TIMESTAMP_PATTERN)];
    const lyric = line.replace(/\[[^\]]*\]/g, "").trim();
    if (!lyric || !tags.length) continue;

    for (const [, minuteText, secondText, fractionText = "0"] of tags) {
      const fraction = Number(`0.${fractionText.padEnd(3, "0")}`);
      const time = Math.max(0, Number(minuteText) * 60 + Number(secondText) + fraction + offsetMs / 1000);
      cues.push({ time, text: lyric });
      if (cues.length > 20_000) throw new RangeError("The LRC file exceeds the 20,000-cue parsing limit.");
    }
  }

  cues.sort((left, right) => left.time - right.time);
  if (!cues.length) throw new Error("No timed lyric lines found. Choose a valid .LRC file with [mm:ss.xx] timestamps.");
  return cues;
}

export function lyricIndexAt(cues, seconds) {
  let low = 0;
  let high = cues.length - 1;
  let result = -1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (cues[middle].time <= seconds) {
      result = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return result;
}
