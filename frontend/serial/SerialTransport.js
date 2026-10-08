import { SERIAL_BAUD_RATE } from "../hardware/Arduino10LedProfile.js";
import { encodeCsvFrame, normalizeCsvFrame } from "./SerialProtocol.js";

export class SerialTransport extends EventTarget {
  constructor({ baudRate = SERIAL_BAUD_RATE, frameLength = 10, serialApi = globalThis.navigator?.serial } = {}) {
    super();
    this.baudRate = baudRate;
    this.frameLength = frameLength;
    this.serialApi = serialApi;
    this.port = null;
    this.writer = null;
    this.pendingFrame = null;
    this.pumpPromise = null;
    this.attemptInProgress = false;
    this.closing = false;
    this.status = "DISCONNECTED";
    this.error = null;
    this.deviceId = "--";
    this.attemptPhase = "idle";
    this.diagnostics = [];
    this.stats = {
      frameCount: 0,
      successfulWrites: 0,
      failedWrites: 0,
      activeWrites: 0,
      peakActiveWrites: 0,
      overlaps: 0,
      backpressure: 0,
      desiredSize: null,
      lastFrame: null,
      lastWriteAt: null,
    };

    if (this.serialApi?.addEventListener) {
      this.serialApi.addEventListener("disconnect", (event) => {
        if (event.port !== this.port) return;
        this._record("port disconnected", this._portInfo(event.port));
        void this._finishDisconnect("The selected USB serial device disconnected.", "DISCONNECTED");
      });
    }
  }

  get connected() {
    return Boolean(this.port && this.writer && this.status === "CONNECTED");
  }

  get pendingFrameCount() {
    return this.pendingFrame ? 1 : 0;
  }

  async connect() {
    if (this.attemptInProgress || this.connected || this.closing) return;
    this.attemptInProgress = true;
    this.error = null;
    this.diagnostics = [];
    this._setStatus("CONNECTING", "Choose the Arduino port in the browser dialog.");
    let selectedPort = null;
    let selectedWriter = null;

    try {
      if (!this.serialApi) {
        const unsupported = new Error("Web Serial is unavailable in this browser or page context.");
        unsupported.name = "NotSupportedError";
        throw unsupported;
      }
      if (this.port || this.writer) {
        this._record("stale connection cleanup started");
        await this._finishDisconnect("Cleaning up the previous port reference.", "DISCONNECTED");
        this._record("stale connection cleanup completed");
      }

      this.attemptPhase = "requestPort";
      this._record("requestPort() started");
      try {
        selectedPort = await this.serialApi.requestPort();
        this.deviceId = this._portId(selectedPort);
        this._record("requestPort() resolved", this._portInfo(selectedPort));
      } catch (error) {
        this._record("requestPort() rejected", this._errorText(error));
        throw error;
      }

      this.attemptPhase = "port.open";
      this._record("port.open() started", `baudRate ${this.baudRate}; ${this._portInfo(selectedPort)}`);
      try {
        await selectedPort.open({ baudRate: this.baudRate });
        this._record("port.open() resolved");
      } catch (error) {
        this._record("port.open() rejected", this._errorText(error));
        throw error;
      }

      if (!selectedPort.writable) throw new Error("The selected serial port has no writable stream.");
      this.attemptPhase = "writer.getWriter";
      this._record("writer.getWriter() started");
      try {
        selectedWriter = selectedPort.writable.getWriter();
        this._record("writer.getWriter() resolved");
      } catch (error) {
        this._record("writer.getWriter() rejected", this._errorText(error));
        throw error;
      }
      this.port = selectedPort;
      this.writer = selectedWriter;
      this.closing = false;
      this.attemptPhase = "connected";
      this._setStatus("CONNECTED", "Serial port open at 115200 baud.");
      this._record("final connection state", "CONNECTED");
    } catch (error) {
      this.error = { name: error?.name || "Error", message: error?.message || "Unknown connection error" };
      this._record("connection failed", `${this.error.name}: ${this.error.message}; phase ${this.attemptPhase}`);
      if (selectedWriter) {
        try { selectedWriter.releaseLock(); } catch (releaseError) { this._record("writer cleanup error", this._errorText(releaseError)); }
      }
      if (selectedPort) {
        try {
          await selectedPort.close();
          this._record("failed port cleanup completed");
        } catch (closeError) {
          this._record("port cleanup error", this._errorText(closeError));
        }
      }
      this.port = null;
      this.writer = null;
      this.deviceId = "--";
      this.attemptPhase = "failed";
      this._setStatus("DISCONNECTED", this.error.name === "NotFoundError" ? "Port selection was cancelled." : this.error.message);
      this._record("final connection state", `DISCONNECTED; ${this.error.name}: ${this.error.message}`);
    } finally {
      this.attemptInProgress = false;
      this.dispatchEvent(new CustomEvent("attemptcomplete", { detail: { status: this.status, error: this.error } }));
    }
  }

  sendLatest(values) {
    if (!this.connected || this.closing) return false;
    if (!Array.isArray(values) || values.length !== this.frameLength) {
      this.error = { name: "RangeError", message: `Expected exactly ${this.frameLength} LED values.` };
      this.stats.failedWrites += 1;
      this._emitStats();
      return false;
    }
    let frame;
    try {
      frame = normalizeCsvFrame(values, this.frameLength);
    } catch (error) {
      this.error = { name: error?.name || "TypeError", message: error?.message || "Invalid serial frame." };
      this.stats.failedWrites += 1;
      this._emitStats();
      return false;
    }
    this.stats.frameCount += 1;
    this.pendingFrame = frame;
    this._startPump();
    this._emitStats();
    return true;
  }

  _startPump() {
    if (this.pumpPromise || !this.pendingFrame || !this.writer || this.closing) return;
    this.pumpPromise = this._drainFrames();
  }

  async _drainFrames() {
    let writeFailed = false;
    try {
      while (this.pendingFrame && this.writer && !this.closing) {
        const frame = this.pendingFrame;
        this.pendingFrame = null;
        const activeWriter = this.writer;
        const { bytes } = encodeCsvFrame(frame, this.frameLength);
        if (this.stats.activeWrites > 0) this.stats.overlaps += 1;
        this.stats.activeWrites += 1;
        this.stats.peakActiveWrites = Math.max(this.stats.peakActiveWrites, this.stats.activeWrites);
        this.stats.lastWriteAt = new Date().toISOString();
        try {
          this.stats.desiredSize = activeWriter.desiredSize;
          if (this.stats.desiredSize !== null && this.stats.desiredSize <= 0) this.stats.backpressure += 1;
          await activeWriter.write(bytes);
          this.stats.successfulWrites += 1;
          this.stats.lastFrame = frame;
          this.dispatchEvent(new CustomEvent("sent", { detail: { frame, bytes: bytes.byteLength, timestamp: this.stats.lastWriteAt } }));
        } catch (error) {
          this.stats.failedWrites += 1;
          this.error = { name: error?.name || "Error", message: error?.message || "Serial write failed" };
          this._record("writer.write() rejected", `${this.error.name}: ${this.error.message}`);
          writeFailed = true;
          this.pendingFrame = null;
          break;
        } finally {
          this.stats.activeWrites = Math.max(0, this.stats.activeWrites - 1);
          this._emitStats();
        }
      }
    } finally {
      this.pumpPromise = null;
      if (writeFailed) {
        this._setStatus("ERROR", this.error?.message || "Serial write failed.");
        void this._finishDisconnect("Serial connection closed after a write failure.", "ERROR");
      } else if (this.pendingFrame && this.writer && !this.closing) {
        this._startPump();
      }
    }
  }

  async disconnect() {
    await this._finishDisconnect("Disconnected by the user.", "DISCONNECTED");
  }

  async _finishDisconnect(message, finalStatus) {
    this.closing = true;
    this.pendingFrame = null;
    if (this.pumpPromise) {
      try { await this.pumpPromise; } catch { /* The write failure is recorded by the pump. */ }
    }
    if (this.writer) {
      try { this.writer.releaseLock(); } catch (error) { this._record("writer release error", this._errorText(error)); }
    }
    const oldPort = this.port;
    this.writer = null;
    this.port = null;
    this.deviceId = "--";
    if (oldPort) {
      try { await oldPort.close(); } catch (error) { this._record("port close error", this._errorText(error)); }
    }
    this.closing = false;
    this._setStatus(finalStatus, message);
    this._record("final connection state", finalStatus);
  }

  _setStatus(status, message) {
    this.status = status;
    this.dispatchEvent(new CustomEvent("statechange", { detail: { status, message, phase: this.attemptPhase } }));
  }

  _emitStats() {
    this.dispatchEvent(new CustomEvent("statschange", { detail: { ...this.stats } }));
  }

  _record(stage, details = "") {
    const entry = { at: new Date().toISOString(), elapsedMs: Math.round(performance.now()), stage, details };
    this.diagnostics.unshift(entry);
    this.diagnostics = this.diagnostics.slice(0, 20);
    this.attemptPhase = stage;
    this.dispatchEvent(new CustomEvent("diagnostic", { detail: entry }));
    return entry;
  }

  _portInfo(port) {
    try {
      return `device id ${this._portId(port)}`;
    } catch (error) {
      return `device information unavailable (${this._errorText(error)})`;
    }
  }

  _portId(port) {
    try {
      const info = port?.getInfo?.() || {};
      return [info.usbVendorId, info.usbProductId]
        .filter((value) => value !== undefined)
        .map((value) => `0x${value.toString(16).padStart(4, "0")}`)
        .join(" / ") || "USB identity not exposed by browser";
    } catch (error) {
      return `unavailable (${this._errorText(error)})`;
    }
  }

  _errorText(error) {
    return `${error?.name || "Error"}: ${error?.message || "Unknown error"}`;
  }
}
