export function normalizeCsvFrame(values, expectedCount = 10) {
  if (!Array.isArray(values) || values.length !== expectedCount) {
    throw new RangeError("Expected exactly " + expectedCount + " LED values.");
  }
  return values.map((value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) throw new TypeError("LED values must be finite numbers.");
    return Math.max(0, Math.min(255, Math.round(numeric)));
  });
}

export function encodeCsvFrame(values, expectedCount = 10) {
  const frame = normalizeCsvFrame(values, expectedCount);
  return { values: frame, text: frame.join(",") + "\n", bytes: new TextEncoder().encode(frame.join(",") + "\n") };
}

export function parseCsvFrame(line, expectedCount = 10) {
  const fields = String(line || "").replace(/\r$/, "").split(",");
  if (fields.length !== expectedCount || fields.some((field) => !/^-?\d+$/.test(field.trim()))) return null;
  return fields.map((field) => Math.max(0, Math.min(255, Number(field.trim()))));
}

