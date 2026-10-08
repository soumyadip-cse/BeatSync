export class MicrophoneSource extends EventTarget {
  constructor({ mediaDevices = navigator.mediaDevices } = {}) {
    super();
    this.mediaDevices = mediaDevices;
    this.stream = null;
    this.deviceId = "";
    this.state = "IDLE";
    this._endedHandler = null;
  }

  async listInputs() {
    if (!this.mediaDevices?.enumerateDevices) return [];
    return (await this.mediaDevices.enumerateDevices()).filter((device) => device.kind === "audioinput");
  }

  async start(deviceId = "") {
    if (!this.mediaDevices?.getUserMedia) {
      throw new Error("Microphone capture is unavailable in this browser context.");
    }
    if (this.stream) this.stop();
    this.state = "REQUESTING_PERMISSION";
    this.dispatchEvent(new CustomEvent("statechange", { detail: { state: this.state } }));
    try {
      this.stream = await this.mediaDevices.getUserMedia({
        audio: {
          ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
        video: false,
      });
      this.deviceId = deviceId;
      this.state = "ACTIVE";
      const track = this.stream.getAudioTracks()[0];
      this._endedHandler = () => this._handleEnded();
      track?.addEventListener("ended", this._endedHandler, { once: true });
      this.dispatchEvent(new CustomEvent("statechange", { detail: { state: this.state } }));
      return this.stream;
    } catch (error) {
      this.stream = null;
      this.deviceId = "";
      this.state = error?.name === "NotAllowedError" ? "PERMISSION_DENIED" : "ERROR";
      this.dispatchEvent(new CustomEvent("statechange", { detail: { state: this.state, error } }));
      throw error;
    }
  }

  stop() {
    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        if (this._endedHandler) track.removeEventListener("ended", this._endedHandler);
        track.stop();
      }
    }
    this.stream = null;
    this.deviceId = "";
    this._endedHandler = null;
    this.state = "IDLE";
    this.dispatchEvent(new CustomEvent("statechange", { detail: { state: this.state } }));
  }

  _handleEnded() {
    this.stream = null;
    this.deviceId = "";
    this._endedHandler = null;
    this.state = "ENDED";
    this.dispatchEvent(new CustomEvent("statechange", { detail: { state: this.state } }));
  }

  get active() {
    return Boolean(this.stream?.getAudioTracks().some((track) => track.readyState === "live"));
  }
}

