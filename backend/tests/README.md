# Local server checks

The route boundary is smoke-tested during development by starting `npm start` and requesting the dashboard root, HEAD, missing LRCLIB parameters, unconfigured AcoustID, and an invalid MusicBrainz ID. Valid external lookups intentionally require network/API availability and are covered with injected fetch implementations in `frontend/tests/metadata-lyrics.test.js`.

No separate server test framework or package is installed.
