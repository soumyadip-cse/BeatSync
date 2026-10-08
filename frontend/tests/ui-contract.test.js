import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("dashboard markup contains every static ID referenced by its app and visualizer", async () => {
  const [html, app, visuals] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../visualizer/DashboardVisuals.js", import.meta.url), "utf8"),
  ]);
  const ids = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map((match) => match[1]);
  const available = new Set(ids);
  const referenced = new Set();
  for (const source of [app, visuals]) {
    for (const match of source.matchAll(/(?:\$\(|querySelector\(|querySelectorAll\()\s*["']#([\w-]+)/g)) referenced.add(match[1]);
  }
  const missing = [...referenced].filter((id) => !available.has(id));
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  assert.deepEqual(missing, [], "selector IDs must exist in frontend/index.html");
  assert.deepEqual([...new Set(duplicates)], [], "static HTML IDs must be unique");
});
