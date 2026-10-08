export async function createAudioFingerprint(file, { signal } = {}) {
  const provider = globalThis.BeatSyncChromaprint;
  if (typeof provider?.fingerprintFile !== "function") {
    return { available: false, reason: "A browser Chromaprint provider is not installed." };
  }
  const result = await provider.fingerprintFile(file, { signal });
  if (!result?.fingerprint || !Number.isFinite(result.durationSeconds)) {
    throw new Error("The fingerprint provider returned an invalid result.");
  }
  return { available: true, ...result };
}

