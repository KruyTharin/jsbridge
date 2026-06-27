export {};

declare global {
  interface Window {
    SentinelBridge?: {
      onCompleteKYCProcess?: (payload: string) => void;
      onRequestInitialData?: (payload?: unknown) => void;
      [key: string]: unknown;
    };

    webkit?: {
      messageHandlers?: {
        iOSBridge?: {
          postMessage: (message: {
            handlerName: string;
            payload: unknown;
          }) => void;
        };
      };
    };

    onResponseInitialData?: (jwt: string) => void;
    [key: string]: unknown;
  }
}

// -------------------- TYPES --------------------

type PendingRequest<T = unknown> = {
  resolve: (data: T) => void;
  reject: (err: Error) => void;
};

type EventHandler<T = unknown> = (data: T) => void;

type BridgePlatform = "android" | "ios" | "none";

const LOG_PREFIX = "[SentinelBridge]";

const RESPONSE_HANDLERS: Record<string, string> = {
  onRequestInitialData: "onResponseInitialData",
};

// -------------------- HELPERS --------------------

function log(step: string, ...args: unknown[]) {
  console.log(`${LOG_PREFIX} ${step}`, ...args);
}

function warn(step: string, ...args: unknown[]) {
  console.warn(`${LOG_PREFIX} ${step}`, ...args);
}

function getWindow(): Window | undefined {
  if (typeof window === "undefined") return undefined;
  return window;
}

function getBridgePlatform(): BridgePlatform {
  const w = getWindow();
  if (!w) return "none";
  if (w.SentinelBridge) return "android";
  if (w.webkit?.messageHandlers?.iOSBridge) return "ios";
  return "none";
}

function safeParse<T = unknown>(data: unknown): T {
  if (typeof data === "string") {
    try {
      return JSON.parse(data) as T;
    } catch {
      return data as T;
    }
  }
  return data as T;
}

function isBridgeAvailable(): boolean {
  return getBridgePlatform() !== "none";
}

function previewData(data: unknown): unknown {
  if (typeof data === "string" && data.length > 80) {
    return `${data.slice(0, 80)}...`;
  }
  return data;
}

function callNative(handlerName: string, payload: unknown): boolean {
  const w = getWindow();
  if (!w) {
    warn("callNative: no window", handlerName);
    return false;
  }

  const bridge = w.SentinelBridge;
  const androidHandler = bridge?.[handlerName];

  // Android: must call on the injected object — detached calls fail with
  // "Bridge method can't be invoked on a non-injected object"
  if (typeof androidHandler === "function") {
    if (payload != null) {
      log("→ Android", handlerName, payload);
      androidHandler.call(bridge, payload);
    } else {
      log("→ Android", handlerName);
      androidHandler.call(bridge);
    }
    return true;
  }

  const ios = w.webkit?.messageHandlers?.iOSBridge;
  if (ios?.postMessage) {
    const message = { handlerName, payload: payload ?? null };
    log("→ iOS", message);
    ios.postMessage(message);
    return true;
  }

  warn("callNative: bridge not available", handlerName);
  return false;
}

// -------------------- BRIDGE CLASS --------------------

class SentinelBridge {
  private isReady = false;
  private pendingByResponse: Record<string, PendingRequest> = {};
  private events: Record<string, EventHandler[]> = {};

  constructor() {
    if (typeof window !== "undefined") {
      this.registerNativeCallbacks();
    }
  }

  init(timeout = 3000): Promise<void> {
    log("init: started");

    return new Promise((resolve, reject) => {
      const start = Date.now();

      const check = () => {
        const platform = getBridgePlatform();

        if (platform !== "none") {
          this.isReady = true;
          log("init: bridge detected", platform);
          return resolve();
        }

        if (Date.now() - start > timeout) {
          warn("init: timeout");
          return reject(new Error("Bridge not available"));
        }

        setTimeout(check, 50);
      };

      check();
    });
  }

  private registerNativeCallbacks() {
    const w = getWindow();
    if (!w) return;

    w.onResponseInitialData = (jwt: string) => {
      log("← native onResponseInitialData", previewData(jwt));
      this.resolveResponse<string>("onResponseInitialData", jwt);
    };

    const eventHandlers = ["onCompleteKYCProcess"];

    eventHandlers.forEach((name) => {
      w[name] = (data: unknown) => {
        log(`← native event ${name}`, previewData(data));
        this.emit(name, data);
      };
    });

    log("callbacks registered", Object.keys(RESPONSE_HANDLERS), eventHandlers);
  }

  private resolveResponse<T = unknown>(responseHandler: string, data: unknown) {
    const pending = this.pendingByResponse[responseHandler] as
      | PendingRequest<T>
      | undefined;

    if (!pending) {
      warn(`resolveResponse: no pending request for ${responseHandler}`, previewData(data));
      return;
    }

    log(`resolveResponse: ${responseHandler}`, previewData(data));
    pending.resolve(safeParse<T>(data));
    delete this.pendingByResponse[responseHandler];
  }

  private emit<T = unknown>(event: string, data: unknown) {
    const parsed = safeParse<T>(data);
    log(`emit: ${event}`, previewData(parsed));
    this.events[event]?.forEach((cb) => cb(parsed));
  }

  on<T = unknown>(event: string, handler: EventHandler<T>) {
    if (!this.events[event]) {
      this.events[event] = [];
    }

    this.events[event].push(handler as EventHandler);
    log(`on: subscribed to ${event}`);

    return () => {
      this.events[event] = this.events[event].filter((h) => h !== handler);
    };
  }

  send(handlerName: string, payload: unknown = null) {
    log("send", { handlerName, payload: previewData(payload) });

    if (!callNative(handlerName, payload)) {
      warn("send: native bridge not available", handlerName);
    }
  }

  request<T = unknown>(
    handlerName: string,
    payload: unknown = null,
    timeout = 5000,
  ): Promise<T> {
    const responseHandler = RESPONSE_HANDLERS[handlerName];

    if (!responseHandler) {
      return Promise.reject(
        new Error(`No response handler mapped for ${handlerName}`),
      );
    }

    log("request: started", {
      handlerName,
      responseHandler,
      payload: previewData(payload),
      timeout,
    });

    return new Promise<T>((resolve, reject) => {
      this.pendingByResponse[responseHandler] = {
        resolve: (data) => {
          log("request: resolved", { handlerName, data: previewData(data) });
          resolve(data as T);
        },
        reject: (err) => {
          warn("request: rejected", { handlerName, error: err.message });
          reject(err);
        },
      };

      if (!callNative(handlerName, payload)) {
        delete this.pendingByResponse[responseHandler];
        reject(new Error("Native bridge not available"));
        return;
      }

      setTimeout(() => {
        if (this.pendingByResponse[responseHandler]) {
          warn("request: timeout", { handlerName, responseHandler, timeout });
          this.pendingByResponse[responseHandler].reject(new Error("Timeout"));
          delete this.pendingByResponse[responseHandler];
        }
      }, timeout);
    });
  }
}

export const sentinelBridge = new SentinelBridge();
