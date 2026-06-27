export {};

declare global {
  interface Window {
    SentinelBridge?: {
      onCompleteKYCProcess?: (payload: string) => void;
      onRequestInitialData?: (payload?: unknown) => void;

      // allow dynamic handlers
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

    // native → web callbacks
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

// request → response mapping
const RESPONSE_HANDLERS: Record<string, string> = {
  onRequestInitialData: "onResponseInitialData",
};

// -------------------- HELPERS --------------------

function getWindow(): Window | undefined {
  if (typeof window === "undefined") return undefined;
  return window;
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
  const w = getWindow();
  return !!(w?.SentinelBridge || w?.webkit?.messageHandlers?.iOSBridge);
}

function callNative(handlerName: string, payload: unknown): boolean {
  const w = getWindow();
  if (!w) return false;

  // ✅ Android
  const androidHandler = w.SentinelBridge?.[handlerName];

  if (typeof androidHandler === "function") {
    androidHandler(payload);
    return true;
  }

  // ✅ iOS
  const ios = w.webkit?.messageHandlers?.iOSBridge;

  if (ios?.postMessage) {
    ios.postMessage({
      handlerName,
      payload: payload ?? null,
    });
    return true;
  }

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

  // -------------------- INIT --------------------

  init(timeout = 3000): Promise<void> {
    return new Promise((resolve, reject) => {
      const start = Date.now();

      const check = () => {
        if (isBridgeAvailable()) {
          this.isReady = true;
          return resolve();
        }

        if (Date.now() - start > timeout) {
          return reject(new Error("Bridge not available"));
        }

        setTimeout(check, 50);
      };

      check();
    });
  }

  // -------------------- REGISTER CALLBACKS --------------------

  private registerNativeCallbacks() {
    const w = getWindow();
    if (!w) return;

    // ✅ response callback
    w.onResponseInitialData = (jwt: string) => {
      this.resolveResponse<string>("onResponseInitialData", jwt);
    };

    // ✅ event callbacks
    const eventHandlers = ["onCompleteKYCProcess"];

    eventHandlers.forEach((name) => {
      w[name] = (data: unknown) => {
        console.log(`📩 Event: ${name}`, data);
        this.emit(name, data);
      };
    });
  }

  // -------------------- RESPONSE HANDLING --------------------

  private resolveResponse<T = unknown>(responseHandler: string, data: unknown) {
    const pending = this.pendingByResponse[responseHandler] as
      | PendingRequest<T>
      | undefined;

    if (!pending) {
      console.warn(`No pending request for ${responseHandler}`, data);
      return;
    }

    pending.resolve(safeParse<T>(data));
    delete this.pendingByResponse[responseHandler];
  }

  // -------------------- EVENTS --------------------

  private emit<T = unknown>(event: string, data: unknown) {
    const parsed = safeParse<T>(data);
    this.events[event]?.forEach((cb) => cb(parsed));
  }

  on<T = unknown>(event: string, handler: EventHandler<T>) {
    if (!this.events[event]) {
      this.events[event] = [];
    }

    this.events[event].push(handler as EventHandler);

    return () => {
      this.events[event] = this.events[event].filter((h) => h !== handler);
    };
  }

  // -------------------- SEND --------------------

  send(handlerName: string, payload: unknown = null) {
    if (!callNative(handlerName, payload)) {
      console.warn("⚠️ Native bridge not available");
    }
  }

  // -------------------- REQUEST (Promise-based) --------------------

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

    return new Promise<T>((resolve, reject) => {
      this.pendingByResponse[responseHandler] = {
        resolve: (data) => resolve(data as T),
        reject,
      };

      if (!callNative(handlerName, payload)) {
        delete this.pendingByResponse[responseHandler];
        reject(new Error("Native bridge not available"));
        return;
      }

      setTimeout(() => {
        if (this.pendingByResponse[responseHandler]) {
          this.pendingByResponse[responseHandler].reject(new Error("Timeout"));
          delete this.pendingByResponse[responseHandler];
        }
      }, timeout);
    });
  }
}

// -------------------- EXPORT --------------------

export const sentinelBridge = new SentinelBridge();
