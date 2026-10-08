# Local metadata API routes

The current loopback routes are implemented in `../dev-server.js`: `/api/lyrics/lookup`, `/api/lyrics/search`, `/api/acoustid/lookup`, and `/api/musicbrainz/recording/:uuid`. They serve only metadata lookup and never accept an audio file or LED frame. The AcoustID key is read from server-side `.env` and is not exposed in frontend code.

These routes are local application plumbing, not a persistent backend product. There is no account, database, or saved-user-data API.
