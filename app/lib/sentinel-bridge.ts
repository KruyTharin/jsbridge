type Callback = (data: any) => void;

interface BridgeMessage {
  id?: string;
  method?: string;
  params?: any;
  data?: any;
  error?: string;
  event?: string;
  version?: string;
}

interface JSBridgeOptions {
  timeout?: number;
  debug?: boolean;
}

const BRIDGE_NAME = "SentinelBridge";
const VERSION = "1.0.0";

class SentinelBridge {
  private callbacks: Record<string, { resolve: Function; reject: Function }> =
    {};
  private eventHandlers: Record<string, Callback[]> = {};
  private requestId = 0;

  private isReady = false;
  private readyQueue: Array<() => void> = [];

  constructor(private options: JSBridgeOptions = {}) {
    this.log("Bridge instance created", { version: VERSION, options });
  }

  private log(...args: any[]) {
    if (this.options.debug) {
      console.log("[SentinelBridge]", ...args);
    }
  }

  private generateId() {
    return `sb_${Date.now()}_${this.requestId++}`;
  }

  private getNativeBridge() {
    const w = window as any;

    // Android
    if (w[BRIDGE_NAME]?.postMessage) {
      this.log("Native bridge detected: Android");
      return {
        type: "android",
        send: (msg: any) => w[BRIDGE_NAME].postMessage(JSON.stringify(msg)),
      };
    }

    // iOS
    if (w.webkit?.messageHandlers?.[BRIDGE_NAME]) {
      this.log("Native bridge detected: iOS");
      return {
        type: "ios",
        send: (msg: any) =>
          w.webkit.messageHandlers[BRIDGE_NAME].postMessage(msg),
      };
    }

    this.log("Native bridge not detected");
    return null;
  }

  // ✅ Wait until bridge ready
  private waitUntilReady(): Promise<void> {
    if (this.isReady) {
      this.log("Bridge already ready");
      return Promise.resolve();
    }

    this.log("Waiting for bridge ready...");

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.log("Bridge ready timeout");
        reject(new Error("Bridge not ready"));
      }, this.options.timeout || 5000);

      this.readyQueue.push(() => {
        clearTimeout(timeout);
        this.log("Bridge ready handshake complete");
        resolve();
      });
    });
  }

  // 🚀 Public init (optional)
  init(): Promise<void> {
    this.log("Init started");
    return this.waitUntilReady().then(() => {
      this.log("Init complete");
    });
  }

  isAvailable() {
    const available = !!this.getNativeBridge();
    this.log("isAvailable:", available);
    return available;
  }

  // 🔥 Web → Native
  async call<T = any>(method: string, params?: any): Promise<T> {
    await this.waitUntilReady();

    const bridge = this.getNativeBridge();
    if (!bridge) {
      this.log("CALL rejected: bridge not available", { method, params });
      return Promise.reject("SentinelBridge not available");
    }

    const id = this.generateId();

    const message: BridgeMessage = {
      id,
      method,
      params,
      version: VERSION,
    };

    this.log("CALL →", { platform: bridge.type, ...message });

    return new Promise((resolve, reject) => {
      this.callbacks[id] = { resolve, reject };

      bridge.send(message);
      this.log("CALL sent", { id, method });

      setTimeout(() => {
        if (this.callbacks[id]) {
          delete this.callbacks[id];
          this.log("CALL timeout", { id, method });
          reject(new Error("Timeout"));
        }
      }, this.options.timeout || 5000);
    });
  }

  // 🔁 Native → Web
  handleMessage(raw: any) {
    let message: BridgeMessage;

    try {
      message = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      this.log("Invalid message", raw);
      return;
    }

    this.log("RECEIVE ←", message);

    const { id, data, error, event } = message;

    // ✅ READY HANDSHAKE
    if (event === "bridgeReady") {
      this.isReady = true;
      this.log("Bridge Ready ✅", { queuedWaiters: this.readyQueue.length });

      this.readyQueue.forEach((resolve) => resolve());
      this.readyQueue = [];

      return;
    }

    // ✅ Response handling
    if (id && this.callbacks[id]) {
      const { resolve, reject } = this.callbacks[id];
      delete this.callbacks[id];

      if (error) {
        this.log("CALL response error ←", { id, error });
        reject(error);
      } else {
        this.log("CALL response success ←", { id, data });
        resolve(data);
      }
      return;
    }

    // ✅ Event handling
    if (event && this.eventHandlers[event]) {
      this.log("EVENT dispatch", {
        event,
        handlerCount: this.eventHandlers[event].length,
        data,
      });
      this.eventHandlers[event].forEach((cb) => cb(data));
      return;
    }

    if (event) {
      this.log("EVENT ignored (no handlers)", { event, data });
      return;
    }

    if (id) {
      this.log("Response ignored (unknown id)", { id, data, error });
    }
  }

  // 📡 Events
  on(event: string, callback: Callback) {
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = [];
    }
    this.eventHandlers[event].push(callback);
    this.log("EVENT subscribed", {
      event,
      handlerCount: this.eventHandlers[event].length,
    });
  }

  off(event: string, callback: Callback) {
    const before = this.eventHandlers[event]?.length ?? 0;
    this.eventHandlers[event] =
      this.eventHandlers[event]?.filter((cb) => cb !== callback) || [];
    this.log("EVENT unsubscribed", {
      event,
      removed: before - this.eventHandlers[event].length,
      handlerCount: this.eventHandlers[event].length,
    });
  }
}

export const sentinelBridge = new SentinelBridge({
  timeout: 5000,
  debug: true,
});
