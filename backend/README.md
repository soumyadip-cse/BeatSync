# Local metadata relay

`dev-server.js` is a small Node built-in HTTP server used by the current vanilla frontend. From the repository root, run `npm start`. It binds to `127.0.0.1:8000`, serves the frontend/static experiments, and provides same-origin LRCLIB, AcoustID, and MusicBrainz lookup routes.

The relay exists for metadata/API headers, local secret handling, and browser same-origin access. It never receives media files, performs audio analysis, computes lighting frames, sends serial data, or stores a database. Lookups use a bounded in-memory cache. `ACOUSTID_CLIENT_KEY` is read from an ignored local `.env`; copy `.env.example` to `.env` and restart the server to change it. No key is included in the repository.

AcoustID matching also requires a separately provided browser Chromaprint implementation exposing `globalThis.BeatSyncChromaprint.fingerprintFile(file, { signal })`. That provider is not bundled, so the fingerprint branch reports unavailable until one is supplied. LRCLIB and MusicBrainz tag-based metadata lookup do not require this key/provider.

There is no persistent backend API, account system, or database yet. The placeholder backend directories remain documentation-only.
