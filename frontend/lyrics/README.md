# Lyrics and song metadata

MP3 ID3 title/artist/album tags are read locally; filename parsing is the fallback. The user can correct the title and artist in the lyrics panel, which performs an asynchronous LRCLIB lookup through the local Node relay. A 40-entry metadata-only catalog can fill those lookup fields when a local song is selected. No audio file is uploaded; a future optional Chromaprint provider may submit a derived fingerprint for AcoustID matching.

Synced LRCLIB cues or user-selected local `.LRC` cues follow the selected media's `currentTime`, including seeks. Plain text lyrics are displayed in a separate block and labeled unsynchronized. A no-match, unavailable service, or empty lyric result is shown explicitly. Lyrics are not generated, and no full copyrighted lyrics or media are bundled.

The pure parser supports multiple timestamps on a line and `[offset:...]`. Example:

```text
[offset:-100]
[00:12.50]First timed line
[00:16.00]Next timed line
```

For automatic lookup, `npm start` must be running and the computer must have internet access. Browser-based tests verify parser and matching logic; run the browser flow with a user-provided track to verify actual API availability and lyric correctness.
