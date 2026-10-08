# Browser audio sources and analysis

`LocalSongSource.js` accepts user-selected audio/video containers supported by the browser. It keeps a bounded playlist of at most 100 files per page session, creates one object URL per selected track, loads the selected URL only on track selection, does not autoplay, and revokes owned URLs on page exit/disposal. Native `<audio controls>` owns playback.

`MicrophoneSource.js` asks for permission only after the user selects Start microphone, lists input devices, disables browser echo cancellation/noise suppression/automatic gain control, and stops all stream tracks when stopped or changed.

`AudioAnalyzer.js` owns one reusable AudioContext, one cached media source per audio element, one analyser, and reusable FFT/waveform arrays. FFT_SIZE is 2048 and analyser smoothing is .65. It reports RMS-like frequency-band energy for 40–250 Hz, 250–500 Hz, 500–2,000 Hz, 2,000–6,000 Hz, and 6,000–20,000 Hz, capped by available Nyquist bins, plus waveform RMS and media time. Media playback and the microphone feed the same analysis output shape. It does not call play/pause or open serial.

The automated tests use fake Web Audio nodes and local blobs; they do not establish real browser codec/permission behavior. See `experiments/media-playback-isolation/` and `experiments/web-serial-led-control/` for preserved independent diagnostics.
