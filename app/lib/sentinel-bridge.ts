type PendingRequest = {
  resolve: (data: any) => void;
  reject: (err: any) => void;
};

type NativeOutboundMessage = {
  action: string;
  payload?: unknown;
  requestId?: string;
};

type SentinelWindow = Window & {
  SentinelBridge?: { postMessage: (msg: string) => void };
  webkit?: {
    messageHandlers?: {
      SentinelBridge?: { postMessage: (msg: NativeOutboundMessage) => void };
    };
  };
};

function getSentinelWindow(): SentinelWindow | undefined {
  if (typeof window === "undefined") return undefined;
  return window as SentinelWindow;
}

function postToNative(message: NativeOutboundMessage): boolean {
  const w = getSentinelWindow();
  if (!w) return false;

  // Android WebView JavascriptInterface
  if (w.SentinelBridge?.postMessage) {
    w.SentinelBridge.postMessage(JSON.stringify(message));
    return true;
  }

  // iOS WKWebView message handler
  const iosHandler = w.webkit?.messageHandlers?.SentinelBridge;
  if (iosHandler?.postMessage) {
    iosHandler.postMessage(message);
    return true;
  }

  return false;
}

class SentinelBridge {
  private isReady = false;
  private pending: Record<string, PendingRequest> = {};

  constructor() {
    if (typeof window !== "undefined") {
      (window as any).onNativeMessage = this.handleMessage.bind(this);
    }
  }

  init(): Promise<void> {
    return new Promise((resolve) => {
      const check = () => {
        if (this.isReady) return resolve();
        setTimeout(check, 50);
      };
      check();
    });
  }

  private handleMessage(message: any) {
    console.log("📩 From Native:", message);

    if (message.event === "bridgeReady") {
      this.isReady = true;
      return;
    }

    // handle response with requestId
    if (message.requestId && this.pending[message.requestId]) {
      this.pending[message.requestId].resolve(message.data);
      delete this.pending[message.requestId];
      return;
    }

    // fallback events
    if (message.event === "userData") {
      console.log("👤 User:", message.data);
    }
  }

  send(action: string, payload: any = {}) {
    if (!postToNative({ action, payload })) {
      console.warn("⚠️ Native bridge not available");
    }
  }

  request<T = unknown>(action: string, payload: any = {}): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const requestId = Date.now().toString();

      this.pending[requestId] = { resolve, reject };

      if (!postToNative({ action, payload, requestId })) {
        delete this.pending[requestId];
        reject(new Error("Native bridge not available"));
        return;
      }

      setTimeout(() => {
        if (this.pending[requestId]) {
          reject(new Error("Timeout"));
          delete this.pending[requestId];
        }
      }, 5000);
    });
  }
}

export const sentinelBridge = new SentinelBridge();
