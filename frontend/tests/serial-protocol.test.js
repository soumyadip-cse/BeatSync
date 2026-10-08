import test from "node:test";
import assert from "node:assert/strict";
import { encodeCsvFrame, normalizeCsvFrame, parseCsvFrame } from "../serial/SerialProtocol.js";
import { SerialTransport } from "../serial/SerialTransport.js";

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

test("CSV protocol clamps bytes and keeps the existing ten-value newline format", () => {
  assert.deepEqual(normalizeCsvFrame([-20, 12.4, ...Array(7).fill(300)], 9), [0, 12, ...Array(7).fill(255)]);
  const frame = encodeCsvFrame([0, 1, 2, 3, 4, 5, 6, 7, 8, 255]);
  assert.equal(frame.text, "0,1,2,3,4,5,6,7,8,255\n");
  assert.deepEqual([...frame.bytes], [...new TextEncoder().encode(frame.text)]);
  assert.deepEqual(parseCsvFrame(frame.text), [0, 1, 2, 3, 4, 5, 6, 7, 8, 255]);
  assert.equal(parseCsvFrame("1,2,3"), null);
  assert.throws(() => normalizeCsvFrame([0, "bad"], 2), TypeError);
});

test("serial transport keeps one write outstanding and replaces pending frames with the latest", async () => {
  const firstWrite = deferred();
  const writes = [];
  const writer = {
    desiredSize: 1,
    write(bytes) {
      writes.push(new TextDecoder().decode(bytes));
      return writes.length === 1 ? firstWrite.promise : Promise.resolve();
    },
    releaseLock() {},
  };
  const port = {
    writable: { getWriter: () => writer },
    async open(options) { assert.equal(options.baudRate, 115200); },
    async close() {},
    getInfo: () => ({ usbVendorId: 0x2341, usbProductId: 0x1002 }),
  };
  const serialApi = new EventTarget();
  serialApi.requestPort = async () => port;
  const transport = new SerialTransport({ serialApi });
  await transport.connect();
  assert.equal(transport.status, "CONNECTED");

  transport.sendLatest(Array(10).fill(10));
  transport.sendLatest(Array(10).fill(20));
  transport.sendLatest(Array(10).fill(30));
  assert.equal(writes.length, 1);
  assert.equal(transport.pendingFrameCount, 1);
  assert.equal(transport.stats.activeWrites, 1);
  firstWrite.resolve();
  await transport.pumpPromise;

  assert.equal(writes.length, 2);
  assert.equal(writes[0], Array(10).fill(10).join(",") + "\n");
  assert.equal(writes[1], Array(10).fill(30).join(",") + "\n");
  assert.equal(transport.pendingFrameCount, 0);
  assert.equal(transport.stats.peakActiveWrites, 1);
  assert.equal(transport.stats.overlaps, 0);
  assert.equal(transport.stats.successfulWrites, 2);
  await transport.disconnect();
  assert.equal(transport.status, "DISCONNECTED");
  await transport.connect();
  assert.equal(transport.status, "CONNECTED");
  await transport.disconnect();
});

test("cancelled connection attempt returns to DISCONNECTED and records the error", async () => {
  const serialApi = new EventTarget();
  serialApi.requestPort = async () => { const error = new Error("No port selected"); error.name = "NotFoundError"; throw error; };
  const transport = new SerialTransport({ serialApi });
  await transport.connect();
  assert.equal(transport.status, "DISCONNECTED");
  assert.equal(transport.error.name, "NotFoundError");
  assert.equal(transport.diagnostics.some((entry) => entry.stage === "requestPort() rejected"), true);
});

test("browser disconnect event releases the active port and reports DISCONNECTED", async () => {
  const writer = { async write() {}, releaseLock() {} };
  const port = { writable: { getWriter: () => writer }, async open() {}, async close() {}, getInfo: () => ({}) };
  const serialApi = new EventTarget();
  serialApi.requestPort = async () => port;
  const transport = new SerialTransport({ serialApi });
  await transport.connect();
  const disconnect = new Event("disconnect");
  Object.defineProperty(disconnect, "port", { value: port });
  serialApi.dispatchEvent(disconnect);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(transport.connected, false);
  assert.equal(transport.status, "DISCONNECTED");
  assert.equal(transport.diagnostics.some((entry) => entry.stage === "port disconnected"), true);
});

test("rejected serial write reports an error and clears the connection", async () => {
  const writer = {
    async write() { throw new Error("device write failed"); },
    releaseLock() {},
  };
  const port = { writable: { getWriter: () => writer }, async open() {}, async close() {}, getInfo: () => ({}) };
  const serialApi = new EventTarget();
  serialApi.requestPort = async () => port;
  const transport = new SerialTransport({ serialApi });
  await transport.connect();
  transport.sendLatest(Array(10).fill(10));
  await transport.pumpPromise;
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(transport.status, "ERROR");
  assert.equal(transport.stats.failedWrites, 1);
  assert.equal(transport.connected, false);
});
